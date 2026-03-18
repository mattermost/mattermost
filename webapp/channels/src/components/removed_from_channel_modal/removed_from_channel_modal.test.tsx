// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import RemovedFromChannelModal from 'components/removed_from_channel_modal/removed_from_channel_modal';

import {renderWithContext, screen} from 'tests/react_testing_utils';

describe('components/RemoveFromChannelModal', () => {
    const baseProps = {
        currentUserId: 'current_user_id',
        channelName: 'test-channel',
        remover: 'Administrator',
        onExited: jest.fn(),
    };

    test('should match snapshot', () => {
        const {baseElement} = renderWithContext(
            <RemovedFromChannelModal {...baseProps}/>,
        );

        expect(baseElement).toMatchSnapshot();
    });

    test('should have state "show" equals true on mount', () => {
        renderWithContext(
            <RemovedFromChannelModal {...baseProps}/>,
        );

        // Modal should be visible on mount (show state is true)
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    test('should display correct props on Modal.Title and Modal.Body', () => {
        renderWithContext(
            <RemovedFromChannelModal {...baseProps}/>,
        );

        expect(screen.getByText(/Removed from/)).toBeInTheDocument();
        expect(screen.getByText('test-channel')).toBeInTheDocument();
        expect(screen.getByText(/Administrator removed you from test-channel/)).toBeInTheDocument();
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

        expect(screen.getByText(/Removed from/)).toBeInTheDocument();
        expect(screen.getByText('the channel')).toBeInTheDocument();
        expect(screen.getByText(/Someone removed you from the channel/)).toBeInTheDocument();
    });
});
