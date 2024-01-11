// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {logError} from 'mattermost-redux/actions/errors';
import * as PostActions from 'mattermost-redux/actions/posts';
import {Permissions} from 'mattermost-redux/constants';
import {getLicense} from 'mattermost-redux/selectors/entities/general';
import {getAssociatedGroupsForReferenceByMention} from 'mattermost-redux/selectors/entities/groups';
import {isCustomGroupsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {haveIChannelPermission, haveICurrentChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {getPermalinkURL} from 'selectors/urls';

import {ActionTypes, AnnouncementBarTypes} from 'utils/constants';
import {containsAtChannel, groupsMentionedInText} from 'utils/post_utils';
import {getSiteURL} from 'utils/url';
import {getTimestamp} from 'utils/utils';

import {runMessageWillBePostedHooks} from '../hooks';

export function editPost(post) {
    return async (dispatch) => {
        const result = await dispatch(PostActions.editPost(post));

        // Send to error bar if it's an edit post error about time limit.
        if (result.error && result.error.server_error_id === 'api.post.update_post.permissions_time_limit.app_error') {
            dispatch(logError({type: AnnouncementBarTypes.ANNOUNCEMENT, message: result.error.message}, true));
        }

        return result;
    };
}

export function forwardPost(post, channel, message = '') {
    return async (dispatch, getState) => {
        const state = getState();
        const channelId = channel.id;

        const currentUserId = getCurrentUserId(state);
        const currentTeam = getCurrentTeam(state);

        const relativePermaLink = getPermalinkURL(state, currentTeam.id, post.id);
        const permaLink = `${getSiteURL()}${relativePermaLink}`;

        const license = getLicense(state);
        const isLDAPEnabled = license?.IsLicensed === 'true' && license?.LDAPGroups === 'true';
        const useLDAPGroupMentions = isLDAPEnabled && haveICurrentChannelPermission(state, Permissions.USE_GROUP_MENTIONS);
        const useChannelMentions = haveIChannelPermission(state, channel.team_id, channelId, Permissions.USE_CHANNEL_MENTIONS);
        const useCustomGroupMentions = isCustomGroupsEnabled(state) && haveICurrentChannelPermission(state, Permissions.USE_GROUP_MENTIONS);
        const groupsWithAllowReference = useLDAPGroupMentions || useCustomGroupMentions ? getAssociatedGroupsForReferenceByMention(state, currentTeam.id, channelId) : null;

        let newPost = {};

        newPost.channel_id = channelId;

        const time = getTimestamp();
        const userId = currentUserId;

        newPost.message = message ? `${message}\n${permaLink}` : permaLink;
        newPost.pending_post_id = `${userId}:${time}`;
        newPost.user_id = userId;
        newPost.create_at = time;
        newPost.metadata = {};
        newPost.props = {};

        if (!useChannelMentions && containsAtChannel(newPost.message, {checkAllMentions: true})) {
            newPost.props.mentionHighlightDisabled = true;
        }

        if (!useLDAPGroupMentions && !useCustomGroupMentions && groupsMentionedInText(newPost.message, groupsWithAllowReference)) {
            newPost.props.disable_group_highlight = true;
        }

        const hookResult = await dispatch(runMessageWillBePostedHooks(newPost));

        if (hookResult.error) {
            return hookResult;
        }

        newPost = hookResult.data;

        return dispatch(PostActions.createPost(newPost, []));
    };
}

export function selectAttachmentMenuAction(postId, actionId, cookie, dataSource, text, value) {
    return async (dispatch) => {
        dispatch({
            type: ActionTypes.SELECT_ATTACHMENT_MENU_ACTION,
            data: {
                postId,
                actions: {
                    [actionId]: {
                        text,
                        value,
                    },
                },
            },
        });

        dispatch(PostActions.doPostActionWithCookie(postId, actionId, cookie, value));

        return {data: true};
    };
}
