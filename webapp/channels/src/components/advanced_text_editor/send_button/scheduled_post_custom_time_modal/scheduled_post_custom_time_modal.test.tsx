// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import type {RepeatDisabledReason} from 'utils/scheduled_post_repeat';

import ScheduledPostCustomTimeModal from './scheduled_post_custom_time_modal';

jest.mock('mattermost-redux/actions/preferences', () => ({
    savePreferences: jest.fn(() => ({type: 'MOCK_SAVE_PREFERENCES'})),
}));

describe('ScheduledPostCustomTimeModal', () => {
    const onConfirm = jest.fn().mockResolvedValue({});

    beforeEach(() => {
        onConfirm.mockClear();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    function renderModal({recurringEnabled = true, initialRepeatWeekly = false, repeatDisabledReason = undefined}: {
        recurringEnabled?: boolean;
        initialRepeatWeekly?: boolean;
        repeatDisabledReason?: RepeatDisabledReason;
    } = {}) {
        return renderWithContext(
            <ScheduledPostCustomTimeModal
                channelId='channel_id'
                onExited={jest.fn()}
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
});
