// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment-timezone';

import type {TimestampDisplayMode} from 'mattermost-redux/selectors/entities/preferences';

import type {Props as TimestampProps} from './timestamp';

export function formatIsoTimestamp(value: Date | number, timeZone = 'UTC'): string {
    const formatted = moment(value).tz(timeZone);
    return `${formatted.format('YYYY-MM-DD')}T${formatted.format('HH:mm:ss')}${formatted.format('Z')}`;
}

export function formatFullTimestamp(value: Date | number, timeZone = 'UTC'): string {
    const formatted = moment(value).tz(timeZone);
    return `${formatted.format('YYYY-MM-DD')} at ${formatted.format('HH:mm:ss')}`;
}

export function getIsoTimestampProps(timeZone: string): Partial<TimestampProps> {
    return {
        timeZone,
        useRelative: false,
        useDate: false,
        useTime: false,
        children: ({value}) => formatIsoTimestamp(value, timeZone),
    };
}

export function getFullTimestampProps(timeZone: string): Partial<TimestampProps> {
    return {
        timeZone,
        useRelative: false,
        useDate: false,
        useTime: false,
        children: ({value}) => formatFullTimestamp(value, timeZone),
    };
}

export function getTimestampDisplayProps(timeZone: string, mode: TimestampDisplayMode): Partial<TimestampProps> | undefined {
    if (mode === 'iso') {
        return getIsoTimestampProps(timeZone);
    }
    if (mode === 'full') {
        return getFullTimestampProps(timeZone);
    }
    return undefined;
}
