// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DateTime} from 'luxon';

import {DateTimeDisplayFormat} from '@mattermost/types/config';

import {
    formatEventTimestamp,
    formatFullDateTimeForTooltip,
    isCompactDateTimeDisplayFormat,
    isValidDateTimeDisplayFormat,
} from './datetime_display_format';

describe('datetime_display_format', () => {
    const value = new Date('2020-01-01T12:00:00.000Z');
    const timeZone = 'America/New_York';

    test('isValidDateTimeDisplayFormat', () => {
        expect(isValidDateTimeDisplayFormat('compact')).toBe(true);
        expect(isValidDateTimeDisplayFormat('time_seconds')).toBe(true);
        expect(isValidDateTimeDisplayFormat('iso_datetime')).toBe(true);
        expect(isValidDateTimeDisplayFormat('invalid')).toBe(false);
    });

    test('isCompactDateTimeDisplayFormat', () => {
        expect(isCompactDateTimeDisplayFormat(DateTimeDisplayFormat.COMPACT)).toBe(true);
        expect(isCompactDateTimeDisplayFormat(DateTimeDisplayFormat.ISO_DATETIME)).toBe(false);
    });

    test('formatEventTimestamp time_seconds 12-hour', () => {
        const formatted = formatEventTimestamp(value, DateTimeDisplayFormat.TIME_SECONDS, {
            timeZone,
            useMilitaryTime: false,
        });

        const expected = DateTime.fromJSDate(value, {zone: timeZone}).toFormat('h:mm:ss a');
        expect(formatted).toBe(expected);
    });

    test('formatEventTimestamp time_seconds 24-hour', () => {
        const formatted = formatEventTimestamp(value, DateTimeDisplayFormat.TIME_SECONDS, {
            timeZone,
            useMilitaryTime: true,
        });

        const expected = DateTime.fromJSDate(value, {zone: timeZone}).toFormat('HH:mm:ss');
        expect(formatted).toBe(expected);
    });

    test('formatEventTimestamp date and time includes year for other years', () => {
        const formatted = formatEventTimestamp(value, DateTimeDisplayFormat.ISO_DATETIME, {
            timeZone,
            useMilitaryTime: true,
        });

        const dt = DateTime.fromJSDate(value, {zone: timeZone});
        expect(formatted).toBe(`${dt.toFormat('yyyy-MM-dd')} ${dt.toFormat('HH:mm:ss')}`);
    });

    test('formatEventTimestamp date and time omits year for current year', () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2020-06-15T12:00:00.000Z'));

        const sameYearValue = new Date('2020-06-01T18:30:45.000Z');
        const formatted = formatEventTimestamp(sameYearValue, DateTimeDisplayFormat.ISO_DATETIME, {
            timeZone,
            useMilitaryTime: true,
        });

        const dt = DateTime.fromJSDate(sameYearValue, {zone: timeZone});
        expect(formatted).toBe(`${dt.toFormat('MM-dd')} ${dt.toFormat('HH:mm:ss')}`);

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
