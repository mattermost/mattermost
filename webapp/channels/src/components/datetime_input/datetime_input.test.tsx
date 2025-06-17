// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent, act} from '@testing-library/react';
import moment from 'moment-timezone';
import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import * as timezoneUtils from 'utils/timezone';

import DateTimeInput, {getTimeInIntervals} from './datetime_input';

// Mock timezone utilities
jest.mock('utils/timezone', () => ({
    getCurrentMomentForTimezone: jest.fn(),
    isBeforeTime: jest.fn(),
}));

const mockGetCurrentMomentForTimezone = timezoneUtils.getCurrentMomentForTimezone as jest.MockedFunction<typeof timezoneUtils.getCurrentMomentForTimezone>;
const mockIsBeforeTime = timezoneUtils.isBeforeTime as jest.MockedFunction<typeof timezoneUtils.isBeforeTime>;

describe('components/datetime_input/DateTimeInput', () => {
    const baseProps = {
        time: moment('2025-06-08T12:09:00.000Z'),
        handleChange: jest.fn(),
        timezone: 'UTC',
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockGetCurrentMomentForTimezone.mockReturnValue(moment('2025-06-08T10:00:00.000Z'));
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

            await act(async () => {
                fireEvent.click(dateButton!);
            });

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

            await act(async () => {
                await userEvent.click(timeButton);
            });

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

            await act(async () => {
                fireEvent.click(dateButton!);
            });

            // Press escape key
            await act(async () => {
                fireEvent.keyDown(document, {key: 'Escape', code: 'Escape'});
            });

            expect(mockSetIsInteracting).toHaveBeenCalledWith(false);
        });
    });

    describe('date selection', () => {
        test('should handle day selection for today with time adjustment', async () => {
            mockGetCurrentMomentForTimezone.mockReturnValue(moment('2025-06-08T08:00:00.000Z'));
            mockIsBeforeTime.mockReturnValue(true);

            renderWithContext(<DateTimeInput {...baseProps}/>);

            const dateButton = screen.getByText('Date').closest('.date-time-input');

            await act(async () => {
                fireEvent.click(dateButton!);
            });

            // Simulate clicking on today's date
            const todayButton = screen.getByText('8'); // June 8th

            await act(async () => {
                fireEvent.click(todayButton);
            });

            expect(baseProps.handleChange).toHaveBeenCalled();
        });

        test('should handle day selection for future date', async () => {
            mockGetCurrentMomentForTimezone.mockReturnValue(moment('2025-06-08T08:00:00.000Z'));

            renderWithContext(<DateTimeInput {...baseProps}/>);

            const dateButton = screen.getByText('Date').closest('.date-time-input');

            await act(async () => {
                fireEvent.click(dateButton!);
            });

            // Simulate clicking on a future date
            const futureButton = screen.getByText('15'); // June 15th

            await act(async () => {
                fireEvent.click(futureButton);
            });

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
    });
});
