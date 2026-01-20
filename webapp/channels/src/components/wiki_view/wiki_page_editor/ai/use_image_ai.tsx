// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useRef, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import type {ServerError} from '@mattermost/types/errors';

import {savePageDraft as savePageDraftAction} from 'mattermost-redux/actions/wikis';
import {Client4} from 'mattermost-redux/client';

import {createPage as createPageAction} from 'actions/pages';

import type {ImageAIAction} from './image_ai_bubble';

interface UseImageAIReturn {

    // Dialog states
    showExtractionDialog: boolean;
    showCompletionDialog: boolean;

    // Current action state
    actionType: ImageAIAction | null;
    isProcessing: boolean;
    progress: string;

    // Created page info
    createdPageId: string | null;
    createdPageTitle: string;

    // Actions
    handleImageAIAction: (action: ImageAIAction, imageElement: HTMLImageElement) => Promise<void>;
    cancelExtraction: () => void;
    goToCreatedPage: () => void;
    stayOnCurrentPage: () => void;
}

/**
 * Extracts the Mattermost file ID from an image src URL.
 * Expected formats:
 * - /api/v4/files/{fileId}
 * - /api/v4/files/{fileId}/preview
 * - /api/v4/files/{fileId}/thumbnail
 *
 * @param src - The image src attribute value
 * @returns The file ID or null if not a Mattermost file URL
 */
function extractFileIdFromSrc(src: string): string | null {
    if (!src) {
        return null;
    }

    // Match Mattermost file API URLs
    const fileApiPattern = /\/api\/v4\/files\/([a-zA-Z0-9]+)/;
    const match = src.match(fileApiPattern);

    if (match && match[1]) {
        return match[1];
    }

    return null;
}

/**
 * Parses extracted content as TipTap JSON or falls back to plain text paragraph.
 * The AI returns TipTap JSON format with proper nodes (headings, task lists, etc.)
 */
function parseExtractedContent(extractedContent: string): unknown[] {
    try {
        const parsed = JSON.parse(extractedContent);
        if (parsed && parsed.type === 'doc' && Array.isArray(parsed.content)) {
            return parsed.content;
        }
    } catch {
        // Not valid JSON, fall back to plain text
    }

    // Fallback: wrap plain text in a paragraph
    return [
        {
            type: 'paragraph',
            content: [
                {
                    type: 'text',
                    text: extractedContent,
                },
            ],
        },
    ];
}

/**
 * Hook for handling image AI actions (extract handwriting, describe image).
 *
 * Uses the mattermost-plugin-ai bridge to send images for vision analysis.
 * The bridge client supports file attachments via FileIDs, which are included
 * in the completion request for vision-capable AI models.
 *
 * Flow:
 * 1. Extract file ID from image src URL
 * 2. Call the extract-image API endpoint with the file ID
 * 3. Create a draft page with the extracted content
 * 4. Show completion dialog with navigation options
 */
const useImageAI = (
    wikiId: string,
    currentPageId: string | undefined,
    currentPageTitle: string,
    agentId: string | null,
    isExistingPage: boolean,
    onPageCreated?: (pageId: string) => void,
    setServerError?: React.Dispatch<React.SetStateAction<(ServerError & {submittedMessage?: string}) | null>>,
): UseImageAIReturn => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    // Dialog visibility state
    const [showExtractionDialog, setShowExtractionDialog] = useState(false);
    const [showCompletionDialog, setShowCompletionDialog] = useState(false);

    // Current action state
    const [actionType, setActionType] = useState<ImageAIAction | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState('');

    // Created page info
    const [createdPageId, setCreatedPageId] = useState<string | null>(null);
    const [createdPageTitle, setCreatedPageTitle] = useState('');

    // Cancellation ref (useRef to avoid stale closure in async functions)
    const isCancelledRef = useRef(false);

    /**
     * Creates a TipTap document with the extracted/described content and embedded image.
     */
    const createPageContent = useCallback((
        action: ImageAIAction,
        imageSrc: string,
        extractedContent: string,
    ): string => {
        const headingText = action === 'extract_handwriting' ?
            formatMessage({id: 'image_ai.extracted_content', defaultMessage: 'Extracted Content'}) :
            formatMessage({id: 'image_ai.image_description', defaultMessage: 'Image Description'});

        const originalImageHeading = formatMessage({id: 'image_ai.original_image', defaultMessage: 'Original Image'});
        const originalImageAlt = formatMessage({id: 'image_ai.original_image_alt', defaultMessage: 'Original image'});
        const originalImageTitle = formatMessage({id: 'image_ai.original_image_title', defaultMessage: 'Original image from source page'});

        // Parse extracted content as TipTap JSON or fall back to plain text
        const extractedNodes = parseExtractedContent(extractedContent);

        const doc = {
            type: 'doc',
            content: [

                // Heading based on action type
                {
                    type: 'heading',
                    attrs: {level: 2},
                    content: [
                        {
                            type: 'text',
                            text: headingText,
                        },
                    ],
                },

                // Extracted/described content (TipTap nodes from AI or fallback paragraph)
                ...extractedNodes,

                // Divider
                {
                    type: 'horizontalRule',
                },

                // Original image heading
                {
                    type: 'heading',
                    attrs: {level: 3},
                    content: [
                        {
                            type: 'text',
                            text: originalImageHeading,
                        },
                    ],
                },

                // Embedded original image
                {
                    type: 'image',
                    attrs: {
                        src: imageSrc,
                        alt: originalImageAlt,
                        title: originalImageTitle,
                    },
                },
            ],
        };

        return JSON.stringify(doc);
    }, [formatMessage]);

    /**
     * Calls the AI API to extract text from an image.
     */
    const extractImageText = useCallback(async (
        fileId: string,
        action: ImageAIAction,
    ): Promise<string> => {
        if (!agentId) {
            throw new Error(formatMessage({id: 'image_ai.error.no_agent', defaultMessage: 'No AI agent available. Please configure an AI agent to use this feature.'}));
        }

        setProgress(action === 'extract_handwriting' ?
            formatMessage({id: 'image_ai.progress.analyzing_handwriting', defaultMessage: 'Analyzing handwriting...'}) :
            formatMessage({id: 'image_ai.progress.analyzing_image', defaultMessage: 'Analyzing image...'}),
        );

        const extractedText = await Client4.extractImageText(wikiId, agentId, fileId, action);
        return extractedText;
    }, [wikiId, agentId, formatMessage]);

    /**
     * Main handler for image AI actions.
     */
    const handleImageAIAction = useCallback(async (
        action: ImageAIAction,
        imageElement: HTMLImageElement,
    ) => {
        if (!wikiId || isProcessing) {
            return;
        }

        const imageSrc = imageElement.getAttribute('src') || '';
        if (!imageSrc) {
            return;
        }

        // Extract file ID from the image src URL
        const fileId = extractFileIdFromSrc(imageSrc);
        if (!fileId) {
            const serverError: ServerError = {
                message: formatMessage({
                    id: 'image_ai.error.not_mattermost_file',
                    defaultMessage: 'This image cannot be analyzed. Only images uploaded to Mattermost can be processed by AI.',
                }),
                server_error_id: 'image_ai_not_mattermost_file',
                status_code: 400,
            };
            setServerError?.(serverError);
            return;
        }

        if (!agentId) {
            const serverError: ServerError = {
                message: formatMessage({
                    id: 'image_ai.error.no_agent',
                    defaultMessage: 'No AI agent available. Please configure an AI agent to use this feature.',
                }),
                server_error_id: 'image_ai_no_agent',
                status_code: 400,
            };
            setServerError?.(serverError);
            return;
        }

        isCancelledRef.current = false;
        setActionType(action);
        setIsProcessing(true);
        setShowExtractionDialog(true);
        setProgress(formatMessage({id: 'image_ai.progress.initializing', defaultMessage: 'Initializing...'}));
        setServerError?.(null);

        try {
            // Call the actual AI API to extract text from the image
            const content = await extractImageText(fileId, action);

            // Check if cancelled during processing
            if (isCancelledRef.current) {
                return;
            }

            // Generate page title
            const timestamp = new Date().toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
            const actionLabel = action === 'extract_handwriting' ?
                formatMessage({id: 'image_ai.title.handwriting', defaultMessage: 'Handwriting'}) :
                formatMessage({id: 'image_ai.title.description', defaultMessage: 'Description'});
            const newPageTitle = `${actionLabel} from ${currentPageTitle} (${timestamp})`;

            setProgress(formatMessage({id: 'image_ai.progress.creating_page', defaultMessage: 'Creating draft page...'}));

            // Create a new draft page
            // Only set parent if the current page is published (not a first-time draft)
            // First-time drafts cannot be parents until published.
            const parentPageId = isExistingPage ? currentPageId : undefined;
            const createResult = await dispatch(createPageAction(
                wikiId,
                newPageTitle,
                parentPageId,
            ));

            if ('error' in createResult && createResult.error) {
                throw createResult.error;
            }

            const draftId = createResult.data as string;

            // Check if cancelled
            if (isCancelledRef.current) {
                return;
            }

            // Create page content with embedded image
            const pageContent = createPageContent(action, imageSrc, content);

            setProgress(formatMessage({id: 'image_ai.progress.saving_content', defaultMessage: 'Saving content...'}));

            // Save the draft content WITHOUT publishing - user can review and publish manually
            const saveResult = await dispatch(savePageDraftAction(
                wikiId,
                draftId,
                pageContent,
                newPageTitle,
                undefined, // lastUpdateAt
                {page_parent_id: parentPageId || ''}, // additionalProps
            ));

            if ('error' in saveResult && saveResult.error) {
                throw saveResult.error;
            }

            // Store created draft info
            setCreatedPageId(draftId);
            setCreatedPageTitle(newPageTitle);

            // Show completion dialog
            setShowExtractionDialog(false);
            setShowCompletionDialog(true);
        } catch (err) {
            const serverError: ServerError = {
                message: err instanceof Error ? err.message : formatMessage({id: 'image_ai.error.action_failed', defaultMessage: 'Image AI action failed'}),
                server_error_id: 'image_ai_error',
                status_code: 500,
            };
            setServerError?.(serverError);
            setShowExtractionDialog(false);
        } finally {
            setIsProcessing(false);
            setProgress('');
        }
    }, [
        wikiId,
        currentPageId,
        currentPageTitle,
        agentId,
        isExistingPage,
        isProcessing,
        dispatch,
        createPageContent,
        extractImageText,
        setServerError,
        formatMessage,
    ]);

    /**
     * Cancels the current extraction operation.
     */
    const cancelExtraction = useCallback(() => {
        isCancelledRef.current = true;
        setShowExtractionDialog(false);
        setIsProcessing(false);
        setProgress('');
    }, []);

    /**
     * Navigates to the newly created page.
     */
    const goToCreatedPage = useCallback(() => {
        if (createdPageId) {
            onPageCreated?.(createdPageId);
        }
        setShowCompletionDialog(false);
        setCreatedPageId(null);
        setCreatedPageTitle('');
        setActionType(null);
    }, [createdPageId, onPageCreated]);

    /**
     * Closes the completion dialog without navigating.
     */
    const stayOnCurrentPage = useCallback(() => {
        setShowCompletionDialog(false);
        setCreatedPageId(null);
        setCreatedPageTitle('');
        setActionType(null);
    }, []);

    return {
        showExtractionDialog,
        showCompletionDialog,
        actionType,
        isProcessing,
        progress,
        createdPageId,
        createdPageTitle,
        handleImageAIAction,
        cancelExtraction,
        goToCreatedPage,
        stayOnCurrentPage,
    };
};

export default useImageAI;

// Export for testing
export {extractFileIdFromSrc};
