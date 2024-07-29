// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {CloudState} from '@mattermost/types/cloud';
import type {PluginSettings} from '@mattermost/types/config';
import type {PluginRedux} from '@mattermost/types/plugins';

import CustomPluginSettings from 'components/admin_console/custom_plugin_settings/custom_plugin_settings';
import {escapePathPart} from 'components/admin_console/schema_admin_settings';

import {shallowWithIntl} from 'tests/helpers/intl-test-helper';
import {screen, renderWithContext} from 'tests/react_testing_utils';

import type {AdminDefinitionSetting} from '../types';

describe('components/admin_console/CustomPluginSettings', () => {
    let plugin: PluginRedux;
    let config: {PluginSettings: PluginSettings};

    const baseProps = {
        isDisabled: false,
        environmentConfig: {},
        setNavigationBlocked: jest.fn(),
        roles: {},
        cloud: {} as CloudState,
        license: {},
        editRole: jest.fn(),
        consoleAccess: {read: {}, write: {}},
        isCurrentUserSystemAdmin: false,
        enterpriseReady: false,
    };
    beforeEach(() => {
        plugin = {
            id: 'testplugin',
            name: 'testplugin',
            description: '',
            version: '',
            active: true,
            webapp: {
                bundle_path: '/static/testplugin_bundle.js',
            },
            settings_schema: {
                header: '# Header\n*This* is the **header**',
                footer: '# Footer\n*This* is the **footer**',
                settings: [
                    {
                        key: 'settinga',
                        display_name: 'Setting One',
                        type: 'text',
                        default: 'setting_default',
                        help_text: 'This is some help text for the text field.',
                        placeholder: 'e.g. some setting',
                    },
                    {
                        key: 'settingb',
                        display_name: 'Setting Two',
                        type: 'bool',
                        default: true,
                        help_text: 'This is some help text for the bool field.',
                        placeholder: 'e.g. some setting',
                    },
                    {
                        key: 'settingc',
                        display_name: 'Setting Three',
                        type: 'dropdown',
                        default: 'option1',
                        options: [
                            {display_name: 'Option 1', value: 'option1'},
                            {display_name: 'Option 2', value: 'option2'},
                            {display_name: 'Option 3', value: 'option3'},
                        ],
                        help_text: 'This is some help text for the dropdown field.',
                        placeholder: 'e.g. some setting',
                    },
                    {
                        key: 'settingd',
                        display_name: 'Setting Four',
                        type: 'radio',
                        default: 'option2',
                        options: [
                            {display_name: 'Option 1', value: 'option1'},
                            {display_name: 'Option 2', value: 'option2'},
                            {display_name: 'Option 3', value: 'option3'},
                        ],
                        help_text: 'This is some help text for the radio field.',
                        placeholder: 'e.g. some setting',
                    },
                    {
                        key: 'settinge',
                        display_name: 'Setting Five',
                        type: 'generated',
                        default: 'option3',
                        help_text: 'This is some help text for the generated field.',
                        regenerate_help_text: 'This is help text for the regenerate button.',
                        placeholder: 'e.g. 47KyfOxtk5+ovi1MDHFyzMDHIA6esMWb',
                    },
                    {
                        key: 'settingf',
                        display_name: 'Setting Six',
                        type: 'username',
                        default: 'option4',
                        help_text: 'This is some help text for the user autocomplete field.',
                        placeholder: 'Type a username here',
                    },
                ],
            },
        };

        config = {
            PluginSettings: {
                Plugins: {
                    testplugin: {
                        settinga: 'fsdsdg',
                        settingb: false,
                        settingc: 'option3',
                        settingd: 'option1',
                        settinge: 'Q6DHXrFLOIS5sOI5JNF4PyDLqWm7vh23',
                        settingf: '3xz3r6n7dtbbmgref3yw4zg7sr',
                    },
                },
            } as unknown as PluginSettings,
        };
    });

    test('should match snapshot with settings and plugin', () => {
        const settings = plugin.settings_schema!.settings.map((setting) => {
            const escapedPluginId = escapePathPart(plugin.id);
            return {
                ...setting,
                key: 'PluginSettings.Plugins.' + escapedPluginId + '.' + setting.key.toLowerCase(),
                label: setting.display_name,
            } as AdminDefinitionSetting;
        });
        const wrapper = shallowWithIntl(
            <CustomPluginSettings
                {...baseProps}
                config={config}
                schema={{...plugin.settings_schema, id: plugin.id, name: plugin.name, settings, sections: undefined}}
                patchConfig={jest.fn()}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with settings and no plugin', () => {
        const wrapper = shallowWithIntl(
            <CustomPluginSettings
                {...baseProps}
                config={config}
                schema={{
                    id: 'testplugin',
                    name: 'testplugin',
                }}
                patchConfig={jest.fn()}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with no settings and plugin', () => {
        const settings = plugin && plugin.settings_schema && plugin.settings_schema.settings && plugin.settings_schema.settings.map((setting) => {
            return {...setting, label: setting.display_name} as AdminDefinitionSetting;
        });
        const wrapper = shallowWithIntl(
            <CustomPluginSettings
                {...baseProps}
                config={{
                    PluginSettings: {
                        Plugins: {},
                    } as PluginSettings,
                }}
                schema={{...plugin.settings_schema, id: plugin.id, name: plugin.name, settings, sections: undefined}}
                patchConfig={jest.fn()}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });
});

function CustomSection(props: {settingsList: React.ReactNode[]}) {
    return (<div>{'Custom Section'} {props.settingsList}</div>);
}

function CustomSetting() {
    return (<div>{'Custom Setting'}</div>);
}

describe('custom plugin sections', () => {
    let config: {PluginSettings: PluginSettings};

    const baseProps = {
        isDisabled: false,
        environmentConfig: {},
        setNavigationBlocked: jest.fn(),
        roles: {},
        cloud: {} as CloudState,
        license: {},
        editRole: jest.fn(),
        consoleAccess: {read: {}, write: {}},
        isCurrentUserSystemAdmin: false,
        enterpriseReady: false,
    };

    it('empty sections', () => {
        const schema = {
            id: 'testplugin',
            name: 'testplugin',
            description: '',
            version: '',
            active: true,
            webapp: {
                bundle_path: '/static/testplugin_bundle.js',
            },
            sections: [],
        };

        renderWithContext(
            <CustomPluginSettings
                {...baseProps}
                config={config}
                schema={schema}
                patchConfig={jest.fn()}
            />,
        );
        expect(screen.getByText('testplugin')).toBeInTheDocument();
    });

    it('render sections', () => {
        const schema = {
            id: 'testplugin',
            name: 'testplugin',
            description: '',
            version: '',
            active: true,
            webapp: {
                bundle_path: '/static/testplugin_bundle.js',
            },
            sections: [
                {
                    key: 'section1',
                    title: 'Section 1',
                    settings: [],
                    header: 'Section1 Header',
                    footer: 'Section1 Footer',
                },
                {
                    key: 'section2',
                    title: 'Section 2',
                    settings: [
                        {
                            key: 'section2setting1',
                            label: 'Section 2 Setting 1',
                            type: 'text' as const,
                            help_text: 'Section 2 Setting 1 Help Text',
                        },
                    ],
                    header: 'Section2 Header',
                    footer: 'Section2 Footer',
                },
                {
                    key: 'section3',
                    settings: [],
                },
            ],
        };

        renderWithContext(
            <CustomPluginSettings
                {...baseProps}
                config={config}
                schema={schema}
                patchConfig={jest.fn()}
            />,
        );

        expect(screen.getByText('testplugin')).toBeInTheDocument();

        expect(screen.getByText('Section 1')).toBeInTheDocument();
        expect(screen.getByText('Section1 Header')).toBeInTheDocument();
        expect(screen.getByText('Section1 Footer')).toBeInTheDocument();

        expect(screen.getByText('Section 2')).toBeInTheDocument();
        expect(screen.getByText('Section2 Header')).toBeInTheDocument();
        expect(screen.getByText('Section2 Footer')).toBeInTheDocument();
        expect(screen.getByText('Section 2 Setting 1')).toBeInTheDocument();
        expect(screen.getByText('Section 2 Setting 1 Help Text')).toBeInTheDocument();

        expect(screen.queryByText('Section 3')).not.toBeInTheDocument();
    });

    it('custom sections and settings', () => {
        const schema = {
            id: 'testplugin',
            name: 'testplugin',
            description: '',
            version: '',
            active: true,
            webapp: {
                bundle_path: '/static/testplugin_bundle.js',
            },
            sections: [
                {
                    key: 'section1',
                    title: 'Custom Section 1',
                    settings: [
                        {
                            key: 'customsectionnumbersetting',
                            label: 'Custom Section Number Setting',
                            type: 'number' as const,
                            help_text: 'Custom Section Number Setting Help Text',
                        },
                        {
                            key: 'customsectioncustomsetting',
                            type: 'custom' as const,
                            component: CustomSetting,
                        },
                    ],
                    custom: true,
                    component: CustomSection,
                },
                {
                    key: 'section2',
                    title: 'Section 2',
                    settings: [
                        {
                            key: 'section2setting1',
                            label: 'Section 2 Setting 1',
                            type: 'text' as const,
                            help_text: 'Section 2 Setting 1 Help Text',
                        },
                    ],
                    header: 'Section2 Header',
                    footer: 'Section2 Footer',
                },
            ],
        };

        renderWithContext(
            <CustomPluginSettings
                {...baseProps}
                config={config}
                schema={schema}
                patchConfig={jest.fn()}
            />,
        );

        expect(screen.getByText('testplugin')).toBeInTheDocument();

        expect(screen.getByText('Custom Section')).toBeInTheDocument();
        expect(screen.getByText('Custom Section Number Setting')).toBeInTheDocument();
        expect(screen.getByText('Custom Section Number Setting Help Text')).toBeInTheDocument();
        expect(screen.getByText('Custom Setting')).toBeInTheDocument();

        expect(screen.getByText('Section 2')).toBeInTheDocument();
        expect(screen.getByText('Section2 Header')).toBeInTheDocument();
        expect(screen.getByText('Section2 Footer')).toBeInTheDocument();
        expect(screen.getByText('Section 2 Setting 1')).toBeInTheDocument();
        expect(screen.getByText('Section 2 Setting 1 Help Text')).toBeInTheDocument();
    });
});
