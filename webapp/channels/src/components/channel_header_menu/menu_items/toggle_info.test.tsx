// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {WithTestMenuContext} from 'components/menu/menu_context_test';

import {renderWithContext, screen, fireEvent} from 'tests/react_testing_utils';
import {RHSStates} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import ToggleInfo from './toggle_info';

jest.mock('actions/views/rhs', () => ({
    closeRightHandSide: jest.fn(() => ({type: 'MOCK_CLOSE_RIGHT_HAND_SIDE'})),
    showChannelInfo: jest.fn(() => ({type: 'MOCK_SHOW_CHANNEL_INFO'})),
}));

describe('components/ChannelHeaderMenu/MenuItems/ToggleInfo', () => {
    const {closeRightHandSide, showChannelInfo} = require('actions/views/rhs');

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('renders the component correctly, handles click event, rhs closed', () => {
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
                <ToggleInfo channel={channel}/>
            </WithTestMenuContext>, state,
        );

        const menuItem = screen.getByText('View Info');
        expect(menuItem).toBeInTheDocument();

        fireEvent.click(menuItem); // Simulate click on the menu item
        expect(showChannelInfo).toHaveBeenCalledTimes(1);
        expect(showChannelInfo).toHaveBeenCalledWith(channel.id);
    });

    test('renders the component correctly, handles correct click event, rhs open', () => {
        const state = {
            views: {
                rhs: {
                    rhsState: RHSStates.CHANNEL_INFO,
                    isSidebarOpen: true,
                },
            },
        };

        const channel = TestHelper.getChannelMock();

        renderWithContext(
            <WithTestMenuContext>
                <ToggleInfo channel={channel}/>
            </WithTestMenuContext>, state,
        );

        const menuItem = screen.getByText('Close Info');
        expect(menuItem).toBeInTheDocument();

        fireEvent.click(menuItem); // Simulate click on the menu item
        expect(closeRightHandSide).toHaveBeenCalledTimes(1);
    });
});
