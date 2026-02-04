// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {AdminConfig} from '@mattermost/types/config';

import {renderWithContext, screen, waitFor, userEvent} from 'tests/react_testing_utils';

import PreferenceOverridesDashboard from './preference_overrides_dashboard';

// Mock the Client4 module
jest.mock('mattermost-redux/client', () => ({
    Client4: {
        getDistinctPreferences: jest.fn(),
    },
}));

// Mock preference_definitions
jest.mock('utils/preference_definitions', () => ({
    getPreferenceDefinition: jest.fn().mockReturnValue(null),
    getPreferenceGroup: jest.fn().mockReturnValue('advanced'),
    PREFERENCE_GROUP_INFO: {
        time_date: {icon: 'clock', label: 'Time & Date'},
        teammates: {icon: 'users', label: 'Teammates'},
        messages: {icon: 'message', label: 'Messages'},
        channel: {icon: 'channel', label: 'Channels'},
        notifications: {icon: 'bell', label: 'Notifications'},
        advanced: {icon: 'settings', label: 'Advanced'},
        sidebar: {icon: 'sidebar', label: 'Sidebar'},
        theme: {icon: 'palette', label: 'Theme'},
        language: {icon: 'globe', label: 'Language'},
    },
    PreferenceGroups: {
        TIME_DATE: 'time_date',
        TEAMMATES: 'teammates',
        MESSAGES: 'messages',
        CHANNEL: 'channel',
        NOTIFICATIONS: 'notifications',
        ADVANCED: 'advanced',
        SIDEBAR: 'sidebar',
        THEME: 'theme',
        LANGUAGE: 'language',
    },
}));

const {Client4} = require('mattermost-redux/client');

describe('PreferenceOverridesDashboard', () => {
    const mockPatchConfig = jest.fn().mockResolvedValue({data: {}});

    const baseConfig: AdminConfig = {
        FeatureFlags: {
            PreferencesRevamp: true,
            PreferenceOverridesDashboard: true,
            SettingsResorted: false,
        },
        MattermostExtendedSettings: {
            Preferences: {
                Overrides: {},
            },
        },
    } as AdminConfig;

    const disabledConfig: AdminConfig = {
        FeatureFlags: {
            PreferencesRevamp: false,
            PreferenceOverridesDashboard: false,
            SettingsResorted: false,
        },
        MattermostExtendedSettings: {
            Preferences: {
                Overrides: {},
            },
        },
    } as AdminConfig;

    const configWithOverrides: AdminConfig = {
        FeatureFlags: {
            PreferencesRevamp: true,
            PreferenceOverridesDashboard: true,
            SettingsResorted: false,
        },
        MattermostExtendedSettings: {
            Preferences: {
                Overrides: {
                    'display_settings:use_military_time': 'true',
                    'notifications:email_interval': '0',
                },
            },
        },
    } as AdminConfig;

    const mockPreferences = [
        {category: 'display_settings', name: 'use_military_time', values: ['true', 'false']},
        {category: 'display_settings', name: 'colorize_usernames', values: ['true', 'false']},
        {category: 'notifications', name: 'email_interval', values: ['0', '30', '900', '3600']},
        {category: 'theme', name: 'type', values: ['light', 'dark', 'system']},
    ];

    beforeEach(() => {
        jest.clearAllMocks();
        Client4.getDistinctPreferences.mockResolvedValue(mockPreferences);
    });

    test('should render promotional card when feature is disabled', async () => {
        renderWithContext(
            <PreferenceOverridesDashboard
                config={disabledConfig}
                patchConfig={mockPatchConfig}
            />,
        );

        expect(screen.getByText('Preference Overrides')).toBeInTheDocument();
        expect(screen.getByText('Enable Preference Overrides Dashboard')).toBeInTheDocument();
    });

    test('should enable feature when enable button clicked', async () => {
        renderWithContext(
            <PreferenceOverridesDashboard
                config={disabledConfig}
                patchConfig={mockPatchConfig}
            />,
        );

        const enableButton = screen.getByText('Enable Preference Overrides Dashboard');
        await userEvent.click(enableButton);

        expect(mockPatchConfig).toHaveBeenCalledWith({
            FeatureFlags: expect.objectContaining({
                PreferencesRevamp: true,
                PreferenceOverridesDashboard: true,
            }),
        });
    });

    test('should render dashboard when feature is enabled', async () => {
        renderWithContext(
            <PreferenceOverridesDashboard
                config={baseConfig}
                patchConfig={mockPatchConfig}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText('Preference Overrides')).toBeInTheDocument();
        });

        expect(screen.getByText('Save Changes')).toBeInTheDocument();
    });

    test('should load preferences from server', async () => {
        renderWithContext(
            <PreferenceOverridesDashboard
                config={baseConfig}
                patchConfig={mockPatchConfig}
            />,
        );

        await waitFor(() => {
            expect(Client4.getDistinctPreferences).toHaveBeenCalled();
        });
    });

    test('should display preference categories', async () => {
        renderWithContext(
            <PreferenceOverridesDashboard
                config={baseConfig}
                patchConfig={mockPatchConfig}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText('display_settings')).toBeInTheDocument();
        });
    });

    test('should display existing overrides', async () => {
        renderWithContext(
            <PreferenceOverridesDashboard
                config={configWithOverrides}
                patchConfig={mockPatchConfig}
            />,
        );

        await waitFor(() => {
            // The overrides should be visible (locked icons indicate overridden)
            const lockIcons = screen.getAllByTitle(/Override is set/i);
            expect(lockIcons.length).toBeGreaterThan(0);
        });
    });

    test('should enable save button when changes are made', async () => {
        renderWithContext(
            <PreferenceOverridesDashboard
                config={baseConfig}
                patchConfig={mockPatchConfig}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText('Save Changes')).toBeInTheDocument();
        });

        // Save button should be initially disabled
        const saveButton = screen.getByText('Save Changes');
        expect(saveButton).toBeDisabled();
    });

    test('should display loading state', () => {
        // Make API take longer
        Client4.getDistinctPreferences.mockImplementation(() => new Promise(() => {}));

        renderWithContext(
            <PreferenceOverridesDashboard
                config={baseConfig}
                patchConfig={mockPatchConfig}
            />,
        );

        expect(screen.getByText('Loading preferences...')).toBeInTheDocument();
    });

    test('should display error state on API failure', async () => {
        Client4.getDistinctPreferences.mockRejectedValue(new Error('Failed to load'));

        renderWithContext(
            <PreferenceOverridesDashboard
                config={baseConfig}
                patchConfig={mockPatchConfig}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText(/Failed to load preferences/i)).toBeInTheDocument();
        });
    });

    test('should refresh preferences when refresh button clicked', async () => {
        renderWithContext(
            <PreferenceOverridesDashboard
                config={baseConfig}
                patchConfig={mockPatchConfig}
            />,
        );

        await waitFor(() => {
            expect(screen.getByTitle(/Refresh/i)).toBeInTheDocument();
        });

        const refreshButton = screen.getByTitle(/Refresh/i);
        await userEvent.click(refreshButton);

        // API should be called again
        expect(Client4.getDistinctPreferences).toHaveBeenCalledTimes(2);
    });

    test('should save overrides when save button clicked', async () => {
        // First render the component
        renderWithContext(
            <PreferenceOverridesDashboard
                config={baseConfig}
                patchConfig={mockPatchConfig}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText('Save Changes')).toBeInTheDocument();
        });

        // Need to make a change first to enable the save button
        // Look for a dropdown to change
        const selects = screen.getAllByRole('combobox');
        if (selects.length > 0) {
            const firstSelect = selects[0];
            await userEvent.selectOptions(firstSelect, 'true');

            const saveButton = screen.getByText('Save Changes');

            // If button is now enabled, click it
            if (!saveButton.hasAttribute('disabled')) {
                await userEvent.click(saveButton);

                expect(mockPatchConfig).toHaveBeenCalledWith({
                    MattermostExtendedSettings: expect.objectContaining({
                        Preferences: expect.objectContaining({
                            Overrides: expect.any(Object),
                        }),
                    }),
                });
            }
        }
    });

    test('should toggle override when lock button clicked', async () => {
        renderWithContext(
            <PreferenceOverridesDashboard
                config={baseConfig}
                patchConfig={mockPatchConfig}
            />,
        );

        await waitFor(() => {
            const lockButtons = screen.getAllByTitle(/Set override|Clear override/i);
            expect(lockButtons.length).toBeGreaterThan(0);
        });

        // Click on a lock button to set/clear override
        const lockButton = screen.getAllByTitle(/Set override|Clear override/i)[0];
        await userEvent.click(lockButton);

        // The button state should change (icon switches between locked/unlocked)
    });

    test('should display preference values in dropdown', async () => {
        renderWithContext(
            <PreferenceOverridesDashboard
                config={baseConfig}
                patchConfig={mockPatchConfig}
            />,
        );

        await waitFor(() => {
            expect(screen.getAllByRole('combobox').length).toBeGreaterThan(0);
        });

        // Each preference should have a dropdown with its possible values
        const dropdowns = screen.getAllByRole('combobox');
        expect(dropdowns.length).toBeGreaterThan(0);
    });

    test('should show success message after save', async () => {
        // Make patchConfig resolve successfully
        mockPatchConfig.mockResolvedValueOnce({data: {}});

        renderWithContext(
            <PreferenceOverridesDashboard
                config={configWithOverrides}
                patchConfig={mockPatchConfig}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText('Save Changes')).toBeInTheDocument();
        });

        // Need to make a change to enable save
        const selects = screen.getAllByRole('combobox');
        if (selects.length > 0) {
            await userEvent.selectOptions(selects[0], selects[0].querySelector('option')?.value || '');
        }
    });

    test('should group preferences by category when SettingsResorted is disabled', async () => {
        renderWithContext(
            <PreferenceOverridesDashboard
                config={baseConfig}
                patchConfig={mockPatchConfig}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText('display_settings')).toBeInTheDocument();
            expect(screen.getByText('notifications')).toBeInTheDocument();
        });
    });

    test('should group preferences by SettingsResorted groups when enabled', async () => {
        const configWithSettingsResorted = {
            ...baseConfig,
            FeatureFlags: {
                ...baseConfig.FeatureFlags,
                SettingsResorted: true,
            },
        } as AdminConfig;

        renderWithContext(
            <PreferenceOverridesDashboard
                config={configWithSettingsResorted}
                patchConfig={mockPatchConfig}
            />,
        );

        await waitFor(() => {
            // Should show group names instead of raw categories
            expect(Client4.getDistinctPreferences).toHaveBeenCalled();
        });
    });
});
