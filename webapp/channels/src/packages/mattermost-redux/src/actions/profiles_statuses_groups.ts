// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-console */

import type {PostList, Post} from '@mattermost/types/posts';

import {getProfilesByIds, getStatusesByIds} from 'mattermost-redux/actions/users';
import {getCurrentUserId, getIsUserStatusesConfigEnabled} from 'mattermost-redux/selectors/entities/common';
import type {ActionFunc, ActionFuncAsync, ThunkActionFunc} from 'mattermost-redux/types/actions';

const pendingUserIdsForProfiles = new Set<string>();
const MAX_USER_PROFILES_BATCH = 50;
const USER_PROFILES_TIMEOUT = 10 * 1000; // 10 seconds

let userProfilesTimeoutId: NodeJS.Timeout | null = null;
let userProfilesLastExecutionTimeout = 0;

const pendingUserIdsForStatuses = new Set<string>();
const MAX_USER_STATUSES_BATCH = 50;
const USER_STATUSES_TIMEOUT = 30 * 1000; // 10 seconds

let userStatusesTimeoutId: NodeJS.Timeout | null = null;
let userStatusesLastExecutionTimeout = 0;

/**
 * This action since it uses the global variables to store the pending user ids
 * it should be used only in the context of the posts list and not called directly
 */
function getBatchedUserProfileByIds(): ActionFunc<null> {
    return (dispatch) => {
        console.log('getBatchedUserProfileByIds:begins');

        // This means this is the first time we are executing this function
        if (userProfilesLastExecutionTimeout === 0) {
            userProfilesLastExecutionTimeout = Date.now();
        }

        function getPendingProfilesById() {
            console.log('getBatchedUserProfileByIdsFromPosts process start', pendingUserIdsForProfiles);
            dispatch(getProfilesByIds(Array.from(pendingUserIdsForProfiles)));

            // Clearouts the set of pending user ids along with the timeouts
            pendingUserIdsForProfiles.clear();
            userProfilesLastExecutionTimeout = Date.now();
            userProfilesTimeoutId = null;
        }

        // Calculate the delay for the next execution
        const timeSinceLastExecution = Date.now() - userProfilesLastExecutionTimeout;
        const clampedTimeout = Math.max(0, USER_PROFILES_TIMEOUT - timeSinceLastExecution);

        // Clear the previous timeout
        if (userProfilesTimeoutId !== null) {
            clearTimeout(userProfilesTimeoutId);
        }

        // Check if we have to execute the function immediately
        // because of the overflow of the pending user ids or the timeout exceeded
        if (pendingUserIdsForProfiles.size >= MAX_USER_PROFILES_BATCH || clampedTimeout === 0) {
            console.log('getBatchedUserProfileByIdsFromPosts', 'executing immediately for', pendingUserIdsForProfiles.size);
            getPendingProfilesById();
        } else {
            console.log('getBatchedUserProfileByIdsFromPosts', 'executing with timeout', clampedTimeout, 'for pending', pendingUserIdsForProfiles.size);
            userProfilesTimeoutId = setTimeout(getPendingProfilesById, clampedTimeout);
        }

        return {data: null};
    };
}

/**
 * This action since it uses the global variables to store the pending user ids
 * it should be used only in the context of the posts list and not called directly
 */
function getBatchedUserStatusByIds(): ActionFuncAsync<null> {
    return async (dispatch) => {
        console.log('getBatchedUserProfileByIds:begins');

        if (userStatusesLastExecutionTimeout === 0) {
            userStatusesLastExecutionTimeout = Date.now();
        }

        function getPendingStatusesById() {
            console.log('getBatchedUserStatusByIdsFromPosts process start', pendingUserIdsForStatuses);
            dispatch(getStatusesByIds(Array.from(pendingUserIdsForStatuses)));

            pendingUserIdsForStatuses.clear();
            userStatusesLastExecutionTimeout = Date.now();
            userStatusesTimeoutId = null;
        }

        const timeSinceLastExecution = Date.now() - userStatusesLastExecutionTimeout;
        const clampedTimeout = Math.max(0, USER_STATUSES_TIMEOUT - timeSinceLastExecution);

        if (userStatusesTimeoutId !== null) {
            clearTimeout(userStatusesTimeoutId);
        }

        if (pendingUserIdsForStatuses.size >= MAX_USER_STATUSES_BATCH || clampedTimeout === 0) {
            console.log('getBatchedUserStatusByIdsFromPosts', 'executing immediately for', pendingUserIdsForStatuses.size);
            getPendingStatusesById();
        } else {
            console.log('getBatchedUserStatusByIdsFromPosts', 'executing with timeout', clampedTimeout, 'for pending', pendingUserIdsForStatuses.size);
            userStatusesTimeoutId = setTimeout(getPendingStatusesById, clampedTimeout);
        }

        return {data: null};
    };
}

/**
 * Gets in batch the user profiles, user statuses and user groups for the users in the posts list
 */
export function getBatchedUserProfilesStatusesAndGroupsFromPosts(postsArrayOrMap: Post[]|PostList['posts']): ThunkActionFunc<boolean> {
    return (dispatch, getState) => {
        if (!postsArrayOrMap) {
            return false;
        }

        const posts = Array.isArray(postsArrayOrMap) ? postsArrayOrMap : Object.values(postsArrayOrMap);
        if (posts.length === 0) {
            return false;
        }

        const state = getState();
        const currentUserId = getCurrentUserId(state);
        const isUserStatusesConfigEnabled = getIsUserStatusesConfigEnabled(state);
        const profiles = state.entities.users.profiles;

        let shouldFetchProfiles = false;
        let shouldFetchStatuses = false;
        let shouldFetchGroups = false;

        posts.forEach((post) => {
            // This is sufficient to check if the profile is already fetched
            // as we recieve the websocket events for the profiles changes
            if (post.user_id !== currentUserId && !profiles[post.user_id]) {
                pendingUserIdsForProfiles.add(post.user_id);

                shouldFetchProfiles = true;
            }

            // We need to fetch the statuses as we dont have websockets for the status changes of other users
            if (post.user_id !== currentUserId && isUserStatusesConfigEnabled) {
                pendingUserIdsForStatuses.add(post.user_id);

                shouldFetchStatuses = true;
            }

            // TODO: We need to handle the groups as well
            shouldFetchGroups = false;
        });

        if (shouldFetchProfiles || shouldFetchStatuses) {
            if (shouldFetchProfiles) {
                dispatch(getBatchedUserProfileByIds());
            }

            if (shouldFetchStatuses) {
                dispatch(getBatchedUserStatusByIds());
            }

            if (shouldFetchGroups) {
                // dispatch(getBatchedUserGroupsByIdsFromPosts(postsArrayOrMap));
            }

            return true;
        }
        return false;
    };
}
