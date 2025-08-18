// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment-timezone';

import {
    DateReference,
    stringToMoment,
    momentToString,
    resolveRelativeDate,
    validateDateRange,
    getDefaultTime,
    combineDateAndTime,
    type DateValidationError,
} from './date_utils';

describe('date_utils', () => {
    const testTimezone = 'America/New_York';

    beforeEach(() => {
        // Mock current time to a fixed date for consistent testing
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2025-01-15T10:00:00.000Z'));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('stringToMoment', () => {
        it('should convert ISO date string to moment', () => {
            const result = stringToMoment('2025-01-15', testTimezone);
            expect(result).toBeTruthy();
            expect(result!.format('YYYY-MM-DD')).toBe('2025-01-15');
        });

        it('should convert ISO datetime string to moment', () => {
            const result = stringToMoment('2025-01-15T14:30:00Z', testTimezone);
            expect(result).toBeTruthy();
            expect(result!.utc().format('YYYY-MM-DDTHH:mm:ss')).toBe('2025-01-15T14:30:00');
        });

        it('should return null for invalid date', () => {
            // Suppress moment.js deprecation warning for this test
            const originalWarn = console.warn;
            console.warn = jest.fn();

            const result = stringToMoment('invalid-date', testTimezone);
            expect(result).toBeNull();

            // Restore console.warn
            console.warn = originalWarn;
        });

        it('should return null for null input', () => {
            const result = stringToMoment(null, testTimezone);
            expect(result).toBeNull();
        });

        it('should resolve relative dates', () => {
            const result = stringToMoment('today', testTimezone);
            expect(result).toBeTruthy();
            expect(result!.format('YYYY-MM-DD')).toBe('2025-01-15');
        });

        it('should accept datetime strings in date-only fields and extract date portion', () => {
            const result = stringToMoment('2025-01-15T14:30:00Z', testTimezone, false); // false = date-only
            expect(result).toBeTruthy();

            // Time should be based on the date portion only, not the original time
            expect(result!.format('YYYY-MM-DD')).toBe('2025-01-15');
        });

        it('should accept various datetime formats in date-only fields', () => {
            const formats = [
                '2025-01-15T14:30:00Z',
                '2025-01-15T14:30:00',
                '2025-01-15T14:30',
                '2025-01-15T14:30:00.123Z',
                '2025-01-15T14:30:00-05:00',
            ];

            formats.forEach((format) => {
                const result = stringToMoment(format, testTimezone, false); // false = date-only
                expect(result).toBeTruthy();
                expect(result!.format('YYYY-MM-DD')).toBe('2025-01-15');
            });
        });

        it('should accept datetime strings in datetime fields', () => {
            const result = stringToMoment('2025-01-15T14:30:00Z', testTimezone, true); // true = datetime
            expect(result).toBeTruthy();
            expect(result!.utc().format('YYYY-MM-DDTHH:mm:ss')).toBe('2025-01-15T14:30:00');
        });

        it('should reject time-only strings in date-only fields', () => {
            const result = stringToMoment('14:30', testTimezone, false); // false = date-only
            expect(result).toBeNull();
        });

        it('should accept date strings in date-only fields', () => {
            const result = stringToMoment('2025-01-15', testTimezone, false); // false = date-only
            expect(result).toBeTruthy();
            expect(result!.format('YYYY-MM-DD')).toBe('2025-01-15');
        });

        it('should handle relative dates more efficiently without double conversion', () => {
            // This tests that we use the direct moment result from resolveRelativeDateToMoment
            // instead of converting moment -> string -> moment
            const result = stringToMoment('today', testTimezone);
            expect(result).toBeTruthy();
            expect(result!.format('YYYY-MM-DD')).toBe('2025-01-15');

            const resultTomorrow = stringToMoment('+1d', testTimezone);
            expect(resultTomorrow).toBeTruthy();
            expect(resultTomorrow!.format('YYYY-MM-DD')).toBe('2025-01-16');
        });
    });

    describe('momentToString', () => {
        it('should convert moment to date string', () => {
            const momentValue = moment('2025-01-15T14:30:00Z');
            const result = momentToString(momentValue, false);
            expect(result).toBe('2025-01-15');
        });

        it('should convert moment to datetime string', () => {
            const momentValue = moment('2025-01-15T14:30:00Z');
            const result = momentToString(momentValue, true);
            expect(result).toBe('2025-01-15T14:30Z');
        });

        it('should return null for null input', () => {
            const result = momentToString(null, false);
            expect(result).toBeNull();
        });

        it('should return null for invalid moment', () => {
            const invalidMoment = moment('invalid');
            const result = momentToString(invalidMoment, false);
            expect(result).toBeNull();
        });
    });

    describe('resolveRelativeDate', () => {
        it('should resolve TODAY to current date', () => {
            const result = resolveRelativeDate(DateReference.TODAY, testTimezone);
            expect(result).toBe('2025-01-15');
        });

        it('should resolve TOMORROW to next day', () => {
            const result = resolveRelativeDate(DateReference.TOMORROW, testTimezone);
            expect(result).toBe('2025-01-16');
        });

        it('should resolve YESTERDAY to previous day', () => {
            const result = resolveRelativeDate(DateReference.YESTERDAY, testTimezone);
            expect(result).toBe('2025-01-14');
        });

        it('should resolve +7d to 7 days from now', () => {
            const result = resolveRelativeDate('+7d', testTimezone);
            expect(result).toBe('2025-01-22');
        });

        it('should resolve +1H to 1 hour from now', () => {
            const result = resolveRelativeDate('+1H', testTimezone);
            expect(result).toBe('2025-01-15T11:00Z');
        });

        it('should resolve dynamic patterns like +5d', () => {
            const result = resolveRelativeDate('+5d', testTimezone);
            expect(result).toBe('2025-01-20');
        });

        it('should resolve dynamic patterns like +2w', () => {
            const result = resolveRelativeDate('+2w', testTimezone);
            expect(result).toBe('2025-01-29');
        });

        it('should resolve dynamic patterns like +1M', () => {
            const result = resolveRelativeDate('+1M', testTimezone);
            expect(result).toBe('2025-02-15');
        });

        it('should return input unchanged for non-relative dates', () => {
            const result = resolveRelativeDate('2025-12-25', testTimezone);
            expect(result).toBe('2025-12-25');
        });
    });

    describe('validateDateRange', () => {
        const testLocale = 'en-US';

        it('should pass validation for date within range', () => {
            const result = validateDateRange(
                '2025-01-15',
                '2025-01-01',
                '2025-01-31',
                testTimezone,
                testLocale,
            );
            expect(result).toBeNull();
        });

        it('should return structured error for date before min', () => {
            const result = validateDateRange(
                '2025-01-01',
                '2025-01-15',
                '2025-01-31',
                testTimezone,
                testLocale,
            ) as DateValidationError;
            expect(result).toBeTruthy();
            expect(result.id).toBe('apps_form.date_field.min_date_error');
            expect(result.defaultMessage).toBe('Date must be after {minDate}');
            expect(result.values?.minDate).toMatch(/Jan 15, 2025/);
        });

        it('should return structured error for date after max', () => {
            const result = validateDateRange(
                '2025-01-31',
                '2025-01-01',
                '2025-01-15',
                testTimezone,
                testLocale,
            ) as DateValidationError;
            expect(result).toBeTruthy();
            expect(result.id).toBe('apps_form.date_field.max_date_error');
            expect(result.defaultMessage).toBe('Date must be before {maxDate}');
            expect(result.values?.maxDate).toMatch(/Jan 15, 2025/);
        });

        it('should handle relative min/max dates', () => {
            const result = validateDateRange(
                '2025-01-10',
                'today',
                '+7d',
                testTimezone,
                testLocale,
            ) as DateValidationError;
            expect(result).toBeTruthy();
            expect(result.id).toBe('apps_form.date_field.min_date_error');
            expect(result.values?.minDate).toMatch(/Jan 15, 2025/); // today is mocked as 2025-01-15
        });

        it('should return null for null date', () => {
            const result = validateDateRange(null, '2025-01-01', '2025-01-31', testTimezone, testLocale);
            expect(result).toBeNull();
        });

        it('should return structured error for invalid date format', () => {
            const result = validateDateRange('invalid-date', '2025-01-01', '2025-01-31', testTimezone, testLocale) as DateValidationError;
            expect(result).toBeTruthy();
            expect(result.id).toBe('apps_form.date_field.invalid_format');
            expect(result.defaultMessage).toBe('Invalid date format');
        });

        it('should format dates according to locale preferences', () => {
            // Test with different locale
            const result = validateDateRange(
                '2025-01-01',
                '2025-01-15',
                '2025-01-31',
                testTimezone,
                'fr-FR', // French locale
            ) as DateValidationError;
            expect(result).toBeTruthy();
            expect(result.values?.minDate).toBeTruthy();

            // French locale should format dates differently than en-US
        });
    });

    describe('getDefaultTime', () => {
        it('should return provided valid time', () => {
            const result = getDefaultTime('14:30');
            expect(result).toBe('14:30');
        });

        it('should return midnight for invalid time format', () => {
            const result = getDefaultTime('25:00');
            expect(result).toBe('00:00');
        });

        it('should return midnight for undefined', () => {
            const result = getDefaultTime();
            expect(result).toBe('00:00');
        });

        it('should validate time format correctly', () => {
            expect(getDefaultTime('00:00')).toBe('00:00');
            expect(getDefaultTime('23:59')).toBe('23:59');
            expect(getDefaultTime('12:30')).toBe('12:30');
            expect(getDefaultTime('24:00')).toBe('00:00'); // Invalid
            expect(getDefaultTime('12:60')).toBe('00:00'); // Invalid
        });
    });

    describe('combineDateAndTime', () => {
        it('should combine date and time into UTC datetime string', () => {
            const result = combineDateAndTime('2025-01-15', '14:30', testTimezone);
            expect(result).toBe('2025-01-15T19:30Z'); // EST to UTC conversion
        });

        it('should handle midnight time', () => {
            const result = combineDateAndTime('2025-01-15', '00:00', testTimezone);
            expect(result).toBe('2025-01-15T05:00Z'); // EST to UTC conversion
        });

        it('should work without timezone (uses local timezone)', () => {
            // Set timezone to UTC for consistent testing
            moment.tz.setDefault('UTC');

            const result = combineDateAndTime('2025-01-15', '14:30');
            expect(result).toBe('2025-01-15T14:30Z');
            moment.tz.setDefault();
        });
    });
});
