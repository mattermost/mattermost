// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ServerError} from '@mattermost/types/errors';
import type {UserReportOptions, UserReport, UserReportFilter, ReportDuration} from '@mattermost/types/reports';

import {logError} from 'mattermost-redux/actions/errors';
import {forceLogoutIfNecessary} from 'mattermost-redux/actions/helpers';
import {Client4} from 'mattermost-redux/client';
import type {ActionFuncAsync} from 'mattermost-redux/types/actions';

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
export function setAdminConsoleUsersManagementTableProperties(data?: Partial<AdminConsoleUserManagementTableProperties>) {
    if (!data) {
        return {
            type: ActionTypes.CLEAR_ADMIN_CONSOLE_USER_MANAGEMENT_TABLE_PROPERTIES,
            data: null,
        };
    }

    return {
        type: ActionTypes.SET_ADMIN_CONSOLE_USER_MANAGEMENT_TABLE_PROPERTIES,
        data,
    };
}

export function getUserReports(options = {} as UserReportOptions): ActionFuncAsync<UserReport[]> {
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

export function getUserCountForReporting(filter = {} as UserReportFilter): ActionFuncAsync<number> {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.getUserCountForReporting(filter);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error: error as ServerError};
        }

        return {data};
    };
}

export function startUsersBatchExport(dateRange: ReportDuration): ActionFuncAsync {
    return async (dispatch, getState) => {
        try {
            await Client4.startUsersBatchExport(dateRange);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error: error as ServerError};
        }

        return {data: true};
    };
}
