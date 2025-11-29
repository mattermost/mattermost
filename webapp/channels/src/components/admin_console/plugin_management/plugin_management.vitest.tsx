// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import PluginState from 'mattermost-redux/constants/plugins';

import {renderWithContext, waitFor} from 'tests/vitest_react_testing_utils';

import PluginManagement from './plugin_management';

// Mock console.error to suppress intl missing message warnings in tests
/* eslint-disable no-console */
const originalConsoleError = console.error;
beforeAll(() => {
    console.error = (...args: unknown[]) => {
        const message = args[0]?.toString() || '';
        if (message.includes('MISSING_TRANSLATION') || message.includes('Missing message:')) {
            return;
        }
        originalConsoleError.apply(console, args);
    };
});

afterAll(() => {
    console.error = originalConsoleError;
});
/* eslint-enable no-console */

describe('components/admin_console/plugin_management', () => {
    const defaultProps = {
        config: {
            PluginSettings: {
                Enable: true,
                EnableUploads: true,
                AllowInsecureDownloadURL: false,
                EnableMarketplace: true,
                EnableRemoteMarketplace: true,
                AutomaticPrepackagedPlugins: true,
                MarketplaceURL: 'marketplace.example.com',
                RequirePluginSignature: false,
            },
            ExperimentalSettings: {
                RestrictSystemAdmin: false,
            },
        },
        pluginStatuses: {
            plugin_0: {
                id: 'plugin_0',
                version: '0.1.0',
                state: PluginState.PLUGIN_STATE_NOT_RUNNING,
                name: 'Plugin 0',
                description: 'The plugin 0.',
                active: false,
                instances: [
                    {
                        cluster_id: 'cluster_id_1',
                        state: PluginState.PLUGIN_STATE_NOT_RUNNING,
                        version: '0.1.0',
                    },
                ],
            },
        },
        plugins: {
            plugin_0: {
                active: false,
                description: 'The plugin 0.',
                id: 'plugin_0',
                name: 'Plugin 0',
                version: '0.1.0',
                settings_schema: {
                    footer: 'This is a footer',
                    header: 'This is a header',
                    settings: [],
                },
                webapp: {},
            },
        },
        appsFeatureFlagEnabled: false,
        actions: {
            uploadPlugin: vi.fn(),
            installPluginFromUrl: vi.fn(),
            removePlugin: vi.fn(),
            getPlugins: vi.fn().mockResolvedValue([]),
            getPluginStatuses: vi.fn().mockResolvedValue([]),
            enablePlugin: vi.fn(),
            disablePlugin: vi.fn(),
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the plugin management page', async () => {
        renderWithContext(<PluginManagement {...defaultProps}/>);

        // getPluginStatuses is called on mount when plugins are enabled
        await waitFor(() => {
            expect(defaultProps.actions.getPluginStatuses).toHaveBeenCalled();
        });

        expect(document.querySelector('.wrapper--fixed')).toBeInTheDocument();
    });

    it('renders with plugins disabled', async () => {
        const props = {
            ...defaultProps,
            config: {
                ...defaultProps.config,
                PluginSettings: {
                    ...defaultProps.config.PluginSettings,
                    Enable: false,
                },
            },
        };

        renderWithContext(<PluginManagement {...props}/>);

        // When plugins are disabled, getPluginStatuses is not called
        expect(document.querySelector('.wrapper--fixed')).toBeInTheDocument();
    });

    it('renders with RestrictSystemAdmin enabled', async () => {
        const props = {
            ...defaultProps,
            config: {
                ...defaultProps.config,
                ExperimentalSettings: {
                    RestrictSystemAdmin: true,
                },
            },
        };

        renderWithContext(<PluginManagement {...props}/>);

        await waitFor(() => {
            expect(defaultProps.actions.getPluginStatuses).toHaveBeenCalled();
        });

        expect(document.querySelector('.wrapper--fixed')).toBeInTheDocument();
    });

    it('renders with RequirePluginSignature enabled', async () => {
        const props = {
            ...defaultProps,
            config: {
                ...defaultProps.config,
                PluginSettings: {
                    ...defaultProps.config.PluginSettings,
                    RequirePluginSignature: true,
                },
            },
        };

        renderWithContext(<PluginManagement {...props}/>);

        await waitFor(() => {
            expect(defaultProps.actions.getPluginStatuses).toHaveBeenCalled();
        });

        expect(document.querySelector('.wrapper--fixed')).toBeInTheDocument();
    });

    it('renders with EnableMarketplace disabled', async () => {
        const props = {
            ...defaultProps,
            config: {
                ...defaultProps.config,
                PluginSettings: {
                    ...defaultProps.config.PluginSettings,
                    EnableMarketplace: false,
                },
            },
        };

        renderWithContext(<PluginManagement {...props}/>);

        await waitFor(() => {
            expect(defaultProps.actions.getPluginStatuses).toHaveBeenCalled();
        });

        expect(document.querySelector('.wrapper--fixed')).toBeInTheDocument();
    });

    it('renders with EnableUploads disabled', async () => {
        const props = {
            ...defaultProps,
            config: {
                ...defaultProps.config,
                PluginSettings: {
                    ...defaultProps.config.PluginSettings,
                    EnableUploads: false,
                },
            },
        };

        renderWithContext(<PluginManagement {...props}/>);

        await waitFor(() => {
            expect(defaultProps.actions.getPluginStatuses).toHaveBeenCalled();
        });

        expect(document.querySelector('.wrapper--fixed')).toBeInTheDocument();
    });

    it('calls getPluginStatuses on mount when plugins enabled', async () => {
        renderWithContext(<PluginManagement {...defaultProps}/>);

        await waitFor(() => {
            expect(defaultProps.actions.getPluginStatuses).toHaveBeenCalledTimes(1);
        });

        // getPlugins is not called on mount, only when uploading/installing plugins
        expect(defaultProps.actions.getPlugins).not.toHaveBeenCalled();
    });

    it('renders with no installed plugins', async () => {
        const props = {
            ...defaultProps,
            pluginStatuses: {},
            plugins: {},
        };

        renderWithContext(<PluginManagement {...props}/>);

        await waitFor(() => {
            expect(defaultProps.actions.getPluginStatuses).toHaveBeenCalled();
        });

        expect(document.querySelector('.wrapper--fixed')).toBeInTheDocument();
    });
});
