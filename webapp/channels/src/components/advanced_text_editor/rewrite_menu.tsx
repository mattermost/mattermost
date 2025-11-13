// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import type {MessageDescriptor} from 'react-intl';
import {defineMessage, FormattedMessage, useIntl} from 'react-intl';

import {
    AiSummarizeIcon,
    CreationOutlineIcon,
    TextShortIcon,
    TextLongIcon,
    AutoFixIcon,
    SpellcheckIcon,
} from '@mattermost/compass-icons/components';
import type {Agent} from '@mattermost/types/agents';

import AgentDropdown from 'components/common/agents/agent_dropdown';
import * as Menu from 'components/menu';
import Input from 'components/widgets/inputs/input/input';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import {IconContainer} from './formatting_bar/formatting_icon';
import {RewriteAction} from './rewrite_action';

import './use_rewrite.scss';

interface MenuItemConfig {
    action: RewriteAction;
    label: MessageDescriptor;
    icon: React.ReactElement;
}

const menuItems: MenuItemConfig[] = [
    {
        action: RewriteAction.SHORTEN,
        label: defineMessage({id: 'texteditor.rewrite.shorten', defaultMessage: 'Shorten'}),
        icon: <TextShortIcon size={18}/>,
    },
    {
        action: RewriteAction.ELABORATE,
        label: defineMessage({id: 'texteditor.rewrite.elaborate', defaultMessage: 'Elaborate'}),
        icon: <TextLongIcon size={18}/>,
    },
    {
        action: RewriteAction.IMPROVE_WRITING,
        label: defineMessage({id: 'texteditor.rewrite.improveWriting', defaultMessage: 'Improve writing'}),
        icon: <AutoFixIcon size={18}/>,
    },
    {
        action: RewriteAction.FIX_SPELLING,
        label: defineMessage({id: 'texteditor.rewrite.fixSpelling', defaultMessage: 'Fix spelling and grammar'}),
        icon: <SpellcheckIcon size={18}/>,
    },
    {
        action: RewriteAction.SIMPLIFY,
        label: defineMessage({id: 'texteditor.rewrite.simplify', defaultMessage: 'Simplify'}),
        icon: <CreationOutlineIcon size={18}/>,
    },
    {
        action: RewriteAction.SUMMARIZE,
        label: defineMessage({id: 'texteditor.rewrite.summarize', defaultMessage: 'Summarize'}),
        icon: <AiSummarizeIcon size={18}/>,
    },
];

export interface RewriteMenuProps {
    isProcessing: boolean;
    isMenuOpen: boolean;
    setIsMenuOpen: (open: boolean) => void;
    draftMessage: string;
    prompt: string;
    setPrompt: (prompt: string) => void;
    selectedAgentId: string;
    setSelectedAgentId: (id: string) => void;
    agents: Agent[];
    originalMessage: string;
    lastAction: RewriteAction;
    onMenuAction: (action: RewriteAction) => () => void;
    onCustomPromptKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    onCancelProcessing: () => void;
    onUndoMessage: () => void;
    onRegenerateMessage: () => void;
    customPromptRef: React.RefObject<HTMLInputElement>;
}

export default function RewriteMenu({
    isProcessing,
    isMenuOpen,
    setIsMenuOpen,
    draftMessage,
    prompt,
    setPrompt,
    selectedAgentId,
    setSelectedAgentId,
    agents,
    originalMessage,
    lastAction,
    onMenuAction,
    onCustomPromptKeyDown,
    onCancelProcessing,
    onUndoMessage,
    onRegenerateMessage,
    customPromptRef,
}: RewriteMenuProps) {
    const {formatMessage} = useIntl();

    const showMenuItem = !isProcessing && draftMessage.trim();

    let placeholderText = formatMessage({
        id: 'texteditor.rewrite.prompt',
        defaultMessage: 'Ask AI to edit message...',
    });

    if (isProcessing) {
        if (prompt) {
            placeholderText = prompt;
        } else if (draftMessage.trim()) {
            placeholderText = formatMessage({
                id: 'texteditor.rewrite.rewriting',
                defaultMessage: 'Rewriting...',
            });
        }
    } else if (!draftMessage.trim()) {
        placeholderText = formatMessage({
            id: 'texteditor.rewrite.create',
            defaultMessage: 'Create a new message...',
        });
    } else if (originalMessage) {
        placeholderText = formatMessage({
            id: 'texteditor.rewrite.nextPrompt',
            defaultMessage: 'What would you like AI to do next?',
        });
    }

    return (
        <Menu.Container
            menuHeader={(
                <div className='rewrite-menu-header'>
                    {!isProcessing && agents && agents.length > 0 && (
                        <AgentDropdown
                            selectedBotId={selectedAgentId}
                            onBotSelect={setSelectedAgentId}
                            bots={agents}
                            disabled={isProcessing}
                        />
                    )}
                    {isProcessing &&
                        <div className='rewrite-menu-header-processing'>
                            <LoadingSpinner/>
                            <FormattedMessage
                                id='texteditor.rewrite.rewriting'
                                defaultMessage='Rewriting'
                            />
                            <button
                                className='btn btn-xs'
                                type='button'
                                onClick={onCancelProcessing}
                            >
                                <i className='icon icon-close'/>
                                <FormattedMessage
                                    id='texteditor.rewrite.stopGenerating'
                                    defaultMessage='Stop generating'
                                />
                            </button>
                        </div>
                    }
                    {!isProcessing &&
                        <Input
                            ref={customPromptRef}
                            inputPrefix={<CreationOutlineIcon size={18}/>}
                            placeholder={placeholderText}
                            disabled={isProcessing}
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            onKeyDown={onCustomPromptKeyDown}
                        />
                    }
                </div>
            )}
            menuButton={{
                id: 'rewrite-button',
                as: 'div',
                children: (
                    <IconContainer
                        id='rewrite'
                        className={classNames('control', {active: isMenuOpen})}
                        type='button'
                        aria-label={formatMessage({
                            id: 'texteditor.rewrite',
                            defaultMessage: 'Rewrite',
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
                    defaultMessage: 'Rewrite',
                }),
            }}
            menu={{
                id: 'rewrite-menu',
                'aria-label': formatMessage({
                    id: 'texteditor.rewrite.menu',
                    defaultMessage: 'Rewrite Options',
                }),
                className: 'rewrite-menu',
                onToggle: setIsMenuOpen,
                isMenuOpen,
            }}
            menuFooter={!isProcessing && originalMessage && lastAction &&
                <div className='rewrite-menu-footer'>
                    <button
                        className='btn btn-tertiary btn-xs'
                        type='button'
                        onClick={onUndoMessage}
                    >
                        <i className='icon icon-close'/>
                        <FormattedMessage
                            id='texteditor.rewrite.discard'
                            defaultMessage='Discard'
                        />
                    </button>
                    <button
                        className='btn btn-quaternary btn-xs'
                        type='button'
                        onClick={onRegenerateMessage}
                    >
                        <i className='icon icon-content-copy'/>
                        <FormattedMessage
                            id='texteditor.rewrite.regenerate'
                            defaultMessage='Regenerate'
                        />
                    </button>
                </div>
            }
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
            {showMenuItem && menuItems.map((item) => (
                <Menu.Item
                    key={`rewrite-${item.action}`}
                    role='menuitemradio'
                    aria-checked={false}
                    labels={<FormattedMessage {...item.label}/>}
                    leadingElement={item.icon}
                    onClick={onMenuAction(item.action)}
                />
            ))}
        </Menu.Container>
    );
}

