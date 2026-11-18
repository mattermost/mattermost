// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent, waitFor, within} from 'tests/react_testing_utils';
import type {RepeatDisabledReason} from 'utils/scheduled_post_repeat';

import ScheduledPostCustomTimeModal from './scheduled_post_custom_time_modal';

jest.mock('mattermost-redux/actions/preferences', () => ({
    savePreferences: jest.fn(() => ({type: 'MOCK_SAVE_PREFERENCES'})),
}));

describe('ScheduledPostCustomTimeModal', () => {
    const onConfirm = jest.fn().mockResolvedValue({});

    beforeEach(() => {
        onConfirm.mockClear();
        onExited.mockClear();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    const onExited = jest.fn();

    function renderModal({recurringEnabled = true, initialRepeatWeekly = false, repeatDisabledReason = undefined}: {
        recurringEnabled?: boolean;
        initialRepeatWeekly?: boolean;
        repeatDisabledReason?: RepeatDisabledReason;
    } = {}) {
        return renderWithContext(
            <ScheduledPostCustomTimeModal
                channelId='channel_id'
                onExited={onExited}
                onConfirm={onConfirm}
                initialRepeatWeekly={initialRepeatWeekly}
                repeatDisabledReason={repeatDisabledReason}
            />,
            {
                entities: {
                    general: {
                        config: {
                            ScheduledPosts: 'true',
                            FeatureFlagRecurringScheduledPosts: String(recurringEnabled),
                        },
                        license: {IsLicensed: 'true'},
                    },
                    users: {
                        currentUserId: 'current_user_id',
                        profiles: {current_user_id: {id: 'current_user_id', roles: ''}},
                    },
                },
            },
        );
    }

    it('should render the repeat weekly checkbox when recurring scheduled posts are enabled', () => {
        renderModal();

        expect(screen.getByLabelText('Repeat weekly')).toBeInTheDocument();
    });

    it('should not render the repeat weekly checkbox when recurring scheduled posts are disabled', () => {
        renderModal({recurringEnabled: false});

        expect(screen.queryByLabelText('Repeat weekly')).not.toBeInTheDocument();
    });

    it('should enable the repeat weekly checkbox when nothing prevents recurrence', () => {
        renderModal();

        expect(screen.getByLabelText('Repeat weekly')).toBeEnabled();
    });

    it('should disable the repeat weekly checkbox when the message has attachments', () => {
        renderModal({repeatDisabledReason: 'attachments'});

        expect(screen.getByLabelText('Repeat weekly')).toBeDisabled();
    });

    it('should disable the repeat weekly checkbox for a burn-on-read message', () => {
        renderModal({repeatDisabledReason: 'burn_on_read'});

        expect(screen.getByLabelText('Repeat weekly')).toBeDisabled();
    });

    it('should explain that attachments are what prevents recurrence', async () => {
        jest.useFakeTimers();
        renderModal({repeatDisabledReason: 'attachments'});

        await userEvent.hover(screen.getByLabelText('Repeat weekly'), {advanceTimers: jest.advanceTimersByTime});

        await waitFor(() => {
            expect(screen.getByText("Messages with attachments can't repeat")).toBeInTheDocument();
        });
    });

    it('should explain that burn-on-read is what prevents recurrence', async () => {
        jest.useFakeTimers();
        renderModal({repeatDisabledReason: 'burn_on_read'});

        await userEvent.hover(screen.getByLabelText('Repeat weekly'), {advanceTimers: jest.advanceTimersByTime});

        await waitFor(() => {
            expect(screen.getByText("Burn-on-read messages can't repeat")).toBeInTheDocument();
        });
    });

    it('should preserve existing recurrence when recurring scheduled posts are disabled', async () => {
        renderModal({recurringEnabled: false, initialRepeatWeekly: true});

        await userEvent.click(screen.getByText('Schedule'));

        await waitFor(() => expect(onConfirm).toHaveBeenCalled());
        expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({repeat_type: 'weekly'}));
    });

    it('should send empty repeat fields when recurring scheduled posts are disabled and the post does not repeat', async () => {
        renderModal({recurringEnabled: false});

        await userEvent.click(screen.getByText('Schedule'));

        await waitFor(() => expect(onConfirm).toHaveBeenCalled());
        expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({repeat_type: '', repeat_timezone: ''}));
    });

    it('should send repeat fields when recurring scheduled posts are enabled and the post repeats', async () => {
        renderModal({initialRepeatWeekly: true});

        await userEvent.click(screen.getByText('Schedule'));

        await waitFor(() => expect(onConfirm).toHaveBeenCalled());
        expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({repeat_type: 'weekly'}));
    });

    it('should clear the error message when the time changes', async () => {
        onConfirm.mockResolvedValueOnce({error: 'Invalid scheduled at time.'});
        renderModal();

        await userEvent.click(screen.getByText('Schedule'));
        expect(await screen.findByText('Invalid scheduled at time.')).toBeInTheDocument();
        expect(onExited).not.toHaveBeenCalled();

        await userEvent.click(screen.getByTestId('date_time_picker_modal.when.time--button'));
        const [firstTime] = await screen.findAllByTestId(/^date_time_picker_modal\.when\.time_menu\.time:\d{4}--menuitem$/);
        await userEvent.click(firstTime);

        await waitFor(() => expect(screen.queryByText('Invalid scheduled at time.')).not.toBeInTheDocument());
    });

    it('should ignore repeated confirmations while a request is pending', async () => {
        let resolveConfirm: (value: {error?: string}) => void = () => {};
        onConfirm.mockReturnValueOnce(new Promise((resolve) => {
            resolveConfirm = resolve;
        }));
        renderModal();

        await userEvent.click(screen.getByText('Schedule'));
        await userEvent.click(screen.getByText('Schedule'));

        expect(onConfirm).toHaveBeenCalledTimes(1);

        resolveConfirm({});
        await waitFor(() => expect(onExited).toHaveBeenCalledTimes(1));
    });

    it('should disable the Schedule button while a request is pending and re-enable it after an error', async () => {
        let resolveConfirm: (value: {error?: string}) => void = () => {};
        onConfirm.mockReturnValueOnce(new Promise((resolve) => {
            resolveConfirm = resolve;
        }));
        renderModal();

        const scheduleButton = screen.getByRole('button', {name: 'Schedule'});
        expect(scheduleButton).toBeEnabled();
        expect(within(scheduleButton).queryByRole('status', {hidden: true})).not.toBeInTheDocument();

        await userEvent.click(scheduleButton);
        expect(scheduleButton).toBeDisabled();
        expect(within(scheduleButton).getByRole('status', {hidden: true})).toBeInTheDocument();

        resolveConfirm({error: 'Invalid scheduled at time.'});
        expect(await screen.findByText('Invalid scheduled at time.')).toBeInTheDocument();
        expect(scheduleButton).toBeEnabled();
        expect(within(scheduleButton).queryByRole('status', {hidden: true})).not.toBeInTheDocument();
    });

    it('should not exit or show the error when dismissed while a request is pending', async () => {
        let resolveConfirm: (value: {error?: string}) => void = () => {};
        onConfirm.mockReturnValueOnce(new Promise((resolve) => {
            resolveConfirm = resolve;
        }));
        const {unmount} = renderModal();

        await userEvent.click(screen.getByText('Schedule'));
        unmount();
        resolveConfirm({});
        await Promise.resolve();
        await Promise.resolve();

        expect(onExited).not.toHaveBeenCalled();
    });
});
