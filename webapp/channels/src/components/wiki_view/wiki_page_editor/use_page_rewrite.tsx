// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Editor} from '@tiptap/react';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {ServerError} from '@mattermost/types/errors';

import {getAgents as getAgentsAction} from 'mattermost-redux/actions/agents';
import {Client4} from 'mattermost-redux/client';
import {getAgents} from 'mattermost-redux/selectors/entities/agents';

import {RewriteAction} from 'components/advanced_text_editor/rewrite_action';
import RewriteMenu from 'components/advanced_text_editor/rewrite_menu';
import {openMenu} from 'components/menu';

import type {Language} from './ai/language_picker';

const usePageRewrite = (
    editor: Editor | null,
    setServerError: React.Dispatch<React.SetStateAction<(ServerError & {
        submittedMessage?: string;
    }) | null>>,
) => {
    const dispatch = useDispatch();
    const agents = useSelector(getAgents);

    const [prompt, setPrompt] = useState('');
    const [selectedAgentId, setSelectedAgentId] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // Undo/redo state
    const [originalText, setOriginalText] = useState('');
    const [originalSelection, setOriginalSelection] = useState({from: 0, to: 0});
    const [lastAction, setLastAction] = useState<RewriteAction>(RewriteAction.CUSTOM);
    const [lastPrompt, setLastPrompt] = useState('');

    const currentPromiseRef = useRef<Promise<string>>();
    const customPromptRef = useRef<HTMLInputElement | null>(null);

    // Get selected text from TipTap editor
    const selectedText = useMemo(() => {
        if (!editor) {
            return '';
        }
        const {from, to} = editor.state.selection;
        return editor.state.doc.textBetween(from, to);
    }, [editor?.state.selection]);

    const handleRewrite = useCallback(async (action?: RewriteAction, customPrompt?: string) => {
        if (isProcessing || !editor) {
            return;
        }

        const {from, to} = editor.state.selection;
        const textToRewrite = editor.state.doc.textBetween(from, to);

        if (!textToRewrite.trim()) {
            return;
        }

        setServerError(null);
        setIsProcessing(true);
        setOriginalText(textToRewrite);
        setOriginalSelection({from, to});
        setLastPrompt(customPrompt || '');
        if (action) {
            setLastAction(action);
        }

        const promise = Client4.getAIRewrittenMessage(
            selectedAgentId,
            textToRewrite,
            action,
            customPrompt,
        );
        currentPromiseRef.current = promise;

        try {
            const response = await promise;

            if (currentPromiseRef.current === promise) {
                editor.chain().
                    focus().
                    setTextSelection({from, to}).
                    insertContent(response).
                    run();

                setPrompt('');
            }
        } catch (error) {
            if (currentPromiseRef.current === promise) {
                setServerError(error);
                setOriginalText('');
                setLastAction(RewriteAction.CUSTOM);
            }
        } finally {
            if (currentPromiseRef.current === promise) {
                setIsProcessing(false);
                currentPromiseRef.current = undefined;
            }
        }
    }, [editor, isProcessing, selectedAgentId, setServerError]);

    const resetState = useCallback(() => {
        setOriginalText('');
        setLastAction(RewriteAction.CUSTOM);
        setPrompt('');
    }, []);

    const undoMessage = useCallback(() => {
        if (!editor || !originalText) {
            return;
        }

        editor.chain().
            focus().
            setTextSelection(originalSelection).
            insertContent(originalText).
            run();

        resetState();
    }, [editor, originalText, originalSelection, resetState]);

    const regenerateMessage = useCallback(() => {
        setPrompt(lastPrompt);

        if (!editor || !originalText) {
            return;
        }

        // Restore original text first
        editor.chain().
            focus().
            setTextSelection(originalSelection).
            insertContent(originalText).
            run();

        if (lastAction) {
            handleRewrite(lastAction, lastAction === RewriteAction.CUSTOM ? lastPrompt : undefined);
        }
    }, [editor, originalText, originalSelection, lastAction, lastPrompt, handleRewrite]);

    const cancelProcessing = useCallback(() => {
        setIsProcessing(false);
        setOriginalText('');
        currentPromiseRef.current = undefined;
    }, []);

    const handleCustomPromptKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === ' ') {
            e.stopPropagation();
            return;
        }
        if (e.key === 'Enter') {
            e.stopPropagation();
            handleRewrite(RewriteAction.CUSTOM, prompt);
        }
    }, [handleRewrite, prompt]);

    const handleMenuAction = useCallback((action: RewriteAction) => {
        return () => handleRewrite(action);
    }, [handleRewrite]);

    const handleTranslate = useCallback((language: Language) => {
        const translationPrompt = `Translate the following text to ${language.name}. Preserve all formatting, maintain the same tone and style, and ensure the translation is natural and accurate.`;
        handleRewrite(RewriteAction.CUSTOM, translationPrompt);
    }, [handleRewrite]);

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

    // Focus custom prompt when menu opens with no selection
    useEffect(() => {
        if (isMenuOpen && !selectedText.trim()) {
            customPromptRef.current?.focus();
        }
    }, [isMenuOpen, selectedText]);

    // Reset state when text changes and not processing
    useEffect(() => {
        if (!isProcessing && selectedText.trim() && lastAction) {
            resetState();
        }
    }, [selectedText, isProcessing, lastAction, resetState]);

    // Reset state when processing completes and no text selected
    useEffect(() => {
        if (isProcessing || selectedText.trim()) {
            return;
        }
        resetState();
    }, [selectedText, isProcessing, resetState]);

    const openRewriteMenu = useCallback(() => {
        openMenu('rewrite-button');
    }, []);

    return {
        additionalControl: useMemo(() => (
            <RewriteMenu
                isProcessing={isProcessing}
                isMenuOpen={isMenuOpen}
                setIsMenuOpen={setIsMenuOpen}
                draftMessage={selectedText}
                prompt={prompt}
                setPrompt={setPrompt}
                selectedAgentId={selectedAgentId}
                setSelectedAgentId={setSelectedAgentId}
                agents={agents || []}
                originalMessage={originalText}
                lastAction={lastAction}
                onMenuAction={handleMenuAction}
                onCustomPromptKeyDown={handleCustomPromptKeyDown}
                onCancelProcessing={cancelProcessing}
                onUndoMessage={undoMessage}
                onRegenerateMessage={regenerateMessage}
                customPromptRef={customPromptRef}
                onTranslate={handleTranslate}
            />
        ), [
            isProcessing,
            isMenuOpen,
            selectedText,
            prompt,
            selectedAgentId,
            agents,
            originalText,
            lastAction,
            handleMenuAction,
            handleCustomPromptKeyDown,
            cancelProcessing,
            undoMessage,
            regenerateMessage,
            handleTranslate,
        ]),
        isProcessing,
        openRewriteMenu,
    };
};

export default usePageRewrite;
