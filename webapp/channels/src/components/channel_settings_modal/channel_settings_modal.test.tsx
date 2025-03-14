// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, waitFor, act} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import ChannelSettingsModal from './channel_settings_modal';

// Mock the redux actions and selectors as needed.
jest.mock('mattermost-redux/actions/channels', () => ({
    patchChannel: jest.fn().mockReturnValue({type: 'MOCK_ACTION', data: {}}),
}));

jest.mock('mattermost-redux/selectors/entities/roles', () => ({
    haveITeamPermission: () => true,
}));

// A simple base channel object for testing
const baseChannel = {
    id: 'channel1',
    team_id: 'team1',
    display_name: 'Test Channel',
    name: 'test-channel',
    purpose: 'Testing purpose',
    header: 'Initial header',
    type: 'O' as const,
    create_at: 0,
    update_at: 0,
    delete_at: 0,
    last_post_at: 0,
    total_msg_count: 0,
    extra_update_at: 0,
    creator_id: 'creator1',
    last_root_post_at: 0,
    scheme_id: '',
    group_constrained: false,
};

const baseProps = {
    channel: baseChannel,
    isOpen: true,
    onExited: jest.fn(),
    focusOriginElement: 'button1',
};

describe('ChannelSettingsModal', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // Ensure the modal renders correctly with expected header text.
    it('should render the modal with correct header text', () => {
        renderWithContext(<ChannelSettingsModal {...baseProps}/>);
        expect(screen.getByText('Channel Settings')).toBeInTheDocument();
    });

    // Check that the Info tab is rendered by default.
    it('should render Info tab by default', () => {
        renderWithContext(<ChannelSettingsModal {...baseProps}/>);

        // Check for an element from the Info tab. In this case, the label for channel name.
        expect(screen.getByText('Channel Name')).toBeInTheDocument();
    });

    // Verify that unsaved changes show the SaveChangesPanel
    it('should show SaveChangesPanel when unsaved changes exist', async () => {
        renderWithContext(<ChannelSettingsModal {...baseProps}/>);

        // Initially, SaveChangesPanel should not be visible
        expect(screen.queryByText('You have unsaved changes')).not.toBeInTheDocument();

        // Change the channel name by typing into the input.
        const nameInput = screen.getByLabelText('Channel name');
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'Updated Channel Name');

        // After change, the SaveChangesPanel should be visible with Save button
        await waitFor(() => {
            expect(screen.getByText('You have unsaved changes')).toBeInTheDocument();
            expect(screen.getByTestId('mm-save-changes-panel__save-btn')).toBeInTheDocument();
        });
    });

    // Verify that a valid save calls patchChannel and closes the modal.
    it('should call patchChannel on save and then hide the modal', async () => {
        const {patchChannel} = require('mattermost-redux/actions/channels');
        const onExited = jest.fn();
        renderWithContext(<ChannelSettingsModal {...{...baseProps, onExited}}/>);

        // Make a change to show the SaveChangesPanel
        // Find the input by aria-label
        const nameInput = screen.getByLabelText('Channel name');
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'Updated Channel Name');

        // Wait for SaveChangesPanel to appear
        await waitFor(() => {
            expect(screen.getByText('You have unsaved changes')).toBeInTheDocument();
        });

        // Update patchChannel to simulate an async successful save.
        patchChannel.mockImplementation(() => {
            setTimeout(() => {
                act(() => {
                    onExited();
                });
            }, 0);
            return {type: 'MOCK_ACTION', data: {}};
        });

        // Click the Save button in the SaveChangesPanel
        const saveButton = screen.getByTestId('mm-save-changes-panel__save-btn');
        await act(async () => {
            await userEvent.click(saveButton);
        });

        // Wait for the async patchChannel call.
        await waitFor(() => expect(patchChannel).toHaveBeenCalled());

        // Wait for onExited to be called.
        await waitFor(() => expect(onExited).toHaveBeenCalled(), {timeout: 1000});
    });

    // Verify that unsaved changes show the SaveChangesPanel when switching tabs.
    it('should show SaveChangesPanel when switching tabs with unsaved changes', async () => {
        renderWithContext(<ChannelSettingsModal {...baseProps}/>);

        // Simulate unsaved changes: change channel purpose.
        const purposeTextarea = screen.getByPlaceholderText('Enter a purpose for this channel (optional)');
        await userEvent.clear(purposeTextarea);
        await userEvent.type(purposeTextarea, 'New purpose');

        // Wait for the lazy-loaded sidebar to render the "Configuration" tab.
        const configTabButton = await screen.findByRole('tab', {name: 'configuration'});
        await act(async () => {
            await userEvent.click(configTabButton);
        });

        // Expect the SaveChangesPanel to be shown.
        expect(screen.getByText('You have unsaved changes')).toBeInTheDocument();
        expect(screen.getByTestId('mm-save-changes-panel__save-btn')).toBeInTheDocument();
        expect(screen.getByTestId('mm-save-changes-panel__cancel-btn')).toBeInTheDocument();
    });

    // Verify that clicking Undo in the SaveChangesPanel resets the form.
    it('should reset form when Undo is clicked in SaveChangesPanel', async () => {
        renderWithContext(<ChannelSettingsModal {...baseProps}/>);

        // Make a change to show the SaveChangesPanel
        const nameInput = screen.getByLabelText('Channel name');
        const originalName = nameInput.getAttribute('value');
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'Changed Name');

        // Wait for SaveChangesPanel to appear
        await waitFor(() => {
            expect(screen.getByText('You have unsaved changes')).toBeInTheDocument();
        });

        // Click the Undo button in the SaveChangesPanel
        const undoButton = screen.getByTestId('mm-save-changes-panel__cancel-btn');
        await act(async () => {
            await userEvent.click(undoButton);
        });

        // Verify the form was reset to original values
        await waitFor(() => {
            const nameInput = screen.getByLabelText('Channel name');
            expect(nameInput.getAttribute('value')).toBe(originalName);

            // SaveChangesPanel should be hidden after reset
            expect(screen.queryByText('You have unsaved changes')).not.toBeInTheDocument();
        });
    });

    // Test that the SaveChangesPanel shows "saved" state when save succeeds
    it('should show saved state in SaveChangesPanel when save succeeds', async () => {
        const {patchChannel} = require('mattermost-redux/actions/channels');
        renderWithContext(<ChannelSettingsModal {...baseProps}/>);

        // Make a change to show the SaveChangesPanel
        const nameInput = screen.getByLabelText('Channel name');

        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'Updated Channel Name');

        // Wait for SaveChangesPanel to appear
        await waitFor(() => {
            expect(screen.getByText('You have unsaved changes')).toBeInTheDocument();
        });

        // Mock successful save
        patchChannel.mockReturnValue({type: 'MOCK_ACTION', data: {}});

        // Click the Save button in the SaveChangesPanel
        const saveButton = screen.getByTestId('mm-save-changes-panel__save-btn');
        await act(async () => {
            await userEvent.click(saveButton);
        });

        // Verify "Settings saved" message appears
        await waitFor(() => {
            expect(screen.getByText('Settings saved')).toBeInTheDocument();
        });
    });

    // Test that the SaveChangesPanel shows "error" state when save fails
    it('should show error state in SaveChangesPanel when save fails', async () => {
        const {patchChannel} = require('mattermost-redux/actions/channels');
        renderWithContext(<ChannelSettingsModal {...baseProps}/>);

        // Make a change to show the SaveChangesPanel
        const nameInput = screen.getByLabelText('Channel name');

        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'Updated Channel Name');

        // Wait for SaveChangesPanel to appear
        await waitFor(() => {
            expect(screen.getByText('You have unsaved changes')).toBeInTheDocument();
        });

        // Mock failed save
        patchChannel.mockReturnValue({type: 'MOCK_ACTION', error: {message: 'Error saving channel'}});

        // Click the Save button in the SaveChangesPanel
        const saveButton = screen.getByTestId('mm-save-changes-panel__save-btn');
        await act(async () => {
            await userEvent.click(saveButton);
        });

        // Verify error message appears
        await waitFor(() => {
            expect(screen.getByText('There was an error saving your settings')).toBeInTheDocument();
            expect(screen.getByText('Try again')).toBeInTheDocument();
        });
    });

    // Verify that the archive tab is not shown for the default channel
    it('should not show archive tab for default channel', async () => {
        // Create a channel with the default channel name (town-square)
        const defaultChannel = {
            ...baseChannel,
            name: 'town-square', // Constants.DEFAULT_CHANNEL
        };

        renderWithContext(<ChannelSettingsModal {...{...baseProps, channel: defaultChannel}}/>);

        // Wait for the lazy-loaded sidebar to render
        await waitFor(() => {
            // Verify that the Info tab is shown
            expect(screen.getByRole('tab', {name: 'info'})).toBeInTheDocument();

            // Verify that the Configuration tab is shown
            expect(screen.getByRole('tab', {name: 'configuration'})).toBeInTheDocument();

            // Verify that the Archive tab is NOT shown
            expect(screen.queryByRole('tab', {name: 'archive channel'})).not.toBeInTheDocument();
        });
    });
});
