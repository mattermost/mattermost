// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import * as channelActions from 'mattermost-redux/actions/channels';

import {WithTestMenuContext} from 'components/menu/menu_context_test';

import {renderWithContext, screen, fireEvent} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ToggleFavoriteChannel from './toggle_favorite_channel';

vi.mock('mattermost-redux/actions/channels', () => ({
    favoriteChannel: vi.fn(() => () => Promise.resolve({data: true})),
    unfavoriteChannel: vi.fn(() => () => Promise.resolve({data: true})),
}));

describe('components/ChannelHeaderMenu/MenuItems/ToggleFavoriteChannel', () => {
    const channel = TestHelper.getChannelMock();

    beforeEach(() => {
        vi.clearAllMocks();
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

        fireEvent.click(menuItem);
        expect(channelActions.favoriteChannel).toHaveBeenCalledTimes(1);
        expect(channelActions.favoriteChannel).toHaveBeenCalledWith(channel.id);
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

        fireEvent.click(menuItem);
        expect(channelActions.unfavoriteChannel).toHaveBeenCalledTimes(1);
    });
});
