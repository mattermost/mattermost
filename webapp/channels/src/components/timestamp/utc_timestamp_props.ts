// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Props as TimestampProps} from './timestamp';

export function formatUtcTimestamp(value: Date | number): string {
    const date = value instanceof Date ? value : new Date(value);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hour = String(date.getUTCHours()).padStart(2, '0');
    const minute = String(date.getUTCMinutes()).padStart(2, '0');

    return `${year}-${month}-${day} ${hour}:${minute} UTC`;
}

export const UTC_TIMESTAMP_PROPS: Partial<TimestampProps> = {
    timeZone: 'UTC',
    useRelative: false,
    useDate: false,
    useTime: false,
    children: ({value}) => formatUtcTimestamp(value),
};
