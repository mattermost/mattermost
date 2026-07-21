// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {act} from 'react-dom/test-utils';

import PluginState from 'mattermost-redux/constants/plugins';

import {PluginManagement} from 'components/admin_console/plugin_management/plugin_management';

import {defaultIntl} from 'tests/helpers/intl-test-helper';
import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

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

    const makeConflictDetails = (versionDirection: string, existingVersion = '1.0.0', uploadedVersion = '2.0.0') => JSON.stringify({
        existing_manifest: {
            id: 'com.mattermost.test-plugin',
            name: 'Test Plugin',
            version: existingVersion,
        },
        uploaded_manifest: {
            id: 'com.mattermost.test-plugin',
            name: 'Test Plugin',
            version: uploadedVersion,
        },
        version_direction: versionDirection,
    });

    const renderWithUploadConflict = async (details: string) => {
        const uploadPlugin = jest.fn().mockResolvedValueOnce({
            error: {
                server_error_id: 'app.plugin.install_id.app_error',
                detailed_error: details,
                message: 'A plugin with this ID already exists.',
            },
        });
        const file = new File(['plugin'], 'plugin.tar.gz', {type: 'application/gzip'});
        const ref = React.createRef<InstanceType<typeof PluginManagement>>();

        renderWithContext(
            <PluginManagement
                {...defaultProps}
                ref={ref}
                actions={{
                    ...defaultProps.actions,
                    uploadPlugin,
                }}
            />,
        );

        act(() => {
            ref.current!.setState({file, fileSelected: true} as any);
        });
        await act(async () => {
            await ref.current!.helpSubmitUpload(file, false);
        });

        return {file, ref, uploadPlugin};
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

    test.each([
        ['upgrade', '1.0.0', '2.0.0', 'This upload appears to upgrade the existing plugin.'],
        ['same', '1.0.0', '1.0.0', 'This upload has the same version as the existing plugin. Overwriting will reinstall it.'],
        ['downgrade', '2.0.0', '1.0.0', 'This upload appears to downgrade the existing plugin. Downgrades can remove fixes or features.'],
        ['unknown', '1.0.0', 'not-semver', 'Review the uploaded plugin before overwriting the existing installation. The server could not compare these plugin versions.'],
    ])('should render overwrite review panel for %s uploads', async (direction, existingVersion, uploadedVersion, message) => {
        await renderWithUploadConflict(makeConflictDetails(direction, existingVersion, uploadedVersion));

        expect(screen.getByTestId('plugin-upload-overwrite-review')).toHaveClass(`PluginUploadOverwriteReview--${direction}`);
        expect(screen.getByText('Review plugin overwrite')).toBeInTheDocument();
        expect(screen.getByText(message)).toBeInTheDocument();
        expect(screen.getByText(`${existingVersion.startsWith('v') ? existingVersion : `v${existingVersion}`} → ${uploadedVersion.startsWith('v') ? uploadedVersion : `v${uploadedVersion}`}`)).toBeInTheDocument();
        expect(screen.getAllByText('com.mattermost.test-plugin')).toHaveLength(2);
    });

    test('should retry upload with force when overwrite is confirmed', async () => {
        const uploadPlugin = jest.fn().
            mockResolvedValueOnce({
                error: {
                    server_error_id: 'app.plugin.install_id.app_error',
                    detailed_error: makeConflictDetails('upgrade'),
                    message: 'A plugin with this ID already exists.',
                },
            }).
            mockResolvedValueOnce({data: {}});
        const getPlugins = jest.fn().mockResolvedValue([]);
        const file = new File(['plugin'], 'plugin.tar.gz', {type: 'application/gzip'});
        const ref = React.createRef<InstanceType<typeof PluginManagement>>();

        renderWithContext(
            <PluginManagement
                {...defaultProps}
                ref={ref}
                actions={{
                    ...defaultProps.actions,
                    getPlugins,
                    uploadPlugin,
                }}
            />,
        );

        act(() => {
            ref.current!.setState({file, fileSelected: true} as any);
        });
        await act(async () => {
            await ref.current!.helpSubmitUpload(file, false);
        });

        await userEvent.click(screen.getByRole('button', {name: 'Overwrite'}));

        await waitFor(() => expect(uploadPlugin).toHaveBeenLastCalledWith(file, true));
        await waitFor(() => expect(getPlugins).toHaveBeenCalled());
        expect(screen.queryByTestId('plugin-upload-overwrite-review')).not.toBeInTheDocument();
    });

    test('should clear overwrite review when upload overwrite is cancelled', async () => {
        const {uploadPlugin} = await renderWithUploadConflict(makeConflictDetails('downgrade', '2.0.0', '1.0.0'));

        await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

        expect(screen.queryByTestId('plugin-upload-overwrite-review')).not.toBeInTheDocument();
        expect(uploadPlugin).toHaveBeenCalledTimes(1);
    });
});
