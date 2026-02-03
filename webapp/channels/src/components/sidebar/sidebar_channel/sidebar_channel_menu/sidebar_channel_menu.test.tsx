// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';

import {CategoryTypes} from 'mattermost-redux/constants/channel_categories';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import Constants from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import SidebarChannelMenu from './sidebar_channel_menu';

jest.mock('react-intl', () => ({
    ...jest.requireActual('react-intl'),
    useIntl: () => ({
        formatMessage: (message: {id: string; defaultMessage: string}) => {
            return message.defaultMessage;
        },
    }),
}));

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
    };

    const openMenu = async () => {
        const user = userEvent.setup();
        const menuButton = screen.getByRole('button', {name: /channel options/i});
        await user.click(menuButton);
        await screen.findByRole('menu', {name: 'Edit channel menu'});
    };

    test('should match snapshot and contain correct buttons', async () => {
        const {baseElement} = renderWithContext(
            <SidebarChannelMenu {...baseProps}/>,
        );

        await openMenu();

        expect(screen.getByRole('menuitem', {name: 'Favorite'})).toBeInTheDocument();
        expect(screen.getByRole('menuitem', {name: 'Mute Channel'})).toBeInTheDocument();
        expect(screen.getByRole('menuitem', {name: 'Copy Link'})).toBeInTheDocument();
        expect(screen.getByRole('menuitem', {name: 'Add Members'})).toBeInTheDocument();
        expect(screen.getByRole('menuitem', {name: 'Leave Channel'})).toBeInTheDocument();

        expect(baseElement).toMatchSnapshot();
    });

    test('should show correct menu items when channel is unread', async () => {
        const props = {
            ...baseProps,
            isUnread: true,
        };

        const {baseElement} = renderWithContext(
            <SidebarChannelMenu {...props}/>,
        );

        await openMenu();
        expect(screen.getByRole('menuitem', {name: 'Mark as Read'})).toBeInTheDocument();

        expect(baseElement).toMatchSnapshot();
    });

    test('should show correct menu items when channel is read', async () => {
        const props = {
            ...baseProps,
            isUnread: false,
        };

        const {baseElement} = renderWithContext(
            <SidebarChannelMenu {...props}/>,
        );

        await openMenu();
        expect(screen.getByRole('menuitem', {name: 'Mark as Unread'})).toBeInTheDocument();

        expect(baseElement).toMatchSnapshot();
    });

    test('should show correct menu items when channel is favorite', async () => {
        const props = {
            ...baseProps,
            isFavorite: true,
        };

        const {baseElement} = renderWithContext(
            <SidebarChannelMenu {...props}/>,
        );

        await openMenu();
        expect(screen.queryByRole('menuitem', {name: 'Favorite'})).not.toBeInTheDocument();
        expect(screen.getByRole('menuitem', {name: 'Unfavorite'})).toBeInTheDocument();

        expect(baseElement).toMatchSnapshot();
    });

    test('should show correct menu items when channel is muted', async () => {
        const props = {
            ...baseProps,
            isMuted: true,
        };

        const {baseElement} = renderWithContext(
            <SidebarChannelMenu {...props}/>,
        );

        await openMenu();
        expect(screen.queryByRole('menuitem', {name: 'Mute Channel'})).not.toBeInTheDocument();
        expect(screen.getByRole('menuitem', {name: 'Unmute Channel'})).toBeInTheDocument();

        expect(baseElement).toMatchSnapshot();
    });

    test('should show correct menu items when channel is private', async () => {
        const props = {
            ...baseProps,
            channel: {
                ...baseProps.channel,
                type: 'P' as ChannelType,
            },
        };

        const {baseElement} = renderWithContext(
            <SidebarChannelMenu {...props}/>,
        );

        await openMenu();
        expect(screen.getByRole('menuitem', {name: 'Copy Link'})).toBeInTheDocument();
        expect(baseElement).toMatchSnapshot();
    });

    test('should show correct menu items when channel is DM', async () => {
        const props = {
            ...baseProps,
            channel: {
                ...baseProps.channel,
                type: 'D' as ChannelType,
            },
        };

        const {baseElement} = renderWithContext(
            <SidebarChannelMenu {...props}/>,
        );

        await openMenu();
        expect(screen.queryByRole('menuitem', {name: 'Copy Link'})).not.toBeInTheDocument();
        expect(screen.queryByRole('menuitem', {name: 'Add Members'})).not.toBeInTheDocument();

        expect(baseElement).toMatchSnapshot();
    });

    test('should show correct menu items when channel is Town Square', async () => {
        const props = {
            ...baseProps,
            channel: {
                ...baseProps.channel,
                name: Constants.DEFAULT_CHANNEL,
            },
        };

        const {baseElement} = renderWithContext(
            <SidebarChannelMenu {...props}/>,
        );

        await openMenu();
        expect(screen.queryByRole('menuitem', {name: 'Leave Channel'})).not.toBeInTheDocument();

        expect(baseElement).toMatchSnapshot();
    });

    test('should match snapshot of rendered items when multiselecting channels - public channels and DM category', async () => {
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

        const {baseElement} = renderWithContext(
            <SidebarChannelMenu {...props}/>,
        );

        await openMenu();
        expect(baseElement).toMatchSnapshot();
    });

    test('should match snapshot of rendered items when multiselecting channels - DM channels and public channels category', async () => {
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

        renderWithContext(
            <SidebarChannelMenu {...props}/>,
        );

        await openMenu();
        expect(document.body).toMatchSnapshot();
    });
});
