// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Editor} from '@tiptap/react';
import {useCallback, useEffect, useRef, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {ServerError} from '@mattermost/types/errors';

import {getAgents as getAgentsAction} from 'mattermost-redux/actions/agents';
import {getAgents} from 'mattermost-redux/selectors/entities/agents';

import {savePageDraft} from 'actions/page_drafts';
import {createPage as createPageAction} from 'actions/pages';
import {getWiki} from 'selectors/pages';

import type {GlobalState} from 'types/store';

import type {ProofreadProgress, ProofreadResult} from './proofread_action';
import {proofreadDocumentImmutable, previewProofread} from './proofread_action';

import type {TipTapDoc} from '../ai_utils';

interface UsePageProofreadReturn {
    isProcessing: boolean;
    progress: ProofreadProgress | null;
    error: ServerError | null;
    proofread: () => Promise<void>;
}

/**
 * Hook for proofreading an entire TipTap page.
 *
 * Creates a new draft page as a child of the current page with:
 * - Proofread content (spelling and grammar corrected)
 * - Title with "(Proofread)" indicator
 */
const usePageProofread = (
    editor: Editor | null,
    pageTitle: string,
    wikiId: string,
    pageId: string | undefined,
    onPageCreated?: (pageId: string) => void,
    setServerError?: React.Dispatch<React.SetStateAction<(ServerError & {submittedMessage?: string}) | null>>,
): UsePageProofreadReturn => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const agents = useSelector(getAgents);
    const wiki = useSelector((state: GlobalState) => getWiki(state, wikiId));

    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState<ProofreadProgress | null>(null);
    const [error, setError] = useState<ServerError | null>(null);
    const [selectedAgentId, setSelectedAgentId] = useState<string>('');

    // Ref to track current promise for cancellation
    const currentPromiseRef = useRef<Promise<ProofreadResult>>();

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

    const handleProgress = useCallback((p: ProofreadProgress) => {
        setProgress(p);
    }, []);

    const proofread = useCallback(async () => {
        if (!editor || isProcessing || !selectedAgentId || !wikiId) {
            return;
        }

        // Get current document
        const currentDoc = editor.getJSON() as TipTapDoc;

        // Quick check if there's content to proofread
        const preview = previewProofread(currentDoc);
        if (preview.textChunkCount === 0) {
            return;
        }

        setIsProcessing(true);
        setError(null);
        setServerError?.(null);
        setProgress({current: 0, total: preview.textChunkCount, status: 'extracting'});

        const promise = proofreadDocumentImmutable(currentDoc, selectedAgentId, handleProgress);
        currentPromiseRef.current = promise;

        try {
            const result = await promise;

            // Only continue if this is still the current operation and component is mounted
            if (currentPromiseRef.current !== promise || !isMountedRef.current) {
                return;
            }

            if (result.success) {
                // Create new page title with proofread indicator
                const newPageTitle = formatMessage(
                    {id: 'ai_tools.proofread_title', defaultMessage: '{title} (Proofread)'},
                    {title: pageTitle},
                );

                // Create a new draft page as a child of the current page
                const createResult = await dispatch(createPageAction(wikiId, newPageTitle, pageId));

                if ('error' in createResult && createResult.error) {
                    throw createResult.error;
                }

                if (!isMountedRef.current) {
                    return;
                }

                const draftId = createResult.data as string;

                // Save proofread content to the draft (user can review before publishing)
                const proofreadContent = JSON.stringify(result.doc);
                const channelId = wiki?.channel_id || '';
                const saveResult = await dispatch(savePageDraft(
                    channelId,
                    wikiId,
                    draftId,
                    proofreadContent,
                    newPageTitle,
                    0, // lastUpdateAt - 0 means new draft
                    {page_parent_id: pageId || ''},
                ));

                if ('error' in saveResult && saveResult.error) {
                    throw saveResult.error;
                }

                if (!isMountedRef.current) {
                    return;
                }

                // Navigate to the draft for review before publishing
                onPageCreated?.(draftId);

                setProgress({current: result.totalChunks, total: result.totalChunks, status: 'complete'});
            } else {
                // Handle proofreading errors
                const errorMessage = result.errors.join('; ') || 'Proofreading failed';
                const serverError: ServerError = {
                    message: errorMessage,
                    server_error_id: 'proofread_error',
                    status_code: 500,
                };
                setError(serverError);
                setServerError?.(serverError);
            }
        } catch (err) {
            if (isMountedRef.current) {
                const serverError: ServerError = {
                    message: err instanceof Error ? err.message : 'Unknown error',
                    server_error_id: 'proofread_error',
                    status_code: 500,
                };
                setError(serverError);
                setServerError?.(serverError);
                setProgress(null);
            }
        } finally {
            if (isMountedRef.current && currentPromiseRef.current === promise) {
                setIsProcessing(false);
                currentPromiseRef.current = undefined;
            }
        }
    }, [
        dispatch,
        editor,
        formatMessage,
        handleProgress,
        isProcessing,
        onPageCreated,
        pageId,
        pageTitle,
        selectedAgentId,
        setServerError,
        wiki,
        wikiId,
    ]);

    return {
        isProcessing,
        progress,
        error,
        proofread,
    };
};

export default usePageProofread;
