// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';

import SidebarChannelLink, {type SidebarChannelLink as SidebarChannelLinkComponent} from 'components/sidebar/sidebar_channel/sidebar_channel_link/sidebar_channel_link';

import {shallowWithIntl, defaultIntl} from 'tests/helpers/intl-test-helper';

jest.mock('packages/mattermost-redux/src/selectors/entities/shared_channels', () => ({
    getRemoteNamesForChannel: jest.fn(),
}));

jest.mock('packages/mattermost-redux/src/actions/shared_channels', () => ({
    fetchChannelRemotes: jest.fn(() => ({type: 'MOCK_ACTION'})),
}));

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
        remoteNames: [],
        isSharedChannel: false,
        fetchChannelRemotes: jest.fn(),
        intl: defaultIntl,
        actions: {
            markMostRecentPostInChannelAsUnread: jest.fn(),
            multiSelectChannel: jest.fn(),
            multiSelectChannelAdd: jest.fn(),
            multiSelectChannelTo: jest.fn(),
            clearChannelSelection: jest.fn(),
            openLhs: jest.fn(),
            unsetEditingPost: jest.fn(),
            closeRightHandSide: jest.fn(),
            fetchChannelRemotes: jest.fn(),
        },
    };

    test('should match snapshot', () => {
        const wrapper = shallowWithIntl(
            <SidebarChannelLink {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot for desktop', () => {
        const userAgentMock = jest.requireMock('utils/user_agent');
        userAgentMock.isDesktopApp.mockImplementation(() => false);

        const wrapper = shallowWithIntl(
            <SidebarChannelLink {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when tooltip is enabled', () => {
        const wrapper = shallowWithIntl(
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

        const wrapper = shallowWithIntl(
            <SidebarChannelLink {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should enable tooltip when needed', () => {
        const wrapper = shallowWithIntl(
            <SidebarChannelLink {...baseProps}/>,
        );
        const instance = wrapper.instance() as SidebarChannelLinkComponent;

        instance.labelRef = {
            current: {
                offsetWidth: 50,
                scrollWidth: 60,
            },
        } as any;

        instance.enableToolTipIfNeeded();
        expect(instance.state.showTooltip).toBe(true);
    });

    test('should not fetch shared channels for non-shared channels', () => {
        const props = {
            ...baseProps,
            isSharedChannel: false,
        };

        const wrapper = shallowWithIntl(
            <SidebarChannelLink {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
        expect(props.actions.fetchChannelRemotes).not.toHaveBeenCalled();
    });

    test('should fetch shared channels data when channel is shared', () => {
        const props = {
            ...baseProps,
            isSharedChannel: true,
            remoteNames: [],
        };

        const wrapper = shallowWithIntl(
            <SidebarChannelLink {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
        expect(props.actions.fetchChannelRemotes).toHaveBeenCalledWith('channel_id');
    });

    test('should not fetch shared channels data when data already exists', () => {
        const props = {
            ...baseProps,
            isSharedChannel: true,
            remoteNames: ['Remote 1', 'Remote 2'],
        };

        const wrapper = shallowWithIntl(
            <SidebarChannelLink {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
        expect(props.actions.fetchChannelRemotes).not.toHaveBeenCalled();
    });

    test('should refetch when channel changes', () => {
        const props = {
            ...baseProps,
            isSharedChannel: true,
            remoteNames: [],
        };

        const wrapper = shallowWithIntl(
            <SidebarChannelLink {...props}/>,
        );

        props.actions.fetchChannelRemotes.mockClear();

        wrapper.setProps({
            ...props,
            channel: {
                ...props.channel,
                id: 'new_channel_id',
            },
        });

        expect(props.actions.fetchChannelRemotes).toHaveBeenCalledWith('new_channel_id');
    });
});
