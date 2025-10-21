// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useMemo, useState} from 'react';
import {useIntl} from 'react-intl';

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
    shouldShowPreview: boolean,
) => {
    const {formatMessage} = useIntl();
    const [isProcessing, setIsProcessing] = useState(false);
    const [isMenuOpen, setIsMenuOpenState] = useState(false);
    const [prompt, setPrompt] = useState('');

    const setIsMenuOpen = useCallback((open: boolean) => {
        setIsMenuOpenState(open);
        if (!open) {
            setPrompt('');
        }
    }, [setIsMenuOpenState]);

    const handleAIRewrite = useCallback(async (action?: string, prompt?: string) => {
        if (!draft.message.trim()) {
            return;
        }

        setIsProcessing(true);
        try {
            const response = await Client4.getAIRewrittenMessage(draft.message, action, prompt);

            const updatedDraft = {
                ...draft,
                message: response,
            };

            handleDraftChange(updatedDraft, {instant: true});
            focusTextbox();
        } catch (error) {
            // TODO: Show error in the footer when error handling is implemented
        } finally {
            setIsProcessing(false);
        }
    }, [draft, handleDraftChange, focusTextbox]);

    const handleCustomPromptKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.stopPropagation();
            handleAIRewrite('custom', prompt);
            setIsMenuOpen(false);
        }
    }, [handleAIRewrite, prompt, setIsMenuOpen]);

    const additionalControl = useMemo(() => {
        const isDisabled = shouldShowPreview || !draft.message.trim() || isProcessing;

        return (
            <Menu.Container
                key='ai-rewrite-menu-key'
                menuHeader={(
                    <div className='ai-rewrite-menu-header'>
                        <Input
                            inputPrefix={<CreationOutlineIcon size={18}/>}
                            placeholder={formatMessage({
                                id: 'texteditor.aiRewrite.prompt',
                                defaultMessage: 'Ask AI to edit selection...',
                            })}
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            onKeyDown={handleCustomPromptKeyDown}
                        />
                    </div>
                )}
                menuButton={{
                    id: 'ai-rewrite-button',
                    as: 'div',
                    disabled: isDisabled,
                    children: (
                        <IconContainer
                            id='ai-rewrite'
                            className={classNames('control', {active: isMenuOpen})}
                            disabled={isDisabled}
                            type='button'
                            aria-label={formatMessage({
                                id: 'texteditor.aiRewrite',
                                defaultMessage: 'AI Rewrite',
                            })}
                        >
                            {isProcessing ? (
                                <LoadingSpinner/>
                            ) : (
                                <CreationOutlineIcon
                                    size={18}
                                    color='currentColor'
                                />
                            )}
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
            >
                <Menu.Item
                    key='ai-shorten'
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
                <Menu.Item
                    key='ai-elaborate'
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
                <Menu.Item
                    key='ai-improve-writing'
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
                <Menu.Item
                    key='ai-fix-spelling'
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
                <Menu.Item
                    key='ai-simplify'
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
                <Menu.Item
                    key='ai-summarize'
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
            </Menu.Container>
        );
    }, [
        shouldShowPreview,
        draft.message,
        isProcessing,
        formatMessage,
        handleAIRewrite,
        isMenuOpen,
        setIsMenuOpen,
        prompt,
        handleCustomPromptKeyDown,
    ]);

    return {
        additionalControl,
        isProcessing,
    };
};

export default useAIRewrite;

