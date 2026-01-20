// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Editor} from '@tiptap/react';
import {useCallback, useEffect, useRef, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {ServerError} from '@mattermost/types/errors';

import {getAgents as getAgentsAction} from 'mattermost-redux/actions/agents';
import {Client4} from 'mattermost-redux/client';
import {getAgents} from 'mattermost-redux/selectors/entities/agents';

import {savePageDraft} from 'actions/page_drafts';
import {createPage as createPageAction} from 'actions/pages';
import {getWiki} from 'selectors/pages';

import {RewriteAction} from 'components/advanced_text_editor/rewrite_action';

import type {GlobalState} from 'types/store';

import type {Language} from './language_picker';

import type {TipTapDoc} from '../ai_utils';
import {extractTextChunks, reassembleDocument, cloneDocument} from '../ai_utils';

interface UsePageTranslateReturn {
    isTranslating: boolean;
    showModal: boolean;
    openModal: () => void;
    closeModal: () => void;
    translatePage: (language: Language) => Promise<void>;
}

/**
 * Hook for translating an entire TipTap page to a new language.
 *
 * The translation creates a new page as a child of the current page with:
 * - Translated content
 * - Metadata linking to the original page
 * - Title with language indicator
 */
const usePageTranslate = (
    editor: Editor | null,
    pageTitle: string,
    wikiId: string,
    pageId: string | undefined,
    onPageCreated?: (pageId: string) => void,
    setServerError?: React.Dispatch<React.SetStateAction<(ServerError & {submittedMessage?: string}) | null>>,
): UsePageTranslateReturn => {
    const dispatch = useDispatch();
    const agents = useSelector(getAgents);
    const wiki = useSelector((state: GlobalState) => getWiki(state, wikiId));

    const [isTranslating, setIsTranslating] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [selectedAgentId, setSelectedAgentId] = useState<string>('');

    // Ref to track mounted state for cleanup
    const isMountedRef = useRef(true);

    // Cleanup on unmount
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // Load agents on mount
    useEffect(() => {
        dispatch(getAgentsAction());
    }, [dispatch]);

    // Auto-select first agent
    useEffect(() => {
        if (agents && agents.length > 0 && !selectedAgentId) {
            setSelectedAgentId(agents[0].id);
        }
    }, [agents, selectedAgentId]);

    const openModal = useCallback(() => {
        setShowModal(true);
    }, []);

    const closeModal = useCallback(() => {
        if (!isTranslating) {
            setShowModal(false);
        }
    }, [isTranslating]);

    /**
     * Translates a single text chunk to the target language.
     */
    const translateText = useCallback(async (text: string, language: Language): Promise<string> => {
        if (!selectedAgentId || !text.trim()) {
            return text;
        }

        const translationPrompt = `Translate the following text to ${language.name}. Preserve all formatting, maintain the same tone and style, and ensure the translation is natural and accurate. Return ONLY the translated text, no explanations.`;

        const translatedText = await Client4.getAIRewrittenMessage(
            selectedAgentId,
            text,
            RewriteAction.CUSTOM,
            translationPrompt,
        );

        return translatedText;
    }, [selectedAgentId]);

    /**
     * Translates the entire document to the target language using the text-nodes-only pipeline.
     * This preserves document structure while only modifying text content.
     */
    const translateDocument = useCallback(async (doc: TipTapDoc, language: Language): Promise<TipTapDoc> => {
        // Clone the document to avoid mutating the original
        const clonedDoc = cloneDocument(doc);

        // Extract text chunks
        const {chunks} = extractTextChunks(clonedDoc);

        if (chunks.length === 0) {
            return clonedDoc;
        }

        // Translate each chunk sequentially to enable progress reporting
        const translatedTexts: string[] = [];
        for (const chunk of chunks) {
            if (chunk.text.trim()) {
                // eslint-disable-next-line no-await-in-loop
                const translated = await translateText(chunk.text, language);
                translatedTexts.push(translated);
            } else {
                translatedTexts.push(chunk.text);
            }
        }

        // Reassemble the document with translated text
        const {doc: translatedDoc} = reassembleDocument(clonedDoc, chunks, translatedTexts);

        return translatedDoc;
    }, [translateText]);

    const translatePage = useCallback(async (language: Language) => {
        if (!editor || isTranslating || !selectedAgentId || !wikiId) {
            return;
        }

        // Get current document
        const currentDoc = editor.getJSON() as TipTapDoc;

        // Quick check if there's content to translate
        const {chunks} = extractTextChunks(currentDoc);
        if (chunks.length === 0) {
            return;
        }

        setIsTranslating(true);
        setServerError?.(null);

        try {
            // Translate the document
            const translatedDoc = await translateDocument(currentDoc, language);

            // Check if still mounted before continuing
            if (!isMountedRef.current) {
                return;
            }

            // Translate the title
            const translatedTitle = await translateText(pageTitle, language);

            // Check if still mounted before continuing
            if (!isMountedRef.current) {
                return;
            }

            // Create new page title with language indicator
            const newPageTitle = `${translatedTitle} (${language.nativeName})`;

            // Create a new page (draft) as a child of the current page
            const createResult = await dispatch(createPageAction(wikiId, newPageTitle, pageId));

            if ('error' in createResult && createResult.error) {
                throw createResult.error;
            }

            // Check if still mounted before continuing
            if (!isMountedRef.current) {
                return;
            }

            const draftId = createResult.data as string;

            // Save translated content to the draft (user can review before publishing)
            const translatedContent = JSON.stringify(translatedDoc);
            const channelId = wiki?.channel_id || '';
            const saveResult = await dispatch(savePageDraft(
                channelId,
                wikiId,
                draftId,
                translatedContent,
                newPageTitle,
                0, // lastUpdateAt - 0 means new draft
                {
                    page_parent_id: pageId || '',
                    translation_source_page_id: pageId,
                    translation_language_code: language.code,
                },
            ));

            if ('error' in saveResult && saveResult.error) {
                throw saveResult.error;
            }

            // Check if still mounted before updating state
            if (!isMountedRef.current) {
                return;
            }

            // Close modal and navigate to the draft for review
            if (isMountedRef.current) {
                setShowModal(false);
                onPageCreated?.(draftId);
            }
        } catch (err) {
            // Only update error state if still mounted
            if (isMountedRef.current) {
                const serverError: ServerError = {
                    message: err instanceof Error ? err.message : 'Translation failed',
                    server_error_id: 'translate_error',
                    status_code: 500,
                };
                setServerError?.(serverError);
            }
            throw err;
        } finally {
            // Only update state if still mounted
            if (isMountedRef.current) {
                setIsTranslating(false);
            }
        }
    }, [
        dispatch,
        editor,
        isTranslating,
        selectedAgentId,
        wiki,
        wikiId,
        pageId,
        pageTitle,
        translateDocument,
        translateText,
        onPageCreated,
        setServerError,
    ]);

    return {
        isTranslating,
        showModal,
        openModal,
        closeModal,
        translatePage,
    };
};

export default usePageTranslate;
