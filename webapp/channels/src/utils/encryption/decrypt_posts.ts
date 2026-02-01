// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Utility to decrypt posts in a PostList before they enter Redux.
 * This ensures posts are decrypted on first render, not patched after.
 */

import type {Post, PostList} from '@mattermost/types/posts';

import {decryptMessageHook, getCachedPlaintext} from './message_hooks';
import {isEncryptedMessage} from './hybrid';

/**
 * Decrypts all encrypted posts in a PostList.
 * Returns a new PostList with decrypted messages.
 */
export async function decryptPostsInList(posts: PostList, userId: string): Promise<PostList> {
    const decryptedPosts: Record<string, Post> = {};
    const postIds = Object.keys(posts.posts);
    console.log('[decryptPostsInList] Processing', postIds.length, 'posts for userId:', userId);

    // Decrypt each post that needs it
    await Promise.all(
        Object.entries(posts.posts).map(async ([postId, post]) => {
            if (isEncryptedMessage(post.message)) {
                // Check if this is a message we just sent - use cached plaintext for instant display
                const cachedPlaintext = getCachedPlaintext(post.message);
                if (cachedPlaintext !== null) {
                    console.log('[decryptPostsInList] Using cached plaintext for post:', postId);
                    decryptedPosts[postId] = {
                        ...post,
                        message: cachedPlaintext,
                        props: {
                            ...post.props,
                            encryption_status: 'decrypted',
                        },
                    };
                    return;
                }

                console.log('[decryptPostsInList] Decrypting post:', postId);
                try {
                    const result = await decryptMessageHook(post, userId);
                    console.log('[decryptPostsInList] Post decrypted:', postId, 'status:', result.post.props?.encryption_status);
                    decryptedPosts[postId] = result.post;
                } catch (error) {
                    console.error('[decryptPostsInList] Failed to decrypt post:', postId, error);
                    decryptedPosts[postId] = {
                        ...post,
                        props: {
                            ...post.props,
                            encryption_status: 'decrypt_error',
                        },
                    };
                }
            } else {
                decryptedPosts[postId] = post;
            }
        }),
    );

    console.log('[decryptPostsInList] Completed, returning', Object.keys(decryptedPosts).length, 'posts');
    return {
        ...posts,
        posts: decryptedPosts,
    };
}

/**
 * Decrypts a single post if it's encrypted.
 */
export async function decryptPost(post: Post, userId: string): Promise<Post> {
    if (!isEncryptedMessage(post.message)) {
        return post;
    }

    try {
        const result = await decryptMessageHook(post, userId);
        return result.post;
    } catch (error) {
        console.error('[decryptPost] Failed to decrypt:', post.id, error);
        return {
            ...post,
            props: {
                ...post.props,
                encryption_status: 'decrypt_error',
            },
        };
    }
}
