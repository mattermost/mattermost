// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment-timezone';

import type {TimestampDisplayMode} from 'mattermost-redux/selectors/entities/preferences';

import type {Props as TimestampProps} from './timestamp';

export function formatUtcOffsetLabel(offset: string): string {
    const match = /^([+-])(\d{2}):(\d{2})$/.exec(offset);
    if (!match) {
        return `UTC${offset}`;
    }

    const [, sign, hours, minutes] = match;
    if (minutes === '00') {
        return `UTC${sign}${hours}`;
    }

    return `UTC${sign}${hours}:${minutes}`;
}

export function formatIsoTimestamp(value: Date | number, timeZone = 'UTC'): string {
    const formatted = moment(value).tz(timeZone);
    return `${formatted.format('YYYY-MM-DD')}T${formatted.format('HH:mm:ss')}${formatted.format('Z')}`;
}

export function formatOffsetTimestamp(value: Date | number, timeZone = 'UTC'): string {
    const formatted = moment(value).tz(timeZone);
    const offsetLabel = formatUtcOffsetLabel(formatted.format('Z'));
    return `${formatted.format('YYYY-MM-DD')} at ${formatted.format('HH:mm:ss')} (${offsetLabel})`;
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

export function getOffsetTimestampProps(timeZone: string): Partial<TimestampProps> {
    return {
        timeZone,
        useRelative: false,
        useDate: false,
        useTime: false,
        children: ({value}) => formatOffsetTimestamp(value, timeZone),
    };
}

export function getTimestampDisplayProps(timeZone: string, mode: TimestampDisplayMode): Partial<TimestampProps> | undefined {
    if (mode === 'iso') {
        return getIsoTimestampProps(timeZone);
    }
    if (mode === 'offset') {
        return getOffsetTimestampProps(timeZone);
    }
    return undefined;
}
