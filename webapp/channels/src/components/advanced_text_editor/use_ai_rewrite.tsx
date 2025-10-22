// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {
    FormatLetterCaseIcon,
    ArrowExpandIcon,
    ArrowCollapseIcon,
    TextBoxOutlineIcon,
    CreationOutlineIcon,
} from '@mattermost/compass-icons/components';

import {Client4} from 'mattermost-redux/client';

import * as Menu from 'components/menu';
import Input from 'components/widgets/inputs/input/input';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import type {PostDraft} from 'types/store/draft';

import {IconContainer} from './formatting_bar/formatting_icon';

import './use_ai_rewrite.scss';

const useAIRewrite = (
    draft: PostDraft,
    handleDraftChange: ((draft: PostDraft, options: { instant?: boolean; show?: boolean }) => void),
    focusTextbox: (keepFocus?: boolean) => void,
) => {
    const {formatMessage} = useIntl();
    const [isProcessing, setIsProcessing] = useState(false);
    const [originalMessage, setOriginalMessage] = useState('');
    const [lastAction, setLastAction] = useState<string | null>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [prompt, setPrompt] = useState('');
    const [textareaWrapper, setTextareaWrapper] = useState<Element | null>(null);
    const currentPromiseRef = useRef<Promise<string> | null>(null);

    // Find the textarea wrapper element for positioning the overlay
    useEffect(() => {
        // Try multiple selectors to find the textarea container
        const wrapper = document.querySelector('.textarea-wrapper') ||
                       document.querySelector('.custom-textarea') ||
                       document.querySelector('textarea')?.parentElement;
        setTextareaWrapper(wrapper || null);

        // If not found immediately, try again after a short delay
        if (!wrapper) {
            const timeout = setTimeout(() => {
                const retryWrapper = document.querySelector('.textarea-wrapper') ||
                                   document.querySelector('.custom-textarea') ||
                                   document.querySelector('textarea')?.parentElement;
                setTextareaWrapper(retryWrapper || null);
            }, 100);

            return () => clearTimeout(timeout);
        }

        return undefined;
    }, []);

    const handleAIRewrite = useCallback(async (action?: string, prompt?: string) => {
        // If already processing, ignore the new request
        if (isProcessing) {
            return;
        }

        setIsProcessing(true);
        setOriginalMessage(draft.message);
        if (action) {
            setLastAction(action);
        }

        // Create the promise and store it
        const promise = Client4.getAIRewrittenMessage(draft.message, action, prompt);
        currentPromiseRef.current = promise;

        try {
            const response = await promise;

            // Check if this is still the current promise (not cancelled)
            if (currentPromiseRef.current === promise) {
                const updatedDraft = {
                    ...draft,
                    message: response,
                };

                handleDraftChange(updatedDraft, {instant: true});
                //focusTextbox();
            }
        } catch (error) {
            // Only log error if this is still the current promise
            if (currentPromiseRef.current === promise) {
                console.error('AI rewrite error', error);
                // TODO: Show error in the footer when error handling is implemented
            }
        } finally {
            // Only update state if this is still the current promise
            if (currentPromiseRef.current === promise) {
                setIsProcessing(false);
                currentPromiseRef.current = null;
            }
        }
    }, [draft, handleDraftChange, focusTextbox, isProcessing]);

    const cancelProcessing = useCallback(() => {
        setIsProcessing(false);
        setOriginalMessage('');
        currentPromiseRef.current = null;
    }, []);

    const handleCustomPromptKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === ' ') {
            e.stopPropagation();
            return;
        }
        if (e.key === 'Enter') {
            e.stopPropagation();
            handleAIRewrite('custom', prompt);
        }
    }, [handleAIRewrite, prompt]);

    // Automatically render overlay when processing
    useEffect(() => {
        if (!isProcessing || !textareaWrapper) {
            return undefined;
        }

        // Create the overlay element
        const overlay = document.createElement('div');
        overlay.className = 'ai-rewrite-overlay';

        // Add to textarea wrapper
        textareaWrapper.appendChild(overlay);

        // Cleanup function to remove overlay
        return () => {
            if (textareaWrapper.contains(overlay)) {
                textareaWrapper.removeChild(overlay);
            }
        };
    }, [isProcessing, textareaWrapper]);

    useEffect(() => {
        if (isProcessing) {
            return;
        }
        setOriginalMessage('');
        setLastAction(null);
        setPrompt('');
    }, [draft.message]);

    const undoMessage = useCallback(() => {
        handleDraftChange({
            ...draft,
            message: originalMessage,
        }, {instant: true});
        focusTextbox();
        setOriginalMessage('');
        setLastAction(null);
        setPrompt('');
    }, [draft, handleDraftChange, focusTextbox]);

    const regenerateMessage = useCallback(() => {
        handleDraftChange({
            ...draft,
            message: originalMessage,
        }, {instant: true});
        if (lastAction) {
            handleAIRewrite(lastAction, lastAction === 'custom' ? prompt : undefined);
        }
    }, [handleAIRewrite, lastAction]);

    const additionalControl = useMemo(() => {
        const showMenuItem = !isProcessing && draft.message.trim();

        const placeholderText = draft.message.trim() ? formatMessage({
            id: 'texteditor.aiRewrite.prompt',
            defaultMessage: 'Ask AI to edit message...',
        }) : formatMessage({
            id: 'texteditor.aiRewrite.create',
            defaultMessage: 'Create a new message...',
        });

        return (
            <Menu.Container
                key='ai-rewrite-menu-key'
                menuHeader={(
                    <div className='ai-rewrite-menu-header'>
                        {isProcessing &&
                            <button
                                className='btn btn-danger btn-xs'
                                type='button'
                                onClick={cancelProcessing}
                            >
                                <i className='icon icon-close'/>
                                <FormattedMessage
                                    id='texteditor.aiRewrite.cancel'
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
                                    id='texteditor.aiRewrite.undo'
                                    defaultMessage='Undo'
                                />
                            </button>
                            <button
                                className='btn btn-tertiary btn-xs'
                                type='button'
                                onClick={regenerateMessage}
                            >
                                <i className='icon icon-content-copy'/>
                                <FormattedMessage
                                    id='texteditor.aiRewrite.regenerate'
                                    defaultMessage='Regenerate'
                                />
                            </button>
                        </>}
                        <Input
                            inputPrefix={isProcessing ? <LoadingSpinner/> : <CreationOutlineIcon size={18}/>}
                            placeholder={isProcessing && prompt ? prompt : placeholderText}
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
                                id: 'texteditor.aiRewrite',
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
                        id: 'texteditor.aiRewrite',
                        defaultMessage: 'AI Rewrite',
                    }),
                }}
                menu={{
                    id: 'ai-rewrite-menu',
                    'aria-label': formatMessage({
                        id: 'texteditor.aiRewrite.menu',
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
                                    id: 'texteditor.aiRewrite.shorten',
                                    defaultMessage: 'Shorten',
                                })}
                            </span>
                        }
                        leadingElement={<ArrowCollapseIcon size={18}/>}
                        onClick={() => handleAIRewrite('shorten')}
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
                                    id: 'texteditor.aiRewrite.elaborate',
                                    defaultMessage: 'Elaborate',
                                })}
                            </span>
                        }
                        leadingElement={<ArrowExpandIcon size={18}/>}
                        onClick={() => handleAIRewrite('elaborate')}
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
                                    id: 'texteditor.aiRewrite.improveWriting',
                                    defaultMessage: 'Improve writing',
                                })}
                            </span>
                        }
                        leadingElement={<FormatLetterCaseIcon size={18}/>}
                        onClick={() => handleAIRewrite('improve_writing')}
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
                                    id: 'texteditor.aiRewrite.fixSpelling',
                                    defaultMessage: 'Fix spelling and grammar',
                                })}
                            </span>
                        }
                        leadingElement={<FormatLetterCaseIcon size={18}/>}
                        onClick={() => handleAIRewrite('fix_spelling')}
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
                                    id: 'texteditor.aiRewrite.simplify',
                                    defaultMessage: 'Simplify',
                                })}
                            </span>
                        }
                        leadingElement={<CreationOutlineIcon size={18}/>}
                        onClick={() => handleAIRewrite('simplify')}
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
                                    id: 'texteditor.aiRewrite.summarize',
                                    defaultMessage: 'Summarize',
                                })}
                            </span>
                        }
                        leadingElement={<TextBoxOutlineIcon size={18}/>}
                        onClick={() => handleAIRewrite('summarize')}
                    />
                }
            </Menu.Container>
        );
    }, [
        draft.message,
        isProcessing,
        formatMessage,
        handleAIRewrite,
        isMenuOpen,
        setIsMenuOpen,
        prompt,
        handleCustomPromptKeyDown,
        cancelProcessing,
    ]);

    const clearOriginalMessage = useCallback(() => {
        setOriginalMessage('');
    }, [setOriginalMessage]);

    return {
        additionalControl,
        isProcessing,
        clearOriginalMessage,
    };
};

export default useAIRewrite;

