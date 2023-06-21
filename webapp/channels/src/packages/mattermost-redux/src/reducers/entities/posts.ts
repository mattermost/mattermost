// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ChannelTypes, GeneralTypes, PostTypes, UserTypes, ThreadTypes, InsightTypes, CloudTypes} from 'mattermost-redux/action_types';

import {comparePosts, isPermalink, shouldUpdatePost} from 'mattermost-redux/utils/post_utils';
import {Posts} from 'mattermost-redux/constants';
import {PostTypes as PostConstant} from 'mattermost-redux/constants/posts';

import {GenericAction} from 'mattermost-redux/types/actions';

import {
    OpenGraphMetadata,
    Post,
    PostsState,
    PostOrderBlock,
    MessageHistory,
    PostAcknowledgement,
    PostEmbed,
    PostPreviewMetadata,
} from '@mattermost/types/posts';
import {UserProfile} from '@mattermost/types/users';
import {Reaction} from '@mattermost/types/reactions';
import {
    RelationOneToOne,
    IDMappedObjects,
    RelationOneToMany,
} from '@mattermost/types/utilities';

import {TopThread} from '@mattermost/types/insights';

export function removeUnneededMetadata(post: Post) {
    if (!post.metadata) {
        return post;
    }

    const metadata = {...post.metadata};
    let changed = false;

    // These fields are stored separately
    if (metadata.emojis) {
        Reflect.deleteProperty(metadata, 'emojis');
        changed = true;
    }

    if (metadata.files) {
        Reflect.deleteProperty(metadata, 'files');
        changed = true;
    }

    if (metadata.reactions) {
        Reflect.deleteProperty(metadata, 'reactions');
        changed = true;
    }

    if (metadata.reactions) {
        Reflect.deleteProperty(metadata, 'acknowledgements');
        changed = true;
    }

    if (metadata.embeds) {
        let embedsChanged = false;

        const newEmbeds = metadata.embeds.map((embed) => {
            switch (embed.type) {
            case 'opengraph': {
                const newEmbed = {...embed};
                Reflect.deleteProperty(newEmbed, 'data');

                embedsChanged = true;

                return newEmbed;
            }
            case 'permalink': {
                const permalinkEmbed = {...embed};
                if (permalinkEmbed.data) {
                    Reflect.deleteProperty(permalinkEmbed.data, 'post');
                }
                embedsChanged = true;

                return permalinkEmbed;
            }
            default:
                return embed;
            }
        });

        if (embedsChanged) {
            metadata.embeds = newEmbeds;
            changed = true;
        }
    }

    if (!changed) {
        // Nothing changed
        return post;
    }

    return {
        ...post,
        metadata,
    };
}

export function nextPostsReplies(state: {[x in Post['id']]: number} = {}, action: GenericAction) {
    switch (action.type) {
    case PostTypes.RECEIVED_POST:
    case PostTypes.RECEIVED_NEW_POST: {
        const post = action.data;
        if (!post.id || !post.root_id || !post.reply_count) {
            // Ignoring pending posts and root posts
            return state;
        }

        const newState = {...state};
        newState[post.root_id] = post.reply_count;
        return newState;
    }

    case PostTypes.RECEIVED_POSTS: {
        const posts = Object.values(action.data.posts) as Post[];

        if (posts.length === 0) {
            return state;
        }

        const nextState = {...state};

        for (const post of posts) {
            if (post.root_id) {
                nextState[post.root_id] = post.reply_count;
            } else {
                nextState[post.id] = post.reply_count;
            }
        }

        return nextState;
    }

    case PostTypes.POST_DELETED: {
        const post: Post = action.data;

        if (!state[post.root_id] && !state[post.id]) {
            return state;
        }

        const nextState = {...state};
        if (post.root_id && state[post.root_id]) {
            nextState[post.root_id] -= 1;
        }
        if (!post.root_id && state[post.id]) {
            Reflect.deleteProperty(nextState, post.id);
        }

        return nextState;
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

export function handlePosts(state: RelationOneToOne<Post, Post> = {}, action: GenericAction) {
    switch (action.type) {
    case PostTypes.RECEIVED_POST:
    case PostTypes.RECEIVED_NEW_POST: {
        return handlePostReceived({...state}, action.data);
    }

    case PostTypes.RECEIVED_POSTS: {
        const posts = Object.values(action.data.posts) as Post[];

        if (posts.length === 0) {
            return state;
        }

        const nextState = {...state};

        for (const post of posts) {
            handlePostReceived(nextState, post);
        }

        return nextState;
    }

    case PostTypes.POST_DELETED: {
        const post: Post = action.data;

        if (!state[post.id]) {
            return state;
        }

        // Mark the post as deleted
        const nextState = {
            ...state,
            [post.id]: {
                ...state[post.id],
                state: Posts.POST_DELETED,
                file_ids: [],
                has_reactions: false,
            },
        };

        for (const otherPost of Object.values(state)) {
            // Remove any of its comments
            if (otherPost.root_id === post.id) {
                Reflect.deleteProperty(nextState, otherPost.id);
            }

            // a deleted post may exist in some other post's
            // embeds when its link is mentioned in the post message.
            // We need to remove the deleted post from post embeds of all posts
            // to ensure the deleted post's contents cannot be retrieved from the store.
            if (otherPost.metadata && otherPost.metadata.embeds && otherPost.metadata.embeds.length > 0) {
                // This will become the post's new embeds array.
                // We'll add everything other than the deleted post's embed here.
                const newEmbeds: PostEmbed[] = [];

                for (const embed of otherPost.metadata.embeds) {
                    if (embed.type === 'permalink' && embed.data && !('post_id' in embed.data)) {
                        console.error('post_id missing in post embed data for permalink.');
                        console.error(embed.data);
                    }

                    if (embed.type === 'permalink' && (embed.data as PostPreviewMetadata).post_id === post.id) {
                        // skip if the embed is the deleted post
                        continue;
                    }

                    // include everything else
                    newEmbeds.push(embed);
                }

                // if newEmbeds changed, update post's embeds
                if (newEmbeds.length !== otherPost.metadata.embeds.length) {
                    // Since otherPost refers to the post from store, its frozen un immutable.
                    // That's why cloning it and modifying required parts here.
                    nextState[otherPost.id] = {
                        ...nextState[otherPost.id],
                        metadata: {
                            ...nextState[otherPost.id].metadata,
                            embeds: newEmbeds,
                        },
                    };
                }
            }
        }

        return nextState;
    }

    case PostTypes.POST_REMOVED: {
        const post = action.data;

        if (!state[post.id]) {
            return state;
        }

        // Remove the post itself
        const nextState = {...state};
        Reflect.deleteProperty(nextState, post.id);

        // Remove any of its comments
        for (const otherPost of Object.values(state)) {
            if (otherPost.root_id === post.id) {
                Reflect.deleteProperty(nextState, otherPost.id);
            }
        }

        return nextState;
    }

    case ChannelTypes.RECEIVED_CHANNEL_DELETED:
    case ChannelTypes.DELETE_CHANNEL_SUCCESS:
    case ChannelTypes.LEAVE_CHANNEL: {
        if (action.data && action.data.viewArchivedChannels) {
            // Nothing to do since we still want to store posts in archived channels
            return state;
        }

        const channelId = action.data.id;

        let postDeleted = false;

        // Remove any posts in the deleted channel
        const nextState = {...state};
        for (const post of Object.values(state)) {
            if (post.channel_id === channelId) {
                Reflect.deleteProperty(nextState, post.id);
                postDeleted = true;
            }
        }

        if (!postDeleted) {
            // Nothing changed
            return state;
        }

        return nextState;
    }

    case ThreadTypes.FOLLOW_CHANGED_THREAD: {
        const {id, following} = action.data;
        const post = state[id];
        return {
            ...state,
            [id]: {
                ...post,
                is_following: following,
            },
        };
    }

    case InsightTypes.RECEIVED_TOP_THREADS:
    case InsightTypes.RECEIVED_MY_TOP_THREADS: {
        const topThreads = Object.values(action.data.items) as TopThread[];

        if (topThreads.length === 0) {
            return state;
        }

        const nextState = {...state};

        for (const thread of topThreads) {
            handlePostReceived(nextState, thread.post);
        }

        return nextState;
    }

    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function handlePostReceived(nextState: any, post: Post, nestedPermalinkLevel?: number) {
    let currentState = nextState;

    // Check if post already exists in state or if nested permalink
    if (!shouldUpdatePost(post, currentState[post.id]) || (nestedPermalinkLevel && nestedPermalinkLevel > 1)) {
        return currentState;
    }

    // If post is a permalink and not nested (it links directly to the original message),
    // and is missing embedded metadata, then update state with new post metadata
    if (!nestedPermalinkLevel && isPermalink(post) && currentState[post.id] && !currentState[post.id].metadata && post.metadata) {
        currentState[post.id] = {...currentState[post.id], ...post.metadata};
    }

    // Edited posts that don't have 'is_following' specified should maintain 'is_following' state
    if (post.update_at > 0 && post.is_following == null && currentState[post.id]) {
        post.is_following = currentState[post.id].is_following;
    }

    if (post.delete_at > 0) {
        // We've received a deleted post, so mark the post as deleted if we already have it
        if (currentState[post.id]) {
            currentState[post.id] = {
                ...removeUnneededMetadata(post),
                state: Posts.POST_DELETED,
                file_ids: [],
                has_reactions: false,
            };
        }
    } else if (post.metadata && post.metadata.embeds) {
        post.metadata.embeds.forEach((embed) => {
            if (embed.type === 'permalink') {
                if (embed.data && 'post_id' in embed.data && embed.data.post) {
                    currentState = handlePostReceived(currentState, embed.data.post, nestedPermalinkLevel ? nestedPermalinkLevel + 1 : 1);

                    if (isPermalink(embed.data.post)) {
                        currentState[post.id] = removeUnneededMetadata(post);
                    }
                }
            }
        });

        currentState[post.id] = post;
    } else {
        currentState[post.id] = removeUnneededMetadata(post);
    }

    // Delete any pending post that existed for this post
    if (post.pending_post_id && post.id !== post.pending_post_id && currentState[post.pending_post_id]) {
        Reflect.deleteProperty(currentState, post.pending_post_id);
    }

    const rootPost: Post = currentState[post.root_id];
    if (post.root_id && rootPost) {
        const participants = rootPost.participants || [];
        const nextRootPost = {...rootPost};
        if (!participants.find((user: UserProfile) => user.id === post.user_id)) {
            nextRootPost.participants = [...participants, {id: post.user_id}];
        }

        if (post.reply_count) {
            nextRootPost.reply_count = post.reply_count;
        }

        currentState[post.root_id] = nextRootPost;
    }

    return currentState;
}

export function handlePendingPosts(state: string[] = [], action: GenericAction) {
    switch (action.type) {
    case PostTypes.RECEIVED_NEW_POST: {
        const post = action.data;

        if (!post.pending_post_id) {
            // This is not a pending post
            return state;
        }

        const index = state.indexOf(post.pending_post_id);

        if (index !== -1) {
            // An entry already exists for this post
            return state;
        }

        // Add the new pending post ID
        const nextState = [...state];
        nextState.push(post.pending_post_id);

        return nextState;
    }
    case PostTypes.POST_REMOVED: {
        const post = action.data;

        const index = state.indexOf(post.id);

        if (index === -1) {
            // There's nothing to remove
            return state;
        }

        // The post has been removed, so remove the entry for it
        const nextState = [...state];
        nextState.splice(index, 1);

        return nextState;
    }
    case PostTypes.RECEIVED_POST: {
        const post = action.data;

        if (!post.pending_post_id) {
            // This isn't a pending post
            return state;
        }

        const index = state.indexOf(post.pending_post_id);

        if (index === -1) {
            // There's nothing to remove
            return state;
        }

        // The post has actually been created, so remove the entry for it
        const nextState = [...state];
        nextState.splice(index, 1);

        return nextState;
    }

    default:
        return state;
    }
}

export function postsInChannel(state: Record<string, PostOrderBlock[]> = {}, action: GenericAction, prevPosts: IDMappedObjects<Post>, nextPosts: Record<string, Post>) {
    switch (action.type) {
    case PostTypes.RESET_POSTS_IN_CHANNEL: {
        return {};
    }
    case PostTypes.RECEIVED_NEW_POST: {
        const post = action.data as Post;

        if (action.features?.crtEnabled && post.root_id && post.type !== PostConstant.EPHEMERAL) {
            return state;
        }

        const postsForChannel = state[post.channel_id];
        if (!postsForChannel) {
            // Don't save newly created posts until the channel has been loaded
            return state;
        }

        const recentBlockIndex = postsForChannel.findIndex((block: PostOrderBlock) => block.recent);

        let nextRecentBlock: PostOrderBlock;
        if (recentBlockIndex === -1) {
            nextRecentBlock = {
                order: [],
                recent: true,
            };
        } else {
            const recentBlock = postsForChannel[recentBlockIndex];
            nextRecentBlock = {
                ...recentBlock,
                order: [...recentBlock.order],
            };
        }

        let changed = false;

        // Add the new post to the channel
        if (!nextRecentBlock.order.includes(post.id)) {
            nextRecentBlock.order.unshift(post.id);
            changed = true;
        }

        // If this is a newly created post, remove any pending post that exists for it
        if (post.pending_post_id && post.id !== post.pending_post_id) {
            const index = nextRecentBlock.order.indexOf(post.pending_post_id);

            if (index !== -1) {
                nextRecentBlock.order.splice(index, 1);

                // Need to re-sort to make sure any other pending posts come first
                nextRecentBlock.order.sort((a, b) => {
                    return comparePosts(nextPosts[a], nextPosts[b]);
                });
                changed = true;
            }
        }

        if (!changed) {
            return state;
        }

        const nextPostsForChannel = [...postsForChannel];

        if (recentBlockIndex === -1) {
            nextPostsForChannel.push(nextRecentBlock);
        } else {
            nextPostsForChannel[recentBlockIndex] = nextRecentBlock;
        }

        return {
            ...state,
            [post.channel_id]: nextPostsForChannel,
        };
    }

    case PostTypes.RECEIVED_POST: {
        const post = action.data;

        if (action.features?.crtEnabled && post.root_id) {
            return state;
        }

        // Receiving a single post doesn't usually affect the order of posts in a channel, except for when we've
        // received a newly created post that was previously stored as pending

        if (!post.pending_post_id) {
            return state;
        }

        const postsForChannel = state[post.channel_id] || [];

        const recentBlockIndex = postsForChannel.findIndex((block: PostOrderBlock) => block.recent);
        if (recentBlockIndex === -1) {
            // Nothing to do since there's no recent block and only the recent block should contain pending posts
            return state;
        }

        const recentBlock = postsForChannel[recentBlockIndex];

        // Replace the pending post with the newly created one
        const index = recentBlock.order.indexOf(post.pending_post_id);
        if (index === -1) {
            // No pending post found to remove
            return state;
        }

        const nextRecentBlock = {
            ...recentBlock,
            order: [...recentBlock.order],
        };

        nextRecentBlock.order[index] = post.id;

        const nextPostsForChannel = [...postsForChannel];
        nextPostsForChannel[recentBlockIndex] = nextRecentBlock;

        return {
            ...state,
            [post.channel_id]: nextPostsForChannel,
        };
    }

    case PostTypes.RECEIVED_POSTS_IN_CHANNEL: {
        const {recent, oldest} = action;
        const order = action.data.order;

        if (order.length === 0 && state[action.channelId]) {
            // No new posts received when we already have posts
            return state;
        }

        const postsForChannel = state[action.channelId] || [];
        let nextPostsForChannel = [...postsForChannel];

        if (recent) {
            // The newly received block is now the most recent, so unmark the current most recent block
            const recentBlockIndex = postsForChannel.findIndex((block: PostOrderBlock) => block.recent);
            if (recentBlockIndex !== -1) {
                const recentBlock = postsForChannel[recentBlockIndex];

                if (recentBlock.order.length === order.length &&
                    recentBlock.order[0] === order[0] &&
                    recentBlock.order[recentBlock.order.length - 1] === order[order.length - 1]) {
                    // The newly received posts are identical to the most recent block, so there's nothing to do
                    return state;
                }

                // Unmark the most recent block since the new posts are more recent
                const nextRecentBlock = {
                    ...recentBlock,
                    recent: false,
                };

                nextPostsForChannel[recentBlockIndex] = nextRecentBlock;
            }
        }

        // Add the new most recent block
        nextPostsForChannel.push({
            order,
            recent,
            oldest,
        });

        // Merge overlapping blocks
        nextPostsForChannel = mergePostBlocks(nextPostsForChannel, nextPosts);

        return {
            ...state,
            [action.channelId]: nextPostsForChannel,
        };
    }

    case PostTypes.RECEIVED_POSTS_AFTER: {
        const order = action.data.order;
        const afterPostId = action.afterPostId;

        if (order.length === 0) {
            // No posts received
            return state;
        }

        const postsForChannel = state[action.channelId] || [];

        // Add a new block including the previous post and then have mergePostBlocks sort out any overlap or duplicates
        const newBlock = {
            order: [...order, afterPostId],
            recent: action.recent,
        };

        let nextPostsForChannel = [...postsForChannel, newBlock];
        nextPostsForChannel = mergePostBlocks(nextPostsForChannel, nextPosts);

        return {
            ...state,
            [action.channelId]: nextPostsForChannel,
        };
    }

    case PostTypes.RECEIVED_POSTS_BEFORE: {
        const {order} = action.data;
        const {beforePostId, oldest} = action;

        if (order.length === 0) {
            // No posts received
            return state;
        }

        const postsForChannel = state[action.channelId] || [];

        // Add a new block including the next post and then have mergePostBlocks sort out any overlap or duplicates
        const newBlock = {
            order: [beforePostId, ...order],
            recent: false,
            oldest,
        };

        let nextPostsForChannel = [...postsForChannel, newBlock];
        nextPostsForChannel = mergePostBlocks(nextPostsForChannel, nextPosts);

        return {
            ...state,
            [action.channelId]: nextPostsForChannel,
        };
    }

    case PostTypes.RECEIVED_POSTS_SINCE: {
        const order = action.data.order;

        if (order.length === 0 && state[action.channelId]) {
            // No new posts received when we already have posts
            return state;
        }

        const postsForChannel = state[action.channelId] || [];

        const recentBlockIndex = postsForChannel.findIndex((block: PostOrderBlock) => block.recent);
        if (recentBlockIndex === -1) {
            // Nothing to do since this shouldn't be dispatched if we haven't loaded the most recent posts yet
            return state;
        }

        const recentBlock = postsForChannel[recentBlockIndex];

        const mostOldestCreateAt = nextPosts[recentBlock.order[recentBlock.order.length - 1]].create_at;

        const nextRecentBlock: PostOrderBlock = {
            ...recentBlock,
            order: [...recentBlock.order],
        };

        // Add any new posts to the most recent block while skipping ones that were only updated
        for (let i = order.length - 1; i >= 0; i--) {
            const postId = order[i];

            if (!nextPosts[postId]) {
                // the post was removed from the list
                continue;
            }

            if (nextPosts[postId].create_at <= mostOldestCreateAt) {
                // This is an old post
                continue;
            }

            if (nextRecentBlock.order.indexOf(postId) !== -1) {
                // This postId exists so no need to add it again
                continue;
            }

            // This post is newer than what we have
            nextRecentBlock.order.unshift(postId);
        }

        if (nextRecentBlock.order.length === recentBlock.order.length) {
            // Nothing was added
            return state;
        }

        nextRecentBlock.order.sort((a, b) => {
            return comparePosts(nextPosts[a], nextPosts[b]);
        });

        const nextPostsForChannel = [...postsForChannel];
        nextPostsForChannel[recentBlockIndex] = nextRecentBlock;

        return {
            ...state,
            [action.channelId]: nextPostsForChannel,
        };
    }

    case PostTypes.POST_DELETED: {
        const post = action.data;

        // Deleting a post removes its comments from the order, but does not remove the post itself

        const postsForChannel = state[post.channel_id] || [];
        if (postsForChannel.length === 0) {
            return state;
        }

        let changed = false;

        let nextPostsForChannel = [...postsForChannel];
        for (let i = 0; i < nextPostsForChannel.length; i++) {
            const block = nextPostsForChannel[i];

            // Remove any comments for this post
            const nextOrder = block.order.filter((postId: string) => prevPosts[postId].root_id !== post.id);

            if (nextOrder.length !== block.order.length) {
                nextPostsForChannel[i] = {
                    ...block,
                    order: nextOrder,
                };

                changed = true;
            }
        }

        if (!changed) {
            // Nothing was removed
            return state;
        }

        nextPostsForChannel = removeNonRecentEmptyPostBlocks(nextPostsForChannel);

        return {
            ...state,
            [post.channel_id]: nextPostsForChannel,
        };
    }

    case PostTypes.POST_REMOVED: {
        const post = action.data;

        // Removing a post removes it as well as its comments

        const postsForChannel = state[post.channel_id] || [];
        if (postsForChannel.length === 0) {
            return state;
        }

        let changed = false;

        // Remove the post and its comments from the channel
        let nextPostsForChannel = [...postsForChannel];
        for (let i = 0; i < nextPostsForChannel.length; i++) {
            const block = nextPostsForChannel[i];

            const nextOrder = block.order.filter((postId: string) => postId !== post.id && prevPosts[postId].root_id !== post.id);

            if (nextOrder.length !== block.order.length) {
                nextPostsForChannel[i] = {
                    ...block,
                    order: nextOrder,
                };

                changed = true;
            }
        }

        if (!changed) {
            // Nothing was removed
            return state;
        }

        nextPostsForChannel = removeNonRecentEmptyPostBlocks(nextPostsForChannel);

        return {
            ...state,
            [post.channel_id]: nextPostsForChannel,
        };
    }

    case ChannelTypes.RECEIVED_CHANNEL_DELETED:
    case ChannelTypes.DELETE_CHANNEL_SUCCESS:
    case ChannelTypes.LEAVE_CHANNEL: {
        if (action.data && action.data.viewArchivedChannels) {
            // Nothing to do since we still want to store posts in archived channels
            return state;
        }

        const channelId = action.data.id;

        if (!state[channelId]) {
            // Nothing to do since we have no posts for this channel
            return state;
        }

        // Remove the entry for the deleted channel
        const nextState = {...state};
        Reflect.deleteProperty(nextState, channelId);

        return nextState;
    }

    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

export function removeNonRecentEmptyPostBlocks(blocks: PostOrderBlock[]) {
    return blocks.filter((block: PostOrderBlock) => block.order.length !== 0 || block.recent);
}

export function mergePostBlocks(blocks: PostOrderBlock[], posts: Record<string, Post>) {
    let nextBlocks = [...blocks];

    // Remove any blocks that may have become empty by removing posts
    nextBlocks = removeNonRecentEmptyPostBlocks(blocks);

    // If a channel does not have any posts(Experimental feature where join and leave messages don't exist)
    // return the previous state i.e an empty block
    if (!nextBlocks.length) {
        return blocks;
    }

    // Sort blocks so that the most recent one comes first
    nextBlocks.sort((a, b) => {
        const aStartsAt = posts[a.order[0]].create_at;
        const bStartsAt = posts[b.order[0]].create_at;

        return bStartsAt - aStartsAt;
    });

    // Merge adjacent blocks
    let i = 0;
    while (i < nextBlocks.length - 1) {
        // Since we know the start of a is more recent than the start of b, they'll overlap if the last post in a is
        // older than the first post in b
        const a = nextBlocks[i];
        const aEndsAt = posts[a.order[a.order.length - 1]].create_at;

        const b = nextBlocks[i + 1];
        const bStartsAt = posts[b.order[0]].create_at;

        if (aEndsAt <= bStartsAt) {
            // The blocks overlap, so combine them and remove the second block
            nextBlocks[i] = {
                order: mergePostOrder(a.order, b.order, posts),
            };

            nextBlocks[i].recent = a.recent || b.recent;
            nextBlocks[i].oldest = a.oldest || b.oldest;

            nextBlocks.splice(i + 1, 1);

            // Do another iteration on this index since it may need to be merged into the next
        } else {
            // The blocks don't overlap, so move on to the next one
            i += 1;
        }
    }

    if (blocks.length === nextBlocks.length) {
        // No changes were made
        return blocks;
    }

    return nextBlocks;
}

export function mergePostOrder(left: string[], right: string[], posts: Record<string, Post>) {
    const result = [...left];

    // Add without duplicates
    const seen = new Set(left);
    for (const id of right) {
        if (seen.has(id)) {
            continue;
        }

        result.push(id);
    }

    if (result.length === left.length) {
        // No new items added
        return left;
    }

    // Re-sort so that the most recent post comes first
    result.sort((a, b) => posts[b].create_at - posts[a].create_at);

    return result;
}

export function postsInThread(state: RelationOneToMany<Post, Post> = {}, action: GenericAction, prevPosts: Record<string, Post>) {
    switch (action.type) {
    case PostTypes.RECEIVED_NEW_POST:
    case PostTypes.RECEIVED_POST: {
        const post = action.data;

        if (!post.root_id) {
            // Only store comments, not the root post
            return state;
        }

        const postsForThread = state[post.root_id] || [];
        const nextPostsForThread = [...postsForThread];

        let changed = false;

        if (!postsForThread.includes(post.id)) {
            nextPostsForThread.push(post.id);
            changed = true;
        }

        // If this is a new non-pending post, remove any pending post that exists for it
        if (post.pending_post_id && post.id !== post.pending_post_id) {
            const index = nextPostsForThread.indexOf(post.pending_post_id);

            if (index !== -1) {
                nextPostsForThread.splice(index, 1);
                changed = true;
            }
        }

        if (!changed) {
            return state;
        }

        return {
            ...state,
            [post.root_id]: nextPostsForThread,
        };
    }

    case PostTypes.RECEIVED_POSTS_AFTER:
    case PostTypes.RECEIVED_POSTS_BEFORE:
    case PostTypes.RECEIVED_POSTS_IN_CHANNEL:
    case PostTypes.RECEIVED_POSTS_SINCE: {
        const newPosts: Post[] = Object.values(action.data.posts);

        if (newPosts.length === 0) {
            // Nothing to add
            return state;
        }

        const nextState: Record<string, string[]> = {};

        for (const post of newPosts) {
            if (!post.root_id) {
                // Only store comments, not the root post
                continue;
            }

            const postsForThread = state[post.root_id] || [];
            const nextPostsForThread = nextState[post.root_id] || [...postsForThread];

            // Add the post to the thread
            if (!nextPostsForThread.includes(post.id)) {
                nextPostsForThread.push(post.id);
            }

            nextState[post.root_id] = nextPostsForThread;
        }

        if (Object.keys(nextState).length === 0) {
            return state;
        }

        return {
            ...state,
            ...nextState,
        };
    }

    case PostTypes.RECEIVED_POSTS_IN_THREAD: {
        const newPosts: Post[] = Object.values(action.data.posts);

        if (newPosts.length === 0) {
            // Nothing to add
            return state;
        }

        const postsForThread = state[action.rootId] || [];
        const nextPostsForThread = [...postsForThread];

        for (const post of newPosts) {
            if (post.root_id !== action.rootId) {
                // Only store comments
                continue;
            }

            if (nextPostsForThread.includes(post.id)) {
                // Don't store duplicates
                continue;
            }

            nextPostsForThread.push(post.id);
        }

        return {
            ...state,
            [action.rootId]: nextPostsForThread,
        };
    }

    case PostTypes.POST_DELETED: {
        const post = action.data;

        const postsForThread = state[post.id];
        if (!postsForThread) {
            // Nothing to remove
            return state;
        }

        const nextState = {...state};
        Reflect.deleteProperty(nextState, post.id);

        return nextState;
    }

    case PostTypes.POST_REMOVED: {
        const post = action.data;

        if (post.root_id) {
            // This is a comment, so remove it from the thread
            const postsForThread = state[post.root_id];
            if (!postsForThread) {
                return state;
            }

            const index = postsForThread.findIndex((postId) => postId === post.id);
            if (index === -1) {
                return state;
            }

            const nextPostsForThread = [...postsForThread];
            nextPostsForThread.splice(index, 1);

            return {
                ...state,
                [post.root_id]: nextPostsForThread,
            };
        }

        // This is not a comment, so remove any comments on it
        const postsForThread = state[post.id];
        if (!postsForThread) {
            return state;
        }

        const nextState = {...state};
        Reflect.deleteProperty(nextState, post.id);

        return nextState;
    }

    case ChannelTypes.RECEIVED_CHANNEL_DELETED:
    case ChannelTypes.DELETE_CHANNEL_SUCCESS:
    case ChannelTypes.LEAVE_CHANNEL: {
        if (action.data && action.data.viewArchivedChannels) {
            // Nothing to do since we still want to store posts in archived channels
            return state;
        }

        const channelId = action.data.id;

        let postDeleted = false;

        // Remove entries for any thread in the channel
        const nextState = {...state};
        for (const rootId of Object.keys(state)) {
            if (prevPosts[rootId] && prevPosts[rootId].channel_id === channelId) {
                Reflect.deleteProperty(nextState, rootId);
                postDeleted = true;
            }
        }

        if (!postDeleted) {
            // Nothing was actually removed
            return state;
        }

        return nextState;
    }

    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function selectedPostId(state = '', action: GenericAction) {
    switch (action.type) {
    case PostTypes.RECEIVED_POST_SELECTED:
        return action.data;
    case UserTypes.LOGOUT_SUCCESS:
        return '';
    default:
        return state;
    }
}

export function postEditHistory(state: Post[] = [], action: GenericAction) {
    switch (action.type) {
    case PostTypes.RECEIVED_POST_HISTORY:
        return action.data;
    case UserTypes.LOGOUT_SUCCESS:
        return [];
    default:
        return state;
    }
}

function currentFocusedPostId(state = '', action: GenericAction) {
    switch (action.type) {
    case PostTypes.RECEIVED_FOCUSED_POST:
        return action.data;
    case UserTypes.LOGOUT_SUCCESS:
        return '';
    default:
        return state;
    }
}

export function reactions(state: RelationOneToOne<Post, Record<string, Reaction>> = {}, action: GenericAction) {
    switch (action.type) {
    case PostTypes.RECEIVED_REACTIONS: {
        const reactionsList = action.data;
        const nextReactions: Record<string, Reaction> = {};
        reactionsList.forEach((reaction: Reaction) => {
            nextReactions[reaction.user_id + '-' + reaction.emoji_name] = reaction;
        });

        return {
            ...state,
            [action.postId!]: nextReactions,
        };
    }
    case PostTypes.RECEIVED_REACTION: {
        const reaction = action.data as Reaction;
        const nextReactions = {...(state[reaction.post_id] || {})};
        nextReactions[reaction.user_id + '-' + reaction.emoji_name] = reaction;

        return {
            ...state,
            [reaction.post_id]: nextReactions,
        };
    }
    case PostTypes.REACTION_DELETED: {
        const reaction = action.data;
        const nextReactions = {...(state[reaction.post_id] || {})};
        if (!nextReactions[reaction.user_id + '-' + reaction.emoji_name]) {
            return state;
        }

        Reflect.deleteProperty(nextReactions, reaction.user_id + '-' + reaction.emoji_name);

        return {
            ...state,
            [reaction.post_id]: nextReactions,
        };
    }

    case PostTypes.RECEIVED_NEW_POST:
    case PostTypes.RECEIVED_POST: {
        const post = action.data;

        return storeReactionsForPost(state, post);
    }

    case PostTypes.RECEIVED_POSTS: {
        const posts: Post[] = Object.values(action.data.posts);

        return posts.reduce(storeReactionsForPost, state);
    }

    case PostTypes.POST_DELETED:
    case PostTypes.POST_REMOVED: {
        const post = action.data;

        if (post && state[post.id]) {
            const nextState = {...state};
            Reflect.deleteProperty(nextState, post.id);

            return nextState;
        }

        return state;
    }

    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

export function acknowledgements(state: RelationOneToOne<Post, Record<UserProfile['id'], number>> = {}, action: GenericAction) {
    switch (action.type) {
    case PostTypes.CREATE_ACK_POST_SUCCESS: {
        const ack = action.data as PostAcknowledgement;
        const oldState = state[ack.post_id] || {};

        return {
            ...state,
            [ack.post_id]: {
                ...oldState,
                [ack.user_id]: ack.acknowledged_at,
            },
        };
    }
    case PostTypes.DELETE_ACK_POST_SUCCESS: {
        const ack = action.data;

        if (!state[ack.post_id] || !state[ack.post_id][ack.user_id]) {
            return state;
        }

        // avoid a race condition
        const acknowledgedAt = state[ack.post_id][ack.user_id];
        if (acknowledgedAt > ack.acknowledged_at) {
            return state;
        }

        const nextState = {...(state[ack.post_id])};
        Reflect.deleteProperty(nextState, ack.user_id);

        return {
            ...state,
            [ack.post_id]: {
                ...nextState,
            },
        };
    }

    case PostTypes.RECEIVED_POST: {
        const post = action.data;

        return storeAcknowledgementsForPost(state, post);
    }

    case PostTypes.RECEIVED_POSTS: {
        const posts: Post[] = Object.values(action.data.posts);

        return posts.reduce(storeAcknowledgementsForPost, state);
    }

    case PostTypes.POST_DELETED:
    case PostTypes.POST_REMOVED: {
        const post = action.data;

        if (post && state[post.id]) {
            const nextState = {...state};
            Reflect.deleteProperty(nextState, post.id);

            return nextState;
        }

        return state;
    }

    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function storeReactionsForPost(state: any, post: Post) {
    if (!post.metadata || !post.metadata.reactions || post.delete_at > 0) {
        return state;
    }

    const reactionsForPost: Record<string, Reaction> = {};
    if (post.metadata.reactions && post.metadata.reactions.length > 0) {
        for (const reaction of post.metadata.reactions) {
            reactionsForPost[reaction.user_id + '-' + reaction.emoji_name] = reaction;
        }
    }

    return {
        ...state,
        [post.id]: reactionsForPost,
    };
}

function storeAcknowledgementsForPost(state: any, post: Post) {
    if (
        !post.metadata ||
        !post.metadata.acknowledgements ||
        !post.metadata.acknowledgements.length ||
        post.delete_at > 0
    ) {
        return state;
    }

    const acknowledgementsForPost: Record<UserProfile['id'], number> = {};
    if (post?.metadata?.acknowledgements && post.metadata.acknowledgements.length > 0) {
        for (const ack of post.metadata.acknowledgements) {
            acknowledgementsForPost[ack.user_id] = ack.acknowledged_at;
        }
    }

    return {
        ...state,
        [post.id]: acknowledgementsForPost,
    };
}

export function openGraph(state: RelationOneToOne<Post, Record<string, OpenGraphMetadata>> = {}, action: GenericAction) {
    switch (action.type) {
    case PostTypes.RECEIVED_OPEN_GRAPH_METADATA: {
        const nextState = {...state};
        nextState[action.url] = action.data;

        return nextState;
    }

    case PostTypes.RECEIVED_NEW_POST:
    case PostTypes.RECEIVED_POST: {
        const post = action.data;

        return storeOpenGraphForPost(state, post);
    }
    case PostTypes.RECEIVED_POSTS: {
        const posts: Post[] = Object.values(action.data.posts);

        return posts.reduce(storeOpenGraphForPost, state);
    }

    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function storeOpenGraphForPost(state: any, post: Post) {
    if (!post.metadata || !post.metadata.embeds) {
        return state;
    }

    return post.metadata.embeds.reduce((nextState, embed) => {
        // If post contains a permalink, we need to store opengraph data for the embedded message
        if (embed.type === 'permalink' && embed.data && 'post' in embed.data && embed.data.post) {
            const previewPost = embed.data.post;

            if (previewPost.metadata && previewPost.metadata.embeds) {
                return previewPost.metadata.embeds.reduce((nextState, embed) => {
                    if (embed.type !== 'opengraph' || !embed.data || nextState[previewPost.id]) {
                        return nextState;
                    }

                    return {
                        ...nextState,
                        [previewPost.id]: {[embed.url]: embed.data},
                    };
                }, nextState);
            }
        }

        if (embed.type !== 'opengraph' || !embed.data) {
            // Not an OpenGraph embed
            return nextState;
        }

        const postIdState = nextState[post.id] ? {...nextState[post.id], [embed.url]: embed.data} : {[embed.url]: embed.data};
        return {
            ...nextState,
            [post.id]: postIdState,
        };
    }, state);
}

function messagesHistory(state: Partial<MessageHistory> = {
    messages: [],
    index: {
        post: -1,
        comment: -1,
    },
}, action: GenericAction) {
    switch (action.type) {
    case PostTypes.ADD_MESSAGE_INTO_HISTORY: {
        const nextIndex: Record<string, number> = {};
        let nextMessages = state.messages ? [...state.messages] : [];
        nextMessages.push(action.data);
        nextIndex[Posts.MESSAGE_TYPES.POST] = nextMessages.length;
        nextIndex[Posts.MESSAGE_TYPES.COMMENT] = nextMessages.length;

        if (nextMessages.length > Posts.MAX_PREV_MSGS) {
            nextMessages = nextMessages.slice(1, Posts.MAX_PREV_MSGS + 1);
        }

        return {
            messages: nextMessages,
            index: nextIndex,
        };
    }
    case PostTypes.RESET_HISTORY_INDEX: {
        const index: Record<string, number> = {};
        index[Posts.MESSAGE_TYPES.POST] = -1;
        index[Posts.MESSAGE_TYPES.COMMENT] = -1;

        const messages = state.messages || [];
        const nextIndex = state.index ? {...state.index} : index;
        nextIndex[action.data] = messages.length;
        return {
            messages: state.messages,
            index: nextIndex,
        };
    }
    case PostTypes.MOVE_HISTORY_INDEX_BACK: {
        const index: Record<string, number> = {};
        index[Posts.MESSAGE_TYPES.POST] = -1;
        index[Posts.MESSAGE_TYPES.COMMENT] = -1;

        const nextIndex = state.index ? {...state.index} : index;
        if (nextIndex[action.data] > 0) {
            nextIndex[action.data]--;
        }
        return {
            messages: state.messages,
            index: nextIndex,
        };
    }
    case PostTypes.MOVE_HISTORY_INDEX_FORWARD: {
        const index: Record<string, number> = {};
        index[Posts.MESSAGE_TYPES.POST] = -1;
        index[Posts.MESSAGE_TYPES.COMMENT] = -1;

        const messages = state.messages || [];
        const nextIndex = state.index ? {...state.index} : index;
        if (nextIndex[action.data] < messages.length) {
            nextIndex[action.data]++;
        }
        return {
            messages: state.messages,
            index: nextIndex,
        };
    }
    case UserTypes.LOGOUT_SUCCESS: {
        const index: Record<string, number> = {};
        index[Posts.MESSAGE_TYPES.POST] = -1;
        index[Posts.MESSAGE_TYPES.COMMENT] = -1;

        return {
            messages: [],
            index,
        };
    }
    default:
        return state;
    }
}

export function expandedURLs(state: Record<string, string> = {}, action: GenericAction) {
    switch (action.type) {
    case GeneralTypes.REDIRECT_LOCATION_SUCCESS:
        return {
            ...state,
            [action.data.url]: action.data.location,
        };
    case GeneralTypes.REDIRECT_LOCATION_FAILURE:
        return {
            ...state,
            [action.data.url]: action.data.url,
        };
    default:
        return state;
    }
}

export const zeroStateLimitedViews = {
    threads: {},
    channels: {},
};

export function limitedViews(
    state: PostsState['limitedViews'] = zeroStateLimitedViews,
    action: GenericAction,
): PostsState['limitedViews'] {
    switch (action.type) {
    case PostTypes.RECEIVED_POSTS:
    case PostTypes.RECEIVED_POSTS_AFTER:
    case PostTypes.RECEIVED_POSTS_BEFORE:
    case PostTypes.RECEIVED_POSTS_SINCE:
    case PostTypes.RECEIVED_POSTS_IN_CHANNEL: {
        if (action.data.first_inaccessible_post_time && action.channelId) {
            return {
                ...state,
                channels: {
                    ...state.channels,
                    [action.channelId]: action.data.first_inaccessible_post_time || 0,
                },
            };
        }
        return state;
    }
    case PostTypes.RECEIVED_POSTS_IN_THREAD: {
        if (action.data.first_inaccessible_post_time && action.rootId) {
            return {
                ...state,
                threads: {
                    ...state.threads,
                    [action.rootId]: action.data.first_inaccessible_post_time || 0,
                },
            };
        }
        return state;
    }
    case CloudTypes.RECEIVED_CLOUD_LIMITS: {
        const {limits} = action.data;

        // If limits change and there is no message limit any more (e.g. upgrade to non limited plan),
        // this state is stale and should be dumped.
        if (!limits?.messages || (!limits?.messages?.history && limits?.messages?.history !== 0)) {
            return zeroStateLimitedViews;
        }
        return state;
    }
    case ChannelTypes.RECEIVED_CHANNEL_DELETED:
    case ChannelTypes.DELETE_CHANNEL_SUCCESS:
    case ChannelTypes.LEAVE_CHANNEL: {
        if (action.data && action.data.viewArchivedChannels) {
            // Nothing to do since we still want to store posts in archived channels
            return state;
        }

        const channelId = action.data.id;
        if (!state.channels[channelId]) {
            return state;
        }
        const newState = {
            threads: state.threads,
            channels: {...state.channels},
        };
        delete newState.channels[channelId];
        return newState;
    }

    default:
        return state;
    }
}

export default function reducer(state: Partial<PostsState> = {}, action: GenericAction) {
    const nextPosts = handlePosts(state.posts, action);
    const nextPostsInChannel = postsInChannel(state.postsInChannel, action, state.posts!, nextPosts);

    const nextState = {

        // Object mapping post ids to post objects
        posts: nextPosts,

        // Object mapping post ids to replies count
        postsReplies: nextPostsReplies(state.postsReplies, action),

        // Array that contains the pending post ids for those messages that are in transition to being created
        pendingPostIds: handlePendingPosts(state.pendingPostIds, action),

        // Object mapping channel ids to an array of posts ids in that channel with the most recent post first
        postsInChannel: nextPostsInChannel,

        // Object mapping post root ids to an array of posts ids of comments (but not the root post) in that thread
        // with no guaranteed order
        postsInThread: postsInThread(state.postsInThread, action, state.posts!),

        // The current selected post
        selectedPostId: selectedPostId(state.selectedPostId, action),

        // The post history of selected post
        postEditHistory: postEditHistory(state.postEditHistory, action),

        // The current selected focused post (permalink view)
        currentFocusedPostId: currentFocusedPostId(state.currentFocusedPostId, action),

        // Object mapping post ids to an object of emoji reactions using userId-emojiName as keys
        reactions: reactions(state.reactions, action),

        // Object mapping URLs to their relevant opengraph metadata for link previews
        openGraph: openGraph(state.openGraph, action),

        // History of posts and comments
        messagesHistory: messagesHistory(state.messagesHistory, action),

        expandedURLs: expandedURLs(state.expandedURLs, action),

        acknowledgements: acknowledgements(state.acknowledgements, action),

        // For cloud instances with a message limit,
        // whether this particular view has messages that are hidden
        // because of the cloud workspace limit.
        limitedViews: limitedViews(state.limitedViews, action),
    };

    if (state.posts === nextState.posts && state.postsInChannel === nextState.postsInChannel &&
        state.postsInThread === nextState.postsInThread &&
        state.pendingPostIds === nextState.pendingPostIds &&
        state.selectedPostId === nextState.selectedPostId &&
        state.postEditHistory === nextState.postEditHistory &&
        state.currentFocusedPostId === nextState.currentFocusedPostId &&
        state.reactions === nextState.reactions &&
        state.acknowledgements === nextState.acknowledgements &&
        state.openGraph === nextState.openGraph &&
        state.messagesHistory === nextState.messagesHistory &&
        state.expandedURLs === nextState.expandedURLs &&
        state.limitedViews === nextState.limitedViews) {
        // None of the children have changed so don't even let the parent object change
        return state;
    }

    return nextState;
}
