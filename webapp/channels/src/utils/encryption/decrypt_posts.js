"use strict";
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
Object.defineProperty(exports, "__esModule", { value: true });
exports.decryptPostsInList = decryptPostsInList;
exports.decryptPost = decryptPost;
const message_hooks_1 = require("./message_hooks");
const hybrid_1 = require("./hybrid");
/**
 * Decrypts all encrypted posts in a PostList.
 * Returns a new PostList with decrypted messages.
 */
async function decryptPostsInList(posts, userId) {
    const decryptedPosts = {};
    // Decrypt each post that needs it
    await Promise.all(Object.entries(posts.posts).map(async ([postId, post]) => {
        if ((0, hybrid_1.isEncryptedMessage)(post.message)) {
            try {
                const result = await (0, message_hooks_1.decryptMessageHook)(post, userId);
                decryptedPosts[postId] = result.post;
            }
            catch (error) {
                console.error('[decryptPostsInList] Failed to decrypt post:', postId, error);
                decryptedPosts[postId] = {
                    ...post,
                    props: {
                        ...post.props,
                        encryption_status: 'decrypt_error',
                    },
                };
            }
        }
        else {
            decryptedPosts[postId] = post;
        }
    }));
    return {
        ...posts,
        posts: decryptedPosts,
    };
}
/**
 * Decrypts a single post if it's encrypted.
 */
async function decryptPost(post, userId) {
    if (!(0, hybrid_1.isEncryptedMessage)(post.message)) {
        return post;
    }
    try {
        const result = await (0, message_hooks_1.decryptMessageHook)(post, userId);
        return result.post;
    }
    catch (error) {
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
