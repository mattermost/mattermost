// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback} from 'react';
import type {ReactNode} from 'react';
import {defineMessages, useIntl} from 'react-intl';
import {Link} from 'react-router-dom';

import type {Channel} from '@mattermost/types/channels';

import type {ResolvedChannelSidebarSubItem} from 'selectors/channel_sidebar_sub_items';

import {getChannelSidebarSubItemChildrenId, getChannelSidebarSubItemLink} from './use_channel_sidebar_sub_items';

const messages = defineMessages({
    expand: {
        id: 'sidebar_left.sidebar_channel.subItem.expand',
        defaultMessage: 'Expand {label}',
        description: 'Label of the sidebar button that shows the children of a plugin-provided sub-item under a channel; {label} is the sub-item label.',
    },
    collapse: {
        id: 'sidebar_left.sidebar_channel.subItem.collapse',
        defaultMessage: 'Collapse {label}',
        description: 'Label of the sidebar button that hides the children of a plugin-provided sub-item under a channel; {label} is the sub-item label.',
    },
});

type Props = {
    channel: Channel;
    currentTeamName: string;
    item: ResolvedChannelSidebarSubItem;
    isActive: boolean;
    isExpanded: boolean;

    /** Collapsed, and the active item is one of its descendants. */
    containsActive: boolean;
    onToggle: (itemKey: string) => void;
    onLinkClick: (event: React.MouseEvent<HTMLAnchorElement>) => void;

    /** The nested list, only provided when the item is expanded. */
    children?: ReactNode;
};

export default function SidebarChannelSubItem({
    channel,
    currentTeamName,
    item,
    isActive,
    isExpanded,
    containsActive,
    onToggle,
    onLinkClick,
    children,
}: Props) {
    const {formatMessage} = useIntl();

    const handleToggle = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        onToggle(item.key);
    }, [onToggle, item.key]);

    let toggle: ReactNode = null;
    if (item.hasChildren) {
        toggle = (
            <button
                type='button'
                className='SidebarChannelSubItem__toggle'
                aria-expanded={isExpanded}
                aria-controls={getChannelSidebarSubItemChildrenId(channel.id, item.key)}
                aria-label={formatMessage(isExpanded ? messages.collapse : messages.expand, {label: item.label})}
                onClick={handleToggle}
            >
                <i
                    className={classNames('icon', isExpanded ? 'icon-chevron-down' : 'icon-chevron-right')}
                    aria-hidden='true'
                />
            </button>
        );
    }

    return (
        <li
            className={classNames('SidebarChannelSubItem', {
                active: isActive,
                hasChildren: item.hasChildren,
                expanded: item.hasChildren && isExpanded,
                containsActive,
            })}
            data-item-key={item.key}
        >
            <div
                className='SidebarChannelSubItem__row'
                style={{'--sub-item-depth': item.depth} as React.CSSProperties}
            >
                {toggle}
                <Link
                    className='SidebarChannelSubItem__link'
                    to={getChannelSidebarSubItemLink(currentTeamName, channel.name, item.subpath)}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={onLinkClick}
                >
                    {item.iconName && (
                        <i
                            className={`icon icon-${item.iconName} SidebarChannelSubItem__icon`}
                            aria-hidden='true'
                        />
                    )}
                    <span className='SidebarChannelSubItem__label'>{item.label}</span>
                </Link>
            </div>
            {children}
        </li>
    );
}
