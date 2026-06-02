// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DateTime} from 'luxon';
import type {IntlShape} from 'react-intl';

import {TimestampFormat} from '@mattermost/types/config';

export {TimestampFormat};

export type TimestampDisplayContext = 'post' | 'thread_list' | 'thread_footer';
export type TimestampDisplayTier = 'inline' | 'time_only';

type FormatOptions = {
    timeZone?: string;
    useMilitaryTime?: boolean;
    showTimestampSeconds?: boolean;
};

type InlineFormatOptions = FormatOptions & {
    context?: TimestampDisplayContext;
    tier?: TimestampDisplayTier;
    forceTimeOnly?: boolean;
    intl?: IntlShape;
};

const LEGACY_FORMAT_MAP: Record<string, TimestampFormat> = {
    compact: TimestampFormat.STANDARD,
    time_seconds: TimestampFormat.STANDARD,
    iso_datetime: TimestampFormat.DATE_AND_TIME,
    standard: TimestampFormat.STANDARD,
    relative: TimestampFormat.RELATIVE,
    date_and_time: TimestampFormat.DATE_AND_TIME,
};

export function normalizeTimestampFormat(value: string | undefined): TimestampFormat | undefined {
    if (!value) {
        return undefined;
    }

    return LEGACY_FORMAT_MAP[value];
}

export function isValidTimestampFormat(value: string): value is TimestampFormat {
    return value === TimestampFormat.STANDARD ||
        value === TimestampFormat.RELATIVE ||
        value === TimestampFormat.DATE_AND_TIME;
}

export function shouldShowDateSeparatorsInThreads(format: TimestampFormat): boolean {
    return format === TimestampFormat.STANDARD;
}

export function shouldWrapPostTimestamp(format: TimestampFormat, forceTimeOnly: boolean): boolean {
    return format === TimestampFormat.DATE_AND_TIME && !forceTimeOnly;
}

/** @deprecated Use shouldWrapPostTimestamp */
export const shouldStackPostTimestamp = shouldWrapPostTimestamp;

export function resolveTimestampDisplayTier(
    format: TimestampFormat,
    context: TimestampDisplayContext,
    explicitTier?: TimestampDisplayTier,
    forceTimeOnly = false,
): TimestampDisplayTier {
    if (explicitTier) {
        return explicitTier;
    }

    if (context === 'thread_list' || context === 'thread_footer') {
        return 'inline';
    }

    if (forceTimeOnly || format === TimestampFormat.STANDARD) {
        return 'time_only';
    }

    return 'inline';
}

function getDateTime(value: Date, timeZone?: string) {
    return timeZone ? DateTime.fromJSDate(value, {zone: timeZone}) : DateTime.fromJSDate(value);
}

function getNow(timeZone?: string) {
    return timeZone ? DateTime.now().setZone(timeZone) : DateTime.now();
}

export function formatStandardTime(
    value: Date,
    {timeZone, useMilitaryTime = false, showTimestampSeconds = false}: FormatOptions,
): string {
    const dt = getDateTime(value, timeZone);

    if (useMilitaryTime) {
        return showTimestampSeconds ? dt.toFormat('HH:mm:ss') : dt.toFormat('HH:mm');
    }

    return showTimestampSeconds ? dt.toFormat('h:mm:ss a') : dt.toFormat('h:mm a');
}

export function formatDateAndTimeInline(
    value: Date,
    {timeZone, useMilitaryTime = false, showTimestampSeconds = false}: FormatOptions,
): string {
    const dt = getDateTime(value, timeZone);
    const now = getNow(timeZone);
    const time = formatStandardTime(value, {timeZone, useMilitaryTime, showTimestampSeconds});

    if (dt.hasSame(now, 'day')) {
        return `Today, ${time}`;
    }

    if (dt.hasSame(now.minus({days: 1}), 'day')) {
        return `Yesterday, ${time}`;
    }

    if (dt >= now.startOf('week') && dt < now.startOf('day')) {
        return `${dt.toFormat('ccc LLL d')}, ${time}`;
    }

    if (dt.hasSame(now, 'year')) {
        return `${dt.toFormat('LLL d')}, ${time}`;
    }

    return `${dt.toFormat('LLL d yyyy')}, ${time}`;
}

export function formatRelativeTimestamp(
    value: Date,
    {timeZone, useMilitaryTime = false, showTimestampSeconds = false, intl}: FormatOptions & {intl: IntlShape},
): string {
    const dt = getDateTime(value, timeZone);
    const now = getNow(timeZone);
    const diffSeconds = Math.floor(now.diff(dt, 'seconds').seconds);

    if (diffSeconds < 45) {
        return intl.formatMessage({id: 'timestamp.justNow', defaultMessage: 'just now'});
    }

    if (diffSeconds < 3600) {
        const minutes = Math.max(1, Math.floor(diffSeconds / 60));
        return intl.formatRelativeTime(-minutes, 'minute');
    }

    if (diffSeconds < 86400) {
        const hours = Math.max(1, Math.floor(diffSeconds / 3600));
        return intl.formatRelativeTime(-hours, 'hour');
    }

    const time = formatStandardTime(value, {timeZone, useMilitaryTime, showTimestampSeconds});

    if (dt.hasSame(now.minus({days: 1}), 'day')) {
        return intl.formatMessage({id: 'timestamp.yesterdayAt', defaultMessage: 'Yesterday at {time}'}, {time});
    }

    if (dt >= now.minus({days: 6}).startOf('day')) {
        const weekday = intl.formatDate(value, {weekday: 'long', timeZone});
        return intl.formatMessage({id: 'timestamp.weekdayAt', defaultMessage: '{weekday} at {time}'}, {weekday, time});
    }

    if (dt.hasSame(now, 'year')) {
        return intl.formatDate(value, {month: 'short', day: 'numeric', timeZone});
    }

    return intl.formatDate(value, {month: 'short', day: 'numeric', year: 'numeric', timeZone});
}

export function formatInlineTimestamp(
    value: Date,
    format: TimestampFormat,
    options: InlineFormatOptions,
): string {
    const context = options.context || 'post';
    const tier = resolveTimestampDisplayTier(format, context, options.tier, options.forceTimeOnly);
    const formatOptions = options.forceTimeOnly ? {...options, showTimestampSeconds: false} : options;

    if (tier === 'time_only') {
        return formatStandardTime(value, formatOptions);
    }

    switch (format) {
    case TimestampFormat.RELATIVE:
        if (!formatOptions.intl) {
            return formatStandardTime(value, formatOptions);
        }
        return formatRelativeTimestamp(value, {...formatOptions, intl: formatOptions.intl});
    case TimestampFormat.DATE_AND_TIME:
        return formatDateAndTimeInline(value, formatOptions);
    case TimestampFormat.STANDARD:
    default:
        if (tier === 'inline') {
            return formatDateAndTimeInline(value, formatOptions);
        }
        return formatStandardTime(value, formatOptions);
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

export function getTimestampFormatLabel(
    format: TimestampFormat,
    intl: IntlShape,
): string {
    switch (format) {
    case TimestampFormat.RELATIVE:
        return intl.formatMessage({
            id: 'timestamp_format.relative',
            defaultMessage: 'Relative (example: 3 hours ago · Yesterday at 4:32 PM)',
        });
    case TimestampFormat.DATE_AND_TIME:
        return intl.formatMessage({
            id: 'timestamp_format.date_and_time',
            defaultMessage: 'Date and Time (example: Jun 1, 4:32 PM)',
        });
    case TimestampFormat.STANDARD:
    default:
        return intl.formatMessage({
            id: 'timestamp_format.standard',
            defaultMessage: 'Standard (example: 4:32 PM)',
        });
    }
}

export function getTimestampFormatShortLabel(
    format: TimestampFormat,
    intl: IntlShape,
): string {
    switch (format) {
    case TimestampFormat.RELATIVE:
        return intl.formatMessage({
            id: 'timestamp_format.relative_short',
            defaultMessage: 'Relative',
        });
    case TimestampFormat.DATE_AND_TIME:
        return intl.formatMessage({
            id: 'timestamp_format.date_and_time_short',
            defaultMessage: 'Date and Time',
        });
    case TimestampFormat.STANDARD:
    default:
        return intl.formatMessage({
            id: 'timestamp_format.standard_short',
            defaultMessage: 'Standard',
        });
    }
}

/** @deprecated Use getTimestampFormatLabel */
export const getDateTimeDisplayFormatLabel = getTimestampFormatLabel;

/** @deprecated Use getTimestampFormatShortLabel */
export const getDateTimeDisplayFormatShortLabel = getTimestampFormatShortLabel;

/** @deprecated Use isValidTimestampFormat */
export function isValidDateTimeDisplayFormat(value: string): value is TimestampFormat {
    return isValidTimestampFormat(value) || Boolean(LEGACY_FORMAT_MAP[value]);
}

/** @deprecated Use TimestampFormat.STANDARD checks */
export function isCompactDateTimeDisplayFormat(format: TimestampFormat): boolean {
    return format === TimestampFormat.STANDARD;
}

/** @deprecated Use formatInlineTimestamp */
export function formatEventTimestamp(
    value: Date,
    format: TimestampFormat,
    options: FormatOptions,
): string {
    return formatInlineTimestamp(value, format, options);
}
