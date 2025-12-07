// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch} from 'react-redux';

import ChannelInviteModal from 'components/channel_invite_modal';
import {WithTestMenuContext} from 'components/menu/menu_context_test';

import {renderWithContext, screen, fireEvent} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import AddChannelMembers from './add_channel_members';

const mockOpenModal = jest.fn();
jest.mock('actions/views/modals', () => ({
    openModal: (...args: unknown[]) => {
        mockOpenModal(...args);
        return {type: 'MOCK_OPEN_MODAL'};
    },
}));

describe('components/ChannelHeaderMenu/MenuItems/AddChannelMembers', () => {
    const channel = TestHelper.getChannelMock({header: 'Test Header'});

    beforeEach(() => {
        mockOpenModal.mockClear();

        // Mock useDispatch to return our custom dispatch function
        jest.spyOn(require('react-redux'), 'useDispatch');
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('renders the component correctly', () => {
        renderWithContext(
            <AddChannelMembers
                channel={channel}
            />, {},
        );

        const menuItem = screen.getByText('Add Members');
        expect(menuItem).toBeInTheDocument(); // Check if text "Add Members" renders
    });

    test('dispatches openModal action on click', () => {
        renderWithContext(
            <WithTestMenuContext>
                <AddChannelMembers
                    channel={channel}
                />
            </WithTestMenuContext>, {},
        );

        const menuItem = screen.getByText('Add Members');
        expect(menuItem).toBeInTheDocument(); // Check if text "Add Members" renders
        fireEvent.click(menuItem); // Simulate click on the menu item

        expect(useDispatch).toHaveBeenCalledTimes(1); // Ensure dispatch was called
        expect(mockOpenModal).toHaveBeenCalledTimes(1);
        expect(mockOpenModal).toHaveBeenCalledWith({
            modalId: ModalIdentifiers.CHANNEL_INVITE,
            dialogType: ChannelInviteModal,
            dialogProps: {channel},
        });
    });
});
