// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useSelector} from 'react-redux';

import type {Post} from '@mattermost/types/posts';

import {Client4} from 'mattermost-redux/client';
import {getUser} from 'mattermost-redux/selectors/entities/users';

import type {GlobalState} from 'types/store';

import './thread_row.scss';

interface ThreadInfo {
    id: string;
    rootPost: Post;
    replyCount: number;
    participants: string[];
    hasUnread: boolean;
}

interface Props {
    thread: ThreadInfo;
    onClick: () => void;
}

const MAX_AVATARS = 4;

export default function ThreadRow({thread, onClick}: Props) {
    const participants = useSelector((state: GlobalState) => {
        return thread.participants.
            slice(0, MAX_AVATARS).
            map((userId) => getUser(state, userId)).
            filter(Boolean);
    });

    // Truncate message preview
    const messagePreview = thread.rootPost.message.slice(0, 100) +
        (thread.rootPost.message.length > 100 ? '...' : '');

    return (
        <div
            className={classNames('thread-row', {'thread-row--unread': thread.hasUnread})}
            onClick={onClick}
            role='button'
            tabIndex={0}
        >
            <div className='thread-row__content'>
                <span className='thread-row__preview'>
                    {messagePreview || '[Attachment]'}
                </span>
                <div className='thread-row__meta'>
                    <span className='thread-row__reply-count'>
                        {thread.replyCount} {thread.replyCount === 1 ? 'reply' : 'replies'}
                    </span>
                    {thread.hasUnread && (
                        <span className='thread-row__unread-dot' />
                    )}
                </div>
            </div>
            <div className='thread-row__participants'>
                {participants.map((user) => (
                    <img
                        key={user.id}
                        className='thread-row__avatar'
                        src={Client4.getProfilePictureUrl(user.id, user.last_picture_update)}
                        alt={user.username}
                    />
                ))}
            </div>
        </div>
    );
}
