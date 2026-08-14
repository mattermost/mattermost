// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import ScheduledPostCustomTimeModal from './scheduled_post_custom_time_modal';

jest.mock('mattermost-redux/actions/preferences', () => ({
    savePreferences: jest.fn(() => ({type: 'MOCK_SAVE_PREFERENCES'})),
}));

describe('ScheduledPostCustomTimeModal', () => {
    const onConfirm = jest.fn().mockResolvedValue({});

    beforeEach(() => {
        onConfirm.mockClear();
    });

    function renderModal({recurringEnabled = true, initialRepeatWeekly = false, allowRecurring = true} = {}) {
        return renderWithContext(
            <ScheduledPostCustomTimeModal
                channelId='channel_id'
                onExited={jest.fn()}
                onConfirm={onConfirm}
                initialRepeatWeekly={initialRepeatWeekly}
                allowRecurring={allowRecurring}
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

    it('should disable the repeat weekly checkbox when the message has attachments', () => {
        renderModal({allowRecurring: false});

        expect(screen.getByLabelText('Repeat weekly')).toBeDisabled();
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
