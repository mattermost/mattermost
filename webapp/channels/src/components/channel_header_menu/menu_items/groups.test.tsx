// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch} from 'react-redux';

import * as modalActions from 'actions/views/modals';

import AddGroupsToChannelModal from 'components/add_groups_to_channel_modal';
import ChannelGroupsManageModal from 'components/channel_groups_manage_modal';
import {WithTestMenuContext} from 'components/menu/menu_context_test';

import {renderWithContext, screen, fireEvent} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import Groups from './groups';

describe('components/ChannelHeaderMenu/MenuItems/Groups', () => {
    beforeEach(() => {
        jest.spyOn(modalActions, 'openModal');

        // Mock useDispatch to return our custom dispatch function
        jest.spyOn(require('react-redux'), 'useDispatch');
    });

    afterEach(() => {
        jest.clearAllMocks();
    });
    const channel = TestHelper.getChannelMock();

    test('renders the component correctly, handle click event for add groups', () => {
        renderWithContext(
            <WithTestMenuContext>
                <Groups channel={channel}/>
            </WithTestMenuContext>, {},
        );

        const menuItem = screen.getByText('Add Groups');
        expect(menuItem).toBeInTheDocument();

        fireEvent.click(menuItem); // Simulate click on the menu item
        expect(useDispatch).toHaveBeenCalledTimes(1); // Ensure dispatch was called
        expect(modalActions.openModal).toHaveBeenCalledTimes(1);
        expect(modalActions.openModal).toHaveBeenCalledWith({
            modalId: ModalIdentifiers.ADD_GROUPS_TO_CHANNEL,
            dialogType: AddGroupsToChannelModal,
        });
    });

    test('renders the component correctly, handle click event for manage groups', () => {
        renderWithContext(
            <WithTestMenuContext>
                <Groups channel={channel}/>
            </WithTestMenuContext>, {},
        );

        const menuItemMG = screen.getByText('Manage Groups');
        expect(menuItemMG).toBeInTheDocument();

        fireEvent.click(menuItemMG); // Simulate click on the menu item
        expect(useDispatch).toHaveBeenCalledTimes(1); // Ensure dispatch was called
        expect(modalActions.openModal).toHaveBeenCalledTimes(1);
        expect(modalActions.openModal).toHaveBeenCalledWith({
            modalId: ModalIdentifiers.MANAGE_CHANNEL_GROUPS,
            dialogType: ChannelGroupsManageModal,
            dialogProps: {channelID: channel.id},
        });
    });
});
