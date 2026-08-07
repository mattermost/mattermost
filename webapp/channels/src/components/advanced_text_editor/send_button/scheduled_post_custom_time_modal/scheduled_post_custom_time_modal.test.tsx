// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';

import {renderWithContext} from 'tests/react_testing_utils';

import ScheduledPostCustomTimeModal from './scheduled_post_custom_time_modal';

const initialState = {
    entities: {
        users: {
            currentUserId: 'user_id',
            profiles: {
                user_id: {
                    id: 'user_id',
                    roles: 'system_user',
                    timezone: {
                        useAutomaticTimezone: false,
                        automaticTimezone: '',
                        manualTimezone: 'Europe/Berlin',
                    },
                },
            },
        },
        general: {
            config: {},
            license: {},
        },
        channels: {
            currentChannelId: 'channel_id',
            channels: {
                channel_id: {
                    id: 'channel_id',
                    type: 'O' as ChannelType,
                    display_name: 'Test Channel',
                    delete_at: 0,
                },
            },
        },
        preferences: {
            myPreferences: {},
        },
    },
};

const baseProps = {
    channelId: 'channel_id',
    onExited: jest.fn(),
    onConfirm: jest.fn().mockResolvedValue({}),
};

describe('ScheduledPostCustomTimeModal', () => {
    it('shows the repeat weekly checkbox by default', () => {
        renderWithContext(
            <ScheduledPostCustomTimeModal {...baseProps}/>,
            initialState,
        );

        expect(screen.getByRole('checkbox', {name: 'Repeat weekly'})).toBeInTheDocument();
    });

    it('hides the repeat weekly checkbox when recurring is not allowed', () => {
        renderWithContext(
            <ScheduledPostCustomTimeModal
                {...baseProps}
                allowRecurring={false}
            />,
            initialState,
        );

        expect(screen.queryByRole('checkbox', {name: 'Repeat weekly'})).not.toBeInTheDocument();
    });
});
