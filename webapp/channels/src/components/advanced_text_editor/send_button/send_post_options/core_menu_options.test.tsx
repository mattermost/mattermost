// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DateTime} from 'luxon';
import React from 'react';

import useTimePostBoxIndicator from 'components/advanced_text_editor/use_post_box_indicator';
import {WithTestMenuContext} from 'components/menu/menu_context_test';

import {renderWithContext, fireEvent, screen} from 'tests/react_testing_utils';

import CoreMenuOptions from './core_menu_options';

jest.mock('components/advanced_text_editor/use_post_box_indicator');
const mockedUseTimePostBoxIndicator = jest.mocked(useTimePostBoxIndicator);

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
        jest.clearAllMocks();
        handleOnSelect.mockReset();
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
        renderWithContext(
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

    it('should include trailing element when isDM true', () => {
        setMockDate(2); // Tuesday

        mockedUseTimePostBoxIndicator.mockReturnValue({
            ...defaultUseTimePostBoxIndicatorReturnValue,
            isDM: true,
            isSelfDM: false,
            isBot: false,
        });

        renderComponent();

        // Check the trailing element is rendered in the component
        expect(screen.getAllByText(/John Doe/)[0]).toBeInTheDocument();
    });

    it('should NOT include trailing element when isDM false', () => {
        setMockDate(2); // Tuesday

        renderComponent();

        expect(screen.queryByText(/John Doe/)).not.toBeInTheDocument();
    });

    it('should call handleOnSelect with the right timestamp if tomorrow option is clicked', () => {
        setMockDate(3); // Wednesday

        renderComponent();

        const tomorrowOption = screen.getByText(/Tomorrow at/);
        fireEvent.click(tomorrowOption);

        const expectedTimestamp = DateTime.now().
            setZone(userCurrentTimezone).
            plus({days: 1}).
            set({hour: 9, minute: 0, second: 0, millisecond: 0}).
            toMillis();

        expect(handleOnSelect).toHaveBeenCalledWith(expect.anything(), expectedTimestamp);
    });

    it('should NOT include trailing element when isDM and isBot are true', () => {
        setMockDate(2); // Tuesday

        mockedUseTimePostBoxIndicator.mockReturnValue({
            ...defaultUseTimePostBoxIndicatorReturnValue,
            isDM: true,
            isSelfDM: false,
            isBot: true,
        });

        renderComponent();

        // Check the trailing element is NOT rendered in the component as this is a bot
        expect(screen.queryByText(/John Doe/)).toBeNull();
    });

    it('should NOT include trailing element when the DM is with oneself', () => {
        setMockDate(2); // Tuesday

        mockedUseTimePostBoxIndicator.mockReturnValue({
            ...defaultUseTimePostBoxIndicatorReturnValue,
            isDM: true,
            isSelfDM: true,
            isBot: false,
        });

        renderComponent();

        // Check the trailing element is NOT rendered in the component as this is a bot
        expect(screen.queryByText(/John Doe/)).toBeNull();
    });
});
