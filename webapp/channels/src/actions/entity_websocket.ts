// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';

import {Client4} from 'mattermost-redux/client';
import {PostTypes} from 'mattermost-redux/action_types';
import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';
import {getPost, getPostIdsInChannel} from 'mattermost-redux/selectors/entities/posts';

import type {ActionFuncAsync} from 'types/store';

const maxEntityPosts = 200;

export function handleEntitiesDictionaryChanged(): ActionFuncAsync {
    return async (dispatch, getState) => {
        await new Promise((resolve) => {
            setTimeout(resolve, Math.floor(Math.random() * 10000));
        });
        const state = getState();
        const channelId = getCurrentChannelId(state);
        if (!channelId) {
            return {data: false};
        }
        const ids = getPostIdsInChannel(state, channelId).slice(0, maxEntityPosts);
        if (!ids || ids.length === 0) {
            return {data: false};
        }
        const result = await Client4.getEntityPosts(ids);
        const posts: Record<string, Post> = {};
        Object.keys(result.posts || {}).forEach((id) => {
            const post = getPost(state, id);
            if (!post) {
                return;
            }
            posts[id] = {
                ...post,
                metadata: {
                    embeds: [],
                    emojis: [],
                    files: [],
                    images: {},
                    ...post.metadata,
                    entities: result.posts[id],
                },
            };
        });
        if (Object.keys(posts).length > 0) {
            dispatch({
                type: PostTypes.RECEIVED_POSTS,
                data: {posts},
            });
        }
        return {data: true};
    };
}
