// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';

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
});
