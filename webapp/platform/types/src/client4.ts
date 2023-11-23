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
