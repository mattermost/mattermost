// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type {ChannelType} from '@mattermost/types/channels';

import {renderWithIntlAndStore} from 'tests/react_testing_utils';
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

    test('should match component state with given props', () => {
        const props = {
            channel: channels['town-square'],
            onExited: jest.fn(),
            actions: {
                leaveChannel: jest.fn(),
            },
        };

        renderWithIntlAndStore(<LeaveChannelModal {...props}/>, {});

        expect(screen.getByText('Leave the channel')).toBeInTheDocument();
        expect(screen.getByText('Are you sure you wish to leave the channel?')).toBeInTheDocument();
        
        const confirmButton = screen.getByRole('button', {name: /yes/i});
        const cancelButton = screen.getByRole('button', {name: /no/i});
        
        expect(confirmButton).toBeInTheDocument();
        expect(cancelButton).toBeInTheDocument();
    });

    test('should fail to leave channel', async () => {
        const user = userEvent;
        const props = {
            channel: channels['channel-1'],
            actions: {
                leaveChannel: jest.fn().mockImplementation(() => {
                    const error = {
                        message: 'error leaving channel',
                    };

                    return Promise.resolve({error});
                }),
            },
            onExited: jest.fn(),
            callback: jest.fn(),
        };

        renderWithIntlAndStore(<LeaveChannelModal {...props}/>, {});

        const confirmButton = screen.getByRole('button', {name: /yes/i});
        await user.click(confirmButton);

        expect(props.actions.leaveChannel).toHaveBeenCalledTimes(1);
        expect(props.callback).toHaveBeenCalledTimes(0);
    });
});
