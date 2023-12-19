// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ServerError} from '@mattermost/types/errors';
import type {UserReportOptions, UserReport} from '@mattermost/types/reports';

import {logError} from 'mattermost-redux/actions/errors';
import {forceLogoutIfNecessary} from 'mattermost-redux/actions/helpers';
import {Client4} from 'mattermost-redux/client';
import type {ActionFunc} from 'mattermost-redux/types/actions';

import {ActionTypes} from 'utils/constants';

export function setNeedsLoggedInLimitReachedCheck(data: boolean) {
    return {
        type: ActionTypes.NEEDS_LOGGED_IN_LIMIT_REACHED_CHECK,
        data,
    };
}

export function setAdminConsoleUsersManagementSortColumn(sortColumn: string) {
    return {
        type: ActionTypes.SET_ADMIN_CONSOLE_USER_MANAGEMENT_SORT_COLUMN,
        data: sortColumn,
    };
}

export function setAdminConsoleUsersManagementSortOrder(sortIsDescending: boolean) {
    return {
        type: ActionTypes.SET_ADMIN_CONSOLE_USER_MANAGEMENT_SORT_ORDER,
        data: sortIsDescending,
    };
}

export function setAdminConsoleUsersManagementPageSize(pageSize: number) {
    return {
        type: ActionTypes.SET_ADMIN_CONSOLE_USER_MANAGEMENT_PAGE_SIZE,
        data: pageSize,
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

        // const adminConsoleUserManagementActions = [];
        // if ('page_size' in options) {
        //     adminConsoleUserManagementActions.push(setAdminConsoleUsersManagementPageSize(options.page_size));
        // }

        // if (options.sort_column?.length) {
        //     adminConsoleUserManagementActions.push(setAdminConsoleUsersManagementSortColumn(options.sort_column));
        // }

        // if (options?.sort_direction?.length) {
        //     adminConsoleUserManagementActions.push(setAdminConsoleUsersManagementSortOrder(options.sort_direction));
        // }

        // if (adminConsoleUserManagementActions.length) {
        //     dispatch(batchActions(adminConsoleUserManagementActions));
        // }

        return {data};
    };
}
