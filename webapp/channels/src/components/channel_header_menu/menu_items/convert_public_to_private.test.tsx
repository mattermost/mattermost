// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch} from 'react-redux';

import * as modalActions from 'actions/views/modals';

import ConvertChannelModal from 'components/convert_channel_modal';
import {WithTestMenuContext} from 'components/menu/menu_context_test';

import {renderWithContext, screen, fireEvent} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import ConvertPublictoPrivate from './convert_public_to_private';

describe('components/ChannelHeaderMenu/MenuItems/ConvertPublicToPrivate', () => {
    beforeEach(() => {
        jest.spyOn(modalActions, 'openModal');

        // Mock useDispatch to return our custom dispatch function
        jest.spyOn(require('react-redux'), 'useDispatch');
    });

    afterEach(() => {
        jest.clearAllMocks();
    });
    const channel = TestHelper.getChannelMock();

    test('renders the component correctly, handle click event', () => {
        renderWithContext(
            <WithTestMenuContext>
                <ConvertPublictoPrivate channel={channel}/>
            </WithTestMenuContext>, {},
        );

        const menuItem = screen.getByText('Convert to Private Channel');
        expect(menuItem).toBeInTheDocument();

        fireEvent.click(menuItem); // Simulate click on the menu item
        expect(useDispatch).toHaveBeenCalledTimes(1); // Ensure dispatch was called
        expect(modalActions.openModal).toHaveBeenCalledTimes(1);
        expect(modalActions.openModal).toHaveBeenCalledWith({
            modalId: ModalIdentifiers.CONVERT_CHANNEL,
            dialogType: ConvertChannelModal,
            dialogProps: {
                channelId: channel.id,
                channelDisplayName: channel.display_name,
            },
        });
    });
});
