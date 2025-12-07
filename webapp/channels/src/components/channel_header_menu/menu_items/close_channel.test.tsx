// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {WithTestMenuContext} from 'components/menu/menu_context_test';

import {renderWithContext, screen, fireEvent} from 'tests/react_testing_utils';

import CloseChannel from './close_channel';

jest.mock('actions/views/channel', () => ({
    goToLastViewedChannel: jest.fn(),
}));

const channelActions = require('actions/views/channel');

describe('components/ChannelHeaderMenu/MenuItems/CloseChannel', () => {
    beforeEach(() => {
        channelActions.goToLastViewedChannel.mockClear();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('renders the component correctly, handle click event', () => {
        renderWithContext(
            <WithTestMenuContext>
                <CloseChannel/>
            </WithTestMenuContext>, {},
        );

        const menuItem = screen.getByText('Close Channel');
        expect(menuItem).toBeInTheDocument();

        fireEvent.click(menuItem); // Simulate click on the menu item
        expect(channelActions.goToLastViewedChannel).toHaveBeenCalledTimes(1); // Ensure dispatch was called
    });
});
