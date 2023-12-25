// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ServerError} from '@mattermost/types/errors';
import type {UsersLimits} from '@mattermost/types/limits';
import type {UserProfile} from '@mattermost/types/users';

import {LimitsTypes} from 'mattermost-redux/action_types';
import {logError} from 'mattermost-redux/actions/errors';
import {forceLogoutIfNecessary} from 'mattermost-redux/actions/helpers';
import {Client4} from 'mattermost-redux/client';
import type {ActionFunc} from 'mattermost-redux/types/actions';
import {isAdmin} from 'mattermost-redux/utils/user_utils';

export function getUsersLimits(roles: UserProfile['roles']): ActionFunc<UsersLimits, ServerError> {
    return async (dispatch, getState) => {
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
            response = await Client4.getUsersLimits();
        } catch (err) {
            forceLogoutIfNecessary(err, dispatch, getState);
            dispatch(logError(err));
            return {error: err as ServerError};
        }

        dispatch({type: LimitsTypes.RECIEVED_USERS_LIMITS, data: response.data});

        return {data: response.data};
    };
}
