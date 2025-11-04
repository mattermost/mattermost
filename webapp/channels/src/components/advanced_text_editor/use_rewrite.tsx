// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {
    FormatLetterCaseIcon,
    ArrowExpandIcon,
    ArrowCollapseIcon,
    TextBoxOutlineIcon,
    CreationOutlineIcon,
} from '@mattermost/compass-icons/components';
import type {ServerError} from '@mattermost/types/errors';

import {getAgents as getAgentsAction} from 'mattermost-redux/actions/agents';
import {Client4} from 'mattermost-redux/client';
import {getAgents} from 'mattermost-redux/selectors/entities/agents';

import AgentDropdown from 'components/common/agents/agent_dropdown';
import * as Menu from 'components/menu';
import type TextboxClass from 'components/textbox/textbox';
import Input from 'components/widgets/inputs/input/input';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import type {PostDraft} from 'types/store/draft';

import {IconContainer} from './formatting_bar/formatting_icon';

import './use_rewrite.scss';

enum RewriteAction {
    SHORTEN = 'shorten',
    ELABORATE = 'elaborate',
    IMPROVE_WRITING = 'improve_writing',
    FIX_SPELLING = 'fix_spelling',
    SIMPLIFY = 'simplify',
    SUMMARIZE = 'summarize',
    CUSTOM = 'custom',
}

const useRewrite = (
    draft: PostDraft,
    handleDraftChange: ((draft: PostDraft, options: {instant?: boolean; show?: boolean}) => void),
    textboxRef: React.RefObject<TextboxClass>,
    focusTextbox: (keepFocus?: boolean) => void,
    setServerError: React.Dispatch<React.SetStateAction<(ServerError & {
        submittedMessage?: string;
    }) | null>>,
) => {
    const {formatMessage} = useIntl();
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
        overlay.className = 'ai-rewrite-overlay';
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
        additionalControl: useMemo(() => {
            const showMenuItem = !isProcessing && draft.message.trim();

            let placeholderText = formatMessage({
                id: 'texteditor.rewrite.prompt',
                defaultMessage: 'Ask AI to edit message...',
            });

            if (isProcessing) {
                if (prompt) {
                    placeholderText = prompt;
                } else if (draft.message.trim()) {
                    placeholderText = formatMessage({
                        id: 'texteditor.rewrite.rewriting',
                        defaultMessage: 'Rewriting...',
                    });
                }
            } else if (!draft.message.trim()) {
                placeholderText = formatMessage({
                    id: 'texteditor.rewrite.create',
                    defaultMessage: 'Create a new message...',
                });
            }

            return (
                <Menu.Container
                    key='ai-rewrite-menu-key'
                    menuHeader={(
                        <div className='ai-rewrite-menu-header'>
                            {agents && agents.length > 0 && (
                                <AgentDropdown
                                    selectedBotId={selectedAgentId}
                                    onBotSelect={setSelectedAgentId}
                                    bots={agents}
                                    disabled={isProcessing}
                                />
                            )}
                            {isProcessing &&
                                <button
                                    className='btn btn-danger btn-xs'
                                    type='button'
                                    onClick={cancelProcessing}
                                >
                                    <i className='icon icon-close'/>
                                    <FormattedMessage
                                        id='texteditor.rewrite.cancel'
                                        defaultMessage='Cancel'
                                    />
                                </button>
                            }
                            {!isProcessing && originalMessage && lastAction && <>
                                <button
                                    className='btn btn-tertiary btn-xs'
                                    type='button'
                                    onClick={undoMessage}
                                >
                                    <i className='icon icon-arrow-left'/>
                                    <FormattedMessage
                                        id='texteditor.rewrite.undo'
                                        defaultMessage='Undo'
                                    />
                                </button>
                                <button
                                    className='btn btn-xs'
                                    type='button'
                                    onClick={regenerateMessage}
                                >
                                    <i className='icon icon-content-copy'/>
                                    <FormattedMessage
                                        id='texteditor.rewrite.regenerate'
                                        defaultMessage='Regenerate'
                                    />
                                </button>
                            </>}
                            <Input
                                ref={customPromptRef}
                                inputPrefix={isProcessing ? <LoadingSpinner/> : <CreationOutlineIcon size={18}/>}
                                placeholder={placeholderText}
                                disabled={isProcessing}
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                onKeyDown={handleCustomPromptKeyDown}
                            />
                        </div>
                    )}
                    menuButton={{
                        id: 'ai-rewrite-button',
                        as: 'div',
                        children: (
                            <IconContainer
                                id='ai-rewrite'
                                className={classNames('control', {active: isMenuOpen})}
                                type='button'
                                aria-label={formatMessage({
                                    id: 'texteditor.rewrite',
                                    defaultMessage: 'AI Rewrite',
                                })}
                            >
                                <CreationOutlineIcon
                                    size={18}
                                    color='currentColor'
                                />
                            </IconContainer>
                        ),
                    }}
                    menuButtonTooltip={{
                        text: formatMessage({
                            id: 'texteditor.rewrite',
                            defaultMessage: 'AI Rewrite',
                        }),
                    }}
                    menu={{
                        id: 'ai-rewrite-menu',
                        'aria-label': formatMessage({
                            id: 'texteditor.rewrite.menu',
                            defaultMessage: 'AI Rewrite Options',
                        }),
                        className: 'ai-rewrite-menu',
                        onToggle: setIsMenuOpen,
                        isMenuOpen,
                    }}
                    anchorOrigin={{
                        vertical: 'top',
                        horizontal: 'left',
                    }}
                    transformOrigin={{
                        vertical: 'bottom',
                        horizontal: 'left',
                    }}
                    closeMenuOnTab={false}
                >
                    {showMenuItem &&
                        <Menu.Item
                            key='ai-shorten'
                            role='menuitemradio'
                            aria-checked={false}
                            labels={
                                <span>
                                    {formatMessage({
                                        id: 'texteditor.rewrite.shorten',
                                        defaultMessage: 'Shorten',
                                    })}
                                </span>
                            }
                            leadingElement={<ArrowCollapseIcon size={18}/>}
                            onClick={handleMenuAction(RewriteAction.SHORTEN)}
                        />
                    }
                    {showMenuItem &&
                        <Menu.Item
                            key='ai-elaborate'
                            role='menuitemradio'
                            aria-checked={false}
                            labels={
                                <span>
                                    {formatMessage({
                                        id: 'texteditor.rewrite.elaborate',
                                        defaultMessage: 'Elaborate',
                                    })}
                                </span>
                            }
                            leadingElement={<ArrowExpandIcon size={18}/>}
                            onClick={handleMenuAction(RewriteAction.ELABORATE)}
                        />
                    }
                    {showMenuItem &&
                        <Menu.Item
                            key='ai-improve-writing'
                            role='menuitemradio'
                            aria-checked={false}
                            labels={
                                <span>
                                    {formatMessage({
                                        id: 'texteditor.rewrite.improveWriting',
                                        defaultMessage: 'Improve writing',
                                    })}
                                </span>
                            }
                            leadingElement={<FormatLetterCaseIcon size={18}/>}
                            onClick={handleMenuAction(RewriteAction.IMPROVE_WRITING)}
                        />
                    }
                    {showMenuItem &&
                        <Menu.Item
                            key='ai-fix-spelling'
                            role='menuitemradio'
                            aria-checked={false}
                            labels={
                                <span>
                                    {formatMessage({
                                        id: 'texteditor.rewrite.fixSpelling',
                                        defaultMessage: 'Fix spelling and grammar',
                                    })}
                                </span>
                            }
                            leadingElement={<FormatLetterCaseIcon size={18}/>}
                            onClick={handleMenuAction(RewriteAction.FIX_SPELLING)}
                        />
                    }
                    {showMenuItem &&
                        <Menu.Item
                            key='ai-simplify'
                            role='menuitemradio'
                            aria-checked={false}
                            labels={
                                <span>
                                    {formatMessage({
                                        id: 'texteditor.rewrite.simplify',
                                        defaultMessage: 'Simplify',
                                    })}
                                </span>
                            }
                            leadingElement={<CreationOutlineIcon size={18}/>}
                            onClick={handleMenuAction(RewriteAction.SIMPLIFY)}
                        />
                    }
                    {showMenuItem &&
                        <Menu.Item
                            key='ai-summarize'
                            role='menuitemradio'
                            aria-checked={false}
                            labels={
                                <span>
                                    {formatMessage({
                                        id: 'texteditor.rewrite.summarize',
                                        defaultMessage: 'Summarize',
                                    })}
                                </span>
                            }
                            leadingElement={<TextBoxOutlineIcon size={18}/>}
                            onClick={handleMenuAction(RewriteAction.SUMMARIZE)}
                        />
                    }
                </Menu.Container>
            );
        }, [
            draft.message,
            isProcessing,
            formatMessage,
            handleMenuAction,
            isMenuOpen,
            setIsMenuOpen,
            prompt,
            handleCustomPromptKeyDown,
            cancelProcessing,
            lastAction,
            originalMessage,
            regenerateMessage,
            undoMessage,
            agents,
            selectedAgentId,
        ]),
        isProcessing,
    };
};

export default useRewrite;

