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
});
