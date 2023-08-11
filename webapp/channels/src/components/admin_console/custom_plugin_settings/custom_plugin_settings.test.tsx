// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {shallow} from 'enzyme';

import type {PluginSettings} from '@mattermost/types/config';
import type {PluginRedux} from '@mattermost/types/plugins';

import CustomPluginSettings from 'components/admin_console/custom_plugin_settings/custom_plugin_settings';
import SchemaAdminSettings from 'components/admin_console/schema_admin_settings';

describe('components/admin_console/CustomPluginSettings', () => {
    let plugin: PluginRedux = {} as PluginRedux;
    let config: {PluginSettings: Partial<PluginSettings>} = {PluginSettings: {}};

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
            },
        };
    });

    test('should match snapshot with settings and plugin', () => {
        const settings = plugin && plugin.settings_schema && plugin.settings_schema.settings && plugin.settings_schema.settings.map((setting) => {
            const escapedPluginId = SchemaAdminSettings.escapePathPart(plugin.id);
            return {
                ...setting,
                key: 'PluginSettings.Plugins.' + escapedPluginId + '.' + setting.key.toLowerCase(),
                label: setting.display_name,
            };
        });
        const wrapper = shallow(
            <CustomPluginSettings
                config={config}
                schema={{...plugin.settings_schema, id: plugin.id, name: plugin.name, translate: false, settings}}
                updateConfig={jest.fn()}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with settings and no plugin', () => {
        const wrapper = shallow(
            <CustomPluginSettings
                config={config}
                schema={{
                    id: 'testplugin',
                    name: 'testplugin',
                    translate: false,
                }}
                updateConfig={jest.fn()}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with no settings and plugin', () => {
        const settings = plugin && plugin.settings_schema && plugin.settings_schema.settings && plugin.settings_schema.settings.map((setting) => {
            return {...setting, label: setting.display_name};
        });
        const wrapper = shallow(
            <CustomPluginSettings
                config={{
                    PluginSettings: {
                        Plugins: {},
                    },
                }}
                schema={{...plugin.settings_schema, id: plugin.id, name: plugin.name, translate: false, settings}}
                updateConfig={jest.fn()}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });
});
