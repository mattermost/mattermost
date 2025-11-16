// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PostTypes} from 'mattermost-redux/action_types';
import {forceLogoutIfNecessary} from 'mattermost-redux/actions/helpers';
import {Client4} from 'mattermost-redux/client';

import type {ActionFuncAsync} from 'types/store';

/**
 * Manual "burn now" action - immediately deletes a burn-on-read post
 * Triggered when user clicks the timer chip and confirms deletion
 */
export function burnPostNow(postId: string): ActionFuncAsync<boolean> {
    return async (dispatch, getState) => {
        try {
            await Client4.burnPostNow(postId);

            // Completely remove post from Redux state
            dispatch({
                type: PostTypes.POST_REMOVED,
                data: {id: postId},
            });

            return {data: true};
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            return {error};
        }
    };
}

/**
 * Handles automatic post expiration when timer reaches zero
 * Also used when receiving WebSocket expiration event
 */
export function handlePostExpired(postId: string): ActionFuncAsync<boolean> {
    return async (dispatch) => {
        // Completely remove post from Redux state (client-side only, no API call)
        dispatch({
            type: PostTypes.POST_REMOVED,
            data: {id: postId},
        });

        return {data: true};
    };
}
