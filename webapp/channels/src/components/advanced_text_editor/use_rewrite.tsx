// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PopoverActions} from '@mui/material/Popover';
import React, {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {ServerError} from '@mattermost/types/errors';

import {getAgents as getAgentsAction} from 'mattermost-redux/actions/agents';
import {Client4} from 'mattermost-redux/client';
import {getAgents} from 'mattermost-redux/selectors/entities/agents';

import {useSelectedAgent} from 'components/common/agents';
import type TextboxClass from 'components/textbox/textbox';

import type {PostDraft} from 'types/store/draft';

import {RewriteAction} from './rewrite_action';
import {RewriteMenuPopover} from './rewrite_menu';

type RewriteSurface = {
    getInputBox: () => HTMLElement | null;
};

const useRewrite = (
    draft: PostDraft,
    handleDraftChange: ((draft: PostDraft, options: {instant?: boolean; show?: boolean}) => void),
    textboxRef: React.RefObject<TextboxClass | null>,
    focusTextbox: (keepFocus?: boolean) => void,
    setServerError: React.Dispatch<React.SetStateAction<(ServerError & {
        submittedMessage?: string;
    }) | null>>,
    wysiwygRef?: {readonly current: RewriteSurface | null},
) => {
    const dispatch = useDispatch();
    const agents = useSelector(getAgents);
    const [selectedAgentId, setSelectedAgentId] = useSelectedAgent(agents);

    const [prompt, setPrompt] = useState('');

    const [isProcessing, setIsProcessing] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
    const menuAnchorRef = useRef<HTMLElement | null>(null);
    const composerRootRef = useRef<HTMLElement | null>(null);
    const popoverActionsRef = useRef<PopoverActions | null>(null);
    menuAnchorRef.current = menuAnchor;

    const [originalMessage, setOriginalMessage] = useState('');
    const [lastAction, setLastAction] = useState<RewriteAction>(RewriteAction.CUSTOM);
    const [lastPrompt, setLastPrompt] = useState('');

    const currentPromiseRef = useRef<Promise<string>>(undefined);
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

        const promise = Client4.getAIRewrittenMessage(selectedAgentId, draft.message, action, prompt, draft.rootId);
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
    }, [draft, handleDraftChange, isProcessing, selectedAgentId, setServerError]);

    const resetState = useCallback(() => {
        setOriginalMessage('');
        setLastAction(RewriteAction.CUSTOM);
        setPrompt('');
        setLastPrompt('');
    }, []);

    const undoMessage = useCallback(() => {
        handleDraftChange({
            ...draft,
            message: originalMessage,
        }, {instant: true});
        focusTextbox();
        resetState();
    }, [draft, focusTextbox, handleDraftChange, originalMessage, resetState]);

    const regenerateMessage = useCallback(() => {
        setPrompt(lastPrompt);
        handleDraftChange({
            ...draft,
            message: originalMessage,
        }, {instant: true});
        if (lastAction) {
            handleRewrite(lastAction, lastAction === RewriteAction.CUSTOM ? lastPrompt : undefined);
        }
    }, [draft, handleDraftChange, handleRewrite, lastAction, lastPrompt, originalMessage]);

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
            if (e.nativeEvent.isComposing) {
                return;
            }
            e.stopPropagation();
            handleRewrite(RewriteAction.CUSTOM, prompt);
        }
    }, [handleRewrite, prompt]);

    const handleMenuAction = useCallback((action: RewriteAction) => {
        return () => handleRewrite(action);
    }, [handleRewrite]);

    const openMenu = useCallback((anchor: HTMLElement | null) => {
        composerRootRef.current = anchor?.closest('.AdvancedTextEditor') ?? null;
        setMenuAnchor(anchor);
        setIsMenuOpen(true);
    }, []);

    // The drafted text grows the composer, and the + can be a new DOM node
    // afterward. A detached anchor measures as 0,0. Rebind to the live button,
    // or to the composer if it is gone, and remeasure when the node is unchanged.
    const syncPopoverAnchor = useCallback(() => {
        const root = composerRootRef.current;
        const button = root?.querySelector<HTMLElement>('#agentComposerMenuButton');
        const current = menuAnchorRef.current;

        let next: HTMLElement | null = null;
        if (button?.isConnected) {
            next = button;
        } else if (current?.isConnected) {
            next = current;
        } else if (root?.isConnected) {
            next = root;
        }

        if (!next) {
            return;
        }
        if (current !== next) {
            setMenuAnchor(next);
            return;
        }
        popoverActionsRef.current?.updatePosition();
    }, []);

    useLayoutEffect(() => {
        if (!isMenuOpen) {
            return;
        }
        syncPopoverAnchor();
    }, [draft.message, isMenuOpen, isProcessing, syncPopoverAnchor]);

    useEffect(() => {
        if (!isMenuOpen) {
            return undefined;
        }
        const root = composerRootRef.current;
        if (!root || typeof ResizeObserver === 'undefined') {
            return undefined;
        }
        const observer = new ResizeObserver(() => {
            syncPopoverAnchor();
        });
        observer.observe(root);
        return () => observer.disconnect();
    }, [isMenuOpen, syncPopoverAnchor]);

    const closeMenu = useCallback(() => {
        setIsMenuOpen(false);
        focusTextbox(true);
    }, [focusTextbox]);

    useEffect(() => {
        dispatch(getAgentsAction());
    }, [dispatch]);

    useEffect(() => {
        if (isMenuOpen && !draft.message.trim()) {
            customPromptRef.current?.focus();
        }
    }, [isMenuOpen, draft.message]);

    // Cover the composer text with the gradient while a rewrite is in flight.
    // The editor also renders this class. Skip when that node is already there
    // so the sweep is not stacked. The rich text editor does not mount the
    // legacy textbox, so fall back to its surface.
    useEffect(() => {
        if (!isProcessing) {
            return undefined;
        }

        const input = textboxRef.current?.getInputBox() ?? wysiwygRef?.current?.getInputBox() ?? null;
        if (!input) {
            return undefined;
        }

        const composer = input.closest('.AdvancedTextEditor');
        if (composer?.querySelector('.rewrite-overlay')) {
            return undefined;
        }

        const host = input.closest('.textarea-wrapper, .WysiwygEditor') ?? input.parentElement;
        if (!host) {
            return undefined;
        }

        const overlay = document.createElement('div');
        overlay.className = 'rewrite-overlay';
        host.appendChild(overlay);

        return () => {
            overlay.remove();
        };
    }, [isProcessing, textboxRef, wysiwygRef]);

    useEffect(() => {
        if (isProcessing || draft.message.trim()) {
            return;
        }
        resetState();
    }, [draft.message, isProcessing, resetState]);

    const rewriteMenuProps = useMemo(() => ({
        isProcessing,
        isMenuOpen,
        setIsMenuOpen,
        draftMessage: draft.message,
        prompt,
        setPrompt,
        selectedAgentId,
        setSelectedAgentId,
        agents: agents || [],
        originalMessage,
        lastAction,
        onMenuAction: handleMenuAction,
        onCustomPromptKeyDown: handleCustomPromptKeyDown,
        onCancelProcessing: cancelProcessing,
        onUndoMessage: undoMessage,
        onRegenerateMessage: regenerateMessage,
        customPromptRef,
        openMenu,
    }), [
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
        openMenu,
    ]);

    const rewritePopover = (
        <RewriteMenuPopover
            {...rewriteMenuProps}
            anchor={menuAnchor}
            onClose={closeMenu}
            popoverActionsRef={popoverActionsRef}
        />
    );

    return {
        rewriteMenuProps,
        rewritePopover,
        isProcessing,
    };
};

export default useRewrite;

