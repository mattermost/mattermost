// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Utility to decrypt posts in a PostList before they enter Redux.
 * This ensures posts are decrypted on first render, not patched after.
 */

import type {Post, PostList} from '@mattermost/types/posts';

import {decryptMessageHook} from './message_hooks';
import {isEncryptedMessage} from './hybrid';

/**
 * Decrypts all encrypted posts in a PostList.
 * Returns a new PostList with decrypted messages.
 */
export async function decryptPostsInList(posts: PostList, userId: string): Promise<PostList> {
    const decryptedPosts: Record<string, Post> = {};

    // Decrypt each post that needs it
    await Promise.all(
        Object.entries(posts.posts).map(async ([postId, post]) => {
            if (isEncryptedMessage(post.message)) {
                try {
                    const result = await decryptMessageHook(post, userId);
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
