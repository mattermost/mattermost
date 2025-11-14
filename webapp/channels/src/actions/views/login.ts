// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {batchActions} from 'redux-batched-actions';

import type {ServerError} from '@mattermost/types/errors';
import type {UserProfile} from '@mattermost/types/users';

import {UserTypes} from 'mattermost-redux/action_types';
import {logError} from 'mattermost-redux/actions/errors';
import {loadRolesIfNeeded} from 'mattermost-redux/actions/roles';
import {Client4} from 'mattermost-redux/client';

import type {ActionFuncAsync, DispatchFunc} from 'types/store';

async function handleLoginSuccess(dispatch: DispatchFunc, loggedInUserProfile: UserProfile) {
    dispatch(
        batchActions([
            {
                type: UserTypes.LOGIN_SUCCESS,
            },
            {
                type: UserTypes.RECEIVED_ME,
                data: loggedInUserProfile,
            },
        ]),
    );

    dispatch(loadRolesIfNeeded(loggedInUserProfile.roles.split(' ')));
}

async function performLogin(
    dispatch: DispatchFunc,
    loginFunc: () => Promise<UserProfile>,
) {
    dispatch({type: UserTypes.LOGIN_REQUEST, data: null});

    try {
        // This is partial user profile we received when we login. We still need to make getMe for complete user profile.
        const loggedInUserProfile = await loginFunc();

        await handleLoginSuccess(dispatch, loggedInUserProfile);
    } catch (error) {
        dispatch({
            type: UserTypes.LOGIN_FAILURE,
            error,
        });
        dispatch(logError(error as ServerError));
        return {error};
    }

    return {data: true};
}

export function login(loginId: string, password: string, mfaToken = ''): ActionFuncAsync {
    return async (dispatch) => {
        return performLogin(dispatch, () => Client4.login(loginId, password, mfaToken));
    };
}

export function loginWithDesktopToken(token: string): ActionFuncAsync {
    return async (dispatch) => {
        return performLogin(dispatch, () => Client4.loginWithDesktopToken(token));
    };
}

export function loginById(id: string, password: string): ActionFuncAsync {
    return async (dispatch) => {
        return performLogin(dispatch, () => Client4.loginById(id, password, ''));
    };
}

export function getUserLoginType(loginId: string): ActionFuncAsync<{auth_service: 'magic_link' | ''; is_deactivated: boolean }> {
    return async (dispatch) => {
        try {
            const response = await Client4.getUserLoginType(loginId);
            return {data: {auth_service: response.auth_service ?? '', is_deactivated: response.is_deactivated ?? false}};
        } catch (error) {
            dispatch(logError(error as ServerError));
            return {error};
        }
    };
}
