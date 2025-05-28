// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';
import type {
    MessageHistory,
    OpenGraphMetadata,
    Post,
    PostAcknowledgement,
    PostOrderBlock,
} from '@mattermost/types/posts';
import type {Reaction} from '@mattermost/types/reactions';
import type {GlobalState} from '@mattermost/types/store';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';
import type {
    RelationOneToOne,
    RelationOneToMany,
} from '@mattermost/types/utilities';

import {General, Posts, Preferences} from 'mattermost-redux/constants';
import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentChannelId, getCurrentUser} from 'mattermost-redux/selectors/entities/common';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getBool, shouldShowJoinLeaveMessages} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getUsers, getCurrentUserId, getUserStatuses} from 'mattermost-redux/selectors/entities/users';
import {createIdsSelector} from 'mattermost-redux/utils/helpers';
import {
    isPostEphemeral,
    isSystemMessage,
    shouldFilterJoinLeavePost,
    comparePosts,
    isPostPendingOrFailed,
    isPostCommentMention,
} from 'mattermost-redux/utils/post_utils';
import {isGuest} from 'mattermost-redux/utils/user_utils';

export function getAllPosts(state: GlobalState) {
    return state.entities.posts.posts;
}

export type UserActivityPost = Post & {
    system_post_ids: string[];
    user_activity_posts: Post[];
}

export function getPost(state: GlobalState, postId: Post['id']): Post {
    return getAllPosts(state)[postId];
}

export function isPostFlagged(state: GlobalState, postId: Post['id']): boolean {
    return getBool(state, Preferences.CATEGORY_FLAGGED_POST, postId);
}

export function getPostRepliesCount(state: GlobalState, postId: Post['id']): number {
    return state.entities.posts.postsReplies[postId] || 0;
}

export function getPostsInThread(state: GlobalState): RelationOneToMany<Post, Post> {
    return state.entities.posts.postsInThread;
}

export function getPostsInThreadOrdered(state: GlobalState, rootId: string): string[] {
    const postIds = getPostsInThread(state)[rootId];
    if (!postIds) {
        return [rootId];
    }

    const allPosts = getAllPosts(state);
    const threadPosts = postIds.map((v) => allPosts[v]).filter((v) => v);
    const sortedPosts = threadPosts.sort(comparePosts);
    return [...sortedPosts.map((v) => v.id), rootId];
}

export function getReactionsForPosts(state: GlobalState): RelationOneToOne<Post, {
    [x: string]: Reaction;
}> {
    return state.entities.posts.reactions;
}

export function makeGetReactionsForPost(): (state: GlobalState, postId: Post['id']) => {
    [x: string]: Reaction;
} | undefined {
    return createSelector('makeGetReactionsForPost', getReactionsForPosts, (state: GlobalState, postId: string) => postId, (reactions, postId) => {
        if (reactions[postId]) {
            return reactions[postId];
        }

        return undefined;
    });
}

export function getHasReactions(state: GlobalState, postId: Post['id']): boolean {
    const reactions = getReactionsForPosts(state)?.[postId] || {};
    return Object.keys(reactions).length > 0;
}

export function getOpenGraphMetadata(state: GlobalState): RelationOneToOne<Post, Record<string, OpenGraphMetadata>> {
    return state.entities.posts.openGraph;
}

export function getOpenGraphMetadataForUrl(state: GlobalState, postId: string, url: string) {
    const openGraphForPost = state.entities.posts.openGraph[postId];
    return openGraphForPost ? openGraphForPost[url] : undefined;
}

// getPostIdsInCurrentChannel returns the IDs of posts loaded at the bottom of the channel. It does not include older
// posts such as those loaded by viewing a thread or a permalink.
export function getPostIdsInCurrentChannel(state: GlobalState): Array<Post['id']> | undefined | null {
    return getPostIdsInChannel(state, state.entities.channels.currentChannelId);
}

export function makeGetPostIdsForThread(): (state: GlobalState, postId: Post['id']) => Array<Post['id']> {
    const getPostsForThread = makeGetPostsForThread();

    return createIdsSelector(
        'makeGetPostIdsForThread',
        (state: GlobalState, rootId: Post['id']) => getPostsForThread(state, rootId),
        (posts) => {
            return posts.map((post) => post.id);
        },
    );
}

export function makeGetPostsChunkAroundPost(): (state: GlobalState, postId: Post['id'], channelId: Channel['id']) => PostOrderBlock| null | undefined {
    return createIdsSelector(
        'makeGetPostsChunkAroundPost',
        (state: GlobalState, postId: string, channelId: string) => state.entities.posts.postsInChannel[channelId],
        (state: GlobalState, postId) => postId,
        (postsForChannel, postId) => {
            if (!postsForChannel) {
                return null;
            }

            let postChunk;

            for (const block of postsForChannel) {
                const index = block.order.indexOf(postId);

                if (index === -1) {
                    continue;
                }

                postChunk = block;
            }

            return postChunk;
        },
    );
}

function isPostInteractable(post: Post | undefined) {
    return post &&
        !post.delete_at &&
        !isPostEphemeral(post) &&
        !isSystemMessage(post) &&
        !isPostPendingOrFailed(post) &&
        post.state !== Posts.POST_DELETED;
}

export function getLatestInteractablePostId(state: GlobalState, channelId: string, rootId = '') {
    const postsIds = rootId ? getPostsInThreadOrdered(state, rootId) : getPostIdsInChannel(state, channelId);
    if (!postsIds) {
        return '';
    }

    const allPosts = getAllPosts(state);

    for (const postId of postsIds) {
        if (!isPostInteractable(allPosts[postId])) {
            continue;
        }
        return postId;
    }

    return '';
}

export function getLatestPostToEdit(state: GlobalState, channelId: string, rootId = '') {
    const postsIds = rootId ? getPostsInThreadOrdered(state, rootId) : getPostIdsInChannel(state, channelId);
    if (!postsIds) {
        return '';
    }

    if (rootId) {
        postsIds.push(rootId);
    }

    const allPosts = getAllPosts(state);
    const currentUserId = getCurrentUserId(state);

    for (const postId of postsIds) {
        const post = allPosts[postId];
        if (post?.user_id !== currentUserId || !isPostInteractable(post)) {
            continue;
        }

        return post.id;
    }

    return '';
}

export const getLatestReplyablePostId: (state: GlobalState) => Post['id'] = (state) => getLatestInteractablePostId(state, getCurrentChannelId(state));

// getPostsInCurrentChannel returns an array of all recent posts loaded at the bottom of the given channel.
// It does not include older posts such as those loaded by viewing a thread or a permalink.
export const getPostsInCurrentChannel: (state: GlobalState) => Post[] | undefined | null = createSelector(
    'getPostsInCurrentChannel',
    getAllPosts,
    getPostIdsInCurrentChannel,
    getCurrentUser,
    shouldShowJoinLeaveMessages,
    (allPosts, postIds, currentUser, showJoinLeave) => {
        if (!postIds) {
            return null;
        }

        const posts: Post[] = [];

        for (let i = 0; i < postIds.length; i++) {
            const post = allPosts[postIds[i]];

            if (!post || shouldFilterJoinLeavePost(post, showJoinLeave, currentUser ? currentUser.username : '')) {
                continue;
            }

            posts.push(post);
        }

        return posts;
    },
);

// Returns a function that creates a creates a selector that will get the posts for a given thread.
// That selector will take a props object (containing a rootId field) as its
// only argument and will be memoized based on that argument.

export function makeGetPostsForThread(): (state: GlobalState, rootId: string) => Post[] {
    return createIdsSelector(
        'makeGetPostsForThread',
        getAllPosts,
        getCurrentUser,
        (state: GlobalState, rootId: string) => state.entities.posts.postsInThread[rootId],
        (state: GlobalState, rootId: string) => state.entities.posts.posts[rootId],
        shouldShowJoinLeaveMessages,
        (posts, currentUser, postsForThread, rootPost, showJoinLeave) => {
            const thread: Post[] = [];

            if (rootPost) {
                thread.push(rootPost);
            }

            if (postsForThread && Array.isArray(postsForThread) && postsForThread.length > 0) {
                for (const postId of postsForThread) {
                    const post = posts[postId];
                    if (!post) {
                        continue;
                    }

                    const skip = shouldFilterJoinLeavePost(post, showJoinLeave, currentUser ? currentUser.username : '');
                    if (!skip) {
                        thread.push(post);
                    }
                }
            }

            thread.sort(comparePosts);
            return thread;
        },
    );
}

// The selector below filters current user if it exists. Excluding currentUser is just for convenience
export function makeGetProfilesForThread(): (state: GlobalState, rootId: string) => UserProfile[] {
    const getPostsForThread = makeGetPostsForThread();
    return createSelector(
        'makeGetProfilesForThread',
        getUsers,
        getCurrentUserId,
        getPostsForThread,
        getUserStatuses,
        (allUsers, currentUserId, posts, userStatuses) => {
            const profileIds = posts.map((post) => post.user_id).filter(Boolean);
            const uniqueIds = [...new Set(profileIds)];
            return uniqueIds.reduce((acc: UserProfile[], id: string) => {
                const profile: UserProfile = userStatuses ? {...allUsers[id], status: userStatuses[id]} : {...allUsers[id]};

                if (profile && Object.keys(profile).length > 0 && currentUserId !== id) {
                    return [
                        ...acc,
                        profile,
                    ];
                }
                return acc;
            }, []);
        },
    );
}

export function makeGetCommentCountForPost(): (state: GlobalState, post: Post) => number {
    return createSelector(
        'makeGetCommentCountForPost',
        getAllPosts,
        (state: GlobalState, post: Post) => state.entities.posts.postsInThread[post ? post.root_id || post.id : ''] || null,
        (state, post: Post) => post,
        (posts, postsForThread, post) => {
            if (!post) {
                return 0;
            }

            if (!postsForThread) {
                return post.reply_count;
            }

            let count = 0;
            postsForThread.forEach((id) => {
                const post = posts[id];
                if (post && post.state !== Posts.POST_DELETED && !isPostEphemeral(post)) {
                    count += 1;
                }
            });
            return count;
        },
    );
}

export const getSearchResults: (state: GlobalState) => Post[] = createSelector(
    'getSearchResults',
    getAllPosts,
    (state: GlobalState) => state.entities.search.results,
    (posts, postIds) => {
        if (!postIds) {
            return [];
        }

        return postIds.map((id) => posts[id]);
    },
);

// Returns the matched text from the search results, if the server has provided them.
// These matches will only be present if the server is running Mattermost 5.1 or higher
// with Elasticsearch enabled to search posts. Otherwise, null will be returned.
export function getSearchMatches(state: GlobalState): {
    [x: string]: string[];
} {
    return state.entities.search.matches;
}

export function makeGetMessageInHistoryItem(type: 'post'|'comment'): (state: GlobalState) => string {
    return createSelector(
        'makeGetMessageInHistoryItem',
        (state: GlobalState) => state.entities.posts.messagesHistory,
        (messagesHistory: MessageHistory) => {
            const idx = messagesHistory.index[type];
            const messages = messagesHistory.messages;
            if (idx >= 0 && messages && messages.length > idx) {
                return messages[idx];
            }
            return '';
        },
    );
}

export function makeGetPostsForIds(): (state: GlobalState, postIds: Array<Post['id']>) => Post[] {
    return createIdsSelector(
        'makeGetPostsForIds',
        getAllPosts,
        (state: GlobalState, postIds: Array<Post['id']>) => postIds,
        (allPosts, postIds) => {
            if (!postIds) {
                return [];
            }

            return postIds.map((id) => allPosts[id]);
        },
    );
}

export const getMostRecentPostIdInChannel: (state: GlobalState, channelId: Channel['id']) => Post['id'] | undefined | null = createSelector(
    'getMostRecentPostIdInChannel',
    getAllPosts,
    (state: GlobalState, channelId: string) => getPostIdsInChannel(state, channelId),
    shouldShowJoinLeaveMessages,
    (posts, postIdsInChannel, allowSystemMessages) => {
        if (!postIdsInChannel) {
            return '';
        }

        if (!allowSystemMessages) {
            // return the most recent non-system message in the channel
            let postId;
            for (let i = 0; i < postIdsInChannel.length; i++) {
                const p = posts[postIdsInChannel[i]];
                if (!p.type || !p.type.startsWith(Posts.SYSTEM_MESSAGE_PREFIX)) {
                    postId = p.id;
                    break;
                }
            }
            return postId;
        }

        // return the most recent message in the channel
        return postIdsInChannel[0];
    },
);

export function getRecentPostsChunkInChannel(state: GlobalState, channelId: Channel['id']): PostOrderBlock | null | undefined {
    const postsForChannel = state.entities.posts.postsInChannel[channelId];

    if (!postsForChannel) {
        return null;
    }

    return postsForChannel.find((block) => block.recent);
}

export function getOldestPostsChunkInChannel(state: GlobalState, channelId: Channel['id']): PostOrderBlock | null | undefined {
    const postsForChannel = state.entities.posts.postsInChannel[channelId];

    if (!postsForChannel) {
        return null;
    }

    return postsForChannel.find((block) => block.oldest);
}

// returns timestamp of the channel's oldest post. 0 otherwise
export function getOldestPostTimeInChannel(state: GlobalState, channelId: Channel['id']): number {
    const postsForChannel = state.entities.posts.postsInChannel[channelId];

    if (!postsForChannel) {
        return 0;
    }

    const allPosts = getAllPosts(state);
    const oldestPostTime = postsForChannel.reduce((acc: number, postBlock) => {
        if (postBlock.order.length > 0) {
            const oldestPostIdInBlock = postBlock.order[postBlock.order.length - 1];
            const blockOldestPostTime = allPosts[oldestPostIdInBlock]?.create_at;
            if (typeof blockOldestPostTime === 'number' && blockOldestPostTime < acc) {
                return blockOldestPostTime;
            }
        }
        return acc;
    }, Number.MAX_SAFE_INTEGER);
    if (oldestPostTime === Number.MAX_SAFE_INTEGER) {
        return 0;
    }
    return oldestPostTime;
}

// getPostIdsInChannel returns the IDs of posts loaded at the bottom of the given channel. It does not include older
// posts such as those loaded by viewing a thread or a permalink.
export function getPostIdsInChannel(state: GlobalState, channelId: Channel['id']): Array<Post['id']> | undefined | null {
    const recentBlock = getRecentPostsChunkInChannel(state, channelId);

    if (!recentBlock) {
        return null;
    }

    return recentBlock.order;
}

export function getPostsChunkInChannelAroundTime(state: GlobalState, channelId: Channel['id'], timeStamp: number): PostOrderBlock | undefined | null {
    const postsEntity = state.entities.posts;
    const postsForChannel = postsEntity.postsInChannel[channelId];
    const posts = postsEntity.posts;
    if (!postsForChannel) {
        return null;
    }

    const blockAroundTimestamp = postsForChannel.find((block) => {
        const {order} = block;
        const recentPostInBlock = posts[order[0]];
        const oldestPostInBlock = posts[order[order.length - 1]];
        if (recentPostInBlock && oldestPostInBlock) {
            return (recentPostInBlock.create_at >= timeStamp && oldestPostInBlock.create_at <= timeStamp);
        }
        return false;
    });

    return blockAroundTimestamp;
}

export function getUnreadPostsChunk(state: GlobalState, channelId: Channel['id'], timeStamp: number): PostOrderBlock | undefined | null {
    const postsEntity = state.entities.posts;
    const posts = postsEntity.posts;
    const recentChunk = getRecentPostsChunkInChannel(state, channelId);

    /* 1. lastViewedAt can be greater than the most recent chunk in case of edited posts etc.
          * return if recent block exists and oldest post is created after the last lastViewedAt timestamp
          i.e all posts are read and the lastViewedAt is greater than the last post

       2. lastViewedAt can be less than the first post in a channel if all the last viewed posts are deleted
          * return if oldest block exist and oldest post created_at is greater than the last viewed post
          i.e all posts are unread so the lastViewedAt is lessthan the first post

      The above two exceptions are added because we cannot select the chunk based on timestamp alone as these cases are out of bounds

      3. Normal cases where there are few unreads and few reads in a chunk as that is how unread API returns data
          * return getPostsChunkInChannelAroundTime
    */

    if (recentChunk) {
        // This would happen if there are no posts in channel.
        // If the system messages are deleted by sys admin.
        // Experimental changes like hiding Join/Leave still will have recent chunk so it follows the default path based on timestamp
        if (!recentChunk.order.length) {
            return recentChunk;
        }

        const {order} = recentChunk;
        const oldestPostInBlock = posts[order[order.length - 1]];

        // check for only oldest posts because this can be higher than the latest post if the last post is edited
        if (oldestPostInBlock.create_at <= timeStamp) {
            return recentChunk;
        }
    }

    const oldestPostsChunk = getOldestPostsChunkInChannel(state, channelId);

    if (oldestPostsChunk && oldestPostsChunk.order.length) {
        const {order} = oldestPostsChunk;
        const oldestPostInBlock = posts[order[order.length - 1]];

        if (oldestPostInBlock.create_at >= timeStamp) {
            return oldestPostsChunk;
        }
    }

    return getPostsChunkInChannelAroundTime(state, channelId, timeStamp);
}

export const isPostsChunkIncludingUnreadsPosts = (state: GlobalState, chunk: PostOrderBlock, timeStamp: number): boolean => {
    const postsEntity = state.entities.posts;
    const posts = postsEntity.posts;

    if (!chunk || !chunk.order.length) {
        return false;
    }

    const {order} = chunk;
    const oldestPostInBlock = posts[order[order.length - 1]];

    return oldestPostInBlock.create_at <= timeStamp;
};

export const isPostIdSending = (state: GlobalState, postId: Post['id']): boolean => {
    return state.entities.posts.pendingPostIds.some((sendingPostId) => sendingPostId === postId);
};

export const makeIsPostCommentMention = (): ((state: GlobalState, postId: Post['id']) => boolean) => {
    return createSelector(
        'makeIsPostCommentMention',
        getAllPosts,
        getPostsInThread,
        getCurrentUser,
        getPost,
        (allPosts, postsInThread, currentUser, post) => {
            if (!post) {
                return false;
            }

            let threadRepliedToByCurrentUser = false;
            let isCommentMention = false;
            if (currentUser) {
                const rootId = post.root_id || post.id;
                const threadIds = postsInThread[rootId] || [];

                for (const pid of threadIds) {
                    const p = allPosts[pid];
                    if (!p) {
                        continue;
                    }

                    if (p.user_id === currentUser.id) {
                        threadRepliedToByCurrentUser = true;
                    }
                }

                const rootPost = allPosts[rootId];

                isCommentMention = isPostCommentMention({post, currentUser, threadRepliedToByCurrentUser, rootPost});
            }

            return isCommentMention;
        },
    );
};

export function getLimitedViews(state: GlobalState): GlobalState['entities']['posts']['limitedViews'] {
    return state.entities.posts.limitedViews;
}

export function isPostPriorityEnabled(state: GlobalState) {
    return getConfig(state).PostPriority === 'true';
}

export function isPostAcknowledgementsEnabled(state: GlobalState) {
    return (
        isPostPriorityEnabled(state) &&
        getConfig(state).PostAcknowledgements === 'true'
    );
}

export function getAllowPersistentNotifications(state: GlobalState) {
    return (
        isPostPriorityEnabled(state) &&
        getConfig(state).AllowPersistentNotifications === 'true'
    );
}

export function getPersistentNotificationMaxRecipients(state: GlobalState) {
    return getConfig(state).PersistentNotificationMaxRecipients;
}

export function getPersistentNotificationIntervalMinutes(state: GlobalState) {
    return getConfig(state).PersistentNotificationIntervalMinutes;
}

export function getAllowPersistentNotificationsForGuests(state: GlobalState) {
    return (
        isPostPriorityEnabled(state) &&
        getConfig(state).AllowPersistentNotificationsForGuests === 'true'
    );
}

export function getPostAcknowledgements(state: GlobalState, postId: Post['id']): Record<UserProfile['id'], PostAcknowledgement['acknowledged_at']> {
    return state.entities.posts.acknowledgements[postId];
}

export const isPersistentNotificationsEnabled = createSelector(
    'getPersistentNotificationsEnabled',
    getCurrentUser,
    getAllowPersistentNotifications,
    getAllowPersistentNotificationsForGuests,
    (user, forAll, forGuests) => (isGuest(user.roles) ? (forAll && forGuests) : forAll),
);

export function makeGetPostAcknowledgementsWithProfiles(): (state: GlobalState, postId: Post['id']) => Array<{user: UserProfile; acknowledgedAt: PostAcknowledgement['acknowledged_at']}> {
    return createSelector(
        'makeGetPostAcknowledgementsWithProfiles',
        getUsers,
        getPostAcknowledgements,
        (users, acknowledgements) => {
            if (!acknowledgements) {
                return [];
            }
            return Object.keys(acknowledgements).flatMap((userId) => {
                if (!users[userId]) {
                    return [];
                }
                return {
                    user: users[userId],
                    acknowledgedAt: acknowledgements[userId],
                };
            }).sort((a, b) => b.acknowledgedAt - a.acknowledgedAt);
        },
    );
}

export function getTeamIdFromPost(state: GlobalState, post: Post): Team['id'] | undefined {
    const channel = getChannel(state, post.channel_id);

    if (!channel) {
        return undefined;
    }

    if (channel.type === General.DM_CHANNEL || channel.type === General.GM_CHANNEL) {
        return getCurrentTeamId(state);
    }

    return channel.team_id;
}
