// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export enum UserReportDuration {
    Last30Days = 'last_30_days',
    PreviousMonth = 'previous_month',
    Last6Months = 'last_6_months',
}

export enum UserReportSortColumns {
    username = 'Username',
    email = 'Email',
    createAt = 'CreateAt',
    firstName = 'FirstName',
    lastName = 'LastName',
    nickname = 'Nickname',
}

export enum ReportSortDirection {
    ascending = 'asc',
    descending = 'desc',
}

export type UserReportOptions = {
    sort_column: UserReportSortColumns,
    page_size: number,
    sort_direction?: ReportSortDirection,
    date_range?: UserReportDuration,
    last_column_value?: string,
    last_id?: string,
    role_filter?: string,
    has_no_team?: boolean,
    team_filter?: string,
    hide_active?: boolean,
    hide_inactive?: boolean,
}
