// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import SidebarChannel from 'components/sidebar/sidebar_channel/sidebar_channel';

import type {ChannelType} from '@mattermost/types/channels';

describe('components/sidebar/sidebar_channel', () => {
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
        channelId: 'channel_id',
        isDraggable: false,
        channelIndex: 0,
        currentTeamName: 'team_name',
        unreadMentions: 0,
        isUnread: false,
        setChannelRef: jest.fn(),
        isCategoryCollapsed: false,
        isCurrentChannel: false,
        isAutoSortedCategory: false,
        isCategoryDragged: false,
        isDropDisabled: false,
        draggingState: {},
        multiSelectedChannelIds: [],
        autoSortedCategoryIds: new Set<string>(),
        isChannelSelected: false,
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <SidebarChannel {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when collapsed', () => {
        const props = {
            ...baseProps,
            isCategoryCollapsed: true,
        };

        const wrapper = shallow(
            <SidebarChannel {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when unread', () => {
        const props = {
            ...baseProps,
            isUnread: true,
            unreadMentions: 1,
        };

        const wrapper = shallow(
            <SidebarChannel {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when active', () => {
        const props = {
            ...baseProps,
            isCurrentChannel: true,
        };

        const wrapper = shallow(
            <SidebarChannel {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when DM channel', () => {
        const props = {
            ...baseProps,
            channel: {
                ...baseProps.channel,
                type: 'D' as ChannelType,
            },
        };

        const wrapper = shallow(
            <SidebarChannel {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when GM channel', () => {
        const props = {
            ...baseProps,
            channel: {
                ...baseProps.channel,
                type: 'G' as ChannelType,
            },
        };

        const wrapper = shallow(
            <SidebarChannel {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should not be collapsed when there are unread messages', () => {
        const props = {
            ...baseProps,
            isCategoryCollapsed: true,
            isUnread: true,
        };

        const wrapper = shallow(
            <SidebarChannel {...props}/>,
        );

        expect(wrapper.find('.expanded')).toHaveLength(1);
    });

    test('should not be collapsed if channel is current channel', () => {
        const props = {
            ...baseProps,
            isCategoryCollapsed: true,
            isCurrentChannel: true,
        };

        const wrapper = shallow(
            <SidebarChannel {...props}/>,
        );

        expect(wrapper.find('.expanded')).toHaveLength(1);
    });
});
