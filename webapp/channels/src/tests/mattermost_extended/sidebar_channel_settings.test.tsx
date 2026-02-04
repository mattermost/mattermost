// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Tests for SidebarChannelSettings tweak
 *
 * When MattermostExtendedSettings.Channels.SidebarChannelSettings is enabled,
 * a "Channel Settings" menu item appears in the sidebar channel right-click menu
 * for public and private channels.
 */

import {shallow} from 'enzyme';
import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';

import {TestHelper} from 'utils/test_helper';

import SidebarChannelMenu from 'components/sidebar/sidebar_channel/sidebar_channel_menu/sidebar_channel_menu';

jest.mock('react-intl', () => ({
    ...jest.requireActual('react-intl'),
    useIntl: () => ({
        formatMessage: (message: {id: string; defaultMessage: string}) => {
            return message.defaultMessage;
        },
    }),
}));

describe('SidebarChannelSettings tweak', () => {
    const testChannel = TestHelper.getChannelMock();
    const testCategory = TestHelper.getCategoryMock();

    const baseProps = {
        channel: testChannel,
        channelLink: 'http://a.fake.link',
        categories: [testCategory],
        currentUserId: 'user_id',
        currentCategory: testCategory,
        currentTeamId: 'team_id',
        isUnread: false,
        isFavorite: false,
        isMuted: false,
        managePublicChannelMembers: true,
        managePrivateChannelMembers: true,
        closeHandler: jest.fn(),
        isMenuOpen: true,
        onToggleMenu: jest.fn(),
        multiSelectedChannelIds: [],
        displayedChannels: [],
        readMultipleChannels: jest.fn(),
        markMostRecentPostInChannelAsUnread: jest.fn(),
        favoriteChannel: jest.fn(),
        unfavoriteChannel: jest.fn(),
        muteChannel: jest.fn(),
        unmuteChannel: jest.fn(),
        openModal: jest.fn(),
        createCategory: jest.fn(),
        addChannelsInSidebar: jest.fn(),
        onMenuToggle: jest.fn(),
        sidebarChannelSettingsEnabled: false,
        canAccessChannelSettings: false,
    };

    describe('when tweak is enabled', () => {
        it('should show Channel Settings menu item when user has access', () => {
            const props = {
                ...baseProps,
                sidebarChannelSettingsEnabled: true,
                canAccessChannelSettings: true,
            };

            const wrapper = shallow(
                <SidebarChannelMenu {...props}/>,
            );

            expect(wrapper.find('#channelSettings-channel_id')).toHaveLength(1);
        });

        it('should show Channel Settings for public channels', () => {
            const props = {
                ...baseProps,
                channel: {
                    ...baseProps.channel,
                    type: 'O' as ChannelType,
                },
                sidebarChannelSettingsEnabled: true,
                canAccessChannelSettings: true,
            };

            const wrapper = shallow(
                <SidebarChannelMenu {...props}/>,
            );

            expect(wrapper.find('#channelSettings-channel_id')).toHaveLength(1);
        });

        it('should show Channel Settings for private channels', () => {
            const props = {
                ...baseProps,
                channel: {
                    ...baseProps.channel,
                    type: 'P' as ChannelType,
                },
                sidebarChannelSettingsEnabled: true,
                canAccessChannelSettings: true,
            };

            const wrapper = shallow(
                <SidebarChannelMenu {...props}/>,
            );

            expect(wrapper.find('#channelSettings-channel_id')).toHaveLength(1);
        });

        it('should NOT show Channel Settings for DM channels', () => {
            const props = {
                ...baseProps,
                channel: {
                    ...baseProps.channel,
                    type: 'D' as ChannelType,
                },
                sidebarChannelSettingsEnabled: true,
                canAccessChannelSettings: true,
            };

            const wrapper = shallow(
                <SidebarChannelMenu {...props}/>,
            );

            expect(wrapper.find('#channelSettings-channel_id')).toHaveLength(0);
        });

        it('should NOT show Channel Settings for GM channels', () => {
            const props = {
                ...baseProps,
                channel: {
                    ...baseProps.channel,
                    type: 'G' as ChannelType,
                },
                sidebarChannelSettingsEnabled: true,
                canAccessChannelSettings: true,
            };

            const wrapper = shallow(
                <SidebarChannelMenu {...props}/>,
            );

            expect(wrapper.find('#channelSettings-channel_id')).toHaveLength(0);
        });

        it('should NOT show Channel Settings when user does not have access', () => {
            const props = {
                ...baseProps,
                sidebarChannelSettingsEnabled: true,
                canAccessChannelSettings: false,
            };

            const wrapper = shallow(
                <SidebarChannelMenu {...props}/>,
            );

            expect(wrapper.find('#channelSettings-channel_id')).toHaveLength(0);
        });
    });

    describe('when tweak is disabled', () => {
        it('should NOT show Channel Settings menu item', () => {
            const props = {
                ...baseProps,
                sidebarChannelSettingsEnabled: false,
                canAccessChannelSettings: true,
            };

            const wrapper = shallow(
                <SidebarChannelMenu {...props}/>,
            );

            expect(wrapper.find('#channelSettings-channel_id')).toHaveLength(0);
        });

        it('should NOT show Channel Settings even when user has access', () => {
            const props = {
                ...baseProps,
                channel: {
                    ...baseProps.channel,
                    type: 'O' as ChannelType,
                },
                sidebarChannelSettingsEnabled: false,
                canAccessChannelSettings: true,
            };

            const wrapper = shallow(
                <SidebarChannelMenu {...props}/>,
            );

            expect(wrapper.find('#channelSettings-channel_id')).toHaveLength(0);
        });
    });

    describe('menu item behavior', () => {
        it('should call openModal when Channel Settings is clicked', () => {
            const openModal = jest.fn();
            const props = {
                ...baseProps,
                sidebarChannelSettingsEnabled: true,
                canAccessChannelSettings: true,
                openModal,
            };

            const wrapper = shallow(
                <SidebarChannelMenu {...props}/>,
            );

            const menuItem = wrapper.find('#channelSettings-channel_id');
            expect(menuItem).toHaveLength(1);

            // Simulate click - the onClick handler should call openModal
            menuItem.simulate('click');
            expect(openModal).toHaveBeenCalledWith(expect.objectContaining({
                modalId: expect.any(String),
                dialogType: expect.any(Function),
                dialogProps: expect.objectContaining({
                    channelId: 'channel_id',
                }),
            }));
        });
    });
});
