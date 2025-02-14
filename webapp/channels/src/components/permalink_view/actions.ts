// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';
import type {Post} from '@mattermost/types/posts';

import {getChannel, getChannelMember, selectChannel, joinChannel, getChannelStats} from 'mattermost-redux/actions/channels';
import {getPostThread} from 'mattermost-redux/actions/posts';
import {getMissingProfilesByIds} from 'mattermost-redux/actions/users';
import {Client4} from 'mattermost-redux/client';
import {getCurrentChannel, getChannel as getChannelFromRedux} from 'mattermost-redux/selectors/entities/channels';
import {isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeam, getTeam, getMyTeamMember} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';
import {getUserIdFromChannelName} from 'mattermost-redux/utils/channel_utils';
import {isSystemAdmin} from 'mattermost-redux/utils/user_utils';

import {loadChannelsForCurrentUser} from 'actions/channel_actions';
import {loadNewDMIfNeeded, loadNewGMIfNeeded} from 'actions/user_actions';
import {selectPostAndHighlight} from 'actions/views/rhs';

import {getHistory} from 'utils/browser_history';
import {joinPrivateChannelPrompt} from 'utils/channel_utils';
import {ActionTypes, Constants, ErrorPageTypes} from 'utils/constants';
import {isComment, getPostURL} from 'utils/post_utils';

import type {ActionFuncAsync, ThunkActionFunc} from 'types/store';

let privateChannelJoinPromptVisible = false;

type Option = {
    skipRedirectReplyPermalink: boolean;
}

function focusRootPost(post: Post, channel: Channel): ActionFuncAsync {
    return async (dispatch, getState) => {
        const postURL = getPostURL(getState(), post);

        dispatch(selectChannel(channel.id));
        dispatch({
            type: ActionTypes.RECEIVED_FOCUSED_POST,
            data: post.id,
            channelId: channel.id,
        });

        getHistory().replace(postURL);
        return {data: true};
    };
}

function focusReplyPost(post: Post, channel: Channel, teamId: string, returnTo: string, option: Option): ActionFuncAsync {
    return async (dispatch, getState) => {
        const {data} = await dispatch(getPostThread(post.root_id));

        if (data!.first_inaccessible_post_time) {
            getHistory().replace(`/error?type=${ErrorPageTypes.CLOUD_ARCHIVED}&returnTo=${returnTo}`);
            return {data: false};
        }

        const state = getState();

        const team = getTeam(state, channel.team_id || teamId);
        const currentChannel = getCurrentChannel(state);

        const sameTeam = currentChannel && currentChannel.team_id === team?.id;

        const {skipRedirectReplyPermalink} = option;

        if (!sameTeam) {
            dispatch(selectChannel(channel.id));
        }

        if (sameTeam && returnTo && !skipRedirectReplyPermalink) {
            getHistory().replace(returnTo);
        } else if (!sameTeam || !skipRedirectReplyPermalink) {
            const postURL = getPostURL(state, post);
            getHistory().replace(postURL);
        }

        dispatch(selectPostAndHighlight(post));
        return {data: true};
    };
}

export function focusPost(postId: string, returnTo = '', currentUserId: string, option: Option = {skipRedirectReplyPermalink: false}): ThunkActionFunc<Promise<void>> {
    return async (dispatch, getState) => {
        // Ignore if prompt is still visible
        if (privateChannelJoinPromptVisible) {
            return;
        }

        let postInfo;
        try {
            postInfo = await Client4.getPostInfo(postId);
        } catch (e) {
            getHistory().replace(`/error?type=${ErrorPageTypes.PERMALINK_NOT_FOUND}&returnTo=${returnTo}`);
            return;
        }

        const state = getState();
        const currentTeam = getCurrentTeam(state);
        if (!currentTeam) {
            return;
        }

        if (!postInfo.has_joined_channel) {
            // Prompt system admins and team admins before joining the private channel
            const user = getCurrentUser(state);
            let prompt = false;
            if (postInfo.channel_type === Constants.PRIVATE_CHANNEL && isSystemAdmin(user.roles)) {
                prompt = true;
            } else {
                const teamMember = getMyTeamMember(state, currentTeam.id);
                prompt = Boolean(teamMember && teamMember.scheme_admin);
            }
            if (prompt) {
                privateChannelJoinPromptVisible = true;
                const joinPromptResult = await dispatch(joinPrivateChannelPrompt(currentTeam, postInfo.channel_display_name));
                privateChannelJoinPromptVisible = false;
                if ('data' in joinPromptResult && !joinPromptResult.data!.join) {
                    return;
                }
            }
            await dispatch(joinChannel(currentUserId, '', postInfo.channel_id));
        }

        const {data: threadData} = await dispatch(getPostThread(postId));

        if (!threadData) {
            getHistory().replace(`/error?type=${ErrorPageTypes.PERMALINK_NOT_FOUND}&returnTo=${returnTo}`);
            return;
        }

        if (threadData.first_inaccessible_post_time) {
            getHistory().replace(`/error?type=${ErrorPageTypes.CLOUD_ARCHIVED}&returnTo=${returnTo}`);
            return;
        }

        const isCollapsed = isCollapsedThreadsEnabled(state);

        const channelId = threadData.posts[threadData.order[0]].channel_id;
        let channel = getChannelFromRedux(state, channelId);

        if (!channel) {
            const {data: channelData} = await dispatch(getChannel(channelId));

            if (!channelData) {
                getHistory().replace(`/error?type=${ErrorPageTypes.PERMALINK_NOT_FOUND}&returnTo=${returnTo}`);
                return;
            }

            channel = channelData;
        }

        const teamId = channel.team_id || currentTeam.id;
        let myMember = state.entities.channels.myMembers[channelId];

        if (!myMember) {
            // If it's a DM or GM channel and we don't have a channel member for it already, user is not a member
            if (channel.type === Constants.DM_CHANNEL || channel.type === Constants.GM_CHANNEL) {
                getHistory().replace(`/error?type=${ErrorPageTypes.PERMALINK_NOT_FOUND}&returnTo=${returnTo}`);
                return;
            }

            const membership = await dispatch(getChannelMember(channel.id, currentUserId));
            if ('data' in membership) {
                myMember = membership.data!;
            }

            if (!myMember) {
                getHistory().replace(`/error?type=${ErrorPageTypes.PERMALINK_NOT_FOUND}&returnTo=${returnTo}`);
                return;
            }
        }

        if (channel.team_id && channel.team_id !== teamId) {
            getHistory().replace(`/error?type=${ErrorPageTypes.PERMALINK_NOT_FOUND}&returnTo=${returnTo}`);
            return;
        }

        if (channel && channel.type === Constants.DM_CHANNEL) {
            const userId = getUserIdFromChannelName(currentUserId, channel.name);
            await dispatch(getMissingProfilesByIds([userId]));
            dispatch(loadNewDMIfNeeded(channel.id));
        } else if (channel && channel.type === Constants.GM_CHANNEL) {
            dispatch(loadNewGMIfNeeded(channel.id));
        }

        const post = threadData.posts[postId];

        if (isCollapsed && isComment(post)) {
            const {data} = await dispatch(focusReplyPost(post, channel, teamId, returnTo, option));
            if (!data) {
                return;
            }
        } else {
            dispatch(focusRootPost(post, channel));
        }

        dispatch(loadChannelsForCurrentUser());
        dispatch(getChannelStats(channelId));
    };
}
