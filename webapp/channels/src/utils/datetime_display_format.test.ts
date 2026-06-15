// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DateTime} from 'luxon';

import {TimestampFormat} from '@mattermost/types/config';

import {
    formatAbsoluteDateAndTime,
    formatDateAndTimeInline,
    formatFullDateTimeForTooltip,
    formatInlineTimestamp,
    formatRelativeTimestamp,
    formatStandardTime,
    getTimestampFormatLabel,
    getTimestampFormatOptionDisplayNameValues,
    getTimestampFormatTimeExample,
    isValidTimestampFormat,
    resolveTimestampDisplayTier,
    resolveAdminShowTimestampSeconds,
    shouldWrapPostTimestamp,
    supportsTimestampSeconds,
} from './datetime_display_format';

describe('datetime_display_format', () => {
    const value = new Date('2020-01-01T12:00:00.000Z');
    const timeZone = 'America/New_York';
    const longRelativeTimeOptions = {style: 'long', numeric: 'auto'} as const;

    test('isValidTimestampFormat', () => {
        expect(isValidTimestampFormat('standard')).toBe(true);
        expect(isValidTimestampFormat('relative')).toBe(true);
        expect(isValidTimestampFormat('date_and_time')).toBe(true);
        expect(isValidTimestampFormat('invalid')).toBe(false);
    });

    test('formatStandardTime with seconds', () => {
        const formatted = formatStandardTime(value, {
            timeZone,
            useMilitaryTime: false,
            showTimestampSeconds: true,
        });

        const expected = DateTime.fromJSDate(value, {zone: timeZone}).toFormat('h:mm:ss a');
        expect(formatted).toBe(expected);
    });

    test('formatStandardTime 24-hour', () => {
        const formatted = formatStandardTime(value, {
            timeZone,
            useMilitaryTime: true,
        });

        const expected = DateTime.fromJSDate(value, {zone: timeZone}).toFormat('HH:mm');
        expect(formatted).toBe(expected);
    });

    test('formatAbsoluteDateAndTime never uses relative labels', () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2020-06-15T12:00:00.000Z'));

        const tomorrow = new Date('2020-06-16T16:30:00.000Z');
        const formatted = formatAbsoluteDateAndTime(tomorrow, {
            timeZone,
            useMilitaryTime: false,
        });

        const dt = DateTime.fromJSDate(tomorrow, {zone: timeZone});
        expect(formatted).toBe(`${dt.toFormat('LLL d')}, ${dt.toFormat('h:mm a')}`);
        expect(formatted).not.toMatch(/Today|Tomorrow|Yesterday/i);

        jest.useRealTimers();
    });

    test('formatInlineTimestamp uses absolute date for scheduled posts', () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2020-06-15T12:00:00.000Z'));

        const tomorrow = new Date('2020-06-16T16:30:00.000Z');
        const formatted = formatInlineTimestamp(tomorrow, TimestampFormat.RELATIVE, {
            timeZone,
            useMilitaryTime: false,
            context: 'scheduled_post',
        });

        const dt = DateTime.fromJSDate(tomorrow, {zone: timeZone});
        expect(formatted).toBe(`${dt.toFormat('LLL d')}, ${dt.toFormat('h:mm a')}`);

        jest.useRealTimers();
    });

    test('formatDateAndTimeInline includes year for other years', () => {
        const formatted = formatDateAndTimeInline(value, {
            timeZone,
            useMilitaryTime: true,
        });

        const dt = DateTime.fromJSDate(value, {zone: timeZone});
        expect(formatted).toBe(`${dt.toFormat('LLL d yyyy')}, ${dt.toFormat('HH:mm')}`);
    });

    test('formatInlineTimestamp uses inline tier for standard thread list', () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2020-06-15T12:00:00.000Z'));

        const sameYearValue = new Date('2020-06-01T18:30:45.000Z');
        const formatted = formatInlineTimestamp(sameYearValue, TimestampFormat.STANDARD, {
            timeZone,
            useMilitaryTime: true,
            context: 'thread_list',
        });

        const dt = DateTime.fromJSDate(sameYearValue, {zone: timeZone});
        expect(formatted).toBe(`${dt.toFormat('LLL d')}, ${dt.toFormat('HH:mm')}`);

        jest.useRealTimers();
    });

    test('resolveAdminShowTimestampSeconds uses admin console state when present', () => {
        expect(resolveAdminShowTimestampSeconds(
            {DisplaySettings: {ShowTimestampSeconds: false}},
            {'DisplaySettings.ShowTimestampSeconds': true},
        )).toBe(true);

        expect(resolveAdminShowTimestampSeconds(
            {DisplaySettings: {ShowTimestampSeconds: true}},
            {'DisplaySettings.ShowTimestampSeconds': false},
        )).toBe(false);

        expect(resolveAdminShowTimestampSeconds(
            {DisplaySettings: {ShowTimestampSeconds: true}},
            {},
        )).toBe(true);
    });

    test('getTimestampFormatOptionDisplayNameValues matches time example helper', () => {
        expect(getTimestampFormatOptionDisplayNameValues({showTimestampSeconds: true})).toEqual({
            timeExample: '4:32:07 PM',
        });
    });

    test('supportsTimestampSeconds only for standard and date and time formats', () => {
        expect(supportsTimestampSeconds(TimestampFormat.STANDARD)).toBe(true);
        expect(supportsTimestampSeconds(TimestampFormat.DATE_AND_TIME)).toBe(true);
        expect(supportsTimestampSeconds(TimestampFormat.RELATIVE)).toBe(false);
    });

    test('resolveTimestampDisplayTier for compact or consecutive posts', () => {
        expect(resolveTimestampDisplayTier(TimestampFormat.DATE_AND_TIME, 'post', undefined, true)).toBe('time_only');
        expect(resolveTimestampDisplayTier(TimestampFormat.RELATIVE, 'post', undefined, true)).toBe('time_only');
        expect(resolveTimestampDisplayTier(TimestampFormat.RELATIVE, 'post', undefined, false)).toBe('inline');
        expect(resolveTimestampDisplayTier(TimestampFormat.STANDARD, 'thread_list')).toBe('inline');
    });

    test('formatInlineTimestamp uses narrow relative time when space is constrained', () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2020-06-15T12:00:00.000Z'));

        const intl = {
            formatMessage: jest.fn(({defaultMessage}) => defaultMessage),
            formatRelativeTime: jest.fn((diff: number, unit: string) => `${diff}${unit}`),
            formatDate: jest.fn(),
        };
        const twoDaysAgo = new Date('2020-06-13T12:00:00.000Z');
        const formatted = formatInlineTimestamp(twoDaysAgo, TimestampFormat.RELATIVE, {
            timeZone,
            useMilitaryTime: false,
            forceTimeOnly: true,
            intl: intl as any,
        });

        expect(intl.formatRelativeTime).toHaveBeenCalledWith(-2, 'day', {style: 'narrow', numeric: 'always'});
        expect(formatted).toBe('-2day');

        jest.useRealTimers();
    });

    test('formatInlineTimestamp omits seconds when space is constrained', () => {
        const formatted = formatInlineTimestamp(value, TimestampFormat.DATE_AND_TIME, {
            timeZone,
            useMilitaryTime: false,
            showTimestampSeconds: true,
            forceTimeOnly: true,
        });

        expect(formatted).toBe(formatStandardTime(value, {timeZone, useMilitaryTime: false, showTimestampSeconds: false}));
    });

    test('shouldWrapPostTimestamp for inline date and time only', () => {
        expect(shouldWrapPostTimestamp(TimestampFormat.DATE_AND_TIME, false)).toBe(true);
        expect(shouldWrapPostTimestamp(TimestampFormat.DATE_AND_TIME, true)).toBe(false);
        expect(shouldWrapPostTimestamp(TimestampFormat.STANDARD, false)).toBe(false);
    });

    test('getTimestampFormatTimeExample reflects clock and seconds settings', () => {
        expect(getTimestampFormatTimeExample()).toBe('4:32 PM');
        expect(getTimestampFormatTimeExample({useMilitaryTime: true})).toBe('16:32');
        expect(getTimestampFormatTimeExample({showTimestampSeconds: true})).toBe('4:32:07 PM');
        expect(getTimestampFormatTimeExample({useMilitaryTime: true, showTimestampSeconds: true})).toBe('16:32:07');
    });

    test('getTimestampFormatLabel uses selected clock format in examples', () => {
        const intl = {
            formatMessage: jest.fn(({defaultMessage}, values) => defaultMessage.replace('{timeExample}', values.timeExample)),
        };

        expect(getTimestampFormatLabel(TimestampFormat.STANDARD, intl as any, {useMilitaryTime: true})).toBe('Standard (example: 16:32)');
        expect(getTimestampFormatLabel(TimestampFormat.DATE_AND_TIME, intl as any, {useMilitaryTime: true})).toBe('Date and Time (example: Jun 1, 16:32)');
    });

    test('formatRelativeTimestamp supports narrow relative style', () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2020-06-15T12:00:00.000Z'));

        const intl = {
            formatMessage: jest.fn(({defaultMessage}) => defaultMessage),
            formatRelativeTime: jest.fn((value: number, unit: string) => `${value}${unit}`),
            formatDate: jest.fn(),
        };

        const twoWeeksAgo = new Date('2020-06-01T12:00:00.000Z');
        formatRelativeTimestamp(twoWeeksAgo, {timeZone, intl: intl as any, relativeStyle: 'narrow'});

        expect(intl.formatRelativeTime).toHaveBeenCalledWith(-2, 'week', {style: 'narrow', numeric: 'always'});

        jest.useRealTimers();
    });

    test('formatRelativeTimestamp uses master RHS relative thresholds', () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2020-06-15T12:00:00.000Z'));

        const intl = {
            formatMessage: jest.fn(({defaultMessage}) => defaultMessage),
            formatRelativeTime: jest.fn((value: number, unit: string) => `${value} ${unit}`),
            formatDate: jest.fn((date: Date, options: {month?: string; day?: string; year?: string}) => {
                const dt = DateTime.fromJSDate(date, {zone: timeZone});
                if (options.year) {
                    return dt.toFormat('LLL d yyyy');
                }
                return dt.toFormat('LLL d');
            }),
        };

        const threeHoursAgo = new Date('2020-06-15T09:00:00.000Z');
        formatRelativeTimestamp(threeHoursAgo, {timeZone, intl: intl as any});
        expect(intl.formatRelativeTime).toHaveBeenCalledWith(expect.any(Number), 'hour', longRelativeTimeOptions);

        intl.formatRelativeTime.mockClear();

        const twoDaysAgo = new Date('2020-06-13T12:00:00.000Z');
        formatRelativeTimestamp(twoDaysAgo, {timeZone, intl: intl as any});
        expect(intl.formatRelativeTime).toHaveBeenCalledWith(expect.any(Number), 'day', longRelativeTimeOptions);

        intl.formatRelativeTime.mockClear();

        const twoMonthsAgo = new Date('2020-04-15T12:00:00.000Z');
        formatRelativeTimestamp(twoMonthsAgo, {timeZone, intl: intl as any});
        expect(intl.formatRelativeTime).toHaveBeenCalledWith(expect.any(Number), 'month', longRelativeTimeOptions);

        intl.formatRelativeTime.mockClear();

        const twoYearsAgo = new Date('2018-06-15T12:00:00.000Z');
        formatRelativeTimestamp(twoYearsAgo, {timeZone, intl: intl as any});
        expect(intl.formatRelativeTime).toHaveBeenCalledWith(expect.any(Number), 'year', longRelativeTimeOptions);

        jest.useRealTimers();
    });

    test('formatRelativeTimestamp rounds fractional relative diffs', () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2020-06-15T12:00:00.000Z'));

        const intl = {
            formatMessage: jest.fn(({defaultMessage}) => defaultMessage),
            formatRelativeTime: jest.fn((value: number, unit: string) => `${value} ${unit}`),
            formatDate: jest.fn(),
        };

        const twelveMinutesAgo = new Date('2020-06-15T11:47:18.120Z');
        formatRelativeTimestamp(twelveMinutesAgo, {timeZone, intl: intl as any});

        expect(intl.formatRelativeTime).toHaveBeenCalledWith(-13, 'minute', longRelativeTimeOptions);

        jest.useRealTimers();
    });

    test('formatRelativeTimestamp falls back to absolute date after relative range', () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2020-06-15T12:00:00.000Z'));

        const intl = {
            formatMessage: jest.fn(({defaultMessage}) => defaultMessage),
            formatRelativeTime: jest.fn((value: number, unit: string) => `${value} ${unit}`),
            formatDate: jest.fn((date: Date, options: {month?: string; day?: string; year?: string}) => {
                const dt = DateTime.fromJSDate(date, {zone: timeZone});
                if (options.year) {
                    return dt.toFormat('LLL d yyyy');
                }
                return dt.toFormat('LLL d');
            }),
        };

        const veryOld = new Date('1018-06-15T12:00:00.000Z');
        const formatted = formatRelativeTimestamp(veryOld, {timeZone, intl: intl as any});

        expect(intl.formatRelativeTime).not.toHaveBeenCalled();
        expect(formatted).toBe('Jun 15 1018');

        jest.useRealTimers();
    });

    test('formatFullDateTimeForTooltip includes seconds', () => {
        const intl = {
            formatDate: jest.fn(() => 'Wednesday, January 1, 2020'),
            formatTime: jest.fn(() => '7:00:00 AM'),
            formatMessage: jest.fn(({defaultMessage}, values) => defaultMessage.replace('{relativeOrDate}', values.relativeOrDate).replace('{time}', values.time)),
        };

        const formatted = formatFullDateTimeForTooltip(value, intl as any, {
            timeZone,
            useMilitaryTime: false,
        });

        expect(intl.formatTime).toHaveBeenCalledWith(value, expect.objectContaining({second: '2-digit'}));
        expect(formatted).toBe('Wednesday, January 1, 2020 at 7:00:00 AM');
    });
});
