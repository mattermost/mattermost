// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useMemo, useEffect} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';

import type {UserProfile} from '@mattermost/types/users';

import {getPostThread} from 'mattermost-redux/actions/posts';
import {Posts} from 'mattermost-redux/constants';
import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {getThread} from 'mattermost-redux/selectors/entities/threads';
import {getUser, makeDisplayNameGetter} from 'mattermost-redux/selectors/entities/users';
import {ensureString} from 'mattermost-redux/utils/post_utils';

import Markdown from 'components/markdown';
import Avatar from 'components/widgets/users/avatar';

import {imageURLForUser} from 'utils/utils';

import type {GlobalState, DispatchFunc} from 'types/store';

import './thread_panel_tooltip.scss';

type Props = {
    postId: string;
};

const markdownPreviewOptions = {
    singleline: true,
    mentionHighlight: false,
    atMentions: false,
};

const displayNameGetter = makeDisplayNameGetter();

// Helper component to render participant avatars
function ThreadAvatars({participantIds}: {participantIds: string[]}) {
    const users = useSelector((state: GlobalState) => {
        return participantIds.slice(0, 5).map((id) => getUser(state, id)).filter(Boolean) as UserProfile[];
    });

    if (users.length === 0) {
        return null;
    }

    return (
        <div className='thread-panel-tooltip__avatars'>
            {users.map((user) => (
                <Avatar
                    key={user.id}
                    url={imageURLForUser(user.id, user.last_picture_update)}
                    username={user.username}
                    size='xxs'
                    alt=''
                />
            ))}
            {participantIds.length > 5 && (
                <span className='thread-panel-tooltip__more'>
                    {`+${participantIds.length - 5}`}
                </span>
            )}
        </div>
    );
}

function ThreadPanelTooltip({postId}: Props) {
    const dispatch = useDispatch<DispatchFunc>();
    const post = useSelector((state: GlobalState) => getPost(state, postId));
    const thread = useSelector((state: GlobalState) => getThread(state, postId));
    const postAuthor = useSelector((state: GlobalState) => {
        const user = post?.user_id ? getUser(state, post.user_id) : undefined;
        return displayNameGetter(state, true)(user);
    });

    // Fetch the thread if the post isn't loaded
    useEffect(() => {
        if (!post && postId) {
            dispatch(getPostThread(postId));
        }
    }, [dispatch, post, postId]);

    const participantIds = useMemo(() => {
        if (!thread?.participants || !post?.user_id) {
            return [post?.user_id].filter(Boolean) as string[];
        }
        const ids = thread.participants.flatMap(({id}) => {
            if (id === post.user_id) {
                return [];
            }
            return id;
        }).reverse();
        return [post.user_id, ...ids];
    }, [post?.user_id, thread?.participants]);

    if (!post) {
        // Post not loaded yet - show simple loading state
        return (
            <div className='thread-panel-tooltip thread-panel-tooltip--loading'>
                <FormattedMessage
                    id='app_bar.thread_tooltip.loading'
                    defaultMessage='Loading thread...'
                />
            </div>
        );
    }

    const totalReplies = thread?.reply_count || 0;
    const overrideUsername = ensureString(post.props?.override_username);
    const authorName = overrideUsername || postAuthor;

    // Truncate message for preview (max ~100 chars)
    let messagePreview = post.message || '';
    if (messagePreview.length > 100) {
        messagePreview = messagePreview.substring(0, 100) + '...';
    }

    const isDeleted = post.state === Posts.POST_DELETED;

    return (
        <div className='thread-panel-tooltip'>
            <div className='thread-panel-tooltip__header'>
                <span className='thread-panel-tooltip__author'>{authorName}</span>
                {totalReplies > 0 && (
                    <span className='thread-panel-tooltip__replies'>
                        <FormattedMessage
                            id='app_bar.thread_tooltip.replies'
                            defaultMessage='{count, plural, =1 {# reply} other {# replies}}'
                            values={{count: totalReplies}}
                        />
                    </span>
                )}
            </div>
            <ThreadAvatars participantIds={participantIds}/>
            <div className='thread-panel-tooltip__preview'>
                {isDeleted ? (
                    <FormattedMessage
                        id='post_body.deleted'
                        defaultMessage='(message deleted)'
                    />
                ) : (
                    <Markdown
                        message={messagePreview}
                        options={markdownPreviewOptions}
                    />
                )}
            </div>
        </div>
    );
}

export default memo(ThreadPanelTooltip);
