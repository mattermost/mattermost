// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {batchActions} from 'redux-batched-actions';

import type {ServerError} from '@mattermost/types/errors';
import type {UserReportOptions, UserReport} from '@mattermost/types/reports';

import {logError} from 'mattermost-redux/actions/errors';
import {forceLogoutIfNecessary} from 'mattermost-redux/actions/helpers';
import {Client4} from 'mattermost-redux/client';
import type {ActionFunc} from 'mattermost-redux/types/actions';

import {ActionTypes} from 'utils/constants';

import type {AdminConsoleUserManagementTableProperties} from 'types/store/views';

export function setNeedsLoggedInLimitReachedCheck(data: boolean) {
    return {
        type: ActionTypes.NEEDS_LOGGED_IN_LIMIT_REACHED_CHECK,
        data,
    };
}

/**
 * Action to set the properties of the admin console user management table. Only pass the properties you want to set/modify. If you pass no properties, the table properties will be cleared.
 */
export function setAdminConsoleUsersManagementTableProperties(data?: Partial<AdminConsoleUserManagementTableProperties>): ActionFunc<boolean> {
    return (dispatch) => {
        const actions = [];
        if (data && 'sortColumn' in data) {
            actions.push({
                type: ActionTypes.SET_ADMIN_CONSOLE_USER_MANAGEMENT_SORT_COLUMN,
                data: data.sortColumn,
            });
        }

        if (data && 'sortIsDescending' in data) {
            actions.push({
                type: ActionTypes.SET_ADMIN_CONSOLE_USER_MANAGEMENT_SORT_ORDER,
                data: data.sortIsDescending,
            });
        }

        if (data && 'pageSize' in data) {
            actions.push({
                type: ActionTypes.SET_ADMIN_CONSOLE_USER_MANAGEMENT_PAGE_SIZE,
                data: data.pageSize,
            });
        }

        if (actions.length === 0) {
            dispatch({
                type: ActionTypes.CLEAR_ADMIN_CONSOLE_USER_MANAGEMENT_TABLE_PROPERTIES,
            });
        } else {
            dispatch(batchActions(actions));
        }
        return {data: true};
    };
}

export function getUserReports(options = {} as UserReportOptions): ActionFunc<UserReport[], ServerError> {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.getUsersForReporting(options);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error: error as ServerError};
        }

        return {data};
    };
}
