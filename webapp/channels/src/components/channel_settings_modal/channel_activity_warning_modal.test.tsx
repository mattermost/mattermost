// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import ChannelActivityWarningModal from './channel_activity_warning_modal';

describe('ChannelActivityWarningModal', () => {
    const defaultProps = {
        isOpen: true,
        onClose: jest.fn(),
        onConfirm: jest.fn(),
        channelName: 'test-channel',
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should render modal when isOpen is true', () => {
        renderWithContext(
            <ChannelActivityWarningModal {...defaultProps}/>,
        );

        expect(screen.getByText('Exposing channel history')).toBeInTheDocument();
        expect(screen.getByText(/Everyone who gains access to this channel/)).toBeInTheDocument();
        expect(screen.getByText(/I acknowledge this change will expose/)).toBeInTheDocument();
    });

    test('should not render modal when isOpen is false', () => {
        renderWithContext(
            <ChannelActivityWarningModal
                {...defaultProps}
                isOpen={false}
            />,
        );

        expect(screen.queryByText('Exposing channel history')).not.toBeInTheDocument();
    });

    test('should have disabled Save button initially', () => {
        renderWithContext(
            <ChannelActivityWarningModal {...defaultProps}/>,
        );

        const saveButton = screen.getByRole('button', {name: /save and apply/i});
        expect(saveButton).toBeDisabled();
    });

    test('should enable Save button when checkbox is checked', async () => {
        const user = userEvent.setup();
        renderWithContext(
            <ChannelActivityWarningModal {...defaultProps}/>,
        );

        const checkbox = screen.getByRole('checkbox');
        const saveButton = screen.getByRole('button', {name: /save and apply/i});

        expect(saveButton).toBeDisabled();

        await user.click(checkbox);

        expect(saveButton).toBeEnabled();
    });

    test('should call onConfirm when Save button is clicked with checkbox checked', async () => {
        const user = userEvent.setup();
        const mockOnConfirm = jest.fn();
        renderWithContext(
            <ChannelActivityWarningModal
                {...defaultProps}
                onConfirm={mockOnConfirm}
            />,
        );

        const checkbox = screen.getByRole('checkbox');
        const saveButton = screen.getByRole('button', {name: /save and apply/i});

        await user.click(checkbox);
        await user.click(saveButton);

        expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    });

    test('should call onClose when Cancel button is clicked', async () => {
        const user = userEvent.setup();
        const mockOnClose = jest.fn();
        renderWithContext(
            <ChannelActivityWarningModal
                {...defaultProps}
                onClose={mockOnClose}
            />,
        );

        const cancelButton = screen.getByRole('button', {name: /cancel/i});
        await user.click(cancelButton);

        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    test('should reset checkbox when modal opens', () => {
        const {rerender} = renderWithContext(
            <ChannelActivityWarningModal
                {...defaultProps}
                isOpen={false}
            />,
        );

        // Open modal
        rerender(
            <ChannelActivityWarningModal
                {...defaultProps}
                isOpen={true}
            />,
        );

        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).not.toBeChecked();
    });

    test('should not call onConfirm when Save button is clicked without checkbox checked', async () => {
        const user = userEvent.setup();
        const mockOnConfirm = jest.fn();
        renderWithContext(
            <ChannelActivityWarningModal
                {...defaultProps}
                onConfirm={mockOnConfirm}
            />,
        );

        // Try to click disabled button (should not work)
        const saveButton = screen.getByRole('button', {name: /save and apply/i});
        expect(saveButton).toBeDisabled();

        // Attempt to click (should not trigger onConfirm)
        await user.click(saveButton);
        expect(mockOnConfirm).not.toHaveBeenCalled();
    });
});
