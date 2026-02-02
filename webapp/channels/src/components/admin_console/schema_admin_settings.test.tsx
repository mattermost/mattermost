// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {CloudState} from '@mattermost/types/cloud';
import type {AdminConfig, EnvironmentConfig} from '@mattermost/types/config';

import {defaultIntl} from 'tests/helpers/intl-test-helper';
import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import SchemaAdminSettings, {SchemaAdminSettings as SchemaAdminSettingsClass} from './schema_admin_settings';
import type {ConsoleAccess, AdminDefinitionSubSectionSchema, AdminDefinitionSettingInput} from './types';
import ValidationResult from './validation';

const DefaultProps = {
    cloud: {} as CloudState,
    consoleAccess: {} as ConsoleAccess,
    editRole: jest.fn(),
    enterpriseReady: false,
    isCurrentUserSystemAdmin: false,
    isDisabled: false,
    license: {},
    roles: {},
    setNavigationBlocked: jest.fn(),
};

describe('components/admin_console/SchemaAdminSettings', () => {
    let schema: AdminDefinitionSubSectionSchema | null = null;
    let config: Partial<AdminConfig> = {};
    let environmentConfig: Partial<EnvironmentConfig> = {};

    afterEach(() => {
        schema = null;
        config = {};
        environmentConfig = {};
    });

    beforeEach(() => {
        schema = {
            id: 'Config',
            name: 'config',
            name_default: 'Configuration',
            settings: [
                {
                    key: 'FirstSettings.settinga',
                    label: 'label-a',
                    label_default: 'Setting One',
                    type: 'text',
                    default: 'setting_default',
                    help_text: 'help-text-a',
                    help_text_default: 'This is some help text for the text field.',
                    placeholder: 'placeholder-a',
                    placeholder_default: 'e.g. some setting',
                },
                {
                    key: 'FirstSettings.settingb',
                    label: 'label-b',
                    label_default: 'Setting Two',
                    type: 'bool',
                    default: true,
                    help_text: 'help-text-b',
                    help_text_default: 'This is some help text for the bool field.',
                },
                {
                    key: 'FirstSettings.settingc',
                    label: 'label-c',
                    label_default: 'Setting Three',
                    type: 'dropdown',
                    default: 'option1',
                    options: [
                        {display_name: 'Option 1', value: 'option1'},
                        {display_name: 'Option 2', value: 'option2'},
                        {display_name: 'Option 3', value: 'option3'},
                    ],
                    help_text: 'help-text-c',
                    help_text_default: 'This is some help text for the dropdown field.',
                },
                {
                    key: 'SecondSettings.settingd',
                    label: 'label-d',
                    label_default: 'Setting Four',
                    type: 'radio',
                    default: 'option2',
                    options: [
                        {display_name: 'Option 1', value: 'option1'},
                        {display_name: 'Option 2', value: 'option2'},
                        {display_name: 'Option 3', value: 'option3'},
                    ],
                    help_text: 'help-text-d',
                    help_text_default: 'This is some help text for the radio field.',
                },
                {
                    key: 'SecondSettings.settinge',
                    label: 'label-e',
                    label_default: 'Setting Five',
                    type: 'generated',
                    help_text: 'help-text-e',
                    help_text_default: 'This is some help text for the generated field.',
                    regenerate_help_text: 'This is help text for the regenerate button.',
                    placeholder: 'placeholder-e',
                    placeholder_default: 'e.g. 47KyfOxtk5+ovi1MDHFyzMDHIA6esMWb',
                },
                {
                    key: 'SecondSettings.settingf',
                    label: 'label-f',
                    label_default: 'Setting Six',
                    type: 'username',
                    help_text: 'help-text-f',
                    help_text_default: 'This is some help text for the user autocomplete field.',
                    placeholder: 'placeholder-f',
                    placeholder_default: 'Type a username here',
                },
                {
                    key: 'SecondSettings.settingg',
                    label: 'label-g',
                    label_default: 'Setting Seven',
                    type: 'number',
                    default: 'setting_default',
                    help_text: 'help-text-g',
                    help_text_default: 'This is some help text for the number field.',
                    placeholder: 'placeholder-g',
                    placeholder_default: 'e.g. some setting',
                },
                {
                    key: 'SecondSettings.settingh',
                    label: 'label-h',
                    label_default: 'Setting Eight',
                    type: 'number',
                    default: 'setting_default',
                    help_text: 'help-text-h',
                    help_text_default: 'This is some help text for the number field.',
                    placeholder: 'placeholder-h',
                    placeholder_default: 'e.g. some setting',
                    onConfigLoad: (configVal) => configVal / 10,
                    onConfigSave: (displayVal) => displayVal * 10,
                },
                {
                    label: 'label-h',
                    label_default: 'Setting Eight',
                    type: 'banner',
                },
                {
                    key: 'SecondSettings.settingi',
                    label: 'label-i',
                    label_default: 'Setting Nine',
                    type: 'language',
                    help_text: 'help-text-i',
                    help_text_default: 'This is some help text for the language field.',
                    placeholder: 'placeholder-i',
                    placeholder_default: 'e.g. some setting',
                    multiple: false,
                },
                {
                    key: 'SecondSettings.settingj',
                    label: 'label-j',
                    label_default: 'Setting Nine',
                    type: 'language',
                    help_text: 'help-text-j',
                    help_text_default: 'This is some help text for the multiple-language field.',
                    placeholder: 'placeholder-j',
                    placeholder_default: 'e.g. some setting',
                    multiple: true,
                    no_result: 'no-result-j',
                    no_result_default: 'No result',
                    not_present: 'no-present-j',
                    not_present_default: 'No present',
                },
                {
                    key: 'SecondSettings.settingk',
                    label: 'label-k',
                    label_default: 'Setting Eleven',
                    type: 'button',
                    help_text: 'help-text-k',
                    help_text_default: 'This is some help text for the button field.',
                    action: () => null,
                    error_message: 'admin.reload.reloadFail',
                    error_message_default: 'Reload unsuccessful: {error}',
                },
                {
                    key: 'FirstSettings.settingl',
                    label: 'label-l',
                    label_default: 'Setting Twelve',
                    type: 'bool',
                    default: false,
                    help_text: 'help-text-l',
                    help_text_default: 'This is some help text for the second bool field.',
                },
                {
                    key: 'FirstSettings.settingm',
                    label: 'label-m',
                    label_default: 'Setting Thirteen',
                    type: 'color',
                    help_text: 'help-text-m',
                    help_text_default: 'This is some help text for the color field.',
                },
                {
                    type: 'custom',
                    key: 'custom',
                    component: () => <p>{'Test'}</p>,
                },
                {
                    type: 'jobstable',
                    label: 'label-l',
                    label_default: 'Setting Twelve',
                    help_text: 'help-text-l',
                    help_text_default: 'This is some help text for the jobs table field.',
                    job_type: 'test',
                    render_job: () => <p>{'Test'}</p>,
                },
                {
                    key: 'EscapedSettings.com+example+setting.a',
                    label: 'escaped-label-a',
                    label_default: 'Escaped Setting A',
                    type: 'bool',
                    default: false,
                    help_text: 'escaped-help-text-a',
                    help_text_default: 'This is some help text for the first escaped field.',
                },
            ],
        } as AdminDefinitionSubSectionSchema;
        config = {
            FirstSettings: {
                settinga: 'fsdsdg',
                settingb: false,
                settingc: 'option3',
                settingl: true,
            },
            SecondSettings: {
                settingd: 'option1',
                settinge: 'Q6DHXrFLOIS5sOI5JNF4PyDLqWm7vh23',
                settingf: '3xz3r6n7dtbbmgref3yw4zg7sr',
                settingg: 7,
                settingh: 100,
            },
            EscapedSettings: {
                'com.example.setting': {
                    a: true,
                },
            },
        } as Partial<AdminConfig>;
        environmentConfig = {
            FirstSettings: {
                settingl: true,
            },
        } as Partial<EnvironmentConfig>;
    });

    test('should render settings from schema', () => {
        renderWithContext(
            <SchemaAdminSettings
                {...DefaultProps}
                config={config}
                environmentConfig={environmentConfig}
                schema={{...schema} as AdminDefinitionSubSectionSchema}
                patchConfig={jest.fn()}
            />,
        );

        // Verify the form structure is rendered
        expect(screen.getByRole('form')).toBeInTheDocument();

        // Verify key settings from schema are rendered (different types)
        expect(screen.getByText('label-a')).toBeInTheDocument(); // Text input setting
        expect(screen.getByText('label-b')).toBeInTheDocument(); // Bool setting
        expect(screen.getByText('label-c')).toBeInTheDocument(); // Dropdown setting

        // Verify setting inputs are rendered
        expect(screen.getByRole('textbox', {name: /label-a/i})).toBeInTheDocument();
    });

    test('should render custom component from schema', () => {
        renderWithContext(
            <SchemaAdminSettings
                {...DefaultProps}
                config={config}
                environmentConfig={environmentConfig}
                schema={{component: () => <p>{'Test'}</p>} as AdminDefinitionSubSectionSchema}
                patchConfig={jest.fn()}
            />,
        );

        // Verify the custom component is rendered
        expect(screen.getByText('Test')).toBeInTheDocument();
    });

    test('should render header text with markdown links', () => {
        const headerText = 'This is [a link](!https://example.com) in the header';
        const props = {
            ...DefaultProps,
            config,
            environmentConfig,
            schema: {
                ...schema,
                header: headerText,
            } as AdminDefinitionSubSectionSchema,
            patchConfig: jest.fn(),
        };

        const {container} = renderWithContext(<SchemaAdminSettings {...props}/>);

        // Verify the markdown link is rendered as an anchor element with the correct text
        const link = screen.getByRole('link', {name: 'a link'});
        expect(link).toBeInTheDocument();
        expect(link).toHaveAttribute('href', 'https://example.com');

        // Verify the surrounding text is present
        expect(container.textContent).toContain('This is');
        expect(container.textContent).toContain('in the header');
    });

    test('should render footer text with markdown links', () => {
        const footerText = 'This is [a link](https://example.com) in the footer';
        const props = {
            ...DefaultProps,
            config,
            environmentConfig,
            schema: {
                ...schema,
                footer: footerText,
            } as AdminDefinitionSubSectionSchema,
            patchConfig: jest.fn(),
        };

        const {container} = renderWithContext(<SchemaAdminSettings {...props}/>);

        // Verify the markdown link is rendered as an anchor element with the correct text
        const link = screen.getByRole('link', {name: 'a link'});
        expect(link).toBeInTheDocument();
        expect(link).toHaveAttribute('href', 'https://example.com');

        // Verify the surrounding text is present
        expect(container.textContent).toContain('This is');
        expect(container.textContent).toContain('in the footer');
    });

    test('should render page not found', () => {
        const props = {
            ...DefaultProps,
            config,
            environmentConfig,
            schema: null,
            patchConfig: jest.fn(),
        };

        renderWithContext(<SchemaAdminSettings {...props}/>);

        // Verify the "Plugin Not Found" message is rendered
        expect(screen.getByText('Plugin Not Found')).toBeInTheDocument();
    });

    test('should not try to validate when a setting does not contain a key', () => {
        const mockValidate = jest.fn(() => {
            return new ValidationResult(true, '');
        });

        const localSchema = {...schema} as AdminDefinitionSubSectionSchema & {settings: AdminDefinitionSettingInput[]};
        localSchema.settings = [
            {
                label: 'a banner', // won't validate because no key
                type: 'banner' as any,
                validate: mockValidate,
            },
        ];

        const props = {
            ...DefaultProps,
            config,
            id: '',
            environmentConfig,
            schema: localSchema,
            patchConfig: jest.fn(),
            intl: defaultIntl,
        };

        const ref = React.createRef<SchemaAdminSettingsClass>();
        renderWithContext(
            <SchemaAdminSettingsClass
                ref={ref}
                {...props}
            />,
        );

        expect(ref.current?.canSave()).toBe(true);
        expect(mockValidate).not.toHaveBeenCalled();
    });

    test('should validate when a setting contains a key and a validation method', () => {
        const mockValidate = jest.fn(() => {
            return new ValidationResult(true, '');
        });

        const localSchema = {...schema} as AdminDefinitionSubSectionSchema & {settings: AdminDefinitionSettingInput[]};
        localSchema.settings = [
            {
                key: 'field1', // will validate because it has a key AND a validate method
                label: 'with key and validation',
                type: 'text',
                validate: mockValidate,
            },
        ];
        const props = {
            ...DefaultProps,
            config,
            environmentConfig,
            schema: localSchema,
            patchConfig: jest.fn(),
            intl: defaultIntl,
        };

        const ref = React.createRef<SchemaAdminSettingsClass>();
        renderWithContext(
            <SchemaAdminSettingsClass
                ref={ref}
                {...props}
            />,
        );

        expect(ref.current?.canSave()).toBe(true);
        expect(mockValidate).toHaveBeenCalled();
    });

    test('should handle changing text input values', async () => {
        // Use a simplified schema without username/jobstable fields to avoid async complications
        const simpleSchema = {
            id: 'Config',
            name: 'config',
            name_default: 'Configuration',
            settings: [
                {
                    key: 'FirstSettings.settinga',
                    label: 'label-a',
                    label_default: 'Setting One',
                    type: 'text',
                    default: 'setting_default',
                },
            ],
        } as unknown as AdminDefinitionSubSectionSchema;

        renderWithContext(
            <SchemaAdminSettings
                {...DefaultProps}
                config={config}
                environmentConfig={environmentConfig}
                schema={simpleSchema}
                patchConfig={jest.fn()}
            />,
        );

        // Find the text input by its label
        const textInput = screen.getByRole('textbox', {name: /label-a/i});
        expect(textInput).toBeInTheDocument();

        // Change the value
        await userEvent.clear(textInput);
        await userEvent.type(textInput, 'new value');

        // Verify the value changed
        expect(textInput).toHaveValue('new value');
    });

    test('should toggle boolean settings', async () => {
        const {container} = renderWithContext(
            <SchemaAdminSettings
                {...DefaultProps}
                config={config}
                environmentConfig={environmentConfig}
                schema={{...schema} as AdminDefinitionSubSectionSchema}
                patchConfig={jest.fn()}
            />,
        );

        // Boolean settings render as radio buttons (True/False) using data-testid
        const trueRadio = container.querySelector('[data-testid="FirstSettings.settingbtrue"]') as HTMLInputElement;
        const falseRadio = container.querySelector('[data-testid="FirstSettings.settingbfalse"]') as HTMLInputElement;

        expect(trueRadio).toBeInTheDocument();
        expect(falseRadio).toBeInTheDocument();

        // Initially false should be checked (default: false in config)
        expect(falseRadio?.checked).toBe(true);
        expect(trueRadio?.checked).toBe(false);

        // Click true radio button
        await userEvent.click(trueRadio);

        // Now true should be checked
        expect(trueRadio?.checked).toBe(true);
        expect(falseRadio?.checked).toBe(false);
    });

    test('should disable save button when validation fails', () => {
        const mockValidate = jest.fn(() => {
            return new ValidationResult(false, 'Validation error');
        });

        const localSchema = {...schema} as AdminDefinitionSubSectionSchema & {settings: AdminDefinitionSettingInput[]};
        localSchema.settings = [
            {
                key: 'FirstSettings.settinga',
                label: 'label-a',
                type: 'text',
                validate: mockValidate,
            },
        ];

        const props = {
            ...DefaultProps,
            config,
            environmentConfig,
            schema: localSchema,
            patchConfig: jest.fn(),
            intl: defaultIntl,
        };

        const ref = React.createRef<SchemaAdminSettingsClass>();
        renderWithContext(
            <SchemaAdminSettingsClass
                ref={ref}
                {...props}
            />,
        );

        // canSave should return false due to validation failure
        expect(ref.current?.canSave()).toBe(false);
    });

    test('should enable save button when changes are made', async () => {
        // Use a simplified schema without username/jobstable fields to avoid async complications
        const simpleSchema = {
            id: 'Config',
            name: 'config',
            name_default: 'Configuration',
            settings: [
                {
                    key: 'FirstSettings.settinga',
                    label: 'label-a',
                    label_default: 'Setting One',
                    type: 'text',
                    default: 'setting_default',
                },
            ],
        } as unknown as AdminDefinitionSubSectionSchema;

        renderWithContext(
            <SchemaAdminSettings
                {...DefaultProps}
                config={config}
                environmentConfig={environmentConfig}
                schema={simpleSchema}
                patchConfig={jest.fn()}
            />,
        );

        // Find save button - should be disabled initially (no changes)
        const saveButton = screen.getByRole('button', {name: /save/i});
        expect(saveButton).toBeDisabled();

        // Make a change to a text input
        const textInput = screen.getByRole('textbox', {name: /label-a/i});
        await userEvent.clear(textInput);
        await userEvent.type(textInput, 'changed value');

        // Wait for save button to be enabled
        await waitFor(() => {
            expect(saveButton).not.toBeDisabled();
        });
    });

    test('should render dropdown setting', () => {
        renderWithContext(
            <SchemaAdminSettings
                {...DefaultProps}
                config={config}
                environmentConfig={environmentConfig}
                schema={{...schema} as AdminDefinitionSubSectionSchema}
                patchConfig={jest.fn()}
            />,
        );

        // Verify dropdown label is rendered
        expect(screen.getByText('label-c')).toBeInTheDocument();

        // Verify dropdown options are available
        const dropdown = screen.getByRole('combobox', {name: /label-c/i});
        expect(dropdown).toBeInTheDocument();
    });

    test('should render radio button setting', () => {
        renderWithContext(
            <SchemaAdminSettings
                {...DefaultProps}
                config={config}
                environmentConfig={environmentConfig}
                schema={{...schema} as AdminDefinitionSubSectionSchema}
                patchConfig={jest.fn()}
            />,
        );

        // Verify radio button label is rendered
        expect(screen.getByText('label-d')).toBeInTheDocument();

        // Verify radio buttons are rendered
        const radioButtons = screen.getAllByRole('radio');
        expect(radioButtons.length).toBeGreaterThan(0);
    });

    test('should call patchConfig on form submission', async () => {
        const mockPatchConfig = jest.fn(() => Promise.resolve({data: true}));

        // Use a simplified schema without username/jobstable fields to avoid async complications
        const simpleSchema = {
            id: 'Config',
            name: 'config',
            name_default: 'Configuration',
            settings: [
                {
                    key: 'FirstSettings.settinga',
                    label: 'label-a',
                    label_default: 'Setting One',
                    type: 'text',
                    default: 'setting_default',
                },
            ],
        } as unknown as AdminDefinitionSubSectionSchema;

        renderWithContext(
            <SchemaAdminSettings
                {...DefaultProps}
                config={config}
                environmentConfig={environmentConfig}
                schema={simpleSchema}
                patchConfig={mockPatchConfig}
            />,
        );

        // Make a change
        const textInput = screen.getByRole('textbox', {name: /label-a/i});
        await userEvent.clear(textInput);
        await userEvent.type(textInput, 'new value');

        // Wait for save button to be enabled
        const saveButton = screen.getByRole('button', {name: /save/i});
        await waitFor(() => {
            expect(saveButton).not.toBeDisabled();
        });

        // Click save button
        await userEvent.click(saveButton);

        // patchConfig should be called
        await waitFor(() => {
            expect(mockPatchConfig).toHaveBeenCalled();
        });
    });
});
