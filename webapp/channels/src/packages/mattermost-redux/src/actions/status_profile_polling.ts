// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GroupSearchParams} from '@mattermost/types/groups';
import type {PostList, Post, PostAcknowledgement, PostEmbed, PostPreviewMetadata} from '@mattermost/types/posts';
import type {UserProfile} from '@mattermost/types/users';

import {searchGroups} from 'mattermost-redux/actions/groups';
import {getNeededAtMentionedUsernamesAndGroups} from 'mattermost-redux/actions/posts';
import {
    getProfilesByIds,
    getProfilesByUsernames,
    getStatusesByIds,
    maxUserIdsPerProfilesRequest,
    maxUserIdsPerStatusesRequest,
} from 'mattermost-redux/actions/users';
import {getCurrentUser, getCurrentUserId, getIsUserStatusesConfigEnabled, getUsers} from 'mattermost-redux/selectors/entities/common';
import {getUsersStatusAndProfileFetchingPollInterval} from 'mattermost-redux/selectors/entities/general';
import {getUserStatuses} from 'mattermost-redux/selectors/entities/users';
import type {ActionFunc, ActionFuncAsync, ThunkActionFunc} from 'mattermost-redux/types/actions';
import {BackgroundDataLoader} from 'mattermost-redux/utils/data_loader';

/**
 * Adds list(s) of user id(s) to the status fetching poll. Which gets fetched based on user interval polling duration
 * Do not use if status is required immediately.
 */
export function addUserIdsForStatusFetchingPoll(userIdsForStatus: Array<UserProfile['id']>): ActionFunc<boolean> {
    return (dispatch, getState, {loaders}: any) => {
        if (!loaders.pollingStatusLoader) {
            loaders.pollingStatusLoader = new BackgroundDataLoader<UserProfile['id']>({
                fetchBatch: (userIds) => dispatch(getStatusesByIds(userIds)),
                maxBatchSize: maxUserIdsPerStatusesRequest,
            });
        }

        loaders.pollingStatusLoader.queue(userIdsForStatus);

        const pollingInterval = getUsersStatusAndProfileFetchingPollInterval(getState());

        // Escape hatch to fetch immediately or when we haven't received the polling interval from config yet
        if (!pollingInterval || pollingInterval <= 0) {
            loaders.pollingStatusLoader.fetchBatchNow();
        } else {
            // Start the interval if it is not already running
            loaders.pollingStatusLoader.startIntervalIfNeeded(pollingInterval);
        }

        // Now here the interval is already running and we have added the user ids to the poll so we don't need to do anything
        return {data: true};
    };
}

/**
 * Adds list(s) of user id(s) to the profile fetching poll. Which gets fetched based on user interval polling duration
 * Do not use if profile is required immediately.
 */
export function addUserIdsForProfileFetchingPoll(userIdsForProfile: Array<UserProfile['id']>): ActionFunc<boolean> {
    return (dispatch, getState, {loaders}: any) => {
        if (!loaders.pollingProfileLoader) {
            loaders.pollingProfileLoader = new BackgroundDataLoader<UserProfile['id']>({
                fetchBatch: (userIds) => dispatch(getProfilesByIds(userIds)),
                maxBatchSize: maxUserIdsPerProfilesRequest,
            });
        }

        loaders.pollingProfileLoader.queue(userIdsForProfile);

        const pollingInterval = getUsersStatusAndProfileFetchingPollInterval(getState());

        // Escape hatch to fetch immediately or when we haven't received the polling interval from config yet
        if (!pollingInterval || pollingInterval <= 0) {
            loaders.pollingProfileLoader.fetchBatchNow();
        } else {
            // Start the interval if it is not already running
            loaders.pollingProfileLoader.startIntervalIfNeeded(pollingInterval);
        }

        // Now here the interval is already running and we have added the user ids to the poll so we don't need to do anything
        return {data: true};
    };
}

export function cleanUpStatusAndProfileFetchingPoll(): ThunkActionFunc<void> {
    return (dispatch, getState, {loaders}: any) => {
        loaders.pollingStatusLoader?.stopInterval();

        loaders.pollingProfileLoader?.stopInterval();
    };
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
                                dispatch(addUserIdsForProfileFetchingPoll([permalinkPostPreviewMetaData.post.user_id]));
                            }
                            if (permalinkPostPreviewMetaData.post?.user_id && !userStatuses[permalinkPostPreviewMetaData.post.user_id] && permalinkPostPreviewMetaData.post.user_id !== currentUserId && isUserStatusesConfigEnabled) {
                                dispatch(addUserIdsForStatusFetchingPoll([permalinkPostPreviewMetaData.post.user_id]));
                            }
                        }
                    });
                }

                // Add users listed in the Post Acknowledgement feature
                if (post.metadata.acknowledgements) {
                    post.metadata.acknowledgements.forEach((ack: PostAcknowledgement) => {
                        if (ack.acknowledged_at > 0 && ack.user_id && !users[ack.user_id] && ack.user_id !== currentUserId) {
                            dispatch(addUserIdsForProfileFetchingPoll([ack.user_id]));
                        }
                    });
                }
            }

            // This is sufficient to check if the profile is already fetched
            // as we receive the websocket events for the profiles changes
            if (!users[post.user_id] && post.user_id !== currentUserId) {
                dispatch(addUserIdsForProfileFetchingPoll([post.user_id]));
            }

            // This is sufficient to check if the status is already fetched
            // as we do the polling for statuses for current channel's channel members every 1 minute in channel_controller
            if (!userStatuses[post.user_id] && post.user_id !== currentUserId && isUserStatusesConfigEnabled) {
                dispatch(addUserIdsForStatusFetchingPoll([post.user_id]));
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
