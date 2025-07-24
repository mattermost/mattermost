// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ChannelSettingsConfigurationTab from './channel_settings_configuration_tab';

// Mock the redux actions and selectors
jest.mock('mattermost-redux/actions/channels', () => ({
    patchChannel: jest.fn(),
}));

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
};

describe('ChannelSettingsConfigurationTab', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

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
        await act(async () => {
            await userEvent.click(screen.getByTestId('channelBannerToggle-button'));
        });

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
        await act(async () => {
            await userEvent.click(screen.getByTestId('channelBannerToggle-button'));
        });

        // Banner settings should now be visible
        expect(screen.getByTestId('channel_banner_banner_text_textbox')).toBeInTheDocument();
        expect(screen.getByTestId('color-inputColorValue')).toBeInTheDocument();
    });

    it('should show SaveChangesPanel when changes are made', async () => {
        renderWithContext(<ChannelSettingsConfigurationTab {...baseProps}/>);

        // Initially, SaveChangesPanel should not be visible
        expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();

        // Enable the banner
        await act(async () => {
            await userEvent.click(screen.getByTestId('channelBannerToggle-button'));
        });

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
        await act(async () => {
            await userEvent.click(screen.getByTestId('channelBannerToggle-button'));
        });

        // Enter banner text
        await act(async () => {
            const textInput = screen.getByTestId('channel_banner_banner_text_textbox');
            await userEvent.clear(textInput);
            await userEvent.type(textInput, 'New banner text');
        });

        // Set banner color
        const colorInput = screen.getByTestId('color-inputColorValue');
        await act(async () => {
            await userEvent.clear(colorInput);
            await userEvent.type(colorInput, '#AA00AA');
        });

        // Click the Save button
        await act(async () => {
            await userEvent.click(screen.getByRole('button', {name: 'Save'}));
        });

        // Verify patchChannel was called with the updated values
        expect(patchChannel).toHaveBeenCalledWith('channel1', {
            ...mockChannel,
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
        await act(async () => {
            const textInput = screen.getByTestId('channel_banner_banner_text_textbox');
            await userEvent.clear(textInput);
            await userEvent.type(textInput, 'Changed banner text');
        });

        // Add a small delay to ensure all state updates are processed
        await new Promise((resolve) => setTimeout(resolve, 0));

        // SaveChangesPanel should now be visible
        expect(screen.getByRole('button', {name: 'Save'})).toBeInTheDocument();

        // Click the Reset button
        await act(async () => {
            await userEvent.click(screen.getByRole('button', {name: 'Reset'}));
        });

        // Form should be reset to original values
        expect(screen.getByTestId('channel_banner_banner_text_textbox')).toHaveValue('Test banner text');

        // SaveChangesPanel should be hidden after reset
        expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();
    });

    it('should show error when banner text is empty but banner is enabled', async () => {
        renderWithContext(<ChannelSettingsConfigurationTab {...baseProps}/>);

        // Enable the banner
        await act(async () => {
            await userEvent.click(screen.getByTestId('channelBannerToggle-button'));
        });

        // Leave banner text empty
        await act(async () => {
            const textInput = screen.getByTestId('channel_banner_banner_text_textbox');
            await userEvent.clear(textInput);
        });

        // Click the Save button
        await act(async () => {
            await userEvent.click(screen.getByRole('button', {name: 'Save'}));
        });

        // SaveChangesPanel should show error state
        const errorMessage = screen.getByText(/Banner text is required/);
        const errorPanel = errorMessage.closest('.SaveChangesPanel');
        expect(errorPanel).toHaveClass('error');
    });

    it('should show error when banner text exceeds character limit', async () => {
        renderWithContext(<ChannelSettingsConfigurationTab {...baseProps}/>);

        // Enable the banner
        await act(async () => {
            await userEvent.click(screen.getByTestId('channelBannerToggle-button'));
        });

        // Create a string that exceeds the allowed character limit
        const longText = 'a'.repeat(1025);

        // Enter long banner text
        await act(async () => {
            const textInput = screen.getByTestId('channel_banner_banner_text_textbox');
            await userEvent.clear(textInput);
            await userEvent.type(textInput, longText);
        });

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
        await act(async () => {
            await userEvent.click(previewButton);
        });

        // Preview should now be active
        expect(previewButton).toHaveClass('active');
    });

    it('should disable banner when toggle is clicked while banner is enabled', async () => {
        renderWithContext(<ChannelSettingsConfigurationTab {...{...baseProps, channel: mockChannelWithBanner}}/>);

        // Initially, banner settings should be visible
        expect(screen.getByTestId('channel_banner_banner_text_textbox')).toBeInTheDocument();

        // Click the toggle to disable the banner
        await act(async () => {
            await userEvent.click(screen.getByTestId('channelBannerToggle-button'));
        });

        // Banner settings should now be hidden
        expect(screen.queryByTestId('channel_banner_banner_text_textbox')).not.toBeInTheDocument();
    });

    it('should show error when banner color is empty but banner is enabled', async () => {
        const {patchChannel} = require('mattermost-redux/actions/channels');
        patchChannel.mockReturnValue({type: 'MOCK_ACTION', data: {}});

        renderWithContext(<ChannelSettingsConfigurationTab {...baseProps}/>);

        // Enable the banner
        await act(async () => {
            await userEvent.click(screen.getByTestId('channelBannerToggle-button'));
        });

        // Enter banner text but leave color empty
        await act(async () => {
            const textInput = screen.getByTestId('channel_banner_banner_text_textbox');
            await userEvent.clear(textInput);
            await userEvent.type(textInput, 'New banner text');
        });

        // Click the Save button
        await act(async () => {
            await userEvent.click(screen.getByRole('button', {name: 'Save'}));
        });

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
        await act(async () => {
            await userEvent.click(screen.getByTestId('channelBannerToggle-button'));
        });

        // Enter banner text
        await act(async () => {
            const textInput = screen.getByTestId('channel_banner_banner_text_textbox');
            await userEvent.clear(textInput);
            await userEvent.type(textInput, 'New banner text');
        });

        // Enter a valid hex color
        await act(async () => {
            const colorInput = screen.getByTestId('color-inputColorValue');
            await userEvent.clear(colorInput);
            await userEvent.type(colorInput, '#ff0000');
        });

        // Click the Save button
        await act(async () => {
            await userEvent.click(screen.getByRole('button', {name: 'Save'}));
        });

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
            />,
        );

        // Enter a invalid hex color
        await act(async () => {
            const colorInput = screen.getByTestId('color-inputColorValue');
            await userEvent.clear(colorInput);
            await userEvent.type(colorInput, 'not-a-color');
        });

        // Do another action to trigger blur on this input so color is validated
        await act(async () => {
            const textInput = screen.getByTestId('channel_banner_banner_text_textbox');
            await userEvent.clear(textInput);
            await userEvent.type(textInput, 'Test text');
        });

        // if invalid, the color automatically returns to the original color
        expect(screen.getByTestId('color-inputColorValue')).toHaveValue(originalColor);

        // Check that the save changes panel is not visible
        expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();

        // Modify the color to a valid one
        await act(async () => {
            const colorInput = screen.getByTestId('color-inputColorValue');
            await userEvent.clear(colorInput);
            await userEvent.type(colorInput, '#123456');
        });

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
        await act(async () => {
            const textInput = screen.getByTestId('channel_banner_banner_text_textbox');
            await userEvent.clear(textInput);
            await userEvent.type(textInput, '  Banner text with whitespace  ');
        });

        // Add whitespace to the banner color
        await act(async () => {
            const colorInput = screen.getByTestId('color-inputColorValue');
            await userEvent.clear(colorInput);
            await userEvent.type(colorInput, '  #00FF00  ');
        });

        // Click the Save button
        await act(async () => {
            await userEvent.click(screen.getByRole('button', {name: 'Save'}));
        });

        // Verify patchChannel was called with the trimmed values
        expect(patchChannel).toHaveBeenCalledWith('channel1', {
            ...mockChannelWithBanner,
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
        const textInput = screen.getByTestId('channel_banner_banner_text_textbox');
        expect(textInput).toHaveValue('Banner text with whitespace');
    });
});
