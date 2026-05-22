// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DateTime} from 'luxon';
import React from 'react';

import useTimePostBoxIndicator from 'components/advanced_text_editor/use_post_box_indicator';
import {WithTestMenuContext} from 'components/menu/menu_context_test';

import {fireEvent, renderWithContext, screen} from 'tests/react_testing_utils';

import {isDmScheduleRedesign} from 'components/advanced_text_editor/send_button/schedule_message_dm_utils';

import CoreMenuOptions from './core_menu_options';

jest.mock('components/advanced_text_editor/send_button/schedule_message_dm_utils', () => ({
    isDmScheduleRedesign: jest.fn(),
}));

jest.mock('components/advanced_text_editor/use_post_box_indicator');
const mockedUseTimePostBoxIndicator = jest.mocked(useTimePostBoxIndicator);
const mockedIsDmScheduleRedesign = jest.mocked(isDmScheduleRedesign);

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
    teammateDisplayName,
    isDM: false,
    showRemoteUserHour: false,
    currentUserTimesStamp: 0,
    isScheduledPostEnabled: false,
    showDndWarning: false,
    teammateId: '',
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

describe('CoreMenuOptions Component', () => {
    const handleOnSelect = jest.fn();

    beforeEach(() => {
        handleOnSelect.mockReset();
        mockedIsDmScheduleRedesign.mockReturnValue(false);
        mockedUseTimePostBoxIndicator.mockReturnValue({
            ...defaultUseTimePostBoxIndicatorReturnValue,
            isDM: false,
            isSelfDM: false,
            isBot: false,
        });
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    function renderComponent(state = initialState, handleOnSelectOverride = handleOnSelect) {
        return renderWithContext(
            <WithTestMenuContext>
                <CoreMenuOptions
                    handleOnSelect={handleOnSelectOverride}
                    channelId='channelId'
                />
            </WithTestMenuContext>,
            state,
        );
    }

    function setMockDate(weekday: number) {
        const mockDate = DateTime.fromObject({weekday}, {zone: userCurrentTimezone}).toJSDate();
        jest.useFakeTimers();
        jest.setSystemTime(mockDate);
    }

    it('should render tomorrow option on Sunday', () => {
        setMockDate(7); // Sunday

        renderComponent();

        expect(screen.getByText(/Tomorrow at/)).toBeInTheDocument();
        expect(screen.queryByText(/Monday at/)).not.toBeInTheDocument();
    });

    it('should render tomorrow and next Monday options on Monday', () => {
        setMockDate(1); // Monday

        renderComponent();

        expect(screen.getByText(/Tomorrow at/)).toBeInTheDocument();
        expect(screen.getByText(/Next Monday at/)).toBeInTheDocument();
    });

    it('should render Monday option on Friday', () => {
        setMockDate(5); // Friday

        renderComponent();

        expect(screen.getByText(/Monday at/)).toBeInTheDocument();
        expect(screen.queryByText(/Tomorrow at/)).not.toBeInTheDocument();
    });

    it('should render nothing when DM schedule redesign is active', () => {
        setMockDate(2);
        mockedIsDmScheduleRedesign.mockReturnValue(true);

        renderComponent();

        expect(screen.queryByText(/Tomorrow at/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Monday at/)).not.toBeInTheDocument();
    });

    it('should call handleOnSelect with the right timestamp if tomorrow option is clicked', () => {
        setMockDate(3); // Wednesday

        renderComponent();

        const tomorrowOption = screen.getByText(/Tomorrow at/);

        // Use fireEvent.click here because userEvent doesn't work well with fake timers
        fireEvent.click(tomorrowOption);

        const expectedTimestamp = DateTime.now().
            setZone(userCurrentTimezone).
            plus({days: 1}).
            set({hour: 9, minute: 0, second: 0, millisecond: 0}).
            toMillis();

        expect(handleOnSelect).toHaveBeenCalledWith(expect.anything(), expectedTimestamp);
    });

});
