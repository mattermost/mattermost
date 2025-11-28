// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import RemovedFromChannelModal from 'components/removed_from_channel_modal/removed_from_channel_modal';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';

describe('components/RemoveFromChannelModal', () => {
    const baseProps = {
        currentUserId: 'current_user_id',
        channelName: 'test-channel',
        remover: 'Administrator',
        onExited: vi.fn(),
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <RemovedFromChannelModal {...baseProps}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should display modal when show is true', () => {
        renderWithContext(
            <RemovedFromChannelModal {...baseProps}/>,
        );

        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    test('should display correct props on Modal.Title and Modal.Body', () => {
        renderWithContext(
            <RemovedFromChannelModal {...baseProps}/>,
        );

        // Check title contains channel name
        expect(screen.getByText('test-channel')).toBeInTheDocument();

        // Check body contains remover and channel
        expect(screen.getByText(/Administrator removed you from/)).toBeInTheDocument();
    });

    test('should fallback to default text on Modal.Body', () => {
        const props = {
            ...baseProps,
            channelName: '',
            remover: '',
        };

        renderWithContext(
            <RemovedFromChannelModal {...props}/>,
        );

        // Check for fallback text - "the channel" appears in both title and body
        expect(screen.getByText(/Someone/)).toBeInTheDocument();
        expect(screen.getAllByText(/the channel/).length).toBeGreaterThanOrEqual(1);
    });
});
