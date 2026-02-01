// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Hook to handle on-the-fly decryption of encrypted posts.
 * This handles posts that were loaded from API (not WebSocket) and weren't decrypted.
 */

import {useEffect, useRef} from 'react';
import {useDispatch} from 'react-redux';

import type {Post} from '@mattermost/types/posts';

import {receivedPost} from 'mattermost-redux/actions/posts';

import {isEncryptedMessage} from './hybrid';
import {decryptMessageHook} from './message_hooks';

// Track posts currently being decrypted to avoid duplicate attempts
const decryptingPosts = new Set<string>();

// Track posts that failed decryption to avoid infinite retry loops
const failedPosts = new Set<string>();

/**
 * Hook that attempts to decrypt an encrypted post on-the-fly.
 * When decryption succeeds, it dispatches an action to update Redux.
 *
 * @param post - The post to potentially decrypt
 * @param userId - The current user's ID
 */
export function useDecryptPost(post: Post, userId: string): void {
    const dispatch = useDispatch();
    const postIdRef = useRef<string | null>(null);

    useEffect(() => {
        // Skip if not an encrypted message or already has encryption_status
        if (!isEncryptedMessage(post.message)) {
            return;
        }

        // If post already has encryption_status, it was already processed
        if (post.props?.encryption_status) {
            return;
        }

        // Skip if already being decrypted or already failed
        if (decryptingPosts.has(post.id) || failedPosts.has(post.id)) {
            return;
        }

        // Track that we're decrypting this post
        decryptingPosts.add(post.id);
        postIdRef.current = post.id;

        const attemptDecryption = async () => {
            try {
                const result = await decryptMessageHook(post, userId);

                // Only dispatch if the post was modified (decrypted or marked with status)
                if (result.post !== post) {
                    dispatch(receivedPost(result.post));
                }
            } catch (error) {
                console.error('Failed to decrypt post:', post.id, error);
                // Mark as failed to avoid retry loops
                failedPosts.add(post.id);

                // Dispatch with error status
                dispatch(receivedPost({
                    ...post,
                    props: {
                        ...post.props,
                        encryption_status: 'decrypt_error',
                    },
                }));
            } finally {
                decryptingPosts.delete(post.id);
            }
        };

        attemptDecryption();

        // Cleanup function
        return () => {
            if (postIdRef.current) {
                decryptingPosts.delete(postIdRef.current);
            }
        };
    }, [post.id, post.message, post.props?.encryption_status, userId, dispatch]);
}

/**
 * Clears the failed posts cache. Call this when user logs out or
 * re-initializes encryption keys.
 */
export function clearDecryptionCache(): void {
    failedPosts.clear();
    decryptingPosts.clear();
}
