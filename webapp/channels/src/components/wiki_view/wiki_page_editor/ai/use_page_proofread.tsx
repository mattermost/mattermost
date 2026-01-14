// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Editor} from '@tiptap/react';
import {useCallback, useEffect, useRef, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {ServerError} from '@mattermost/types/errors';

import {getAgents as getAgentsAction} from 'mattermost-redux/actions/agents';
import {getAgents} from 'mattermost-redux/selectors/entities/agents';

import type {ProofreadProgress, ProofreadResult} from './proofread_action';
import {proofreadDocumentImmutable, previewProofread} from './proofread_action';

import type {TipTapDoc} from '../ai_utils';

interface UsePageProofreadReturn {
    isProcessing: boolean;
    progress: ProofreadProgress | null;
    error: ServerError | null;
    canUndo: boolean;
    proofread: () => Promise<void>;
    undo: () => void;
}

/**
 * Hook for proofreading an entire TipTap page.
 *
 * Usage:
 * ```tsx
 * const {isProcessing, progress, error, canUndo, proofread, undo} = usePageProofread(editor);
 *
 * // Trigger proofreading
 * <button onClick={proofread} disabled={isProcessing}>Proofread</button>
 *
 * // Show progress
 * {isProcessing && <ProgressBar value={progress?.current} max={progress?.total} />}
 *
 * // Undo if needed
 * {canUndo && <button onClick={undo}>Undo</button>}
 * ```
 */
const usePageProofread = (
    editor: Editor | null,
    setServerError?: React.Dispatch<React.SetStateAction<(ServerError & {submittedMessage?: string}) | null>>,
): UsePageProofreadReturn => {
    const dispatch = useDispatch();
    const agents = useSelector(getAgents);

    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState<ProofreadProgress | null>(null);
    const [error, setError] = useState<ServerError | null>(null);
    const [selectedAgentId, setSelectedAgentId] = useState<string>('');

    // Store original document for undo
    const originalDocRef = useRef<TipTapDoc | null>(null);
    const [canUndo, setCanUndo] = useState(false);

    // Ref to track current promise for cancellation
    const currentPromiseRef = useRef<Promise<ProofreadResult>>();

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
        if (!editor || isProcessing || !selectedAgentId) {
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
        setProgress({current: 0, total: preview.textChunkCount, status: 'extracting'});

        // Store original for undo
        originalDocRef.current = currentDoc;

        const promise = proofreadDocumentImmutable(currentDoc, selectedAgentId, handleProgress);
        currentPromiseRef.current = promise;

        try {
            const result = await promise;

            // Only apply if this is still the current operation
            if (currentPromiseRef.current === promise) {
                if (result.success) {
                    // Apply the corrected document to the editor
                    editor.commands.setContent(result.doc);
                    setCanUndo(true);
                } else {
                    // Handle errors
                    const errorMessage = result.errors.join('; ') || 'Proofreading failed';
                    const serverError: ServerError = {
                        message: errorMessage,
                        server_error_id: 'proofread_error',
                        status_code: 500,
                    };
                    setError(serverError);
                    setServerError?.(serverError);
                }

                setProgress({current: result.totalChunks, total: result.totalChunks, status: 'complete'});
            }
        } catch (err) {
            if (currentPromiseRef.current === promise) {
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
            if (currentPromiseRef.current === promise) {
                setIsProcessing(false);
                currentPromiseRef.current = undefined;
            }
        }
    }, [editor, isProcessing, selectedAgentId, handleProgress, setServerError]);

    const undo = useCallback(() => {
        if (!editor || !originalDocRef.current || !canUndo) {
            return;
        }

        editor.commands.setContent(originalDocRef.current);
        originalDocRef.current = null;
        setCanUndo(false);
    }, [editor, canUndo]);

    // Clear undo state when editor content changes (user made edits)
    useEffect(() => {
        if (!editor) {
            return undefined;
        }

        const handleUpdate = () => {
            // If user makes manual edits after proofreading, clear undo state
            // This prevents undoing to a very old state
            if (canUndo && !isProcessing) {
                setCanUndo(false);
                originalDocRef.current = null;
            }
        };

        editor.on('update', handleUpdate);
        return () => {
            editor.off('update', handleUpdate);
        };
    }, [editor, canUndo, isProcessing]);

    return {
        isProcessing,
        progress,
        error,
        canUndo,
        proofread,
        undo,
    };
};

export default usePageProofread;
