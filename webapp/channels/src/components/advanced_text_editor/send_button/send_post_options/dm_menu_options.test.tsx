// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DateTime} from 'luxon';
import React from 'react';

import useTimePostBoxIndicator from 'components/advanced_text_editor/use_post_box_indicator';
import {WithTestMenuContext} from 'components/menu/menu_context_test';

import {fireEvent, renderWithContext, screen, within} from 'tests/react_testing_utils';

import DmMenuOptions from './dm_menu_options';

jest.mock('components/advanced_text_editor/use_post_box_indicator');
const mockedUseTimePostBoxIndicator = jest.mocked(useTimePostBoxIndicator);

const defaultHookValue = {
    userCurrentTimezone: 'America/New_York',
    teammateTimezone: {
        useAutomaticTimezone: true,
        automaticTimezone: 'Europe/London',
        manualTimezone: '',
    },
    recipientTimezoneString: 'Europe/London',
    teammateDisplayName: 'Sarah',
    teammateFirstName: 'Sarah',
    teammate: {
        position: 'San Francisco',
        timezone: {
            useAutomaticTimezone: 'true',
            automaticTimezone: 'Europe/London',
            manualTimezone: '',
        },
    },
    currentUserTimesStamp: DateTime.now().toMillis(),
    isDM: true,
    isSelfDM: false,
    isBot: false,
    showRemoteUserHour: false,
    isScheduledPostEnabled: true,
    showDndWarning: false,
    teammateId: 'user2',
};

describe('DmMenuOptions', () => {
    const handleOnSelect = jest.fn();

    beforeEach(() => {
        handleOnSelect.mockReset();
        mockedUseTimePostBoxIndicator.mockReturnValue(defaultHookValue as ReturnType<typeof useTimePostBoxIndicator>);
    });

    it('renders tomorrow preset with your time conversion when using recipient timezone', () => {
        renderWithContext(
            <WithTestMenuContext>
                <DmMenuOptions
                    handleOnSelect={handleOnSelect}
                    channelId='channel1'
                    useRecipientTimezone={true}
                />
            </WithTestMenuContext>,
        );

        const tomorrowOption = screen.getByTestId('scheduling_time_tomorrow_9_am');

        expect(within(tomorrowOption).getByText(/Tomorrow at/)).toBeInTheDocument();
        expect(within(tomorrowOption).getByText(/your time/)).toBeInTheDocument();
    });

    it('renders recipient time conversion when using sender timezone', () => {
        renderWithContext(
            <WithTestMenuContext>
                <DmMenuOptions
                    handleOnSelect={handleOnSelect}
                    channelId='channel1'
                    useRecipientTimezone={false}
                />
            </WithTestMenuContext>,
        );

        const tomorrowOption = screen.getByTestId('scheduling_time_tomorrow_9_am');

        expect(within(tomorrowOption).getByText(/Tomorrow at/)).toBeInTheDocument();
        expect(within(tomorrowOption).getByText(/Sarah's time/)).toBeInTheDocument();
    });

    it('calls handleOnSelect when tomorrow option is clicked', () => {
        renderWithContext(
            <WithTestMenuContext>
                <DmMenuOptions
                    handleOnSelect={handleOnSelect}
                    channelId='channel1'
                    useRecipientTimezone={true}
                />
            </WithTestMenuContext>,
        );

        fireEvent.click(screen.getByTestId('scheduling_time_tomorrow_9_am'));

        expect(handleOnSelect).toHaveBeenCalledWith(expect.anything(), expect.any(Number));
    });
});
