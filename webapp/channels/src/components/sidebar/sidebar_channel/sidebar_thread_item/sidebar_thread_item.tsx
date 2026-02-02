// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import {Link, useRouteMatch} from 'react-router-dom';

import type {UserThread} from '@mattermost/types/threads';

import {getPost} from 'mattermost-redux/selectors/entities/posts';

import {cleanMessageForDisplay} from 'components/threading/utils';

import type {GlobalState} from 'types/store';

import ChannelMentionBadge from '../channel_mention_badge';

import './sidebar_thread_item.scss';

type Props = {
    thread: UserThread;
    currentTeamName: string;
};

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
    // Use a pattern that matches the route definition in center_channel.tsx
    const match = useRouteMatch<{team?: string; threadIdentifier?: string}>('/:team/thread/:threadIdentifier');
    const isActive = Boolean(match && match.params.threadIdentifier === thread.id);

    // Use custom thread name if set, otherwise use cleaned post message
    const customName = thread.props?.custom_name;
    const rawMessage = post?.message || '';
    const label = customName || cleanMessageForDisplay(rawMessage, 100) || formatMessage({id: 'threading.thread', defaultMessage: 'Thread'});

    const hasUnread = (thread.unread_replies || 0) > 0 || (thread.unread_mentions || 0) > 0;

    return (
        <li
            className={classNames('SidebarChannel', 'SidebarThreadItem', {
                active: isActive,
                unread: hasUnread,
            })}
            role='listitem'
        >
            <Link
                className={classNames('SidebarLink', {
                    'unread-title': hasUnread,
                })}
                to={link}
                id={`sidebarThread_${thread.id}`}
            >
                <span className='SidebarChannelIcon'>
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
                        hasUrgent={thread.is_urgent ?? false}
                    />
                )}
            </Link>
        </li>
    );
};

export default SidebarThreadItem;
