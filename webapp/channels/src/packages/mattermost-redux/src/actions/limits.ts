// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ServerError} from '@mattermost/types/errors';
import type {ServerLimits} from '@mattermost/types/limits';

import {LimitsTypes} from 'mattermost-redux/action_types';
import {logError} from 'mattermost-redux/actions/errors';
import {forceLogoutIfNecessary} from 'mattermost-redux/actions/helpers';
import {Client4} from 'mattermost-redux/client';
import type {ActionFuncAsync} from 'mattermost-redux/types/actions';

export function getServerLimits(): ActionFuncAsync<ServerLimits> {
    return async (dispatch, getState) => {
        // All users can fetch server limits - server handles permission filtering
        let response;
        try {
            response = await Client4.getServerLimits();
        } catch (err) {
            forceLogoutIfNecessary(err, dispatch, getState);
            dispatch(logError(err));
            return {error: err as ServerError};
        }

        const data: ServerLimits = {
            activeUserCount: response?.data?.activeUserCount ?? 0,
            maxUsersLimit: response?.data?.maxUsersLimit ?? 0,
            maxUsersHardLimit: response?.data?.maxUsersHardLimit ?? 0,

            // Post history limit fields from server response
            lastAccessiblePostTime: response?.data?.lastAccessiblePostTime ?? 0,
            postHistoryLimit: response?.data?.postHistoryLimit ?? 0,
        };

        dispatch({type: LimitsTypes.RECEIVED_APP_LIMITS, data});

        return {data};
    };
}

