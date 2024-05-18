// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-console */

import type {GroupSearchParams} from '@mattermost/types/groups';
import type {PostList, Post} from '@mattermost/types/posts';
import type {UserProfile} from '@mattermost/types/users';

import {searchGroups} from 'mattermost-redux/actions/groups';
import {getNeededAtMentionedUsernamesAndGroups} from 'mattermost-redux/actions/posts';
import {getProfilesByIds, getProfilesByUsernames, getStatusesByIds} from 'mattermost-redux/actions/users';
import {getCurrentUserId, getIsUserStatusesConfigEnabled, getUsers} from 'mattermost-redux/selectors/entities/common';
import {getUserStatuses} from 'mattermost-redux/selectors/entities/users';
import type {ActionFunc, ActionFuncAsync} from 'mattermost-redux/types/actions';

const pendingUserIdsForProfiles = new Set<string>();
const MAX_USER_PROFILES_BATCH = 100;
const USER_PROFILES_DURATION = 5 * 1000;
let userProfilesIntervalId: NodeJS.Timeout | null = null;

const pendingUserIdsForStatuses = new Set<string>();
const MAX_USER_STATUSES_BUFFER = 200;
const USER_STATUSES_DURATION = 5 * 1000;
let userStatusesIntervalId: NodeJS.Timeout | null = null;

function addUserIdForProfiles(userId: string): ActionFunc<boolean> {
    return (dispatch) => {
        function getPendingProfilesById() {
            console.log('addUserIdForProfiles start', pendingUserIdsForProfiles);

            dispatch(getProfilesByIds(Array.from(pendingUserIdsForProfiles)));
            pendingUserIdsForProfiles.clear();
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

function addUserIdsToStatusFetchingPool(inputUserIds: Array<UserProfile['id']>): ActionFunc<boolean> {
    return (dispatch) => {
        function getPendingStatusesById() {
            console.log('addUserIdsToStatusFetchingPool start', pendingUserIdsForStatuses);

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

                console.log('addUserIdsToStatusFetchingPool', 'overflow executing only for', userIds.length);

                dispatch(getStatusesByIds(userIds));
            } else {
                // If we have less than max buffer size, we can directly fetch the statuses
                console.log('addUserIdsToStatusFetchingPool', 'less than buffer executing for', pendingUserIdsForStatuses.size);

                dispatch(getStatusesByIds(Array.from(pendingUserIdsForStatuses)));
                pendingUserIdsForStatuses.clear();
            }
        }

        inputUserIds.forEach((userId) => {
            pendingUserIdsForStatuses.add(userId);
        });

        // Start the interval if it is not already running
        if (userStatusesIntervalId === null) {
            userStatusesIntervalId = setInterval(() => {
                if (pendingUserIdsForStatuses.size > 0) {
                    getPendingStatusesById();
                } else {
                    console.log('addUserIdsToStatusFetchingPool', 'no pending user ids');
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

        const mentionedUsernamesAndGroupsInPosts = new Set<string>();

        const state = getState();
        const currentUserId = getCurrentUserId(state);
        const isUserStatusesConfigEnabled = getIsUserStatusesConfigEnabled(state);
        const users = getUsers(state);
        const userStatuses = getUserStatuses(state);

        posts.forEach((post) => {
            if (post.metadata) {
                // Add users listed in permalink previews
                if (post.metadata.embeds) {
                    post.metadata.embeds.forEach((embed: any) => {
                        if (embed.type === 'permalink' && embed.data) {
                            if (embed.data.post?.user_id && !users[embed.data.post.user_id] && embed.data.post.user_id !== currentUserId) {
                                dispatch(addUserIdForProfiles(embed.data.post.user_id));
                            }
                            if (embed.data.post?.user_id && !userStatuses[embed.data.post.user_id]) {
                                dispatch(addUserIdsToStatusFetchingPool([embed.data.post.user_id]));
                            }
                        }
                    });
                }

                // Add users listed in the Post Acknowledgement feature
                if (post.metadata.acknowledgements) {
                    post.metadata.acknowledgements.forEach((ack: any) => {
                        if (ack.acknowledged_at > 0) {
                            dispatch(addUserIdForProfiles(ack.user_id));
                        }
                    });
                }
            }

            // This is sufficient to check if the profile is already fetched
            // as we receive the websocket events for the profiles changes
            if (post.user_id !== currentUserId && !users[post.user_id]) {
                dispatch(addUserIdForProfiles(post.user_id));
            }

            // This is sufficient to check if the status is already fetched
            // as we do the pooling for statuses for current channel's channel members every 1 minute in channel_controller
            if (post.user_id !== currentUserId && isUserStatusesConfigEnabled && !userStatuses[post.user_id]) {
                dispatch(addUserIdsToStatusFetchingPool([post.user_id]));
            }

            // We need to check for all @mentions in the post, they can be either users or groups
            const mentioned = getNeededAtMentionedUsernamesAndGroups(state, [post]);
            if (mentioned.size > 0) {
                mentioned.forEach((atMention) => {
                    mentionedUsernamesAndGroupsInPosts.add(atMention);
                });
            }
        });

        if (mentionedUsernamesAndGroupsInPosts.size > 0) {
            dispatch(getUsersFromMentionedUsernamesAndGroups(Array.from(mentionedUsernamesAndGroupsInPosts)));
        }

        return {data: true};
    };
}

export function getUsersFromMentionedUsernamesAndGroups(usernamesAndGroups: string[]): ActionFuncAsync<string[]> {
    return async (dispatch) => {
        // We run the at-mentioned be it user or group through the user profile search
        const {data: userProfiles} = await dispatch(getProfilesByUsernames(usernamesAndGroups));

        const mentionedUsernames: Array<UserProfile['username']> = [];

        // The user at-mentioned will be the userProfiles
        if (userProfiles) {
            for (const user of userProfiles) {
                if (user && user.username) {
                    mentionedUsernames.push(user.username);
                }
            }
        }

        // Removing usernames from the list will leave only the group names
        const mentionedGroups = usernamesAndGroups.filter((name) => !mentionedUsernames.includes(name));

        for (const group of mentionedGroups) {
            const groupSearchParam: GroupSearchParams = {
                q: group,
                filter_allow_reference: true,
                page: 0,
                per_page: 60,
            };

            dispatch(searchGroups(groupSearchParam));
        }

        return {data: mentionedGroups};
    };
}
