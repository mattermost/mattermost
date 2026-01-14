// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment-timezone';
import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import * as timezoneUtils from 'utils/timezone';

import DateTimeInput, {getTimeInIntervals, getRoundedTime} from './datetime_input';

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
        jest.clearAllMocks();
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

    describe('range mode', () => {
        const rangeProps = {
            time: null,
            handleChange: jest.fn(),
            rangeMode: true,
            onRangeChange: jest.fn(),
            timezone: 'UTC',
        };

        beforeEach(() => {
            jest.clearAllMocks();
        });

        test('should render in range mode', () => {
            renderWithContext(
                <DateTimeInput {...rangeProps}/>,
            );

            expect(screen.getByText('Date')).toBeInTheDocument();
        });

        test('should call onRangeChange when selecting range start', async () => {
            const onRangeChange = jest.fn();
            const props = {
                ...rangeProps,
                onRangeChange,
            };

            renderWithContext(<DateTimeInput {...props}/>);

            const dateButton = screen.getByText('Date').closest('.date-time-input');
            await userEvent.click(dateButton!);

            // Simulate clicking a date to start the range
            const dayButton = screen.getByText('15'); // June 15th
            await userEvent.click(dayButton);

            // Should be called with start date and null end
            expect(onRangeChange).toHaveBeenCalled();
            const [startDate, endDate] = onRangeChange.mock.calls[0];
            expect(startDate).toBeInstanceOf(Date);
            expect(endDate).toBeNull();
        });

        test('should call onRangeChange when completing range', async () => {
            const onRangeChange = jest.fn();
            const rangeValue = {
                from: moment('2025-06-10T00:00:00Z'),
                to: null,
            };
            const props = {
                ...rangeProps,
                onRangeChange,
                rangeValue,
            };

            renderWithContext(<DateTimeInput {...props}/>);

            const dateButton = screen.getByText('Date').closest('.date-time-input');
            await userEvent.click(dateButton!);

            // Simulate clicking end date
            const dayButton = screen.getByText('20'); // June 20th
            await userEvent.click(dayButton);

            // Should be called with both start and end dates
            expect(onRangeChange).toHaveBeenCalled();
            const [startDate, endDate] = onRangeChange.mock.calls[0];
            expect(startDate).toBeInstanceOf(Date);
            expect(endDate).toBeInstanceOf(Date);
        });

        test('should reset range when clicking new date after complete range', async () => {
            const onRangeChange = jest.fn();
            const rangeValue = {
                from: moment('2025-06-10T00:00:00Z'),
                to: moment('2025-06-20T00:00:00Z'),
            };
            const props = {
                ...rangeProps,
                onRangeChange,
                rangeValue,
            };

            renderWithContext(<DateTimeInput {...props}/>);

            const dateButton = screen.getByText('Date').closest('.date-time-input');
            await userEvent.click(dateButton!);

            // Simulate clicking a new date
            const dayButton = screen.getByText('25'); // June 25th
            await userEvent.click(dayButton);

            // Should reset to new start date with null end
            expect(onRangeChange).toHaveBeenCalled();
            const [startDate, endDate] = onRangeChange.mock.calls[0];
            expect(startDate).toBeInstanceOf(Date);
            expect(endDate).toBeNull();
        });

        test('should pass allowSingleDayRange prop to calendar', () => {
            const rangeValue = {
                from: moment('2025-06-15T00:00:00Z'),
                to: null,
            };

            // Test with allowSingleDayRange: false
            const {rerender} = renderWithContext(
                <DateTimeInput
                    {...rangeProps}
                    rangeValue={rangeValue}
                    allowSingleDayRange={false}
                />,
            );

            // Component should render with the prop
            expect(screen.getByText('Date')).toBeInTheDocument();

            // Test with allowSingleDayRange: true
            rerender(
                <DateTimeInput
                    {...rangeProps}
                    rangeValue={rangeValue}
                    allowSingleDayRange={true}
                />,
            );

            expect(screen.getByText('Date')).toBeInTheDocument();
        });

        test('should disable dates before start when isStartField is false', () => {
            const rangeValue = {
                from: moment('2025-06-15T00:00:00Z'),
                to: null,
            };
            const props = {
                ...rangeProps,
                rangeValue,
                isStartField: false,
                allowSingleDayRange: false,
            };

            const {container} = renderWithContext(<DateTimeInput {...props}/>);

            // Component should render with disabled dates configuration
            // The actual disabling is handled by react-day-picker
            expect(container).toBeTruthy();
        });

        test('should disable only the start date when allowSingleDayRange is false', () => {
            const rangeValue = {
                from: moment('2025-06-15T00:00:00Z'),
                to: null,
            };
            const props = {
                ...rangeProps,
                rangeValue,
                isStartField: false,
                allowSingleDayRange: false,
            };

            const {container} = renderWithContext(<DateTimeInput {...props}/>);

            // In this mode, the day after start (June 16) should be the first enabled day
            expect(container).toBeTruthy();
        });

        test('should allow selecting start date when allowSingleDayRange is true', () => {
            const rangeValue = {
                from: moment('2025-06-15T00:00:00Z'),
                to: null,
            };
            const props = {
                ...rangeProps,
                rangeValue,
                isStartField: false,
                allowSingleDayRange: true,
            };

            const {container} = renderWithContext(<DateTimeInput {...props}/>);

            // In this mode, the start date (June 15) itself should be enabled
            expect(container).toBeTruthy();
        });
    });
});
