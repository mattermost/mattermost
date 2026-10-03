// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import * as rhsActions from 'actions/views/rhs';

import {WithTestMenuContext} from 'components/menu/menu_context_test';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import ViewChannelMentions from './view_channel_mentions';

describe('components/ChannelHeaderMenu/MenuItems/ViewChannelMentions', () => {
    beforeEach(() => {
        jest.spyOn(rhsActions, 'showChannelMentions').mockReturnValue(() => ({data: true}));
    });

    test('renders the component correctly, handles correct click event', async () => {
        renderWithContext(
            <WithTestMenuContext>
                <ViewChannelMentions/>
            </WithTestMenuContext>,
        );

        const menuItem = screen.getByRole('menuitem', {name: 'Recent Mentions in this Channel'});
        expect(menuItem).toBeVisible();

        await userEvent.click(menuItem);
        expect(rhsActions.showChannelMentions).toHaveBeenCalledTimes(1);
    });
});
