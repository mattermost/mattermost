// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch} from 'react-redux';

import * as channelActions from 'actions/views/channel';
import * as modalActions from 'actions/views/modals';

import LeaveChannelModal from 'components/leave_channel_modal';
import {WithTestMenuContext} from 'components/menu/menu_context_test';

import {renderWithContext, screen, fireEvent} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import LeaveChannel from './leave_channel';

describe('components/ChannelHeaderMenu/MenuItems/LeaveChannelTest', () => {
    beforeEach(() => {
        jest.spyOn(modalActions, 'openModal');
        jest.spyOn(channelActions, 'leaveChannel');

        // Mock useDispatch to return our custom dispatch function
        jest.spyOn(require('react-redux'), 'useDispatch');
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
        expect(useDispatch).toHaveBeenCalledTimes(1); // Ensure dispatch was called
        expect(channelActions.leaveChannel).toHaveBeenCalledTimes(1); // Ensure dispatch was called
        expect(channelActions.leaveChannel).toHaveBeenCalledWith(channel.id);
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
        expect(useDispatch).toHaveBeenCalledTimes(1); // Ensure dispatch was called
        expect(modalActions.openModal).toHaveBeenCalledTimes(1);
        expect(modalActions.openModal).toHaveBeenCalledWith({
            modalId: ModalIdentifiers.LEAVE_PRIVATE_CHANNEL_MODAL,
            dialogType: LeaveChannelModal,
            dialogProps: {
                channel,
            },
        });
    });
});
