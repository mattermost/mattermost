// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export enum LogLevel {
    Error = 'ERROR',
    Warning = 'WARNING',
    Info = 'INFO',
    Debug = 'DEBUG',
}

export type ClientResponse<T> = {
    response: Response;
    headers: Map<string, string>;
    data: T;
};

export type Options = {
    headers?: { [x: string]: string };
    method?: string;
    url?: string;
    credentials?: 'omit' | 'same-origin' | 'include';
    body?: any;
    signal?: RequestInit['signal'];
    ignoreStatus?: boolean; /** If true, status codes > 300 are ignored and don't cause an error */
};

export type StatusOK = {
    status: 'OK';
};

export type FetchPaginatedThreadOptions = {
    fetchThreads?: boolean;
    collapsedThreads?: boolean;
    collapsedThreadsExtended?: boolean;
    direction?: 'up'|'down';
    fetchAll?: boolean;
    perPage?: number;
    fromCreateAt?: number;
    fromPost?: string;
}

export enum ReportDuration {
    Last30Days = 'last_30_days',
    PreviousMonth = 'previous_month',
    Last6Months = 'last_6_months',
}

export type UserReportFilter = {
    role_filter?: string,
    has_no_team?: boolean,
    team_filter?: string,
    hide_active?: boolean,
    hide_inactive?: boolean,
    searchTerm?: string,
}

export type UserReportOptions = UserReportFilter & {
    sort_column: 'CreateAt' | 'Username' | 'FirstName' | 'LastName' | 'Nickname' | 'Email',
    page_size: number,
    sort_direction?: 'asc' | 'desc',
    direction?: 'up' | 'down',
    date_range?: ReportDuration,
    from_column_value?: string,
    from_id?: string,
}
