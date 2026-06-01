// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DateTime} from 'luxon';
import type {IntlShape} from 'react-intl';

import {DateTimeDisplayFormat} from '@mattermost/types/config';

export {DateTimeDisplayFormat};

export function isValidDateTimeDisplayFormat(value: string): value is DateTimeDisplayFormat {
    return value === DateTimeDisplayFormat.COMPACT ||
        value === DateTimeDisplayFormat.TIME_SECONDS ||
        value === DateTimeDisplayFormat.ISO_DATETIME;
}

export function isCompactDateTimeDisplayFormat(format: DateTimeDisplayFormat): boolean {
    return format === DateTimeDisplayFormat.COMPACT;
}

type FormatOptions = {
    timeZone?: string;
    useMilitaryTime?: boolean;
};

export function formatEventTimestamp(
    value: Date,
    format: DateTimeDisplayFormat,
    {timeZone, useMilitaryTime = false}: FormatOptions,
): string {
    const dt = timeZone ? DateTime.fromJSDate(value, {zone: timeZone}) : DateTime.fromJSDate(value);

    switch (format) {
    case DateTimeDisplayFormat.TIME_SECONDS:
        return useMilitaryTime ? dt.toFormat('HH:mm:ss') : dt.toFormat('h:mm:ss a');
    case DateTimeDisplayFormat.ISO_DATETIME: {
        const now = timeZone ? DateTime.now().setZone(timeZone) : DateTime.now();
        const datePart = dt.year === now.year ? dt.toFormat('MM-dd') : dt.toFormat('yyyy-MM-dd');
        const time = useMilitaryTime ? dt.toFormat('HH:mm:ss') : dt.toFormat('h:mm:ss a');
        return `${datePart} ${time}`;
    }
    case DateTimeDisplayFormat.COMPACT:
    default:
        return '';
    }
}

export function formatFullDateTimeForTooltip(
    value: Date,
    intl: IntlShape,
    {timeZone, useMilitaryTime = false}: FormatOptions,
): string {
    const date = intl.formatDate(value, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone,
    });
    const time = intl.formatTime(value, {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: !useMilitaryTime,
        timeZone,
    });

    return intl.formatMessage({
        id: 'timestamp.datetime',
        defaultMessage: '{relativeOrDate} at {time}',
    }, {
        relativeOrDate: date,
        time,
    });
}

export function getDateTimeDisplayFormatLabel(
    format: DateTimeDisplayFormat,
    intl: IntlShape,
): string {
    switch (format) {
    case DateTimeDisplayFormat.TIME_SECONDS:
        return intl.formatMessage({
            id: 'datetime_display_format.time_seconds',
            defaultMessage: 'Time with seconds (example: 3:45:05 PM)',
        });
    case DateTimeDisplayFormat.ISO_DATETIME:
        return intl.formatMessage({
            id: 'datetime_display_format.iso_datetime',
            defaultMessage: 'Date and time (example: 06-01 14:30:45)',
        });
    case DateTimeDisplayFormat.COMPACT:
    default:
        return intl.formatMessage({
            id: 'datetime_display_format.compact',
            defaultMessage: 'Compact (example: 3:45 PM)',
        });
    }
}

export function getDateTimeDisplayFormatShortLabel(
    format: DateTimeDisplayFormat,
    intl: IntlShape,
): string {
    switch (format) {
    case DateTimeDisplayFormat.TIME_SECONDS:
        return intl.formatMessage({
            id: 'datetime_display_format.time_seconds_short',
            defaultMessage: 'Time with seconds',
        });
    case DateTimeDisplayFormat.ISO_DATETIME:
        return intl.formatMessage({
            id: 'datetime_display_format.iso_datetime_short',
            defaultMessage: 'Date and time',
        });
    case DateTimeDisplayFormat.COMPACT:
    default:
        return intl.formatMessage({
            id: 'datetime_display_format.compact_short',
            defaultMessage: 'Compact',
        });
    }
}
