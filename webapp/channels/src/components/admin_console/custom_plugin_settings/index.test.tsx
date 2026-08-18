// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {match} from 'react-router-dom';

import type {CloudState} from '@mattermost/types/cloud';
import type {PluginSettings} from '@mattermost/types/config';

import PluginState from 'mattermost-redux/constants/plugins';

import CustomPluginSettings from 'components/admin_console/custom_plugin_settings';

import {screen, renderWithContext} from 'tests/react_testing_utils';

describe('custom plugin sections and settings', () => {
    const plugin = {
        id: 'testplugin',
        name: 'testplugin',
        description: '',
        version: '',
        active: true,
        webapp: {
            bundle_path: '/static/testplugin_bundle.js',
        },
        settings_schema: {
            header: 'This is the header',
            footer: 'This is the footer',
            settings: [],
            sections: [],
        },
    };

    const baseProps = {
        isDisabled: false,
        environmentConfig: {},
        setNavigationBlocked: jest.fn(),
        roles: {},
        cloud: {} as CloudState,
        license: {},
        editRole: jest.fn(),
        isCurrentUserSystemAdmin: false,
        enterpriseReady: false,
        match: {params: {plugin_id: 'testplugin'}} as match<{plugin_id: string}>,
        config: {
            PluginSettings: {
                Plugins: {
                    testplugin: {
                    },
                },
                PluginStates: {
                    testplugin: {
                        Enable: true,
                    },
                },
            } as unknown as PluginSettings,
        },
        consoleAccess: {
            read: {
                about: true,
                reporting: true,
                environment: true,
                site_configuration: true,
                authentication: true,
                plugins: true,
                integrations: true,
                compliance: true,
            },
            write: {
                about: true,
                reporting: true,
                environment: true,
                site_configuration: true,
                authentication: true,
                plugins: true,
                integrations: true,
                compliance: true,
            },
        },
    };

    const baseState = {
        entities: {
            admin: {
                plugins: {
                    testplugin: plugin,
                },
            },
        },
    };

    const expectPluginPageTitle = (pluginName: string, pluginId: string) => {
        expect(screen.getByTestId('admin-console-header')).toHaveTextContent(pluginName);
        expect(screen.getByTestId('plugin-metadata-id')).toHaveTextContent(pluginId);
        expect(document.querySelector('.PluginMetadataPanel__actionsPanel')).toContainElement(screen.getByTestId('plugin-metadata-id'));
        expect(screen.queryByTestId('plugin-metadata-name')).not.toBeInTheDocument();
    };

    const expectPluginActionsInMetadataPanel = () => {
        const wrapper = document.querySelector('.PluginMetadataPanel__actionsPanel');
        const toggleButton = screen.queryByRole('button', {name: 'Enable plugin'}) || screen.getByRole('button', {name: 'Disable plugin'});
        expect(wrapper).toContainElement(toggleButton);
        expect(wrapper).toContainElement(screen.getByRole('button', {name: 'Plugin actions'}));
    };

    it('empty sections and settings', () => {
        renderWithContext(
            <CustomPluginSettings
                {...baseProps}
                patchConfig={jest.fn()}
            />,
            {...baseState});

        expectPluginPageTitle('testplugin', 'testplugin');
        expect(screen.getByRole('button', {name: 'Disable plugin'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Plugin actions'})).toBeInTheDocument();
        expectPluginActionsInMetadataPanel();
        const runningBadge = screen.getByText('Running').closest('.PluginMetadataPanel__statusBadge--running');
        expect(runningBadge).toBeInTheDocument();
        expect(screen.getByTestId('admin-console-header')).toContainElement(runningBadge);
        expect(screen.queryByText('This is the header')).not.toBeInTheDocument();
        expect(screen.getByText('This is the footer')).toBeInTheDocument();
    });

    it('keeps failed-to-start details out of the status badge', () => {
        const error = 'unable to generate plugin checksum: no such file or directory';

        renderWithContext(
            <CustomPluginSettings
                {...baseProps}
                patchConfig={jest.fn()}
            />,
            {
                entities: {
                    admin: {
                        plugins: {
                            testplugin: plugin,
                        },
                        pluginStatuses: {
                            testplugin: {
                                id: 'testplugin',
                                name: 'testplugin',
                                description: '',
                                version: '',
                                active: false,
                                state: PluginState.PLUGIN_STATE_FAILED_TO_START,
                                error,
                                instances: [],
                            },
                        },
                    },
                },
            },
        );

        const badge = screen.getByTestId('plugin-metadata-status');
        expect(badge).toHaveTextContent('Failed to start');
        expect(badge).not.toHaveTextContent(error);
        expect(screen.getByTestId('admin-console-header')).toContainElement(badge);
        expect(screen.getByTestId('plugin-metadata-status-error')).toHaveTextContent(error);
        expect(document.querySelector('.sectionNoticeContainer.warning')).toBeInTheDocument();
    });

    it('renders plugin metadata with distinct display name and id', () => {
        const pluginId = 'com.mattermost.fl3xx';
        const pluginName = 'FL3XX';
        const namedPlugin = {
            ...plugin,
            id: pluginId,
            name: pluginName,
        };

        renderWithContext(
            <CustomPluginSettings
                {...baseProps}
                match={{params: {plugin_id: pluginId}} as match<{plugin_id: string}>}
                config={{
                    PluginSettings: {
                        Plugins: {
                            [pluginId]: {},
                        },
                    } as unknown as PluginSettings,
                }}
                patchConfig={jest.fn()}
            />,
            {
                entities: {
                    admin: {
                        plugins: {
                            [pluginId]: namedPlugin,
                        },
                    },
                },
            },
        );

        expectPluginPageTitle(pluginName, pluginId);
    });

    it('renders plugin description in the metadata panel when present', () => {
        const describedPlugin = {
            ...plugin,
            description: 'Sticky notes for channels',
        };

        renderWithContext(
            <CustomPluginSettings
                {...baseProps}
                patchConfig={jest.fn()}
            />,
            {
                entities: {
                    admin: {
                        plugins: {
                            testplugin: describedPlugin,
                        },
                    },
                },
            },
        );

        const description = screen.getByText('Sticky notes for channels');
        expect(document.querySelector('.PluginMetadataPanel__actionsPanel')).toContainElement(description);
        expect(description).toHaveClass('PluginMetadataPanel__description');
    });

    it('all custom sections with plugin disabled should show single warning', () => {
        const state = {
            ...baseState,
            entities: {
                admin: {
                    plugins: {
                        testplugin: {
                            ...plugin,
                            active: false,
                            settings_schema: {
                                ...plugin.settings_schema,
                                sections: [
                                    {
                                        key: 'section1',
                                        title: 'Custom Section 1',
                                        settings: [
                                            {
                                                key: 'customsection1numbersetting',
                                                label: 'Custom Section Number Setting',
                                                type: 'number' as const,
                                                help_text: 'Custom Section Number Setting Help Text',
                                            },
                                        ],
                                        custom: true,
                                    },
                                    {
                                        key: 'section2',
                                        title: 'Custom Section 2',
                                        settings: [
                                            {
                                                key: 'customsection2numbersetting',
                                                label: 'Custom Section Number Setting',
                                                type: 'number' as const,
                                                help_text: 'Custom Section Number Setting Help Text',
                                            },
                                        ],
                                        custom: true,
                                    },
                                ],
                            },
                        },
                    },
                },
            },
        };

        const props = {
            ...baseProps,
            config: {
                PluginSettings: {
                    Plugins: {
                        testplugin: {},
                    },
                    PluginStates: {
                        testplugin: {
                            Enable: false,
                        },
                    },
                } as unknown as PluginSettings,
            },
        };

        renderWithContext(
            <CustomPluginSettings
                {...props}
                patchConfig={jest.fn()}
            />,
            {...state});

        expectPluginPageTitle('testplugin', 'testplugin');
        expect(screen.getByRole('button', {name: 'Enable plugin'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Plugin actions'})).toBeInTheDocument();
        expect(screen.queryByTestId('PluginSettings.PluginStates.testplugin.Enabletrue')).not.toBeInTheDocument();
        expect(screen.queryByTestId('PluginSettings.PluginStates.testplugin.Enablefalse')).not.toBeInTheDocument();
        expect(screen.queryByText('Enable Plugin:')).not.toBeInTheDocument();
        expect(screen.queryByText('When true, this plugin is enabled.')).not.toBeInTheDocument();
        expect(screen.getByText('In order to view and configure plugin settings, enable the plugin.')).toBeInTheDocument();
        expect(screen.queryByText('Custom Section 1')).not.toBeInTheDocument();
        expect(screen.queryByText('Custom Section 2')).not.toBeInTheDocument();
    });

    it('all custom sections with plugin disabled and fallback enabled should render available settings', () => {
        const state = {
            ...baseState,
            entities: {
                admin: {
                    plugins: {
                        testplugin: {
                            ...plugin,
                            active: false,
                            settings_schema: {
                                ...plugin.settings_schema,
                                sections: [
                                    {
                                        key: 'section1',
                                        title: 'Custom Section 1',
                                        settings: [
                                            {
                                                key: 'customsection1numbersetting',
                                                label: 'Custom Section Number Setting',
                                                type: 'number' as const,
                                                help_text: 'Custom Section Number Setting Help Text',
                                            },
                                        ],
                                        custom: true,
                                        fallback: true,
                                    },
                                    {
                                        key: 'section2',
                                        title: 'Custom Section 2',
                                        settings: [
                                            {
                                                key: 'customsection2numbersetting',
                                                label: 'Custom Section Bool Setting',
                                                type: 'bool' as const,
                                                help_text: 'Custom Section Bool Setting Help Text',
                                            },
                                            {
                                                key: 'customsection2customsetting',
                                                label: 'Custom Section Custom Setting',
                                                type: 'custom' as const,
                                                help_text: 'Custom Section Custom Setting Help Text',
                                            },
                                        ],
                                        custom: true,
                                        fallback: true,
                                    },
                                ],
                            },
                        },
                    },
                },
            },
        };

        const props = {
            ...baseProps,
            config: {
                PluginSettings: {
                    Plugins: {
                        testplugin: {},
                    },
                    PluginStates: {
                        testplugin: {
                            Enable: false,
                        },
                    },
                } as unknown as PluginSettings,
            },
        };

        renderWithContext(
            <CustomPluginSettings
                {...props}
                patchConfig={jest.fn()}
            />,
            {...state});

        expectPluginPageTitle('testplugin', 'testplugin');
        expect(screen.getByRole('button', {name: 'Enable plugin'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Plugin actions'})).toBeInTheDocument();
        expect(screen.queryByTestId('PluginSettings.PluginStates.testplugin.Enabletrue')).not.toBeInTheDocument();
        expect(screen.queryByTestId('PluginSettings.PluginStates.testplugin.Enablefalse')).not.toBeInTheDocument();
        expect(screen.queryByText('Enable Plugin:')).not.toBeInTheDocument();
        expect(screen.queryByText('When true, this plugin is enabled.')).not.toBeInTheDocument();
        expect(screen.queryByText('In order to view and configure plugin settings, enable the plugin.')).not.toBeInTheDocument();
        expect(screen.queryByText('Custom Section 1')).toBeInTheDocument();
        expect(screen.queryByText('Custom Section 2')).toBeInTheDocument();
        expect(screen.getByText('Custom Section Number Setting Help Text')).toBeInTheDocument();
        expect(screen.getByText('Custom Section Bool Setting Help Text')).toBeInTheDocument();
        expect(screen.queryByText('Custom Section Custom Setting Help Text')).not.toBeInTheDocument();
        expect(screen.getByText('In order to view this setting, enable the plugin.')).toBeInTheDocument();
    });

    it('reloads plugin enable setting state when the plugin becomes active', () => {
        const disabledPlugin = {
            ...plugin,
            active: false,
        };
        const state = {
            ...baseState,
            entities: {
                admin: {
                    plugins: {
                        testplugin: disabledPlugin,
                    },
                },
            },
        };

        const disabledProps = {
            ...baseProps,
            config: {
                PluginSettings: {
                    Plugins: {
                        testplugin: {},
                    },
                    PluginStates: {
                        testplugin: {
                            Enable: false,
                        },
                    },
                } as unknown as PluginSettings,
            },
        };

        const {rerender, updateStoreState} = renderWithContext(
            <CustomPluginSettings
                {...disabledProps}
                patchConfig={jest.fn()}
            />,
            state,
        );

        expect(screen.getByRole('button', {name: 'Enable plugin'})).toBeInTheDocument();

        updateStoreState({
            entities: {
                admin: {
                    plugins: {
                        testplugin: {
                            ...disabledPlugin,
                            active: true,
                        },
                    },
                },
            },
        });

        rerender(
            <CustomPluginSettings
                {...disabledProps}
                config={{
                    PluginSettings: {
                        Plugins: {
                            testplugin: {},
                        },
                        PluginStates: {
                            testplugin: {
                                Enable: true,
                            },
                        },
                    } as unknown as PluginSettings,
                }}
                patchConfig={jest.fn()}
            />,
        );

        expect(screen.queryByRole('button', {name: 'Enable plugin'})).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Disable plugin'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Plugin actions'})).toBeInTheDocument();
        expect(screen.queryByTestId('PluginSettings.PluginStates.testplugin.Enabletrue')).not.toBeInTheDocument();
    });

    it('mixed custom section fallback with plugin disabled keeps fallback sections visible', () => {
        const state = {
            ...baseState,
            entities: {
                admin: {
                    plugins: {
                        testplugin: {
                            ...plugin,
                            settings_schema: {
                                ...plugin.settings_schema,
                                sections: [
                                    {
                                        key: 'section1',
                                        title: 'Fallback Section',
                                        settings: [
                                            {
                                                key: 'fallbacknumbersetting',
                                                label: 'Fallback Number Setting',
                                                type: 'number' as const,
                                                help_text: 'Fallback Number Setting Help Text',
                                            },
                                        ],
                                        custom: true,
                                        fallback: true,
                                    },
                                    {
                                        key: 'section2',
                                        title: 'No Fallback Section',
                                        settings: [
                                            {
                                                key: 'nofallbacknumbersetting',
                                                label: 'No Fallback Number Setting',
                                                type: 'number' as const,
                                                help_text: 'No Fallback Number Setting Help Text',
                                            },
                                        ],
                                        custom: true,
                                        fallback: false,
                                    },
                                ],
                            },
                        },
                    },
                },
            },
        };

        const props = {
            ...baseProps,
            config: {
                ...baseProps.config,
                PluginStates: {
                    testplugin: {
                        Enabled: false,
                    },
                },
            },
        };

        renderWithContext(
            <CustomPluginSettings
                {...props}
                patchConfig={jest.fn()}
            />,
            {...state});

        expectPluginPageTitle('testplugin', 'testplugin');
        expect(screen.getByTestId('PluginSettings.PluginStates.testplugin.Enable-button')).toBeInTheDocument();

        // The single collapse warning must not replace the whole page when at least one section allows a fallback.
        expect(screen.queryByText('In order to view and configure plugin settings, enable the plugin.')).not.toBeInTheDocument();

        // The fallback-enabled section stays configurable.
        expect(screen.getByText('Fallback Section')).toBeInTheDocument();
        expect(screen.getByText('Fallback Number Setting Help Text')).toBeInTheDocument();

        // The non-fallback section is hidden behind its own per-section warning.
        expect(screen.getByText('No Fallback Section')).toBeInTheDocument();
        expect(screen.getByText('In order to view this section, enable the plugin.')).toBeInTheDocument();
        expect(screen.queryByText('No Fallback Number Setting Help Text')).not.toBeInTheDocument();
    });

    it('mixed custom section fallback is order-independent', () => {
        const state = {
            ...baseState,
            entities: {
                admin: {
                    plugins: {
                        testplugin: {
                            ...plugin,
                            settings_schema: {
                                ...plugin.settings_schema,
                                sections: [
                                    {
                                        key: 'section1',
                                        title: 'No Fallback Section',
                                        settings: [
                                            {
                                                key: 'nofallbacknumbersetting',
                                                label: 'No Fallback Number Setting',
                                                type: 'number' as const,
                                                help_text: 'No Fallback Number Setting Help Text',
                                            },
                                        ],
                                        custom: true,
                                        fallback: false,
                                    },
                                    {
                                        key: 'section2',
                                        title: 'Fallback Section',
                                        settings: [
                                            {
                                                key: 'fallbacknumbersetting',
                                                label: 'Fallback Number Setting',
                                                type: 'number' as const,
                                                help_text: 'Fallback Number Setting Help Text',
                                            },
                                        ],
                                        custom: true,
                                        fallback: true,
                                    },
                                ],
                            },
                        },
                    },
                },
            },
        };

        const props = {
            ...baseProps,
            config: {
                ...baseProps.config,
                PluginStates: {
                    testplugin: {
                        Enabled: false,
                    },
                },
            },
        };

        renderWithContext(
            <CustomPluginSettings
                {...props}
                patchConfig={jest.fn()}
            />,
            {...state});

        expect(screen.queryByText('In order to view and configure plugin settings, enable the plugin.')).not.toBeInTheDocument();
        expect(screen.getByText('Fallback Section')).toBeInTheDocument();
        expect(screen.getByText('Fallback Number Setting Help Text')).toBeInTheDocument();
        expect(screen.getByText('No Fallback Section')).toBeInTheDocument();
        expect(screen.getByText('In order to view this section, enable the plugin.')).toBeInTheDocument();
        expect(screen.queryByText('No Fallback Number Setting Help Text')).not.toBeInTheDocument();
    });

    it('custom sections with plugin enabled should render as expected', () => {
        const CustomSection1 = () => {
            return (
                <div>{'Custom Component Section 1'}</div>
            );
        };

        const CustomSection2 = () => {
            return (
                <div>{'Custom Component Section 2'}</div>
            );
        };

        const state = {
            ...baseState,
            entities: {
                admin: {
                    plugins: {
                        testplugin: {
                            ...plugin,
                            settings_schema: {
                                ...plugin.settings_schema,
                                sections: [
                                    {
                                        key: 'section1',
                                        title: 'Custom Section 1',
                                        settings: [
                                            {
                                                key: 'customsection1numbersetting',
                                                label: 'Custom Section Number Setting',
                                                type: 'number' as const,
                                                help_text: 'Custom Section Number Setting Help Text',
                                            },
                                        ],
                                        custom: true,
                                    },
                                    {
                                        key: 'section2',
                                        title: 'Custom Section 2',
                                        settings: [
                                            {
                                                key: 'customsection2numbersetting',
                                                label: 'Custom Section Number Setting',
                                                type: 'number' as const,
                                                help_text: 'Custom Section Number Setting Help Text',
                                            },
                                        ],
                                        custom: true,
                                    },
                                ],
                            },
                        },
                    },
                },
            },
            plugins: {
                adminConsoleCustomSections: {
                    testplugin: {
                        section1: {
                            pluginId: 'testplugin',
                            key: 'section1',
                            component: CustomSection1 as unknown as React.Component,
                        },
                        section2: {
                            pluginId: 'testplugin',
                            key: 'section2',
                            component: CustomSection2 as unknown as React.Component,
                        },
                    },
                },
            },
        };

        const props = {
            ...baseProps,
            config: {
                PluginSettings: {
                    Plugins: {
                        testplugin: {},
                    },
                    PluginStates: {
                        testplugin: {
                            Enable: true,
                        },
                    },
                } as unknown as PluginSettings,
            },
        };

        renderWithContext(
            <CustomPluginSettings
                {...props}
                patchConfig={jest.fn()}
            />,
            {...state});

        expectPluginPageTitle('testplugin', 'testplugin');
        expect(screen.getByRole('button', {name: 'Disable plugin'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Plugin actions'})).toBeInTheDocument();
        expect(screen.queryByTestId('PluginSettings.PluginStates.testplugin.Enabletrue')).not.toBeInTheDocument();
        expect(screen.queryByTestId('PluginSettings.PluginStates.testplugin.Enablefalse')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Enable plugin'})).not.toBeInTheDocument();
        expect(screen.queryByText('In order to view and configure plugin settings, enable the plugin.')).not.toBeInTheDocument();
        expect(screen.getByText('Custom Component Section 1')).toBeInTheDocument();
        expect(screen.getByText('Custom Component Section 2')).toBeInTheDocument();
    });
});
