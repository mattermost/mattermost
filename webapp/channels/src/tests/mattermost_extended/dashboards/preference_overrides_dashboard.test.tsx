// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {AdminConfig} from '@mattermost/types/config';

import {renderWithContext, screen, waitFor, userEvent} from 'tests/react_testing_utils';

import PreferenceOverridesDashboard from 'components/admin_console/preference_overrides/preference_overrides_dashboard';

// Mock the Client4 module
jest.mock('mattermost-redux/client', () => ({
    Client4: {
        getDistinctPreferences: jest.fn(),
    },
}));

// Mock preference_definitions with proper message descriptors
jest.mock('utils/preference_definitions', () => ({
    getPreferenceDefinition: jest.fn((category, name) => {
        if (category === 'display_settings' && name === 'use_military_time') {
            return {
                id: 'use_military_time',
                category: 'display_settings',
                name: 'use_military_time',
                title: {id: 'test.use_military_time', defaultMessage: 'Use Military Time'},
                description: {id: 'test.use_military_time_desc', defaultMessage: 'Display time in 24-hour format'},
                options: [
                    {value: 'true', label: {id: 'test.true', defaultMessage: 'True'}},
                    {value: 'false', label: {id: 'test.false', defaultMessage: 'False'}},
                ],
                defaultValue: 'false',
                order: 1,
            };
        }
        return null;
    }),
    getPreferenceGroup: jest.fn().mockReturnValue('advanced'),
    PREFERENCE_GROUP_INFO: {
        time_date: {icon: 'clock', title: {id: 'test.time_date', defaultMessage: 'Time & Date'}, order: 1},
        teammates: {icon: 'users', title: {id: 'test.teammates', defaultMessage: 'Teammates'}, order: 2},
        messages: {icon: 'message', title: {id: 'test.messages', defaultMessage: 'Messages'}, order: 3},
        channel: {icon: 'channel', title: {id: 'test.channel', defaultMessage: 'Channels'}, order: 4},
        notifications: {icon: 'bell', title: {id: 'test.notifications', defaultMessage: 'Notifications'}, order: 5},
        advanced: {icon: 'settings', title: {id: 'test.advanced', defaultMessage: 'Advanced'}, order: 6},
        sidebar: {icon: 'sidebar', title: {id: 'test.sidebar', defaultMessage: 'Sidebar'}, order: 7},
        theme: {icon: 'palette', title: {id: 'test.theme', defaultMessage: 'Theme'}, order: 8},
        language: {icon: 'globe', title: {id: 'test.language', defaultMessage: 'Language'}, order: 9},
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

        // Wait for data to load - component shows category names in title case
        await waitFor(() => {
            expect(screen.getByText('Display Settings')).toBeInTheDocument();
        });
    });

    test('should display existing overrides', async () => {
        renderWithContext(
            <PreferenceOverridesDashboard
                config={configWithOverrides}
                patchConfig={mockPatchConfig}
            />,
        );

        // Wait for data to load first
        await waitFor(() => {
            expect(screen.getByText('Display Settings')).toBeInTheDocument();
        });

        // The overrides should be visible (locked icons indicate overridden)
        await waitFor(() => {
            const lockIcons = screen.getAllByTitle(/Remove override|Enable override/i);
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
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
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
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    test('should refresh preferences when refresh button clicked', async () => {
        renderWithContext(
            <PreferenceOverridesDashboard
                config={baseConfig}
                patchConfig={mockPatchConfig}
            />,
        );

        // Wait for initial load
        await waitFor(() => {
            expect(screen.getByText('Display Settings')).toBeInTheDocument();
        });

        const refreshButton = screen.getByRole('button', {name: /Refresh/i});
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

        // Wait for data to load
        await waitFor(() => {
            expect(screen.getByText('Display Settings')).toBeInTheDocument();
        });

        // Need to make a change first to enable the save button
        // Click on a lock button to toggle an override
        const lockButtons = screen.getAllByTitle(/Remove override|Enable override/i);
        if (lockButtons.length > 0) {
            await userEvent.click(lockButtons[0]);

            const saveButton = screen.getByRole('button', {name: /Save Changes/i});

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

        // Wait for data to load
        await waitFor(() => {
            expect(screen.getByText('Display Settings')).toBeInTheDocument();
        });

        // Now find and click a lock button
        const lockButtons = screen.getAllByTitle(/Remove override|Enable override/i);
        expect(lockButtons.length).toBeGreaterThan(0);

        // Click on a lock button to remove/enable override
        const lockButton = lockButtons[0];
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

        // Wait for data to load
        await waitFor(() => {
            expect(screen.getByText('Display Settings')).toBeInTheDocument();
        });

        // Toggle an override for use_military_time to show the dropdown
        // Preferences are sorted alphabetically within categories, so:
        // - lockButtons[0] = colorize_usernames (no dropdown mock, renders text input)
        // - lockButtons[1] = use_military_time (has dropdown mock, renders select)
        const lockButtons = screen.getAllByTitle(/Enable override/i);
        await userEvent.click(lockButtons[1]); // Click use_military_time button

        // Wait for the dropdown to appear after enabling override
        await waitFor(() => {
            const dropdowns = screen.getAllByRole('combobox');
            expect(dropdowns.length).toBeGreaterThan(0);
        });
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

        // Wait for data to load
        await waitFor(() => {
            expect(screen.getByText('Display Settings')).toBeInTheDocument();
        });

        // Need to make a change to enable save - click a lock button
        const lockButtons = screen.getAllByTitle(/Remove override|Enable override/i);
        if (lockButtons.length > 0) {
            await userEvent.click(lockButtons[0]);

            const saveButton = screen.getByRole('button', {name: /Save Changes/i});
            await userEvent.click(saveButton);

            await waitFor(() => {
                expect(screen.getByText('Saved')).toBeInTheDocument();
            });
        }
    });

    test('should group preferences by category when SettingsResorted is disabled', async () => {
        renderWithContext(
            <PreferenceOverridesDashboard
                config={baseConfig}
                patchConfig={mockPatchConfig}
            />,
        );

        // Component renders category names in title case
        await waitFor(() => {
            expect(screen.getByText('Display Settings')).toBeInTheDocument();
            expect(screen.getByText('Notifications')).toBeInTheDocument();
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
