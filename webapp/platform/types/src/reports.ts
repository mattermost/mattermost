// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserProfile} from './users';

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

export enum ReportDuration {
    AllTime = 'all_time',
    Last30Days = 'last_30_days',
    PreviousMonth = 'previous_month',
    Last6Months = 'last_6_months',
}

export enum CursorPaginationDirection {
    'prev' = 'prev',
    'next' = 'next',
}

export type UserReportFilter = {
    role_filter?: string;
    has_no_team?: boolean;
    team_filter?: string;
    hide_active?: boolean;
    hide_inactive?: boolean;
    search_term?: string;
}

export type UserReportOptions = UserReportFilter & {
    page_size?: number;

    // Following are optional sort parameters
    /**
     * The column to sort on. Provide the id of the column. Use the UserReportSortColumns enum.
     */
    sort_column?: UserReportSortColumns;

    /**
     * The sort direction to use. Either "asc" or "desc". Use the ReportSortDirection enum.
     */
    sort_direction?: ReportSortDirection;

    // Following are optional pagination parameters
    /**
     * The direction to paginate in. Either "up" or "down". Use the CursorPaginationDirection enum.
     */
    direction?: CursorPaginationDirection;

    /**
     * The cursor to paginate from.
     */
    from_column_value?: string;

    /**
     * The id of the user to paginate from.
     */
    from_id?: string;

    // Following are optional filters
    /**
     * The duration to filter by. Use the ReportDuration enum.
     */
    date_range?: ReportDuration;
};

export type UserReport = UserProfile & {
    last_login_at: number;
    last_status_at?: number;
    last_post_date?: number;
    days_active?: number;
    total_posts?: number;
}
