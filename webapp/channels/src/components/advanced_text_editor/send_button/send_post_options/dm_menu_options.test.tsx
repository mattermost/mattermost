// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DateTime} from 'luxon';
import React from 'react';

import useTimePostBoxIndicator from 'components/advanced_text_editor/use_post_box_indicator';
import {WithTestMenuContext} from 'components/menu/menu_context_test';

import {fireEvent, renderWithContext, screen} from 'tests/react_testing_utils';

import DmMenuOptions, {DmScheduleHeader} from './dm_menu_options';

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

    it('renders Their morning preset', () => {
        renderWithContext(
            <WithTestMenuContext>
                <DmMenuOptions
                    handleOnSelect={handleOnSelect}
                    channelId='channel1'
                />
            </WithTestMenuContext>,
        );

        expect(screen.getByText('Their morning')).toBeInTheDocument();
        expect(screen.getByText(/yours/)).toBeInTheDocument();
    });

    it('calls handleOnSelect with their morning timestamp when clicked', () => {
        renderWithContext(
            <WithTestMenuContext>
                <DmMenuOptions
                    handleOnSelect={handleOnSelect}
                    channelId='channel1'
                />
            </WithTestMenuContext>,
        );

        fireEvent.click(screen.getByTestId('scheduling_time_their_morning'));

        expect(handleOnSelect).toHaveBeenCalledWith(expect.anything(), expect.any(Number));
    });
});

describe('DmScheduleHeader', () => {
    beforeEach(() => {
        mockedUseTimePostBoxIndicator.mockReturnValue(defaultHookValue as ReturnType<typeof useTimePostBoxIndicator>);
    });

    it('renders schedule for recipient header with location', () => {
        renderWithContext(
            <WithTestMenuContext>
                <DmScheduleHeader channelId='channel1'/>
            </WithTestMenuContext>,
        );

        expect(screen.getByText(/Schedule for Sarah/)).toBeInTheDocument();
        expect(screen.getByText(/San Francisco/)).toBeInTheDocument();
        expect(screen.getByText(/now/)).toBeInTheDocument();
    });
});
