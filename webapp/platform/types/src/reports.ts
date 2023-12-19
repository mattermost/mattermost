// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {UserProfile} from './users';

export enum UserReportSortColumns {
    username = "Username",
    email = "Email",
    createAt = "CreateAt",
    firstName = "FirstName",
    lastName = "LastName",
    nickname = "Nickname",
}

export enum ReportSortDirection {
    ascending = "asc",
    descending = "desc",
}

export enum ReportDuration {
    Last30Days = "last_30_days",
    PreviousMonth = "previous_month",
    Last6Months = "last_6_months",
}

export enum CursorPaginationDirection {
    'up' = 'up',
    'down' = 'down',
}

export type UserReportOptions = {
    page_size: number;

    // The following fields are used for sorting
    sort_column: UserReportSortColumns;
    sort_direction?: ReportSortDirection;

    // The following fields are used for cursor pagination
    direction?: CursorPaginationDirection,
    from_column_value?: string;
    from_id?: string;

    // The following fields are used for filtering
    date_range?: ReportDuration;
    role_filter?: string;
    team_filter?: string;
    has_no_team?: boolean;
    hide_active?: boolean;
    hide_inactive?: boolean;
};

export type UserReport = {
    id: UserProfile['id'];
    username: UserProfile['username'];
    email: UserProfile['email'];
    create_at: UserProfile['create_at'];
    display_name: string;
    roles: UserProfile['roles'];
    last_login_at: number;
	last_status_at?: number;
	last_post_date?: number;
	days_active?: number;
	total_posts?: number;
}
