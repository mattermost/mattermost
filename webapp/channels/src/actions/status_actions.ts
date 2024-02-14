// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserProfile} from '@mattermost/types/users';

import {getStatusesByIds} from 'mattermost-redux/actions/users';
import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';
import {getIsUserStatusesConfigEnabled} from 'mattermost-redux/selectors/entities/common';
import {getPostsInCurrentChannel} from 'mattermost-redux/selectors/entities/posts';
import {getDirectShowPreferences} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import type {ActionFunc} from 'mattermost-redux/types/actions';

import {loadCustomEmojisForCustomStatusesByUserIds} from 'actions/emoji_actions';

import type {GlobalState} from 'types/store';

export function loadStatusesForChannelAndSidebar(): ActionFunc<boolean, GlobalState> {
    return (dispatch, getState) => {
        const state = getState();
        const statusesToLoad: Record<string, true> = {};

        const channelId = getCurrentChannelId(state);
        const postsInChannel = getPostsInCurrentChannel(state);

        if (postsInChannel) {
            const posts = postsInChannel.slice(0, state.views.channel.postVisibility[channelId] || 0);
            for (const post of posts) {
                if (post.user_id) {
                    statusesToLoad[post.user_id] = true;
                }
            }
        }

        const dmPrefs = getDirectShowPreferences(state);

        for (const pref of dmPrefs) {
            if (pref.value === 'true') {
                statusesToLoad[pref.name] = true;
            }
        }

        const currentUserId = getCurrentUserId(state);
        statusesToLoad[currentUserId] = true;

        dispatch(loadStatusesByIds(Object.keys(statusesToLoad)));
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
