// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment-timezone';

import type {ActivityEntry, Post} from '@mattermost/types/posts';
import type {GlobalState} from '@mattermost/types/store';
import {isStringArray, isArrayOf} from '@mattermost/types/utilities';

import {Posts} from 'mattermost-redux/constants';
import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {makeGetPostsForIds} from 'mattermost-redux/selectors/entities/posts';
import type {UserActivityPost} from 'mattermost-redux/selectors/entities/posts';
import {shouldShowJoinLeaveMessages} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';
import {createIdsSelector, memoizeResult} from 'mattermost-redux/utils/helpers';
import {isUserActivityPost, shouldFilterJoinLeavePost, isFromWebhook, ensureString} from 'mattermost-redux/utils/post_utils';
import {getUserCurrentTimezone} from 'mattermost-redux/utils/timezone_utils';

export const COMBINED_USER_ACTIVITY = 'user-activity-';
export const CREATE_COMMENT = 'create-comment';
export const DATE_LINE = 'date-';
export const START_OF_NEW_MESSAGES = 'start-of-new-messages-';
export const MAX_COMBINED_SYSTEM_POSTS = 100;

interface PostFilterOptions {
    postIds: string[];
    lastViewedAt: number;
    indicateNewMessages?: boolean;
}

export function makePreparePostIdsForPostList() {
    const filterPostsAndAddSeparators = makeFilterPostsAndAddSeparators();
    const combineUserActivityPosts = makeCombineUserActivityPosts();
    return (state: GlobalState, options: PostFilterOptions) => {
        let postIds = filterPostsAndAddSeparators(state, options);
        postIds = combineUserActivityPosts(state, postIds);
        return postIds;
    };
}

// Returns a selector that, given the state and an object containing an array of postIds and an optional
// timestamp of when the channel was last read, returns a memoized array of postIds interspersed with
// day indicators and an optional new message indicator.
export function makeFilterPostsAndAddSeparators() {
    const getPostsForIds = makeGetPostsForIds();

    return createIdsSelector(
        'makeFilterPostsAndAddSeparators',
        (state: GlobalState, {postIds}: PostFilterOptions) => getPostsForIds(state, postIds),
        (state: GlobalState, {lastViewedAt}: PostFilterOptions) => lastViewedAt,
        (state: GlobalState, {indicateNewMessages}: PostFilterOptions) => indicateNewMessages,
        () => '', // This previously returned state.entities.posts.selectedPostId which stopped being set at some point
        getCurrentUser,
        shouldShowJoinLeaveMessages,
        (posts, lastViewedAt, indicateNewMessages, selectedPostId, currentUser, showJoinLeave) => {
            if (posts.length === 0 || !currentUser) {
                return [];
            }

            const out: string[] = [];
            let lastDate;
            let addedNewMessagesIndicator = false;

            // Iterating through the posts from oldest to newest
            for (let i = posts.length - 1; i >= 0; i--) {
                const post = posts[i];

                if (
                    !post ||
                    (post.type === Posts.POST_TYPES.EPHEMERAL_ADD_TO_CHANNEL && !selectedPostId)
                ) {
                    continue;
                }

                // Filter out join/leave messages if necessary
                if (shouldFilterJoinLeavePost(post, showJoinLeave, currentUser.username)) {
                    continue;
                }

                // Push on a date header if the last post was on a different day than the current one
                const postDate = new Date(post.create_at);
                const currentOffset = postDate.getTimezoneOffset() * 60 * 1000;
                const timezone = getUserCurrentTimezone(currentUser.timezone);
                if (timezone) {
                    const zone = moment.tz.zone(timezone);
                    if (zone) {
                        const timezoneOffset = zone.utcOffset(postDate.getTime()) * 60 * 1000;
                        postDate.setTime(postDate.getTime() + (currentOffset - timezoneOffset));
                    }
                }

                if (!lastDate || lastDate.toDateString() !== postDate.toDateString()) {
                    out.push(DATE_LINE + postDate.getTime());

                    lastDate = postDate;
                }

                if (
                    lastViewedAt &&
                    post.create_at > lastViewedAt &&
                    (post.user_id !== currentUser.id || isFromWebhook(post)) &&
                    !addedNewMessagesIndicator &&
                    indicateNewMessages
                ) {
                    out.push(START_OF_NEW_MESSAGES + lastViewedAt);
                    addedNewMessagesIndicator = true;
                }

                out.push(post.id);
            }

            // Flip it back to newest to oldest
            return out.reverse();
        },
    );
}

export function makeCombineUserActivityPosts() {
    const getPostsForIds = makeGetPostsForIds();

    return createIdsSelector(
        'makeCombineUserActivityPosts',
        (state: GlobalState, postIds: string[]) => postIds,
        (state: GlobalState, postIds: string[]) => getPostsForIds(state, postIds),
        (postIds, posts) => {
            let lastPostIsUserActivity = false;
            let combinedCount = 0;
            const out: string[] = [];
            let changed = false;

            for (let i = 0; i < postIds.length; i++) {
                const postId = postIds[i];

                if (isStartOfNewMessages(postId) || isDateLine(postId) || isCreateComment(postId)) {
                    // Not a post, so it won't be combined
                    out.push(postId);

                    lastPostIsUserActivity = false;
                    combinedCount = 0;

                    continue;
                }

                const post = posts[i];
                const postIsUserActivity = isUserActivityPost(post.type);

                if (postIsUserActivity && lastPostIsUserActivity && combinedCount < MAX_COMBINED_SYSTEM_POSTS) {
                    // Add the ID to the previous combined post
                    out[out.length - 1] += '_' + postId;

                    combinedCount += 1;

                    changed = true;
                } else if (postIsUserActivity) {
                    // Start a new combined post, even if the "combined" post is only a single post
                    out.push(COMBINED_USER_ACTIVITY + postId);

                    combinedCount = 1;

                    changed = true;
                } else {
                    out.push(postId);

                    combinedCount = 0;
                }

                lastPostIsUserActivity = postIsUserActivity;
            }

            if (!changed) {
                // Nothing was combined, so return the original array
                return postIds;
            }

            return out;
        },
    );
}

export function isStartOfNewMessages(item: string) {
    return item.startsWith(START_OF_NEW_MESSAGES);
}

export function getTimestampForStartOfNewMessages(item: string) {
    return parseInt(item.substring(START_OF_NEW_MESSAGES.length), 10);
}

export function getNewMessagesIndex(postListIds: string[]): number {
    return postListIds.findIndex(isStartOfNewMessages);
}

export function isCreateComment(item: string) {
    return item === CREATE_COMMENT;
}

export function isDateLine(item: string) {
    return item.startsWith(DATE_LINE);
}

export function getDateForDateLine(item: string) {
    return parseInt(item.substring(DATE_LINE.length), 10);
}

export function isCombinedUserActivityPost(item: string) {
    return (/^user-activity-(?:[^_]+_)*[^_]+$/).test(item);
}

export function getPostIdsForCombinedUserActivityPost(item: string) {
    return item.substring(COMBINED_USER_ACTIVITY.length).split('_');
}

export function getFirstPostId(items: string[]) {
    for (let i = 0; i < items.length; i++) {
        const item = items[i];

        if (isStartOfNewMessages(item) || isDateLine(item) || isCreateComment(item)) {
            // This is not a post at all
            continue;
        }

        if (isCombinedUserActivityPost(item)) {
            // This is a combined post, so find the first post ID from it
            const combinedIds = getPostIdsForCombinedUserActivityPost(item);

            return combinedIds[0];
        }

        // This is a post ID
        return item;
    }

    return '';
}

export function getLastPostId(items: string[]) {
    for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];

        if (isStartOfNewMessages(item) || isDateLine(item) || isCreateComment(item)) {
            // This is not a post at all
            continue;
        }

        if (isCombinedUserActivityPost(item)) {
            // This is a combined post, so find the first post ID from it
            const combinedIds = getPostIdsForCombinedUserActivityPost(item);

            return combinedIds[combinedIds.length - 1];
        }

        // This is a post ID
        return item;
    }

    return '';
}

export function getLastPostIndex(postIds: string[]) {
    let index = 0;
    for (let i = postIds.length - 1; i > 0; i--) {
        const item = postIds[i];
        if (!isStartOfNewMessages(item) && !isDateLine(item) && !isCreateComment(item)) {
            index = i;
            break;
        }
    }

    return index;
}

export function makeGenerateCombinedPost(): (state: GlobalState, combinedId: string) => UserActivityPost {
    const getPostsForIds = makeGetPostsForIds();
    const getPostIds = memoizeResult(getPostIdsForCombinedUserActivityPost);

    return createSelector(
        'makeGenerateCombinedPost',
        (state: GlobalState, combinedId: string) => combinedId,
        (state: GlobalState, combinedId: string) => getPostsForIds(state, getPostIds(combinedId)),
        (combinedId, posts) => {
            // All posts should be in the same channel
            const channelId = posts[0].channel_id;

            // Assume that the last post is the oldest one
            const createAt = posts[posts.length - 1].create_at;
            const messages = posts.map((post) => post.message);

            return {
                id: combinedId,
                create_at: createAt,
                update_at: 0,
                edit_at: 0,
                delete_at: 0,
                is_pinned: false,
                user_id: '',
                channel_id: channelId,
                root_id: '',
                parent_id: '',
                original_id: '',
                message: messages.join('\n'),
                type: Posts.POST_TYPES.COMBINED_USER_ACTIVITY,
                props: {
                    messages,
                    user_activity: combineUserActivitySystemPost(posts),
                },
                hashtags: '',
                pending_post_id: '',
                reply_count: 0,
                metadata: {
                    embeds: [],
                    emojis: [],
                    files: [],
                    images: {},
                    reactions: [],
                },
                system_post_ids: posts.map((post) => post.id),
                user_activity_posts: posts,
            };
        },
    );
}

export function extractUserActivityData(userActivities: ActivityEntry[]) {
    const messageData: MessageData[] = [];
    const allUserIds: string[] = [];
    const allUsernames: string[] = [];
    userActivities.forEach((activity) => {
        if (isUsersRelatedPost(activity.postType)) {
            const {postType, actorId, userIds, usernames} = activity;
            if (usernames && userIds) {
                messageData.push({postType, userIds: [...userIds], actorId: actorId[0]});
                if (userIds.length > 0) {
                    allUserIds.push(...userIds.filter((userId) => userId));
                }
                if (usernames.length > 0) {
                    allUsernames.push(...usernames.filter((username) => username));
                }
                allUserIds.push(actorId[0]);
            }
        } else {
            const {postType, actorId} = activity;
            const userIds = actorId;
            messageData.push({postType, userIds});
            allUserIds.push(...userIds);
        }
    });
    function reduceUsers(acc: string[], curr: string) {
        if (!acc.includes(curr)) {
            acc.push(curr);
        }
        return acc;
    }

    return {
        allUserIds: allUserIds.reduce(reduceUsers, []),
        allUsernames: allUsernames.reduce(reduceUsers, []),
        messageData,
    };
}
function isUsersRelatedPost(postType: string) {
    return (
        postType === Posts.POST_TYPES.ADD_TO_TEAM ||
        postType === Posts.POST_TYPES.ADD_TO_CHANNEL ||
        postType === Posts.POST_TYPES.REMOVE_FROM_CHANNEL
    );
}
function mergeLastSimilarPosts(userActivities: ActivityEntry[]) {
    const prevPost = userActivities[userActivities.length - 1];
    const prePrevPost = userActivities[userActivities.length - 2];
    const prevPostType = prevPost && prevPost.postType;
    const prePrevPostType = prePrevPost && prePrevPost.postType;

    if (prevPostType === prePrevPostType) {
        userActivities.pop();
        prePrevPost.actorId.push(...prevPost.actorId);
    }
}
function isSameActorsInUserActivities(prevActivity: ActivityEntry, curActivity: ActivityEntry) {
    const prevPostActorsSet = new Set(prevActivity.actorId);
    const currentPostActorsSet = new Set(curActivity.actorId);

    if (prevPostActorsSet.size !== currentPostActorsSet.size) {
        return false;
    }
    let hasAllActors = true;

    currentPostActorsSet.forEach((actor) => {
        if (!prevPostActorsSet.has(actor)) {
            hasAllActors = false;
        }
    });
    return hasAllActors;
}
export function combineUserActivitySystemPost(systemPosts: Post[] = []): UserActivityProp | undefined {
    if (systemPosts.length === 0) {
        return undefined;
    }
    const userActivities: ActivityEntry[] = [];
    systemPosts.reverse().forEach((post: Post) => {
        const postType = post.type;
        const actorId = post.user_id;

        // When combining removed posts, the actorId does not need to be the same for each post.
        // All removed posts will be combined regardless of their respective actorIds.
        const isRemovedPost = post.type === Posts.POST_TYPES.REMOVE_FROM_CHANNEL;
        const addedUserId = ensureString(post.props?.addedUserId);
        const removedUserId = ensureString(post.props?.removedUserId);
        const addedUsername = ensureString(post.props?.addedUsername);
        const removedUsername = ensureString(post.props?.removedUsername);
        const userId = isUsersRelatedPost(postType) ? addedUserId || removedUserId : '';
        const username = isUsersRelatedPost(postType) ? addedUsername || removedUsername : '';
        const prevPost = userActivities[userActivities.length - 1];
        const isSamePostType = prevPost && prevPost.postType === post.type;
        const isSameActor = prevPost && prevPost.actorId[0] === post.user_id;
        const isJoinedPrevPost = prevPost && prevPost.postType === Posts.POST_TYPES.JOIN_CHANNEL;
        const isLeftCurrentPost = post.type === Posts.POST_TYPES.LEAVE_CHANNEL;
        const prePrevPost = userActivities[userActivities.length - 2];
        const isJoinedPrePrevPost = prePrevPost && prePrevPost.postType === Posts.POST_TYPES.JOIN_CHANNEL;
        const isLeftPrevPost = prevPost && prevPost.postType === Posts.POST_TYPES.LEAVE_CHANNEL;

        if (prevPost && isSamePostType && (isSameActor || isRemovedPost)) {
            prevPost.userIds.push(userId);
            prevPost.usernames.push(username);
        } else if (isSamePostType && !isSameActor && !isUsersRelatedPost(postType)) {
            prevPost.actorId.push(actorId);
            const isSameActors = (prePrevPost && isSameActorsInUserActivities(prePrevPost, prevPost));
            if (isJoinedPrePrevPost && isLeftPrevPost && isSameActors) {
                userActivities.pop();
                prePrevPost.postType = Posts.POST_TYPES.JOIN_LEAVE_CHANNEL;
                mergeLastSimilarPosts(userActivities);
            }
        } else if (isJoinedPrevPost && isLeftCurrentPost && prevPost.actorId.length === 1 && isSameActor) {
            prevPost.postType = Posts.POST_TYPES.JOIN_LEAVE_CHANNEL;
            mergeLastSimilarPosts(userActivities);
        } else {
            userActivities.push({
                actorId: [actorId],
                userIds: [userId],
                usernames: [username],
                postType,
            });
        }
    });

    return extractUserActivityData(userActivities);
}

export type MessageData = {
    actorId?: string;
    postType: string;
    userIds: string[];
}

function isMessageData(v: unknown): v is MessageData {
    if (typeof v !== 'object' || !v) {
        return false;
    }

    if ('actorId' in v && typeof v.actorId !== 'string') {
        return false;
    }

    if (!('postType' in v) || typeof v.postType !== 'string') {
        return false;
    }

    if (!('userIds' in v) || !isStringArray(v.userIds)) {
        return false;
    }

    return true;
}

type UserActivityProp = {
    allUserIds: string[];
    allUsernames: string[];
    messageData: MessageData[];
}

export function isUserActivityProp(v: unknown): v is UserActivityProp {
    if (typeof v !== 'object' || !v) {
        return false;
    }

    if (!('allUserIds' in v) || !isStringArray(v.allUserIds)) {
        return false;
    }

    if (!('allUsernames' in v) || !isStringArray(v.allUsernames)) {
        return false;
    }

    if (!('messageData' in v) || !isArrayOf(v.messageData, isMessageData)) {
        return false;
    }

    return true;
}
