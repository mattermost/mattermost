// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GroupSearchParams} from '@mattermost/types/groups';
import type {PostList, Post, PostAcknowledgement, PostEmbed, PostPreviewMetadata} from '@mattermost/types/posts';
import type {UserProfile} from '@mattermost/types/users';

import {searchGroups} from 'mattermost-redux/actions/groups';
import {getNeededAtMentionedUsernamesAndGroups} from 'mattermost-redux/actions/posts';
import {getProfilesByIds, getProfilesByUsernames, getStatusesByIds} from 'mattermost-redux/actions/users';
import {getCurrentUser, getCurrentUserId, getIsUserStatusesConfigEnabled, getUsers} from 'mattermost-redux/selectors/entities/common';
import {getUserStatuses} from 'mattermost-redux/selectors/entities/users';
import type {ActionFunc, ActionFuncAsync} from 'mattermost-redux/types/actions';

const MAX_USER_STATUSES_BUFFER = 200; // users ids per 'users/status/ids'request
const MAX_USER_PROFILES_BATCH = 100; // users ids per 'users/ids' request

const pendingUserIdsForStatuses = new Set<string>();
const pendingUserIdsForProfiles = new Set<string>();

let intervalIdForFetchingPool: NodeJS.Timeout | null = null;

type UserIdsSingleOrArray = Array<UserProfile['id']> | UserProfile['id'];
type AddUserIdForStatusAndProfileFetchingPool = {
    userIdsForStatus?: UserIdsSingleOrArray;
    userIdsForProfile?: UserIdsSingleOrArray;
}

/**
 * Adds list(s) of user id(s) to the status and profile fetching pool. Which gets fetched based on user interval pooling duration
 * Do not use if status or profile is required immediately.
 */
export function addUserIdsForStatusAndProfileFetchingPool({userIdsForStatus, userIdsForProfile}: AddUserIdForStatusAndProfileFetchingPool): ActionFunc<boolean> {
    return (dispatch) => {
        function getPendingStatusesById() {
            // Since we can only fetch a defined number of user statuses at a time, we need to batch the requests
            if (pendingUserIdsForStatuses.size >= MAX_USER_STATUSES_BUFFER) {
                // We use temp buffer here to store up until max buffer size
                // and clear out processed user ids
                const bufferedUserIds: string[] = [];
                let bufferCounter = 0;
                for (const pendingUserId of pendingUserIdsForStatuses) {
                    if (pendingUserId.length === 0) {
                        continue;
                    }

                    bufferedUserIds.push(pendingUserId);
                    pendingUserIdsForStatuses.delete(pendingUserId);

                    bufferCounter++;

                    if (bufferCounter >= MAX_USER_STATUSES_BUFFER) {
                        break;
                    }
                }

                if (bufferedUserIds.length > 0) {
                    // eslint-disable-next-line no-console
                    console.log('status', 'overflow of', pendingUserIdsForStatuses.size, 'executing for', bufferedUserIds.length);
                    dispatch(getStatusesByIds(bufferedUserIds));
                }
            } else {
                // If we have less than max buffer size, we can directly fetch the statuses
                const lessThanBufferUserIds = Array.from(pendingUserIdsForStatuses);
                if (lessThanBufferUserIds.length > 0) {
                    // eslint-disable-next-line no-console
                    console.log('status', 'underflow of', pendingUserIdsForStatuses.size, 'executing');
                    dispatch(getStatusesByIds(lessThanBufferUserIds));

                    pendingUserIdsForStatuses.clear();
                }
            }
        }

        function getPendingProfilesById() {
            if (pendingUserIdsForProfiles.size >= MAX_USER_PROFILES_BATCH) {
                const bufferedUserIds: Array<UserProfile['id']> = [];
                let bufferCounter = 0;
                for (const pendingUserId of pendingUserIdsForProfiles) {
                    if (pendingUserId.length === 0) {
                        continue;
                    }

                    bufferedUserIds.push(pendingUserId);
                    pendingUserIdsForProfiles.delete(pendingUserId);

                    bufferCounter++;

                    // We can only fetch a defined number of user profiles at a time
                    // So we break out of the loop if we reach the max batch size
                    if (bufferCounter >= MAX_USER_PROFILES_BATCH) {
                        break;
                    }
                }

                // eslint-disable-next-line no-console
                console.log('profiles', 'overflow of', pendingUserIdsForProfiles.size, 'executing for', bufferedUserIds.length);

                dispatch(getProfilesByIds(bufferedUserIds));
            } else {
                const lessThanBufferUserIds = Array.from(pendingUserIdsForProfiles);
                if (lessThanBufferUserIds.length > 0) {
                    // eslint-disable-next-line no-console
                    console.log('profiles', 'underflow of', pendingUserIdsForProfiles.size, 'executing');
                    dispatch(getProfilesByIds(lessThanBufferUserIds));

                    pendingUserIdsForProfiles.clear();
                }
            }
        }

        // TODO: Make this configurable
        const poolingInterval = 3000;

        if (userIdsForStatus) {
            if (Array.isArray(userIdsForStatus)) {
                userIdsForStatus.forEach((userId) => {
                    if (userId.length > 0) {
                        pendingUserIdsForStatuses.add(userId);
                    }
                });
            } else {
                pendingUserIdsForStatuses.add(userIdsForStatus);
            }
        }

        if (userIdsForProfile) {
            if (Array.isArray(userIdsForProfile)) {
                userIdsForProfile.forEach((userId) => {
                    if (userId.length > 0) {
                        pendingUserIdsForProfiles.add(userId);
                    }
                });
            } else {
                pendingUserIdsForProfiles.add(userIdsForProfile);
            }
        }

        // Escape hatch to fetch immediately or when we haven't received the pooling interval from config yet
        if (poolingInterval <= 0) {
            if (pendingUserIdsForStatuses.size > 0) {
                getPendingStatusesById();
            }

            if (pendingUserIdsForProfiles.size > 0) {
                getPendingProfilesById();
            }
        } else if (intervalIdForFetchingPool === null) {
            // Start the interval if it is not already running
            intervalIdForFetchingPool = setInterval(() => {
                if (pendingUserIdsForStatuses.size > 0) {
                    getPendingStatusesById();
                } else {
                    // eslint-disable-next-line no-console
                    console.log('status', 'no pending user ids');
                }

                if (pendingUserIdsForProfiles.size > 0) {
                    getPendingProfilesById();
                } else {
                    // eslint-disable-next-line no-console
                    console.log('profiles', 'no pending user ids');
                }
            }, poolingInterval);
        }

        // Now here the interval is already running and we have added the user ids to the pool so we don't need to do anything
        return {data: true};
    };
}

export function cleanUpStatusAndProfileFetchingPool() {
    if (intervalIdForFetchingPool !== null) {
        clearInterval(intervalIdForFetchingPool);
        intervalIdForFetchingPool = null;
    }
}

/**
 * Gets in batch the user profiles, user statuses and user groups for the users in the posts list
 * This action however doesn't refetch the profiles and statuses except for groups if they are already fetched once
 */
export function batchFetchStatusesProfilesGroupsFromPosts(postsArrayOrMap: Post[]|PostList['posts']|Post): ActionFunc<boolean> {
    return (dispatch, getState) => {
        if (!postsArrayOrMap) {
            return {data: false};
        }

        let posts: Post[] = [];
        if (Array.isArray(postsArrayOrMap)) {
            posts = postsArrayOrMap;
        } else if (typeof postsArrayOrMap === 'object' && 'id' in postsArrayOrMap) {
            posts = [postsArrayOrMap as Post];
        } else if (typeof postsArrayOrMap === 'object') {
            posts = Object.values(postsArrayOrMap);
        }

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

        posts.forEach((post) => {
            if (post.metadata) {
                // Add users listed in permalink previews
                if (post.metadata.embeds) {
                    post.metadata.embeds.forEach((embed: PostEmbed) => {
                        if (embed.type === 'permalink' && embed.data) {
                            const permalinkPostPreviewMetaData = embed.data as PostPreviewMetadata;

                            if (permalinkPostPreviewMetaData.post?.user_id && !users[permalinkPostPreviewMetaData.post.user_id] && permalinkPostPreviewMetaData.post.user_id !== currentUserId) {
                                dispatch(addUserIdsForStatusAndProfileFetchingPool({userIdsForProfile: permalinkPostPreviewMetaData.post.user_id}));
                            }
                            if (permalinkPostPreviewMetaData.post?.user_id && !userStatuses[permalinkPostPreviewMetaData.post.user_id] && permalinkPostPreviewMetaData.post.user_id !== currentUserId && isUserStatusesConfigEnabled) {
                                dispatch(addUserIdsForStatusAndProfileFetchingPool({userIdsForStatus: permalinkPostPreviewMetaData.post.user_id}));
                            }
                        }
                    });
                }

                // Add users listed in the Post Acknowledgement feature
                if (post.metadata.acknowledgements) {
                    post.metadata.acknowledgements.forEach((ack: PostAcknowledgement) => {
                        if (ack.acknowledged_at > 0 && ack.user_id && !users[ack.user_id] && ack.user_id !== currentUserId) {
                            dispatch(addUserIdsForStatusAndProfileFetchingPool({userIdsForProfile: ack.user_id}));
                        }
                    });
                }
            }

            // This is sufficient to check if the profile is already fetched
            // as we receive the websocket events for the profiles changes
            if (!users[post.user_id] && post.user_id !== currentUserId) {
                dispatch(addUserIdsForStatusAndProfileFetchingPool({userIdsForProfile: post.user_id}));
            }

            // This is sufficient to check if the status is already fetched
            // as we do the pooling for statuses for current channel's channel members every 1 minute in channel_controller
            if (!userStatuses[post.user_id] && post.user_id !== currentUserId && isUserStatusesConfigEnabled) {
                dispatch(addUserIdsForStatusAndProfileFetchingPool({userIdsForStatus: post.user_id}));
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
