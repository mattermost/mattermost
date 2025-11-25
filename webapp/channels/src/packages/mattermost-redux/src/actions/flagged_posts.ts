// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {batchActions} from 'redux-batched-actions';

import type {PostList} from '@mattermost/types/posts';

import {FlaggedPostsTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';
import {FLAGGED_POSTS_PER_PAGE} from 'mattermost-redux/constants/flagged_posts';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import type {ActionFuncAsync} from 'mattermost-redux/types/actions';

import {logError} from './errors';
import {forceLogoutIfNecessary} from './helpers';
import {getMentionsAndStatusesForPosts, receivedPosts} from './posts';
import {getMissingChannelsFromPosts} from './search';

export function fetchFlaggedPosts(page = 0, perPage = FLAGGED_POSTS_PER_PAGE): ActionFuncAsync<PostList> {
    return async (dispatch, getState) => {
        const state = getState();
        const userId = getCurrentUserId(state);
        const isGettingMore = page > 0;

        dispatch({
            type: isGettingMore ? FlaggedPostsTypes.FLAGGED_POSTS_MORE_REQUEST : FlaggedPostsTypes.FLAGGED_POSTS_REQUEST,
        });

        let posts: PostList;
        try {
            posts = await Client4.getFlaggedPosts(userId, '', '', page, perPage);

            await Promise.all([
                getMentionsAndStatusesForPosts(posts.posts, dispatch, getState),
                dispatch(getMissingChannelsFromPosts(posts.posts)),
            ]);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch({type: FlaggedPostsTypes.FLAGGED_POSTS_FAILURE, error});
            dispatch(logError(error));
            return {error};
        }

        const isEnd = posts.order.length < perPage;

        dispatch(batchActions([
            {
                type: isGettingMore ? FlaggedPostsTypes.FLAGGED_POSTS_MORE_RECEIVED : FlaggedPostsTypes.FLAGGED_POSTS_RECEIVED,
                data: {
                    postIds: posts.order,
                    page,
                    perPage,
                    isEnd,
                },
            },
            receivedPosts(posts),
            {
                type: FlaggedPostsTypes.FLAGGED_POSTS_SUCCESS,
            },
        ], 'FLAGGED_POSTS_BATCH'));

        return {data: posts};
    };
}

export function getMoreFlaggedPosts(): ActionFuncAsync {
    return async (dispatch, getState) => {
        const {page, isEnd, isLoadingMore} = getState().entities.flaggedPosts;

        if (isEnd || isLoadingMore) {
            return {data: true};
        }

        return dispatch(fetchFlaggedPosts(page + 1));
    };
}

export function clearFlaggedPosts() {
    return {
        type: FlaggedPostsTypes.FLAGGED_POSTS_CLEAR,
    };
}
