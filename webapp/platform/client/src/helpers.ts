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

// extractFilenameFromContentDisposition returns the filename advertised by a Content-Disposition
// response header, falling back to the given name when the header is missing or unparsable.
export function extractFilenameFromContentDisposition(header: string | null | undefined, fallback: string): string {
    if (!header) {
        return fallback;
    }

    const regex = /filename\*?=["']?((?:\\.|[^"'\s])+)(?=["']?)/g;
    const matches = regex.exec(header);

    return matches ? matches[1] : fallback;
}
