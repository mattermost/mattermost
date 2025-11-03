// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import {useIntl} from 'react-intl';

import {CheckIcon, ChevronDownIcon} from '@mattermost/compass-icons/components';

import type {AIAgent} from 'mattermost-redux/actions/ai';
import {Client4} from 'mattermost-redux/client';

import * as Menu from 'components/menu';
import Avatar from 'components/widgets/users/avatar';

import './ai_agent_dropdown.scss';

type Props = {
    selectedBotId: string | null;
    onBotSelect: (botId: string) => void;
    bots: AIAgent[];
    defaultBotId?: string;
    disabled?: boolean;
    showLabel?: boolean;

    // When inside a GenericModal, we need to communicate with the parent to set enforceFocus off when this menu is open
    // Otherwise the underlying mui popover and GenericModal will exhaust the call stack trying to set focus when this closes
    onMenuToggle?: (isOpen: boolean) => void;
};

const AIAgentDropdown = ({
    selectedBotId,
    onBotSelect,
    bots,
    defaultBotId,
    disabled = false,
    showLabel = false,
    onMenuToggle,
}: Props) => {
    const {formatMessage} = useIntl();

    const selectedBot = bots.find((bot) => bot.id === selectedBotId);
    const displayName = selectedBot?.displayName || formatMessage({id: 'ai.agent.selectBot', defaultMessage: 'Select a bot'});

    const handleBotClick = useCallback((botId: string) => {
        return () => {
            onBotSelect(botId);
        };
    }, [onBotSelect]);

    const getBotAvatarUrl = (botId: string) => {
        return Client4.getProfilePictureUrl(botId, 0);
    };

    const getBotUsername = (bot: AIAgent) => {
        return bot.username;
    };

    const menuConfig = useMemo(() => ({
        id: 'ai-agent-dropdown-menu',
        'aria-label': formatMessage({id: 'ai.agent.menuAriaLabel', defaultMessage: 'Select AI agent'}),
        width: '240px',
        onToggle: onMenuToggle,
    }), [formatMessage, onMenuToggle]);

    const menuButtonConfig = useMemo(() => ({
        id: 'ai-agent-dropdown-button',
        'aria-label': formatMessage({id: 'ai.agent.buttonAriaLabel', defaultMessage: 'AI agent selector'}),
        disabled,
        class: 'ai-agent-dropdown-button',
        children: (
            <>
                <span className='ai-agent-dropdown-button-text'>{displayName}</span>
                <ChevronDownIcon size={12}/>
            </>
        ),
    }), [formatMessage, disabled, displayName]);

    const menuHeaderElement = useMemo(() => (
        <div className='ai-agent-dropdown-menu-header'>
            {formatMessage({id: 'ai.agent.chooseBot', defaultMessage: 'CHOOSE A BOT'})}
        </div>
    ), [formatMessage]);

    return (
        <div className='ai-agent-dropdown'>
            {showLabel && (
                <span className='ai-agent-dropdown-label'>
                    {formatMessage({id: 'ai.agent.generateWith', defaultMessage: 'GENERATE WITH:'})}
                </span>
            )}
            <Menu.Container
                menu={menuConfig}
                menuButton={menuButtonConfig}
                menuHeader={menuHeaderElement}
            >
                {bots.map((bot) => {
                    const isDefault = bot.id === defaultBotId;
                    const isSelected = bot.id === selectedBotId;
                    const label = isDefault ? `${bot.displayName} (${formatMessage({id: 'ai.agent.default', defaultMessage: 'default'})})` : bot.displayName;

                    return (
                        <Menu.Item
                            key={bot.id}
                            id={`ai-agent-option-${bot.id}`}
                            data-testid={`ai-agent-option-${bot.id}`}
                            leadingElement={
                                <Avatar
                                    url={getBotAvatarUrl(bot.id)}
                                    username={getBotUsername(bot)}
                                    size='sm'
                                    alt=''
                                />
                            }
                            labels={<span>{label}</span>}
                            trailingElements={isSelected ? <CheckIcon size={16}/> : undefined}
                            onClick={handleBotClick(bot.id)}
                        />
                    );
                })}
            </Menu.Container>
        </div>
    );
};

export default AIAgentDropdown;

