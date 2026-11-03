// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useState} from 'react';
import {defineMessages, FormattedMessage, useIntl} from 'react-intl';
import {useStore} from 'react-redux';

import {DotsVerticalIcon} from '@mattermost/compass-icons/components';
import type {Channel} from '@mattermost/types/channels';

import {getChannelSidebarSubItemActions} from 'selectors/channel_sidebar_sub_items';
import type {ResolvedChannelSidebarSubItem} from 'selectors/channel_sidebar_sub_items';

import * as Menu from 'components/menu';

import type {GlobalState} from 'types/store';
import type {ChannelSidebarSubItemAction} from 'types/store/plugins';

const messages = defineMessages({
    options: {
        id: 'sidebar_left.sidebar_channel.subItem.options',
        defaultMessage: 'Item options for {label}',
        description: 'Accessible label of the sidebar button and menu with the actions of a plugin-provided sub-item under a channel; {label} is the sub-item label.',
    },
    optionsTooltip: {
        id: 'sidebar_left.sidebar_channel.subItem.optionsTooltip',
        defaultMessage: 'Item options',
        description: 'Tooltip of the sidebar button that opens the actions menu of a plugin-provided sub-item under a channel.',
    },
    noActions: {
        id: 'sidebar_left.sidebar_channel.subItem.noActions',
        defaultMessage: 'No actions available',
        description: 'Disabled menu entry shown when a plugin-provided sidebar sub-item has no actions to offer.',
    },
});

type Props = {
    channel: Channel;
    item: ResolvedChannelSidebarSubItem;
    onMenuToggle: (isOpen: boolean) => void;
};

export default function SidebarChannelSubItemMenu({channel, item, onMenuToggle}: Props) {
    const {formatMessage} = useIntl();
    const store = useStore<GlobalState>();
    const [actions, setActions] = useState<ChannelSidebarSubItemAction[]>([]);

    // Actions are read from fresh state when the user starts interacting with the button, so they
    // are in place before the click that opens the menu is handled.
    const refreshActions = useCallback(() => {
        setActions(getChannelSidebarSubItemActions(store.getState(), channel, item));
    }, [store, channel, item]);

    const idSuffix = `${channel.id}-${item.key}`.replace(/\s+/g, '_');
    const label = formatMessage(messages.options, {label: item.label});

    // MUI's Menu does not accept fragments as children, so separators are siblings of the items.
    const menuItems = actions.length === 0 ? [
        <Menu.Item
            key='none'
            id={`SidebarChannelSubItemMenu-Item-${idSuffix}-none`}
            disabled={true}
            labels={<FormattedMessage {...messages.noActions}/>}
        />,
    ] : actions.flatMap((action) => [
        ...(action.separatorBefore ? [<Menu.Separator key={`${action.id}-separator`}/>] : []),
        <Menu.Item
            key={action.id}
            id={`SidebarChannelSubItemMenu-Item-${idSuffix}-${action.id}`.replace(/\s+/g, '_')}
            className={classNames('SidebarChannelSubItemMenu__item', {'SidebarChannelSubItemMenu__item--destructive': action.isDestructive})}
            leadingElement={action.iconName ? <i className={`icon icon-${action.iconName}`}/> : undefined}
            labels={<span>{action.text}</span>}
            isDestructive={action.isDestructive}
            onClick={action.onClick}
        />,
    ]);

    return (
        <div
            className='SidebarChannelSubItem__menu'
            onPointerDownCapture={refreshActions}
            onFocusCapture={refreshActions}
            onClickCapture={refreshActions}
        >
            <Menu.Container
                menuButton={{
                    id: `SidebarChannelSubItemMenu-Button-${idSuffix}`,
                    class: 'SidebarChannelSubItem__menuButton',
                    'aria-label': label,
                    children: <DotsVerticalIcon size={16}/>,
                }}
                menuButtonTooltip={{
                    class: 'hidden-xs',
                    text: formatMessage(messages.optionsTooltip),
                }}
                menu={{
                    id: `SidebarChannelSubItemMenu-MenuList-${idSuffix}`,
                    'aria-label': label,
                    onToggle: onMenuToggle,
                }}
            >
                {menuItems}
            </Menu.Container>
        </div>
    );
}
