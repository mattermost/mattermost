// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent, waitForElementToBeRemoved} from '@testing-library/react';
import React from 'react';

import {General} from 'mattermost-redux/constants';

import ConvertChannelModal from 'components/convert_channel_modal/convert_channel_modal';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

describe('component/ConvertChannelModal', () => {
    const updateChannelPrivacy = jest.fn().mockImplementation(() => Promise.resolve({}));
    const baseProps = {
        onExited: jest.fn(),
        channelId: 'owsyt8n43jfxjpzh9np93mx1wa',
        channelDisplayName: 'Channel Display Name',
        actions: {
            updateChannelPrivacy,
        },
    };

    test('should render the title and buttons correctly', () => {
        renderWithContext(<ConvertChannelModal {...baseProps}/>);

        expect(screen.getByText('Convert Channel Display Name to a Private Channel?')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'No, cancel'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Yes, convert to private channel'})).toBeInTheDocument();
    });

    test('should match call updateChannelPrivacy when convert is clicked', () => {
        renderWithContext(<ConvertChannelModal {...baseProps}/>);
        userEvent.click(screen.getByRole('button', {name: 'Yes, convert to private channel'}));

        expect(updateChannelPrivacy).toHaveBeenCalledTimes(1);
        expect(updateChannelPrivacy).toHaveBeenCalledWith(baseProps.channelId, General.PRIVATE_CHANNEL);
    });

    test('should not call updateChannelPrivacy when Close button is clicked', async () => {
        renderWithContext(<ConvertChannelModal {...baseProps}/>);
        fireEvent.click(screen.getByRole('button', {name: 'Close'}));

        await waitForElementToBeRemoved(() => screen.getByText('Convert Channel Display Name to a Private Channel?'));
        expect(updateChannelPrivacy).not.toHaveBeenCalled();
    });

    test('should not call updateChannelPrivacy when other Cancel is clicked', async () => {
        renderWithContext(<ConvertChannelModal {...baseProps}/>);
        fireEvent.click(screen.getByRole('button', {name: 'No, cancel'}));

        await waitForElementToBeRemoved(() => screen.getByText('Convert Channel Display Name to a Private Channel?'));
        expect(updateChannelPrivacy).not.toHaveBeenCalled();
    });
});
