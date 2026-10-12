// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import ChannelReadAccessDeniedModal from './channel_read_access_denied_modal';

describe('components/channel_read_access_denied_modal', () => {
    it('should name the channel that was lost', () => {
        renderWithContext(
            <ChannelReadAccessDeniedModal
                onExited={jest.fn()}
                channelName='Secret'
            />,
        );

        expect(screen.getByRole('heading', {name: 'No longer available'})).toBeVisible();
        expect(screen.getByText('Secret')).toBeVisible();
    });

    it('should explain that direct and group messages were lost', () => {
        renderWithContext(
            <ChannelReadAccessDeniedModal
                onExited={jest.fn()}
                isConversation={true}
            />,
        );

        expect(screen.getByRole('heading', {name: 'No longer available'})).toBeVisible();
        expect(screen.getByText('You no longer have access to direct and group messages. They will reappear if access is restored.')).toBeVisible();
        expect(screen.queryByText(/this channel/)).not.toBeInTheDocument();
    });
});
