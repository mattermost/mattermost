// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DateTime} from 'luxon';

import {TimestampFormat} from '@mattermost/types/config';

import {
    formatAbsoluteDateAndTime,
    formatDateAndTimeInline,
    formatFullDateTimeForTooltip,
    formatInlineTimestamp,
    formatStandardTime,
    isCompactDateTimeDisplayFormat,
    isValidTimestampFormat,
    resolveTimestampDisplayTier,
    shouldWrapPostTimestamp,
} from './datetime_display_format';

describe('datetime_display_format', () => {
    const value = new Date('2020-01-01T12:00:00.000Z');
    const timeZone = 'America/New_York';

    test('isValidTimestampFormat', () => {
        expect(isValidTimestampFormat('standard')).toBe(true);
        expect(isValidTimestampFormat('relative')).toBe(true);
        expect(isValidTimestampFormat('date_and_time')).toBe(true);
        expect(isValidTimestampFormat('invalid')).toBe(false);
    });

    test('isCompactDateTimeDisplayFormat', () => {
        expect(isCompactDateTimeDisplayFormat(TimestampFormat.STANDARD)).toBe(true);
        expect(isCompactDateTimeDisplayFormat(TimestampFormat.DATE_AND_TIME)).toBe(false);
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

    test('resolveTimestampDisplayTier for compact or consecutive posts', () => {
        expect(resolveTimestampDisplayTier(TimestampFormat.DATE_AND_TIME, 'post', undefined, true)).toBe('time_only');
        expect(resolveTimestampDisplayTier(TimestampFormat.RELATIVE, 'post', undefined, true)).toBe('time_only');
        expect(resolveTimestampDisplayTier(TimestampFormat.RELATIVE, 'post', undefined, false)).toBe('inline');
        expect(resolveTimestampDisplayTier(TimestampFormat.STANDARD, 'thread_list')).toBe('inline');
    });

    test('formatInlineTimestamp uses time only when space is constrained', () => {
        const formatted = formatInlineTimestamp(value, TimestampFormat.RELATIVE, {
            timeZone,
            useMilitaryTime: false,
            forceTimeOnly: true,
        });

        expect(formatted).toBe(formatStandardTime(value, {timeZone, useMilitaryTime: false}));
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
