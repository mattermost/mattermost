// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {WithTestMenuContext} from 'components/menu/menu_context_test';

import {renderWithContext, screen, fireEvent} from 'tests/react_testing_utils';
import {RHSStates} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import ViewPinnedPosts from './view_pinned_posts';

jest.mock('actions/views/rhs', () => ({
    closeRightHandSide: jest.fn(() => ({type: 'MOCK_CLOSE_RIGHT_HAND_SIDE'})),
    showPinnedPosts: jest.fn(() => ({type: 'MOCK_SHOW_PINNED_POSTS'})),
}));

describe('components/ChannelHeaderMenu/MenuItems/ViewPinnedPosts', () => {
    const {closeRightHandSide, showPinnedPosts} = require('actions/views/rhs');

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('renders the component correctly, handles correct click event', () => {
        const state = {
            views: {
                rhs: {
                    rhsState: '',
                },
            },
        };
        const channel = TestHelper.getChannelMock();

        renderWithContext(
            <WithTestMenuContext>
                <ViewPinnedPosts channelID={channel.id}/>
            </WithTestMenuContext>, state,
        );

        const menuItem = screen.getByText('View Pinned Posts');
        expect(menuItem).toBeInTheDocument();

        fireEvent.click(menuItem); // Simulate click on the menu item
        expect(showPinnedPosts).toHaveBeenCalledTimes(1);
        expect(showPinnedPosts).toHaveBeenCalledWith(channel.id);
    });

    test('renders the component correctly, handles correct click event', () => {
        const state = {
            views: {
                rhs: {
                    rhsState: RHSStates.PIN,
                },
            },
        };
        const channel = TestHelper.getChannelMock();

        renderWithContext(
            <WithTestMenuContext>
                <ViewPinnedPosts channelID={channel.id}/>
            </WithTestMenuContext>, state,
        );

        const menuItem = screen.getByText('View Pinned Posts');
        expect(menuItem).toBeInTheDocument();

        fireEvent.click(menuItem); // Simulate click on the menu item
        expect(closeRightHandSide).toHaveBeenCalledTimes(1);
    });
});
