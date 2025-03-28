// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import * as channelActions from 'actions/views/channel';

import {WithTestMenuContext} from 'components/menu/menu_context_test';

import {renderWithContext, screen, fireEvent} from 'tests/react_testing_utils';

import CloseChannel from './close_channel';

describe('components/ChannelHeaderMenu/MenuItems/CloseChannel', () => {
    beforeEach(() => {
        jest.spyOn(channelActions, 'goToLastViewedChannel');
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
