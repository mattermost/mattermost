// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-console */

import type {GroupSearchParams} from '@mattermost/types/groups';
import type {PostList, Post, PostAcknowledgement, PostEmbed, PostPreviewMetadata} from '@mattermost/types/posts';
import type {UserProfile} from '@mattermost/types/users';

import {searchGroups} from 'mattermost-redux/actions/groups';
import {getNeededAtMentionedUsernamesAndGroups} from 'mattermost-redux/actions/posts';
import {getProfilesByIds, getProfilesByUsernames, getStatusesByIds} from 'mattermost-redux/actions/users';
import {getCurrentUser, getCurrentUserId, getIsUserStatusesConfigEnabled, getUsers} from 'mattermost-redux/selectors/entities/common';
import {getUserStatuses} from 'mattermost-redux/selectors/entities/users';
import type {ActionFunc, ActionFuncAsync} from 'mattermost-redux/types/actions';

const MAX_USER_STATUSES_BUFFER = 200;
const MAX_USER_PROFILES_BATCH = 100;

const pendingUserIdsForStatuses = new Set<string>();
let userStatusesIntervalId: NodeJS.Timeout | null = null;

/**
 * Adds list of user ids to the status fetching pool. Which gets fetched based on user interval pooling duration
 * Do not use if status is required immediately.
 */
export function addUserIdsToStatusFetchingPool(inputUserIds: Array<UserProfile['id']>, poolingInterval: number): ActionFunc<boolean> {
    return (dispatch) => {
        if (!poolingInterval || poolingInterval <= 0) {
            return {data: false};
        }

        function getPendingStatusesById() {
            console.log('addUserIdsToStatusFetchingPool start', pendingUserIdsForStatuses);

            // Since we can only fetch a defined number of user statuses at a time, we need to batch the requests
            if (pendingUserIdsForStatuses.size >= MAX_USER_STATUSES_BUFFER) {
                // We use temp buffer here to store up until max buffer size
                // and clear out processed user ids
                const bufferedUserIds: string[] = [];

                let bufferCounter = 0;
                for (const pendingUserId of pendingUserIdsForStatuses) {
                    bufferedUserIds.push(pendingUserId);
                    pendingUserIdsForStatuses.delete(pendingUserId);

                    bufferCounter++;

                    if (bufferCounter >= MAX_USER_STATUSES_BUFFER) {
                        break;
                    }
                }

                console.log('addUserIdsToStatusFetchingPool', 'overflow executing only for', bufferedUserIds.length);

                dispatch(getStatusesByIds(bufferedUserIds));
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
            }, poolingInterval);
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

const pendingUserIdsForProfiles = new Set<string>();
let userProfilesIntervalId: NodeJS.Timeout | null = null;

function addUserIdForProfileFetchingPool(userId: string, poolingInterval: number): ActionFunc<boolean> {
    return (dispatch) => {
        if (!poolingInterval || poolingInterval <= 0) {
            return {data: false};
        }

        function getPendingProfilesById() {
            console.log('addUserIdForProfileFetchingPool start', pendingUserIdsForProfiles);

            if (pendingUserIdsForProfiles.size >= MAX_USER_PROFILES_BATCH) {
                const bufferedUserIds: Array<UserProfile['id']> = [];

                let bufferCounter = 0;
                for (const pendingUserId of pendingUserIdsForProfiles) {
                    bufferedUserIds.push(pendingUserId);
                    pendingUserIdsForProfiles.delete(pendingUserId);

                    bufferCounter++;

                    // We can only fetch a defined number of user profiles at a time
                    // So we break out of the loop if we reach the max batch size
                    if (bufferCounter >= MAX_USER_PROFILES_BATCH) {
                        break;
                    }
                }
            }

            dispatch(getProfilesByIds(Array.from(pendingUserIdsForProfiles)));
            pendingUserIdsForProfiles.clear();
        }

        pendingUserIdsForProfiles.add(userId);

        // Start the interval if it is not already running
        if (userProfilesIntervalId === null) {
            userProfilesIntervalId = setInterval(() => {
                if (pendingUserIdsForProfiles.size > 0) {
                    console.log('addUserIdForProfileFetchingPool', 'executing with interval for pending', pendingUserIdsForProfiles.size);

                    getPendingProfilesById();
                } else {
                    console.log('addUserIdForProfileFetchingPool', 'no pending user ids');
                }
            }, poolingInterval);
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

/**
 * Gets in batch the user profiles, user statuses and user groups for the users in the posts list
 * This action however doesn't refetch the profiles and statuses except for groups if they are already fetched once
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
        const currentUser = getCurrentUser(state);
        const currentUserId = getCurrentUserId(state);
        const isUserStatusesConfigEnabled = getIsUserStatusesConfigEnabled(state);
        const users = getUsers(state);
        const userStatuses = getUserStatuses(state);

        const poolingInterval = 5 * 1000;

        posts.forEach((post) => {
            if (post.metadata) {
                // Add users listed in permalink previews
                if (post.metadata.embeds) {
                    post.metadata.embeds.forEach((embed: PostEmbed) => {
                        if (embed.type === 'permalink' && embed.data) {
                            const permalinkPostPreviewMetaData = embed.data as PostPreviewMetadata;

                            if (permalinkPostPreviewMetaData.post?.user_id && !users[permalinkPostPreviewMetaData.post.user_id] && permalinkPostPreviewMetaData.post.user_id !== currentUserId) {
                                dispatch(addUserIdForProfileFetchingPool(permalinkPostPreviewMetaData.post.user_id, poolingInterval));
                            }
                            if (permalinkPostPreviewMetaData.post?.user_id && !userStatuses[permalinkPostPreviewMetaData.post.user_id] && permalinkPostPreviewMetaData.post.user_id !== currentUserId && isUserStatusesConfigEnabled) {
                                dispatch(addUserIdsToStatusFetchingPool([permalinkPostPreviewMetaData.post.user_id], poolingInterval));
                            }
                        }
                    });
                }

                // Add users listed in the Post Acknowledgement feature
                if (post.metadata.acknowledgements) {
                    post.metadata.acknowledgements.forEach((ack: PostAcknowledgement) => {
                        if (ack.acknowledged_at > 0 && ack.user_id && !users[ack.user_id] && ack.user_id !== currentUserId) {
                            dispatch(addUserIdForProfileFetchingPool(ack.user_id, poolingInterval));
                        }
                    });
                }
            }

            // This is sufficient to check if the profile is already fetched
            // as we receive the websocket events for the profiles changes
            if (!users[post.user_id] && post.user_id !== currentUserId) {
                dispatch(addUserIdForProfileFetchingPool(post.user_id, poolingInterval));
            }

            // This is sufficient to check if the status is already fetched
            // as we do the pooling for statuses for current channel's channel members every 1 minute in channel_controller
            if (!userStatuses[post.user_id] && post.user_id !== currentUserId && isUserStatusesConfigEnabled) {
                dispatch(addUserIdsToStatusFetchingPool([post.user_id], poolingInterval));
            }

            // We need to check for all @mentions in the post, they can be either users or groups
            const mentioned = getNeededAtMentionedUsernamesAndGroups(state, [post]);
            if (mentioned.size > 0) {
                mentioned.forEach((atMention) => {
                    if (atMention !== currentUser.username) {
                        mentionedUsernamesAndGroupsInPosts.add(atMention);
                    }
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
