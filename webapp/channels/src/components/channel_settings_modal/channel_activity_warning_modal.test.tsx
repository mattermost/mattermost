// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, fireEvent, waitFor} from '@testing-library/react';
import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import ChannelActivityWarningModal from './channel_activity_warning_modal';

describe('ChannelActivityWarningModal', () => {
    const defaultProps = {
        isOpen: true,
        onClose: jest.fn(),
        onConfirm: jest.fn(),
        onDontShowAgain: jest.fn(),
        channelName: 'Test Channel',
    };

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should render modal when open', () => {
        renderWithContext(<ChannelActivityWarningModal {...defaultProps}/>);

        expect(screen.getByText('Channel Activity Warning')).toBeInTheDocument(); // Header title
        expect(screen.getByText(/There has been activity in "Test Channel"/)).toBeInTheDocument();
        expect(screen.getByText('Continue with Changes')).toBeInTheDocument();
        expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('should not render modal when closed', () => {
        renderWithContext(
            <ChannelActivityWarningModal
                {...defaultProps}
                isOpen={false}
            />,
        );

        expect(screen.queryByText('Channel Activity Warning')).not.toBeInTheDocument();
    });

    it('should display warning message with channel name', () => {
        renderWithContext(<ChannelActivityWarningModal {...defaultProps}/>);

        expect(screen.getByText(/There has been activity in "Test Channel" since the last access rule change/)).toBeInTheDocument();
        expect(screen.getByText(/Modifying access rules now might allow new users to see previous chat history/)).toBeInTheDocument();
    });

    it('should display warning header with icon and title', () => {
        renderWithContext(<ChannelActivityWarningModal {...defaultProps}/>);

        expect(screen.getByText('Channel Activity Warning')).toBeInTheDocument();
        expect(document.querySelector('.warning-icon')).toBeInTheDocument();
    });

    it('should call onClose when cancel button is clicked', () => {
        renderWithContext(<ChannelActivityWarningModal {...defaultProps}/>);

        fireEvent.click(screen.getByText('Cancel'));

        expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onConfirm when continue button is clicked without checkbox', () => {
        renderWithContext(<ChannelActivityWarningModal {...defaultProps}/>);

        fireEvent.click(screen.getByText('Continue with Changes'));

        expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
        expect(defaultProps.onDontShowAgain).not.toHaveBeenCalled();
    });

    it('should call onDontShowAgain and onConfirm when continue with checkbox checked', async () => {
        renderWithContext(<ChannelActivityWarningModal {...defaultProps}/>);

        // Check the "Don't show again" checkbox
        const checkbox = screen.getByRole('checkbox');
        fireEvent.click(checkbox);

        // Click continue
        fireEvent.click(screen.getByText('Continue with Changes'));

        // Wait for async functions to complete
        await waitFor(() => {
            expect(defaultProps.onDontShowAgain).toHaveBeenCalledTimes(1);
        });
        expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
    });

    it('should toggle checkbox state when clicked', () => {
        renderWithContext(<ChannelActivityWarningModal {...defaultProps}/>);

        const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
        expect(checkbox.checked).toBe(false);

        fireEvent.click(checkbox);
        expect(checkbox.checked).toBe(true);

        fireEvent.click(checkbox);
        expect(checkbox.checked).toBe(false);
    });

    it('should display dont show again checkbox', () => {
        renderWithContext(<ChannelActivityWarningModal {...defaultProps}/>);

        const checkbox = screen.getByLabelText(/Don't show this warning again/);
        expect(checkbox).toBeInTheDocument();
        expect(checkbox).not.toBeChecked();
    });

    it('should have correct button labels and functionality', () => {
        renderWithContext(<ChannelActivityWarningModal {...defaultProps}/>);

        expect(screen.getByText('Continue with Changes')).toBeInTheDocument();
        expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('should have correct modal structure and accessibility', () => {
        renderWithContext(<ChannelActivityWarningModal {...defaultProps}/>);

        expect(document.querySelector('.channel-activity-warning-modal')).toBeInTheDocument();
        expect(document.querySelector('.warning-description')).toBeInTheDocument();
        expect(document.querySelector('.dont-show-again-container')).toBeInTheDocument();
    });
});
