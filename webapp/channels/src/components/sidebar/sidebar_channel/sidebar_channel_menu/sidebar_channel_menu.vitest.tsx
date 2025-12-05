// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';

import {CategoryTypes} from 'mattermost-redux/constants/channel_categories';

import {renderWithContext} from 'tests/vitest_react_testing_utils';
import Constants from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import SidebarChannelMenu from './sidebar_channel_menu';

vi.mock('react-intl', async () => {
    const actual = await vi.importActual('react-intl');
    return {
        ...actual as object,
        useIntl: () => ({
            formatMessage: (message: {id: string; defaultMessage: string}) => {
                return message.defaultMessage;
            },
        }),
    };
});

describe('components/sidebar/sidebar_channel/sidebar_channel_menu', () => {
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
        closeHandler: vi.fn(),
        isMenuOpen: true,
        onToggleMenu: vi.fn(),
        multiSelectedChannelIds: [],
        displayedChannels: [],
        readMultipleChannels: vi.fn(),
        markMostRecentPostInChannelAsUnread: vi.fn(),
        favoriteChannel: vi.fn(),
        unfavoriteChannel: vi.fn(),
        muteChannel: vi.fn(),
        unmuteChannel: vi.fn(),
        openModal: vi.fn(),
        createCategory: vi.fn(),
        addChannelsInSidebar: vi.fn(),
        onMenuToggle: vi.fn(),
    };

    test('should match snapshot and contain correct buttons', () => {
        const {container} = renderWithContext(
            <SidebarChannelMenu {...baseProps}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should show correct menu items when channel is unread', () => {
        const props = {
            ...baseProps,
            isUnread: true,
        };

        const {container} = renderWithContext(
            <SidebarChannelMenu {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should show correct menu items when channel is read', () => {
        const props = {
            ...baseProps,
            isUnread: false,
        };

        const {container} = renderWithContext(
            <SidebarChannelMenu {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should show correct menu items when channel is favorite', () => {
        const props = {
            ...baseProps,
            isFavorite: true,
        };

        const {container} = renderWithContext(
            <SidebarChannelMenu {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should show correct menu items when channel is muted', () => {
        const props = {
            ...baseProps,
            isMuted: true,
        };

        const {container} = renderWithContext(
            <SidebarChannelMenu {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should show correct menu items when channel is private', () => {
        const props = {
            ...baseProps,
            channel: {
                ...baseProps.channel,
                type: 'P' as ChannelType,
            },
        };

        const {container} = renderWithContext(
            <SidebarChannelMenu {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should show correct menu items when channel is DM', () => {
        const props = {
            ...baseProps,
            channel: {
                ...baseProps.channel,
                type: 'D' as ChannelType,
            },
        };

        const {container} = renderWithContext(
            <SidebarChannelMenu {...props}/>,
        );

        expect(container.querySelector('#copyLink-channel_id')).not.toBeInTheDocument();
        expect(container.querySelector('#addMembers-channel_id')).not.toBeInTheDocument();

        expect(container).toMatchSnapshot();
    });

    test('should show correct menu items when channel is Town Square', () => {
        const props = {
            ...baseProps,
            channel: {
                ...baseProps.channel,
                name: Constants.DEFAULT_CHANNEL,
            },
        };

        const {container} = renderWithContext(
            <SidebarChannelMenu {...props}/>,
        );

        expect(container.querySelector('#leave-channel_id')).not.toBeInTheDocument();

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot of rendered items when multiselecting channels - public channels and DM category', () => {
        const props = {
            ...baseProps,
            categories: [
                ...baseProps.categories,
                TestHelper.getCategoryMock({
                    id: 'dm_category_id',
                    display_name: 'direct_messages',
                    type: CategoryTypes.DIRECT_MESSAGES,
                }),
            ],
            multiSelectedChannelIds: ['not_a_dm_channel', 'channel_id'],
            displayedChannels: [
                testChannel,
                TestHelper.getChannelMock({
                    id: 'not_a_dm_channel',
                }),
            ],
        };

        const {container} = renderWithContext(
            <SidebarChannelMenu {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot of rendered items when multiselecting channels - DM channels and public channels category', () => {
        const props = {
            ...baseProps,
            categories: [
                ...baseProps.categories,
                TestHelper.getCategoryMock({
                    id: 'channels_category_id',
                    display_name: 'channels',
                    type: CategoryTypes.CHANNELS,
                }),
            ],
            multiSelectedChannelIds: ['a_dm_channel', 'channel_id'],
            displayedChannels: [
                TestHelper.getChannelMock({
                    ...testChannel,
                    type: 'D',
                }),
                TestHelper.getChannelMock({
                    id: 'a_dm_channel',
                    type: 'D',
                }),
            ],
        };

        const {container} = renderWithContext(
            <SidebarChannelMenu {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });
});
