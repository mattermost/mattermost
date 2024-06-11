// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';

import SidebarBaseChannel from 'components/sidebar/sidebar_channel/sidebar_base_channel/sidebar_base_channel';

describe('components/sidebar/sidebar_channel/sidebar_base_channel', () => {
    const baseProps = {
        channel: {
            id: 'channel_id',
            display_name: 'channel_display_name',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
            team_id: '',
            type: 'O' as ChannelType,
            name: '',
            header: '',
            purpose: '',
            last_post_at: 0,
            last_root_post_at: 0,
            creator_id: '',
            scheme_id: '',
            group_constrained: false,
        },
        currentTeamName: 'team_name',
        actions: {
            leaveChannel: jest.fn(),
            openModal: jest.fn(),
        },
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <SidebarBaseChannel {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when shared channel', () => {
        const props = {
            ...baseProps,
            channel: {
                ...baseProps.channel,
                shared: true,
            },
        };

        const wrapper = shallow(
            <SidebarBaseChannel {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when private channel', () => {
        const props = {
            ...baseProps,
            channel: {
                ...baseProps.channel,
                type: 'P' as ChannelType,
            },
        };

        const wrapper = shallow(
            <SidebarBaseChannel {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when shared private channel', () => {
        const props = {
            ...baseProps,
            channel: {
                ...baseProps.channel,
                type: 'P' as ChannelType,
                shared: true,
            },
        };

        const wrapper = shallow(
            <SidebarBaseChannel {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('expect callback to be called when leave public channel ', () => {
        const callback = jest.fn();
        const wrapper = shallow<SidebarBaseChannel>(<SidebarBaseChannel {...baseProps}/>);
        wrapper.instance().handleLeavePublicChannel(callback);
        expect(callback).toBeCalled();
    });

    test('expect callback to be called when leave private channel ', () => {
        const callback = jest.fn();
        const props = {
            ...baseProps,
            channel: {
                ...baseProps.channel,
                type: 'P' as ChannelType,
            },
        };

        const wrapper = shallow<SidebarBaseChannel>(<SidebarBaseChannel {...props}/>);
        wrapper.instance().handleLeavePrivateChannel(callback);
        expect(callback).toBeCalled();
    });
});
