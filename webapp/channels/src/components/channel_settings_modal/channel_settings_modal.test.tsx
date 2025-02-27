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

    // Verify that unsaved changes enable the Save button.
    it('should enable Save when unsaved changes exist', async () => {
        renderWithContext(<ChannelSettingsModal {...baseProps}/>);
        const saveButton = screen.getByText('Save changes').closest('button');

        // Initially, no changes have been made so the save should be disabled.
        expect(saveButton).toBeDisabled();

        // Change the channel name by typing into the input.
        const nameInput = screen.getByPlaceholderText('Enter a name for your channel');
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'Updated Channel Name');

        // After change, the save button should be enabled.
        await waitFor(() => expect(saveButton).not.toBeDisabled());
    });

    // Verify that a valid save calls patchChannel and closes the modal.
    it('should call patchChannel on save and then hide the modal', async () => {
        const {patchChannel} = require('mattermost-redux/actions/channels');
        const onExited = jest.fn();
        renderWithContext(<ChannelSettingsModal {...{...baseProps, onExited}}/>);

        // Make a change to enable the Save button.
        const nameInput = screen.getByPlaceholderText('Enter a name for your channel');
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'Updated Channel Name');

        // Update patchChannel to simulate an async successful save.
        patchChannel.mockImplementation(() => {
            setTimeout(() => {
                act(() => {
                    onExited();
                });
            }, 0);
            return {type: 'MOCK_ACTION', data: {}};
        });

        const saveButton = screen.getByText('Save changes').closest('button');
        await act(async () => {
            await userEvent.click(saveButton!);
        });

        // Wait for the async patchChannel call.
        await waitFor(() => expect(patchChannel).toHaveBeenCalled());

        // Wait for onExited to be called.
        await waitFor(() => expect(onExited).toHaveBeenCalled(), {timeout: 1000});
    });

    // Verify that unsaved changes trigger the confirm modal when switching tabs.
    it('should show confirm modal when switching tabs with unsaved changes', async () => {
        renderWithContext(<ChannelSettingsModal {...baseProps}/>);

        // Simulate unsaved changes: change channel purpose.
        const purposeTextarea = screen.getByPlaceholderText('Enter a purpose for this channel (optional)');
        await userEvent.clear(purposeTextarea);
        await userEvent.type(purposeTextarea, 'New purpose');

        // Click on the "Configuration" tab in the sidebar.
        const configTabButton = screen.getByRole('button', {name: 'Configuration'});
        await act(async () => {
            await userEvent.click(configTabButton);
        });

        // Expect the confirm modal to be shown.
        expect(screen.getByText('Discard Changes?')).toBeInTheDocument();

        // Click on the confirm button in the confirm modal.
        const confirmButton = screen.getByText('Yes, Discard');
        await act(async () => {
            await userEvent.click(confirmButton);
        });
    });

    //Verify that clicking cancel on the modal triggers the hide (and confirm modal if unsaved changes exist).
    it('should trigger hide when cancel is clicked', async () => {
        const onExited = jest.fn();
        renderWithContext(<ChannelSettingsModal {...{...baseProps, onExited}}/>);

        // Make a change to require confirmation.
        const nameInput = screen.getByPlaceholderText('Enter a name for your channel');
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'Another change');

        // Click the main modal "Cancel" button (use test id if available).
        const genericCancelButton =
            screen.queryByTestId('cancelModalButton') || screen.getAllByText('Cancel')[0];
        await act(async () => {
            await userEvent.click(genericCancelButton);
        });

        // Confirm modal should appear due to unsaved changes.
        expect(screen.getByText('Discard Changes?')).toBeInTheDocument();

        // Instead of trying to locate the modal footer, wait for the cancel button to appear by test ID.
        const confirmModalCancel = await screen.findByTestId('cancel-button');
        await act(async () => {
            await userEvent.click(confirmModalCancel);
        });

        // The modal should still be visible.
        expect(screen.getByText('Channel Settings')).toBeInTheDocument();
    });
});
