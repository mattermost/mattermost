// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment-timezone';

import type {Props as TimestampProps} from './timestamp';

export function formatIsoTimestamp(value: Date | number, timeZone = 'UTC'): string {
    const formatted = moment(value).tz(timeZone);
    return `${formatted.format('YYYY-MM-DD')}T${formatted.format('HH:mm:ss')}${formatted.format('Z')}`;
}

export const formatUtcTimestamp = formatIsoTimestamp;

export function getIsoTimestampProps(timeZone: string): Partial<TimestampProps> {
    return {
        timeZone,
        useRelative: false,
        useDate: false,
        useTime: false,
        children: ({value}) => formatIsoTimestamp(value, timeZone),
    };
}
