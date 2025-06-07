// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Dialog, DialogElement} from '@mattermost/types/integrations';

import {AppFieldTypes} from 'mattermost-redux/constants/apps';

import {InteractiveDialogConverter} from './interactive_dialog_converter';

// Test dialog type based on ExtendedDialog pattern
type TestDialog = Omit<Dialog, 'callback_id'> & {
    callback_id: string; // Required for tests
    url?: string; // Extended property
    trigger_id?: string; // Extended property
};

describe('InteractiveDialogConverter', () => {
    describe('dialogToAppForm', () => {
        it('should convert basic dialog properties', () => {
            const dialog: TestDialog = {
                callback_id: 'test_callback',
                title: 'Test Dialog',
                introduction_text: 'Test intro',
                icon_url: 'https://example.com/icon.png',
                submit_label: 'Save',
                notify_on_cancel: true,
                state: 'test_state',
                elements: [],
            };

            const result = InteractiveDialogConverter.dialogToAppForm(dialog);

            expect(result).toEqual({
                title: 'Test Dialog',
                header: 'Test intro',
                icon: 'https://example.com/icon.png',
                submit_buttons: 'Save',
                cancel_button: true,
                submit_on_cancel: true,
                fields: [],
            });
        });

        it('should use default submit label when not provided', () => {
            const dialog: TestDialog = {
                callback_id: 'test_callback',
                title: 'Test Dialog',
                elements: [],
            };

            const result = InteractiveDialogConverter.dialogToAppForm(dialog);

            expect(result.submit_buttons).toBe('Submit');
        });

        it('should throw error for invalid dialog', () => {
            expect(() => {
                InteractiveDialogConverter.dialogToAppForm(null as any);
            }).toThrow('Invalid dialog: missing required title');

            expect(() => {
                InteractiveDialogConverter.dialogToAppForm({} as any);
            }).toThrow('Invalid dialog: missing required title');
        });
    });

    describe('dialogElementToAppField', () => {
        it('should convert text element', () => {
            const element: DialogElement = {
                name: 'text_field',
                display_name: 'Text Field',
                type: 'text',
                subtype: 'email',
                placeholder: 'Enter email',
                help_text: 'Help text',
                optional: false,
                min_length: 5,
                max_length: 100,
                default: 'default@example.com',
                data_source: '',
                multiselect: false,
                options: [],
            };

            const result = InteractiveDialogConverter.dialogElementToAppField(element);

            expect(result.name).toBe('text_field');
            expect(result.label).toBe('Text Field');
            expect(result.type).toBe(AppFieldTypes.TEXT);
            expect(result.subtype).toBe('email');
            expect(result.is_required).toBe(true);
            expect(result.value).toBe('default@example.com');
        });

        it('should convert textarea element', () => {
            const element: DialogElement = {
                name: 'textarea_field',
                display_name: 'Textarea Field',
                type: 'textarea',
                subtype: '',
                default: '',
                placeholder: '',
                help_text: '',
                optional: false,
                min_length: 10,
                max_length: 500,
                data_source: '',
                multiselect: false,
                options: [],
            };

            const result = InteractiveDialogConverter.dialogElementToAppField(element);

            expect(result.type).toBe(AppFieldTypes.TEXTAREA);
            expect(result.min_length).toBe(10);
            expect(result.max_length).toBe(500);
        });

        it('should convert radio element', () => {
            const element: DialogElement = {
                name: 'radio_field',
                display_name: 'Radio Field',
                type: 'radio',
                subtype: '',
                placeholder: '',
                help_text: '',
                optional: false,
                min_length: 0,
                max_length: 0,
                data_source: '',
                multiselect: false,
                options: [
                    {text: 'Low', value: 'low'},
                    {text: 'High', value: 'high'},
                ],
                default: 'low',
            };

            const result = InteractiveDialogConverter.dialogElementToAppField(element);

            expect(result.type).toBe(AppFieldTypes.RADIO);
            expect(result.options).toEqual([
                {label: 'Low', value: 'low'},
                {label: 'High', value: 'high'},
            ]);
        });

        it('should convert multiselect static select element', () => {
            const element: DialogElement = {
                name: 'multi_select_field',
                display_name: 'Multi Select Field',
                type: 'select',
                subtype: '',
                placeholder: '',
                help_text: '',
                optional: false,
                min_length: 0,
                max_length: 0,
                data_source: '',
                multiselect: true,
                options: [
                    {text: 'Option 1', value: 'opt1'},
                    {text: 'Option 2', value: 'opt2'},
                    {text: 'Option 3', value: 'opt3'},
                ],
                default: 'opt1,opt3',
            };

            const result = InteractiveDialogConverter.dialogElementToAppField(element);

            expect(result.type).toBe(AppFieldTypes.STATIC_SELECT);
            expect(result.multiselect).toBe(true);
            expect(result.value).toEqual([
                {label: 'Option 1', value: 'opt1'},
                {label: 'Option 3', value: 'opt3'},
            ]);
        });

        it('should convert multiselect user select element', () => {
            const element: DialogElement = {
                name: 'multi_user_field',
                display_name: 'Multi User Field',
                type: 'select',
                subtype: '',
                default: '',
                placeholder: '',
                help_text: '',
                optional: false,
                min_length: 0,
                max_length: 0,
                data_source: 'users',
                multiselect: true,
                options: [],
            };

            const result = InteractiveDialogConverter.dialogElementToAppField(element);

            expect(result.type).toBe(AppFieldTypes.USER);
            expect(result.multiselect).toBe(true);
        });

        it('should convert multiselect channel select element', () => {
            const element: DialogElement = {
                name: 'multi_channel_field',
                display_name: 'Multi Channel Field',
                type: 'select',
                subtype: '',
                default: '',
                placeholder: '',
                help_text: '',
                optional: false,
                min_length: 0,
                max_length: 0,
                data_source: 'channels',
                multiselect: true,
                options: [],
            };

            const result = InteractiveDialogConverter.dialogElementToAppField(element);

            expect(result.type).toBe(AppFieldTypes.CHANNEL);
            expect(result.multiselect).toBe(true);
        });

        it('should handle optional fields', () => {
            const element: DialogElement = {
                name: 'optional_field',
                display_name: 'Optional Field',
                type: 'text',
                subtype: '',
                default: '',
                placeholder: '',
                help_text: '',
                optional: true,
                min_length: 0,
                max_length: 0,
                data_source: '',
                multiselect: false,
                options: [],
            };

            const result = InteractiveDialogConverter.dialogElementToAppField(element);

            expect(result.is_required).toBe(false);
        });

        it('should convert number element', () => {
            const element: DialogElement = {
                name: 'number_field',
                display_name: 'Number Field',
                type: 'text',
                subtype: 'number',
                placeholder: '',
                help_text: '',
                optional: false,
                min_length: 1,
                max_length: 10,
                data_source: '',
                multiselect: false,
                options: [],
                default: '42',
            };

            const result = InteractiveDialogConverter.dialogElementToAppField(element);

            expect(result.name).toBe('number_field');
            expect(result.label).toBe('Number Field');
            expect(result.type).toBe(AppFieldTypes.TEXT);
            expect(result.subtype).toBe('number');
            expect(result.value).toBe('42');
        });

        it('should throw error for invalid dialog element', () => {
            expect(() => {
                InteractiveDialogConverter.dialogElementToAppField(null as any);
            }).toThrow('Invalid dialog element: missing required fields');

            expect(() => {
                InteractiveDialogConverter.dialogElementToAppField({} as any);
            }).toThrow('Invalid dialog element: missing required fields');

            expect(() => {
                InteractiveDialogConverter.dialogElementToAppField({
                    name: 'test',

                    // missing display_name and type
                } as any);
            }).toThrow('Invalid dialog element: missing required fields');
        });

        it('should throw error for element name too long', () => {
            expect(() => {
                InteractiveDialogConverter.dialogElementToAppField({
                    name: 'a'.repeat(70), // Over 64 char limit
                    display_name: 'Test',
                    type: 'text',
                    subtype: '',
                    default: '',
                    placeholder: '',
                    help_text: '',
                    optional: false,
                    min_length: 0,
                    max_length: 0,
                    data_source: '',
                    multiselect: false,
                    options: [],
                });
            }).toThrow('Dialog element name too long');
        });
    });

    describe('appFormToDialogSubmission', () => {
        const mockDialog: TestDialog = {
            callback_id: 'test',
            title: 'Test',
            elements: [
                {name: 'text_field', display_name: 'Text', type: 'text', subtype: '', default: '', placeholder: '', help_text: '', optional: false, min_length: 0, max_length: 0, data_source: '', multiselect: false, options: []},
                {name: 'number_field', display_name: 'Number', type: 'text', subtype: 'number', default: '', placeholder: '', help_text: '', optional: false, min_length: 0, max_length: 0, data_source: '', multiselect: false, options: []},
                {name: 'bool_field', display_name: 'Bool', type: 'bool', subtype: '', default: '', placeholder: '', help_text: '', optional: false, min_length: 0, max_length: 0, data_source: '', multiselect: false, options: []},
                {name: 'radio_field', display_name: 'Radio', type: 'radio', subtype: '', default: '', placeholder: '', help_text: '', optional: false, min_length: 0, max_length: 0, data_source: '', multiselect: false, options: []},
                {name: 'multi_select_field', display_name: 'Multi Select', type: 'select', subtype: '', default: '', placeholder: '', help_text: '', optional: false, min_length: 0, max_length: 0, data_source: '', multiselect: true, options: []},
            ],
        };

        it('should convert text and boolean values', () => {
            const values = {
                text_field: 'test value',
                bool_field: true,
                radio_field: 'selected_option',
            };

            const result = InteractiveDialogConverter.appFormToDialogSubmission(values, mockDialog);

            expect(result).toEqual({
                text_field: 'test value',
                bool_field: true,
                radio_field: 'selected_option',
            });
        });

        it('should convert number values to actual numbers', () => {
            const values = {
                text_field: 'text value',
                number_field: '42',
                bool_field: false,
            };

            const result = InteractiveDialogConverter.appFormToDialogSubmission(values, mockDialog);

            expect(result).toEqual({
                text_field: 'text value',
                number_field: 42, // Should be converted to number
                bool_field: false,
            });
        });

        it('should handle invalid number values as strings', () => {
            const values = {
                number_field: 'not-a-number',
            };

            const result = InteractiveDialogConverter.appFormToDialogSubmission(values, mockDialog);

            expect(result).toEqual({
                number_field: 'not-a-number', // Invalid numbers stay as strings
            });
        });

        it('should handle number zero correctly', () => {
            const values = {
                number_field: '0',
            };

            const result = InteractiveDialogConverter.appFormToDialogSubmission(values, mockDialog);

            expect(result).toEqual({
                number_field: 0, // Zero should be converted to number
            });
        });

        it('should handle negative numbers correctly', () => {
            const values = {
                number_field: '-15.5',
            };

            const result = InteractiveDialogConverter.appFormToDialogSubmission(values, mockDialog);

            expect(result).toEqual({
                number_field: -15.5, // Negative decimals should be converted
            });
        });

        it('should convert multiselect values to arrays', () => {
            const values = {
                multi_select_field: [
                    {label: 'Option 1', value: 'opt1'},
                    {label: 'Option 3', value: 'opt3'},
                ] as any,
            };

            const result = InteractiveDialogConverter.appFormToDialogSubmission(values, mockDialog);

            expect(result).toEqual({
                multi_select_field: ['opt1', 'opt3'], // Should be array of values
            });
        });

        it('should handle empty multiselect arrays', () => {
            const values = {
                multi_select_field: [] as any,
            };

            const result = InteractiveDialogConverter.appFormToDialogSubmission(values, mockDialog);

            expect(result).toEqual({
                multi_select_field: [], // Empty array should be preserved
            });
        });

        it('should handle null values', () => {
            const values = {
                text_field: null,
                bool_field: null,
            };

            const result = InteractiveDialogConverter.appFormToDialogSubmission(values, mockDialog);

            expect(result).toEqual({});
        });

        it('should sanitize XSS in text values', () => {
            const values = {
                text_field: '<script>alert("xss")</script>safe text',
            };

            const result = InteractiveDialogConverter.appFormToDialogSubmission(values, mockDialog);

            expect(result).toEqual({
                text_field: 'safe text', // Script tag should be removed
            });
        });

        it('should handle very long element names', () => {
            const longNameDialog: TestDialog = {
                callback_id: 'test',
                title: 'Test',
                elements: [
                    {name: 'a'.repeat(70), display_name: 'Long Name', type: 'text', subtype: '', default: '', placeholder: '', help_text: '', optional: false, min_length: 0, max_length: 0, data_source: '', multiselect: false, options: []}, // Over 64 char limit
                ],
            };

            expect(() => {
                InteractiveDialogConverter.appFormToDialogSubmission({}, longNameDialog);
            }).not.toThrow(); // Should not throw during submission, validation happens during conversion
        });
    });

    describe('dialogResponseToAppFormResponse', () => {
        it('should convert error response', () => {
            const response = {
                error: 'Something went wrong',
            };

            const result = InteractiveDialogConverter.dialogResponseToAppFormResponse(response);

            expect(result).toEqual({
                data: {
                    errors: {
                        form: 'Something went wrong',
                    },
                },
            });
        });

        it('should convert success response', () => {
            const response = {};

            const result = InteractiveDialogConverter.dialogResponseToAppFormResponse(response);

            expect(result).toEqual({
                data: {},
            });
        });
    });
});
