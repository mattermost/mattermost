// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {batchActions} from 'redux-batched-actions';

import type {ServerError} from '@mattermost/types/errors';

import {UserTypes} from 'mattermost-redux/action_types';
import {logError} from 'mattermost-redux/actions/errors';
import {loadRolesIfNeeded} from 'mattermost-redux/actions/roles';
import {Client4} from 'mattermost-redux/client';

import type {ActionFuncAsync} from 'types/store';

export function login(loginId: string, password: string, mfaToken = ''): ActionFuncAsync {
    return async (dispatch) => {
        dispatch({type: UserTypes.LOGIN_REQUEST, data: null});

        try {
            // This is partial user profile we recieved when we login. We still need to make getMe for complete user profile.
            const loggedInUserProfile = await Client4.login(loginId, password, mfaToken);

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
        } catch (error) {
            dispatch({
                type: UserTypes.LOGIN_FAILURE,
                error,
            });
            dispatch(logError(error as ServerError));
            return {error};
        }

        return {data: true};
    };
}

export function loginWithDesktopToken(token: string): ActionFuncAsync {
    return async (dispatch) => {
        dispatch({type: UserTypes.LOGIN_REQUEST, data: null});

        try {
            // This is partial user profile we recieved when we login. We still need to make getMe for complete user profile.
            const loggedInUserProfile = await Client4.loginWithDesktopToken(token);

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
        } catch (error) {
            dispatch({
                type: UserTypes.LOGIN_FAILURE,
                error,
            });
            dispatch(logError(error as ServerError));
            return {error};
        }

        return {data: true};
    };
}

export function loginById(id: string, password: string): ActionFuncAsync {
    return async (dispatch) => {
        dispatch({type: UserTypes.LOGIN_REQUEST, data: null});

        try {
            const loggedInUserProfile = await Client4.loginById(id, password, '');

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
        } catch (error) {
            dispatch({
                type: UserTypes.LOGIN_FAILURE,
                error,
            });
            dispatch(logError(error as ServerError));
            return {error};
        }

        return {data: true};
    };
}
