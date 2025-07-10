// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch} from 'react-redux';

import * as modalActions from 'actions/views/modals';

import {WithTestMenuContext} from 'components/menu/menu_context_test';
import UnarchiveChannelModal from 'components/unarchive_channel_modal';

import {renderWithContext, screen, fireEvent} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import UnarchiveChannel from './unarchive_channel';

describe('components/ChannelHeaderMenu/MenuItems/UnarchiveChannel', () => {
    beforeEach(() => {
        jest.spyOn(modalActions, 'openModal');
        jest.spyOn(require('react-redux'), 'useDispatch');
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('renders the component correctly, handle click event', () => {
        const channel = TestHelper.getChannelMock();

        renderWithContext(
            <WithTestMenuContext>
                <UnarchiveChannel channel={channel}/>
            </WithTestMenuContext>, {},
        );

        const menuItem = screen.getByText('Unarchive Channel');
        expect(menuItem).toBeInTheDocument();

        fireEvent.click(menuItem); // Simulate click on the menu item
        expect(useDispatch).toHaveBeenCalledTimes(1); // Ensure dispatch was called
        expect(modalActions.openModal).toHaveBeenCalledTimes(1);
        expect(modalActions.openModal).toHaveBeenCalledWith({
            modalId: ModalIdentifiers.UNARCHIVE_CHANNEL,
            dialogType: UnarchiveChannelModal,
            dialogProps: {channel},
        });
    });
});
