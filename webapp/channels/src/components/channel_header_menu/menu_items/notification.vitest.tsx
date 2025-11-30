// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import * as modalActions from 'actions/views/modals';

import ChannelNotificationsModal from 'components/channel_notifications_modal';
import {WithTestMenuContext} from 'components/menu/menu_context_test';

import {renderWithContext, screen, fireEvent} from 'tests/vitest_react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import Notification from './notification';

describe('components/ChannelHeaderMenu/MenuItems/Notification', () => {
    beforeEach(() => {
        vi.spyOn(modalActions, 'openModal');
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    test('renders the component correctly, handle click event', () => {
        const channel = TestHelper.getChannelMock();
        const user = TestHelper.getUserMock();

        renderWithContext(
            <WithTestMenuContext>
                <Notification
                    channel={channel}
                    user={user}
                />
            </WithTestMenuContext>, {},
        );

        const menuItemMG = screen.getByText('Notification Preferences');
        expect(menuItemMG).toBeInTheDocument();

        fireEvent.click(menuItemMG); // Simulate click on the menu item
        expect(modalActions.openModal).toHaveBeenCalledTimes(1);
        expect(modalActions.openModal).toHaveBeenCalledWith({
            modalId: ModalIdentifiers.CHANNEL_NOTIFICATIONS,
            dialogType: ChannelNotificationsModal,
            dialogProps: {
                channel,
                currentUser: user,
            },
        });
    });
});
