// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch} from 'react-redux';

import * as modalActions from 'actions/views/modals';

import {WithTestMenuContext} from 'components/menu/menu_context_test';
import MoreDirectChannels from 'components/more_direct_channels';

import {renderWithContext, screen, fireEvent} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';

import AddGroupMembers from './add_group_members';

describe('components/ChannelHeaderMenu/MenuItems/AddGroupMembers', () => {
    beforeEach(() => {
        jest.spyOn(modalActions, 'openModal');

        // Mock useDispatch to return our custom dispatch function
        jest.spyOn(require('react-redux'), 'useDispatch');
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('renders the component correctly', () => {
        renderWithContext(
            <AddGroupMembers/>, {},
        );

        const menuItem = screen.getByText('Add Members');
        expect(menuItem).toBeInTheDocument(); // Check if text "Add Members" renders
    });

    test('dispatches openModal action on click', () => {
        renderWithContext(
            <WithTestMenuContext>
                <AddGroupMembers/>
            </WithTestMenuContext>, {},
        );

        const menuItem = screen.getByText('Add Members');
        expect(menuItem).toBeInTheDocument(); // Check if text "Add Members" renders
        fireEvent.click(menuItem); // Simulate click on the menu item

        expect(useDispatch).toHaveBeenCalledTimes(1); // Ensure dispatch was called
        expect(modalActions.openModal).toHaveBeenCalledTimes(1);
        expect(modalActions.openModal).toHaveBeenCalledWith({
            modalId: ModalIdentifiers.CREATE_DM_CHANNEL,
            dialogType: MoreDirectChannels,
            dialogProps: {
                focusOriginElement: 'channelHeaderDropdownButton',
                isExistingChannel: true,
            },
        });
    });
});
