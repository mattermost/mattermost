// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {waitForElementToBeRemoved} from '@testing-library/react';
import React from 'react';

import {General} from 'mattermost-redux/constants';

import ConnectedConvertChannelModal from 'components/convert_channel_modal';
import ConvertChannelModal from 'components/convert_channel_modal/convert_channel_modal';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {boardChannelsState} from 'utils/channel_kind_test_utils';

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

    test('should match call updateChannelPrivacy when convert is clicked', async () => {
        renderWithContext(<ConvertChannelModal {...baseProps}/>);
        await userEvent.click(screen.getByRole('button', {name: 'Yes, convert to private channel'}));

        expect(updateChannelPrivacy).toHaveBeenCalledTimes(1);
        expect(updateChannelPrivacy).toHaveBeenCalledWith(baseProps.channelId, General.PRIVATE_CHANNEL);
    });

    test('should not call updateChannelPrivacy when Close button is clicked', async () => {
        renderWithContext(<ConvertChannelModal {...baseProps}/>);
        await userEvent.click(screen.getByRole('button', {name: 'Close'}));

        await waitForElementToBeRemoved(() => screen.getByText('Convert Channel Display Name to a Private Channel?'));
        expect(updateChannelPrivacy).not.toHaveBeenCalled();
    });

    test('should not call updateChannelPrivacy when other Cancel is clicked', async () => {
        renderWithContext(<ConvertChannelModal {...baseProps}/>);
        await userEvent.click(screen.getByRole('button', {name: 'No, cancel'}));

        await waitForElementToBeRemoved(() => screen.getByText('Convert Channel Display Name to a Private Channel?'));
        expect(updateChannelPrivacy).not.toHaveBeenCalled();
    });

    test('says board for a board', () => {
        renderWithContext(
            <ConnectedConvertChannelModal
                channelId={baseProps.channelId}
                channelDisplayName='Roadmap'
                onExited={jest.fn()}
            />,
            boardChannelsState(baseProps.channelId),
        );

        expect(screen.getByText('Convert Roadmap to a Private Board?')).toBeInTheDocument();
        expect(screen.getByText(/When you convert/)).toHaveTextContent('When you convert Roadmap to a private board, history and membership are preserved. Publicly shared files remain accessible to anyone with the link. Membership in a private board is by invitation only.');
        expect(screen.getByText(/Are you sure you want to convert/)).toHaveTextContent('Are you sure you want to convert Roadmap to a private board?');
        expect(screen.getByRole('button', {name: 'Yes, convert to private board'})).toBeInTheDocument();
        expect(screen.queryByText(/channel/i)).not.toBeInTheDocument();
    });
});
