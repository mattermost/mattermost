// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';

import {PostTypes} from 'mattermost-redux/action_types';
import {logError} from 'mattermost-redux/actions/errors';
import {forceLogoutIfNecessary} from 'mattermost-redux/actions/helpers';
import {Client4} from 'mattermost-redux/client';

import type {ActionFuncAsync} from 'types/store';

/**
 * Reveals a Burn-on-Read post for the current user.
 * This action calls the backend API to mark the post as read and returns the full post content
 * along with the expiration timestamp.
 *
 * @param postId - The ID of the Burn-on-Read post to reveal
 * @returns Action result with post data and expiration timestamp, or error
 */
export function revealBurnOnReadPost(postId: string): ActionFuncAsync<{post: Post; expire_at: number}> {
    return async (dispatch, getState) => {
        let result;

        try {
            result = await Client4.revealBurnOnReadPost(postId);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        dispatch({
            type: PostTypes.REVEAL_BURN_ON_READ_SUCCESS,
            data: {
                post: result.post,
                expireAt: result.expire_at,
            },
        });

        return {data: result};
    };
}
