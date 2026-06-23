// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DateTime} from 'luxon';
import type {IntlShape} from 'react-intl';

import {TimestampFormat} from '@mattermost/types/config';

import {getDiff, isWithin} from 'utils/datetime';

export {TimestampFormat};

export type TimestampDisplayContext = 'post' | 'thread_list' | 'thread_footer' | 'scheduled_post' | 'metadata';
export type TimestampDisplayTier = 'inline' | 'time_only';

type FormatOptions = {
    timeZone?: string;
    useMilitaryTime?: boolean;
    showTimestampSeconds?: boolean;
    relativeStyle?: 'long' | 'narrow';
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

export function supportsTimestampSeconds(format: TimestampFormat): boolean {
    return format === TimestampFormat.STANDARD || format === TimestampFormat.DATE_AND_TIME;
}

export function shouldWrapPostTimestamp(format: TimestampFormat, forceTimeOnly: boolean): boolean {
    return format === TimestampFormat.DATE_AND_TIME && !forceTimeOnly;
}

export function resolveTimestampDisplayTier(
    format: TimestampFormat,
    context: TimestampDisplayContext,
    explicitTier?: TimestampDisplayTier,
    forceTimeOnly = false,
): TimestampDisplayTier {
    if (explicitTier) {
        return explicitTier;
    }

    if (context === 'thread_list' || context === 'thread_footer' || context === 'scheduled_post' || context === 'metadata') {
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

export function formatAbsoluteDateAndTime(
    value: Date,
    {timeZone, useMilitaryTime = false, showTimestampSeconds = false}: FormatOptions,
): string {
    const dt = getDateTime(value, timeZone);
    const now = getNow(timeZone);
    const time = formatStandardTime(value, {timeZone, useMilitaryTime, showTimestampSeconds});

    if (dt.hasSame(now, 'year')) {
        return `${dt.toFormat('LLL d')}, ${time}`;
    }

    return `${dt.toFormat('LLL d yyyy')}, ${time}`;
}

// Matches current RHS THREADING_TIME extended units in relative_ranges STANDARD_UNITS.
const RELATIVE_TIMESTAMP_UNITS: Array<{unit: Intl.RelativeTimeFormatUnit; threshold: number}> = [
    {unit: 'minute', threshold: -59},
    {unit: 'hour', threshold: -23.75},
    {unit: 'day', threshold: -6},
    {unit: 'week', threshold: -3},
    {unit: 'month', threshold: -11},
    {unit: 'year', threshold: -1000},
];

function formatRelativeTimestampFallback(
    value: Date,
    intl: IntlShape,
    timeZone?: string,
): string {
    const dt = getDateTime(value, timeZone);
    const now = getNow(timeZone);

    if (dt.hasSame(now, 'year')) {
        return intl.formatDate(value, {month: 'short', day: 'numeric', timeZone});
    }

    return intl.formatDate(value, {month: 'short', day: 'numeric', year: 'numeric', timeZone});
}

export function formatRelativeTimestamp(
    value: Date,
    {timeZone, intl, relativeStyle = 'long'}: FormatOptions & {intl: IntlShape},
): string {
    const resolvedTimeZone = timeZone || new Intl.DateTimeFormat().resolvedOptions().timeZone;
    const now = getNow(timeZone).toJSDate();
    const relativeTimeOptions: Intl.RelativeTimeFormatOptions = relativeStyle === 'narrow' ?
        {style: 'narrow', numeric: 'always'} :
        {style: 'long', numeric: 'auto'};

    if (isWithin(value, now, resolvedTimeZone, 'second', -45)) {
        return intl.formatMessage({id: 'timestamp.justNow', defaultMessage: 'just now'});
    }

    for (const {unit, threshold} of RELATIVE_TIMESTAMP_UNITS) {
        if (isWithin(value, now, resolvedTimeZone, unit, threshold)) {
            let diff = getDiff(value, now, resolvedTimeZone, unit);
            diff = Math.round(diff);
            if (diff === 0) {
                diff = value <= now ? -0 : +0;
            }
            return intl.formatRelativeTime(diff, unit, relativeTimeOptions);
        }
    }

    return formatRelativeTimestampFallback(value, intl, timeZone);
}

export function formatInlineTimestamp(
    value: Date,
    format: TimestampFormat,
    options: InlineFormatOptions,
): string {
    const context = options.context || 'post';

    if (context === 'scheduled_post') {
        return formatAbsoluteDateAndTime(value, {...options, showTimestampSeconds: false});
    }

    const tier = resolveTimestampDisplayTier(format, context, options.tier, options.forceTimeOnly);
    const formatOptions = options.forceTimeOnly ? {...options, showTimestampSeconds: false} : options;

    if (tier === 'time_only') {
        if (format === TimestampFormat.RELATIVE && formatOptions.intl) {
            return formatRelativeTimestamp(value, {
                ...formatOptions,
                intl: formatOptions.intl,
                relativeStyle: 'narrow',
            });
        }
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

export function getTimestampFormatTimeExample(
    {useMilitaryTime = false, showTimestampSeconds = false}: FormatOptions = {},
): string {
    if (useMilitaryTime) {
        return showTimestampSeconds ? '16:32:07' : '16:32';
    }

    return showTimestampSeconds ? '4:32:07 PM' : '4:32 PM';
}

type AdminDisplaySettingsConfig = {
    DisplaySettings?: {
        ShowTimestampSeconds?: boolean;
    };
};

export function resolveAdminShowTimestampSeconds(
    config: AdminDisplaySettingsConfig,
    state: Record<string, unknown>,
): boolean {
    const stateValue = state['DisplaySettings.ShowTimestampSeconds'];
    if (stateValue != null) {
        return stateValue === true || stateValue === 'true';
    }

    return config.DisplaySettings?.ShowTimestampSeconds === true;
}

export function getTimestampFormatOptionDisplayNameValues(options: FormatOptions = {}) {
    return {
        timeExample: getTimestampFormatTimeExample(options),
    };
}

export function getTimestampFormatLabel(
    format: TimestampFormat,
    intl: IntlShape,
    options?: FormatOptions,
): string {
    const timeExample = getTimestampFormatTimeExample(options);

    switch (format) {
    case TimestampFormat.RELATIVE:
        return intl.formatMessage({
            id: 'timestamp_format.relative',
            defaultMessage: 'Relative (example: 3 hours ago)',
        });
    case TimestampFormat.DATE_AND_TIME:
        return intl.formatMessage({
            id: 'timestamp_format.date_and_time',
            defaultMessage: 'Date and Time (example: Jun 1, {timeExample})',
        }, {timeExample});
    case TimestampFormat.STANDARD:
    default:
        return intl.formatMessage({
            id: 'timestamp_format.standard',
            defaultMessage: 'Standard (example: {timeExample})',
        }, {timeExample});
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
