// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DateTime} from 'luxon';
import React from 'react';

import {getPreferenceKey} from 'mattermost-redux/utils/preference_utils';

import {renderWithContext, fireEvent, screen} from 'tests/react_testing_utils';
import {scheduledPosts} from 'utils/constants';

import CoreMenuOptions from './core_menu_options';

jest.mock('components/advanced_text_editor/use_post_box_indicator', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('components/menu', () => ({
    __esModule: true,
    Item: jest.fn(({labels, trailingElements, children, ...props}) => (
        <div {...props}>
            {labels}
            {children}
            {trailingElements}
        </div>
    )),
    Separator: jest.fn(() => <div className='menu-separator'/>),
}));

jest.mock('components/timestamp', () => jest.fn(({value}) => <span>{value}</span>));

const useTimePostBoxIndicator = require('components/advanced_text_editor/use_post_box_indicator').default;

const initialState = {
    entities: {
        preferences: {
            myPreferences: {},
        },
        users: {
            currentUserId: 'currentUserId',
        },
    },
};

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

    test('should render recently used custom time option when valid', () => {
        const recentTimestamp = DateTime.now().minus({days: 7}).toMillis();

        const recentlyUsedCustomDateVal = {
            update_at: DateTime.now().toMillis(),
            timestamp: recentTimestamp,
        };

        const state = {
            ...initialState,
            entities: {
                ...initialState.entities,
                preferences: {
                    ...initialState.entities.preferences,
                    myPreferences: {
                        ...initialState.entities.preferences.myPreferences,
                        [getPreferenceKey(scheduledPosts.SCHEDULED_POSTS, scheduledPosts.RECENTLY_USED_CUSTOM_TIME)]: {value: JSON.stringify(recentlyUsedCustomDateVal)},
                    },
                },
            },
        };

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
            state,
        );

        expect(screen.getByText(/Recently used custom time/)).toBeInTheDocument();

        jest.useRealTimers();
    });

    test('should not render recently used custom time when preference value is invalid JSON', () => {
        const invalidJson = '{ invalid JSON }'; // Invalid JSON string

        const state = {
            ...initialState,
            entities: {
                ...initialState.entities,
                preferences: {
                    ...initialState.entities.preferences,
                    myPreferences: {
                        ...initialState.entities.preferences.myPreferences,
                        [getPreferenceKey(scheduledPosts.SCHEDULED_POSTS, scheduledPosts.RECENTLY_USED_CUSTOM_TIME)]: {
                            value: invalidJson,
                        },
                    },
                },
            },
        };

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
            state,
        );

        expect(screen.queryByText(/Recently used custom time/)).not.toBeInTheDocument();
    });

    test('should call handleOnSelect with the correct timestamp when "Recently used custom time" is clicked', () => {
        const recentTimestamp = DateTime.now().minus({days: 5}).toMillis();

        const recentlyUsedCustomDateVal = {
            update_at: DateTime.now().toMillis(),
            timestamp: recentTimestamp,
        };

        const state = {
            ...initialState,
            entities: {
                ...initialState.entities,
                preferences: {
                    ...initialState.entities.preferences,
                    myPreferences: {
                        ...initialState.entities.preferences.myPreferences,
                        [getPreferenceKey(scheduledPosts.SCHEDULED_POSTS, scheduledPosts.RECENTLY_USED_CUSTOM_TIME)]: {
                            value: JSON.stringify(recentlyUsedCustomDateVal),
                        },
                    },
                },
            },
        };

        const handleOnSelectMock = jest.fn();

        useTimePostBoxIndicator.mockReturnValue({
            userCurrentTimezone,
            teammateTimezone,
            teammateDisplayName,
            isDM: false,
        });

        renderWithContext(
            <CoreMenuOptions
                handleOnSelect={handleOnSelectMock}
                channelId='channelId'
            />,
            state,
        );

        const recentCustomOption = screen.getByText(/Recently used custom time/);
        fireEvent.click(recentCustomOption);

        expect(handleOnSelectMock).toHaveBeenCalledWith(expect.anything(), recentTimestamp);

        jest.useRealTimers();
    });

    test('should not render recently used custom time when update_at is older than 30 days', () => {
        const outdatedUpdateAt = DateTime.now().minus({days: 35}).toMillis();
        const recentTimestamp = DateTime.now().minus({days: 5}).toMillis();

        const recentlyUsedCustomDateVal = {
            update_at: outdatedUpdateAt,
            timestamp: recentTimestamp,
        };

        const state = {
            ...initialState,
            entities: {
                ...initialState.entities,
                preferences: {
                    ...initialState.entities.preferences,
                    myPreferences: {
                        ...initialState.entities.preferences.myPreferences,
                        [getPreferenceKey(scheduledPosts.SCHEDULED_POSTS, scheduledPosts.RECENTLY_USED_CUSTOM_TIME)]: {
                            value: JSON.stringify(recentlyUsedCustomDateVal),
                        },
                    },
                },
            },
        };

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
            state,
        );

        expect(screen.queryByText(/Recently used custom time/)).not.toBeInTheDocument();
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
