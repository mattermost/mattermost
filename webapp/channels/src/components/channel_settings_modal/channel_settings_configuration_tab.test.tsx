// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ChannelSettingsConfigurationTab from './channel_settings_configuration_tab';

// Mock the redux actions and selectors
jest.mock('mattermost-redux/actions/channels', () => ({
    patchChannel: jest.fn(),
}));

jest.mock('mattermost-redux/actions/shared_channels', () => ({
    fetchChannelRemotes: jest.fn(() => ({type: 'MOCK_ACTION', data: []})),
}));

jest.mock('mattermost-redux/client', () => ({
    Client4: {
        sharedChannelRemoteInvite: jest.fn().mockResolvedValue({}),
        sharedChannelRemoteUninvite: jest.fn().mockResolvedValue({}),
        getRemoteClusters: jest.fn().mockResolvedValue([
            {remote_id: 'remote1', name: 'nebula', display_name: 'Nebula Networks'},
            {remote_id: 'remote2', name: 'cascade', display_name: 'Cascade Collaborative'},
        ]),
    },
}));

jest.mock('mattermost-redux/selectors/entities/shared_channels', () => {
    const emptyList: any[] = [];
    return {
        getRemotesForChannel: jest.fn(() => emptyList),
        getRemoteNamesForChannel: jest.fn(() => emptyList),
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

// Create a mock channel for testing
const mockChannel = TestHelper.getChannelMock({
    id: 'channel1',
    team_id: 'team1',
    display_name: 'Test Channel',
    name: 'test-channel',
    purpose: 'Testing purpose',
    header: 'Initial header',
    type: 'O',
    banner_info: {
        enabled: false,
        text: '',
        background_color: '',
    },
});

// Create a mock channel with banner enabled
const mockChannelWithBanner = TestHelper.getChannelMock({
    id: 'channel1',
    team_id: 'team1',
    display_name: 'Test Channel',
    name: 'test-channel',
    purpose: 'Testing purpose',
    header: 'Initial header',
    type: 'O',
    banner_info: {
        enabled: true,
        text: 'Test banner text',
        background_color: '#ff0000',
    },
});

const baseProps = {
    channel: mockChannel,
    setAreThereUnsavedChanges: jest.fn(),
    canManageBanner: true,
};

describe('ChannelSettingsConfigurationTab', () => {
    it('should render with the correct initial values when banner is disabled', () => {
        renderWithContext(<ChannelSettingsConfigurationTab {...baseProps}/>);

        // Check that the toggle is not enabled
        const toggle = screen.getByTestId('channelBannerToggle-button');
        expect(toggle).toBeInTheDocument();
        expect(toggle).not.toHaveClass('active');

        // Banner text and color inputs should not be visible when banner is disabled
        expect(screen.queryByTestId('channel_banner_banner_text_textbox')).not.toBeInTheDocument();
        expect(screen.queryByTestId('channel_banner_banner_background_color_picker')).not.toBeInTheDocument();
    });

    it('should render with the correct default values when banner is enabled', async () => {
        const channelWithNoColor = {...mockChannelWithBanner, banner_info: undefined};
        renderWithContext(<ChannelSettingsConfigurationTab {...{...baseProps, channel: channelWithNoColor}}/>);

        // Check that the toggle is enabled
        const toggle = screen.getByTestId('channelBannerToggle-button');
        expect(toggle).toBeInTheDocument();
        expect(toggle).not.toHaveClass('active');

        // Click the toggle to enable the banner
        await userEvent.click(screen.getByTestId('channelBannerToggle-button'));

        // Banner text and color inputs should be visible when banner is enabled
        expect(screen.getByTestId('channel_banner_banner_text_textbox')).toBeInTheDocument();
        expect(screen.getByTestId('channel_banner_banner_text_textbox')).toHaveValue('');

        // Check that the color picker has the correct value
        expect(screen.getByTestId('color-inputColorValue')).toBeInTheDocument();
        expect(screen.getByTestId('color-inputColorValue')).toHaveValue('#DDDDDD');
    });

    it('should render with the correct initial values when banner is enabled', () => {
        renderWithContext(<ChannelSettingsConfigurationTab {...{...baseProps, channel: mockChannelWithBanner}}/>);

        // Check that the toggle is enabled
        const toggle = screen.getByTestId('channelBannerToggle-button');
        expect(toggle).toBeInTheDocument();
        expect(toggle).toHaveClass('active');

        // Banner text and color inputs should be visible when banner is enabled
        expect(screen.getByTestId('channel_banner_banner_text_textbox')).toBeInTheDocument();
        expect(screen.getByTestId('channel_banner_banner_text_textbox')).toHaveValue('Test banner text');

        // Check that the color picker has the correct value
        expect(screen.getByTestId('color-inputColorValue')).toBeInTheDocument();
        expect(screen.getByTestId('color-inputColorValue')).toHaveValue('#ff0000');
    });

    it('should show banner settings when toggle is clicked', async () => {
        renderWithContext(<ChannelSettingsConfigurationTab {...baseProps}/>);

        // Initially, banner settings should not be visible
        expect(screen.queryByTestId('channel_banner_banner_text_textbox')).not.toBeInTheDocument();

        // Click the toggle to enable the banner
        await userEvent.click(screen.getByTestId('channelBannerToggle-button'));

        // Banner settings should now be visible
        expect(screen.getByTestId('channel_banner_banner_text_textbox')).toBeInTheDocument();
        expect(screen.getByTestId('color-inputColorValue')).toBeInTheDocument();
    });

    it('should show SaveChangesPanel when changes are made', async () => {
        renderWithContext(<ChannelSettingsConfigurationTab {...baseProps}/>);

        // Initially, SaveChangesPanel should not be visible
        expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();

        // Enable the banner
        await userEvent.click(screen.getByTestId('channelBannerToggle-button'));

        // Add a small delay to ensure all state updates are processed
        await new Promise((resolve) => setTimeout(resolve, 0));

        // SaveChangesPanel should now be visible
        expect(screen.getByRole('button', {name: 'Save'})).toBeInTheDocument();
    });

    it('should call patchChannel with updated values when Save is clicked', async () => {
        const {patchChannel} = require('mattermost-redux/actions/channels');
        patchChannel.mockReturnValue({type: 'MOCK_ACTION', data: {}});

        renderWithContext(<ChannelSettingsConfigurationTab {...baseProps}/>);

        // Enable the banner
        await userEvent.click(screen.getByTestId('channelBannerToggle-button'));

        // Enter banner text
        const textInput = screen.getByTestId('channel_banner_banner_text_textbox');
        await userEvent.clear(textInput);
        await userEvent.type(textInput, 'New banner text');

        // Set banner color
        const colorInput = screen.getByTestId('color-inputColorValue');
        await userEvent.clear(colorInput);
        await userEvent.type(colorInput, '#AA00AA');

        // Click the Save button
        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        // Verify patchChannel was called with the updated values
        expect(patchChannel).toHaveBeenCalledWith('channel1', {
            banner_info: {
                enabled: true,
                text: 'New banner text',
                background_color: expect.any(String), // The exact color might be hard to test due to the mock
            },
        });
    });

    it('should reset form when Reset button is clicked', async () => {
        renderWithContext(<ChannelSettingsConfigurationTab {...{...baseProps, channel: mockChannelWithBanner}}/>);

        // Change the banner text
        const textInput = screen.getByTestId('channel_banner_banner_text_textbox');
        await userEvent.clear(textInput);
        await userEvent.type(textInput, 'Changed banner text');

        // Add a small delay to ensure all state updates are processed
        await new Promise((resolve) => setTimeout(resolve, 0));

        // SaveChangesPanel should now be visible
        expect(screen.getByRole('button', {name: 'Save'})).toBeInTheDocument();

        // Click the Reset button
        await userEvent.click(screen.getByRole('button', {name: 'Reset'}));

        // Form should be reset to original values
        expect(screen.getByTestId('channel_banner_banner_text_textbox')).toHaveValue('Test banner text');

        // SaveChangesPanel should be hidden after reset
        expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();
    });

    it('should show error when banner text is empty but banner is enabled', async () => {
        renderWithContext(<ChannelSettingsConfigurationTab {...baseProps}/>);

        // Enable the banner
        await userEvent.click(screen.getByTestId('channelBannerToggle-button'));

        // Leave banner text empty
        const textInput = screen.getByTestId('channel_banner_banner_text_textbox');
        await userEvent.clear(textInput);

        // Click the Save button
        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        // SaveChangesPanel should show error state
        const errorMessage = screen.getByText(/Banner text is required/);
        const errorPanel = errorMessage.closest('.SaveChangesPanel');
        expect(errorPanel).toHaveClass('error');
    });

    it('should show error when banner text exceeds character limit', async () => {
        renderWithContext(<ChannelSettingsConfigurationTab {...baseProps}/>);

        // Enable the banner
        await userEvent.click(screen.getByTestId('channelBannerToggle-button'));

        // Create a string that exceeds the allowed character limit
        const longText = 'a'.repeat(1025);

        // Enter long banner text
        const textInput = screen.getByTestId('channel_banner_banner_text_textbox');
        await userEvent.clear(textInput);
        await userEvent.type(textInput, longText);

        // Add a small delay to ensure all state updates are processed
        await new Promise((resolve) => setTimeout(resolve, 0));

        // SaveChangesPanel should show error state
        const errorMessage = screen.getByText(/There are errors in the form above/);
        const errorPanel = errorMessage.closest('.SaveChangesPanel');
        expect(errorPanel).toHaveClass('error');
    });

    it('should toggle preview when preview button is clicked', async () => {
        renderWithContext(<ChannelSettingsConfigurationTab {...{...baseProps, channel: mockChannelWithBanner}}/>);

        // Initially, preview should not be active
        const previewButton = screen.getByTestId('mock-show-format');
        expect(previewButton).not.toHaveClass('active');

        // Click the preview button
        await userEvent.click(previewButton);

        // Preview should now be active
        expect(previewButton).toHaveClass('active');
    });

    it('should disable banner when toggle is clicked while banner is enabled', async () => {
        renderWithContext(<ChannelSettingsConfigurationTab {...{...baseProps, channel: mockChannelWithBanner}}/>);

        // Initially, banner settings should be visible
        expect(screen.getByTestId('channel_banner_banner_text_textbox')).toBeInTheDocument();

        // Click the toggle to disable the banner
        await userEvent.click(screen.getByTestId('channelBannerToggle-button'));

        // Banner settings should now be hidden
        expect(screen.queryByTestId('channel_banner_banner_text_textbox')).not.toBeInTheDocument();
    });

    it('should show error when banner color is empty but banner is enabled', async () => {
        const {patchChannel} = require('mattermost-redux/actions/channels');
        patchChannel.mockReturnValue({type: 'MOCK_ACTION', data: {}});

        renderWithContext(<ChannelSettingsConfigurationTab {...baseProps}/>);

        // Enable the banner
        await userEvent.click(screen.getByTestId('channelBannerToggle-button'));

        // Enter banner text but leave color empty
        const textInput = screen.getByTestId('channel_banner_banner_text_textbox');
        await userEvent.clear(textInput);
        await userEvent.type(textInput, 'New banner text');

        // Click the Save button
        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        // SaveChangesPanel should show error state
        const errorMessage = screen.getByText(/Banner color is required/);
        const errorPanel = errorMessage.closest('.SaveChangesPanel');
        expect(errorPanel).toHaveClass('error');
    });

    it('should save valid colors in hex format', async () => {
        const {patchChannel} = require('mattermost-redux/actions/channels');
        patchChannel.mockReturnValue({type: 'MOCK_ACTION', data: {}});

        renderWithContext(<ChannelSettingsConfigurationTab {...baseProps}/>);

        // Enable the banner
        await userEvent.click(screen.getByTestId('channelBannerToggle-button'));

        // Enter banner text
        const textInput = screen.getByTestId('channel_banner_banner_text_textbox');
        await userEvent.clear(textInput);
        await userEvent.type(textInput, 'New banner text');

        // Enter a valid hex color
        const colorInput = screen.getByTestId('color-inputColorValue');
        await userEvent.clear(colorInput);
        await userEvent.type(colorInput, '#ff0000');

        // Click the Save button
        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        // Verify patchChannel was called with the correct color
        expect(patchChannel).toHaveBeenCalledWith('channel1', expect.objectContaining({
            banner_info: expect.objectContaining({
                background_color: expect.stringMatching(/#[0-9a-f]{6}/i), // Match any hex color
            }),
        }));
    });

    it('only valid colors will make the save changes panel visible', async () => {
        const {patchChannel} = require('mattermost-redux/actions/channels');
        patchChannel.mockReturnValue({type: 'MOCK_ACTION', data: {}});
        patchChannel.mockClear(); // Clear any previous calls

        const originalColor = '#DDDDDD'; // Original color

        // Create a channel with an valid color
        const channelWithValidColor = {
            ...mockChannel,
            banner_info: {
                enabled: true,
                text: 'Test text',
                background_color: originalColor, // Valid color
            },
        };

        // Render with the invalid color channel
        renderWithContext(
            <ChannelSettingsConfigurationTab
                channel={channelWithValidColor}
                setAreThereUnsavedChanges={jest.fn()}
                canManageBanner={true}
            />,
        );

        // Enter a invalid hex color
        const colorInput = screen.getByTestId('color-inputColorValue');
        await userEvent.clear(colorInput);
        await userEvent.type(colorInput, 'not-a-color');

        // Do another action to trigger blur on this input so color is validated
        const textInput = screen.getByTestId('channel_banner_banner_text_textbox');
        await userEvent.clear(textInput);
        await userEvent.type(textInput, 'Test text');

        // if invalid, the color automatically returns to the original color
        expect(screen.getByTestId('color-inputColorValue')).toHaveValue(originalColor);

        // Check that the save changes panel is not visible
        expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();

        // Modify the color to a valid one
        await userEvent.clear(colorInput);
        await userEvent.type(colorInput, '#123456');

        // Add a small delay to ensure all state updates are processed
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Check that the save changes panel is visible
        expect(screen.getByRole('button', {name: 'Save'})).toBeInTheDocument();
    });

    it('should trim whitespace from banner text and color when saving', async () => {
        const {patchChannel} = require('mattermost-redux/actions/channels');
        patchChannel.mockReturnValue({type: 'MOCK_ACTION', data: {}});

        renderWithContext(<ChannelSettingsConfigurationTab {...{...baseProps, channel: mockChannelWithBanner}}/>);

        // Add whitespace to the banner text
        const textInput = screen.getByTestId('channel_banner_banner_text_textbox');
        await userEvent.clear(textInput);
        await userEvent.type(textInput, '  Banner text with whitespace  ');

        // Add whitespace to the banner color
        const colorInput = screen.getByTestId('color-inputColorValue');
        await userEvent.clear(colorInput);
        await userEvent.type(colorInput, '  #00FF00  ');

        // Click the Save button
        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        // Verify patchChannel was called with the trimmed values
        expect(patchChannel).toHaveBeenCalledWith('channel1', {
            banner_info: {
                enabled: true,
                text: 'Banner text with whitespace', // Whitespace should be trimmed
                background_color: expect.any(String), // The exact color might be normalized by the component
            },
        });

        // Verify that the local state is updated with trimmed values
        // Wait for the component to update after the save
        await new Promise((resolve) => setTimeout(resolve, 0));

        // The text input should now have the trimmed value
        expect(textInput).toHaveValue('Banner text with whitespace');
    });

    describe('Share channel with connected workspaces', () => {
        beforeEach(() => {
            const {getRemotesForChannel} = require('mattermost-redux/selectors/entities/shared_channels');
            getRemotesForChannel.mockReturnValue([]);
        });

        it('should render ShareChannelWithWorkspaces section when canManageSharedChannels is true', () => {
            renderWithContext(
                <ChannelSettingsConfigurationTab
                    {...baseProps}
                    canManageSharedChannels={true}
                />,
            );

            expect(screen.getByText('Share with connected workspaces')).toBeInTheDocument();
        });

        it('should not render ShareChannelWithWorkspaces section when canManageSharedChannels is false', () => {
            renderWithContext(
                <ChannelSettingsConfigurationTab
                    {...baseProps}
                    canManageSharedChannels={false}
                />,
            );

            expect(screen.queryByText('Share with connected workspaces')).not.toBeInTheDocument();
        });

        it('should show Add workspace button when toggle is enabled', async () => {
            renderWithContext(
                <ChannelSettingsConfigurationTab
                    {...baseProps}
                    canManageSharedChannels={true}
                />,
            );

            const toggle = screen.getByTestId('shareChannelWithWorkspacesToggle-button');
            await userEvent.click(toggle);

            expect(screen.getByText('Add workspace')).toBeInTheDocument();
        });

        it('when shared channel changes include only adding workspaces, save calls invite and fetchChannelRemotes', async () => {
            const {getRemotesForChannel} = require('mattermost-redux/selectors/entities/shared_channels');
            const {fetchChannelRemotes} = require('mattermost-redux/actions/shared_channels');
            const {Client4} = require('mattermost-redux/client');

            getRemotesForChannel.mockReturnValue([]);

            renderWithContext(
                <ChannelSettingsConfigurationTab
                    {...baseProps}
                    canManageSharedChannels={true}
                />,
            );

            const fetchCallsAfterMount = fetchChannelRemotes.mock.calls.length;

            await userEvent.click(screen.getByTestId('shareChannelWithWorkspacesToggle-button'));
            await userEvent.click(screen.getByRole('button', {name: /Add workspace/i}));

            await waitFor(() => {
                expect(screen.getByRole('menuitem', {name: 'Nebula Networks'})).toBeInTheDocument();
            });
            await userEvent.click(screen.getByRole('menuitem', {name: 'Nebula Networks'}));

            // Wait for the workspace to be added to the list after the menu close animation
            await waitFor(() => {
                expect(screen.getByRole('button', {name: /Remove Nebula Networks/i})).toBeInTheDocument();
            });

            await userEvent.click(screen.getByRole('button', {name: 'Save'}));

            expect(Client4.sharedChannelRemoteInvite).toHaveBeenCalledWith('remote1', 'channel1');
            expect(fetchChannelRemotes.mock.calls.length).toBe(fetchCallsAfterMount + 1);
            expect(fetchChannelRemotes).toHaveBeenLastCalledWith('channel1', true);
        });

        it('when shared channel changes include removing a connection, confirm modal is shown before save', async () => {
            const {getRemotesForChannel} = require('mattermost-redux/selectors/entities/shared_channels');
            const {Client4} = require('mattermost-redux/client');

            const initialRemotes = [
                {
                    remote_id: 'remote1',
                    name: 'nebula',
                    display_name: 'Nebula Networks',
                    create_at: 0,
                    delete_at: 0,
                    last_ping_at: Date.now(),
                    site_url: 'https://nebula.example.com',
                },
            ];
            getRemotesForChannel.mockReturnValue(initialRemotes);

            renderWithContext(
                <ChannelSettingsConfigurationTab
                    {...baseProps}
                    canManageSharedChannels={true}
                />,
            );

            const removeButton = await screen.findByRole('button', {name: /Remove Nebula Networks/i});
            await userEvent.click(removeButton);

            const saveButton = await screen.findByRole('button', {name: 'Save'});
            await userEvent.click(saveButton);

            await waitFor(() => {
                expect(screen.getByText(/Are you sure you want to unshare\?/)).toBeInTheDocument();
                expect(screen.getByText(/Yes, unshare/)).toBeInTheDocument();
                expect(Client4.sharedChannelRemoteUninvite).not.toHaveBeenCalled();
            });
        });

        it('when user confirms remove in modal, uninvite and fetchChannelRemotes are called', async () => {
            const {getRemotesForChannel} = require('mattermost-redux/selectors/entities/shared_channels');
            const {fetchChannelRemotes} = require('mattermost-redux/actions/shared_channels');
            const {Client4} = require('mattermost-redux/client');

            const initialRemotes = [
                {
                    remote_id: 'remote1',
                    name: 'nebula',
                    display_name: 'Nebula Networks',
                    create_at: 0,
                    delete_at: 0,
                    last_ping_at: Date.now(),
                    site_url: 'https://nebula.example.com',
                },
            ];
            getRemotesForChannel.mockReturnValue(initialRemotes);

            renderWithContext(
                <ChannelSettingsConfigurationTab
                    {...baseProps}
                    canManageSharedChannels={true}
                />,
            );

            const fetchCallsAfterMount = fetchChannelRemotes.mock.calls.length;

            const removeButton = await screen.findByRole('button', {name: /Remove Nebula Networks/i});
            await userEvent.click(removeButton);

            const saveButton = await screen.findByRole('button', {name: 'Save'});
            await userEvent.click(saveButton);

            await waitFor(() => {
                expect(screen.getByText(/Are you sure you want to unshare\?/)).toBeInTheDocument();
                expect(screen.getByText(/Yes, unshare/)).toBeInTheDocument();
            });
            await userEvent.click(screen.getByRole('button', {name: /Yes, unshare/}));

            expect(Client4.sharedChannelRemoteUninvite).toHaveBeenCalledWith('remote1', 'channel1');
            expect(fetchChannelRemotes.mock.calls.length).toBe(fetchCallsAfterMount + 1);
            expect(fetchChannelRemotes).toHaveBeenLastCalledWith('channel1', true);
        });

        it('when user cancels remove modal, uninvite is not called', async () => {
            const {getRemotesForChannel} = require('mattermost-redux/selectors/entities/shared_channels');
            const {Client4} = require('mattermost-redux/client');

            const initialRemotes = [
                {
                    remote_id: 'remote1',
                    name: 'nebula',
                    display_name: 'Nebula Networks',
                    create_at: 0,
                    delete_at: 0,
                    last_ping_at: Date.now(),
                    site_url: 'https://nebula.example.com',
                },
            ];
            getRemotesForChannel.mockReturnValue(initialRemotes);

            renderWithContext(
                <ChannelSettingsConfigurationTab
                    {...baseProps}
                    canManageSharedChannels={true}
                />,
            );

            const removeButton = await screen.findByRole('button', {name: /Remove Nebula Networks/i});
            await userEvent.click(removeButton);
            const saveButton = await screen.findByRole('button', {name: 'Save'});
            await userEvent.click(saveButton);
            const cancelButton = await screen.findByRole('button', {name: 'Cancel'});
            await userEvent.click(cancelButton);

            expect(Client4.sharedChannelRemoteUninvite).not.toHaveBeenCalled();
        });

        it('when one invite fails, handleServerError is called and fetchChannelRemotes is still called', async () => {
            const {getRemotesForChannel} = require('mattermost-redux/selectors/entities/shared_channels');
            const {fetchChannelRemotes} = require('mattermost-redux/actions/shared_channels');
            const {Client4} = require('mattermost-redux/client');

            getRemotesForChannel.mockReturnValue([]);
            Client4.sharedChannelRemoteInvite.mockRejectedValueOnce({message: 'Invite failed for workspace'});

            renderWithContext(
                <ChannelSettingsConfigurationTab
                    {...baseProps}
                    canManageSharedChannels={true}
                />,
            );

            const fetchCallsAfterMount = fetchChannelRemotes.mock.calls.length;

            await userEvent.click(screen.getByTestId('shareChannelWithWorkspacesToggle-button'));
            await userEvent.click(screen.getByRole('button', {name: /Add workspace/i}));
            await waitFor(() => {
                expect(screen.getByRole('menuitem', {name: 'Nebula Networks'})).toBeInTheDocument();
            });
            await userEvent.click(screen.getByRole('menuitem', {name: 'Nebula Networks'}));

            // Wait for the workspace to be added to the list after the menu close animation
            await waitFor(() => {
                expect(screen.getByRole('button', {name: /Remove Nebula Networks/i})).toBeInTheDocument();
            });

            await userEvent.click(screen.getByRole('button', {name: 'Save'}));

            await waitFor(() => {
                expect(fetchChannelRemotes.mock.calls.length).toBe(fetchCallsAfterMount + 1);
                expect(fetchChannelRemotes).toHaveBeenLastCalledWith('channel1', true);
            });
            expect(screen.getByText('Invite failed for workspace')).toBeInTheDocument();
        });

        it('when multiple invite/uninvite operations fail, shows sharing_errors message', async () => {
            const {getRemotesForChannel} = require('mattermost-redux/selectors/entities/shared_channels');
            const {Client4} = require('mattermost-redux/client');

            getRemotesForChannel.mockReturnValue([]);
            Client4.sharedChannelRemoteInvite.mockRejectedValue(new Error('Network error'));

            renderWithContext(
                <ChannelSettingsConfigurationTab
                    {...baseProps}
                    canManageSharedChannels={true}
                />,
            );

            await userEvent.click(screen.getByTestId('shareChannelWithWorkspacesToggle-button'));
            await userEvent.click(screen.getByRole('button', {name: /Add workspace/i}));
            await waitFor(() => {
                expect(screen.getByRole('menuitem', {name: 'Nebula Networks'})).toBeInTheDocument();
            });
            await userEvent.click(screen.getByRole('menuitem', {name: 'Nebula Networks'}));

            // Wait for Nebula Networks to be added to the list after the menu close animation
            await waitFor(() => {
                expect(screen.getByRole('button', {name: /Remove Nebula Networks/i})).toBeInTheDocument();
            });

            await userEvent.click(screen.getByRole('button', {name: /Add workspace/i}));
            await waitFor(() => {
                expect(screen.getByRole('menuitem', {name: 'Cascade Collaborative'})).toBeInTheDocument();
            });
            await userEvent.click(screen.getByRole('menuitem', {name: 'Cascade Collaborative'}));

            // Wait for Cascade Collaborative to be added to the list after the menu close animation
            await waitFor(() => {
                expect(screen.getByRole('button', {name: /Remove Cascade Collaborative/i})).toBeInTheDocument();
            });

            await userEvent.click(screen.getByRole('button', {name: 'Save'}));

            await waitFor(() => {
                expect(screen.getByText(/There has been errors while sharing the channel with some workspaces\. Please try again\./)).toBeInTheDocument();
            });
        });
    });
});
