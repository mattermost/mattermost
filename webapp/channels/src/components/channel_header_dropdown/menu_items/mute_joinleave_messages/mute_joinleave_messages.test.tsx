// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import Menu from 'components/widgets/menu/menu';

import {TestHelper} from 'utils/test_helper';

import MuteJoinLeaveMessages from './mute_joinleave_messages';

describe('components/ChannelHeaderDropdown/MenuItem.MuteJoinLeaveMessages', () => {
    const baseProps = {
        channel: TestHelper.getChannelMock({
            id: 'channel_id',
            type: 'O',
        }),
        actions: {
            patchChannel: jest.fn(),
        },
    };

    it('should match snapshot', () => {
        const wrapper = shallow<typeof MuteJoinLeaveMessages>(<MuteJoinLeaveMessages {...baseProps}/>);
        expect(wrapper).toMatchSnapshot();
    });

    it('should read "show join/leave messages"', () => {
        const props = {
            ...baseProps,
            channel: {
                ...baseProps.channel,
                exclude_post_types: ['system_join_channel', 'system_leave_channel'],
            },
        };
        const wrapper = shallow<typeof MuteJoinLeaveMessages>(<MuteJoinLeaveMessages {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    it('should read "hide join/leave messages"', () => {
        const props = {
            ...baseProps,
            channel: {
                ...baseProps.channel,
                exclude_post_types: [],
            },
        };
        const wrapper = shallow<typeof MuteJoinLeaveMessages>(<MuteJoinLeaveMessages {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    it('should run patchChannel function on click to set as muted', () => {
        const props = {
            ...baseProps,
            channel: {
                ...baseProps.channel,
                exclude_post_types: [],
            },
            actions: {...baseProps.actions},
        };
        const wrapper = shallow<typeof MuteJoinLeaveMessages>(<MuteJoinLeaveMessages {...props}/>);

        wrapper.find(Menu.ItemAction).simulate('click', {
            preventDefault: jest.fn(),
        });
        expect(props.actions.patchChannel).toHaveBeenCalledWith(props.channel.id, {
            exclude_post_types: ['system_join_channel', 'system_leave_channel'],
        });
    });
    it('should run patchChannel function on click to set as unmuted', () => {
        const props = {
            ...baseProps,
            channel: {
                ...baseProps.channel,
                exclude_post_types: ['system_join_channel', 'system_leave_channel'],
            },
            actions: {...baseProps.actions},
        };
        const wrapper = shallow<typeof MuteJoinLeaveMessages>(<MuteJoinLeaveMessages {...props}/>);

        wrapper.find(Menu.ItemAction).simulate('click', {
            preventDefault: jest.fn(),
        });
        expect(props.actions.patchChannel).toHaveBeenCalledWith(props.channel.id, {
            exclude_post_types: [],
        });
    });
    it('should run patchChannel function on click to set as unmuted and persist other exclude types', () => {
        const props = {
            ...baseProps,
            channel: {
                ...baseProps.channel,
                exclude_post_types: ['system_join_channel', 'system_leave_channel', 'another_one'],
            },
            actions: {...baseProps.actions},
        };
        const wrapper = shallow<typeof MuteJoinLeaveMessages>(<MuteJoinLeaveMessages {...props}/>);

        wrapper.find(Menu.ItemAction).simulate('click', {
            preventDefault: jest.fn(),
        });
        expect(props.actions.patchChannel).toHaveBeenCalledWith(props.channel.id, {
            exclude_post_types: ['another_one'],
        });
    });
});
