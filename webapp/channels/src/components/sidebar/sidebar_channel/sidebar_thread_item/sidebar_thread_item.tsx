// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import {Link, useRouteMatch} from 'react-router-dom';

import type {UserThread} from '@mattermost/types/threads';

import {getPost} from 'mattermost-redux/selectors/entities/posts';

import type {GlobalState} from 'types/store';

import ChannelMentionBadge from '../channel_mention_badge';

import './sidebar_thread_item.scss';

type Props = {
    thread: UserThread;
    currentTeamName: string;
};

// Clean up message text for display in sidebar
function cleanMessageForDisplay(message: string): string {
    if (!message) {
        return '';
    }

    // Remove markdown formatting
    let cleaned = message
        // Remove code blocks
        .replace(/```[\s\S]*?```/g, '[code]')
        .replace(/`[^`]+`/g, '[code]')
        // Remove links but keep text
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        // Remove images
        .replace(/!\[[^\]]*\]\([^)]+\)/g, '[image]')
        // Remove bold/italic
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/__([^_]+)__/g, '$1')
        .replace(/_([^_]+)_/g, '$1')
        // Remove headers
        .replace(/^#+\s+/gm, '')
        // Remove blockquotes
        .replace(/^>\s+/gm, '')
        // Remove horizontal rules
        .replace(/^---+$/gm, '')
        // Collapse whitespace
        .replace(/\s+/g, ' ')
        .trim();

    // Truncate if too long (CSS handles overflow but this helps with very long messages)
    if (cleaned.length > 100) {
        cleaned = cleaned.substring(0, 100) + '...';
    }

    return cleaned;
}

const SidebarThreadItem = ({
    thread,
    currentTeamName,
}: Props) => {
    const {formatMessage} = useIntl();

    // Get the full post to access message content
    const post = useSelector((state: GlobalState) => getPost(state, thread.id));

    // Use the new /thread/:id route for full-width view
    const link = `/${currentTeamName}/thread/${thread.id}`;

    // Check if this thread is currently active via route match
    const match = useRouteMatch<{threadIdentifier?: string}>(`/${currentTeamName}/thread/:threadIdentifier`);
    const isActive = match?.params.threadIdentifier === thread.id;

    // Clean and format the label using the full post message
    const rawMessage = post?.message || '';
    const label = cleanMessageForDisplay(rawMessage) || formatMessage({id: 'threading.thread', defaultMessage: 'Thread'});

    const hasUnread = (thread.unread_replies || 0) > 0 || (thread.unread_mentions || 0) > 0;

    return (
        <li className='SidebarThreadItem'>
            <Link
                className={classNames('SidebarLink', {
                    active: isActive,
                    'unread-title': hasUnread,
                })}
                to={link}
                id={`sidebarThread_${thread.id}`}
            >
                <span className='icon'>
                    <span className='icon-discord-thread'/>
                </span>
                <div className='SidebarChannelLinkLabel_wrapper'>
                    <span className='SidebarChannelLinkLabel'>
                        {label}
                    </span>
                </div>
                {hasUnread && (
                    <ChannelMentionBadge
                        unreadMentions={thread.unread_mentions || 0}
                        hasUrgent={false}
                    />
                )}
            </Link>
        </li>
    );
};

export default SidebarThreadItem;
