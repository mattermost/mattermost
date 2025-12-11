// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';

import {renderWithContext, screen, fireEvent} from 'tests/vitest_react_testing_utils';

import LeaveChannelModal from './leave_channel_modal';

describe('components/LeaveChannelModal', () => {
    const channels = {
        'channel-1': {
            id: 'channel-1',
            name: 'test-channel-1',
            display_name: 'Test Channel 1',
            type: ('P' as ChannelType),
            team_id: 'team-1',
            header: '',
            purpose: '',
            creator_id: '',
            scheme_id: '',
            group_constrained: false,
            create_at: 0,
            update_at: 0,
            delete_at: 0,
            last_post_at: 0,
            last_root_post_at: 0,
        },
        'channel-2': {
            id: 'channel-2',
            name: 'test-channel-2',
            display_name: 'Test Channel 2',
            team_id: 'team-1',
            type: ('P' as ChannelType),
            header: '',
            purpose: '',
            creator_id: '',
            scheme_id: '',
            group_constrained: false,
            create_at: 0,
            update_at: 0,
            delete_at: 0,
            last_post_at: 0,
            last_root_post_at: 0,
        },
        'town-square': {
            id: 'town-square-id',
            name: 'town-square',
            display_name: 'Town Square',
            type: ('O' as ChannelType),
            team_id: 'team-1',
            header: '',
            purpose: '',
            creator_id: '',
            scheme_id: '',
            group_constrained: false,
            create_at: 0,
            update_at: 0,
            delete_at: 0,
            last_post_at: 0,
            last_root_post_at: 0,
        },
    };

    test('should match snapshot, init', () => {
        const props = {
            channel: channels['town-square'],
            onExited: vi.fn(),
            actions: {
                leaveChannel: vi.fn(),
            },
        };

        const {container} = renderWithContext(
            <LeaveChannelModal {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should fail to leave channel', async () => {
        const leaveChannel = vi.fn().mockImplementation(() => {
            const error = {
                message: 'error leaving channel',
            };

            return Promise.resolve({error});
        });

        const callback = vi.fn();
        const props = {
            channel: channels['channel-1'],
            actions: {
                leaveChannel,
            },
            onExited: vi.fn(),
            callback,
        };

        renderWithContext(
            <LeaveChannelModal {...props}/>,
        );

        // Click the confirm button
        const confirmButton = screen.getByRole('button', {name: /yes, leave channel/i});
        fireEvent.click(confirmButton);

        expect(leaveChannel).toHaveBeenCalledTimes(1);

        // Wait for the promise to resolve
        await vi.waitFor(() => {
            expect(callback).toHaveBeenCalledTimes(0);
        });
    });
});
