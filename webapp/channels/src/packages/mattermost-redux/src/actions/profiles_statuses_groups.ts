// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-console */

import type {PostList, Post} from '@mattermost/types/posts';

import {getProfilesByIds, getStatusesByIds} from 'mattermost-redux/actions/users';
import {getCurrentUserId, getIsUserStatusesConfigEnabled} from 'mattermost-redux/selectors/entities/common';
import type {ActionFunc} from 'mattermost-redux/types/actions';

const pendingUserIdsForProfiles = new Set<string>();
const MAX_USER_PROFILES_BATCH = 100;
const USER_PROFILES_DURATION = 10 * 1000;

let userProfilesIntervalId: NodeJS.Timeout | null = null;

const pendingUserIdsForStatuses = new Set<string>();
const MAX_USER_STATUSES_BATCH = 100;
const USER_STATUSES_DURATION = 20 * 1000;

let userStatusesIntervalId: NodeJS.Timeout | null = null;

function addUserIdForProfiles(userId: string): ActionFunc<boolean> {
    return (dispatch) => {
        function getPendingProfilesById() {
            console.log('addUserIdForProfiles start', pendingUserIdsForProfiles);

            dispatch(getProfilesByIds(Array.from(pendingUserIdsForProfiles)));
            pendingUserIdsForProfiles.clear();
        }

        // Process immediately if the pending user ids exceeds the limit
        if (pendingUserIdsForProfiles.size >= MAX_USER_PROFILES_BATCH) {
            console.log('addUserIdForProfiles', 'executing immediately for', pendingUserIdsForProfiles.size);

            getPendingProfilesById();
        }

        pendingUserIdsForProfiles.add(userId);

        // Start the interval if it is not already running
        if (userProfilesIntervalId === null) {
            userProfilesIntervalId = setInterval(() => {
                if (pendingUserIdsForProfiles.size > 0) {
                    console.log('addUserIdForProfiles', 'executing with interval for pending', pendingUserIdsForProfiles.size);

                    getPendingProfilesById();
                } else {
                    console.log('addUserIdForProfiles', 'no pending user ids');
                }
            }, USER_PROFILES_DURATION);
        }

        return {data: true};
    };
}

export function cleanupUserProfilesInterval() {
    if (userProfilesIntervalId !== null) {
        clearInterval(userProfilesIntervalId);
        userProfilesIntervalId = null;
    }
}

function addUserIdForStatuses(userId: string): ActionFunc<boolean> {
    return (dispatch) => {
        function getPendingStatusesById() {
            console.log('addUserIdForStatuses start', pendingUserIdsForStatuses);

            dispatch(getStatusesByIds(Array.from(pendingUserIdsForStatuses)));
            pendingUserIdsForStatuses.clear();
        }

        // Process immediately if the pending user ids exceeds the limit
        if (pendingUserIdsForStatuses.size >= MAX_USER_STATUSES_BATCH) {
            getPendingStatusesById();

            console.log('addUserIdForStatuses', 'executing immediately for', pendingUserIdsForStatuses.size);
        }

        pendingUserIdsForStatuses.add(userId);

        // Start the interval if it is not already running
        if (userStatusesIntervalId === null) {
            userStatusesIntervalId = setInterval(() => {
                if (pendingUserIdsForStatuses.size > 0) {
                    console.log('addUserIdForStatuses', 'executing with timeout for pending', pendingUserIdsForStatuses.size);

                    getPendingStatusesById();
                } else {
                    console.log('addUserIdForStatuses', 'no pending user ids');
                }
            }, USER_STATUSES_DURATION);
        }

        return {data: true};
    };
}

export function cleanupUserStatusesInterval() {
    if (userStatusesIntervalId !== null) {
        clearInterval(userStatusesIntervalId);
        userStatusesIntervalId = null;
    }
}

/**
 * Gets in batch the user profiles, user statuses and user groups for the users in the posts list
 */
export function getBatchedUserProfilesStatusesAndGroupsFromPosts(postsArrayOrMap: Post[]|PostList['posts']): ActionFunc<boolean> {
    return (dispatch, getState) => {
        if (!postsArrayOrMap) {
            return {data: false};
        }

        const posts = Array.isArray(postsArrayOrMap) ? postsArrayOrMap : Object.values(postsArrayOrMap);
        if (posts.length === 0) {
            return {data: false};
        }

        const state = getState();
        const currentUserId = getCurrentUserId(state);
        const isUserStatusesConfigEnabled = getIsUserStatusesConfigEnabled(state);
        const profiles = state.entities.users.profiles;

        posts.forEach((post) => {
            // This is sufficient to check if the profile is already fetched
            // as we recieve the websocket events for the profiles changes
            if (post.user_id !== currentUserId && !profiles[post.user_id]) {
                dispatch(addUserIdForProfiles(post.user_id));
            }

            // We need to fetch the statuses as we dont have websockets for the status changes of other users
            if (post.user_id !== currentUserId && isUserStatusesConfigEnabled) {
                dispatch(addUserIdForStatuses(post.user_id));
            }

            // TODO: We need to handle the groups as well
        });

        return {data: true};
    };
}
