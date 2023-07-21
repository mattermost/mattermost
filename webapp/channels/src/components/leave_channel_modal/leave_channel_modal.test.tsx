// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ChannelType} from '@mattermost/types/channels';
import {shallow} from 'enzyme';
import React from 'react';

import ConfirmModal from 'components/confirm_modal';
import LeaveChannelModal from 'components/leave_channel_modal/leave_channel_modal';

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
            onExited: jest.fn(),
            actions: {
                leaveChannel: jest.fn(),
            },
        };

        const wrapper = shallow(
            <LeaveChannelModal {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should fail to leave channel', () => {
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
        const wrapper = shallow<typeof LeaveChannelModal>(
            <LeaveChannelModal
                {...props}
            />,
        );

        wrapper.find(ConfirmModal).props().onConfirm?.(true);
        expect(props.actions.leaveChannel).toHaveBeenCalledTimes(1);
        expect(props.callback).toHaveBeenCalledTimes(0);
    });
});
