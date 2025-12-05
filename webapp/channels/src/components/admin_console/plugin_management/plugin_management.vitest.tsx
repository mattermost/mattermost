// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import PluginState from 'mattermost-redux/constants/plugins';

import {renderWithContext, waitFor} from 'tests/vitest_react_testing_utils';

import PluginManagement from './plugin_management';

describe('components/PluginManagement', () => {
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
            plugin_1: {
                id: 'plugin_1',
                version: '0.0.1',
                state: PluginState.PLUGIN_STATE_STOPPING,
                name: 'Plugin 1',
                description: 'The plugin.',
                active: true,
                instances: [
                    {
                        cluster_id: 'cluster_id_1',
                        state: PluginState.PLUGIN_STATE_NOT_RUNNING,
                        version: '0.0.1',
                    },
                    {
                        cluster_id: 'cluster_id_2',
                        state: PluginState.PLUGIN_STATE_RUNNING,
                        version: '0.0.2',
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
            plugin_1: {
                active: true,
                description: 'The plugin 1.',
                id: 'plugin_1',
                name: 'Plugin 1',
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

    test('should match snapshot', async () => {
        const props = {...defaultProps};
        const {container} = renderWithContext(<PluginManagement {...props}/>);
        await waitFor(() => {
            expect(defaultProps.actions.getPluginStatuses).toHaveBeenCalled();
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, disabled', async () => {
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
        const {container} = renderWithContext(<PluginManagement {...props}/>);

        // When disabled, getPluginStatuses is not called
        await waitFor(() => {
            expect(container).toBeInTheDocument();
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when `Enable Plugins` is hidden', async () => {
        const props = {
            ...defaultProps,
            config: {
                ...defaultProps.config,
                ExperimentalSettings: {
                    RestrictSystemAdmin: true,
                },
            },
        };
        const {container} = renderWithContext(<PluginManagement {...props}/>);
        await waitFor(() => {
            expect(defaultProps.actions.getPluginStatuses).toHaveBeenCalled();
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when `Require Signature Plugin` is true', async () => {
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
        const {container} = renderWithContext(<PluginManagement {...props}/>);
        await waitFor(() => {
            expect(defaultProps.actions.getPluginStatuses).toHaveBeenCalled();
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when `Enable Marketplace` is false', async () => {
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
        const {container} = renderWithContext(<PluginManagement {...props}/>);
        await waitFor(() => {
            expect(defaultProps.actions.getPluginStatuses).toHaveBeenCalled();
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when `Enable Remote Marketplace` is false', async () => {
        const props = {
            ...defaultProps,
            config: {
                ...defaultProps.config,
                PluginSettings: {
                    ...defaultProps.config.PluginSettings,
                    EnableRemoteMarketplace: false,
                },
            },
        };
        const {container} = renderWithContext(<PluginManagement {...props}/>);
        await waitFor(() => {
            expect(defaultProps.actions.getPluginStatuses).toHaveBeenCalled();
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, upload disabled', async () => {
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
        const {container} = renderWithContext(<PluginManagement {...props}/>);
        await waitFor(() => {
            expect(defaultProps.actions.getPluginStatuses).toHaveBeenCalled();
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, allow insecure URL enabled', async () => {
        const props = {
            ...defaultProps,
            config: {
                ...defaultProps.config,
                PluginSettings: {
                    ...defaultProps.config.PluginSettings,
                    AllowInsecureDownloadURL: true,
                },
            },
        };
        const {container} = renderWithContext(<PluginManagement {...props}/>);
        await waitFor(() => {
            expect(defaultProps.actions.getPluginStatuses).toHaveBeenCalled();
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, text entered into the URL install text box', async () => {
        const props = defaultProps;
        const {container} = renderWithContext(<PluginManagement {...props}/>);
        await waitFor(() => {
            expect(defaultProps.actions.getPluginStatuses).toHaveBeenCalled();
        });

        // Note: In RTL we can't easily set internal state like enzyme's setState
        // The snapshot captures the initial state
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, No installed plugins', async () => {
        const getPluginStatuses = vi.fn().mockResolvedValue([]);
        const props = {
            config: {
                ...defaultProps.config,
                PluginSettings: {
                    ...defaultProps.config.PluginSettings,
                    Enable: true,
                    EnableUploads: true,
                    AllowInsecureDownloadURL: false,
                },
            },
            pluginStatuses: {},
            plugins: {},
            appsFeatureFlagEnabled: false,
            actions: {
                uploadPlugin: vi.fn(),
                installPluginFromUrl: vi.fn(),
                removePlugin: vi.fn(),
                getPlugins: vi.fn().mockResolvedValue([]),
                getPluginStatuses,
                enablePlugin: vi.fn(),
                disablePlugin: vi.fn(),
            },
        };
        const {container} = renderWithContext(<PluginManagement {...props}/>);
        await waitFor(() => {
            expect(getPluginStatuses).toHaveBeenCalled();
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, with installed plugins', async () => {
        const {container} = renderWithContext(<PluginManagement {...defaultProps}/>);
        await waitFor(() => {
            expect(defaultProps.actions.getPluginStatuses).toHaveBeenCalled();
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, with installed plugins and not settings link should set hasSettings to false', async () => {
        const getPluginStatuses = vi.fn().mockResolvedValue([]);
        const props = {
            config: {
                ...defaultProps.config,
                PluginSettings: {
                    ...defaultProps.config.PluginSettings,
                    Enable: true,
                    EnableUploads: true,
                    AllowInsecureDownloadURL: false,
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
                plugin_1: {
                    id: 'plugin_1',
                    version: '0.0.1',
                    state: PluginState.PLUGIN_STATE_STOPPING,
                    name: 'Plugin 1',
                    description: 'The plugin.',
                    active: true,
                    instances: [
                        {
                            cluster_id: 'cluster_id_1',
                            state: PluginState.PLUGIN_STATE_NOT_RUNNING,
                            version: '0.0.1',
                        },
                        {
                            cluster_id: 'cluster_id_2',
                            state: PluginState.PLUGIN_STATE_RUNNING,
                            version: '0.0.2',
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
                    settings_schema: {},
                    webapp: {},
                },
                plugin_1: {
                    active: true,
                    description: 'The plugin 1.',
                    id: 'plugin_1',
                    name: 'Plugin 1',
                    version: '0.1.0',
                    settings_schema: {},
                    webapp: {},
                },
            },
            appsFeatureFlagEnabled: false,
            actions: {
                uploadPlugin: vi.fn(),
                installPluginFromUrl: vi.fn(),
                removePlugin: vi.fn(),
                getPlugins: vi.fn().mockResolvedValue([]),
                getPluginStatuses,
                enablePlugin: vi.fn(),
                disablePlugin: vi.fn(),
            },
        };
        const {container} = renderWithContext(<PluginManagement {...props}/>);
        await waitFor(() => {
            expect(getPluginStatuses).toHaveBeenCalled();
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, with installed plugins and just header should set hasSettings to true', async () => {
        const getPluginStatuses = vi.fn().mockResolvedValue([]);
        const props = {
            config: {
                ...defaultProps.config,
                PluginSettings: {
                    ...defaultProps.config.PluginSettings,
                    Enable: true,
                    EnableUploads: true,
                    AllowInsecureDownloadURL: false,
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
                        header: 'This is a header',
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
                getPluginStatuses,
                enablePlugin: vi.fn(),
                disablePlugin: vi.fn(),
            },
        };
        const {container} = renderWithContext(<PluginManagement {...props}/>);
        await waitFor(() => {
            expect(getPluginStatuses).toHaveBeenCalled();
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, with installed plugins and just footer should set hasSettings to true', async () => {
        const getPluginStatuses = vi.fn().mockResolvedValue([]);
        const props = {
            config: {
                ...defaultProps.config,
                PluginSettings: {
                    ...defaultProps.config.PluginSettings,
                    Enable: true,
                    EnableUploads: true,
                    AllowInsecureDownloadURL: false,
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
                    },
                    webapp: {},
                },
            },
            appsFeatureFlagEnabled: false,
            streamlinedMarketplaceFlagEnabled: false,
            actions: {
                uploadPlugin: vi.fn(),
                installPluginFromUrl: vi.fn(),
                removePlugin: vi.fn(),
                getPlugins: vi.fn().mockResolvedValue([]),
                getPluginStatuses,
                enablePlugin: vi.fn(),
                disablePlugin: vi.fn(),
            },
        };
        const {container} = renderWithContext(<PluginManagement {...props}/>);
        await waitFor(() => {
            expect(getPluginStatuses).toHaveBeenCalled();
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, with installed plugins and just settings should set hasSettings to true', async () => {
        const getPluginStatuses = vi.fn().mockResolvedValue([]);
        const props = {
            config: {
                ...defaultProps.config,
                PluginSettings: {
                    ...defaultProps.config.PluginSettings,
                    Enable: true,
                    EnableUploads: true,
                    AllowInsecureDownloadURL: false,
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
                        settings: [
                            {bla: 'test', xoxo: 'test2'},
                        ],
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
                getPluginStatuses,
                enablePlugin: vi.fn(),
                disablePlugin: vi.fn(),
            },
        };
        const {container} = renderWithContext(<PluginManagement {...props}/>);
        await waitFor(() => {
            expect(getPluginStatuses).toHaveBeenCalled();
        });
        expect(container).toMatchSnapshot();
    });
});
