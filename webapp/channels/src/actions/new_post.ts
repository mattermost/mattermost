// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnyAction} from 'redux';
import {batchActions} from 'redux-batched-actions';

import type {ChannelType} from '@mattermost/types/channels';
import type {Post} from '@mattermost/types/posts';

import {
    actionsToMarkChannelAsRead,
    actionsToMarkChannelAsUnread,
    markChannelAsViewedOnServer,
} from 'mattermost-redux/actions/channels';
import * as PostActions from 'mattermost-redux/actions/posts';
import {getCurrentChannelId, isManuallyUnread} from 'mattermost-redux/selectors/entities/channels';
import * as PostSelectors from 'mattermost-redux/selectors/entities/posts';
import {isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getThread} from 'mattermost-redux/selectors/entities/threads';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {
    isFromWebhook,
    isSystemMessage,
    shouldIgnorePost,
} from 'mattermost-redux/utils/post_utils';

import {sendDesktopNotification} from 'actions/notification_actions';
import {updateThreadLastOpened} from 'actions/views/threads';
import {isThreadOpen, makeGetThreadLastViewedAt} from 'selectors/views/threads';

import WebSocketClient from 'client/web_websocket_client';
import {ActionTypes} from 'utils/constants';

import type {DispatchFunc, GetStateFunc, ActionFunc, ActionFuncAsync} from 'types/store';

export type NewPostMessageProps = {
    channel_type: ChannelType;
    channel_display_name: string;
    channel_name: string;
    sender_name: string;
    set_online: boolean;
    mentions?: string;
    followers?: string;
    team_id: string;
    should_ack: boolean;
    otherFile?: 'true';
    image?: 'true';
    post: string;
}

export function completePostReceive(post: Post, websocketMessageProps: NewPostMessageProps, fetchedChannelMember?: boolean): ActionFuncAsync<boolean> {
    return async (dispatch, getState) => {
        const state = getState();
        const rootPost = PostSelectors.getPost(state, post.root_id);
        const isPostFromCurrentChannel = post.channel_id === getCurrentChannelId(state);

        if (post.root_id && !rootPost && isPostFromCurrentChannel) {
            const result = await dispatch(PostActions.getPostThread(post.root_id));

            if ('error' in result) {
                if (websocketMessageProps.should_ack) {
                    WebSocketClient.acknowledgePostedNotification(post.id, 'error', 'missing_root_post', result.error);
                }
                return {error: result.error};
            }
        }
        const actions: AnyAction[] = [];

        if (isPostFromCurrentChannel) {
            actions.push({
                type: ActionTypes.INCREASE_POST_VISIBILITY,
                data: post.channel_id,
                amount: 1,
            });
        }

        const collapsedThreadsEnabled = isCollapsedThreadsEnabled(state);
        const isCRTReply = collapsedThreadsEnabled && post.root_id;

        actions.push(
            PostActions.receivedNewPost(post, collapsedThreadsEnabled),
        );

        const currentUserId = getCurrentUserId(state);
        const isCRTReplyByCurrentUser = isCRTReply && post.user_id === currentUserId;
        if (!isCRTReplyByCurrentUser) {
            actions.push(
                ...setChannelReadAndViewed(dispatch, getState, post as Post, websocketMessageProps, fetchedChannelMember),
            );
        }
        dispatch(batchActions(actions));

        if (isCRTReply) {
            dispatch(setThreadRead(post));
        }

        const {status, reason, data} = (await dispatch(sendDesktopNotification(post, websocketMessageProps))).data!;

        // Only ACK for posts that require it
        if (websocketMessageProps.should_ack) {
            WebSocketClient.acknowledgePostedNotification(post.id, status, reason, data);
        }

        return {data: true};
    };
}

// setChannelReadAndViewed returns an array of actions to mark the channel read and viewed, and it dispatches an action
// to asynchronously mark the channel as read on the server if necessary.
export function setChannelReadAndViewed(dispatch: DispatchFunc, getState: GetStateFunc, post: Post, websocketMessageProps: NewPostMessageProps, fetchedChannelMember?: boolean): AnyAction[] {
    const state = getState();
    const currentUserId = getCurrentUserId(state);

    // ignore system message posts, except when added to a team
    if (shouldIgnorePost(post, currentUserId)) {
        return [];
    }

    let markAsRead = false;
    let markAsReadOnServer = false;

    // Skip marking a channel as read (when the user is viewing a channel)
    // if they have manually marked it as unread.
    if (!isManuallyUnread(getState(), post.channel_id)) {
        if (
            post.user_id === getCurrentUserId(state) &&
            !isSystemMessage(post) &&
            !isFromWebhook(post)
        ) {
            markAsRead = true;
            markAsReadOnServer = false;
        } else if (
            post.channel_id === getCurrentChannelId(state) &&
            window.isActive
        ) {
            markAsRead = true;
            markAsReadOnServer = true;
        }
    }

    if (markAsRead) {
        if (markAsReadOnServer) {
            dispatch(markChannelAsViewedOnServer(post.channel_id));
        }

        return actionsToMarkChannelAsRead(getState, post.channel_id);
    }

    return actionsToMarkChannelAsUnread(getState, websocketMessageProps.team_id, post.channel_id, websocketMessageProps.mentions || '', fetchedChannelMember, post.root_id === '', post?.metadata?.priority?.priority);
}

export function setThreadRead(post: Post): ActionFunc<boolean> {
    const getThreadLastViewedAt = makeGetThreadLastViewedAt();
    return (dispatch, getState) => {
        const state = getState();

        const thread = getThread(state, post.root_id);

        // mark a thread as read (when the user is viewing the thread)
        if (thread && isThreadOpen(state, thread.id) && window.isActive) {
            // update the new messages line (when there are no previous unreads)
            if (thread.last_reply_at < getThreadLastViewedAt(state, thread.id)) {
                dispatch(updateThreadLastOpened(thread.id, post.create_at));
            }
        }

        return {data: true};
    };
}
