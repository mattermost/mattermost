// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post, PostMetadata} from '@mattermost/types/posts';

import {getRandomId} from '@/util';

export function createRandomPost(post?: Partial<Post>): Post {
    if (post && post.channel_id && post.user_id) {
        const time = Date.now();

        const defaultPost = {
            create_at: time,
            user_id: post.user_id,
            channel_id: post.channel_id,
            root_id: post.root_id || '',
            message: `${post?.message ?? ''}${getRandomId()}`,
            pending_post_id: `${post.user_id}:${time}`,
            props: post?.props || {},
            file_ids: post?.file_ids || [],
            metadata: {} as PostMetadata,
        };

        Reflect.deleteProperty(post, 'user_id');
        Reflect.deleteProperty(post, 'channel_id');
        Reflect.deleteProperty(post, 'message');
        Reflect.deleteProperty(post, 'pending_post_id');

        return {...defaultPost, ...post} as Post;
    }

    throw new Error('Post is missing channel_id or user_id or both');
}

/** The ids of the files a post carries; a post sent with files and found without them is an error. */
export function fileIdsOf(post: Pick<Post, 'file_ids'>): string[] {
    if (!post.file_ids?.length) {
        throw new Error('Expected the post to carry files');
    }
    return post.file_ids;
}
