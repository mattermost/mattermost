// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef} from 'react';
import {useDispatch, useStore} from 'react-redux';
import {batchActions} from 'redux-batched-actions';

import type {PublishedPostReactionsProps} from '@mattermost/shared/types/global';

import {PostTypes} from 'mattermost-redux/action_types';
import {getCustomEmojiForReaction} from 'mattermost-redux/actions/posts';
import {Client4} from 'mattermost-redux/client';
import {getReactionsForPosts} from 'mattermost-redux/selectors/entities/posts';

import ReactionList from 'components/post_view/reaction_list';

import type {GlobalState} from 'types/store';

// A post with no reactions stays undefined in the store, so this fetches once per mounted post id.
export default function PublishedPostReactions({post, showAddButtonWhenEmpty}: PublishedPostReactionsProps) {
    const dispatch = useDispatch();
    const store = useStore<GlobalState>();
    const fetchedPostId = useRef<string | undefined>(undefined);

    useEffect(() => {
        if (fetchedPostId.current === post.id) {
            return;
        }
        fetchedPostId.current = post.id;

        if (getReactionsForPosts(store.getState())[post.id] !== undefined) {
            return;
        }

        Client4.getReactionsForPost(post.id).then((reactions) => {
            dispatch(batchActions(reactions.map((reaction) => ({
                type: PostTypes.RECEIVED_REACTION,
                data: reaction,
            }))));

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
