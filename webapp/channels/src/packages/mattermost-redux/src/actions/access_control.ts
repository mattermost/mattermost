// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ServerError} from '@mattermost/types/errors';
import { forceLogoutIfNecessary} from './helpers';
import { ActionFuncAsync } from 'mattermost-redux/types/actions';
import type { AccessControlPolicy } from '@mattermost/types/admin';
import {Client4} from 'mattermost-redux/client';
import {AdminTypes} from 'mattermost-redux/action_types';

export function getAccessControlPolicy(id: string): ActionFuncAsync<AccessControlPolicy> {
    console.log('getAccessControlPolicy', id);

    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.getAccessControlPolicy(id);
        } catch (error) {
            forceLogoutIfNecessary(error as ServerError, dispatch, getState);
            dispatch(
                {
                    type: AdminTypes.RECEIVED_ACCESS_CONTROL_POLICY,
                    error,
                },
            );
            return {error};
        }

        dispatch(
            {type: AdminTypes.RECEIVED_ACCESS_CONTROL_POLICY, data},
        );

        return {data};
    };
}

export function getAccessControlPolicies(page: number, perPage: number): ActionFuncAsync<AccessControlPolicy[]> {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.getAccessControlPolicies(page, perPage);
        } catch (error) {
            forceLogoutIfNecessary(error as ServerError, dispatch, getState);
            dispatch(
                {
                    type: AdminTypes.RECEIVED_ACCESS_CONTROL_POLICIES,
                    error,
                },
            );
            return {error};
        }

        dispatch(
            {type: AdminTypes.RECEIVED_ACCESS_CONTROL_POLICIES, data},
        );

        return {data};
    };
}