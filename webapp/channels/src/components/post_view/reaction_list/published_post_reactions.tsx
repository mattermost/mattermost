// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef} from 'react';
import {useDispatch, useStore} from 'react-redux';
import {batchActions} from 'redux-batched-actions';

import type {PublishedPostReactionsProps} from '@mattermost/shared/types/global';
import type {Reaction} from '@mattermost/types/reactions';

import {PostTypes} from 'mattermost-redux/action_types';
import {getCustomEmojiForReaction} from 'mattermost-redux/actions/posts';
import {Client4} from 'mattermost-redux/client';
import {getReactionsForPosts} from 'mattermost-redux/selectors/entities/posts';

import ReactionList from 'components/post_view/reaction_list';

import type {GlobalState} from 'types/store';

// The store can hold a partial entry (e.g. from a websocket event), so this syncs the full list once per mounted post id.
export default function PublishedPostReactions({post, showAddButtonWhenEmpty}: PublishedPostReactionsProps) {
    const dispatch = useDispatch();
    const store = useStore<GlobalState>();
    const fetchedPostId = useRef<string | undefined>(undefined);

    useEffect(() => {
        if (fetchedPostId.current === post.id) {
            return;
        }
        fetchedPostId.current = post.id;

        const reactionKey = (reaction: Reaction) => `${reaction.user_id}-${reaction.emoji_name}`;
        const keysAtStart = new Set(Object.values(getReactionsForPosts(store.getState())[post.id] ?? {}).map(reactionKey));

        Client4.getReactionsForPost(post.id).then((reactions) => {
            const fetchedKeys = new Set(reactions.map(reactionKey));
            const cached = Object.values(getReactionsForPosts(store.getState())[post.id] ?? {});

            // Reactions added while the request was in flight are newer than the server snapshot, so they are kept.
            const stale = cached.filter((reaction) => {
                const key = reactionKey(reaction);
                return keysAtStart.has(key) && !fetchedKeys.has(key);
            });

            const actions = [
                ...stale.map((reaction) => ({
                    type: PostTypes.REACTION_DELETED,
                    data: reaction,
                })),
                ...reactions.map((reaction) => ({
                    type: PostTypes.RECEIVED_REACTION,
                    data: reaction,
                })),
            ];
            if (actions.length) {
                dispatch(batchActions(actions));
            }

            for (const emojiName of new Set(reactions.map((reaction) => reaction.emoji_name))) {
                dispatch(getCustomEmojiForReaction(emojiName));
            }
        }).catch(() => {});
    }, [dispatch, post.id, store]);

    return (
        <ReactionList
            post={post}
            showAddButtonWhenEmpty={showAddButtonWhenEmpty}
        />
    );
}
