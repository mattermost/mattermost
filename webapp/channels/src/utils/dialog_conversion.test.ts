// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AppFormValues} from '@mattermost/types/apps';
import type {DialogElement} from '@mattermost/types/integrations';

import {
    convertDialogToAppForm,
    convertAppFormValuesToDialogSubmission,
    DialogElementTypes,
    getDefaultValue,
    getFieldType,
    getOptions,
    sanitizeString,
    validateDialogElement,
    ValidationErrorCode,
    type ConversionOptions,
} from './dialog_conversion';

describe('dialog_conversion', () => {
    describe('sanitizeString', () => {
        it('should escape HTML characters', () => {
            expect(sanitizeString('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
            expect(sanitizeString('<div>content</div>')).toBe('&lt;div&gt;content&lt;/div&gt;');
            expect(sanitizeString('Text with & symbols')).toBe('Text with &amp; symbols');
        });

        it('should handle null and undefined values', () => {
            expect(sanitizeString(null)).toBe('null');
            expect(sanitizeString(undefined)).toBe('undefined');
        });

        it('should handle empty strings', () => {
            expect(sanitizeString('')).toBe('');
        });

        it('should preserve safe content', () => {
            expect(sanitizeString('Hello world')).toBe('Hello world');
            expect(sanitizeString('Hello 世界')).toBe('Hello 世界');
            expect(sanitizeString('Emoji: 🌟')).toBe('Emoji: 🌟');
        });
    });

    describe('validateDialogElement', () => {
        it('should validate required fields', () => {
            const element = {
                name: 'test_field',
                type: 'text',
                display_name: 'Test Field',
                optional: false,
            } as DialogElement;

            const errors = validateDialogElement(element, 0, {enhanced: false});
            expect(errors).toHaveLength(0);
        });

        it('should return error for missing name', () => {
            const element = {
                name: '',
                type: 'text',
                display_name: 'Test Field',
                optional: false,
            } as DialogElement;

            const errors = validateDialogElement(element, 0, {enhanced: false});
            expect(errors).toHaveLength(1);
            expect(errors[0].field).toBe('elements[0].name');
            expect(errors[0].code).toBe(ValidationErrorCode.REQUIRED);
        });

        it('should return error for missing display_name', () => {
            const element = {
                name: 'test_field',
                type: 'text',
                display_name: '',
                optional: false,
            } as DialogElement;

            const errors = validateDialogElement(element, 0, {enhanced: false});
            expect(errors).toHaveLength(1);
            expect(errors[0].field).toBe('elements[0].display_name');
            expect(errors[0].code).toBe(ValidationErrorCode.REQUIRED);
        });

        it('should return error for missing type', () => {
            const element = {
                name: 'test_field',
                type: '',
                display_name: 'Test Field',
                optional: false,
            } as DialogElement;

            const errors = validateDialogElement(element, 0, {enhanced: false});
            expect(errors).toHaveLength(1);
            expect(errors[0].field).toBe('elements[0].type');
            expect(errors[0].code).toBe(ValidationErrorCode.REQUIRED);
        });

        it('should validate field length constraints', () => {
            const element = {
                name: 'a'.repeat(301), // Exceeds 300 char limit
                type: 'text',
                display_name: 'b'.repeat(25), // Exceeds 24 char limit
                optional: false,
            } as DialogElement;

            const errors = validateDialogElement(element, 0, {enhanced: false});
            expect(errors).toHaveLength(2);
            expect(errors[0].code).toBe(ValidationErrorCode.TOO_LONG);
            expect(errors[1].code).toBe(ValidationErrorCode.TOO_LONG);
        });

        it('should validate select field options', () => {
            const element = {
                name: 'test_select',
                type: 'select',
                display_name: 'Test Select',
                optional: false,
                options: [
                    {text: 'Option 1', value: 'opt1'},
                    {text: '', value: 'opt2'}, // Missing text
                    {text: 'Option 3', value: ''}, // Missing value
                ],
            } as DialogElement;

            const errors = validateDialogElement(element, 0, {enhanced: false});
            expect(errors).toHaveLength(2);
            expect(errors[0].field).toBe('elements[0].options[1].text');
            expect(errors[0].code).toBe(ValidationErrorCode.REQUIRED);
            expect(errors[1].field).toBe('elements[0].options[2].value');
            expect(errors[1].code).toBe(ValidationErrorCode.REQUIRED);
        });

        it('should validate text field constraints', () => {
            const element = {
                name: 'test_text',
                type: 'text',
                display_name: 'Test Text',
                optional: false,
                min_length: 10,
                max_length: 5, // Invalid: min > max
            } as DialogElement;

            const errors = validateDialogElement(element, 0, {enhanced: false});
            expect(errors).toHaveLength(1);
            expect(errors[0].field).toBe('elements[0].min_length');
            expect(errors[0].code).toBe(ValidationErrorCode.INVALID_FORMAT);
        });

        it('should validate select field with both options and data_source', () => {
            const element = {
                name: 'test_select',
                type: 'select',
                display_name: 'Test Select',
                optional: false,
                options: [{text: 'Option 1', value: 'opt1'}],
                data_source: 'users', // Invalid: can't have both
            } as DialogElement;

            const errors = validateDialogElement(element, 0, {enhanced: false});
            expect(errors).toHaveLength(1);
            expect(errors[0].field).toBe('elements[0].options');
            expect(errors[0].code).toBe(ValidationErrorCode.INVALID_FORMAT);
        });
    });

    describe('getFieldType', () => {
        it('should map text fields correctly', () => {
            expect(getFieldType({type: DialogElementTypes.TEXT} as DialogElement)).toBe('text');
            expect(getFieldType({type: DialogElementTypes.TEXTAREA} as DialogElement)).toBe('text');
        });

        it('should map boolean fields correctly', () => {
            expect(getFieldType({type: DialogElementTypes.BOOL} as DialogElement)).toBe('bool');
        });

        it('should map select fields correctly', () => {
            expect(getFieldType({type: DialogElementTypes.SELECT} as DialogElement)).toBe('static_select');
            expect(getFieldType({type: DialogElementTypes.RADIO} as DialogElement)).toBe('radio');
        });

        it('should map select fields with data_source correctly', () => {
            expect(getFieldType({type: DialogElementTypes.SELECT, data_source: 'users'} as DialogElement)).toBe('user');
            expect(getFieldType({type: DialogElementTypes.SELECT, data_source: 'channels'} as DialogElement)).toBe('channel');
            expect(getFieldType({type: DialogElementTypes.SELECT, data_source: 'dynamic'} as DialogElement)).toBe('dynamic_select');
        });

        it('should return null for unknown types', () => {
            expect(getFieldType({type: 'unknown'} as DialogElement)).toBeNull();
        });
    });

    describe('getDefaultValue', () => {
        it('should return null for null/undefined defaults', () => {
            expect(getDefaultValue({default: null} as unknown as DialogElement)).toBeNull();
            expect(getDefaultValue({default: undefined} as unknown as DialogElement)).toBeNull();
            expect(getDefaultValue({} as unknown as DialogElement)).toBeNull();
        });

        it('should handle multiselect defaults with comma-separated values', () => {
            const element = {
                type: 'select',
                multiselect: true,
                default: 'option1,option2',
                options: [
                    {text: 'Option 1', value: 'option1'},
                    {text: 'Option 2', value: 'option2'},
                    {text: 'Option 3', value: 'option3'},
                ],
            } as DialogElement;

            const result = getDefaultValue(element);
            expect(result).toEqual([
                {label: 'Option 1', value: 'option1'},
                {label: 'Option 2', value: 'option2'},
            ]);
        });

        it('should handle multiselect defaults with spaced comma-separated values', () => {
            const element = {
                type: 'select',
                multiselect: true,
                default: 'option1, option2, option3',
                options: [
                    {text: 'Option 1', value: 'option1'},
                    {text: 'Option 2', value: 'option2'},
                    {text: 'Option 3', value: 'option3'},
                ],
            } as DialogElement;

            const result = getDefaultValue(element);
            expect(result).toEqual([
                {label: 'Option 1', value: 'option1'},
                {label: 'Option 2', value: 'option2'},
                {label: 'Option 3', value: 'option3'},
            ]);
        });

        it('should handle multiselect defaults with array input', () => {
            const element = {
                type: 'select',
                multiselect: true,
                default: ['option1', 'option3'],
                options: [
                    {text: 'Option 1', value: 'option1'},
                    {text: 'Option 2', value: 'option2'},
                    {text: 'Option 3', value: 'option3'},
                ],
            } as unknown as DialogElement;

            const result = getDefaultValue(element);
            expect(result).toEqual([
                {label: 'Option 1', value: 'option1'},
                {label: 'Option 3', value: 'option3'},
            ]);
        });

        it('should handle multiselect defaults with invalid options gracefully', () => {
            const element = {
                type: 'select',
                multiselect: true,
                default: 'option1,invalid_option,option2',
                options: [
                    {text: 'Option 1', value: 'option1'},
                    {text: 'Option 2', value: 'option2'},
                ],
            } as DialogElement;

            const result = getDefaultValue(element);
            expect(result).toEqual([
                {label: 'Option 1', value: 'option1'},
                {label: 'Option 2', value: 'option2'},
            ]);
        });

        it('should return null for multiselect with no valid defaults', () => {
            const element = {
                type: 'select',
                multiselect: true,
                default: 'invalid1,invalid2',
                options: [
                    {text: 'Option 1', value: 'option1'},
                    {text: 'Option 2', value: 'option2'},
                ],
            } as DialogElement;

            const result = getDefaultValue(element);
            expect(result).toBeNull();
        });

        it('should return null for multiselect with empty default', () => {
            const element = {
                type: 'select',
                multiselect: true,
                default: '',
                options: [
                    {text: 'Option 1', value: 'option1'},
                    {text: 'Option 2', value: 'option2'},
                ],
            } as DialogElement;

            const result = getDefaultValue(element);
            expect(result).toBeNull();
        });

        it('should handle boolean defaults', () => {
            expect(getDefaultValue({type: DialogElementTypes.BOOL, default: 'true'} as DialogElement)).toBe(true);
            expect(getDefaultValue({type: DialogElementTypes.BOOL, default: 'false'} as DialogElement)).toBe(false);
            expect(getDefaultValue({type: DialogElementTypes.BOOL, default: 'TRUE'} as DialogElement)).toBe(true);
            expect(getDefaultValue({type: DialogElementTypes.BOOL, default: 'FALSE'} as DialogElement)).toBe(false);
            expect(getDefaultValue({type: DialogElementTypes.BOOL, default: '1'} as DialogElement)).toBe(true);
            expect(getDefaultValue({type: DialogElementTypes.BOOL, default: 'yes'} as DialogElement)).toBe(true);
            expect(getDefaultValue({type: DialogElementTypes.BOOL, default: true} as unknown as DialogElement)).toBe(true);
        });

        it('should handle text defaults', () => {
            expect(getDefaultValue({type: DialogElementTypes.TEXT, default: 'hello'} as DialogElement)).toBe('hello');
            expect(getDefaultValue({type: DialogElementTypes.TEXTAREA, default: 'world'} as DialogElement)).toBe('world');
        });

        it('should handle select defaults', () => {
            const element = {
                type: 'select',
                default: 'option1',
                options: [
                    {text: 'Option 1', value: 'option1'},
                    {text: 'Option 2', value: 'option2'},
                ],
            } as DialogElement;

            const result = getDefaultValue(element);
            expect(result).toEqual({
                label: 'Option 1',
                value: 'option1',
            });
        });

        it('should handle select defaults with missing option', () => {
            const element = {
                type: 'select',
                default: 'nonexistent',
                options: [
                    {text: 'Option 1', value: 'option1'},
                ],
            } as DialogElement;

            const result = getDefaultValue(element);
            expect(result).toBeNull();
        });

        it('should handle radio defaults', () => {
            const element = {
                type: 'radio',
                default: 'option1',
                options: [
                    {text: 'Option 1', value: 'option1'},
                    {text: 'Option 2', value: 'option2'},
                ],
            } as DialogElement;

            const result = getDefaultValue(element);
            expect(result).toEqual({
                label: 'Option 1',
                value: 'option1',
            });
        });

        it('should handle dynamic select defaults', () => {
            const element = {
                type: 'select',
                data_source: 'dynamic',
                default: 'preset_value',
            } as DialogElement;

            const result = getDefaultValue(element);
            expect(result).toEqual({
                label: 'preset_value',
                value: 'preset_value',
            });
        });

        it('should handle empty default for dynamic select', () => {
            const element = {
                type: 'select',
                data_source: 'dynamic',
                default: '',
            } as DialogElement;

            const result = getDefaultValue(element);
            expect(result).toBeNull();
        });
    });

    describe('getOptions', () => {
        it('should convert dialog options to app options', () => {
            const element = {
                type: 'select',
                options: [
                    {text: 'Option 1', value: 'opt1'},
                    {text: 'Option 2', value: 'opt2'},
                ],
            } as DialogElement;

            const result = getOptions(element);
            expect(result).toEqual([
                {label: 'Option 1', value: 'opt1'},
                {label: 'Option 2', value: 'opt2'},
            ]);
        });

        it('should handle undefined options', () => {
            const element = {
                type: 'select',
            } as unknown as DialogElement;

            expect(getOptions(element)).toBeUndefined();
        });

        it('should handle empty options array', () => {
            const element = {
                type: 'select',
                options: [],
            } as unknown as DialogElement;

            expect(getOptions(element)).toEqual([]);
        });

        it('should handle options with empty text/value', () => {
            const element = {
                type: 'select',
                options: [
                    {text: '', value: ''},
                    {text: 'Valid', value: 'valid'},
                ],
            } as unknown as DialogElement;

            const result = getOptions(element);
            expect(result).toEqual([
                {label: '', value: ''},
                {label: 'Valid', value: 'valid'},
            ]);
        });
    });

    describe('convertDialogToAppForm', () => {
        const legacyOptions: ConversionOptions = {enhanced: false};
        const enhancedOptions: ConversionOptions = {enhanced: true};

        it('should convert basic dialog to app form', () => {
            const elements: DialogElement[] = [
                {
                    name: 'text_field',
                    type: 'text',
                    display_name: 'Text Field',
                    optional: false,
                } as DialogElement,
            ];

            const {form, errors} = convertDialogToAppForm(
                elements,
                'Test Dialog',
                'Test description',
                undefined,
                undefined,
                legacyOptions,
            );

            expect(errors).toHaveLength(0);
            expect(form).toBeDefined();
            expect(form.title).toBe('Test Dialog');
            expect(form.header).toBe('Test description');
            expect(form.fields).toHaveLength(1);
            expect(form.fields?.[0].name).toBe('text_field');
            expect(form.fields?.[0].type).toBe('text');
            expect(form.fields?.[0].label).toBe('Text Field');
            expect(form.fields?.[0].is_required).toBe(true);
        });

        it('should sanitize introduction text', () => {
            const {form} = convertDialogToAppForm(
                [],
                'Test Dialog',
                '<script>alert("xss")</script>Description',
                undefined,
                undefined,
                legacyOptions,
            );

            expect(form.header).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;Description');
        });

        it('should handle empty elements array', () => {
            const {form, errors} = convertDialogToAppForm(
                [],
                'Test Dialog',
                undefined,
                undefined,
                undefined,
                legacyOptions,
            );

            expect(errors).toHaveLength(0);
            expect(form).toBeDefined();
            expect(form.fields).toHaveLength(0);
        });

        it('should handle undefined elements', () => {
            const {form, errors} = convertDialogToAppForm(
                undefined,
                'Test Dialog',
                undefined,
                undefined,
                undefined,
                legacyOptions,
            );

            expect(errors).toHaveLength(0);
            expect(form).toBeDefined();
            expect(form.fields).toHaveLength(0);
        });

        it('should skip unknown field types in legacy mode', () => {
            const elements: DialogElement[] = [
                {
                    name: 'unknown_field',
                    type: 'unknown' as any,
                    display_name: 'Unknown Field',
                    optional: false,
                } as DialogElement,
                {
                    name: 'text_field',
                    type: 'text',
                    display_name: 'Text Field',
                    optional: false,
                } as DialogElement,
            ];

            const {form, errors} = convertDialogToAppForm(
                elements,
                'Test Dialog',
                undefined,
                undefined,
                undefined,
                legacyOptions,
            );

            expect(errors).toHaveLength(1);
            expect(errors[0].code).toBe(ValidationErrorCode.INVALID_TYPE);
            expect(form.fields).toHaveLength(2); // Both fields included in legacy mode
            expect(form.fields?.[0].name).toBe('unknown_field');
            expect(form.fields?.[0].type).toBe('text'); // Converted to text as fallback
            expect(form.fields?.[1].name).toBe('text_field');
        });

        it('should validate in enhanced mode', () => {
            const elements: DialogElement[] = [
                {
                    name: '', // Invalid name
                    type: 'text',
                    display_name: 'Text Field',
                    optional: false,
                } as DialogElement,
            ];

            // Suppress console warnings for this test
            const originalWarn = console.warn;
            console.warn = jest.fn();

            const {form, errors} = convertDialogToAppForm(
                elements,
                'Test Dialog',
                undefined,
                undefined,
                undefined,
                enhancedOptions,
            );

            console.warn = originalWarn;

            expect(errors).toHaveLength(1);
            expect(errors[0].field).toBe('elements[0].name');
            expect(errors[0].code).toBe(ValidationErrorCode.REQUIRED);
            expect(form.fields).toHaveLength(1); // Fields are still included - validation is non-blocking
        });

        it('should validate title in enhanced mode', () => {
            const {form, errors} = convertDialogToAppForm(
                [],
                '', // Invalid title
                undefined,
                undefined,
                undefined,
                enhancedOptions,
            );

            expect(errors).toHaveLength(1);
            expect(errors[0].field).toBe('title');
            expect(errors[0].code).toBe(ValidationErrorCode.REQUIRED);
            expect(form.title).toBe(''); // Still creates form with empty title
        });

        it('should convert different field types correctly', () => {
            const elements: DialogElement[] = [
                {
                    name: 'text_field',
                    type: 'text',
                    display_name: 'Text Field',
                    optional: false,
                } as DialogElement,
                {
                    name: 'textarea_field',
                    type: 'textarea',
                    display_name: 'Textarea Field',
                    optional: true,
                } as DialogElement,
                {
                    name: 'bool_field',
                    type: 'bool',
                    display_name: 'Boolean Field',
                    optional: false,
                } as DialogElement,
                {
                    name: 'select_field',
                    type: 'select',
                    display_name: 'Select Field',
                    optional: false,
                    options: [
                        {text: 'Option 1', value: 'opt1'},
                        {text: 'Option 2', value: 'opt2'},
                    ],
                } as DialogElement,
                {
                    name: 'radio_field',
                    type: 'radio',
                    display_name: 'Radio Field',
                    optional: false,
                    options: [
                        {text: 'Option A', value: 'optA'},
                        {text: 'Option B', value: 'optB'},
                    ],
                } as DialogElement,
            ];

            const {form, errors} = convertDialogToAppForm(
                elements,
                'Test Dialog',
                undefined,
                undefined,
                undefined,
                legacyOptions,
            );

            expect(errors).toHaveLength(0);
            expect(form.fields).toHaveLength(5);
            expect(form.fields?.[0].type).toBe('text');
            expect(form.fields?.[1].type).toBe('text');
            expect(form.fields?.[1].subtype).toBe('textarea');
            expect(form.fields?.[2].type).toBe('bool');
            expect(form.fields?.[3].type).toBe('static_select');
            expect(form.fields?.[4].type).toBe('radio');
        });

        it('should convert multiselect field correctly', () => {
            const elements: DialogElement[] = [
                {
                    name: 'multiselect_field',
                    type: 'select',
                    display_name: 'Multiselect Field',
                    optional: false,
                    multiselect: true,
                    default: 'opt1,opt3',
                    options: [
                        {text: 'Option 1', value: 'opt1'},
                        {text: 'Option 2', value: 'opt2'},
                        {text: 'Option 3', value: 'opt3'},
                    ],
                } as DialogElement,
            ];

            const {form, errors} = convertDialogToAppForm(
                elements,
                'Test Dialog',
                undefined,
                undefined,
                undefined,
                legacyOptions,
            );

            expect(errors).toHaveLength(0);
            expect(form.fields).toHaveLength(1);
            expect(form.fields?.[0].type).toBe('static_select');
            expect(form.fields?.[0].multiselect).toBe(true);
            expect(form.fields?.[0].value).toEqual([
                {label: 'Option 1', value: 'opt1'},
                {label: 'Option 3', value: 'opt3'},
            ]);
        });

        it('should handle unknown field types gracefully in legacy mode', () => {
            const elements: DialogElement[] = [
                {
                    name: 'unknown_field',
                    type: 'unknown_type' as any,
                    display_name: 'Unknown Field',
                    optional: false,
                } as DialogElement,
                {
                    name: 'valid_field',
                    type: 'text',
                    display_name: 'Valid Field',
                    optional: false,
                } as DialogElement,
            ];

            const {form, errors} = convertDialogToAppForm(
                elements,
                'Test Dialog',
                undefined,
                undefined,
                undefined,
                legacyOptions,
            );

            expect(errors).toHaveLength(1);
            expect(errors[0].code).toBe(ValidationErrorCode.INVALID_TYPE);
            expect(form.fields).toHaveLength(2); // Both fields included in legacy mode
            expect(form.fields?.[0].name).toBe('unknown_field');
            expect(form.fields?.[0].type).toBe('text'); // Converted to text as fallback
            expect(form.fields?.[0].description).toBe('This field could not be converted properly');
            expect(form.fields?.[1].name).toBe('valid_field');
        });

        it('should convert dynamic select element with data_source_url', () => {
            const elements: DialogElement[] = [
                {
                    name: 'dynamic_field',
                    type: 'select',
                    display_name: 'Dynamic Field',
                    data_source: 'dynamic',
                    data_source_url: '/plugins/myplugin/lookup',
                    optional: false,
                } as DialogElement,
            ];

            const {form, errors} = convertDialogToAppForm(
                elements,
                'Test Dialog',
                undefined,
                undefined,
                undefined,
                legacyOptions,
            );

            expect(errors).toHaveLength(0);
            expect(form.fields).toHaveLength(1);
            expect(form.fields?.[0].type).toBe('dynamic_select');
            expect(form.fields?.[0].lookup?.path).toBe('/plugins/myplugin/lookup');
        });

        it('should convert dynamic select element without data_source_url', () => {
            const elements: DialogElement[] = [
                {
                    name: 'dynamic_field',
                    type: 'select',
                    display_name: 'Dynamic Field',
                    data_source: 'dynamic',
                    optional: false,
                } as DialogElement,
            ];

            const {form, errors} = convertDialogToAppForm(
                elements,
                'Test Dialog',
                undefined,
                undefined,
                undefined,
                legacyOptions,
            );

            expect(errors).toHaveLength(0);
            expect(form.fields).toHaveLength(1);
            expect(form.fields?.[0].type).toBe('dynamic_select');
            expect(form.fields?.[0].lookup?.path).toBe('');
        });
    });

    describe('convertAppFormValuesToDialogSubmission', () => {
        const legacyOptions: ConversionOptions = {enhanced: false};
        const enhancedOptions: ConversionOptions = {enhanced: true};

        it('should convert basic app form values to dialog submission', () => {
            const values = {
                text_field: 'Hello World',
                bool_field: true,
                number_field: '42',
            };

            const elements: DialogElement[] = [
                {name: 'text_field', type: 'text', display_name: 'Text Field', optional: false} as DialogElement,
                {name: 'bool_field', type: 'bool', display_name: 'Bool Field', optional: false} as DialogElement,
                {name: 'number_field', type: 'text', subtype: 'number', display_name: 'Number Field', optional: false} as DialogElement,
            ];

            const {submission, errors} = convertAppFormValuesToDialogSubmission(
                values,
                elements,
                legacyOptions,
            );

            expect(errors).toHaveLength(0);
            expect(submission).toEqual({
                text_field: 'Hello World',
                bool_field: true,
                number_field: 42,
            });
        });

        it('should handle select field values', () => {
            const values = {
                select_field: {label: 'Option 1', value: 'opt1'},
            } as unknown as AppFormValues;

            const elements: DialogElement[] = [
                {
                    name: 'select_field',
                    type: 'select',
                    display_name: 'Select Field',
                    optional: false,
                    options: [
                        {text: 'Option 1', value: 'opt1'},
                        {text: 'Option 2', value: 'opt2'},
                    ],
                } as DialogElement,
            ];

            const {submission, errors} = convertAppFormValuesToDialogSubmission(
                values,
                elements,
                legacyOptions,
            );

            expect(errors).toHaveLength(0);
            expect(submission).toEqual({
                select_field: 'opt1',
            });
        });

        it('should handle multiselect field values', () => {
            const values = {
                multiselect_field: [
                    {label: 'Option 1', value: 'opt1'},
                    {label: 'Option 3', value: 'opt3'},
                ],
            } as unknown as AppFormValues;

            const elements: DialogElement[] = [
                {
                    name: 'multiselect_field',
                    type: 'select',
                    display_name: 'Multiselect Field',
                    optional: false,
                    multiselect: true,
                    options: [
                        {text: 'Option 1', value: 'opt1'},
                        {text: 'Option 2', value: 'opt2'},
                        {text: 'Option 3', value: 'opt3'},
                    ],
                } as DialogElement,
            ];

            const {submission, errors} = convertAppFormValuesToDialogSubmission(
                values,
                elements,
                legacyOptions,
            );

            expect(errors).toHaveLength(0);
            expect(submission).toEqual({
                multiselect_field: ['opt1', 'opt3'],
            });
        });

        it('should validate multiselect field options in enhanced mode', () => {
            const values = {
                multiselect_field: [
                    {label: 'Option 1', value: 'opt1'},
                    {label: 'Invalid Option', value: 'invalid'},
                ],
            } as unknown as AppFormValues;

            const elements: DialogElement[] = [
                {
                    name: 'multiselect_field',
                    type: 'select',
                    display_name: 'Multiselect Field',
                    optional: false,
                    multiselect: true,
                    options: [
                        {text: 'Option 1', value: 'opt1'},
                        {text: 'Option 2', value: 'opt2'},
                    ],
                } as DialogElement,
            ];

            const {submission, errors} = convertAppFormValuesToDialogSubmission(
                values,
                elements,
                enhancedOptions,
            );

            expect(errors).toHaveLength(1);
            expect(errors[0].field).toBe('multiselect_field');
            expect(errors[0].code).toBe(ValidationErrorCode.INVALID_FORMAT);
            expect(errors[0].message).toContain('Selected value not found in options: invalid');
            expect(submission).toEqual({
                multiselect_field: ['opt1'],
            });
        });

        it('should handle multiselect field without options validation', () => {
            const values = {
                multiselect_field: [
                    {label: 'User 1', value: 'user1'},
                    {label: 'User 2', value: 'user2'},
                ],
            } as unknown as AppFormValues;

            const elements: DialogElement[] = [
                {
                    name: 'multiselect_field',
                    type: 'select',
                    display_name: 'Multiselect Field',
                    optional: false,
                    multiselect: true,
                    data_source: 'users',
                } as DialogElement,
            ];

            const {submission, errors} = convertAppFormValuesToDialogSubmission(
                values,
                elements,
                legacyOptions,
            );

            expect(errors).toHaveLength(0);
            expect(submission).toEqual({
                multiselect_field: ['user1', 'user2'],
            });
        });

        it('should handle empty multiselect values', () => {
            const values = {
                multiselect_field: [],
            } as unknown as AppFormValues;

            const elements: DialogElement[] = [
                {
                    name: 'multiselect_field',
                    type: 'select',
                    display_name: 'Multiselect Field',
                    optional: true,
                    multiselect: true,
                    options: [
                        {text: 'Option 1', value: 'opt1'},
                        {text: 'Option 2', value: 'opt2'},
                    ],
                } as DialogElement,
            ];

            const {submission, errors} = convertAppFormValuesToDialogSubmission(
                values,
                elements,
                legacyOptions,
            );

            expect(errors).toHaveLength(0);
            expect(submission).toEqual({
                multiselect_field: [],
            });
        });

        it('should handle radio field values', () => {
            const values = {
                radio_field: 'optA',
            } as unknown as AppFormValues;

            const elements: DialogElement[] = [
                {
                    name: 'radio_field',
                    type: 'radio',
                    display_name: 'Radio Field',
                    optional: false,
                    options: [
                        {text: 'Option A', value: 'optA'},
                        {text: 'Option B', value: 'optB'},
                    ],
                } as DialogElement,
            ];

            const {submission, errors} = convertAppFormValuesToDialogSubmission(
                values,
                elements,
                legacyOptions,
            );

            expect(errors).toHaveLength(0);
            expect(submission).toEqual({
                radio_field: 'optA',
            });
        });

        it('should handle textarea field values', () => {
            const values = {
                textarea_field: 'Long text content',
            } as unknown as AppFormValues;

            const elements: DialogElement[] = [
                {
                    name: 'textarea_field',
                    type: 'textarea',
                    display_name: 'Textarea Field',
                    optional: false,
                } as DialogElement,
            ];

            const {submission, errors} = convertAppFormValuesToDialogSubmission(
                values,
                elements,
                legacyOptions,
            );

            expect(errors).toHaveLength(0);
            expect(submission).toEqual({
                textarea_field: 'Long text content',
            });
        });

        it('should handle number subtype conversion', () => {
            const values = {
                number_field: '123',
                invalid_number: 'not-a-number',
            } as unknown as AppFormValues;

            const elements: DialogElement[] = [
                {name: 'number_field', type: 'text', subtype: 'number', display_name: 'Number Field', optional: false} as DialogElement,
                {name: 'invalid_number', type: 'text', subtype: 'number', display_name: 'Invalid Number', optional: false} as DialogElement,
            ];

            const {submission, errors} = convertAppFormValuesToDialogSubmission(
                values,
                elements,
                legacyOptions,
            );

            expect(errors).toHaveLength(0);
            expect(submission).toEqual({
                number_field: 123,
                invalid_number: 'not-a-number', // Falls back to string
            });
        });

        it('should validate field lengths in enhanced mode', () => {
            const values = {
                text_field: 'a', // Too short
                long_field: 'a'.repeat(200), // Too long
            } as unknown as AppFormValues;

            const elements: DialogElement[] = [
                {
                    name: 'text_field',
                    type: 'text',
                    display_name: 'Text Field',
                    optional: false,
                    min_length: 5,
                } as DialogElement,
                {
                    name: 'long_field',
                    type: 'text',
                    display_name: 'Long Field',
                    optional: false,
                    max_length: 10,
                } as DialogElement,
            ];

            const {submission, errors} = convertAppFormValuesToDialogSubmission(
                values,
                elements,
                enhancedOptions,
            );

            expect(errors).toHaveLength(2);
            expect(errors[0].field).toBe('text_field');
            expect(errors[0].code).toBe(ValidationErrorCode.TOO_SHORT);
            expect(errors[1].field).toBe('long_field');
            expect(errors[1].code).toBe(ValidationErrorCode.TOO_LONG);
            expect(submission).toEqual({
                text_field: 'a',
                long_field: 'a'.repeat(200),
            });
        });

        it('should validate required fields in enhanced mode', () => {
            const values = {
                present_field: 'value',
            } as unknown as AppFormValues;

            const elements: DialogElement[] = [
                {name: 'present_field', type: 'text', display_name: 'Present Field', optional: false} as DialogElement,
                {name: 'missing_field', type: 'text', display_name: 'Missing Field', optional: false} as DialogElement,
                {name: 'optional_field', type: 'text', display_name: 'Optional Field', optional: true} as DialogElement,
            ];

            const {submission, errors} = convertAppFormValuesToDialogSubmission(
                values,
                elements,
                enhancedOptions,
            );

            expect(errors).toHaveLength(1);
            expect(errors[0].field).toBe('missing_field');
            expect(errors[0].code).toBe(ValidationErrorCode.REQUIRED);
            expect(submission).toEqual({
                present_field: 'value',
            });
        });

        it('should validate select field options in enhanced mode', () => {
            const values = {
                select_field: {label: 'Invalid Option', value: 'invalid'},
            } as unknown as AppFormValues;

            const elements: DialogElement[] = [
                {
                    name: 'select_field',
                    type: 'select',
                    display_name: 'Select Field',
                    optional: false,
                    options: [
                        {text: 'Option 1', value: 'opt1'},
                        {text: 'Option 2', value: 'opt2'},
                    ],
                } as DialogElement,
            ];

            const {submission, errors} = convertAppFormValuesToDialogSubmission(
                values,
                elements,
                enhancedOptions,
            );

            expect(errors).toHaveLength(1);
            expect(errors[0].field).toBe('select_field');
            expect(errors[0].code).toBe(ValidationErrorCode.INVALID_FORMAT);
            expect(submission).toEqual({
                select_field: 'invalid',
            });
        });

        it('should handle missing elements gracefully', () => {
            const values = {
                text_field: 'Hello World',
            } as unknown as AppFormValues;

            const {submission, errors} = convertAppFormValuesToDialogSubmission(
                values,
                undefined,
                legacyOptions,
            );

            expect(errors).toHaveLength(0);
            expect(submission).toEqual({});
        });

        it('should handle extra values not in elements', () => {
            const values = {
                text_field: 'Hello World',
                extra_field: 'Extra Value',
            } as unknown as AppFormValues;

            const elements: DialogElement[] = [
                {name: 'text_field', type: 'text', display_name: 'Text Field', optional: false} as DialogElement,
            ];

            const {submission, errors} = convertAppFormValuesToDialogSubmission(
                values,
                elements,
                legacyOptions,
            );

            expect(errors).toHaveLength(0);
            expect(submission).toEqual({
                text_field: 'Hello World',

                // extra_field is not included since it's not in elements
            });
        });

        it('should handle select field with non-object value', () => {
            const values = {
                select_field: 'direct_value',
            } as unknown as AppFormValues;

            const elements: DialogElement[] = [
                {
                    name: 'select_field',
                    type: 'select',
                    display_name: 'Select Field',
                    optional: false,
                    options: [
                        {text: 'Option 1', value: 'opt1'},
                        {text: 'Option 2', value: 'opt2'},
                    ],
                } as DialogElement,
            ];

            const {submission, errors} = convertAppFormValuesToDialogSubmission(
                values,
                elements,
                legacyOptions,
            );

            expect(errors).toHaveLength(0);
            expect(submission).toEqual({
                select_field: 'direct_value',
            });
        });
    });
});
