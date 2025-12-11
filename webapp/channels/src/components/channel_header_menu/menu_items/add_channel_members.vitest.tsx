// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import * as reactRedux from 'react-redux';

import * as modalActions from 'actions/views/modals';

import ChannelInviteModal from 'components/channel_invite_modal';
import {WithTestMenuContext} from 'components/menu/menu_context_test';

import {renderWithContext, screen, fireEvent} from 'tests/vitest_react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import AddChannelMembers from './add_channel_members';

describe('components/ChannelHeaderMenu/MenuItems/AddChannelMembers', () => {
    const channel = TestHelper.getChannelMock({header: 'Test Header'});
    const useDispatchMock = vi.spyOn(reactRedux, 'useDispatch');

    beforeEach(() => {
        vi.spyOn(modalActions, 'openModal');
        useDispatchMock.mockClear();
    });

    afterEach(() => {
        vi.clearAllMocks();
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

        expect(useDispatchMock).toHaveBeenCalledTimes(1); // Ensure dispatch was called
        expect(modalActions.openModal).toHaveBeenCalledTimes(1);
        expect(modalActions.openModal).toHaveBeenCalledWith({
            modalId: ModalIdentifiers.CHANNEL_INVITE,
            dialogType: ChannelInviteModal,
            dialogProps: {channel},
        });
    });
});
