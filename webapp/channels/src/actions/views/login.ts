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

export function getUserLoginType(loginId: string): ActionFuncAsync<'easy_login' | ''> {
    return async (dispatch) => {
        // try {
        //     // NOTE: Replace with actual API call when backend is ready
        //     // const response = await Client4.getUserLoginType(loginId);
        //     // return {data: response.login_type};

        //     // Mock response - check if user requires password
        //     await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate network delay

        //     // For now, check if username is 'rahimrahman' - these users need password
        //     if (loginId.toLowerCase() === 'rahimrahman') {
        //         return {data: 'password'};
        //     }

        //     return {data: 'passwordless'};
        // } catch (error) {
        //     dispatch(logError(error as ServerError));
        //     return {error};
        // }

        try {
            const response = await Client4.getUserLoginType(loginId);
            return {data: response.auth_service };
        } catch (error) {
            dispatch(logError(error as ServerError));
            return {error};
        }
    };
}

export function loginPasswordless(token: string): ActionFuncAsync {
    // mock
    return async (dispatch) => {
        dispatch({type: UserTypes.LOGIN_REQUEST, data: null});

        try {
            // NOTE: Replace with actual API call when backend is ready
            // await Client4.loginPasswordless(token);

            // Mock response - check if user requires password
            await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate network delay

            // For now, check if username is 'rahimrahman' - these users need password
            if (token.toLowerCase() === '1234') {
                return {
                    error: {
                        message: 'Password required',
                        server_error_id: 'api.user.login.password_required',
                    },
                };
            }

            return {data: true};
        } catch (error) {
            dispatch({type: UserTypes.LOGIN_FAILURE, error});
            dispatch(logError(error as ServerError));
            return {error};
        }
    };

    // return async (dispatch) => {
    //     return performLogin(dispatch, () => Client4.loginPasswordless(token));
    // };
}
