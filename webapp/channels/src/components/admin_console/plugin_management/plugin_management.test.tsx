// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import PluginState from 'mattermost-redux/constants/plugins';

import PluginManagement from 'components/admin_console/plugin_management/plugin_management';

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
        streamlinedMarketplaceFlagEnabled: false,
        actions: {
            uploadPlugin: jest.fn(),
            installPluginFromUrl: jest.fn(),
            removePlugin: jest.fn(),
            getPlugins: jest.fn().mockResolvedValue([]),
            getPluginStatuses: jest.fn().mockResolvedValue([]),
            enablePlugin: jest.fn(),
            disablePlugin: jest.fn(),
        },
    };

    test('should match snapshot', () => {
        const props = {...defaultProps};
        const wrapper = shallow(<PluginManagement {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, disabled', () => {
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
        const wrapper = shallow(<PluginManagement {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when `Enable Plugins` is hidden', () => {
        const props = {
            ...defaultProps,
            config: {
                ...defaultProps.config,
                ExperimentalSettings: {
                    RestrictSystemAdmin: true,
                },
            },
        };
        const wrapper = shallow(<PluginManagement {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when `Require Signature Plugin` is true', () => {
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
        const wrapper = shallow(<PluginManagement {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when `Enable Marketplace` is false', () => {
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
        const wrapper = shallow(<PluginManagement {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when `Enable Remote Marketplace` is false', () => {
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
        const wrapper = shallow(<PluginManagement {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, upload disabled', () => {
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
        const wrapper = shallow(<PluginManagement {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, allow insecure URL enabled', () => {
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
        const wrapper = shallow(<PluginManagement {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, text entered into the URL install text box', () => {
        const props = defaultProps;

        const wrapper = shallow(<PluginManagement {...props}/>);
        wrapper.setState({pluginDownloadUrl: 'https://pluginsite.com/plugin.tar.gz'});
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, No installed plugins', () => {
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
            streamlinedMarketplaceFlagEnabled: false,
            actions: {
                uploadPlugin: jest.fn(),
                installPluginFromUrl: jest.fn(),
                removePlugin: jest.fn(),
                getPlugins: jest.fn().mockResolvedValue([]),
                getPluginStatuses: jest.fn().mockResolvedValue([]),
                enablePlugin: jest.fn(),
                disablePlugin: jest.fn(),
            },
        };
        const wrapper = shallow(<PluginManagement {...props}/>);
        wrapper.setState({loading: false});
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, with installed plugins', () => {
        const wrapper = shallow(<PluginManagement {...defaultProps}/>);
        wrapper.setState({loading: false});
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, with installed plugins and not settings link should set hasSettings to false', () => {
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
            streamlinedMarketplaceFlagEnabled: false,
            actions: {
                uploadPlugin: jest.fn(),
                installPluginFromUrl: jest.fn(),
                removePlugin: jest.fn(),
                getPlugins: jest.fn().mockResolvedValue([]),
                getPluginStatuses: jest.fn().mockResolvedValue([]),
                enablePlugin: jest.fn(),
                disablePlugin: jest.fn(),
            },
        };
        const wrapper = shallow(<PluginManagement {...props}/>);
        wrapper.setState({loading: false});
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, with installed plugins and just header should set hasSettings to true', () => {
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
            streamlinedMarketplaceFlagEnabled: false,
            actions: {
                uploadPlugin: jest.fn(),
                installPluginFromUrl: jest.fn(),
                removePlugin: jest.fn(),
                getPlugins: jest.fn().mockResolvedValue([]),
                getPluginStatuses: jest.fn().mockResolvedValue([]),
                enablePlugin: jest.fn(),
                disablePlugin: jest.fn(),
            },
        };
        const wrapper = shallow(<PluginManagement {...props}/>);
        wrapper.setState({loading: false});
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, with installed plugins and just footer should set hasSettings to true', () => {
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
                uploadPlugin: jest.fn(),
                installPluginFromUrl: jest.fn(),
                removePlugin: jest.fn(),
                getPlugins: jest.fn().mockResolvedValue([]),
                getPluginStatuses: jest.fn().mockResolvedValue([]),
                enablePlugin: jest.fn(),
                disablePlugin: jest.fn(),
            },
        };
        const wrapper = shallow(<PluginManagement {...props}/>);
        wrapper.setState({loading: false});
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, with installed plugins and just settings should set hasSettings to true', () => {
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
            streamlinedMarketplaceFlagEnabled: false,
            actions: {
                uploadPlugin: jest.fn(),
                installPluginFromUrl: jest.fn(),
                removePlugin: jest.fn(),
                getPlugins: jest.fn().mockResolvedValue([]),
                getPluginStatuses: jest.fn().mockResolvedValue([]),
                enablePlugin: jest.fn(),
                disablePlugin: jest.fn(),
            },
        };
        const wrapper = shallow(<PluginManagement {...props}/>);
        wrapper.setState({loading: false});
        expect(wrapper).toMatchSnapshot();
    });
});
