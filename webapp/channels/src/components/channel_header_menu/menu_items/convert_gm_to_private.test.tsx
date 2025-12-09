// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch} from 'react-redux';

import ConvertGmToChannelModal from 'components/convert_gm_to_channel_modal';
import {WithTestMenuContext} from 'components/menu/menu_context_test';

import {renderWithContext, screen, fireEvent} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import ConvertGMtoPrivate from './convert_gm_to_private';

const mockOpenModal = jest.fn();
jest.mock('actions/views/modals', () => ({
    openModal: (...args: unknown[]) => {
        mockOpenModal(...args);
        return {type: 'MOCK_OPEN_MODAL'};
    },
}));

describe('components/ChannelHeaderMenu/MenuItems/ConvertGMtoPrivate', () => {
    beforeEach(() => {
        mockOpenModal.mockClear();

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
                <ConvertGMtoPrivate channel={channel}/>
            </WithTestMenuContext>, {},
        );

        const menuItem = screen.getByText('Convert to Private Channel');
        expect(menuItem).toBeInTheDocument();

        fireEvent.click(menuItem); // Simulate click on the menu item
        expect(useDispatch).toHaveBeenCalledTimes(1); // Ensure dispatch was called
        expect(mockOpenModal).toHaveBeenCalledTimes(1);
        expect(mockOpenModal).toHaveBeenCalledWith({
            modalId: ModalIdentifiers.CONVERT_GM_TO_CHANNEL,
            dialogType: ConvertGmToChannelModal,
            dialogProps: {channel},
        });
    });
});
