// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {ServerError} from '@mattermost/types/errors';

import {getAgents as getAgentsAction} from 'mattermost-redux/actions/agents';
import {Client4} from 'mattermost-redux/client';
import {getAgents} from 'mattermost-redux/selectors/entities/agents';

import type TextboxClass from 'components/textbox/textbox';

import type {PostDraft} from 'types/store/draft';

import {RewriteAction} from './rewrite_action';
import RewriteMenu from './rewrite_menu';

const useRewrite = (
    draft: PostDraft,
    handleDraftChange: ((draft: PostDraft, options: {instant?: boolean; show?: boolean}) => void),
    textboxRef: React.RefObject<TextboxClass>,
    focusTextbox: (keepFocus?: boolean) => void,
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

    const [originalMessage, setOriginalMessage] = useState('');
    const [lastAction, setLastAction] = useState<RewriteAction>(RewriteAction.CUSTOM);
    const [lastPrompt, setLastPrompt] = useState('');

    const currentPromiseRef = useRef<Promise<string>>();
    const customPromptRef = useRef<HTMLInputElement | null>(null);

    const handleRewrite = useCallback(async (action?: RewriteAction, prompt?: string) => {
        if (isProcessing) {
            return;
        }

        setServerError(null);
        setIsProcessing(true);
        setOriginalMessage(draft.message);
        setLastPrompt(prompt || '');
        if (action) {
            setLastAction(action);
        }

        const promise = Client4.getAIRewrittenMessage(selectedAgentId, draft.message, action, prompt);
        currentPromiseRef.current = promise;

        try {
            const response = await promise;

            if (currentPromiseRef.current === promise) {
                const updatedDraft = {
                    ...draft,
                    message: response,
                };

                handleDraftChange(updatedDraft, {instant: true});

                setPrompt('');
            }
        } catch (error) {
            if (currentPromiseRef.current === promise) {
                setServerError(error);
                setOriginalMessage('');
                setLastAction(RewriteAction.CUSTOM);
            }
        } finally {
            if (currentPromiseRef.current === promise) {
                setIsProcessing(false);
                currentPromiseRef.current = undefined;
            }
        }
    }, [draft, handleDraftChange, isProcessing, setServerError, selectedAgentId]);

    const resetState = useCallback(() => {
        setOriginalMessage('');
        setLastAction(RewriteAction.CUSTOM);
        setPrompt('');
    }, []);

    const undoMessage = useCallback(() => {
        handleDraftChange({
            ...draft,
            message: originalMessage,
        }, {instant: true});
        focusTextbox();
        resetState();
    }, [draft, handleDraftChange, originalMessage, focusTextbox, resetState]);

    const regenerateMessage = useCallback(() => {
        setPrompt(lastPrompt);
        handleDraftChange({
            ...draft,
            message: originalMessage,
        }, {instant: true});
        if (lastAction) {
            handleRewrite(lastAction, lastAction === RewriteAction.CUSTOM ? lastPrompt : undefined);
        }
    }, [draft, handleRewrite, originalMessage, lastAction, lastPrompt, handleDraftChange]);

    const cancelProcessing = useCallback(() => {
        setIsProcessing(false);
        setOriginalMessage('');
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

    useEffect(() => {
        dispatch(getAgentsAction());
    }, [dispatch]);

    useEffect(() => {
        if (agents && agents.length > 0 && !selectedAgentId) {
            setSelectedAgentId(agents[0].id);
        }
    }, [agents, selectedAgentId]);

    useEffect(() => {
        if (isMenuOpen && !draft.message.trim()) {
            customPromptRef.current?.focus();
        }
    }, [isMenuOpen, draft.message]);

    useEffect(() => {
        if (!isProcessing && draft.message.trim() && lastAction) {
            resetState();
        }
    }, [draft.message]);

    // This adds an overlay to the textbox to
    // indicate that the AI is rewriting the message.
    // It might belong in the text editor - but since
    // it's only used here, it's simpler to keep it here.
    useEffect(() => {
        if (!isProcessing || !textboxRef.current) {
            return undefined;
        }

        const inputBox = textboxRef.current.getInputBox();
        const wrapper = inputBox?.parentElement;
        if (!wrapper) {
            return undefined;
        }

        const overlay = document.createElement('div');
        overlay.className = 'rewrite-overlay';
        wrapper.appendChild(overlay);

        return () => {
            if (wrapper.contains(overlay)) {
                wrapper.removeChild(overlay);
            }
        };
    }, [isProcessing, textboxRef]);

    useEffect(() => {
        if (isProcessing || draft.message.trim()) {
            return;
        }
        resetState();
    }, [draft.message, isProcessing, resetState]);

    return {
        additionalControl: useMemo(() => (
            <RewriteMenu
                isProcessing={isProcessing}
                isMenuOpen={isMenuOpen}
                setIsMenuOpen={setIsMenuOpen}
                draftMessage={draft.message}
                prompt={prompt}
                setPrompt={setPrompt}
                selectedAgentId={selectedAgentId}
                setSelectedAgentId={setSelectedAgentId}
                agents={agents || []}
                originalMessage={originalMessage}
                lastAction={lastAction}
                onMenuAction={handleMenuAction}
                onCustomPromptKeyDown={handleCustomPromptKeyDown}
                onCancelProcessing={cancelProcessing}
                onUndoMessage={undoMessage}
                onRegenerateMessage={regenerateMessage}
                customPromptRef={customPromptRef}
            />
        ), [
            isProcessing,
            isMenuOpen,
            setIsMenuOpen,
            draft.message,
            prompt,
            setPrompt,
            selectedAgentId,
            setSelectedAgentId,
            agents,
            originalMessage,
            lastAction,
            handleMenuAction,
            handleCustomPromptKeyDown,
            cancelProcessing,
            undoMessage,
            regenerateMessage,
            customPromptRef,
        ]),
        isProcessing,
    };
};

export default useRewrite;

