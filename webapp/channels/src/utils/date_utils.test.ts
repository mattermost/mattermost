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
} from './date_utils';

describe('date_utils', () => {
    const testTimezone = 'America/New_York';

    beforeEach(() => {
        // Mock current time to a fixed date for consistent testing
        jest.spyOn(Date, 'now').mockImplementation(() =>
            new Date('2025-01-15T10:00:00.000Z').getTime(),
        );
    });

    afterEach(() => {
        jest.restoreAllMocks();
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
            const result = stringToMoment('invalid-date', testTimezone);
            expect(result).toBeNull();
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
            expect(result).toBe('2025-01-15T14:30:00Z');
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

        it('should resolve +7D to 7 days from now', () => {
            const result = resolveRelativeDate(DateReference.PLUS_7D, testTimezone);
            expect(result).toBe('2025-01-22');
        });

        it('should resolve +1H to 1 hour from now', () => {
            const result = resolveRelativeDate(DateReference.PLUS_1H, testTimezone);
            expect(result).toBe('2025-01-15T11:00:00Z');
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
        it('should pass validation for date within range', () => {
            const result = validateDateRange(
                '2025-01-15',
                '2025-01-01',
                '2025-01-31',
                testTimezone,
            );
            expect(result).toBeNull();
        });

        it('should fail validation for date before min', () => {
            const result = validateDateRange(
                '2025-01-01',
                '2025-01-15',
                '2025-01-31',
                testTimezone,
            );
            expect(result).toContain('Date must be after');
        });

        it('should fail validation for date after max', () => {
            const result = validateDateRange(
                '2025-01-31',
                '2025-01-01',
                '2025-01-15',
                testTimezone,
            );
            expect(result).toContain('Date must be before');
        });

        it('should handle relative min/max dates', () => {
            const result = validateDateRange(
                '2025-01-10',
                'today',
                '+7d',
                testTimezone,
            );
            expect(result).toContain('Date must be after');
        });

        it('should return null for null date', () => {
            const result = validateDateRange(null, '2025-01-01', '2025-01-31', testTimezone);
            expect(result).toBeNull();
        });

        it('should return error for invalid date format', () => {
            const result = validateDateRange('invalid-date', '2025-01-01', '2025-01-31', testTimezone);
            expect(result).toBe('Invalid date format');
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
            expect(result).toBe('2025-01-15T19:30:00Z'); // EST to UTC conversion
        });

        it('should handle midnight time', () => {
            const result = combineDateAndTime('2025-01-15', '00:00', testTimezone);
            expect(result).toBe('2025-01-15T05:00:00Z'); // EST to UTC conversion
        });

        it('should work without timezone', () => {
            const result = combineDateAndTime('2025-01-15', '14:30');
            expect(result).toMatch(/2025-01-15T\d{2}:30:00Z/); // Will depend on system timezone
        });
    });
});
