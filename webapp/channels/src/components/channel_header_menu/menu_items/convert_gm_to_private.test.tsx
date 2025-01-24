// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import * as channelActions from 'actions/views/channel';

import {WithTestMenuContext} from 'components/menu/menu_context_test';

import {renderWithContext, screen, fireEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ConvertGMtoPrivate from './convert_gm_to_private';

describe('components/ChannelHeaderMenu/MenuItem.ConvertGMtoPrivate', () => {
    beforeEach(() => {
        jest.spyOn(channelActions, 'goToLastViewedChannel');
    });

    afterEach(() => {
        jest.clearAllMocks();
    });
    const channel = TestHelper.getChannelMock();

    test('renders the component correctly, handle click event', () => {
        renderWithContext(
            <WithTestMenuContext>
                <ConvertGMtoPrivate channel={channel}/>
            </WithTestMenuContext>, {},
        );

        const menuItem = screen.getByText('Convert to Private Channel');
        expect(menuItem).toBeInTheDocument();

        fireEvent.click(menuItem); // Simulate click on the menu item
        expect(channelActions.goToLastViewedChannel).toHaveBeenCalledTimes(1); // Ensure dispatch was called
    });
});
