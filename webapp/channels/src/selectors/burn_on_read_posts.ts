// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';

import {getCurrentUserId} from 'mattermost-redux/selectors/entities/common';
import {getPost} from 'mattermost-redux/selectors/entities/posts';

import {isBurnOnReadEnabled} from 'selectors/burn_on_read';

import {PostTypes} from 'utils/constants';

import type {GlobalState} from 'types/store';

/**
 * Returns whether the specified post is a Burn-on-Read message.
 * BoR posts have a special type that distinguishes them from regular posts.
 */
export function isBurnOnReadPost(state: GlobalState, postId: string): boolean {
    const post = getPost(state, postId);
    return post?.type === PostTypes.BURN_ON_READ;
}

/**
 * Returns whether the current user has revealed the specified Burn-on-Read post.
 * Recipients must explicitly click to reveal concealed content.
 * Senders always see content (no reveal needed).
 *
 * @returns true if the user has revealed the post, or if the user is the sender
 */
export function hasUserRevealedBurnOnReadPost(state: GlobalState, postId: string): boolean {
    const post = getPost(state, postId);
    const currentUserId = getCurrentUserId(state);

    if (!post || post.type !== PostTypes.BURN_ON_READ) {
        return false;
    }

    // Sender always sees content
    if (post.user_id === currentUserId) {
        return true;
    }

    // Check if recipient has revealed the post
    return post.props?.revealed === true;
}

/**
 * Returns whether the specified Burn-on-Read post should display concealed placeholder.
 * This is true when:
 * - Feature is enabled
 * - Post is a BoR post
 * - Current user is NOT the sender
 * - Current user has NOT revealed the content yet
 */
export function shouldDisplayConcealedPlaceholder(state: GlobalState, postId: string): boolean {
    // Feature flag check first
    if (!isBurnOnReadEnabled(state)) {
        return false;
    }

    const post = getPost(state, postId);
    const currentUserId = getCurrentUserId(state);

    if (!post || post.type !== PostTypes.BURN_ON_READ) {
        return false;
    }

    // Sender never sees concealed placeholder
    if (post.user_id === currentUserId) {
        return false;
    }

    // Show concealed if not yet revealed
    return post.props?.revealed !== true;
}

/**
 * Returns the Burn-on-Read post object if it exists and is a valid BoR post.
 * Returns null if post doesn't exist or is not a BoR post.
 */
export function getBurnOnReadPost(state: GlobalState, postId: string): Post | null {
    const post = getPost(state, postId);
    if (!post || post.type !== PostTypes.BURN_ON_READ) {
        return null;
    }
    return post;
}

/**
 * Returns the expiration timestamp (ms) for a revealed Burn-on-Read post.
 * Returns null if post is not revealed or doesn't have expiration data.
 */
export function getBurnOnReadPostExpiration(state: GlobalState, postId: string): number | null {
    const post = getPost(state, postId);
    if (!post || post.type !== PostTypes.BURN_ON_READ) {
        return null;
    }

    const expireAt = post.props?.expire_at;
    if (typeof expireAt === 'number') {
        return expireAt;
    }

    return null;
}

/**
 * Returns whether the current user is the sender of the specified BoR post.
 */
export function isCurrentUserBurnOnReadSender(state: GlobalState, postId: string): boolean {
    const post = getPost(state, postId);
    const currentUserId = getCurrentUserId(state);

    if (!post || post.type !== PostTypes.BURN_ON_READ) {
        return false;
    }

    return post.user_id === currentUserId;
}
