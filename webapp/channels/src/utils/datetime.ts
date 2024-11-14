// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DateTime} from 'luxon';
import moment, {type Moment} from 'moment-timezone';
import type {useIntl} from 'react-intl';

const shouldTruncate = new Map<Intl.RelativeTimeFormatUnit, boolean>([
    ['year', true],
    ['quarter', true],
    ['month', true],
    ['week', true],
    ['day', true],
    ['hour', false],
    ['minute', false],
    ['second', true],
]);

export function isWithin(
    a: Date,
    b: Date,
    timeZone: string = new Intl.DateTimeFormat().resolvedOptions().timeZone,
    unit: Intl.RelativeTimeFormatUnit,
    threshold = 1,
    truncateEndpoints = shouldTruncate.get(unit) || false,
): boolean {
    const diff = getDiff(a, b, timeZone, unit, truncateEndpoints);
    return threshold >= 0 ? diff <= threshold && diff >= 0 : diff >= threshold && diff <= 0;
}

export function isEqual(
    a: Date,
    b: Date,
    timeZone: string = new Intl.DateTimeFormat().resolvedOptions().timeZone,
    unit: Intl.RelativeTimeFormatUnit,
    threshold = 1,
    truncateEndpoints = shouldTruncate.get(unit) || false,
): boolean {
    return threshold === getDiff(a, b, timeZone, unit, truncateEndpoints);
}

export function getDiff(
    a: Date,
    b: Date,
    timeZone: string = new Intl.DateTimeFormat().resolvedOptions().timeZone,
    unit: Intl.RelativeTimeFormatUnit,
    truncateEndpoints = shouldTruncate.get(unit) || false,
): number {
    const momentA = moment.utc(a.getTime());
    const momentB = moment.utc(b.getTime());

    if (timeZone) {
        momentA.tz(timeZone);
        momentB.tz(timeZone);
    }

    return truncateEndpoints ? momentA.startOf(unit).diff(momentB.startOf(unit), unit) : momentA.diff(b, unit, true);
}

export function isSameDay(a: Date, b: Date = new Date()): boolean {
    return a.getDate() === b.getDate() && isSameMonth(a, b);
}

export function isWithinLastWeek(a: Date): boolean {
    return moment(a).isAfter(
        moment().subtract(6, 'days').startOf('day'),
    );
}

export function isSameMonth(a: Date, b: Date = new Date()): boolean {
    return a.getMonth() === b.getMonth() && isSameYear(a, b);
}

export function isSameYear(a: Date, b: Date = new Date()): boolean {
    return a.getFullYear() === b.getFullYear();
}

export function isToday(date: Date): boolean {
    return isSameDay(date);
}

export function isYesterday(date: Date): boolean {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    return isSameDay(date, yesterday);
}

export function toUTCUnix(date: Date): number {
    return Math.round(new Date(date.toISOString()).getTime() / 1000);
}

export function relativeFormatDate(date: Moment, formatMessage: ReturnType<typeof useIntl>['formatMessage'], format?: string): string {
    const now = moment();
    const inputDate = moment(date);

    if (inputDate.isSame(now, 'day')) {
        return formatMessage({id: 'date_separator.today', defaultMessage: 'Today'});
    } else if (inputDate.isSame(now.clone().subtract(1, 'days'), 'day')) {
        return formatMessage({id: 'date_separator.yesterday', defaultMessage: 'Yesterday'});
    } else if (inputDate.isSame(now.clone().add(1, 'days'), 'day')) {
        return formatMessage({id: 'date_separator.tomorrow', defaultMessage: 'Tomorrow'});
    }

    if (format) {
        return DateTime.fromJSDate(date.toDate()).toFormat(format);
    }

    return DateTime.fromJSDate(date.toDate()).toLocaleString();
}
