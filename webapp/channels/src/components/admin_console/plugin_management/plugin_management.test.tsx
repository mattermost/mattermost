// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {act} from 'react-dom/test-utils';

import PluginState from 'mattermost-redux/constants/plugins';

import {PluginManagement} from 'components/admin_console/plugin_management/plugin_management';

import {defaultIntl} from 'tests/helpers/intl-test-helper';
import {renderWithContext} from 'tests/react_testing_utils';

describe('components/PluginManagement', () => {
    const defaultProps = {
        intl: defaultIntl,
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
        const {container} = renderWithContext(<PluginManagement {...props}/>);
        expect(container).toMatchSnapshot();
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
        const {container} = renderWithContext(<PluginManagement {...props}/>);
        expect(container).toMatchSnapshot();
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
        const {container} = renderWithContext(<PluginManagement {...props}/>);
        expect(container).toMatchSnapshot();
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
        const {container} = renderWithContext(<PluginManagement {...props}/>);
        expect(container).toMatchSnapshot();
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
        const {container} = renderWithContext(<PluginManagement {...props}/>);
        expect(container).toMatchSnapshot();
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
        const {container} = renderWithContext(<PluginManagement {...props}/>);
        expect(container).toMatchSnapshot();
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
        const {container} = renderWithContext(<PluginManagement {...props}/>);
        expect(container).toMatchSnapshot();
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
        const {container} = renderWithContext(<PluginManagement {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, text entered into the URL install text box', () => {
        const props = defaultProps;

        const ref = React.createRef<InstanceType<typeof PluginManagement>>();
        const {container} = renderWithContext(
            <PluginManagement
                {...props}
                ref={ref}
            />,
        );
        act(() => {
            ref.current!.setState({pluginDownloadUrl: 'https://pluginsite.com/plugin.tar.gz'} as any);
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, No installed plugins', () => {
        const props = {
            ...defaultProps,
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
                uploadPlugin: jest.fn(),
                installPluginFromUrl: jest.fn(),
                removePlugin: jest.fn(),
                getPlugins: jest.fn().mockResolvedValue([]),
                getPluginStatuses: jest.fn().mockResolvedValue([]),
                enablePlugin: jest.fn(),
                disablePlugin: jest.fn(),
            },
        };
        const ref = React.createRef<InstanceType<typeof PluginManagement>>();
        const {container} = renderWithContext(
            <PluginManagement
                {...props}
                ref={ref}
            />,
        );
        act(() => {
            ref.current!.setState({loading: false} as any);
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, with installed plugins', () => {
        const ref = React.createRef<InstanceType<typeof PluginManagement>>();
        const {container} = renderWithContext(
            <PluginManagement
                {...defaultProps}
                ref={ref}
            />,
        );
        act(() => {
            ref.current!.setState({loading: false} as any);
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, with installed plugins and not settings link should set hasSettings to false', () => {
        const props = {
            ...defaultProps,
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
                uploadPlugin: jest.fn(),
                installPluginFromUrl: jest.fn(),
                removePlugin: jest.fn(),
                getPlugins: jest.fn().mockResolvedValue([]),
                getPluginStatuses: jest.fn().mockResolvedValue([]),
                enablePlugin: jest.fn(),
                disablePlugin: jest.fn(),
            },
        };
        const ref = React.createRef<InstanceType<typeof PluginManagement>>();
        const {container} = renderWithContext(
            <PluginManagement
                {...props}
                ref={ref}
            />,
        );
        act(() => {
            ref.current!.setState({loading: false} as any);
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, with installed plugins and just header should set hasSettings to true', () => {
        const props = {
            ...defaultProps,
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
                uploadPlugin: jest.fn(),
                installPluginFromUrl: jest.fn(),
                removePlugin: jest.fn(),
                getPlugins: jest.fn().mockResolvedValue([]),
                getPluginStatuses: jest.fn().mockResolvedValue([]),
                enablePlugin: jest.fn(),
                disablePlugin: jest.fn(),
            },
        };
        const ref = React.createRef<InstanceType<typeof PluginManagement>>();
        const {container} = renderWithContext(
            <PluginManagement
                {...props}
                ref={ref}
            />,
        );
        act(() => {
            ref.current!.setState({loading: false} as any);
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, with installed plugins and just footer should set hasSettings to true', () => {
        const props = {
            ...defaultProps,
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
        const ref = React.createRef<InstanceType<typeof PluginManagement>>();
        const {container} = renderWithContext(
            <PluginManagement
                {...props}
                ref={ref}
            />,
        );
        act(() => {
            ref.current!.setState({loading: false} as any);
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, with installed plugins and just settings should set hasSettings to true', () => {
        const props = {
            ...defaultProps,
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
                uploadPlugin: jest.fn(),
                installPluginFromUrl: jest.fn(),
                removePlugin: jest.fn(),
                getPlugins: jest.fn().mockResolvedValue([]),
                getPluginStatuses: jest.fn().mockResolvedValue([]),
                enablePlugin: jest.fn(),
                disablePlugin: jest.fn(),
            },
        };
        const ref = React.createRef<InstanceType<typeof PluginManagement>>();
        const {container} = renderWithContext(
            <PluginManagement
                {...props}
                ref={ref}
            />,
        );
        act(() => {
            ref.current!.setState({loading: false} as any);
        });
        expect(container).toMatchSnapshot();
    });

    describe('helpSubmitUpload', () => {
        const file = new File(['test'], 'plugin.tar.gz');
        let scrollIntoView: jest.Mock;

        beforeEach(() => {
            jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
                cb(0);
                return 0;
            });

            scrollIntoView = jest.fn();
            Element.prototype.scrollIntoView = scrollIntoView;
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        const renderComponent = (uploadPlugin: jest.Mock) => {
            const props = {
                ...defaultProps,
                actions: {
                    ...defaultProps.actions,
                    uploadPlugin,
                },
            };
            const ref = React.createRef<InstanceType<typeof PluginManagement>>();
            renderWithContext(
                <PluginManagement
                    {...props}
                    ref={ref}
                />,
            );
            act(() => {
                ref.current!.setState({loading: false} as any);
            });
            return ref;
        };

        test('waits for cluster deployment and scrolls to the plugin on success', async () => {
            const uploadPlugin = jest.fn().mockResolvedValue({
                data: {manifest: {id: 'plugin_0'}, deployedToAllNodes: true},
            });
            const ref = renderComponent(uploadPlugin);

            await act(async () => {
                await ref.current!.helpSubmitUpload(file, false);
            });

            expect(uploadPlugin).toHaveBeenCalledWith(file, false, true);
            expect(ref.current!.state.lastMessage).toBe('Successfully uploaded plugin from plugin.tar.gz');
            expect(ref.current!.state.serverError).toBeNull();
            expect(scrollIntoView).toHaveBeenCalledTimes(1);
            expect((scrollIntoView.mock.instances[0] as HTMLElement).getAttribute('data-testid')).toBe('plugin_0');
        });

        test('shows an error but still scrolls to the plugin when cluster deployment times out', async () => {
            const uploadPlugin = jest.fn().mockResolvedValue({
                data: {manifest: {id: 'plugin_0'}, deployedToAllNodes: false},
            });
            const ref = renderComponent(uploadPlugin);

            await act(async () => {
                await ref.current!.helpSubmitUpload(file, false);
            });

            expect(uploadPlugin).toHaveBeenCalledWith(file, false, true);
            expect(ref.current!.state.lastMessage).toBeNull();
            expect(ref.current!.state.serverError).toContain('wasn\'t confirmed within 30 seconds');
            expect(scrollIntoView).toHaveBeenCalledTimes(1);
            expect((scrollIntoView.mock.instances[0] as HTMLElement).getAttribute('data-testid')).toBe('plugin_0');
        });

        test('does not scroll when the upload fails', async () => {
            const uploadPlugin = jest.fn().mockResolvedValue({
                error: {server_error_id: 'some.error', message: 'upload failed'},
            });
            const ref = renderComponent(uploadPlugin);

            await act(async () => {
                await ref.current!.helpSubmitUpload(file, false);
            });

            expect(ref.current!.state.serverError).toBe('upload failed');
            expect(scrollIntoView).not.toHaveBeenCalled();
        });
    });
});
