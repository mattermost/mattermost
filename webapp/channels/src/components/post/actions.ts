// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {removePost} from 'mattermost-redux/actions/posts';
import type {ExtendedPost} from 'mattermost-redux/actions/posts';
import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId, getUser} from 'mattermost-redux/selectors/entities/users';
import {getUserIdFromChannelName} from 'mattermost-redux/utils/channel_utils';

import {loadPostsAround} from 'actions/views/channel';
import {removeDraft} from 'actions/views/drafts';
import {closeRightHandSide} from 'actions/views/rhs';
import {getGlobalItem} from 'selectors/storage';
import {isThreadOpen} from 'selectors/views/threads';

import {getHistory} from 'utils/browser_history';
import {getChannelRoutePathAndIdentifier} from 'utils/channel_utils';
import {ActionTypes, StoragePrefixes} from 'utils/constants';

import type {ActionFunc, ActionFuncAsync} from 'types/store';

/**
 * This action is called when the deleted post which is shown as 'deleted' in the RHS is then removed from the channel manually.
 * @param post Deleted post
 */
export function removePostCloseRHSDeleteDraft(post: ExtendedPost): ActionFunc<boolean> {
    return (dispatch, getState) => {
        if (isThreadOpen(getState(), post.id)) {
            dispatch(closeRightHandSide());
        }

        const draftKey = `${StoragePrefixes.COMMENT_DRAFT}${post.id}`;
        if (getGlobalItem(getState(), draftKey, null)) {
            dispatch(removeDraft(draftKey, post.channel_id, post.id));
        }

        return dispatch(removePost(post));
    };
}

export function highlightPostInChannelPopout(postId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        const state = getState();
        const team = getCurrentTeam(state);
        const channel = getCurrentChannel(state);

        if (!team || !channel) {
            return {data: false};
        }

        const result = await dispatch(loadPostsAround(channel.id, postId));
        if ('error' in result) {
            return {data: false, error: result.error};
        }

        dispatch({
            type: ActionTypes.RECEIVED_FOCUSED_POST,
            data: postId,
            channelId: channel.id,
        });

        const currentUserId = getCurrentUserId(state);
        const dmUserId = getUserIdFromChannelName(currentUserId, channel.name);
        const dmUser = getUser(state, dmUserId);
        const {path, identifier} = getChannelRoutePathAndIdentifier(channel, dmUser?.username);

        getHistory().replace(`/_popout/channel/${team.name}/${path}/${identifier}/${postId}`);

        return {data: true};
    };
}
