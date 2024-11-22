// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';
import type {Post, PostType, PostMetadata, PostEmbed} from '@mattermost/types/posts';
import type {GlobalState} from '@mattermost/types/store';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';

import {Posts, Preferences, Permissions} from '../constants';

export function isSystemMessage(post: Post): boolean {
    return Boolean(post.type && post.type.startsWith(Posts.SYSTEM_MESSAGE_PREFIX));
}

export function isMeMessage(post: Post): boolean {
    return Boolean(post.type && post.type === Posts.POST_TYPES.ME);
}

export function isFromWebhook(post: Post): boolean {
    return post.props?.from_webhook === 'true';
}

export function isPostEphemeral(post: Post): boolean {
    return post.type === Posts.POST_TYPES.EPHEMERAL || post.type === Posts.POST_TYPES.EPHEMERAL_ADD_TO_CHANNEL || post.state === Posts.POST_DELETED;
}

export function isUserAddedInChannel(post: Post, userId?: UserProfile['id']): boolean {
    const postTypeCheck = Boolean(post.type && (post.type === Posts.POST_TYPES.ADD_TO_CHANNEL));
    const userIdCheck = Boolean(post.props && post.props.addedUserId && (post.props.addedUserId === userId));
    return postTypeCheck && userIdCheck;
}

export function shouldIgnorePost(post: Post, userId?: UserProfile['id']): boolean {
    if (isUserAddedInChannel(post, userId)) {
        return false;
    }
    return Posts.IGNORE_POST_TYPES.includes(post.type);
}

export function isUserActivityPost(postType: PostType): boolean {
    return Posts.USER_ACTIVITY_POST_TYPES.includes(postType);
}

export function isPostOwner(userId: UserProfile['id'], post: Post) {
    return userId === post.user_id;
}

export function isEdited(post: Post): boolean {
    return post.edit_at > 0;
}

export function canEditPost(state: GlobalState, config: any, license: any, teamId: Team['id'], channelId: Channel['id'], userId: UserProfile['id'], post: Post): boolean {
    if (!post || isSystemMessage(post)) {
        return false;
    }

    const isOwner = isPostOwner(userId, post);
    let canEdit = true;

    const permission = isOwner ? Permissions.EDIT_POST : Permissions.EDIT_OTHERS_POSTS;
    canEdit = haveIChannelPermission(state, teamId, channelId, permission);
    if (license.IsLicensed === 'true' && config.PostEditTimeLimit !== '-1' && config.PostEditTimeLimit !== -1) {
        const timeLeft = (post.create_at + (config.PostEditTimeLimit * 1000)) - Date.now();
        if (timeLeft <= 0) {
            canEdit = false;
        }
    }

    return canEdit;
}

export function getLastCreateAt(postsArray: Post[]): number {
    const createAt = postsArray.map((p) => p.create_at);

    if (createAt.length) {
        return Reflect.apply(Math.max, null, createAt);
    }

    return 0;
}

const joinLeavePostTypes = [
    Posts.POST_TYPES.JOIN_LEAVE,
    Posts.POST_TYPES.JOIN_CHANNEL,
    Posts.POST_TYPES.LEAVE_CHANNEL,
    Posts.POST_TYPES.ADD_REMOVE,
    Posts.POST_TYPES.ADD_TO_CHANNEL,
    Posts.POST_TYPES.REMOVE_FROM_CHANNEL,
    Posts.POST_TYPES.JOIN_TEAM,
    Posts.POST_TYPES.LEAVE_TEAM,
    Posts.POST_TYPES.ADD_TO_TEAM,
    Posts.POST_TYPES.REMOVE_FROM_TEAM,
    Posts.POST_TYPES.COMBINED_USER_ACTIVITY,
];

/**
 * If the user has "Show Join/Leave Messages" disabled, this function will return true if the post should be hidden if it's of type join/leave.
 * The post object passed in must be not null/undefined.
 * @returns Returns true if a post should be hidden
 */
export function shouldFilterJoinLeavePost(post: Post, showJoinLeave: boolean, currentUsername: string): boolean {
    if (showJoinLeave) {
        return false;
    }

    // Don't filter out non-join/leave messages
    if (joinLeavePostTypes.indexOf(post.type) === -1) {
        return false;
    }

    // Don't filter out join/leave messages about the current user
    return !isJoinLeavePostForUsername(post, currentUsername);
}

function isJoinLeavePostForUsername(post: Post, currentUsername: string): boolean {
    if (!post.props || !currentUsername) {
        return false;
    }

    if (post.user_activity_posts) {
        for (const childPost of post.user_activity_posts) {
            if (isJoinLeavePostForUsername(childPost, currentUsername)) {
                // If any of the contained posts are for this user, the client will
                // need to figure out how to render the post
                return true;
            }
        }
    }

    return post.props.username === currentUsername ||
        post.props.addedUsername === currentUsername ||
        post.props.removedUsername === currentUsername;
}

export function isPostPendingOrFailed(post: Post): boolean {
    return post.failed || post.id === post.pending_post_id;
}

export function comparePosts(a: Post, b: Post): number {
    const aIsPendingOrFailed = isPostPendingOrFailed(a);
    const bIsPendingOrFailed = isPostPendingOrFailed(b);
    if (aIsPendingOrFailed && !bIsPendingOrFailed) {
        return -1;
    } else if (!aIsPendingOrFailed && bIsPendingOrFailed) {
        return 1;
    }

    if (a.create_at > b.create_at) {
        return -1;
    } else if (a.create_at < b.create_at) {
        return 1;
    }

    return 0;
}

export function isPostCommentMention({post, currentUser, threadRepliedToByCurrentUser, rootPost}: {post: Post; currentUser: UserProfile; threadRepliedToByCurrentUser: boolean; rootPost: Post}): boolean {
    let commentsNotifyLevel = Preferences.COMMENTS_NEVER;
    let isCommentMention = false;
    let threadCreatedByCurrentUser = false;

    if (rootPost && rootPost.user_id === currentUser.id) {
        threadCreatedByCurrentUser = true;
    }
    if (currentUser.notify_props && currentUser.notify_props.comments) {
        commentsNotifyLevel = currentUser.notify_props.comments;
    }

    const notCurrentUser = post.user_id !== currentUser.id || isFromWebhook(post);
    if (notCurrentUser) {
        if (commentsNotifyLevel === Preferences.COMMENTS_ANY && (threadCreatedByCurrentUser || threadRepliedToByCurrentUser)) {
            isCommentMention = true;
        } else if (commentsNotifyLevel === Preferences.COMMENTS_ROOT && threadCreatedByCurrentUser) {
            isCommentMention = true;
        }
    }
    return isCommentMention;
}

export function fromAutoResponder(post: Post): boolean {
    return Boolean(post.type && (post.type === Posts.SYSTEM_AUTO_RESPONDER));
}

export function getEmbedFromMetadata(metadata: PostMetadata): PostEmbed | null {
    if (!metadata || !metadata.embeds || metadata.embeds.length === 0) {
        return null;
    }

    return metadata.embeds[0];
}

export function isPermalink(post: Post) {
    if (post.metadata && post.metadata.embeds) {
        for (const embed of post.metadata.embeds) {
            if (embed.type === 'permalink') {
                return true;
            }
        }
    }

    return false;
}

export function shouldUpdatePost(receivedPost: Post, storedPost?: Post): boolean {
    if (!storedPost) {
        return true;
    }

    if (storedPost.update_at > receivedPost.update_at) {
        // The stored post is newer than the one we've received
        return false;
    }

    if (
        storedPost.update_at && receivedPost.update_at &&
        storedPost.update_at === receivedPost.update_at
    ) {
        // The stored post has the same update at with the one we've received
        if (
            storedPost.is_following !== receivedPost.is_following ||
            storedPost.reply_count !== receivedPost.reply_count ||
            storedPost.participants?.length !== receivedPost.participants?.length
        ) {
            // CRT properties are not the same between posts
            // e.g: in the case of toggling CRT on/off
            return true;
        }

        if (!storedPost.metadata && receivedPost.metadata) {
            // Metadata is not the same between posts
            return true;
        }

        // The stored post is the same as the one we've received
        return false;
    }

    // The stored post is older than the one we've received
    return true;
}

export function ensureString(v: unknown) {
    return typeof v === 'string' ? v : '';
}

export function ensureNumber(v: unknown) {
    return typeof v === 'number' ? v : 0;
}

export function secureGetFromRecord<T>(v: Record<string, T> | undefined, key: string) {
    return typeof v === 'object' && v && Object.hasOwn(v, key) ? v[key] : undefined;
}
