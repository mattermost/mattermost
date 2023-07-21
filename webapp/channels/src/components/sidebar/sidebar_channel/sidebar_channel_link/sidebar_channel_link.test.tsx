// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ChannelType} from '@mattermost/types/channels';
import {shallow} from 'enzyme';
import React from 'react';

import SidebarChannelLink from 'components/sidebar/sidebar_channel/sidebar_channel_link/sidebar_channel_link';

describe('components/sidebar/sidebar_channel/sidebar_channel_link', () => {
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
        link: 'http://a.fake.link',
        label: 'channel_label',
        icon: null,
        unreadMentions: 0,
        isUnread: false,
        isMuted: false,
        isChannelSelected: false,
        hasUrgent: false,
        showChannelsTutorialStep: false,
        actions: {
            markMostRecentPostInChannelAsUnread: jest.fn(),
            multiSelectChannel: jest.fn(),
            multiSelectChannelAdd: jest.fn(),
            multiSelectChannelTo: jest.fn(),
            clearChannelSelection: jest.fn(),
            openLhs: jest.fn(),
            unsetEditingPost: jest.fn(),
            closeRightHandSide: jest.fn(),
        },
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <SidebarChannelLink {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot for desktop', () => {
        const userAgentMock = jest.requireMock('utils/user_agent');
        userAgentMock.isDesktopApp.mockImplementation(() => false);

        const wrapper = shallow(
            <SidebarChannelLink {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when tooltip is enabled', () => {
        const wrapper = shallow(
            <SidebarChannelLink {...baseProps}/>,
        );

        wrapper.setState({showTooltip: true});
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with aria label prefix and unread mentions', () => {
        const props = {
            ...baseProps,
            isUnread: true,
            unreadMentions: 2,
            ariaLabelPrefix: 'aria_label_prefix_',
        };

        const wrapper = shallow(
            <SidebarChannelLink {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should enable tooltip when needed', () => {
        const wrapper = shallow<SidebarChannelLink>(
            <SidebarChannelLink {...baseProps}/>,
        );
        const instance = wrapper.instance();

        instance.labelRef = {
            current: {
                offsetWidth: 50,
                scrollWidth: 60,
            },
        } as any;

        instance.enableToolTipIfNeeded();
        expect(instance.state.showTooltip).toBe(true);
    });
});
