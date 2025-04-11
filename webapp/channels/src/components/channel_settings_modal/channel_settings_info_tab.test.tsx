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
}));

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

        // Change the channel name.
        const nameInput = screen.getByRole('textbox', {name: 'Channel name'});
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'Updated Channel Name');

        // SaveChangesPanel should now be visible.
        expect(screen.queryByRole('button', {name: 'Save'})).toBeInTheDocument();
    });

    it('should call patchChannel with updated values when Save is clicked', async () => {
        const {patchChannel} = require('mattermost-redux/actions/channels');
        patchChannel.mockReturnValue({type: 'MOCK_ACTION', data: {}});

        renderWithContext(<ChannelSettingsInfoTab {...baseProps}/>);

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

        // Change to a private channel.
        await userEvent.click(screen.getByRole('button', {name: /Private Channel/}));

        // Click the Save button in the SaveChangesPanel.
        await act(async () => {
            await userEvent.click(screen.getByRole('button', {name: 'Save'}));
        });

        // Verify patchChannel was called with the updated values.
        expect(patchChannel).toHaveBeenCalledWith('channel1', {
            ...mockChannel,
            display_name: 'Updated Channel Name',
            name: 'updated-channel-name',
            purpose: 'Updated purpose',
            header: 'Updated header',
            type: 'P',
        });
    });

    it('should reset form when Reset button is clicked', async () => {
        renderWithContext(<ChannelSettingsInfoTab {...baseProps}/>);

        // Change the channel name.
        const nameInput = screen.getByRole('textbox', {name: 'Channel name'});
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'Updated Channel Name');

        // SaveChangesPanel should now be visible.
        expect(screen.queryByRole('button', {name: 'Save'})).toBeInTheDocument();

        // Click the Reset button.
        await userEvent.click(screen.getByRole('button', {name: 'Reset'}));

        // Form should be reset to original values.
        expect(screen.getByRole('textbox', {name: 'Channel name'})).toHaveValue('Test Channel');

        // SaveChangesPanel should be hidden after reset.
        expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();
    });

    it('should show error state when save fails', async () => {
        const {patchChannel} = require('mattermost-redux/actions/channels');
        patchChannel.mockReturnValue({type: 'MOCK_ACTION', error: {message: 'Error saving channel'}});

        renderWithContext(<ChannelSettingsInfoTab {...baseProps}/>);

        // Change the channel name.
        const nameInput = screen.getByRole('textbox', {name: 'Channel name'});
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'Updated Channel Name');

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

        // Clear the channel name to simulate an error.
        const nameInput = screen.getByRole('textbox', {name: 'Channel name'});
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'Updated Channel Name');
        await userEvent.clear(nameInput);
        nameInput.blur();

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
        const purposeInput = screen.getByTestId('channel_settings_purpose_textbox');
        await userEvent.clear(purposeInput);
        await userEvent.type(purposeInput, longPurpose);

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
        const headerInput = screen.getByTestId('channel_settings_header_textbox');
        await userEvent.clear(headerInput);
        await userEvent.type(headerInput, longHeader);

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

    it('should allow channel type change when user has permission to convert to private', async () => {
        // Set convert permission to true
        mockConvertToPrivatePermission = true;
        mockConvertToPublicPermission = true;

        const {patchChannel} = require('mattermost-redux/actions/channels');
        patchChannel.mockReturnValue({type: 'MOCK_ACTION', data: {}});

        renderWithContext(<ChannelSettingsInfoTab {...baseProps}/>);

        // Private channel button should not be disabled
        const privateButton = screen.getByRole('button', {name: /Private Channel/});
        expect(privateButton).not.toBeDisabled();

        // Should be able to change to private
        await userEvent.click(privateButton);

        // Click the Save button
        await act(async () => {
            await userEvent.click(screen.getByRole('button', {name: 'Save'}));
        });

        // Verify patchChannel was called with the updated type
        expect(patchChannel).toHaveBeenCalled();
    });

    it('should allow channel type change when user has permission to convert to public', async () => {
        // Set convert permission to true
        mockConvertToPrivatePermission = true;
        mockConvertToPublicPermission = true;

        const {patchChannel} = require('mattermost-redux/actions/channels');
        patchChannel.mockReturnValue({type: 'MOCK_ACTION', data: {}});

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

        // Public channel button should not be disabled
        const publicButton = screen.getByRole('button', {name: /Public Channel/});
        expect(publicButton).not.toBeDisabled();

        // Should be able to change to public
        await userEvent.click(publicButton);

        // Click the Save button
        await act(async () => {
            await userEvent.click(screen.getByRole('button', {name: 'Save'}));
        });

        // Verify patchChannel was called with the updated type
        expect(patchChannel).toHaveBeenCalled();
    });
});
