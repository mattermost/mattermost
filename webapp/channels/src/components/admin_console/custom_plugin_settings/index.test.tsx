// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {match} from 'react-router-dom';

import type {CloudState} from '@mattermost/types/cloud';
import type {PluginSettings} from '@mattermost/types/config';

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
        const panel = screen.getByTestId('plugin-metadata-panel');
        expect(panel).toHaveTextContent(`${pluginName} (${pluginId}`);
        expect(document.querySelector('.PluginMetadataPanel__settingsWrapper')).toContainElement(panel);
        expect(screen.getByRole('heading', {level: 1, hidden: true})).toHaveTextContent(pluginName);
    };

    it('empty sections and settings', () => {
        renderWithContext(
            <CustomPluginSettings
                {...baseProps}
                patchConfig={jest.fn()}
            />,
            {...baseState});

        expectPluginPageTitle('testplugin', 'testplugin');
        expect(screen.getByTestId('PluginSettings.PluginStates.testplugin.Enable')).toBeInTheDocument();
        expect(screen.getByText('This is the header')).toBeInTheDocument();
        expect(screen.getByText('This is the footer')).toBeInTheDocument();
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

    it('all custom sections with plugin disabled should show single warning', () => {
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
        expect(screen.getByTestId('PluginSettings.PluginStates.testplugin.Enable')).toBeInTheDocument();
        expect(screen.getByText('In order to view and configure plugin settings, enable the plugin and click Save.')).toBeInTheDocument();
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
        expect(screen.getByTestId('PluginSettings.PluginStates.testplugin.Enable')).toBeInTheDocument();
        expect(screen.queryByText('In order to view and configure plugin settings, enable the plugin and click Save.')).not.toBeInTheDocument();
        expect(screen.queryByText('Custom Section 1')).toBeInTheDocument();
        expect(screen.queryByText('Custom Section 2')).toBeInTheDocument();
        expect(screen.getByText('Custom Section Number Setting Help Text')).toBeInTheDocument();
        expect(screen.getByText('Custom Section Bool Setting Help Text')).toBeInTheDocument();
        expect(screen.queryByText('Custom Section Custom Setting Help Text')).not.toBeInTheDocument();
        expect(screen.getByText('In order to view this setting, enable the plugin and click Save.')).toBeInTheDocument();
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
                ...baseProps.config,
                PluginStates: {
                    testplugin: {
                        Enabled: true,
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
        expect(screen.getByTestId('PluginSettings.PluginStates.testplugin.Enable')).toBeInTheDocument();
        expect(screen.queryByText('In order to view and configure plugin settings, enable the plugin and click Save.')).not.toBeInTheDocument();
        expect(screen.getByText('Custom Component Section 1')).toBeInTheDocument();
        expect(screen.getByText('Custom Component Section 2')).toBeInTheDocument();
    });
});
