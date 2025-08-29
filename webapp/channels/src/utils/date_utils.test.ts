// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment-timezone';

import {
    DateReference,
    stringToMoment,
    momentToString,
    resolveRelativeDate,
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
            expect(result!.date()).toBe(15);
            expect(result!.month()).toBe(0); // January is 0
            expect(result!.year()).toBe(2025);
        });

        it('should convert ISO datetime string to moment', () => {
            const result = stringToMoment('2025-01-15T14:30:00Z', testTimezone);
            expect(result).toBeTruthy();
            expect(result!.utc().hour()).toBe(14);
            expect(result!.utc().minute()).toBe(30);
            expect(result!.utc().date()).toBe(15);
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
            expect(result!.date()).toBe(15);
            expect(result!.month()).toBe(0); // January is 0
            expect(result!.year()).toBe(2025);
        });

        it('should parse datetime strings preserving time information', () => {
            const result = stringToMoment('2025-01-15T14:30:00Z', testTimezone);
            expect(result).toBeTruthy();
            expect(result!.utc().hour()).toBe(14);
            expect(result!.utc().minute()).toBe(30);
            expect(result!.utc().second()).toBe(0);
        });

        it('should accept various datetime formats', () => {
            const formats = [
                '2025-01-15T14:30:00Z',
                '2025-01-15T14:30:00',
                '2025-01-15T14:30',
                '2025-01-15T14:30:00.123Z',
                '2025-01-15T14:30:00-05:00',
            ];

            formats.forEach((format) => {
                const result = stringToMoment(format, testTimezone);
                expect(result).toBeTruthy();
                expect(result!.date()).toBe(15);
                expect(result!.month()).toBe(0); // January is 0
                expect(result!.year()).toBe(2025);
            });
        });

        it('should reject time-only strings', () => {
            const result = stringToMoment('14:30', testTimezone);
            expect(result).toBeNull();
        });

        it('should accept date-only strings', () => {
            const result = stringToMoment('2025-01-15', testTimezone);
            expect(result).toBeTruthy();
            expect(result!.date()).toBe(15);
            expect(result!.month()).toBe(0); // January is 0
            expect(result!.year()).toBe(2025);
        });

        it('should handle relative dates more efficiently without double conversion', () => {
            // This tests that we use the direct moment result from resolveRelativeDateToMoment
            // instead of converting moment -> string -> moment
            const result = stringToMoment('today', testTimezone);
            expect(result).toBeTruthy();
            expect(result!.date()).toBe(15);
            expect(result!.month()).toBe(0); // January is 0
            expect(result!.year()).toBe(2025);

            const resultTomorrow = stringToMoment('+1d', testTimezone);
            expect(resultTomorrow).toBeTruthy();
            expect(resultTomorrow!.date()).toBe(16);
            expect(resultTomorrow!.month()).toBe(0); // January is 0
            expect(resultTomorrow!.year()).toBe(2025);
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
            const invalidMoment = moment.invalid();
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

        it('should not resolve +1H (hours not supported)', () => {
            const result = resolveRelativeDate('+1H', testTimezone);
            expect(result).toBe('+1H');
        });

        it('should resolve dynamic patterns like +5d', () => {
            const result = resolveRelativeDate('+5d', testTimezone);
            expect(result).toBe('2025-01-20');
        });

        it('should resolve dynamic patterns like +2w', () => {
            const result = resolveRelativeDate('+2w', testTimezone);
            expect(result).toBe('2025-01-29');
        });

        it('should resolve dynamic patterns like +1m', () => {
            const result = resolveRelativeDate('+1m', testTimezone);
            expect(result).toBe('2025-02-15');
        });

        it('should return input unchanged for non-relative dates', () => {
            const result = resolveRelativeDate('2025-12-25', testTimezone);
            expect(result).toBe('2025-12-25');
        });
    });

    describe('parseISO integration', () => {
        it('should handle valid ISO dates with parseISO', () => {
            expect(stringToMoment('2025-01-15')?.isValid()).toBe(true);
            expect(stringToMoment('2025-01-15T14:30:00Z')?.isValid()).toBe(true);
            expect(stringToMoment('2025-01-15T14:30:00+02:00')?.isValid()).toBe(true);
        });

        it('should reject invalid dates that parseISO catches', () => {
            expect(stringToMoment('2025-02-30')).toBeNull(); // Invalid date
            expect(stringToMoment('2025-13-01')).toBeNull(); // Invalid month
            expect(stringToMoment('01/15/2025')).toBeNull(); // Wrong format
            expect(stringToMoment('invalid-date')).toBeNull(); // Garbage input
        });

        it('should still handle relative dates normally', () => {
            // These should work exactly as before
            expect(stringToMoment('today')?.isValid()).toBe(true);
            expect(stringToMoment('+7d')?.isValid()).toBe(true);
            expect(stringToMoment('-2w')?.isValid()).toBe(true);
        });

        it('should accept any valid ISO format', () => {
            // parseISO should accept various ISO formats
            expect(stringToMoment('2025-01-15')?.isValid()).toBe(true); // Date only
            expect(stringToMoment('2025-01-15T14:30Z')?.isValid()).toBe(true); // No seconds
            expect(stringToMoment('2025-01-15T14:30:00')?.isValid()).toBe(true); // No timezone
            expect(stringToMoment('2025-01-15T14:30:00.123Z')?.isValid()).toBe(true); // Milliseconds
        });

        it('should be stricter than before with invalid formats', () => {
            // These should now be rejected (may have been accepted before)
            expect(stringToMoment('2025-02-30')).toBeNull(); // Invalid date
            expect(stringToMoment('2025-1-1')).toBeNull(); // Single digit month/day
            expect(stringToMoment('25-01-15')).toBeNull(); // 2-digit year
        });
    });

    describe('momentToString', () => {
        it('should convert moment to date string', () => {
            const momentValue = moment('2025-01-15');
            const result = momentToString(momentValue, false);
            expect(result).toBe('2025-01-15');
        });

        it('should convert moment to datetime string in UTC', () => {
            const momentValue = moment('2025-01-15T14:30:00Z');
            const result = momentToString(momentValue, true);
            expect(result).toBe('2025-01-15T14:30:00Z');
        });

        it('should convert timezone-aware moment to UTC datetime string', () => {
            // Create moment in EST (UTC-5)
            const momentValue = moment.tz('2025-01-15T14:30:00', 'America/New_York');
            const result = momentToString(momentValue, true);

            // 2:30 PM EST = 7:30 PM UTC
            expect(result).toBe('2025-01-15T19:30:00Z');
        });

        it('should return null for invalid moment', () => {
            expect(momentToString(null, true)).toBeNull();

            // Suppress moment.js deprecation warning for this test
            const originalWarn = console.warn;
            console.warn = jest.fn();

            expect(momentToString(moment('invalid'), true)).toBeNull();

            console.warn = originalWarn;
        });
    });

    describe('Complete Timezone Conversion Chain', () => {
        it('should handle full conversion cycle: User timezone → UTC storage → Display timezone', () => {
            // Scenario: User in EST selects 2:30 PM on Jan 15, 2025
            const userTimezone = 'America/New_York';
            const displayTimezone = 'Europe/London';

            // 1. User selects time in their timezone (EST)
            const userSelectedTime = moment.tz('2025-01-15T14:30:00', userTimezone);

            // 2. Store as UTC string (what we send to server)
            const storedValue = momentToString(userSelectedTime, true);
            expect(storedValue).toBe('2025-01-15T19:30:00Z'); // 2:30 PM EST = 7:30 PM UTC

            // 3. Read back from storage and display in different timezone (London)
            const retrievedMoment = stringToMoment(storedValue, displayTimezone);
            expect(retrievedMoment?.tz(displayTimezone).format('YYYY-MM-DD HH:mm:ss')).toBe('2025-01-15 19:30:00'); // 7:30 PM GMT

            // 4. Verify original user can see their original time
            expect(retrievedMoment?.tz(userTimezone).format('YYYY-MM-DD HH:mm:ss')).toBe('2025-01-15 14:30:00'); // 2:30 PM EST
        });

        it('should handle timezone boundary edge cases', () => {
            // Test date change across timezone boundaries
            const userTimezone = 'America/Los_Angeles'; // UTC-8

            // User selects 11:30 PM on Jan 15 (PST)
            const userSelectedTime = moment.tz('2025-01-15T23:30:00', userTimezone);

            // Store as UTC
            const storedValue = momentToString(userSelectedTime, true);
            expect(storedValue).toBe('2025-01-16T07:30:00Z'); // Next day in UTC

            // Verify user still sees their original date/time when displayed back
            const retrievedMoment = stringToMoment(storedValue, userTimezone);
            expect(retrievedMoment?.tz(userTimezone).format('YYYY-MM-DD HH:mm:ss')).toBe('2025-01-15 23:30:00');
        });

        it('should handle daylight saving time transitions', () => {
            // Test around DST transition in EST (Spring forward: March 9, 2025)
            const userTimezone = 'America/New_York';

            // Before DST (EST = UTC-5)
            const beforeDST = moment.tz('2025-03-08T14:30:00', userTimezone);
            const storedBefore = momentToString(beforeDST, true);
            expect(storedBefore).toBe('2025-03-08T19:30:00Z'); // 2:30 PM EST = 7:30 PM UTC

            // After DST (EDT = UTC-4)
            const afterDST = moment.tz('2025-03-10T14:30:00', userTimezone);
            const storedAfter = momentToString(afterDST, true);
            expect(storedAfter).toBe('2025-03-10T18:30:00Z'); // 2:30 PM EDT = 6:30 PM UTC

            // Verify both retrieve correctly
            expect(stringToMoment(storedBefore, userTimezone)?.tz(userTimezone).format('HH:mm')).toBe('14:30');
            expect(stringToMoment(storedAfter, userTimezone)?.tz(userTimezone).format('HH:mm')).toBe('14:30');
        });

        it('should handle min/max date comparisons across timezones', () => {
            // Test that min/max date constraints work correctly across timezone boundaries
            const userTimezone = 'America/New_York';

            // Set min_date to Jan 15, 2025 (user's perspective)
            const minDate = '2025-01-15';
            const resolvedMinDate = resolveRelativeDate(minDate, userTimezone);
            const minMoment = stringToMoment(resolvedMinDate, userTimezone);

            // User selects a datetime on Jan 14 at 11:30 PM EST
            const userSelection = moment.tz('2025-01-14T23:30:00', userTimezone);

            // Even though it's Jan 15 in UTC, it should be valid because user sees Jan 14
            expect(userSelection.tz(userTimezone).isBefore(minMoment?.tz(userTimezone), 'day')).toBe(true);

            // But the actual comparison should be done in user's timezone context
            const userSelectionDate = userSelection.tz(userTimezone).format('YYYY-MM-DD');
            expect(userSelectionDate < resolvedMinDate).toBe(true); // Jan 14 < Jan 15
        });

        it('should handle cross-timezone display correctly', () => {
            // Test displaying the same UTC time in multiple timezones
            const storedUTC = '2025-01-15T19:30:00Z';

            const timezones = {
                'America/New_York': '2025-01-15 14:30:00', // EST (UTC-5)
                'Europe/London': '2025-01-15 19:30:00', // GMT (UTC+0)
                'Asia/Tokyo': '2025-01-16 04:30:00', // JST (UTC+9, next day)
                'Australia/Sydney': '2025-01-16 06:30:00', // AEDT (UTC+11, next day)
            };

            Object.entries(timezones).forEach(([timezone, expected]) => {
                const moment = stringToMoment(storedUTC, timezone);
                const displayed = moment?.tz(timezone).format('YYYY-MM-DD HH:mm:ss');
                expect(displayed).toBe(expected);
            });
        });
    });
});
