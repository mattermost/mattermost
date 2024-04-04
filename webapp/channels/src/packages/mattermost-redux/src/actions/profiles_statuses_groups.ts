// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-console */

import type {PostList, Post} from '@mattermost/types/posts';

import {getProfilesByIds, getStatusesByIds} from 'mattermost-redux/actions/users';
import {getCurrentChannelId, getCurrentUserId, getIsUserStatusesConfigEnabled} from 'mattermost-redux/selectors/entities/common';
import type {ActionFunc} from 'mattermost-redux/types/actions';

const pendingUserIdsForProfiles = new Set<string>();
const MAX_USER_PROFILES_BATCH = 100;
const USER_PROFILES_DURATION = 5 * 1000;
let userProfilesIntervalId: NodeJS.Timeout | null = null;

const pendingUserIdsForStatuses = new Set<string>();
const MAX_USER_STATUSES_BUFFER = 200;
const USER_STATUSES_DURATION = 5 * 1000;
const USER_STATUSES_REQUEST_SURGE_THRESHOLD = 1000;
let userStatusesIntervalId: NodeJS.Timeout | null = null;
let haveUserStatusRequestsSurged = false;

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

            // Since we can only fetch 100 user statuses at a time, we need to batch the requests
            if (pendingUserIdsForStatuses.size >= MAX_USER_STATUSES_BUFFER) {
                // We use temp buffer here to store up until max buffer size
                // and clear out processed user ids
                const userIds: string[] = [];

                let counter = 0;
                for (const pendingUserId of pendingUserIdsForStatuses) {
                    userIds.push(pendingUserId);
                    pendingUserIdsForStatuses.delete(pendingUserId);

                    counter++;

                    if (counter >= MAX_USER_STATUSES_BUFFER) {
                        break;
                    }
                }

                console.log('addUserIdForStatuses', 'executing for', userIds.length, '>');
                dispatch(getStatusesByIds(userIds));
            } else {
                // If we have less than max buffer size, we can directly fetch the statuses
                console.log('addUserIdForStatuses', 'executing for', pendingUserIdsForStatuses.size, '<');
                dispatch(getStatusesByIds(Array.from(pendingUserIdsForStatuses)));
                pendingUserIdsForStatuses.clear();
            }

            if (pendingUserIdsForStatuses.size >= USER_STATUSES_REQUEST_SURGE_THRESHOLD) {
                console.log('addUserIdForStatuses', 'surge is on');
                haveUserStatusRequestsSurged = true;
            } else {
                console.log('addUserIdForStatuses', 'surge is off');
                haveUserStatusRequestsSurged = false;
            }
        }

        pendingUserIdsForStatuses.add(userId);

        // Start the interval if it is not already running
        if (userStatusesIntervalId === null) {
            userStatusesIntervalId = setInterval(() => {
                if (pendingUserIdsForStatuses.size > 0) {
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
        const currentChannelId = getCurrentChannelId(state);
        const isUserStatusesConfigEnabled = getIsUserStatusesConfigEnabled(state);

        posts.forEach((post) => {
            // This is sufficient to check if the profile is already fetched
            // as we recieve the websocket events for the profiles changes
            if (post.user_id !== currentUserId && !state.entities.users.profiles[post.user_id]) {
                dispatch(addUserIdForProfiles(post.user_id));
            }

            if (post.user_id !== currentUserId && isUserStatusesConfigEnabled && !state.entities.users.statuses[post.user_id]) {
                if (haveUserStatusRequestsSurged) {
                    if (post.channel_id === currentChannelId) {
                        dispatch(addUserIdForStatuses(post.user_id));
                    }
                } else {
                    dispatch(addUserIdForStatuses(post.user_id));
                }
            }

            // TODO: We need to handle the groups as well
        });

        return {data: true};
    };
}
