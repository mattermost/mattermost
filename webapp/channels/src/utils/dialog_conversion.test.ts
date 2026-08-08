// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AppFormValues} from '@mattermost/types/apps';
import type {DialogElement} from '@mattermost/types/integrations';

import {
    convertDialogToAppForm,
    convertAppFormValuesToDialogSubmission,
    convertElement,
    DialogElementTypes,
    extractPrimitiveValues,
    flattenDialogElements,
    getDefaultValue,
    getFieldType,
    getOptions,
    validateDialogElement,
    ValidationErrorCode,
    type ConversionOptions,
} from './dialog_conversion';

describe('dialog_conversion', () => {
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

        it('should map file fields to FILE type', () => {
            expect(getFieldType({type: DialogElementTypes.FILE} as DialogElement)).toBe('file');
        });

        it('should map date fields correctly', () => {
            expect(getFieldType({type: DialogElementTypes.DATE} as DialogElement)).toBe('date');
        });

        it('should map datetime fields correctly', () => {
            expect(getFieldType({type: DialogElementTypes.DATETIME} as DialogElement)).toBe('datetime');
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

            // Radio defaults are plain strings (not {label, value} objects)
            // because RadioSetting.onChange returns e.target.value (a string)
            expect(result).toBe('option1');
        });

        it('should return null for radio default that does not match any option', () => {
            const element = {
                type: 'radio',
                default: 'stale_value',
                options: [
                    {text: 'Option 1', value: 'option1'},
                    {text: 'Option 2', value: 'option2'},
                ],
            } as DialogElement;

            const result = getDefaultValue(element);
            expect(result).toBeNull();
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

        it('should handle dynamic multiselect defaults with comma-separated values', () => {
            const element = {
                type: 'select',
                data_source: 'dynamic',
                multiselect: true,
                default: 'Product1,Product2',
            } as DialogElement;

            const result = getDefaultValue(element);
            expect(result).toEqual([
                {label: 'Product1', value: 'Product1'},
                {label: 'Product2', value: 'Product2'},
            ]);
        });

        it('should handle dynamic multiselect defaults with spaced comma-separated values', () => {
            const element = {
                type: 'select',
                data_source: 'dynamic',
                multiselect: true,
                default: 'Product1, Product2, Product3',
            } as DialogElement;

            const result = getDefaultValue(element);
            expect(result).toEqual([
                {label: 'Product1', value: 'Product1'},
                {label: 'Product2', value: 'Product2'},
                {label: 'Product3', value: 'Product3'},
            ]);
        });

        it('should handle dynamic multiselect defaults with array input', () => {
            const element = {
                type: 'select',
                data_source: 'dynamic',
                multiselect: true,
                default: ['Product1', 'Product2'],
            } as unknown as DialogElement;

            const result = getDefaultValue(element);
            expect(result).toEqual([
                {label: 'Product1', value: 'Product1'},
                {label: 'Product2', value: 'Product2'},
            ]);
        });

        it('should handle dynamic single select default unchanged', () => {
            const element = {
                type: 'select',
                data_source: 'dynamic',
                default: 'Product1,Product2',
            } as DialogElement;

            const result = getDefaultValue(element);
            expect(result).toEqual({
                label: 'Product1,Product2',
                value: 'Product1,Product2',
            });
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
                'http://example.com',
                '',
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

        it('should pass introduction text without escaping (Markdown.format handles sanitization)', () => {
            const {form} = convertDialogToAppForm(
                [],
                'Test Dialog',
                '<script>alert("xss")</script>Description',
                undefined,
                undefined,
                'http://example.com',
                '',
                legacyOptions,
            );

            // Introduction text should be passed through as-is without escaping
            // Markdown.format() in DialogIntroductionText component handles sanitization
            // This prevents double-escaping of legitimate markdown (e.g., angle brackets in code blocks)
            expect(form.header).toBe('<script>alert("xss")</script>Description');
        });

        it('should preserve angle brackets in markdown code blocks (no double-escaping)', () => {
            const introText = '* test `< or >`\n* test < or >\n`< or >`\n';
            const {form} = convertDialogToAppForm(
                [],
                'Test Dialog',
                introText,
                undefined,
                undefined,
                'http://example.com',
                '',
                legacyOptions,
            );

            // Should pass through raw markdown without escaping angle brackets
            // Markdown.format() will handle this correctly - angle brackets in code blocks
            // will display as < and >, while angle brackets outside code blocks will be escaped
            expect(form.header).toBe(introText);
        });

        it('should handle empty elements array', () => {
            const {form, errors} = convertDialogToAppForm(
                [],
                'Test Dialog',
                undefined,
                undefined,
                undefined,
                'http://example.com',
                '',
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
                'http://example.com',
                '',
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
                'http://example.com',
                '',
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
                'http://example.com',
                '',
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
                'http://example.com',
                '',
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
                'http://example.com',
                '',
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
                'http://example.com',
                '',
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
                'http://example.com',
                '',
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
                'http://example.com',
                '',
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
                'http://example.com',
                '',
                legacyOptions,
            );

            expect(errors).toHaveLength(0);
            expect(form.fields).toHaveLength(1);
            expect(form.fields?.[0].type).toBe('dynamic_select');
            expect(form.fields?.[0].lookup?.path).toBe('');
        });

        it('should handle refresh property for select fields', () => {
            const elements: DialogElement[] = [
                {
                    name: 'refreshable_select',
                    type: 'select',
                    display_name: 'Refreshable Select',
                    optional: false,
                    refresh: true,
                    options: [
                        {text: 'Option A', value: 'optA'},
                        {text: 'Option B', value: 'optB'},
                    ],
                } as DialogElement,
                {
                    name: 'normal_select',
                    type: 'select',
                    display_name: 'Normal Select',
                    optional: false,
                    options: [
                        {text: 'Option X', value: 'optX'},
                    ],
                } as DialogElement,
            ];

            const {form, errors} = convertDialogToAppForm(
                elements,
                'Test Dialog',
                undefined,
                undefined,
                undefined,
                'http://example.com',
                '',
                legacyOptions,
            );

            expect(errors).toHaveLength(0);
            expect(form.fields).toHaveLength(2);

            // Check that refresh property is copied
            expect(form.fields?.[0].refresh).toBe(true);
            expect(form.fields?.[1].refresh).toBeUndefined();
        });

        it('should set source property from sourceUrl parameter', () => {
            const {form, errors} = convertDialogToAppForm(
                [],
                'Test Dialog',
                undefined,
                undefined,
                undefined,
                'http://example.com/source',
                '',
                legacyOptions,
            );

            expect(errors).toHaveLength(0);
            expect(form.source).toBeDefined();
            expect(form.source?.path).toBe('http://example.com/source');
            expect(form.source?.expand).toEqual({});
        });

        it('should not set source property when sourceUrl is empty and no refresh fields', () => {
            const {form, errors} = convertDialogToAppForm(
                [],
                'Test Dialog',
                undefined,
                undefined,
                undefined,
                '', // Empty sourceUrl
                '',
                legacyOptions,
            );

            expect(errors).toHaveLength(0);
            expect(form.source).toBeUndefined();
        });

        it('should set default source when refresh fields exist but no sourceUrl', () => {
            const elements: DialogElement[] = [
                {
                    name: 'refreshable_select',
                    type: 'select',
                    display_name: 'Refreshable Select',
                    optional: false,
                    refresh: true,
                    options: [
                        {text: 'Option A', value: 'optA'},
                    ],
                } as DialogElement,
            ];

            const {form, errors} = convertDialogToAppForm(
                elements,
                'Test Dialog',
                undefined,
                undefined,
                undefined,
                '', // Empty sourceUrl but has refresh fields
                '',
                legacyOptions,
            );

            expect(errors).toHaveLength(0);
            expect(form.source).toBeDefined();
            expect(form.source?.path).toBe('/refresh'); // Default path
            expect(form.fields?.[0].refresh).toBe(true);
        });

        it('should handle refresh property for date and datetime fields', () => {
            const elements: DialogElement[] = [
                {
                    name: 'refreshable_date',
                    type: 'date',
                    display_name: 'Refreshable Date',
                    optional: false,
                    refresh: true,
                } as DialogElement,
                {
                    name: 'refreshable_datetime',
                    type: 'datetime',
                    display_name: 'Refreshable Datetime',
                    optional: false,
                    refresh: true,
                } as DialogElement,
                {
                    name: 'non_refreshable_date',
                    type: 'date',
                    display_name: 'Non-Refreshable Date',
                    optional: false,
                } as DialogElement,
            ];

            const {form, errors} = convertDialogToAppForm(
                elements,
                'Test Dialog',
                undefined,
                undefined,
                undefined,
                'http://example.com/source',
                '',
                legacyOptions,
            );

            expect(errors).toHaveLength(0);
            expect(form.fields).toHaveLength(3);
            expect(form.fields?.[0].refresh).toBe(true);
            expect(form.fields?.[1].refresh).toBe(true);
            expect(form.fields?.[2].refresh).toBeUndefined();
        });

        it('should include state in submit and source AppCall objects', () => {
            const elements: DialogElement[] = [
                {
                    name: 'test_field',
                    type: 'text',
                    display_name: 'Test Field',
                    optional: false,
                    refresh: true,
                } as DialogElement,
            ];

            const {form, errors} = convertDialogToAppForm(
                elements,
                'Test Dialog',
                undefined,
                undefined,
                undefined,
                'http://example.com/source',
                'step1_data', // State parameter
                legacyOptions,
            );

            expect(errors).toHaveLength(0);
            expect(form.submit?.state).toBe('step1_data');
            expect(form.source?.state).toBe('step1_data');
        });

        it('should not include undefined state in AppCall objects', () => {
            const {form, errors} = convertDialogToAppForm(
                [],
                'Test Dialog',
                undefined,
                undefined,
                undefined,
                'http://example.com/source',
                '', // Empty state
                legacyOptions,
            );

            expect(errors).toHaveLength(0);
            expect(form.submit?.state).toBeUndefined();
            expect(form.source?.state).toBeUndefined();
        });

        it('should convert file element to FILE field type', () => {
            const elements: DialogElement[] = [
                {
                    name: 'file_field',
                    type: 'file',
                    display_name: 'Upload File',
                    optional: false,
                } as DialogElement,
            ];

            const {form, errors} = convertDialogToAppForm(
                elements,
                'Test Dialog',
                undefined,
                undefined,
                undefined,
                'http://example.com',
                '',
                legacyOptions,
            );

            expect(errors).toHaveLength(0);
            expect(form.fields).toHaveLength(1);
            expect(form.fields?.[0].type).toBe('file');
            expect(form.fields?.[0].name).toBe('file_field');
            expect(form.fields?.[0].label).toBe('Upload File');
        });

        it('should preserve allow_multiple property on file fields', () => {
            const elements: DialogElement[] = [
                {
                    name: 'file_field',
                    type: 'file',
                    display_name: 'Upload Files',
                    optional: false,
                    allow_multiple: true,
                } as DialogElement,
            ];

            const {form, errors} = convertDialogToAppForm(
                elements,
                'Test Dialog',
                undefined,
                undefined,
                undefined,
                'http://example.com',
                '',
                legacyOptions,
            );

            expect(errors).toHaveLength(0);
            expect(form.fields?.[0].allow_multiple).toBe(true);
        });

        it('should not set allow_multiple if not present on file fields', () => {
            const elements: DialogElement[] = [
                {
                    name: 'file_field',
                    type: 'file',
                    display_name: 'Upload File',
                    optional: false,
                } as DialogElement,
            ];

            const {form, errors} = convertDialogToAppForm(
                elements,
                'Test Dialog',
                undefined,
                undefined,
                undefined,
                'http://example.com',
                '',
                legacyOptions,
            );

            expect(errors).toHaveLength(0);
            expect(form.fields?.[0].allow_multiple).toBeUndefined();
        });

        it('should handle file elements with placeholder and help text', () => {
            const elements: DialogElement[] = [
                {
                    name: 'file_field',
                    type: 'file',
                    display_name: 'Upload File',
                    placeholder: 'Choose a file to upload',
                    help_text: 'Supported formats: PDF, PNG, JPG',
                    optional: false,
                } as DialogElement,
            ];

            const {form, errors} = convertDialogToAppForm(
                elements,
                'Test Dialog',
                undefined,
                undefined,
                undefined,
                'http://example.com',
                '',
                legacyOptions,
            );

            expect(errors).toHaveLength(0);
            expect(form.fields?.[0].hint).toBe('Choose a file to upload');
            expect(form.fields?.[0].description).toBe('Supported formats: PDF, PNG, JPG');
        });

        it('should handle multiple file upload fields with different settings', () => {
            const elements: DialogElement[] = [
                {
                    name: 'single_file',
                    type: 'file',
                    display_name: 'Single File',
                    optional: false,
                } as DialogElement,
                {
                    name: 'multi_files',
                    type: 'file',
                    display_name: 'Multiple Files',
                    optional: true,
                    allow_multiple: true,
                } as DialogElement,
            ];

            const {form, errors} = convertDialogToAppForm(
                elements,
                'Test Dialog',
                undefined,
                undefined,
                undefined,
                'http://example.com',
                '',
                legacyOptions,
            );

            expect(errors).toHaveLength(0);
            expect(form.fields).toHaveLength(2);
            expect(form.fields?.[0].name).toBe('single_file');
            expect(form.fields?.[0].allow_multiple).toBeUndefined();
            expect(form.fields?.[0].is_required).toBe(true);
            expect(form.fields?.[1].name).toBe('multi_files');
            expect(form.fields?.[1].allow_multiple).toBe(true);
            expect(form.fields?.[1].is_required).toBe(false);
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
                select_field: 'opt1', // Primitive value (already processed by extractPrimitiveValues)
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
                multiselect_field: ['opt1', 'opt3'], // Primitive values (already processed by extractPrimitiveValues)
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
                multiselect_field: ['opt1', 'invalid'], // Primitive values (already processed by extractPrimitiveValues)
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
                multiselect_field: ['user1', 'user2'], // Primitive values (already processed by extractPrimitiveValues)
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

        it('should extract value from radio field stored as AppSelectOption object', () => {
            const values = {
                radio_object: {label: 'Option A', value: 'optA'},
                radio_string: 'optB',
            } as unknown as AppFormValues;

            const elements: DialogElement[] = [
                {
                    name: 'radio_object',
                    type: 'radio',
                    display_name: 'Radio Object Field',
                    optional: false,
                    options: [
                        {text: 'Option A', value: 'optA'},
                        {text: 'Option B', value: 'optB'},
                    ],
                } as DialogElement,
                {
                    name: 'radio_string',
                    type: 'radio',
                    display_name: 'Radio String Field',
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
                radio_object: 'optA',
                radio_string: 'optB',
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
                select_field: 'invalid', // Primitive value (already processed by extractPrimitiveValues)
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

    describe('date and datetime field conversion', () => {
        const legacyOptions = {enhanced: false};

        describe('getFieldType', () => {
            it('should return correct field types for date/datetime', () => {
                expect(getFieldType({type: 'date'} as DialogElement)).toBe('date');
                expect(getFieldType({type: 'datetime'} as DialogElement)).toBe('datetime');
            });
        });

        describe('getDefaultValue', () => {
            it('should handle date default values', () => {
                const element = {
                    type: 'date',
                    default: '2025-01-15',
                } as DialogElement;
                expect(getDefaultValue(element)).toBe('2025-01-15');
            });

            it('should handle datetime default values', () => {
                const element = {
                    type: 'datetime',
                    default: '2025-01-15T14:30:00Z',
                } as DialogElement;
                expect(getDefaultValue(element)).toBe('2025-01-15T14:30:00Z');
            });

            it('should handle null default values', () => {
                const element = {
                    display_name: 'Test Date',
                    name: 'test_date',
                    type: 'date',
                    subtype: '',
                    placeholder: '',
                    help_text: '',
                    optional: true,
                    min_length: 0,
                    max_length: 0,
                    data_source: '',
                    options: [],
                    default: '',
                } as DialogElement;
                expect(getDefaultValue(element)).toBe('');
            });
        });

        describe('convertDialogToAppForm with date/datetime fields', () => {
            it('should convert date field with min_date and max_date', () => {
                const elements: DialogElement[] = [
                    {
                        name: 'event_date',
                        type: 'date',
                        display_name: 'Event Date',
                        min_date: '2025-01-01',
                        max_date: '2025-12-31',
                        optional: false,
                    } as DialogElement,
                ];

                const {form} = convertDialogToAppForm(
                    elements,
                    'Test Form',
                    undefined,
                    undefined,
                    undefined,
                    '',
                    '',
                    legacyOptions,
                );

                expect(form.fields).toHaveLength(1);
                expect(form.fields?.[0]).toMatchObject({
                    name: 'event_date',
                    type: 'date',
                    label: 'Event Date',
                    min_date: '2025-01-01',
                    max_date: '2025-12-31',
                    is_required: true,
                });
            });

            it('should convert datetime field with time_interval', () => {
                const elements: DialogElement[] = [
                    {
                        name: 'meeting_time',
                        type: 'datetime',
                        display_name: 'Meeting Time',
                        time_interval: 30,
                        optional: true,
                    } as DialogElement,
                ];

                const {form} = convertDialogToAppForm(
                    elements,
                    'Test Form',
                    undefined,
                    undefined,
                    undefined,
                    '',
                    '',
                    legacyOptions,
                );

                expect(form.fields).toHaveLength(1);
                expect(form.fields?.[0]).toMatchObject({
                    name: 'meeting_time',
                    type: 'datetime',
                    label: 'Meeting Time',
                    time_interval: 30,
                    is_required: false,
                });
            });

            it('should convert datetime field with all date properties', () => {
                const elements: DialogElement[] = [
                    {
                        name: 'full_datetime',
                        type: 'datetime',
                        display_name: 'Full DateTime',
                        min_date: 'today',
                        max_date: '+30d',
                        time_interval: 15,
                        optional: false,
                    } as DialogElement,
                ];

                const {form} = convertDialogToAppForm(
                    elements,
                    'Test Form',
                    undefined,
                    undefined,
                    undefined,
                    '',
                    '',
                    legacyOptions,
                );

                expect(form.fields).toHaveLength(1);
                expect(form.fields?.[0]).toMatchObject({
                    name: 'full_datetime',
                    type: 'datetime',
                    label: 'Full DateTime',
                    min_date: 'today',
                    max_date: '+30d',
                    time_interval: 15,
                    is_required: true,
                });
            });

            it('should convert date field with datetime_config.min_date and max_date', () => {
                const elements: DialogElement[] = [
                    {
                        name: 'event_date',
                        type: 'date',
                        display_name: 'Event Date',
                        datetime_config: {
                            min_date: '2025-01-01',
                            max_date: '2025-12-31',
                        },
                        optional: false,
                    } as DialogElement,
                ];

                const {form} = convertDialogToAppForm(
                    elements,
                    'Test Form',
                    undefined,
                    undefined,
                    undefined,
                    '',
                    '',
                    legacyOptions,
                );

                expect(form.fields).toHaveLength(1);
                expect(form.fields?.[0]).toMatchObject({
                    name: 'event_date',
                    type: 'date',
                    label: 'Event Date',
                    min_date: '2025-01-01',
                    max_date: '2025-12-31',
                    is_required: true,
                });
                expect(form.fields?.[0]?.datetime_config).toMatchObject({
                    min_date: '2025-01-01',
                    max_date: '2025-12-31',
                });
            });

            it('should convert datetime field with datetime_config.time_interval', () => {
                const elements: DialogElement[] = [
                    {
                        name: 'meeting_time',
                        type: 'datetime',
                        display_name: 'Meeting Time',
                        datetime_config: {
                            time_interval: 30,
                        },
                        optional: true,
                    } as DialogElement,
                ];

                const {form} = convertDialogToAppForm(
                    elements,
                    'Test Form',
                    undefined,
                    undefined,
                    undefined,
                    '',
                    '',
                    legacyOptions,
                );

                expect(form.fields).toHaveLength(1);
                expect(form.fields?.[0]).toMatchObject({
                    name: 'meeting_time',
                    type: 'datetime',
                    label: 'Meeting Time',
                    time_interval: 30,
                    is_required: false,
                });
                expect(form.fields?.[0]?.datetime_config?.time_interval).toBe(30);
            });

            it('normalizes deprecated allow_manual_time_entry into manual_time_entry', () => {
                const elements: DialogElement[] = [
                    {
                        name: 'meeting_time',
                        type: 'datetime',
                        display_name: 'Meeting Time',
                        datetime_config: {
                            allow_manual_time_entry: true,
                        },
                        optional: false,
                    } as DialogElement,
                ];

                const {form} = convertDialogToAppForm(
                    elements,
                    'Test Form',
                    undefined,
                    undefined,
                    undefined,
                    '',
                    '',
                    legacyOptions,
                );

                expect(form.fields?.[0]?.datetime_config?.manual_time_entry).toBe(true);
                expect(form.fields?.[0]?.datetime_config?.allow_manual_time_entry).toBeUndefined();
            });

            it('preserves manual_time_entry when set directly', () => {
                const elements: DialogElement[] = [
                    {
                        name: 'meeting_time',
                        type: 'datetime',
                        display_name: 'Meeting Time',
                        datetime_config: {
                            manual_time_entry: true,
                        },
                        optional: false,
                    } as DialogElement,
                ];

                const {form} = convertDialogToAppForm(
                    elements,
                    'Test Form',
                    undefined,
                    undefined,
                    undefined,
                    '',
                    '',
                    legacyOptions,
                );

                expect(form.fields?.[0]?.datetime_config?.manual_time_entry).toBe(true);
                expect(form.fields?.[0]?.datetime_config?.allow_manual_time_entry).toBeUndefined();
            });

            it('omits manual_time_entry when neither source is true', () => {
                const elements: DialogElement[] = [
                    {
                        name: 'meeting_time',
                        type: 'datetime',
                        display_name: 'Meeting Time',
                        datetime_config: {
                            time_interval: 30,
                        },
                        optional: false,
                    } as DialogElement,
                ];

                const {form} = convertDialogToAppForm(
                    elements,
                    'Test Form',
                    undefined,
                    undefined,
                    undefined,
                    '',
                    '',
                    legacyOptions,
                );

                expect(form.fields?.[0]?.datetime_config?.manual_time_entry).toBeUndefined();
                expect(form.fields?.[0]?.datetime_config?.allow_manual_time_entry).toBeUndefined();
            });

            it('datetime_config should take precedence over legacy fields', () => {
                const elements: DialogElement[] = [
                    {
                        name: 'event_date',
                        type: 'date',
                        display_name: 'Event Date',
                        min_date: '2024-01-01',
                        max_date: '2024-12-31',
                        datetime_config: {
                            min_date: '2025-06-01',
                            max_date: '2025-12-31',
                        },
                        optional: false,
                    } as DialogElement,
                ];

                const {form} = convertDialogToAppForm(
                    elements,
                    'Test Form',
                    undefined,
                    undefined,
                    undefined,
                    '',
                    '',
                    legacyOptions,
                );

                expect(form.fields?.[0]?.min_date).toBe('2025-06-01');
                expect(form.fields?.[0]?.max_date).toBe('2025-12-31');
                expect(form.fields?.[0]?.datetime_config?.min_date).toBe('2025-06-01');
                expect(form.fields?.[0]?.datetime_config?.max_date).toBe('2025-12-31');
            });

            it('should not add datetime-specific properties to date fields', () => {
                const elements: DialogElement[] = [
                    {
                        name: 'simple_date',
                        type: 'date',
                        display_name: 'Simple Date',
                        time_interval: 30, // Should be ignored for date fields
                        optional: false,
                    } as DialogElement,
                ];

                const {form} = convertDialogToAppForm(
                    elements,
                    'Test Form',
                    undefined,
                    undefined,
                    undefined,
                    '',
                    '',
                    legacyOptions,
                );

                expect(form.fields?.[0]).not.toHaveProperty('time_interval');
                expect(form.fields?.[0]).not.toHaveProperty('min_date');
                expect(form.fields?.[0]).not.toHaveProperty('max_date');
            });
        });

        describe('convertAppFormValuesToDialogSubmission with date/datetime fields', () => {
            it('should convert date field values', () => {
                const values = {
                    event_date: '2025-01-15',
                } as unknown as AppFormValues;

                const elements: DialogElement[] = [
                    {
                        name: 'event_date',
                        type: 'date',
                        display_name: 'Event Date',
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
                    event_date: '2025-01-15',
                });
            });

            it('should convert datetime field values', () => {
                const values = {
                    meeting_time: '2025-01-15T14:30:00Z',
                } as unknown as AppFormValues;

                const elements: DialogElement[] = [
                    {
                        name: 'meeting_time',
                        type: 'datetime',
                        display_name: 'Meeting Time',
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
                    meeting_time: '2025-01-15T14:30:00Z',
                });
            });
        });
    });

    describe('action_button element handling', () => {
        const legacyOptions: ConversionOptions = {enhanced: false};

        describe('getFieldType', () => {
            it('should map action_button to AppFieldTypes.ACTION_BUTTON', () => {
                expect(
                    getFieldType({type: DialogElementTypes.ACTION_BUTTON} as DialogElement),
                ).toBe('action_button');
            });
        });

        describe('getDefaultValue', () => {
            it('should return null for action_button elements', () => {
                const element = {
                    type: DialogElementTypes.ACTION_BUTTON,
                    default: 'ignored',
                } as DialogElement;
                expect(getDefaultValue(element)).toBeNull();
            });
        });

        describe('convertElement', () => {
            it('should convert action_button element with url and context to AppField', () => {
                const element = {
                    name: 'my_button',
                    display_name: 'My Button',
                    type: DialogElementTypes.ACTION_BUTTON,
                    optional: false,
                    action_button: {
                        url: 'https://example.com/action',
                        context: {key1: 'value1', key2: 'value2'},
                    },
                } as unknown as DialogElement;

                const {field, errors} = convertElement(element, legacyOptions);

                expect(errors).toHaveLength(0);
                expect(field).not.toBeNull();
                expect(field?.type).toBe('action_button');
                expect(field?.action_button_url).toBe('https://example.com/action');
                expect(field?.action_button_context).toEqual({key1: 'value1', key2: 'value2'});
            });

            it('should set is_required to false for action_button regardless of optional flag', () => {
                const requiredButton = {
                    name: 'required_button',
                    display_name: 'Required Button',
                    type: DialogElementTypes.ACTION_BUTTON,
                    optional: false,
                    action_button: {url: 'https://example.com/action'},
                } as DialogElement;

                const optionalButton = {
                    name: 'optional_button',
                    display_name: 'Optional Button',
                    type: DialogElementTypes.ACTION_BUTTON,
                    optional: true,
                    action_button: {url: 'https://example.com/action'},
                } as DialogElement;

                const {field: requiredField} = convertElement(requiredButton, legacyOptions);
                const {field: optionalField} = convertElement(optionalButton, legacyOptions);

                expect(requiredField?.is_required).toBe(false);
                expect(optionalField?.is_required).toBe(false);
            });

            it('should not crash and leave action_button_url/context undefined when action_button object is absent', () => {
                const element = {
                    name: 'bare_button',
                    display_name: 'Bare Button',
                    type: DialogElementTypes.ACTION_BUTTON,
                    optional: false,
                } as DialogElement;

                const {field, errors} = convertElement(element, legacyOptions);

                expect(errors).toHaveLength(0);
                expect(field).not.toBeNull();
                expect(field?.type).toBe('action_button');
                expect(field?.action_button_url).toBeUndefined();
                expect(field?.action_button_context).toBeUndefined();
            });
        });

        describe('convertDialogToAppForm', () => {
            it('should include action_button field in the form', () => {
                const elements: DialogElement[] = [
                    {
                        name: 'submit_button',
                        display_name: 'Submit',
                        type: DialogElementTypes.ACTION_BUTTON,
                        optional: false,
                        action_button: {
                            url: 'https://example.com/submit',
                            context: {token: 'abc123'},
                        },
                    } as unknown as DialogElement,
                ];

                const {form, errors} = convertDialogToAppForm(
                    elements,
                    'Test Dialog',
                    undefined,
                    undefined,
                    undefined,
                    '',
                    '',
                    legacyOptions,
                );

                expect(errors).toHaveLength(0);
                expect(form.fields).toHaveLength(1);
                expect(form.fields?.[0].type).toBe('action_button');
                expect(form.fields?.[0].is_required).toBe(false);
                expect(form.fields?.[0].action_button_url).toBe('https://example.com/submit');
                expect(form.fields?.[0].action_button_context).toEqual({token: 'abc123'});
            });
        });

        describe('convertAppFormValuesToDialogSubmission', () => {
            it('should exclude action_button from submission values when value is present', () => {
                const values = {
                    my_button: 'clicked',
                    text_field: 'hello',
                } as unknown as AppFormValues;

                const elements: DialogElement[] = [
                    {
                        name: 'my_button',
                        display_name: 'My Button',
                        type: DialogElementTypes.ACTION_BUTTON,
                        optional: false,
                        action_button: {url: 'https://example.com/action'},
                    } as DialogElement,
                    {
                        name: 'text_field',
                        display_name: 'Text Field',
                        type: 'text',
                        optional: false,
                    } as DialogElement,
                ];

                const {submission, errors} = convertAppFormValuesToDialogSubmission(
                    values,
                    elements,
                    legacyOptions,
                );

                expect(errors).toHaveLength(0);
                expect(submission).not.toHaveProperty('my_button');
                expect(submission).toEqual({text_field: 'hello'});
            });

            it('should not include action_button in submission even when value is null/undefined', () => {
                const values = {} as unknown as AppFormValues;

                const elements: DialogElement[] = [
                    {
                        name: 'my_button',
                        display_name: 'My Button',
                        type: DialogElementTypes.ACTION_BUTTON,
                        optional: true,
                        action_button: {url: 'https://example.com/action'},
                    } as DialogElement,
                ];

                const {submission, errors} = convertAppFormValuesToDialogSubmission(
                    values,
                    elements,
                    legacyOptions,
                );

                expect(errors).toHaveLength(0);
                expect(submission).toEqual({});
            });
        });
    });

    describe('extractPrimitiveValues', () => {
        it('should extract value from a single select option', () => {
            const result = extractPrimitiveValues({
                color: {label: 'Red', value: 'red'},
            });
            expect(result).toEqual({color: 'red'});
        });

        it('should extract values from a multiselect array', () => {
            const result = extractPrimitiveValues({
                colors: [
                    {label: 'Red', value: 'red'},
                    {label: 'Blue', value: 'blue'},
                ],
            });
            expect(result).toEqual({colors: ['red', 'blue']});
        });

        it('should pass through primitive strings', () => {
            const result = extractPrimitiveValues({
                name: 'hello',
            });
            expect(result).toEqual({name: 'hello'});
        });

        it('should pass through booleans', () => {
            const result = extractPrimitiveValues({
                enabled: true,
                disabled: false,
            });
            expect(result).toEqual({enabled: true, disabled: false});
        });

        it('should skip null, undefined, empty string, and <nil> values', () => {
            const result = extractPrimitiveValues({
                a: null,
                b: undefined,
                c: '',
                d: '<nil>',
                e: 'keep',
            });
            expect(result).toEqual({e: 'keep'});
        });

        it('should skip select option with empty value', () => {
            const result = extractPrimitiveValues({
                color: {label: '', value: ''},
            });
            expect(result).toEqual({});
        });

        it('should skip select option with <nil> value', () => {
            const result = extractPrimitiveValues({
                color: {label: 'None', value: '<nil>'},
            });
            expect(result).toEqual({});
        });

        it('should skip empty multiselect arrays', () => {
            const result = extractPrimitiveValues({
                colors: [],
            });
            expect(result).toEqual({});
        });

        it('should pass through primitive string arrays', () => {
            const result = extractPrimitiveValues({
                dates: ['2026-01-01', '2026-01-15'],
            });
            expect(result).toEqual({dates: ['2026-01-01', '2026-01-15']});
        });

        it('should handle mixed arrays of select options and primitives', () => {
            const result = extractPrimitiveValues({
                items: [
                    {label: 'Red', value: 'red'},
                    'already-extracted',
                ],
            });
            expect(result).toEqual({items: ['red', 'already-extracted']});
        });

        it('should filter out meaningless values from multiselect arrays', () => {
            const result = extractPrimitiveValues({
                colors: [
                    {label: 'Red', value: 'red'},
                    {label: 'Empty', value: ''},
                    {label: 'Blue', value: 'blue'},
                ],
            });
            expect(result).toEqual({colors: ['red', 'blue']});
        });

        describe('with clearEmptyFields=true', () => {
            it('should emit empty string for null values', () => {
                const result = extractPrimitiveValues({a: null}, true);
                expect(result).toEqual({a: ''});
            });

            it('should emit empty string for undefined values', () => {
                const result = extractPrimitiveValues({a: undefined}, true);
                expect(result).toEqual({a: ''});
            });

            it('should emit empty string for empty string values', () => {
                const result = extractPrimitiveValues({a: ''}, true);
                expect(result).toEqual({a: ''});
            });

            it('should emit empty string for <nil> values', () => {
                const result = extractPrimitiveValues({a: '<nil>'}, true);
                expect(result).toEqual({a: ''});
            });

            it('should emit empty array for empty multiselect arrays', () => {
                const result = extractPrimitiveValues({colors: []}, true);
                expect(result).toEqual({colors: []});
            });

            it('should emit empty string for select option with empty value', () => {
                const result = extractPrimitiveValues({
                    color: {label: '', value: ''},
                }, true);
                expect(result).toEqual({color: ''});
            });

            it('should emit empty string for select option with <nil> value', () => {
                const result = extractPrimitiveValues({
                    color: {label: 'None', value: '<nil>'},
                }, true);
                expect(result).toEqual({color: ''});
            });

            it('should still extract meaningful values normally', () => {
                const result = extractPrimitiveValues({
                    name: 'hello',
                    color: {label: 'Red', value: 'red'},
                    cleared: null,
                    emptied: [],
                }, true);
                expect(result).toEqual({
                    name: 'hello',
                    color: 'red',
                    cleared: '',
                    emptied: [],
                });
            });
        });
    });
});

describe('dialog_conversion - collapsible', () => {
    const legacyOptions: ConversionOptions = {enhanced: false};
    const enhancedOptions: ConversionOptions = {enhanced: true};

    // collapsible builds a collapsible DialogElement with the given children.
    const collapsible = (name: string, elements: DialogElement[], collapsed?: boolean): DialogElement => ({
        name,
        display_name: 'Section ' + name,
        type: DialogElementTypes.COLLAPSIBLE,
        elements,
        collapsed,
    } as DialogElement);

    const textEl = (name: string): DialogElement => ({
        name,
        display_name: 'Text ' + name,
        type: DialogElementTypes.TEXT,
    } as DialogElement);

    describe('getFieldType', () => {
        it('maps collapsible to the collapsible AppFieldType', () => {
            expect(getFieldType(collapsible('s', [textEl('a')]))).toBe('collapsible');
        });
    });

    describe('convertElement', () => {
        it('produces a COLLAPSIBLE AppField with converted child fields and no value', () => {
            // create a good object and make sure all the attributes made it in
            const testCollapsible = collapsible('a', [textEl('b')]);
            const {field, errors} = convertElement(testCollapsible, legacyOptions);
            expect(errors).toHaveLength(0);

            // check fields
            expect(field?.name).toBe('a');
            expect(field?.type).toBe('collapsible');
            expect(field?.label).toBe('Section a');

            // make sure parent container has no value
            expect(field?.value).toBeUndefined();

            // check child element
            expect(field?.collapsible_config?.fields?.[0].name).toBe('b');
            expect(field?.collapsible_config?.fields?.[0].type).toBe('text');
            expect(field?.collapsible_config?.fields?.[0].label).toBe('Text b');
        });

        it('defaults expanded to true when collapsed is undefined', () => {
            // create a test collapsible object and check the expanded attribute's value
            const testCollapsible = collapsible('a', []);
            const {field, errors} = convertElement(testCollapsible, legacyOptions);

            // make sure no errors are present
            expect(errors).toHaveLength(0);

            // right now, collapsible shouldn't have a set collapsed value
            expect(field?.collapsible_config?.expanded).toBe(true);
        });

        it('honors collapsed=true', () => {
            // create a test collapsible object and mark it collapsed
            const testCollapsible = collapsible('a', [textEl('b')], true);
            const {field, errors} = convertElement(testCollapsible, legacyOptions);

            // make sure no errors are present
            expect(errors).toHaveLength(0);

            expect(field?.collapsible_config?.expanded).toBe(false);
        });

        it('propagates child conversion errors', () => {
            // make an invalid child that is to be put into the collapsible element

            const invalidChild = {
                name: 'bad',
                type: 'not real',
            } as DialogElement;

            // create a test collapsible object
            const testCollapsible = collapsible('a', [invalidChild]);

            // convert the element using the invalid child
            const {errors} = convertElement(testCollapsible, legacyOptions);

            // assert that we should have seen errors during conversion
            expect(errors.length).toBeGreaterThan(0);
        });
    });

    describe('flattenDialogElements', () => {
        it('returns a flat list unchanged', () => {
            // create flat list
            const elementList = [textEl('a'), textEl('b')];

            // call flattenList and check value
            expect(flattenDialogElements(elementList)).toHaveLength(2);
            expect(flattenDialogElements(elementList)).toEqual([textEl('a'), textEl('b')]);
        });

        it('expands a single collapsible into its children', () => {
            const testCollapsible = collapsible('s', [textEl('a'), textEl('b')]);
            expect(flattenDialogElements([testCollapsible])).toEqual([textEl('a'), textEl('b')]);
        });

        it('recursively flattens nested collapsibles', () => {
            // create a nested collapsible element
            const testNestedCollapsible = collapsible('a', [collapsible('b', [textEl('a'), textEl('b')])]);

            // expect that elements are flattened and we only get the children
            expect(flattenDialogElements([testNestedCollapsible])).toEqual([textEl('a'), textEl('b')]);
        });

        it('returns [] for a collapsible with no elements', () => {
            // create a collapsible element with no child elements
            const testCollapsibleNoChildren = collapsible('a', []);

            // flatten it and make sure we return an empty array
            expect(flattenDialogElements([testCollapsibleNoChildren])).toHaveLength(0);
        });
    });

    describe('convertAppFormValuesToDialogSubmission', () => {
        it('collects child values and excludes the collapsible container', () => {
            const testCollapsibleWithChildren = collapsible('a', [textEl('b'), textEl('c')]);
            const values = {b: 'b val', c: 'c val'};

            const ret = convertAppFormValuesToDialogSubmission(values, [testCollapsibleWithChildren], legacyOptions);

            // there shouldn't be any errors here
            expect(ret.errors).toHaveLength(0);

            // check values that are returned by function call
            const decon = ret.submission;

            expect(decon.b).toEqual('b val');
            expect(decon.c).toEqual('c val');

            // this makes sure that a does not have a value, since the base collapsible element does not have a value of its own
            expect(decon).not.toHaveProperty('a');
        });

        it('collects values from deeply nested collapsibles', () => {
            const deeplyNested = collapsible('level1', [collapsible('level2', [collapsible('level3', [textEl('deep'), textEl('deep2'), textEl('deep3')])])]);

            const values = {deep: 'deep val', deep2: 'deep val2', deep3: 'deep val3'};

            const ret = convertAppFormValuesToDialogSubmission(values, [deeplyNested], legacyOptions);

            // error check
            expect(ret.errors).toHaveLength(0);

            // check values returned by call
            const decon = ret.submission;

            expect(decon.deep).toEqual('deep val');
            expect(decon.deep2).toEqual('deep val2');
            expect(decon.deep3).toEqual('deep val3');
        });
    });

    describe('validateDialogElement', () => {
        it('does not produce errors for a well-formed collapsible', () => {
            // a collapsible has name, display_name, and type set, so it should validate cleanly
            const errors = validateDialogElement(collapsible('a', [textEl('b')]), 0, enhancedOptions);
            expect(errors).toHaveLength(0);
        });
    });

    describe('convertElement nested', () => {
        it('recursively converts a collapsible nested inside a collapsible', () => {
            // collapsible "outer" wraps collapsible "inner" wraps a single leaf field
            const nested = collapsible('outer', [collapsible('inner', [textEl('leaf')])]);
            const {field, errors} = convertElement(nested, legacyOptions);

            expect(errors).toHaveLength(0);

            // outer container
            expect(field?.type).toBe('collapsible');
            expect(field?.value).toBeUndefined();

            // inner container, nested under outer's fields
            const inner = field?.collapsible_config?.fields?.[0];
            expect(inner?.name).toBe('inner');
            expect(inner?.type).toBe('collapsible');
            expect(inner?.value).toBeUndefined();

            // leaf field at the bottom
            expect(inner?.collapsible_config?.fields?.[0].name).toBe('leaf');
            expect(inner?.collapsible_config?.fields?.[0].type).toBe('text');
        });
    });

    describe('convertDialogToAppForm', () => {
        it('includes a collapsible field with its converted children in form.fields', () => {
            const elements = [collapsible('section', [textEl('child')])];

            const {form, errors} = convertDialogToAppForm(
                elements,
                'Test Dialog',
                undefined,
                undefined,
                undefined,
                '',
                '',
                legacyOptions,
            );

            expect(errors).toHaveLength(0);
            expect(form.fields).toHaveLength(1);

            // the collapsible container is preserved as a field (not flattened) for rendering
            expect(form.fields?.[0].name).toBe('section');
            expect(form.fields?.[0].type).toBe('collapsible');

            // and its child is converted and nested underneath
            expect(form.fields?.[0].collapsible_config?.fields?.[0].name).toBe('child');
            expect(form.fields?.[0].collapsible_config?.fields?.[0].type).toBe('text');
        });

        it('handles a collapsible alongside flat top-level fields', () => {
            const elements = [textEl('top'), collapsible('section', [textEl('child')])];

            const {form, errors} = convertDialogToAppForm(
                elements,
                'Test Dialog',
                undefined,
                undefined,
                undefined,
                '',
                '',
                legacyOptions,
            );

            expect(errors).toHaveLength(0);
            expect(form.fields).toHaveLength(2);

            // order is preserved: flat field first, then the collapsible
            expect(form.fields?.[0].name).toBe('top');
            expect(form.fields?.[0].type).toBe('text');
            expect(form.fields?.[1].name).toBe('section');
            expect(form.fields?.[1].type).toBe('collapsible');
        });
    });
});
