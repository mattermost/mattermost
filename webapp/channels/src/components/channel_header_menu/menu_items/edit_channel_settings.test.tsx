// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch} from 'react-redux';

import * as modalActions from 'actions/views/modals';

import {WithTestMenuContext} from 'components/menu/menu_context_test';
import RenameChannelModal from 'components/rename_channel_modal';

import {renderWithContext, screen, fireEvent} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import EditChannelSettings from './edit_channel_settings';

describe('components/ChannelHeaderMenu/MenuItems/EditChannelSettings', () => {
    const channel = TestHelper.getChannelMock();
    beforeEach(() => {
        jest.spyOn(modalActions, 'openModal');
        jest.spyOn(require('react-redux'), 'useDispatch');
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('renders the component correctly, handle click event', () => {
        renderWithContext(
            <WithTestMenuContext>
                <EditChannelSettings
                    channel={channel}
                    isReadonly={false}
                    isDefault={false}
                />
            </WithTestMenuContext>, {},
        );

        const menuItem = screen.getByText('Rename Channel');
        expect(menuItem).toBeInTheDocument();

        fireEvent.click(menuItem); // Simulate click on the menu item
        expect(useDispatch).toHaveBeenCalledTimes(1); // Ensure dispatch was called
        expect(modalActions.openModal).toHaveBeenCalledTimes(1);
        expect(modalActions.openModal).toHaveBeenCalledWith({
            modalId: ModalIdentifiers.RENAME_CHANNEL,
            dialogType: RenameChannelModal,
            dialogProps: {channel},
        });
    });
});
