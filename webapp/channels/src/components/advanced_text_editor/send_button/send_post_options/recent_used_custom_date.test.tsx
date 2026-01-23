// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DateTime} from 'luxon';
import React from 'react';

import {getPreferenceKey} from 'mattermost-redux/utils/preference_utils';

import {renderWithContext, fireEvent, screen} from 'tests/react_testing_utils';
import {scheduledPosts} from 'utils/constants';

import RecentUsedCustomDate from './recent_used_custom_date';

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

const recentUsedCustomDateString = 'Recently used custom time';

describe('CoreMenuOptions Component', () => {
    const userCurrentTimezone = 'America/New_York';

    const handleOnSelect = jest.fn();

    let now: DateTime;
    let tomorrow9amTime: number;
    let nextMonday: number;

    beforeEach(() => {
        jest.clearAllMocks();
        handleOnSelect.mockReset();
        now = DateTime.fromISO('2024-11-01T10:00:00', {zone: userCurrentTimezone});
        jest.useFakeTimers();
        jest.setSystemTime(now.toJSDate());

        // Hardcode `tomorrow9amTime` and `nextMonday`
        tomorrow9amTime = DateTime.fromISO('2024-11-02T09:00:00', {zone: userCurrentTimezone}).toMillis();
        nextMonday = DateTime.fromISO('2024-11-04T09:00:00', {zone: userCurrentTimezone}).toMillis();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    function createStateWithRecentlyUsedCustomDate(value: string) {
        return {
            ...initialState,
            entities: {
                ...initialState.entities,
                preferences: {
                    ...initialState.entities.preferences,
                    myPreferences: {
                        ...initialState.entities.preferences.myPreferences,
                        [getPreferenceKey(scheduledPosts.SCHEDULED_POSTS, scheduledPosts.RECENTLY_USED_CUSTOM_TIME)]: {value},
                    },
                },
            },
        };
    }

    function renderComponent(state = initialState, handleOnSelectOverride = handleOnSelect) {
        renderWithContext(
            <RecentUsedCustomDate
                handleOnSelect={handleOnSelectOverride}
                userCurrentTimezone={userCurrentTimezone}
                tomorrow9amTime={tomorrow9amTime}
                nextMonday={nextMonday}
            />,
            state,
        );
    }

    it('should render recently used custom time option when valid', () => {
        const recentTimestamp = DateTime.now().plus({days: 7}).toMillis();

        const recentlyUsedCustomDateVal = {
            update_at: DateTime.now().toMillis(),
            timestamp: recentTimestamp,
        };

        const state = createStateWithRecentlyUsedCustomDate(JSON.stringify(recentlyUsedCustomDateVal));

        renderComponent(state);

        expect(screen.getByText(recentUsedCustomDateString)).toBeInTheDocument();
    });

    it('should not render recently used custom time when preference value is invalid JSON', () => {
        const invalidJson = '{ invalid JSON }';

        const state = createStateWithRecentlyUsedCustomDate(invalidJson);

        renderComponent(state);

        expect(screen.queryByText(recentUsedCustomDateString)).not.toBeInTheDocument();
    });

    it('should call handleOnSelect with the correct timestamp when "Recently used custom time" is clicked', () => {
        const recentTimestamp = DateTime.now().plus({days: 5}).toMillis();

        const recentlyUsedCustomDateVal = {
            update_at: DateTime.now().toMillis(),
            timestamp: recentTimestamp,
        };

        const state = createStateWithRecentlyUsedCustomDate(JSON.stringify(recentlyUsedCustomDateVal));

        const handleOnSelectMock = jest.fn();

        renderComponent(state, handleOnSelectMock);

        const recentCustomOption = screen.getByText(recentUsedCustomDateString);
        fireEvent.click(recentCustomOption);

        expect(handleOnSelectMock).toHaveBeenCalledWith(expect.anything(), recentTimestamp);
    });

    it('should not render recently used custom time when update_at is older than 30 days', () => {
        const outdatedUpdateAt = DateTime.now().minus({days: 35}).toMillis();
        const recentTimestamp = DateTime.now().plus({days: 5}).toMillis();

        const recentlyUsedCustomDateVal = {
            update_at: outdatedUpdateAt,
            timestamp: recentTimestamp,
        };

        const state = createStateWithRecentlyUsedCustomDate(JSON.stringify(recentlyUsedCustomDateVal));

        renderComponent(state);

        expect(screen.queryByText(recentUsedCustomDateString)).not.toBeInTheDocument();
    });

    it('should not render recently used custom time when timestamp is in the past', () => {
        const now = DateTime.now().setZone(userCurrentTimezone);
        const nowMillis = now.toMillis();

        jest.useFakeTimers();
        jest.setSystemTime(now.toJSDate());

        const pastTimestamp = now.minus({days: 1}).toMillis();

        const recentlyUsedCustomDateVal = {
            update_at: nowMillis,
            timestamp: pastTimestamp,
        };

        const state = createStateWithRecentlyUsedCustomDate(JSON.stringify(recentlyUsedCustomDateVal));

        renderComponent(state);

        expect(screen.queryByText(recentUsedCustomDateString)).not.toBeInTheDocument();
    });

    it('should not render recently used custom time when timestamp equals tomorrow9amTime', () => {
        const nowMillis = now.toMillis();

        const recentlyUsedCustomDateVal = {
            update_at: nowMillis,
            timestamp: tomorrow9amTime, // Use the value from beforeEach
        };

        const state = createStateWithRecentlyUsedCustomDate(JSON.stringify(recentlyUsedCustomDateVal));

        renderComponent(state);

        expect(screen.queryByText(recentUsedCustomDateString)).not.toBeInTheDocument();
    });

    it('should not render recently used custom time when timestamp equals nextMonday', () => {
        const nowMillis = now.toMillis();

        const recentlyUsedCustomDateVal = {
            update_at: nowMillis,
            timestamp: nextMonday,
        };

        const state = createStateWithRecentlyUsedCustomDate(JSON.stringify(recentlyUsedCustomDateVal));

        renderComponent(state);

        expect(screen.queryByText(recentUsedCustomDateString)).not.toBeInTheDocument();
    });

    it('should render "Today at HH:MM AM/PM" when recently used custom date is TODAY', () => {
        const now = DateTime.fromISO('2024-11-01T10:00:00', {zone: userCurrentTimezone});
        jest.useFakeTimers();
        jest.setSystemTime(now.toJSDate());

        const recentTimestamp = now.plus({minutes: 5}).toMillis();

        const recentlyUsedCustomDateVal = {
            update_at: now.toMillis(),
            timestamp: recentTimestamp,
        };

        const state = createStateWithRecentlyUsedCustomDate(JSON.stringify(recentlyUsedCustomDateVal));

        renderComponent(state);

        expect(screen.getByText(recentUsedCustomDateString)).toBeInTheDocument();
        expect(screen.getByText(/Today at/)).toBeInTheDocument();
    });

    it('should render "Weekday at HH:MM AM/PM" if recent used custom date is in the SAME week', () => {
        const now = DateTime.fromISO('2024-11-01T10:00:00', {zone: userCurrentTimezone});
        jest.useFakeTimers();
        jest.setSystemTime(now.toJSDate());

        const recentTimestamp = now.plus({days: 2}).toMillis();

        const recentlyUsedCustomDateVal = {
            update_at: now.toMillis(),
            timestamp: recentTimestamp,
        };

        const state = createStateWithRecentlyUsedCustomDate(JSON.stringify(recentlyUsedCustomDateVal));

        renderComponent(state);

        expect(screen.getByText(recentUsedCustomDateString)).toBeInTheDocument();

        const scheduledDate = DateTime.fromMillis(recentTimestamp).setZone(userCurrentTimezone);
        const weekdayName = scheduledDate.toFormat('EEEE');

        expect(screen.getByText(new RegExp(`${weekdayName} at`))).toBeInTheDocument();
    });

    it('should render "Month Day at HH:MM AM/PM" if recent used custom date is NOT in the same week', () => {
        const now = DateTime.fromISO('2024-11-01T10:00:00', {zone: userCurrentTimezone});
        jest.useFakeTimers();
        jest.setSystemTime(now.toJSDate());

        const recentTimestamp = now.plus({days: 14}).toMillis();

        const recentlyUsedCustomDateVal = {
            update_at: now.toMillis(),
            timestamp: recentTimestamp,
        };

        const state = createStateWithRecentlyUsedCustomDate(JSON.stringify(recentlyUsedCustomDateVal));

        renderComponent(state);

        expect(screen.getByText(recentUsedCustomDateString)).toBeInTheDocument();

        const scheduledDate = DateTime.fromMillis(recentTimestamp).setZone(userCurrentTimezone);
        const monthDay = scheduledDate.toFormat('MMMM d');

        expect(screen.getByText(new RegExp(`${monthDay} at`))).toBeInTheDocument();
    });
});
