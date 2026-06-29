// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {MockStoreEnhanced} from 'redux-mock-store';

import {PropertyTypes} from 'mattermost-redux/action_types';

import useChannelClassificationBanner from 'components/common/hooks/useChannelClassificationBanner';
import useClassificationMarkings from 'components/common/hooks/useClassificationMarkings';

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
        getPropertyValues: jest.fn().mockResolvedValue([]),
        patchPropertyValues: jest.fn().mockResolvedValue([]),
    },
}));

jest.mock('mattermost-redux/selectors/entities/shared_channels', () => {
    const emptyList: any[] = [];
    return {
        getRemotesForChannel: jest.fn(() => emptyList),
        getRemoteNamesForChannel: jest.fn(() => emptyList),
    };
});

let mockManageChannelRolesPermission = false;
jest.mock('mattermost-redux/selectors/entities/roles', () => ({
    haveIChannelPermission: jest.fn().mockImplementation((_state, _teamId, _channelId, permission) => {
        if (permission === 'manage_channel_roles') {
            return mockManageChannelRolesPermission;
        }
        return false;
    }),
}));

jest.mock('components/common/hooks/useChannelClassificationBanner');
jest.mock('components/common/hooks/useClassificationMarkings');

const mockedUseClassificationMarkings = useClassificationMarkings as jest.MockedFunction<typeof useClassificationMarkings>;
const mockedUseChannelClassificationBanner = useChannelClassificationBanner as jest.MockedFunction<typeof useChannelClassificationBanner>;

// Default classification state: feature unavailable. Individual tests can override.
beforeEach(() => {
    mockManageChannelRolesPermission = false;
    mockedUseClassificationMarkings.mockReturnValue({
        available: false,
        loading: false,
        channelField: null,
        levels: [],
    });
    mockedUseChannelClassificationBanner.mockReturnValue({
        hasClassification: false,
        classificationBanner: undefined,
        classificationId: undefined,
        bannerText: undefined,
    });
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

    describe('Classification', () => {
        beforeEach(() => {
            mockManageChannelRolesPermission = true;
        });

        const TEMPLATE_FIELD_ID = 'template_field_1';
        const CHANNEL_FIELD_ID = 'channel_field_1';
        const LEVEL_UNCLASSIFIED = {id: 'lvl_unclass', name: 'UNCLASSIFIED', color: '#007A33', rank: 1};
        const LEVEL_SECRET = {id: 'lvl_secret', name: 'SECRET', color: '#C8102E', rank: 2};

        const channelField = {
            id: CHANNEL_FIELD_ID,
            group_id: 'access_control',
            name: 'classification',
            type: 'select' as const,
            attrs: {options: [LEVEL_UNCLASSIFIED, LEVEL_SECRET]},
            target_id: '',
            target_type: 'system',
            object_type: 'channel',
            linked_field_id: TEMPLATE_FIELD_ID,
            create_at: 1,
            update_at: 1,
            delete_at: 0,
            created_by: 'u1',
            updated_by: 'u1',
        };

        function enableClassification(initialBanner: {hasClassification: boolean; classificationId?: string; bannerText?: string} = {hasClassification: false}) {
            mockedUseClassificationMarkings.mockReturnValue({
                available: true,
                loading: false,
                channelField,
                levels: [LEVEL_UNCLASSIFIED, LEVEL_SECRET],
            });
            mockedUseChannelClassificationBanner.mockReturnValue({
                hasClassification: initialBanner.hasClassification,
                classificationBanner: initialBanner.hasClassification ? {
                    enabled: true,
                    text: initialBanner.bannerText || '',
                    background_color: '#007A33',
                } : undefined,
                classificationId: initialBanner.classificationId,
                bannerText: initialBanner.bannerText,
            });
        }

        it('renders the Classification section when feature is available', () => {
            enableClassification();
            renderWithContext(
                <ChannelSettingsConfigurationTab
                    {...baseProps}
                    canManageSharedChannels={true}
                />,
            );

            expect(screen.getByText('Classification')).toBeInTheDocument();
            expect(screen.getByTestId('channelClassificationToggle-button')).toBeInTheDocument();
        });

        it('does not render the Classification section when feature is unavailable', () => {
            renderWithContext(<ChannelSettingsConfigurationTab {...baseProps}/>);

            expect(screen.queryByText('Classification')).not.toBeInTheDocument();
        });

        it('does not render the Classification section for users without manage_channel_roles', () => {
            mockManageChannelRolesPermission = false;
            enableClassification();
            renderWithContext(
                <ChannelSettingsConfigurationTab
                    {...baseProps}
                    canManageSharedChannels={true}
                />,
            );

            expect(screen.queryByText('Classification')).not.toBeInTheDocument();
        });

        it('auto-selects the lowest-rank level when classification is toggled on', async () => {
            const {Client4} = require('mattermost-redux/client');
            const {patchChannel} = require('mattermost-redux/actions/channels');
            patchChannel.mockReturnValue({type: 'MOCK_ACTION', data: {}});
            Client4.patchPropertyValues.mockClear();
            enableClassification();

            renderWithContext(
                <ChannelSettingsConfigurationTab
                    {...baseProps}
                    canManageSharedChannels={true}
                />,
            );

            await userEvent.click(screen.getByTestId('channelClassificationToggle-button'));

            // The lowest-rank level (UNCLASSIFIED) should be auto-selected in the dropdown.
            const dropdown = screen.getByTestId('channelClassificationLevel');
            expect(dropdown).toHaveTextContent(LEVEL_UNCLASSIFIED.name);

            // Save button should be enabled since a level is pre-selected.
            const saveButton = await screen.findByRole('button', {name: 'Save'});
            expect(saveButton).toBeEnabled();
        });

        it('saves banner_info via patchChannel when banner text is edited while classification is active', async () => {
            const {patchChannel} = require('mattermost-redux/actions/channels');
            patchChannel.mockReturnValue({type: 'MOCK_ACTION', data: {}});

            enableClassification({
                hasClassification: true,
                classificationId: LEVEL_UNCLASSIFIED.id,
                bannerText: `**${LEVEL_UNCLASSIFIED.name}**`,
            });

            renderWithContext(
                <ChannelSettingsConfigurationTab
                    {...baseProps}
                    canManageSharedChannels={true}
                />,
            );

            const textInput = await screen.findByTestId('channel_banner_banner_text_textbox');
            await userEvent.clear(textInput);
            await userEvent.type(textInput, 'Updated text');

            const saveButton = await screen.findByRole('button', {name: 'Save'});
            await userEvent.click(saveButton);

            // banner_info.enabled stays at whatever the user set manually (false
            // in this mock channel); the classification banner renders off the
            // property value, not banner_info.enabled, so clearing the
            // classification later makes the banner disappear.
            await waitFor(() => {
                expect(patchChannel).toHaveBeenCalledWith(
                    'channel1',
                    expect.objectContaining({
                        banner_info: expect.objectContaining({
                            enabled: false,
                            text: 'Updated text',
                        }),
                    }),
                );
            });
        });

        it('does not call patchPropertyValues when classification enabled/id has not changed', async () => {
            const {Client4} = require('mattermost-redux/client');
            const {patchChannel} = require('mattermost-redux/actions/channels');
            patchChannel.mockReturnValue({type: 'MOCK_ACTION', data: {}});

            enableClassification({
                hasClassification: true,
                classificationId: LEVEL_UNCLASSIFIED.id,
                bannerText: `**${LEVEL_UNCLASSIFIED.name}**`,
            });

            renderWithContext(
                <ChannelSettingsConfigurationTab
                    {...baseProps}
                    canManageSharedChannels={true}
                />,
            );

            // Edit only the banner text without changing the classification toggle or level.
            const textInput = await screen.findByTestId('channel_banner_banner_text_textbox');
            await userEvent.clear(textInput);
            await userEvent.type(textInput, 'Edited banner');

            const saveButton = await screen.findByRole('button', {name: 'Save'});
            await userEvent.click(saveButton);

            // patchChannel should be called (banner text changed), but patchPropertyValues
            // should NOT be called because classification enabled/id are unchanged.
            await waitFor(() => {
                expect(patchChannel).toHaveBeenCalled();
            });

            expect(Client4.patchPropertyValues).not.toHaveBeenCalled();
        });

        it('removes classification by patching value to null and dispatching PROPERTY_VALUE_DELETED', async () => {
            const {Client4} = require('mattermost-redux/client');
            Client4.patchPropertyValues.mockResolvedValueOnce([]);
            enableClassification({
                hasClassification: true,
                classificationId: LEVEL_UNCLASSIFIED.id,
                bannerText: `**${LEVEL_UNCLASSIFIED.name}**`,
            });

            const {store} = renderWithContext(
                <ChannelSettingsConfigurationTab
                    {...baseProps}
                    canManageSharedChannels={true}
                />,
                {},
                {useMockedStore: true},
            );

            // Toggle classification off (it starts on because of `hasClassification: true`).
            await userEvent.click(screen.getByTestId('channelClassificationToggle-button'));

            const saveButton = await screen.findByRole('button', {name: 'Save'});
            await userEvent.click(saveButton);

            await waitFor(() => {
                expect(Client4.patchPropertyValues).toHaveBeenCalledWith(
                    'access_control',
                    'channel',
                    'channel1',
                    [{field_id: CHANNEL_FIELD_ID, value: null}],
                );
            });

            await waitFor(() => {
                const actions = (store as unknown as MockStoreEnhanced).getActions();
                expect(actions.some((a) => a.type === PropertyTypes.PROPERTY_VALUE_DELETED)).toBe(true);
            });
        });

        it('preserves a saved regular banner color and shows Save when classification is re-enabled', async () => {
            const {Client4} = require('mattermost-redux/client');
            const {patchChannel} = require('mattermost-redux/actions/channels');
            patchChannel.mockReturnValue({type: 'MOCK_ACTION', data: {}});
            Client4.patchPropertyValues.mockResolvedValueOnce([]);
            enableClassification({
                hasClassification: true,
                classificationId: LEVEL_UNCLASSIFIED.id,
                bannerText: `**${LEVEL_UNCLASSIFIED.name}**`,
            });

            const classifiedChannel = TestHelper.getChannelMock({
                ...mockChannel,
                banner_info: {
                    enabled: true,
                    text: `**${LEVEL_UNCLASSIFIED.name}**`,
                    background_color: LEVEL_UNCLASSIFIED.color,
                },
            });
            const savedRegularBannerChannel = TestHelper.getChannelMock({
                ...mockChannel,
                banner_info: {
                    enabled: true,
                    text: `**${LEVEL_UNCLASSIFIED.name}**`,
                    background_color: '#aa00aa',
                },
            });

            const {rerender} = renderWithContext(
                <ChannelSettingsConfigurationTab
                    {...baseProps}
                    channel={classifiedChannel}
                    canManageSharedChannels={true}
                />,
                {},
                {useMockedStore: true},
            );

            await userEvent.click(screen.getByTestId('channelClassificationToggle-button'));

            const colorInput = screen.getByTestId('color-inputColorValue');
            await userEvent.clear(colorInput);
            await userEvent.type(colorInput, '#AA00AA');

            const saveButton = await screen.findByRole('button', {name: 'Save'});
            await userEvent.click(saveButton);

            await waitFor(() => {
                expect(patchChannel).toHaveBeenCalledWith(
                    'channel1',
                    expect.objectContaining({
                        banner_info: expect.objectContaining({
                            enabled: true,
                            background_color: '#aa00aa',
                        }),
                    }),
                );
            });
            expect(Client4.patchPropertyValues).toHaveBeenCalledWith(
                'access_control',
                'channel',
                'channel1',
                [{field_id: CHANNEL_FIELD_ID, value: null}],
            );

            mockedUseChannelClassificationBanner.mockReturnValue({
                hasClassification: false,
                classificationBanner: undefined,
                classificationId: undefined,
                bannerText: undefined,
            });
            rerender(
                <ChannelSettingsConfigurationTab
                    {...baseProps}
                    channel={savedRegularBannerChannel}
                    canManageSharedChannels={true}
                />,
            );

            await waitFor(() => {
                expect(screen.getByTestId('color-inputColorValue')).toHaveValue('#aa00aa');
            });
            expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();

            await userEvent.click(screen.getByTestId('channelClassificationToggle-button'));

            await waitFor(() => {
                expect(screen.getByRole('button', {name: 'Save'})).toBeEnabled();
            });
        });

        it('resets classification form to initial state when Reset is clicked', async () => {
            enableClassification({
                hasClassification: true,
                classificationId: LEVEL_UNCLASSIFIED.id,
                bannerText: `**${LEVEL_UNCLASSIFIED.name}**`,
            });
            const classifiedChannel = TestHelper.getChannelMock({
                ...mockChannel,
                banner_info: {
                    enabled: true,
                    text: `**${LEVEL_UNCLASSIFIED.name}**`,
                    background_color: LEVEL_UNCLASSIFIED.color,
                },
            });

            renderWithContext(
                <ChannelSettingsConfigurationTab
                    {...baseProps}
                    channel={classifiedChannel}
                    canManageSharedChannels={true}
                />,
            );

            // Toggle off → triggers changes → Save panel appears with Reset.
            const toggle = screen.getByTestId('channelClassificationToggle-button');
            await userEvent.click(toggle);

            const resetButton = await screen.findByRole('button', {name: 'Reset'});
            await userEvent.click(resetButton);

            // After reset, the Save/Reset panel should be gone and the toggle re-enabled.
            await waitFor(() => {
                expect(screen.queryByRole('button', {name: 'Reset'})).not.toBeInTheDocument();
            });
            expect(toggle).toHaveClass('active');
        });

        it('shows an error in the SaveChangesPanel when patchPropertyValues rejects', async () => {
            const {Client4} = require('mattermost-redux/client');
            const {patchChannel} = require('mattermost-redux/actions/channels');
            patchChannel.mockReturnValue({type: 'MOCK_ACTION', data: {}});
            Client4.patchPropertyValues.mockRejectedValueOnce({message: 'Server boom'});

            // Start without classification, so toggling it on creates a classification change.
            enableClassification({hasClassification: false});

            renderWithContext(
                <ChannelSettingsConfigurationTab
                    {...baseProps}
                    canManageSharedChannels={true}
                />,
            );

            // Enable classification toggle — lowest-rank level is auto-selected.
            await userEvent.click(screen.getByTestId('channelClassificationToggle-button'));

            // Save button should be enabled (level auto-selected).
            const saveButton = await screen.findByRole('button', {name: 'Save'});
            expect(saveButton).toBeEnabled();

            // Click save to trigger the patchPropertyValues rejection.
            await userEvent.click(saveButton);

            await waitFor(() => {
                expect(screen.getByText(/Server boom/)).toBeInTheDocument();
            });
        });

        it('shows an error when patchPropertyValues rejects with pre-existing classification', async () => {
            const {Client4} = require('mattermost-redux/client');
            const {patchChannel} = require('mattermost-redux/actions/channels');
            patchChannel.mockReturnValue({type: 'MOCK_ACTION', data: {}});
            Client4.patchPropertyValues.mockRejectedValueOnce({message: 'Server boom'});

            // Start classified → toggle off → toggle back on triggers hasClassificationChanges.
            enableClassification({
                hasClassification: true,
                classificationId: LEVEL_UNCLASSIFIED.id,
                bannerText: `**${LEVEL_UNCLASSIFIED.name}**`,
            });

            renderWithContext(
                <ChannelSettingsConfigurationTab
                    {...baseProps}
                    canManageSharedChannels={true}
                />,
            );

            // Toggle off then on to create a classification state change.
            const toggle = screen.getByTestId('channelClassificationToggle-button');
            await userEvent.click(toggle);
            await userEvent.click(toggle);

            // Now toggle off again — this creates a "disable" change that calls patchPropertyValues(null).
            await userEvent.click(toggle);

            const saveButton = await screen.findByRole('button', {name: 'Save'});
            await userEvent.click(saveButton);

            await waitFor(() => {
                const errorPanel = screen.getByText(/Server boom/).closest('.SaveChangesPanel');
                expect(errorPanel).toHaveClass('error');
            });
        });
    });
});
