// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment-timezone';
import React from 'react';

import {
    isDmScheduleRedesign,
    reinterpretWallClock,
} from 'components/advanced_text_editor/send_button/schedule_message_dm_utils';
import useTimePostBoxIndicator from 'components/advanced_text_editor/use_post_box_indicator';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import ScheduledPostCustomTimeModal from './scheduled_post_custom_time_modal';

jest.mock('components/date_time_picker_modal/date_time_picker_modal', () => {
    return function MockDateTimePickerModal({
        bodyPrefix,
        bodySuffix,
        footerContent,
        errorText,
        timezone,
    }: {
        bodyPrefix?: React.ReactNode;
        bodySuffix?: React.ReactNode;
        footerContent?: React.ReactNode;
        errorText?: string;
        timezone?: string;
    }) {
        return (
            <div data-testid='date-time-picker-modal'>
                <div data-testid='active-timezone'>{timezone}</div>
                {bodyPrefix}
                {bodySuffix}
                {footerContent}
                {errorText && <div data-testid='modal-error'>{errorText}</div>}
            </div>
        );
    };
});

jest.mock('components/advanced_text_editor/send_button/schedule_message_dm_utils', () => {
    const actual = jest.requireActual('components/advanced_text_editor/send_button/schedule_message_dm_utils');
    return {
        ...actual,
        isDmScheduleRedesign: jest.fn(),
        reinterpretWallClock: jest.fn(actual.reinterpretWallClock),
    };
});

jest.mock('components/advanced_text_editor/use_post_box_indicator');
jest.mock('mattermost-redux/selectors/entities/timezone', () => ({
    generateCurrentTimezoneLabel: jest.fn(() => 'Eastern Time'),
    getCurrentTimezone: jest.fn(() => 'America/New_York'),
}));
jest.mock('mattermost-redux/actions/preferences', () => ({
    savePreferences: jest.fn(() => ({type: 'MOCK_SAVE_PREFERENCES'})),
}));

const mockedIsDmScheduleRedesign = jest.mocked(isDmScheduleRedesign);
const mockedReinterpretWallClock = jest.mocked(reinterpretWallClock);
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
    teammate: {id: 'user2', username: 'sarah'} as ReturnType<typeof useTimePostBoxIndicator>['teammate'],
    isDM: true,
    isSelfDM: false,
    isBot: false,
    showRemoteUserHour: false,
    currentUserTimesStamp: 0,
    isScheduledPostEnabled: true,
    showDndWarning: false,
    teammateId: 'user2',
};

describe('ScheduledPostCustomTimeModal DM redesign', () => {
    const onExited = jest.fn();
    const onConfirm = jest.fn().mockResolvedValue({});

    beforeEach(() => {
        onExited.mockReset();
        onConfirm.mockReset().mockResolvedValue({});
        mockedIsDmScheduleRedesign.mockReturnValue(true);
        mockedUseTimePostBoxIndicator.mockReturnValue(defaultHookValue);
        mockedReinterpretWallClock.mockImplementation(
            jest.requireActual('components/advanced_text_editor/send_button/schedule_message_dm_utils').reinterpretWallClock,
        );
    });

    function renderModal(extraProps: Partial<React.ComponentProps<typeof ScheduledPostCustomTimeModal>> = {}) {
        return renderWithContext(
            <ScheduledPostCustomTimeModal
                channelId='dm_channel_id'
                onExited={onExited}
                onConfirm={onConfirm}
                useRecipientTimezone={true}
                {...extraProps}
            />,
        );
    }

    it('renders DM layout with checkbox, conversion line, and footer actions', () => {
        renderModal();

        expect(screen.getByRole('checkbox', {name: /Use recipient's timezone/})).toBeInTheDocument();
        expect(screen.getByText(/your time/)).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Remove schedule'})).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /^Schedule$/})).toBeInTheDocument();
    });

    it('shows remove schedule only when onRemoveSchedule is provided', () => {
        const onRemoveSchedule = jest.fn().mockResolvedValue({});

        renderModal({onRemoveSchedule});

        expect(screen.getByRole('button', {name: 'Remove schedule'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Remove schedule'})).toHaveClass('scheduled_post_dm_custom_time_modal__remove');
    });

    it('calls reinterpretWallClock when recipient timezone checkbox is toggled', async () => {
        renderModal();

        await userEvent.click(screen.getByRole('checkbox'));

        expect(mockedReinterpretWallClock).toHaveBeenCalledWith(
            expect.anything(),
            'America/New_York',
        );
        expect(screen.getByText(/Sarah's time/)).toBeInTheDocument();
        expect(screen.getByTestId('active-timezone')).toHaveTextContent('America/New_York');
    });

    it('calls onExited when remove schedule succeeds', async () => {
        const onRemoveSchedule = jest.fn().mockResolvedValue({});

        renderModal({onRemoveSchedule});

        await userEvent.click(screen.getByRole('button', {name: 'Remove schedule'}));

        expect(onRemoveSchedule).toHaveBeenCalled();
        expect(onExited).toHaveBeenCalled();
    });

    it('shows error and stays open when remove schedule fails', async () => {
        const onRemoveSchedule = jest.fn().mockResolvedValue({error: 'Could not remove schedule'});

        renderModal({onRemoveSchedule});

        await userEvent.click(screen.getByRole('button', {name: 'Remove schedule'}));

        expect(screen.getByTestId('modal-error')).toHaveTextContent('Could not remove schedule');
        expect(onExited).not.toHaveBeenCalled();
    });

    it('converts initialTime to active timezone on mount for DM reschedule', () => {
        const initialTime = moment.tz('2026-06-10 09:00', 'America/New_York');

        renderModal({initialTime});

        expect(mockedReinterpretWallClock).toHaveBeenCalledWith(initialTime, 'Europe/London');
    });

    it('uses recipient timezone when checkbox starts unchecked', () => {
        renderModal({
            useRecipientTimezone: false,
            initialTime: moment.tz('2026-06-10 09:00', 'America/New_York'),
        });

        expect(screen.getByTestId('active-timezone')).toHaveTextContent('America/New_York');
        expect(screen.getByText(/Sarah's time/)).toBeInTheDocument();
    });
});

describe('ScheduledPostCustomTimeModal legacy layout', () => {
    const onExited = jest.fn();
    const onConfirm = jest.fn().mockResolvedValue({});

    beforeEach(() => {
        onExited.mockReset();
        onConfirm.mockReset().mockResolvedValue({});
        mockedIsDmScheduleRedesign.mockReturnValue(false);
        mockedUseTimePostBoxIndicator.mockReturnValue(defaultHookValue);
    });

    it('shows remove schedule when rescheduling an existing scheduled post', () => {
        const onRemoveSchedule = jest.fn().mockResolvedValue({});

        renderWithContext(
            <ScheduledPostCustomTimeModal
                channelId='channel_id'
                onExited={onExited}
                onConfirm={onConfirm}
                onRemoveSchedule={onRemoveSchedule}
            />,
        );

        expect(screen.getByRole('button', {name: 'Remove schedule'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /^Schedule$/})).toBeInTheDocument();
    });

    it('shows DM checkbox when rescheduling a DM scheduled post', () => {
        mockedIsDmScheduleRedesign.mockReturnValue(true);

        renderWithContext(
            <ScheduledPostCustomTimeModal
                channelId='dm_channel_id'
                onExited={onExited}
                onConfirm={onConfirm}
                onRemoveSchedule={jest.fn().mockResolvedValue({})}
            />,
        );

        expect(screen.getByRole('checkbox', {name: /Use recipient's timezone/})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Remove schedule'})).toBeInTheDocument();
    });

    it('does not show remove schedule when scheduling a new message', () => {
        renderWithContext(
            <ScheduledPostCustomTimeModal
                channelId='channel_id'
                onExited={onExited}
                onConfirm={onConfirm}
            />,
        );

        expect(screen.queryByRole('button', {name: 'Remove schedule'})).not.toBeInTheDocument();
    });
});
