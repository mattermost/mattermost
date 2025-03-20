// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ChannelSettingsInfoTab from './channel_settings_info_tab';

// Mock the redux actions and selectors
jest.mock('mattermost-redux/actions/channels', () => ({
    patchChannel: jest.fn().mockReturnValue({type: 'MOCK_ACTION', data: {}}),
}));

jest.mock('mattermost-redux/selectors/entities/roles', () => ({
    haveITeamPermission: jest.fn().mockReturnValue(true),
}));

jest.mock('selectors/views/textbox', () => ({
    showPreviewOnChannelSettingsHeaderModal: jest.fn().mockReturnValue(false),
    showPreviewOnChannelSettingsPurposeModal: jest.fn().mockReturnValue(false),
}));

jest.mock('actions/views/textbox', () => ({
    setShowPreviewOnChannelSettingsHeaderModal: jest.fn(),
    setShowPreviewOnChannelSettingsPurposeModal: jest.fn(),
}));

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
    serverError: '',
    setServerError: jest.fn(),
    setAreThereUnsavedChanges: jest.fn(),
};

describe('ChannelSettingsInfoTab', () => {
    beforeEach(() => {
        jest.clearAllMocks();
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
        expect(screen.getByRole('button', {name: /Public Channel/})).toHaveClass('selected');
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
        const setServerError = jest.fn();
        renderWithContext(
            <ChannelSettingsInfoTab
                {...baseProps}
                setServerError={setServerError}
            />,
        );

        // Clear the channel name to simulate an error.
        const nameInput = screen.getByRole('textbox', {name: 'Channel name'});
        await userEvent.clear(nameInput);
        nameInput.blur();

        // Expect the server error to be set (for example, "Channel names must have at least 2 characters.").
        expect(setServerError).toHaveBeenCalledWith('Channel names must have at least 2 characters.');

        // SaveChangesPanel should show error state.
        const errorMessage = screen.getByText(/There are errors in the form above/);
        const errorPanel = errorMessage.closest('.SaveChangesPanel');
        expect(errorPanel).toHaveClass('error');
    });

    it('should show error when purpose exceeds character limit', async () => {
        const setServerError = jest.fn();
        renderWithContext(
            <ChannelSettingsInfoTab
                {...baseProps}
                setServerError={setServerError}
            />,
        );

        // Create a string that exceeds the allowed character limit
        const longPurpose = 'a'.repeat(1025);
        const purposeInput = screen.getByTestId('channel_settings_purpose_textbox');
        await userEvent.clear(purposeInput);
        await userEvent.type(purposeInput, longPurpose);

        // Expect that setServerError was called.
        expect(setServerError).toHaveBeenCalledWith('The text entered exceeds the character limit. The channel purpose is limited to 250 characters.');
    });

    it('should show error when header exceeds character limit', async () => {
        const setServerError = jest.fn();
        renderWithContext(
            <ChannelSettingsInfoTab
                {...baseProps}
                setServerError={setServerError}
            />,
        );

        // Create a string that exceeds the header character limit.
        const longHeader = 'a'.repeat(1025);
        const headerInput = screen.getByTestId('channel_settings_header_textbox');
        await userEvent.clear(headerInput);
        await userEvent.type(headerInput, longHeader);

        // Expect that setServerError was called.
        expect(setServerError).toHaveBeenCalled();
    });
});
