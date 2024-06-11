// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserProfile} from '@mattermost/types/users';

import {addUserIdsForStatusAndProfileFetchingPoll} from 'mattermost-redux/actions/status_profile_polling';
import {getStatusesByIds} from 'mattermost-redux/actions/users';
import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';
import {getIsUserStatusesConfigEnabled} from 'mattermost-redux/selectors/entities/common';
import {getPostsInCurrentChannel} from 'mattermost-redux/selectors/entities/posts';
import {getDirectShowPreferences} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import type {ActionFunc} from 'mattermost-redux/types/actions';

import {loadCustomEmojisForCustomStatusesByUserIds} from 'actions/emoji_actions';

import type {GlobalState} from 'types/store';

/**
 * Adds all the visible users of the current channel i.e users who have recently posted in the current channel
 * and users who have DMs open with the current user to the status pool for fetching their statuses.
 */
export function addVisibleUsersInCurrentChannelToStatusPoll(): ActionFunc<boolean, GlobalState> {
    return (dispatch, getState) => {
        const state = getState();
        const currentUserId = getCurrentUserId(state);
        const currentChannelId = getCurrentChannelId(state);
        const postsInChannel = getPostsInCurrentChannel(state);
        const numberOfPostsVisibleInCurrentChannel = state.views.channel.postVisibility[currentChannelId] || 0;

        const userIdsToFetchStatusFor = new Set<string>();

        // We fetch for users who have recently posted in the current channel
        if (postsInChannel && numberOfPostsVisibleInCurrentChannel > 0) {
            const posts = postsInChannel.slice(0, numberOfPostsVisibleInCurrentChannel);
            for (const post of posts) {
                if (post.user_id && post.user_id !== currentUserId) {
                    userIdsToFetchStatusFor.add(post.user_id);
                }
            }
        }

        // We also fetch for users who have DMs open with the current user
        const directShowPreferences = getDirectShowPreferences(state);
        for (const directShowPreference of directShowPreferences) {
            if (directShowPreference.value === 'true') {
                // This is the other user's id in the DM
                userIdsToFetchStatusFor.add(directShowPreference.name);
            }
        }

        // Both the users in the DM list and recent posts constitute for all the visible users in the current channel
        const userIdsForStatus = Array.from(userIdsToFetchStatusFor);
        if (userIdsForStatus.length > 0) {
            dispatch(addUserIdsForStatusAndProfileFetchingPoll({userIdsForStatus}));
        }

        return {data: true};
    };
}

export function loadStatusesForProfilesList(users: UserProfile[] | null): ActionFunc<boolean> {
    return (dispatch) => {
        if (users == null) {
            return {data: false};
        }

        const statusesToLoad = [];
        for (let i = 0; i < users.length; i++) {
            statusesToLoad.push(users[i].id);
        }

        dispatch(loadStatusesByIds(statusesToLoad));

        return {data: true};
    };
}

export function loadStatusesForProfilesMap(users: Record<string, UserProfile> | UserProfile[] | null): ActionFunc {
    return (dispatch) => {
        if (users == null) {
            return {data: false};
        }

        const statusesToLoad = [];
        for (const userId in users) {
            if ({}.hasOwnProperty.call(users, userId)) {
                statusesToLoad.push(userId);
            }
        }

        dispatch(loadStatusesByIds(statusesToLoad));

        return {data: true};
    };
}

export function loadStatusesByIds(userIds: string[]): ActionFunc {
    return (dispatch, getState) => {
        const state = getState();
        const enabledUserStatuses = getIsUserStatusesConfigEnabled(state);

        if (userIds.length === 0 || !enabledUserStatuses) {
            return {data: false};
        }

        dispatch(getStatusesByIds(userIds));
        dispatch(loadCustomEmojisForCustomStatusesByUserIds(userIds));
        return {data: true};
    };
}

export function loadProfilesMissingStatus(users: UserProfile[]): ActionFunc {
    return (dispatch, getState) => {
        const state = getState();
        const enabledUserStatuses = getIsUserStatusesConfigEnabled(state);

        const statuses = state.entities.users.statuses;

        const missingStatusByIds = users.
            filter((user) => !statuses[user.id]).
            map((user) => user.id);

        if (missingStatusByIds.length === 0 || !enabledUserStatuses) {
            return {data: false};
        }

        dispatch(getStatusesByIds(missingStatusByIds));
        dispatch(loadCustomEmojisForCustomStatusesByUserIds(missingStatusByIds));
        return {data: true};
    };
}
