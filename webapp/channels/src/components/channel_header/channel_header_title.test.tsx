// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

jest.mock('components/channel_type_icon/compass_icon_resolver', () => ({
    compassIconForName: jest.fn(),
}));

jest.mock('utils/channel_utils', () => ({
    ...jest.requireActual('utils/channel_utils'),
    getArchiveIconComponent: jest.fn(() => (props: Record<string, unknown>) => (
        <span
            data-is-default-archive='true'
            {...props}
        />
    )),
}));

import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';

import {compassIconForName} from 'components/channel_type_icon';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ChannelHeaderTitle from './channel_header_title';

// Mock the child components to avoid Redux hook issues
jest.mock('./channel_header_title_favorite', () => {
    return () => <div id='mock-favorite'/>;
});

jest.mock('./channel_header_title_direct', () => {
    return ({dmUser}: {dmUser?: {username?: string}}) => (
        <div id='mock-direct'>{dmUser?.username}</div>
    );
});

jest.mock('./channel_header_title_group', () => {
    return () => <div id='mock-group'/>;
});

jest.mock('../channel_header_menu/channel_header_menu', () => {
    return () => <div id='mock-header-menu'/>;
});

jest.mock('components/profile_picture', () => {
    return () => <div id='mock-profile-picture'/>;
});

// Mock the modules causing issues
jest.mock('selectors/rhs', () => ({
    getRhsState: jest.fn(),
    getSelectedPost: jest.fn(),
    getSelectedChannel: jest.fn(),
}));

// Mock channel sidebar selector
jest.mock('selectors/views/channel_sidebar', () => ({
    isChannelSelected: jest.fn(),
    getAutoSortedCategoryIds: jest.fn(),
    getDraggingState: jest.fn(),
}));

jest.mock('mattermost-redux/selectors/entities/channels', () => ({
    getCurrentChannel: jest.fn(),
    isCurrentChannelFavorite: jest.fn(),
    makeGetChannel: jest.fn(() => jest.fn()),
}));

describe('components/channel_header/ChannelHeaderTitle', () => {
    test('should return null when no channel', () => {
        (getCurrentChannel as jest.Mock).mockReturnValue(null);

        const {container} = renderWithContext(<ChannelHeaderTitle/>);

        expect(container.firstChild).toBeNull();
    });

    test('should render bot layout for DM with bot user', () => {
        const channel = TestHelper.getChannelMock({
            id: 'channel_id',
            type: 'D',
            display_name: 'Bot User',
        });
        const botUser = TestHelper.getUserMock({
            id: 'bot_id',
            username: 'bot',
            is_bot: true,
        });

        (getCurrentChannel as jest.Mock).mockReturnValue(channel);

        renderWithContext(<ChannelHeaderTitle dmUser={botUser}/>);

        // Bot layout has distinct structure - no header menu, has BOT tag
        expect(document.querySelector('.channel-header__bot')).toBeInTheDocument();
        expect(screen.getByText('BOT')).toBeInTheDocument();
        expect(document.querySelector('#mock-header-menu')).not.toBeInTheDocument();
    });

    test('should render profile picture for DM channel', () => {
        const channel = TestHelper.getChannelMock({
            id: 'channel_id',
            type: 'D',
            display_name: 'User Name',
        });
        const dmUser = TestHelper.getUserMock({
            id: 'user_id',
            username: 'testuser',
        });

        (getCurrentChannel as jest.Mock).mockReturnValue(channel);

        renderWithContext(<ChannelHeaderTitle dmUser={dmUser}/>);

        // DM shows profile picture, public/GM channels don't
        expect(document.querySelector('#mock-profile-picture')).toBeInTheDocument();
    });

    test('should not render profile picture for public channel', () => {
        const channel = TestHelper.getChannelMock({
            id: 'channel_id',
            type: 'O',
            display_name: 'Public Channel',
        });

        (getCurrentChannel as jest.Mock).mockReturnValue(channel);

        renderWithContext(<ChannelHeaderTitle/>);

        // Public channel renders header menu and favorite, but no profile picture
        expect(document.querySelector('.channel-header__top')).toBeInTheDocument();
        expect(document.querySelector('#mock-header-menu')).toBeInTheDocument();
        expect(document.querySelector('#mock-profile-picture')).not.toBeInTheDocument();
    });

    test('should render header menu for GM channel without profile picture', () => {
        const channel = TestHelper.getChannelMock({
            id: 'channel_id',
            type: 'G',
            display_name: 'Group Channel',
        });
        const gmMembers = [
            TestHelper.getUserMock({id: 'user1', username: 'user1'}),
            TestHelper.getUserMock({id: 'user2', username: 'user2'}),
        ];

        (getCurrentChannel as jest.Mock).mockReturnValue(channel);

        renderWithContext(<ChannelHeaderTitle gmMembers={gmMembers}/>);

        // GM channel renders header menu but no profile picture (unlike DM)
        expect(document.querySelector('#mock-header-menu')).toBeInTheDocument();
        expect(document.querySelector('#mock-profile-picture')).not.toBeInTheDocument();
    });

    describe('plugin channel icon override', () => {
        const mockedCompassIconForName = jest.mocked(compassIconForName);

        afterEach(() => {
            mockedCompassIconForName.mockReset();
        });

        // The archive icon is rendered directly (not inside ChannelHeaderMenu) for bot DM channels.
        // Use a bot DM + archived channel to test the override path without fighting the mock.
        test('renders override SVG icon in archive slot when plugin matcher matches', () => {
            const StubIcon = (props: {'data-testid'?: string; size?: number; className?: string}) => (
                <span
                    data-testid={props['data-testid'] ?? 'stub-override-icon'}
                    data-size={props.size}
                    className={props.className}
                />
            );
            mockedCompassIconForName.mockReturnValue(StubIcon as any);

            const channel = TestHelper.getChannelMock({
                id: 'channel_id',
                type: 'D',
                delete_at: 1000,
            });
            const botUser = TestHelper.getUserMock({
                id: 'bot_id',
                username: 'bot',
                is_bot: true,
            });
            (getCurrentChannel as jest.Mock).mockReturnValue(channel);

            const stateWithOverride = {
                plugins: {
                    components: {
                        ChannelIconOverride: [{
                            id: '1',
                            pluginId: 'test-plugin',
                            matcher: () => true,
                            iconName: 'shield-outline',
                        }],
                    },
                },
            } as any;

            renderWithContext(<ChannelHeaderTitle dmUser={botUser}/>, stateWithOverride);

            // Override branch passes data-testid='channel-header-archive-icon' to the stub
            const overrideIcon = screen.getByTestId('channel-header-archive-icon');
            expect(overrideIcon).toBeInTheDocument();

            // Override icon gets svg-text-color (greyed to signal archived) but not the built-in archive icon classes
            expect(overrideIcon).toHaveClass('svg-text-color');
            expect(overrideIcon).not.toHaveClass('channel-header-archived-icon');

            // Default archive icon is absent when override wins
            expect(document.querySelector('[data-is-default-archive]')).not.toBeInTheDocument();
        });

        test('renders default archive SVG icon when no plugin matcher matches', () => {
            mockedCompassIconForName.mockReturnValue(null);

            const channel = TestHelper.getChannelMock({
                id: 'channel_id',
                type: 'D',
                delete_at: 1000,
            });
            const botUser = TestHelper.getUserMock({
                id: 'bot_id',
                username: 'bot',
                is_bot: true,
            });
            (getCurrentChannel as jest.Mock).mockReturnValue(channel);

            const stateWithNoMatch = {
                plugins: {
                    components: {
                        ChannelIconOverride: [{
                            id: '1',
                            pluginId: 'test-plugin',
                            matcher: () => false,
                            iconName: 'shield-outline',
                        }],
                    },
                },
            } as any;

            renderWithContext(<ChannelHeaderTitle dmUser={botUser}/>, stateWithNoMatch);

            // Default archive icon rendered with full archive chrome (spread props include className + data-testid)
            const archiveIcon = screen.getByTestId('channel-header-archive-icon');
            expect(archiveIcon).toBeInTheDocument();
            expect(archiveIcon).toHaveAttribute('data-is-default-archive', 'true');
            expect(archiveIcon).toHaveClass('channel-header-archived-icon', 'svg-text-color');
            expect(screen.queryByTestId('stub-override-icon')).not.toBeInTheDocument();
        });
    });
});
