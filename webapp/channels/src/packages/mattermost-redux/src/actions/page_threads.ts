// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import uniq from 'lodash/uniq';

import type {Post} from '@mattermost/types/posts';
import type {UserThreadWithPost} from '@mattermost/types/threads';

import {PostTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';
import type {DispatchFunc} from 'mattermost-redux/types/actions';

export async function fetchMissingPagePosts(threads: UserThreadWithPost[], dispatch: DispatchFunc): Promise<void> {
    const pageIds = uniq(
        threads.
            filter(({post}) => post.type === 'page_comment' && post.props?.page_id).
            map(({post}) => post.props?.page_id as string),
    );

    if (pageIds.length === 0) {
        return;
    }

    try {
        const pagePosts = await Promise.all(pageIds.map((pageId) => Client4.getPost(pageId)));

        const postsToDispatch = pagePosts.map((post: Post) => ({...post, update_at: 0}));

        dispatch({
            type: PostTypes.RECEIVED_POSTS,
            data: {posts: postsToDispatch},
        });
    } catch (error) {
        // Failed to fetch page posts
    }
}
