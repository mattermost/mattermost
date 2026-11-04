// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PostEntity} from '@mattermost/types/posts';

import {PostTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';
import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';
import {getPost, getPostIdsInChannel} from 'mattermost-redux/selectors/entities/posts';

import {clearEntityCardCache} from 'components/entity_mention/entity_mention';

import type {ActionFuncAsync} from 'types/store';

const maxEntityPosts = 200;
let entityRequestSeq = 0;
const appliedEntitySeq = new Map<string, number>();

export function handleEntitiesDictionaryChanged(): ActionFuncAsync {
    return async (dispatch, getState) => {
        clearEntityCardCache();
        await new Promise((resolve) => {
            setTimeout(resolve, Math.floor(Math.random() * 10000));
        });
        const state = getState();
        const channelId = getCurrentChannelId(state);
        if (!channelId) {
            return {data: false};
        }
        const recent = getPostIdsInChannel(state, channelId);
        if (!recent || recent.length === 0) {
            return {data: false};
        }
        const ids = recent.slice(0, maxEntityPosts);
        const requestedAt = new Map<string, number>();
        ids.forEach((id) => {
            const post = getPost(state, id);
            if (post) {
                requestedAt.set(id, post.update_at);
            }
        });
        const requestSeq = ++entityRequestSeq;
        let result: {posts: Record<string, PostEntity[]>};
        try {
            result = await Client4.getEntityPosts(ids);
        } catch {
            return {data: false};
        }
        const fresh = getState();
        const entities: Record<string, PostEntity[]> = {};
        Object.keys(result.posts || {}).forEach((id) => {
            const post = getPost(fresh, id);
            if (!post) {
                return;
            }
            if (requestedAt.get(id) !== post.update_at) {
                return;
            }
            if ((appliedEntitySeq.get(id) ?? 0) > requestSeq) {
                return;
            }
            appliedEntitySeq.set(id, requestSeq);
            entities[id] = result.posts[id];
        });
        if (Object.keys(entities).length > 0) {
            dispatch({
                type: PostTypes.RECEIVED_POST_ENTITIES,
                data: entities,
            });
        }
        return {data: true};
    };
}
