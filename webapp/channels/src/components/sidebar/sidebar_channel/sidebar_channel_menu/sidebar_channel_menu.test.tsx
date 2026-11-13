// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';

import {renderWithContext, screen, userEvent, waitFor, within} from 'tests/react_testing_utils';
import {boardChannelsState} from 'utils/channel_kind_test_utils';
import Constants from 'utils/constants';
import {canPopout, isChannelPopoutWindow} from 'utils/popouts/popout_windows';
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

jest.mock('utils/popouts/popout_windows', () => ({
    ...jest.requireActual('utils/popouts/popout_windows'),
    canPopout: jest.fn(() => true),
    isChannelPopoutWindow: jest.fn(() => false),
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

        // Tooltip-on-hover is opened by `userEvent.click` before the click reaches
        // the button; the menu opening then dismisses it via a fade-out transition.
        // Wait for the tooltip portal child to fully unmount so snapshots are
        // deterministic and don't capture the in-flight fade-out (which is
        // sensitive to timer scheduling and CI load).
        const portal = document.getElementById('root-portal');
        if (portal) {
            await waitFor(() => {
                expect(within(portal).queryByRole('tooltip', {hidden: true})).not.toBeInTheDocument();
            });
        }
    };

    test('should render and contain correct buttons', async () => {
        renderWithContext(
            <SidebarChannelMenu {...baseProps}/>,
        );

        await openMenu();

        expect(screen.getByRole('menuitem', {name: 'Favorite'})).toBeInTheDocument();
        expect(screen.getByRole('menuitem', {name: 'Mute Channel'})).toBeInTheDocument();
        expect(screen.getByRole('menuitem', {name: 'Copy Link'})).toBeInTheDocument();
        expect(screen.getByRole('menuitem', {name: 'Add Members'})).toBeInTheDocument();
        expect(screen.getByRole('menuitem', {name: 'Leave Channel'})).toBeInTheDocument();
    });

    test('should show correct menu items when channel is unread', async () => {
        const props = {
            ...baseProps,
            isUnread: true,
        };

        renderWithContext(
            <SidebarChannelMenu {...props}/>,
        );

        await openMenu();
        expect(screen.getByRole('menuitem', {name: 'Mark as Read'})).toBeInTheDocument();
    });

    test('should show correct menu items when channel is read', async () => {
        const props = {
            ...baseProps,
            isUnread: false,
        };

        renderWithContext(
            <SidebarChannelMenu {...props}/>,
        );

        await openMenu();
        expect(screen.getByRole('menuitem', {name: 'Mark as Unread'})).toBeInTheDocument();
    });

    test('should show correct menu items when channel is favorite', async () => {
        const props = {
            ...baseProps,
            isFavorite: true,
        };

        renderWithContext(
            <SidebarChannelMenu {...props}/>,
        );

        await openMenu();
        expect(screen.queryByRole('menuitem', {name: 'Favorite'})).not.toBeInTheDocument();
        expect(screen.getByRole('menuitem', {name: 'Unfavorite'})).toBeInTheDocument();
    });

    test('should show correct menu items when channel is muted', async () => {
        const props = {
            ...baseProps,
            isMuted: true,
        };

        renderWithContext(
            <SidebarChannelMenu {...props}/>,
        );

        await openMenu();
        expect(screen.queryByRole('menuitem', {name: 'Mute Channel'})).not.toBeInTheDocument();
        expect(screen.getByRole('menuitem', {name: 'Unmute Channel'})).toBeInTheDocument();
    });

    test('should show correct menu items when channel is private', async () => {
        const props = {
            ...baseProps,
            channel: {
                ...baseProps.channel,
                type: 'P' as ChannelType,
            },
        };

        renderWithContext(
            <SidebarChannelMenu {...props}/>,
        );

        await openMenu();
        expect(screen.getByRole('menuitem', {name: 'Copy Link'})).toBeInTheDocument();
    });

    test('should show correct menu items when channel is DM', async () => {
        const props = {
            ...baseProps,
            channel: {
                ...baseProps.channel,
                type: 'D' as ChannelType,
            },
        };

        renderWithContext(
            <SidebarChannelMenu {...props}/>,
        );

        await openMenu();
        expect(screen.queryByRole('menuitem', {name: 'Copy Link'})).not.toBeInTheDocument();
        expect(screen.queryByRole('menuitem', {name: 'Add Members'})).not.toBeInTheDocument();
    });

    test('should show correct menu items when channel is Town Square', async () => {
        const props = {
            ...baseProps,
            channel: {
                ...baseProps.channel,
                name: Constants.DEFAULT_CHANNEL,
            },
        };

        renderWithContext(
            <SidebarChannelMenu {...props}/>,
        );

        await openMenu();
        expect(screen.queryByRole('menuitem', {name: 'Leave Channel'})).not.toBeInTheDocument();
    });

    test('should disable favorite menu item when channel is in a managed category', async () => {
        const spy = jest.spyOn(require('mattermost-redux/selectors/entities/channel_categories'), 'isChannelInManagedCategory').mockReturnValue(true);

        renderWithContext(
            <SidebarChannelMenu {...baseProps}/>,
        );

        await openMenu();

        const favoriteItem = screen.getByRole('menuitem', {name: 'Favorite'});
        expect(favoriteItem).toHaveAttribute('aria-disabled', 'true');

        spy.mockRestore();
    });

    test('should not show Open in new window when popout is not available', async () => {
        jest.mocked(canPopout).mockReturnValue(false);
        jest.mocked(isChannelPopoutWindow).mockReturnValue(false);

        renderWithContext(
            <SidebarChannelMenu {...baseProps}/>,
        );

        await openMenu();
        expect(screen.queryByRole('menuitem', {name: 'Open in new window'})).not.toBeInTheDocument();
    });

    test('says board for a board', async () => {
        renderWithContext(
            <SidebarChannelMenu {...baseProps}/>,
            boardChannelsState(testChannel.id),
        );

        await userEvent.click(screen.getByRole('button', {name: /board options/i}));
        await screen.findByRole('menu', {name: 'Edit board menu'});

        expect(screen.getByRole('menuitem', {name: 'Mute Board'})).toBeInTheDocument();
        expect(screen.getByRole('menuitem', {name: 'Leave Board'})).toBeInTheDocument();
        expect(screen.queryByRole('menuitem', {name: 'Mute Channel'})).not.toBeInTheDocument();
        expect(screen.queryByRole('menuitem', {name: 'Leave Channel'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: /channel options/i})).not.toBeInTheDocument();
    });

    test('says Unmute Board for a muted board', async () => {
        renderWithContext(
            <SidebarChannelMenu
                {...baseProps}
                isMuted={true}
            />,
            boardChannelsState(testChannel.id),
        );

        await userEvent.click(screen.getByRole('button', {name: /board options/i}));
        await screen.findByRole('menu', {name: 'Edit board menu'});

        expect(screen.getByRole('menuitem', {name: 'Unmute Board'})).toBeInTheDocument();
        expect(screen.queryByRole('menuitem', {name: 'Unmute Channel'})).not.toBeInTheDocument();
    });
});
