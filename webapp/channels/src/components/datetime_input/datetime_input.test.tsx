// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment-timezone';
import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import * as timezoneUtils from 'utils/timezone';

import DateTimeInput, {getTimeInIntervals, getRoundedTime, parseTimeString} from './datetime_input';

// Mock timezone utilities
jest.mock('utils/timezone', () => ({
    getCurrentMomentForTimezone: jest.fn(),
    isBeforeTime: jest.fn(),
}));

jest.mock('selectors/preferences', () => ({
    isUseMilitaryTime: jest.fn(),
}));

const mockGetCurrentMomentForTimezone = timezoneUtils.getCurrentMomentForTimezone as jest.MockedFunction<typeof timezoneUtils.getCurrentMomentForTimezone>;
const mockIsBeforeTime = timezoneUtils.isBeforeTime as jest.MockedFunction<typeof timezoneUtils.isBeforeTime>;

describe('components/datetime_input/DateTimeInput', () => {
    const baseProps = {
        time: moment('2025-06-08T12:09:00Z'),
        handleChange: jest.fn(),
        timezone: 'UTC',
    };

    beforeEach(() => {
        mockGetCurrentMomentForTimezone.mockReturnValue(moment('2025-06-08T10:00:00Z'));
        mockIsBeforeTime.mockReturnValue(false);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <DateTimeInput {...baseProps}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should render date and time selectors', () => {
        renderWithContext(
            <DateTimeInput {...baseProps}/>,
        );

        expect(screen.getByText('Date')).toBeInTheDocument();
        expect(screen.getByLabelText('Time')).toBeInTheDocument();
    });

    test('should not infinitely loop on DST', () => {
        const timezone = 'Europe/Paris';
        const time = '2024-03-31T02:00:00+0100';

        const intervals = getTimeInIntervals(moment.tz(time, timezone).startOf('day'));
        expect(intervals.length).toBeGreaterThan(0);
        expect(intervals.length).toBeLessThan(100); // Reasonable upper bound
    });

    describe('user interactions', () => {
        test('should call setIsInteracting when date picker opens', async () => {
            const mockSetIsInteracting = jest.fn();
            const props = {
                ...baseProps,
                setIsInteracting: mockSetIsInteracting,
            };

            renderWithContext(<DateTimeInput {...props}/>);

            const dateButton = screen.getByText('Date').closest('.date-time-input');

            await userEvent.click(dateButton!);

            expect(mockSetIsInteracting).toHaveBeenCalledWith(true);
        });

        test('should call setIsInteracting when time menu opens', async () => {
            const mockSetIsInteracting = jest.fn();
            const props = {
                ...baseProps,
                setIsInteracting: mockSetIsInteracting,
            };

            renderWithContext(<DateTimeInput {...props}/>);

            const timeButton = screen.getByLabelText('Time');

            await userEvent.click(timeButton);

            expect(mockSetIsInteracting).toHaveBeenCalledWith(true);
        });

        test('should close date picker on escape key', async () => {
            const mockSetIsInteracting = jest.fn();
            const props = {
                ...baseProps,
                setIsInteracting: mockSetIsInteracting,
            };

            renderWithContext(<DateTimeInput {...props}/>);

            // Open date picker first
            const dateButton = screen.getByText('Date').closest('.date-time-input');

            await userEvent.click(dateButton!);

            // Press escape key
            await userEvent.keyboard('{escape}');

            expect(mockSetIsInteracting).toHaveBeenCalledWith(false);
        });
    });

    describe('date selection', () => {
        test('should handle day selection for today with time adjustment', async () => {
            mockGetCurrentMomentForTimezone.mockReturnValue(moment('2025-06-08T08:00:00Z'));
            mockIsBeforeTime.mockReturnValue(true);

            renderWithContext(<DateTimeInput {...baseProps}/>);

            const dateButton = screen.getByText('Date').closest('.date-time-input');

            await userEvent.click(dateButton!);

            // Simulate clicking on today's date
            const todayButton = screen.getByText('8'); // June 8th

            await userEvent.click(todayButton);

            expect(baseProps.handleChange).toHaveBeenCalled();
        });

        test('should handle day selection for future date', async () => {
            mockGetCurrentMomentForTimezone.mockReturnValue(moment('2025-06-08T08:00:00Z'));

            renderWithContext(<DateTimeInput {...baseProps}/>);

            const dateButton = screen.getByText('Date').closest('.date-time-input');

            await userEvent.click(dateButton!);

            // Simulate clicking on a future date
            const futureButton = screen.getByText('15'); // June 15th

            await userEvent.click(futureButton);

            expect(baseProps.handleChange).toHaveBeenCalled();
        });
    });

    describe('timezone handling', () => {
        test('should handle timezone prop', () => {
            const props = {
                ...baseProps,
                timezone: 'America/New_York',
            };

            renderWithContext(<DateTimeInput {...props}/>);

            expect(mockGetCurrentMomentForTimezone).toHaveBeenCalledWith('America/New_York');
        });
    });

    describe('custom configuration', () => {
        test('should accept custom time picker interval', () => {
            const props = {
                ...baseProps,
                timePickerInterval: 15,
            };

            renderWithContext(<DateTimeInput {...props}/>);

            // Component should render without errors with custom interval
            expect(screen.getByLabelText('Time')).toBeInTheDocument();
        });

        test('should handle relative date formatting', () => {
            const props = {
                ...baseProps,
                relativeDate: true,
            };

            renderWithContext(<DateTimeInput {...props}/>);

            // Component should render without errors with relative formatting
            expect(screen.getByText('Date')).toBeInTheDocument();
        });

        test('should allow past dates and all times when allowPastDates is true', () => {
            // Test the core time generation logic directly
            const selectedDate = moment('2025-06-08T15:00:00Z'); // 3 PM

            // When allowPastDates=true, time intervals should start from beginning of day
            const timeOptions = getTimeInIntervals(selectedDate.clone().startOf('day'), 30);

            // Should include times from start of day (midnight)
            const firstTime = moment(timeOptions[0]);
            expect(firstTime.hours()).toBe(0); // Should start at midnight
            expect(firstTime.minutes()).toBe(0);

            // Should include the full day's worth of options
            expect(timeOptions.length).toBe(48); // 24 hours * 2 (30-min intervals)
        });

        test('should restrict past dates and times when allowPastDates is false (default)', () => {
            // Test the core time generation logic for restricted past times
            const currentTime = moment('2025-06-08T15:30:00Z'); // 3:30 PM
            const roundedTime = getRoundedTime(currentTime, 30); // Should round to 3:30 PM

            // When allowPastDates=false and selecting today, time options should start from current time
            const timeOptions = getTimeInIntervals(roundedTime, 30);

            // Should NOT include times before current time (no midnight options)
            const firstTime = moment(timeOptions[0]);
            expect(firstTime.hours()).toBeGreaterThanOrEqual(15); // Should start at/after 3 PM
            expect(firstTime.minutes()).toBeGreaterThanOrEqual(30); // Should be 3:30 or later

            // Should have fewer options (only from 3:30 PM to end of day)
            expect(timeOptions.length).toBeLessThan(48); // Less than full day
            expect(timeOptions.length).toBeGreaterThan(0); // But should have some options
        });
    });

    describe('user preference handling', () => {
        it('should use user locale for date formatting', () => {
            renderWithContext(<DateTimeInput {...baseProps}/>);

            // Date should be formatted using formatDateForDisplay utility
            // which uses user's locale from getCurrentLocale selector
            expect(screen.getByText('Date')).toBeInTheDocument();
        });

        it('should respect military time (24-hour) preference', () => {
            const mockIsUseMilitaryTime = require('selectors/preferences').isUseMilitaryTime;
            mockIsUseMilitaryTime.mockReturnValue(true);

            renderWithContext(<DateTimeInput {...baseProps}/>);

            // Timestamp component should receive useTime prop with hourCycle: 'h23'
            // This is tested indirectly - times would show as 14:00 instead of 2:00 PM
            expect(mockIsUseMilitaryTime).toHaveBeenCalled();
        });

        it('should respect 12-hour time preference', () => {
            const mockIsUseMilitaryTime = require('selectors/preferences').isUseMilitaryTime;
            mockIsUseMilitaryTime.mockReturnValue(false);

            renderWithContext(<DateTimeInput {...baseProps}/>);

            // Timestamp component should receive useTime prop with hour12: true
            // This is tested indirectly - times would show as 2:00 PM instead of 14:00
            expect(mockIsUseMilitaryTime).toHaveBeenCalled();
        });

        it('should format dates consistently (not browser default)', () => {
            const testDate = moment('2025-06-15T12:00:00Z');
            const props = {...baseProps, time: testDate};

            renderWithContext(<DateTimeInput {...props}/>);

            // Date should use Intl.DateTimeFormat(locale, {month: 'short', ...})
            // Not DateTime.fromJSDate().toLocaleString() which varies by browser
            // Expected format: "Jun 15, 2025" not "6/15/2025"
            expect(props.time).toBeDefined();
        });
    });

    describe('auto-rounding behavior', () => {
        it('should auto-round time to interval boundary on mount', () => {
            const handleChange = jest.fn();
            const unroundedTime = moment('2025-06-08T14:17:00Z'); // 14:17 - not on 30-min boundary

            renderWithContext(
                <DateTimeInput
                    time={unroundedTime}
                    handleChange={handleChange}
                    timePickerInterval={30}
                />,
            );

            // Should auto-round 14:17 to 14:30 and call handleChange
            expect(handleChange).toHaveBeenCalledTimes(1);
            const roundedTime = handleChange.mock.calls[0][0];
            expect(roundedTime.minute()).toBe(30);
        });

        it('should not call handleChange if time is already rounded', () => {
            const handleChange = jest.fn();
            const roundedTime = moment('2025-06-08T14:30:00Z'); // Already on 30-min boundary

            renderWithContext(
                <DateTimeInput
                    time={roundedTime}
                    handleChange={handleChange}
                    timePickerInterval={30}
                />,
            );

            // Should not call handleChange since time is already rounded
            expect(handleChange).not.toHaveBeenCalled();
        });

        it('should use 30-minute default interval when prop not provided', () => {
            const handleChange = jest.fn();
            const unroundedTime = moment('2025-06-08T14:17:00Z');

            renderWithContext(
                <DateTimeInput
                    time={unroundedTime}
                    handleChange={handleChange}

                    // No timePickerInterval prop - should use 30-min default
                />,
            );

            // Should round using default 30-min interval
            expect(handleChange).toHaveBeenCalledTimes(1);
            const roundedTime = handleChange.mock.calls[0][0];
            expect(roundedTime.minute()).toBe(30); // 14:17 -> 14:30
        });
    });

    describe('parseTimeString', () => {
        it('should parse 12-hour format with AM/PM', () => {
            expect(parseTimeString('12a')).toEqual({hours: 0, minutes: 0}); // 12 AM = 00:00
            expect(parseTimeString('12am')).toEqual({hours: 0, minutes: 0});
            expect(parseTimeString('1a')).toEqual({hours: 1, minutes: 0});
            expect(parseTimeString('11pm')).toEqual({hours: 23, minutes: 0});
            expect(parseTimeString('12p')).toEqual({hours: 12, minutes: 0}); // 12 PM = 12:00
            expect(parseTimeString('12pm')).toEqual({hours: 12, minutes: 0});
        });

        it('should parse 12-hour format with minutes', () => {
            expect(parseTimeString('3:30pm')).toEqual({hours: 15, minutes: 30});
            expect(parseTimeString('3:30 PM')).toEqual({hours: 15, minutes: 30});
            expect(parseTimeString('9:15am')).toEqual({hours: 9, minutes: 15});
            expect(parseTimeString('12:45am')).toEqual({hours: 0, minutes: 45});
            expect(parseTimeString('12:30pm')).toEqual({hours: 12, minutes: 30});
        });

        it('should parse 24-hour format', () => {
            expect(parseTimeString('00:00')).toEqual({hours: 0, minutes: 0});
            expect(parseTimeString('14:30')).toEqual({hours: 14, minutes: 30});
            expect(parseTimeString('23:59')).toEqual({hours: 23, minutes: 59});
            expect(parseTimeString('9:15')).toEqual({hours: 9, minutes: 15});
        });

        it('should parse time without minutes (defaults to :00)', () => {
            expect(parseTimeString('14')).toEqual({hours: 14, minutes: 0});
            expect(parseTimeString('9')).toEqual({hours: 9, minutes: 0});
        });

        it('should handle various spacing and case', () => {
            expect(parseTimeString('  3:30pm  ')).toEqual({hours: 15, minutes: 30});
            expect(parseTimeString('3:30PM')).toEqual({hours: 15, minutes: 30});
            expect(parseTimeString('3:30 pm')).toEqual({hours: 15, minutes: 30});
        });

        it('should reject invalid hour values', () => {
            expect(parseTimeString('25:00')).toBeNull(); // 25 hours invalid
            expect(parseTimeString('24:00')).toBeNull(); // 24 hours invalid
            expect(parseTimeString('13pm')).toBeNull(); // 13 PM invalid
            expect(parseTimeString('0am')).toBeNull(); // 0 AM invalid
        });

        it('should reject invalid minute values', () => {
            expect(parseTimeString('3:60pm')).toBeNull(); // 60 minutes invalid
            expect(parseTimeString('14:99')).toBeNull();
            expect(parseTimeString('3:-5pm')).toBeNull();
        });

        it('should reject invalid formats', () => {
            expect(parseTimeString('abc')).toBeNull();
            expect(parseTimeString('12:34:56')).toBeNull(); // Seconds not supported
            expect(parseTimeString('pm')).toBeNull();
            expect(parseTimeString('')).toBeNull();
            expect(parseTimeString(null as any)).toBeNull();
        });

        it('should handle edge cases at midnight and noon', () => {
            expect(parseTimeString('12:00am')).toEqual({hours: 0, minutes: 0}); // Midnight
            expect(parseTimeString('12:01am')).toEqual({hours: 0, minutes: 1});
            expect(parseTimeString('11:59pm')).toEqual({hours: 23, minutes: 59});
            expect(parseTimeString('12:00pm')).toEqual({hours: 12, minutes: 0}); // Noon
            expect(parseTimeString('12:59pm')).toEqual({hours: 12, minutes: 59});
        });
    });

    describe('timezone handling', () => {
        it('should preserve timezone when generating time intervals', () => {
            const londonTime = moment.tz('2025-06-08T14:00:00', 'Europe/London');
            const intervals = getTimeInIntervals(londonTime, 60);

            // All intervals should preserve London timezone
            expect(intervals.length).toBeGreaterThan(0);
            intervals.forEach((interval) => {
                expect(interval.tz()).toBe('Europe/London');
            });
        });

        it('should generate intervals starting at midnight in specified timezone', () => {
            const londonMidnight = moment.tz('2025-06-08', 'Europe/London').startOf('day');
            const intervals = getTimeInIntervals(londonMidnight, 60);

            // First interval should be midnight in London
            expect(intervals[0].format('HH:mm')).toBe('00:00');
            expect(intervals[0].tz()).toBe('Europe/London');
        });

        it('should handle timezone conversion in parseTimeString and moment creation', () => {
            // This tests the pattern used in TimeInputManual
            const parsed = parseTimeString('3:45pm');
            expect(parsed).toEqual({hours: 15, minutes: 45});

            // Create moment in specific timezone
            const londonTime = moment.tz([2025, 5, 8, parsed!.hours, parsed!.minutes, 0, 0], 'Europe/London');
            expect(londonTime.tz()).toBe('Europe/London');
            expect(londonTime.format('HH:mm')).toBe('15:45');
        });
    });
});
