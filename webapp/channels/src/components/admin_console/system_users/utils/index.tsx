// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {UserReportSortColumns, ReportSortDirection} from '@mattermost/types/reports';
import type {UserReportOptions, UserReport} from '@mattermost/types/reports';

import {PAGE_SIZES, type SortingState} from 'components/admin_console/list_table';

import type {AdminConsoleUserManagementTableProperties} from 'types/store/views';

import {ColumnNames, RoleFilters, StatusFilter} from '../constants';
import type {TableOptions} from '../system_users';

export function convertTableOptionsToUserReportOptions(tableOptions?: TableOptions): UserReportOptions {
    return {
        page_size: tableOptions?.pageSize || PAGE_SIZES[0],
        from_column_value: tableOptions?.fromColumnValue,
        from_id: tableOptions?.fromId,
        direction: tableOptions?.direction,
        ...getSortColumnForOptions(tableOptions?.sortColumn),
        ...getSortDirectionForOptions(tableOptions?.sortIsDescending),
        search_term: tableOptions?.searchTerm,
        ...getUserStatusFilterOption(tableOptions?.filterStatus),
        ...getRoleFilterOption(tableOptions?.filterRole),
    };
}

/**
 * Converts the sorting column name to API compatible sorting column name. Default sorting column name is by username.
 */
export function getSortColumnForOptions(id?: SortingState[0]['id']): Pick<UserReportOptions, 'sort_column'> {
    let sortColumn: UserReportOptions['sort_column'];

    if (id === ColumnNames.email) {
        sortColumn = UserReportSortColumns.email;
    } else if (id === ColumnNames.createAt) {
        sortColumn = UserReportSortColumns.createAt;
    } else {
        // Default sorting to first User details column
        sortColumn = UserReportSortColumns.username;
    }

    return {
        sort_column: sortColumn,
    };
}

/**
 * Converts the sorting direction to API compatible sorting direction. Default sorting direction is ascending.
 */
export function getSortDirectionForOptions(desc?: SortingState[0]['desc']): Pick<UserReportOptions, 'sort_direction'> {
    let sortDirection: UserReportOptions['sort_direction'];

    if (desc) {
        sortDirection = ReportSortDirection.descending;
    } else {
        sortDirection = ReportSortDirection.ascending;
    }

    return {
        sort_direction: sortDirection,
    };
}

/**
 * It returns the value of that column on which sorting is applied.
 */
export function getSortableColumnValueBySortColumn(row: UserReport, sortColumn: AdminConsoleUserManagementTableProperties['sortColumn']): string {
    switch (sortColumn) {
    case ColumnNames.email:
        return row.email;
    case ColumnNames.createAt:
        return String(row.create_at);
    default:
        return row.username;
    }
}

export function getUserStatusFilterOption(status?: string): Partial<Pick<UserReportOptions, 'hide_active' | 'hide_inactive'>> {
    if (status === StatusFilter.Active) {
        return {
            hide_inactive: true,
        };
    } else if (status === StatusFilter.Deactivated) {
        return {
            hide_active: true,
        };
    }

    return {};
}

export function getPaginationInfo(pageIndex: number, pageSize: number, currentLength: number, total?: number) {
    if (!currentLength) {
        return (
            <FormattedMessage
                id='admin.system_users_list.pagination.no_users'
                defaultMessage='0 users'
            />
        );
    }

    const firstPage = (pageIndex * pageSize) + 1;
    const lastPage = (pageIndex * pageSize) + currentLength;
    const totalItems = total || 0;

    return (
        <FormattedMessage
            id='admin.system_users_list.pagination'
            defaultMessage='Showing {firstPage} - {lastPage} of {totalItems} users'
            values={{
                firstPage,
                lastPage,
                totalItems,
            }}
        />
    );
}

export function getDefaultValueFromList<T extends {value: string}>(value: string, options: T[]) {
    const option = options.find((option) => option.value === value);

    if (option) {
        return option;
    }

    return options[0];
}

export function getRoleFilterOption(role?: string): Pick<UserReportOptions, 'role_filter'> {
    if (!role || role === RoleFilters.Any) {
        return {role_filter: ''};
    }
    return {role_filter: role};
}
