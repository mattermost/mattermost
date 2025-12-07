// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch} from 'react-redux';

import ChannelNotificationsModal from 'components/channel_notifications_modal';
import {WithTestMenuContext} from 'components/menu/menu_context_test';

import {renderWithContext, screen, fireEvent} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import Notification from './notification';

const mockOpenModal = jest.fn();
jest.mock('actions/views/modals', () => ({
    openModal: (...args: unknown[]) => {
        mockOpenModal(...args);
        return {type: 'MOCK_OPEN_MODAL'};
    },
}));

describe('components/ChannelHeaderMenu/MenuItems/Notification', () => {
    beforeEach(() => {
        mockOpenModal.mockClear();

        // Mock useDispatch to return our custom dispatch function
        jest.spyOn(require('react-redux'), 'useDispatch');
    });

    afterEach(() => {
        jest.clearAllMocks();
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
        expect(useDispatch).toHaveBeenCalledTimes(1); // Ensure dispatch was called
        expect(mockOpenModal).toHaveBeenCalledTimes(1);
        expect(mockOpenModal).toHaveBeenCalledWith({
            modalId: ModalIdentifiers.CHANNEL_NOTIFICATIONS,
            dialogType: ChannelNotificationsModal,
            dialogProps: {
                channel,
                currentUser: user,
            },
        });
    });
});
