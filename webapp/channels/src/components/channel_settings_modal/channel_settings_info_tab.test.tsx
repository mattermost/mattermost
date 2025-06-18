// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';

import {renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ChannelSettingsInfoTab from './channel_settings_info_tab';

// Mock the redux actions and selectors
jest.mock('mattermost-redux/actions/channels', () => ({
    patchChannel: jest.fn(),
    updateChannelPrivacy: jest.fn(),
}));

// Mock the ConvertConfirmModal component
jest.mock('components/admin_console/team_channel_settings/convert_confirm_modal', () => {
    return jest.fn().mockImplementation(({show, onCancel, onConfirm, displayName}) => {
        if (!show) {
            return null;
        }
        return (
            <div data-testid='convert-confirm-modal'>
                <div>{'Converting '}{displayName}{' to private'}</div>
                <button onClick={onCancel}>{'Cancel'}</button>
                <button onClick={onConfirm}>{'Yes, Convert Channel'}</button>
            </div>
        );
    });
});

let mockChannelPropertiesPermission = true;
let mockConvertToPublicPermission = true;
let mockConvertToPrivatePermission = true;

jest.mock('mattermost-redux/selectors/entities/roles', () => ({
    haveITeamPermission: jest.fn().mockReturnValue(true),
    haveIChannelPermission: jest.fn().mockImplementation((state, teamId, channelId, permission: string) => {
        if (permission === 'manage_private_channel_properties' || permission === 'manage_public_channel_properties') {
            return mockChannelPropertiesPermission;
        }
        if (permission === 'convert_public_channel_to_private') {
            return mockConvertToPrivatePermission;
        }
        if (permission === 'convert_private_channel_to_public') {
            return mockConvertToPublicPermission;
        }
        return true;
    }),
    getRoles: jest.fn().mockReturnValue({}),
}));

jest.mock('selectors/views/textbox', () => ({
    showPreviewOnChannelSettingsHeaderModal: jest.fn().mockReturnValue(false),
    showPreviewOnChannelSettingsPurposeModal: jest.fn().mockReturnValue(false),
}));

jest.mock('actions/views/textbox', () => ({
    setShowPreviewOnChannelSettingsHeaderModal: jest.fn(),
    setShowPreviewOnChannelSettingsPurposeModal: jest.fn(),
}));

// Mock the isChannelAdmin function
jest.mock('mattermost-redux/utils/user_utils', () => {
    const original = jest.requireActual('mattermost-redux/utils/user_utils');
    return {
        ...original,
        isChannelAdmin: jest.fn().mockReturnValue(false),
    };
});

// Mock the ShowFormat component to make it easier to test
jest.mock('components/advanced_text_editor/show_formatting/show_formatting', () => (
    jest.fn().mockImplementation((props) => (
        <button
            data-testid='mock-show-format'
            onClick={props.onClick}
            className={props.active ? 'active' : ''}
        >
            {'Toggle Preview'}
        </button>
    ))
));

// Create a mock channel member
const mockChannelMember = TestHelper.getChannelMembershipMock({
    roles: 'channel_user system_admin',
});

// Mock the current user
const mockUser = TestHelper.getUserMock({
    id: 'user_id',
    roles: 'system_admin',
});

jest.mock('mattermost-redux/selectors/entities/channels', () => ({
    ...jest.requireActual('mattermost-redux/selectors/entities/channels') as typeof import('mattermost-redux/selectors/entities/channels'),
    getChannelMember: jest.fn(() => mockChannelMember),
}));

jest.mock('mattermost-redux/selectors/entities/common', () => {
    return {
        ...jest.requireActual('mattermost-redux/selectors/entities/common') as typeof import('mattermost-redux/selectors/entities/users'),
        getCurrentUser: () => mockUser,
    };
});

// Create a mock channel for testing
const mockChannel = TestHelper.getChannelMock({
    id: 'channel1',
    team_id: 'team1',
    display_name: 'Test Channel',
    name: 'test-channel',
    purpose: 'Testing purpose',
    header: 'Initial header',
    type: 'O',
});

const baseProps = {
    channel: mockChannel,
    setAreThereUnsavedChanges: jest.fn(),
};

describe('ChannelSettingsInfoTab', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockChannelPropertiesPermission = true;
        mockConvertToPublicPermission = true;
        mockConvertToPrivatePermission = true;
    });

    it('should render with the correct initial values', () => {
        renderWithContext(<ChannelSettingsInfoTab {...baseProps}/>);

        // Check that the channel name field has the correct value.
        expect(screen.getByRole('textbox', {name: 'Channel name'})).toHaveValue('Test Channel');

        // Check that the purpose field has the correct value.
        expect(screen.getByTestId('channel_settings_purpose_textbox')).toHaveValue('Testing purpose');

        // Check that the header field has the correct value.
        expect(screen.getByTestId('channel_settings_header_textbox')).toHaveValue('Initial header');

        // Check that the public channel button is selected.
        expect(screen.getByRole('button', {name: /Public Channel/}).classList.contains('selected')).toBe(true);
    });

    it('should show SaveChangesPanel when changes are made', async () => {
        renderWithContext(<ChannelSettingsInfoTab {...baseProps}/>);

        // Initially, SaveChangesPanel should not be visible.
        expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();

        // Wrap the interaction in act to handle state updates properly
        await act(async () => {
            // Change the channel name.
            const nameInput = screen.getByRole('textbox', {name: 'Channel name'});
            await userEvent.clear(nameInput);
            await userEvent.type(nameInput, 'Updated Channel Name');
        });

        // Add a small delay to ensure all state updates are processed
        await new Promise((resolve) => setTimeout(resolve, 0));

        // SaveChangesPanel should now be visible.
        expect(screen.queryByRole('button', {name: 'Save'})).toBeInTheDocument();
    });

    it('should call patchChannel with updated values when Save is clicked (non-privacy changes)', async () => {
        const {patchChannel} = require('mattermost-redux/actions/channels');
        patchChannel.mockReturnValue({type: 'MOCK_ACTION', data: {}});

        renderWithContext(<ChannelSettingsInfoTab {...baseProps}/>);

        // Wrap all user interactions in act to handle state updates properly
        await act(async () => {
            // Change the channel name.
            const nameInput = screen.getByRole('textbox', {name: 'Channel name'});
            await userEvent.clear(nameInput);
            await userEvent.type(nameInput, 'Updated Channel Name');

            // Change the channel purpose.
            const purposeInput = screen.getByTestId('channel_settings_purpose_textbox');
            await userEvent.clear(purposeInput);
            await userEvent.type(purposeInput, 'Updated purpose');

            // Change the channel header.
            const headerInput = screen.getByTestId('channel_settings_header_textbox');
            await userEvent.clear(headerInput);
            await userEvent.type(headerInput, 'Updated header');
        });

        // Add a small delay to ensure all state updates are processed
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Click the Save button in the SaveChangesPanel.
        await act(async () => {
            await userEvent.click(screen.getByRole('button', {name: 'Save'}));
        });

        // Verify patchChannel was called with the updated values (without type change).
        expect(patchChannel).toHaveBeenCalledWith('channel1', {
            ...mockChannel,
            display_name: 'Updated Channel Name',
            name: 'updated-channel-name',
            purpose: 'Updated purpose',
            header: 'Updated header',
        });
    });

    it('should trim whitespace from channel fields when saving', async () => {
        const {patchChannel} = require('mattermost-redux/actions/channels');
        patchChannel.mockReturnValue({type: 'MOCK_ACTION', data: {}});

        renderWithContext(<ChannelSettingsInfoTab {...baseProps}/>);

        // Add whitespace to the channel fields
        await act(async () => {
            // Change the channel name with whitespace
            const nameInput = screen.getByRole('textbox', {name: 'Channel name'});
            await userEvent.clear(nameInput);
            await userEvent.type(nameInput, '  Channel Name With Whitespace  ');

            // Change the channel purpose with whitespace
            const purposeInput = screen.getByTestId('channel_settings_purpose_textbox');
            await userEvent.clear(purposeInput);
            await userEvent.type(purposeInput, '  Purpose with whitespace  ');

            // Change the channel header with whitespace
            const headerInput = screen.getByTestId('channel_settings_header_textbox');
            await userEvent.clear(headerInput);
            await userEvent.type(headerInput, '  Header with whitespace  ');
        });

        // Add a small delay to ensure all state updates are processed
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Click the Save button
        await act(async () => {
            await userEvent.click(screen.getByRole('button', {name: 'Save'}));
        });

        // Verify patchChannel was called with the trimmed values
        expect(patchChannel).toHaveBeenCalledWith('channel1', {
            ...mockChannel,
            display_name: 'Channel Name With Whitespace', // Whitespace should be trimmed
            name: 'channel-name-with-whitespace', // URL is generated from display name and should be trimmed
            purpose: 'Purpose with whitespace', // Whitespace should be trimmed
            header: 'Header with whitespace', // Whitespace should be trimmed
        });

        // Verify that the local state is updated with trimmed values
        // Wait for the component to update after the save
        await new Promise((resolve) => setTimeout(resolve, 0));

        // The inputs should now have the trimmed values
        expect(screen.getByRole('textbox', {name: 'Channel name'})).toHaveValue('Channel Name With Whitespace');
        expect(screen.getByTestId('channel_settings_purpose_textbox')).toHaveValue('Purpose with whitespace');
        expect(screen.getByTestId('channel_settings_header_textbox')).toHaveValue('Header with whitespace');
    });

    it('should hide SaveChangesPanel after successful save', async () => {
        // Mock the patchChannel function to return a successful response
        const {patchChannel} = require('mattermost-redux/actions/channels');
        patchChannel.mockReturnValue({type: 'MOCK_ACTION', data: {}});

        renderWithContext(<ChannelSettingsInfoTab {...baseProps}/>);

        // Initially, SaveChangesPanel should not be visible
        expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();

        // Make changes to the channel name
        await act(async () => {
            const nameInput = screen.getByRole('textbox', {name: 'Channel name'});
            await userEvent.clear(nameInput);
            await userEvent.type(nameInput, 'Updated Channel Name');
        });

        // SaveChangesPanel should now be visible
        expect(screen.getByRole('button', {name: 'Save'})).toBeInTheDocument();

        // Click the Save button
        await act(async () => {
            await userEvent.click(screen.getByRole('button', {name: 'Save'}));
        });

        // Add a small delay to ensure all state updates are processed
        await new Promise((resolve) => setTimeout(resolve, 0));

        // SaveChangesPanel should now be hidden after the successful save
        expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();
    });

    it('should reset form when Reset button is clicked', async () => {
        renderWithContext(<ChannelSettingsInfoTab {...baseProps}/>);

        // Wrap the interaction in act to handle state updates properly
        await act(async () => {
            // Change the channel name.
            const nameInput = screen.getByRole('textbox', {name: 'Channel name'});
            await userEvent.clear(nameInput);
            await userEvent.type(nameInput, 'Updated Channel Name');
        });

        // Add a small delay to ensure all state updates are processed
        await new Promise((resolve) => setTimeout(resolve, 0));

        // SaveChangesPanel should now be visible.
        expect(screen.queryByRole('button', {name: 'Save'})).toBeInTheDocument();

        // Click the Reset button.
        await act(async () => {
            await userEvent.click(screen.getByRole('button', {name: 'Reset'}));
        });

        // Form should be reset to original values.
        expect(screen.getByRole('textbox', {name: 'Channel name'})).toHaveValue('Test Channel');

        // SaveChangesPanel should be hidden after reset.
        expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();
    });

    it('should show error state when save fails', async () => {
        const {patchChannel} = require('mattermost-redux/actions/channels');
        patchChannel.mockReturnValue({type: 'MOCK_ACTION', error: {message: 'Error saving channel'}});

        renderWithContext(<ChannelSettingsInfoTab {...baseProps}/>);

        // Wrap the interaction in act to handle state updates properly
        await act(async () => {
            // Change the channel name.
            const nameInput = screen.getByRole('textbox', {name: 'Channel name'});
            await userEvent.clear(nameInput);
            await userEvent.type(nameInput, 'Updated Channel Name');
        });

        // Add a small delay to ensure all state updates are processed
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Click the Save button.
        await act(async () => {
            await userEvent.click(screen.getByRole('button', {name: 'Save'}));
        });

        // SaveChangesPanel should show 'error' state.
        const errorMessage = screen.getByText(/There are errors in the form above/);
        const errorPanel = errorMessage.closest('.SaveChangesPanel');
        expect(errorPanel).toHaveClass('error');
    });

    // Instead of clicking a non-existent element to trigger a channel name error,
    // simulate an invalid input by clearing the channel name (which is required).
    it('should show error when channel name field has an error', async () => {
        renderWithContext(
            <ChannelSettingsInfoTab
                {...baseProps}
            />,
        );

        // Wrap the interaction in act to handle state updates properly
        await act(async () => {
            // Clear the channel name to simulate an error.
            const nameInput = screen.getByRole('textbox', {name: 'Channel name'});
            await userEvent.clear(nameInput);
            await userEvent.type(nameInput, 'Updated Channel Name');
            await userEvent.clear(nameInput);
            nameInput.blur();
        });

        // Add a small delay to ensure all state updates are processed
        await new Promise((resolve) => setTimeout(resolve, 0));

        // SaveChangesPanel should show error state.
        const errorMessage = screen.getByText(/There are errors in the form above/);
        const errorPanel = errorMessage.closest('.SaveChangesPanel');
        expect(errorPanel).toHaveClass('error');
    });

    it('should show error when purpose exceeds character limit', async () => {
        renderWithContext(
            <ChannelSettingsInfoTab
                {...baseProps}
            />,
        );

        // Create a string that exceeds the allowed character limit
        const longPurpose = 'a'.repeat(1025);

        // Wrap the interaction in act to handle state updates properly
        await act(async () => {
            const purposeInput = screen.getByTestId('channel_settings_purpose_textbox');
            await userEvent.clear(purposeInput);
            await userEvent.type(purposeInput, longPurpose);
        });

        // Add a small delay to ensure all state updates are processed
        await new Promise((resolve) => setTimeout(resolve, 0));

        // SaveChangesPanel should show error state.
        const errorMessage = screen.getByText(/There are errors in the form above/);
        const errorPanel = errorMessage.closest('.SaveChangesPanel');
        expect(errorPanel).toHaveClass('error');
    });

    it('should show error when header exceeds character limit', async () => {
        renderWithContext(
            <ChannelSettingsInfoTab
                {...baseProps}
            />,
        );

        // Create a string that exceeds the header character limit.
        const longHeader = 'a'.repeat(1025);

        // Wrap the interaction in act to handle state updates properly
        await act(async () => {
            const headerInput = screen.getByTestId('channel_settings_header_textbox');
            await userEvent.clear(headerInput);
            await userEvent.type(headerInput, longHeader);
        });

        // Add a small delay to ensure all state updates are processed
        await new Promise((resolve) => setTimeout(resolve, 0));

        // SaveChangesPanel should show error state.
        const errorMessage = screen.getByText(/There are errors in the form above/);
        const errorPanel = errorMessage.closest('.SaveChangesPanel');
        expect(errorPanel).toHaveClass('error');
    });

    it('should render ChannelNameFormField and AdvancedTextbox as readOnly when user does not have permission', () => {
        mockChannelPropertiesPermission = false;

        renderWithContext(<ChannelSettingsInfoTab {...baseProps}/>);

        // Check that the name input is disabled
        const nameInput = screen.getByRole('textbox', {name: 'Channel name'});
        expect(nameInput).toBeDisabled();

        // When in readOnly mode, the preview toggle button should not be present
        expect(screen.queryByTestId('mock-show-format')).not.toBeInTheDocument();
    });

    it('should render ChannelNameFormField and AdvancedTextbox as not readOnly when user has permission', () => {
        mockChannelPropertiesPermission = true;

        renderWithContext(<ChannelSettingsInfoTab {...baseProps}/>);

        // Check that the name input is not disabled
        const nameInput = screen.getByRole('textbox', {name: 'Channel name'});
        expect(nameInput).not.toBeDisabled();

        // When not in readOnly mode, at least one preview toggle button should be present
        const previewButtons = screen.queryAllByTestId('mock-show-format');
        expect(previewButtons.length).toBeGreaterThan(0);
    });

    it('should not allow channel type change when user lacks permissions', async () => {
        // Set permissions to false
        mockConvertToPublicPermission = false;
        mockConvertToPrivatePermission = false;

        renderWithContext(<ChannelSettingsInfoTab {...baseProps}/>);

        // Private channel button should be disabled
        const privateButton = screen.getByRole('button', {name: /Private Channel/});
        expect(privateButton).toHaveClass('disabled');
    });

    it('should allow channel type change UI when user has permission to convert to private', async () => {
        // Set convert permission to true
        mockConvertToPrivatePermission = true;
        mockConvertToPublicPermission = true;

        renderWithContext(<ChannelSettingsInfoTab {...baseProps}/>);

        // Private channel button should not be disabled
        const privateButton = screen.getByRole('button', {name: /Private Channel/});
        expect(privateButton).not.toBeDisabled();

        // Should be able to change to private in the UI
        await userEvent.click(privateButton);

        // Verify the private button is now selected
        expect(privateButton).toHaveClass('selected');
    });

    it('should never allow conversion from private to public', async () => {
        // Set convert permission to true (even with permission, it should be prevented)
        mockConvertToPublicPermission = true;

        // Start with a private channel
        const privateChannel = {
            ...mockChannel,
            type: 'P' as ChannelType,
        };

        renderWithContext(
            <ChannelSettingsInfoTab
                {...baseProps}
                channel={privateChannel}
            />,
        );

        // Public channel button should be disabled regardless of permissions
        const publicButton = screen.getByRole('button', {name: /Public Channel/});
        expect(publicButton).toHaveClass('disabled');

        // Private button should be selected
        const privateButton = screen.getByRole('button', {name: /Private Channel/});
        expect(privateButton).toHaveClass('selected');
    });

    it('should show ConvertConfirmModal when converting from public to private', async () => {
        mockConvertToPrivatePermission = true;

        renderWithContext(<ChannelSettingsInfoTab {...baseProps}/>);

        // Change to private channel
        const privateButton = screen.getByRole('button', {name: /Private Channel/});
        await userEvent.click(privateButton);

        // Click Save button
        await act(async () => {
            await userEvent.click(screen.getByRole('button', {name: 'Save'}));
        });

        // Verify the modal is shown
        expect(screen.getByTestId('convert-confirm-modal')).toBeInTheDocument();
    });

    it('should convert channel when confirming in ConvertConfirmModal', async () => {
        mockConvertToPrivatePermission = true;

        const {updateChannelPrivacy} = require('mattermost-redux/actions/channels');
        updateChannelPrivacy.mockReturnValue({type: 'MOCK_ACTION', data: {}});

        renderWithContext(<ChannelSettingsInfoTab {...baseProps}/>);

        // Change to private channel
        const privateButton = screen.getByRole('button', {name: /Private Channel/});
        await userEvent.click(privateButton);

        // Click Save button to show modal
        await act(async () => {
            await userEvent.click(screen.getByRole('button', {name: 'Save'}));
        });

        // Click confirm button in modal
        await act(async () => {
            await userEvent.click(screen.getByText(/Yes, Convert Channel/i));
        });

        // Verify updateChannelPrivacy was called
        expect(updateChannelPrivacy).toHaveBeenCalledWith('channel1', 'P');
    });

    it('should not convert channel when canceling in ConvertConfirmModal', async () => {
        mockConvertToPrivatePermission = true;

        const {updateChannelPrivacy} = require('mattermost-redux/actions/channels');
        updateChannelPrivacy.mockReturnValue({type: 'MOCK_ACTION', data: {}});

        renderWithContext(<ChannelSettingsInfoTab {...baseProps}/>);

        // Change to private channel
        const privateButton = screen.getByRole('button', {name: /Private Channel/});
        await userEvent.click(privateButton);

        // Click Save button to show modal
        await act(async () => {
            await userEvent.click(screen.getByRole('button', {name: 'Save'}));
        });

        // Click cancel button in modal
        await act(async () => {
            await userEvent.click(screen.getByText(/Cancel/i));
        });

        // Verify updateChannelPrivacy was not called
        expect(updateChannelPrivacy).not.toHaveBeenCalled();
    });

    it('should handle errors when converting channel privacy', async () => {
        mockConvertToPrivatePermission = true;

        const {updateChannelPrivacy} = require('mattermost-redux/actions/channels');
        updateChannelPrivacy.mockReturnValue({
            type: 'MOCK_ACTION',
            error: {message: 'Error changing privacy'},
        });

        renderWithContext(<ChannelSettingsInfoTab {...baseProps}/>);

        // Change to private channel
        const privateButton = screen.getByRole('button', {name: /Private Channel/});
        await userEvent.click(privateButton);

        // Click Save button to show modal
        await act(async () => {
            await userEvent.click(screen.getByRole('button', {name: 'Save'}));
        });

        // Click confirm button in modal
        await act(async () => {
            await userEvent.click(screen.getByText(/Yes, Convert Channel/i));
        });

        // Verify error state is shown
        expect(screen.getByText(/There are errors in the form above/)).toBeInTheDocument();
    });
});
