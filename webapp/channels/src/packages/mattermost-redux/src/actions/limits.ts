// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ServerError} from '@mattermost/types/errors';
import type {ServerLimits} from '@mattermost/types/limits';

import {LimitsTypes} from 'mattermost-redux/action_types';
import {logError} from 'mattermost-redux/actions/errors';
import {forceLogoutIfNecessary} from 'mattermost-redux/actions/helpers';
import {Client4} from 'mattermost-redux/client';
import {getCurrentUserRoles} from 'mattermost-redux/selectors/entities/users';
import type {ActionFuncAsync} from 'mattermost-redux/types/actions';
import {isAdmin} from 'mattermost-redux/utils/user_utils';

export function getServerLimits(): ActionFuncAsync<ServerLimits> {
    return async (dispatch, getState) => {
        const roles = getCurrentUserRoles(getState());
        const amIAdmin = isAdmin(roles);
        if (!amIAdmin) {
            return {
                data: {
                    activeUserCount: 0,
                    maxUsersLimit: 0,
                },
            };
        }

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
        };

        dispatch({type: LimitsTypes.RECIEVED_APP_LIMITS, data});

        return {data};
    };
}

