// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export function buildQueryString(parameters: Record<string, any>): string {
    const keys = Object.keys(parameters);
    if (keys.length === 0) {
        return '';
    }

    const queryParams = Object.entries(parameters).
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        filter(([_, value]) => value !== undefined).
        map(([key, value]) => `${key}=${encodeURIComponent(value)}`).
        join('&');

    return queryParams.length > 0 ? `?${queryParams}` : '';
}
