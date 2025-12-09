// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch} from 'react-redux';

import * as channelActions from 'mattermost-redux/actions/channels';

import {WithTestMenuContext} from 'components/menu/menu_context_test';

import {renderWithContext, screen, fireEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ToggleFavoriteChannel from './toggle_favorite_channel';

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux'),
    useDispatch: jest.fn(),
}));

jest.mock('mattermost-redux/actions/channels', () => ({
    favoriteChannel: jest.fn(),
    unfavoriteChannel: jest.fn(),
}));

const mockUseDispatch = useDispatch as jest.MockedFunction<typeof useDispatch>;
const mockFavoriteChannel = channelActions.favoriteChannel as jest.MockedFunction<typeof channelActions.favoriteChannel>;
const mockUnfavoriteChannel = channelActions.unfavoriteChannel as jest.MockedFunction<typeof channelActions.unfavoriteChannel>;

describe('components/ChannelHeaderMenu/MenuItems/ToggleFavoriteChannel', () => {
    const channel = TestHelper.getChannelMock();
    const mockDispatch = jest.fn();

    beforeEach(() => {
        mockUseDispatch.mockReturnValue(mockDispatch);
        mockFavoriteChannel.mockReturnValue(() => Promise.resolve({data: true}));
        mockDispatch.mockClear();
        mockUseDispatch.mockClear();
        mockFavoriteChannel.mockClear();
        mockUnfavoriteChannel.mockClear();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('renders the component correctly, handles correct click event, is favorite false', () => {
        renderWithContext(
            <WithTestMenuContext>
                <ToggleFavoriteChannel
                    channelID={channel.id}
                    isFavorite={false}
                />
            </WithTestMenuContext>, {},
        );

        const menuItem = screen.getByText('Add to Favorites');
        expect(menuItem).toBeInTheDocument();

        fireEvent.click(menuItem); // Simulate click on the menu item
        // expect(mockUseDispatch).toHaveBeenCalledTimes(1); // Ensure dispatch was called
        expect(mockFavoriteChannel).toHaveBeenCalledTimes(1);
        expect(mockFavoriteChannel).toHaveBeenCalledWith(channel.id);
    });

    test('renders the component correctly, handles correct click event, is favorite true', () => {
        renderWithContext(
            <WithTestMenuContext>
                <ToggleFavoriteChannel
                    channelID={channel.id}
                    isFavorite={true}
                />
            </WithTestMenuContext>, {},
        );

        const menuItem = screen.getByText('Remove from Favorites');
        expect(menuItem).toBeInTheDocument();

        fireEvent.click(menuItem); // Simulate click on the menu item
        expect(mockUseDispatch).toHaveBeenCalledTimes(1); // Ensure dispatch was called
        expect(mockUnfavoriteChannel).toHaveBeenCalledTimes(1);
    });
});
