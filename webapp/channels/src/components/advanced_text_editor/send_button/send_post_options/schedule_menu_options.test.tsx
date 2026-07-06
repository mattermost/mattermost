// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DateTime} from 'luxon';
import React from 'react';

import {isOneToOneDmChannel} from 'components/advanced_text_editor/send_button/schedule_message_utils';
import useTimePostBoxIndicator from 'components/advanced_text_editor/use_post_box_indicator';
import {WithTestMenuContext} from 'components/menu/menu_context_test';

import {fireEvent, renderWithContext, screen, within} from 'tests/react_testing_utils';

import ScheduleMenuOptions from './schedule_menu_options';

jest.mock('components/advanced_text_editor/send_button/schedule_message_utils', () => {
    const actual = jest.requireActual('components/advanced_text_editor/send_button/schedule_message_utils');
    return {
        ...actual,
        isOneToOneDmChannel: jest.fn(),
    };
});

jest.mock('components/advanced_text_editor/use_post_box_indicator');
const mockedUseTimePostBoxIndicator = jest.mocked(useTimePostBoxIndicator);
const mockedIsOneToOneDmChannel = jest.mocked(isOneToOneDmChannel);

const teammateDisplayName = 'John Doe';
const userCurrentTimezone = 'America/New_York';
const teammateTimezone = {
    useAutomaticTimezone: true,
    automaticTimezone: 'Europe/London',
    manualTimezone: '',
};
const defaultUseTimePostBoxIndicatorReturnValue = {
    userCurrentTimezone: 'America/New_York',
    teammateTimezone,
    recipientTimezoneString: 'Europe/London',
    teammateDisplayName,
    teammateFirstName: 'John',
    teammate: undefined,
    isDM: false,
    isSelfDM: false,
    isBot: false,
    showRemoteUserHour: false,
    currentUserTimesStamp: 0,
    isScheduledPostEnabled: false,
    showDndWarning: false,
    teammateId: '',
};

const dmHookValue = {
    ...defaultUseTimePostBoxIndicatorReturnValue,
    teammateDisplayName: 'Sarah',
    teammateFirstName: 'Sarah',
    isDM: true,
    teammateId: 'user2',
};

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

describe('ScheduleMenuOptions', () => {
    const handleOnSelect = jest.fn();

    beforeEach(() => {
        handleOnSelect.mockReset();
        mockedIsOneToOneDmChannel.mockReturnValue(false);
        mockedUseTimePostBoxIndicator.mockReturnValue(defaultUseTimePostBoxIndicatorReturnValue as unknown as ReturnType<typeof useTimePostBoxIndicator>);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    function renderComponent(
        state = initialState,
        extraProps: Partial<React.ComponentProps<typeof ScheduleMenuOptions>> = {},
    ) {
        return renderWithContext(
            <WithTestMenuContext>
                <ScheduleMenuOptions
                    handleOnSelect={handleOnSelect}
                    channelId='channelId'
                    {...extraProps}
                />
            </WithTestMenuContext>,
            state,
        );
    }

    function setMockDate(weekday: number, hour = 10) {
        const mockDate = DateTime.fromObject({weekday, hour}, {zone: userCurrentTimezone}).toJSDate();
        jest.useFakeTimers();
        jest.setSystemTime(mockDate);
    }

    describe('channel presets', () => {
        it('should render tomorrow option on Sunday', () => {
            setMockDate(7);

            renderComponent();

            expect(screen.getByText(/Tomorrow at/)).toBeInTheDocument();
            expect(screen.queryByText(/Monday at/)).not.toBeInTheDocument();
        });

        it('should render tomorrow and next Monday options on Monday', () => {
            setMockDate(1);

            renderComponent();

            expect(screen.getByText(/Tomorrow at/)).toBeInTheDocument();
            expect(screen.getByText(/Next Monday at/)).toBeInTheDocument();
        });

        it('should render Monday option on Friday', () => {
            setMockDate(5);

            renderComponent();

            expect(screen.getByText(/Monday at/)).toBeInTheDocument();
            expect(screen.queryByText(/Tomorrow at/)).not.toBeInTheDocument();
        });

        it('should call handleOnSelect with the right timestamp if tomorrow option is clicked', () => {
            setMockDate(3);

            renderComponent();

            fireEvent.click(screen.getByText(/Tomorrow at/));

            const expectedTimestamp = DateTime.now().
                setZone(userCurrentTimezone).
                plus({days: 1}).
                set({hour: 9, minute: 0, second: 0, millisecond: 0}).
                toMillis();

            expect(handleOnSelect).toHaveBeenCalledWith(expect.anything(), expectedTimestamp);
        });
    });

    describe('one-to-one DM presets', () => {
        beforeEach(() => {
            mockedIsOneToOneDmChannel.mockReturnValue(true);
            mockedUseTimePostBoxIndicator.mockReturnValue(dmHookValue as unknown as ReturnType<typeof useTimePostBoxIndicator>);
            setMockDate(2);
        });

        it('renders tomorrow preset with your time conversion when using recipient timezone', () => {
            renderComponent(initialState, {useRecipientTimezone: true});

            const tomorrowOption = screen.getByTestId('scheduling_time_tomorrow_9_am');

            expect(within(tomorrowOption).getByText(/Tomorrow at/)).toBeInTheDocument();
            expect(within(tomorrowOption).getByText(/your time/)).toBeInTheDocument();
        });

        it('renders recipient time conversion when using sender timezone', () => {
            renderComponent(initialState, {useRecipientTimezone: false});

            const tomorrowOption = screen.getByTestId('scheduling_time_tomorrow_9_am');

            expect(within(tomorrowOption).getByText(/Tomorrow at/)).toBeInTheDocument();
            expect(within(tomorrowOption).getByText(/Sarah's time/)).toBeInTheDocument();
        });

        it('renders today and tomorrow presets before 9am on weekdays', () => {
            jest.setSystemTime(DateTime.fromISO('2026-06-09T07:00:00', {zone: 'Europe/London'}).toJSDate());

            renderComponent(initialState, {useRecipientTimezone: true});

            const todayOption = screen.getByTestId('scheduling_time_today_9_am');

            expect(within(todayOption).getByText(/Today at/)).toBeInTheDocument();
            expect(screen.getByTestId('scheduling_time_tomorrow_9_am')).toBeInTheDocument();
            expect(screen.queryByTestId('scheduling_time_monday_9_am')).not.toBeInTheDocument();
        });

        it('calls handleOnSelect when tomorrow option is clicked', () => {
            renderComponent(initialState, {useRecipientTimezone: true});

            fireEvent.click(screen.getByTestId('scheduling_time_tomorrow_9_am'));

            expect(handleOnSelect).toHaveBeenCalledWith(expect.anything(), expect.any(Number));
        });
    });
});
