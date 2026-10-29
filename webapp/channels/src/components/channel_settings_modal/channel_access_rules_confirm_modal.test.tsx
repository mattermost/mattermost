// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import ChannelAccessRulesConfirmModal from './channel_access_rules_confirm_modal';

describe('ChannelAccessRulesConfirmModal', () => {
    const baseProps = {
        show: true,
        onHide: jest.fn(),
        onConfirm: jest.fn(),
        channelName: 'Test Channel',
        usersToAdd: ['user1', 'user2'],
        usersToRemove: ['user3'],
    };

    test('says channel for a channel', () => {
        renderWithContext(<ChannelAccessRulesConfirmModal {...baseProps}/>);

        expect(screen.getByText(/to the channel and remove/)).toBeInTheDocument();
    });

    test('says board rather than channel for a board', () => {
        renderWithContext(
            <ChannelAccessRulesConfirmModal
                {...baseProps}
                channelKind='board'
            />,
        );

        expect(screen.getByText(/to the board and remove/)).toHaveTextContent('Applying these access rules will add 2 users to the board and remove 1 current board member.');
        expect(screen.queryByText(/to the channel and remove/)).not.toBeInTheDocument();
    });
});
