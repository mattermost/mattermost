// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import {useIntl} from 'react-intl';

import {CheckIcon, ChevronDownIcon} from '@mattermost/compass-icons/components';
import type {Agent} from '@mattermost/types/agents';

import {Client4} from 'mattermost-redux/client';

import * as Menu from 'components/menu';
import Avatar from 'components/widgets/users/avatar';

import './agent_dropdown.scss';

type Props = {
    selectedBotId: string | null;
    onBotSelect: (botId: string) => void;
    bots: Agent[];
    defaultBotId?: string;
    disabled?: boolean;
    showLabel?: boolean;

    // When inside a GenericModal, we need to communicate with the parent to set enforceFocus off when this menu is open
    // Otherwise the underlying mui popover and GenericModal will exhaust the call stack trying to set focus when this closes
    onMenuToggle?: (isOpen: boolean) => void;
};

const AgentDropdown = ({
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
    const displayName = selectedBot?.displayName || formatMessage({id: 'agent.selectBot', defaultMessage: 'Select a bot'});

    const handleBotClick = useCallback((botId: string) => {
        return () => {
            onBotSelect(botId);
        };
    }, [onBotSelect]);

    const getBotAvatarUrl = (botId: string) => {
        return Client4.getProfilePictureUrl(botId, 0);
    };

    const getBotUsername = (bot: Agent) => {
        return bot.username;
    };

    const menuConfig = useMemo(() => ({
        id: 'agent-dropdown-menu',
        'aria-label': formatMessage({id: 'agent.menuAriaLabel', defaultMessage: 'Select agent'}),
        width: '240px',
        onToggle: onMenuToggle,
    }), [formatMessage, onMenuToggle]);

    const menuButtonConfig = useMemo(() => ({
        id: 'agent-dropdown-button',
        'aria-label': formatMessage({id: 'agent.buttonAriaLabel', defaultMessage: 'Agent selector'}),
        disabled,
        class: 'agent-dropdown-button',
        children: (
            <>
                <span className='agent-dropdown-button-text'>{displayName}</span>
                <ChevronDownIcon size={12}/>
            </>
        ),
    }), [formatMessage, disabled, displayName]);

    const menuHeaderElement = useMemo(() => (
        <div className='agent-dropdown-menu-header'>
            {formatMessage({id: 'agent.chooseBot', defaultMessage: 'CHOOSE A BOT'})}
        </div>
    ), [formatMessage]);

    return (
        <div className='agent-dropdown'>
            {showLabel && (
                <span className='agent-dropdown-label'>
                    {formatMessage({id: 'agent.generateWith', defaultMessage: 'GENERATE WITH:'})}
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
                    const label = isDefault ? `${bot.displayName} (${formatMessage({id: 'agent.default', defaultMessage: 'default'})})` : bot.displayName;

                    return (
                        <Menu.Item
                            key={bot.id}
                            id={`agent-option-${bot.id}`}
                            data-testid={`agent-option-${bot.id}`}
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

export default AgentDropdown;

