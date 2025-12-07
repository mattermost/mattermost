// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import LeaveChannelModal from 'components/leave_channel_modal';
import {WithTestMenuContext} from 'components/menu/menu_context_test';

import {renderWithContext, screen, fireEvent} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import LeaveChannel from './leave_channel';

const mockOpenModal = jest.fn();
jest.mock('actions/views/modals', () => ({
    openModal: (...args: unknown[]) => {
        mockOpenModal(...args);
        return {type: 'MOCK_OPEN_MODAL'};
    },
}));

const mockLeaveChannel = jest.fn();
jest.mock('actions/views/channel', () => ({
    leaveChannel: (...args: unknown[]) => {
        mockLeaveChannel(...args);
        return {type: 'MOCK_LEAVE_CHANNEL'};
    },
}));

const mockDispatch = jest.fn();
jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux'),
    useDispatch: () => mockDispatch,
}));

describe('components/ChannelHeaderMenu/MenuItems/LeaveChannelTest', () => {
    beforeEach(() => {
        mockOpenModal.mockClear();
        mockLeaveChannel.mockClear();
        mockDispatch.mockClear();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('renders the component correctly, handle click event correctly for Public Channel', () => {
        const channel = TestHelper.getChannelMock();

        renderWithContext(
            <WithTestMenuContext>
                <LeaveChannel channel={channel}/>
            </WithTestMenuContext>, {},
        );

        const menuItem = screen.getByText('Leave Channel');
        expect(menuItem).toBeInTheDocument();

        fireEvent.click(menuItem); // Simulate click on the menu item
        expect(mockDispatch).toHaveBeenCalledTimes(1); // Ensure dispatch was called
        expect(mockLeaveChannel).toHaveBeenCalledTimes(1); // Ensure dispatch was called
        expect(mockLeaveChannel).toHaveBeenCalledWith(channel.id);
    });

    test('renders the component correctly, handle click event for manage groups', () => {
        const channel = TestHelper.getChannelMock({type: 'P'});

        renderWithContext(
            <WithTestMenuContext>
                <LeaveChannel channel={channel}/>
            </WithTestMenuContext>, {},
        );

        const menuItemMG = screen.getByText('Leave Channel');
        expect(menuItemMG).toBeInTheDocument();

        fireEvent.click(menuItemMG); // Simulate click on the menu item
        expect(mockDispatch).toHaveBeenCalledTimes(1); // Ensure dispatch was called
        expect(mockOpenModal).toHaveBeenCalledTimes(1);
        expect(mockOpenModal).toHaveBeenCalledWith({
            modalId: ModalIdentifiers.LEAVE_PRIVATE_CHANNEL_MODAL,
            dialogType: LeaveChannelModal,
            dialogProps: {
                channel,
            },
        });
    });
});
