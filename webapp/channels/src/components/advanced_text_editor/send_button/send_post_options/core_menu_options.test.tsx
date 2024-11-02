// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DateTime} from 'luxon';
import React from 'react';

import {renderWithContext, fireEvent, screen} from 'tests/react_testing_utils';

import CoreMenuOptions from './core_menu_options';

jest.mock('components/advanced_text_editor/use_post_box_indicator', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('components/menu', () => ({
    Item: jest.fn(({labels, trailingElements, children, ...props}) => (
        <div {...props}>
            {labels}
            {children}
            {trailingElements}
        </div>
    )),
}));

jest.mock('components/timestamp', () => jest.fn(({value}) => <span>{value}</span>));

const useTimePostBoxIndicator = require('components/advanced_text_editor/use_post_box_indicator').default;

describe('CoreMenuOptions Component', () => {
    const handleOnSelect = jest.fn();
    const teammateDisplayName = 'John Doe';
    const userCurrentTimezone = 'America/New_York';
    const teammateTimezone = {
        useAutomaticTimezone: true,
        automaticTimezone: 'Europe/London',
        manualTimezone: '',
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should render tomorrow option on Sunday', () => {
        const mockDate = DateTime.fromObject({weekday: 7}, {zone: userCurrentTimezone}).toJSDate();
        jest.useFakeTimers();
        jest.setSystemTime(mockDate);

        useTimePostBoxIndicator.mockReturnValue({
            userCurrentTimezone,
            teammateTimezone,
            teammateDisplayName,
            isDM: false,
        });

        renderWithContext(
            <CoreMenuOptions
                handleOnSelect={handleOnSelect}
                channelId='channelId'
            />,
        );

        expect(screen.getByText(/Tomorrow at/)).toBeInTheDocument();
        expect(screen.queryByText(/Monday at/)).not.toBeInTheDocument();

        jest.useRealTimers();
    });

    it('should render tomorrow and next Monday options on Monday', () => {
        const mockDate = DateTime.fromObject({weekday: 1}, {zone: userCurrentTimezone}).toJSDate();
        jest.useFakeTimers({
            timerLimit: 1000,
            now: mockDate,
        });
        useTimePostBoxIndicator.mockReturnValue({
            userCurrentTimezone,
            teammateTimezone,
            teammateDisplayName,
            isDM: false,
        });

        renderWithContext(
            <CoreMenuOptions
                handleOnSelect={handleOnSelect}
                channelId='channelId'
            />,
        );

        expect(screen.getByText(/Tomorrow at/)).toBeInTheDocument();
        expect(screen.getByText(/Next Monday at/)).toBeInTheDocument();

        jest.useRealTimers();
    });

    it('should render Monday option on Friday', () => {
        const mockDate = DateTime.fromObject({weekday: 5}, {zone: userCurrentTimezone}).toJSDate();
        jest.useFakeTimers({
            timerLimit: 1000,
            now: mockDate,
        });
        useTimePostBoxIndicator.mockReturnValue({
            userCurrentTimezone,
            teammateTimezone,
            teammateDisplayName,
            isDM: false,
        });

        renderWithContext(
            <CoreMenuOptions
                handleOnSelect={handleOnSelect}
                channelId='channelId'
            />,
        );

        expect(screen.getByText(/Monday at/)).toBeInTheDocument();
        expect(screen.queryByText(/Tomorrow at/)).not.toBeInTheDocument();

        jest.useRealTimers();
    });

    it('should include trailing element when isDM true', () => {
        const mockDate = DateTime.fromObject({weekday: 2}, {zone: userCurrentTimezone}).toJSDate();
        jest.useFakeTimers({
            timerLimit: 1000,
            now: mockDate,
        });
        useTimePostBoxIndicator.mockReturnValue({
            userCurrentTimezone,
            teammateTimezone,
            teammateDisplayName,
            isDM: true,
        });

        renderWithContext(
            <CoreMenuOptions
                handleOnSelect={handleOnSelect}
                channelId='channelId'
            />,
        );

        // Check that the trailing element is render
        expect(screen.getAllByText(/John Doe/)[0]).toBeInTheDocument();

        jest.useRealTimers();
    });

    it('should call handleOnSelect with the right timestamp if tomorrow option is clicked', () => {
        const mockDate = DateTime.fromObject({weekday: 3}, {zone: userCurrentTimezone}).toJSDate();
        jest.useFakeTimers({
            timerLimit: 1000,
            now: mockDate,
        });
        useTimePostBoxIndicator.mockReturnValue({
            userCurrentTimezone,
            teammateTimezone,
            teammateDisplayName,
            isDM: false,
        });

        renderWithContext(
            <CoreMenuOptions
                handleOnSelect={handleOnSelect}
                channelId='channelId'
            />,
        );

        const tomorrowOption = screen.getByText(/Tomorrow at/);
        fireEvent.click(tomorrowOption);

        const expectedTimestamp = DateTime.now().
            setZone(userCurrentTimezone).
            plus({days: 1}).
            set({hour: 9, minute: 0, second: 0, millisecond: 0}).
            toMillis();

        expect(handleOnSelect).toHaveBeenCalledWith(expect.anything(), expectedTimestamp);

        jest.useRealTimers();
    });
});
