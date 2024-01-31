// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {SortingState} from '@tanstack/react-table';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import {UserReportSortColumns, ReportSortDirection} from '@mattermost/types/reports';
import type {UserReportOptions, UserReport} from '@mattermost/types/reports';
import type {Team} from '@mattermost/types/teams';

import {PAGE_SIZES} from 'components/admin_console/list_table';

import type {AdminConsoleUserManagementTableProperties} from 'types/store/views';

import {ColumnNames, RoleFilters, StatusFilter, TeamFilters} from '../constants';
import type {TableOptions} from '../system_users';
import type {OptionType as TeamFilterOptionType} from '../system_users_filters_popover/system_users_filter_team';

export function convertTableOptionsToUserReportOptions(tableOptions?: TableOptions): UserReportOptions {
    return {
        page_size: tableOptions?.pageSize || PAGE_SIZES[0],
        from_column_value: tableOptions?.fromColumnValue,
        from_id: tableOptions?.fromId,
        direction: tableOptions?.direction,
        ...getSortColumnForOptions(tableOptions?.sortColumn),
        ...getSortDirectionForOptions(tableOptions?.sortIsDescending),
        ...getSearchFilterOption(tableOptions?.searchTerm),
        ...getTeamFilterOption(tableOptions?.filterTeam),
        ...getStatusFilterOption(tableOptions?.filterStatus),
        ...getRoleFilterOption(tableOptions?.filterRole),
        date_range: tableOptions?.dateRange,
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

export function getTeamFilterOption(teamId?: string): Partial<Pick<UserReportOptions, 'team_filter' | 'has_no_team'>> {
    if (!teamId || teamId === TeamFilters.AllTeams) {
        return {
            team_filter: undefined,
            has_no_team: undefined,
        };
    } else if (teamId === TeamFilters.NoTeams) {
        return {
            team_filter: undefined,
            has_no_team: true,
        };
    }

    return {
        team_filter: teamId,
        has_no_team: undefined,
    };
}

export function getStatusFilterOption(status?: string): Partial<Pick<UserReportOptions, 'hide_active' | 'hide_inactive'>> {
    if (status === StatusFilter.Active) {
        return {
            hide_inactive: true,
        };
    } else if (status === StatusFilter.Deactivated) {
        return {
            hide_active: true,
        };
    }

    return {
        hide_active: undefined,
        hide_inactive: undefined,
    };
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

export function getDefaultSelectedValueFromList<T extends {value: string}>(value: string, options: T[]) {
    const option = options.find((option) => option.value === value);

    if (option) {
        return option;
    }

    return options[0];
}

export function getDefaultSelectedTeam(teamId: Team['id'] | string, label?: string): TeamFilterOptionType {
    if (!teamId || teamId === TeamFilters.AllTeams) {
        return {
            value: TeamFilters.AllTeams,
            label: (
                <FormattedMessage
                    id='admin.system_users.filters.team.allTeams'
                    defaultMessage='All Teams'
                />
            ),
        };
    } else if (teamId === TeamFilters.NoTeams) {
        return {
            value: TeamFilters.NoTeams,
            label: (
                <FormattedMessage
                    id='admin.system_users.filters.team.noTeams'
                    defaultMessage='No Teams'
                />
            ),
        };
    }

    return {
        value: teamId,
        label: label || '',
    };
}

export function getRoleFilterOption(role?: string): Pick<UserReportOptions, 'role_filter'> {
    if (!role || role === RoleFilters.Any) {
        return {role_filter: undefined};
    }
    return {role_filter: role};
}

export function getSearchFilterOption(search?: string): Pick<UserReportOptions, 'search_term'> {
    if (!search || search.trim().length === 0) {
        return {search_term: undefined};
    }

    return {search_term: search};
}
