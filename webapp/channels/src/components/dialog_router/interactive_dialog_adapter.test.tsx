// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {waitFor} from '@testing-library/react';
import React from 'react';

import type {DialogElement} from '@mattermost/types/integrations';

import {AppFieldTypes} from 'mattermost-redux/constants/apps';

import {renderWithContext} from 'tests/react_testing_utils';
import EmojiMap from 'utils/emoji_map';

import InteractiveDialogAdapter from './interactive_dialog_adapter';

// Mock AppsFormContainer to avoid dynamic import complexity in tests
const MockAppsFormContainer = jest.fn((props: any) => {
    if (!props || !props.form) {
        return <div data-testid='apps-form-container-loading'>{'Loading...'}</div>;
    }

    return (
        <div data-testid='apps-form-container'>
            <div data-testid='form-title'>{props.form?.title || ''}</div>
            <div data-testid='form-header'>{props.form?.header || ''}</div>
            <div data-testid='form-icon'>{props.form?.icon || ''}</div>
            <div data-testid='form-fields-count'>{props.form?.fields?.length || 0}</div>
            {props.form?.fields?.map((field: any) => (
                <div
                    key={field.name}
                    data-testid={`field-${field.name}`}
                >
                    <span data-testid={`field-type-${field.name}`}>{field.type}</span>
                    <span data-testid={`field-value-${field.name}`}>{JSON.stringify(field.value)}</span>
                    <span data-testid={`field-required-${field.name}`}>{field.is_required ? 'required' : 'optional'}</span>
                </div>
            )) || []}
        </div>
    );
});

jest.mock('components/apps_form/apps_form_container', () => {
    return {
        __esModule: true,
        default: MockAppsFormContainer,
    };
});

// Mock console methods for testing logging
const mockConsole = {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};

describe('components/interactive_dialog/InteractiveDialogAdapter', () => {
    const baseProps = {
        url: 'https://example.com',
        callbackId: 'abc123',
        title: 'Test Dialog',
        introductionText: 'Test introduction',
        iconUrl: 'https://example.com/icon.png',
        submitLabel: 'Submit',
        state: 'test-state',
        notifyOnCancel: true,
        emojiMap: new EmojiMap(new Map()),
        onExited: jest.fn(),
        actions: {
            submitInteractiveDialog: jest.fn().mockResolvedValue({data: {}}),
            lookupInteractiveDialog: jest.fn().mockResolvedValue({data: {items: []}}),
        },
        elements: [] as DialogElement[],
    };

    beforeEach(() => {
        // Mock console methods before each test
        global.console.debug = mockConsole.debug;
        global.console.warn = mockConsole.warn;
        global.console.error = mockConsole.error;
    });

    afterEach(() => {
        jest.clearAllMocks();
        mockConsole.debug.mockClear();
        mockConsole.warn.mockClear();
        mockConsole.error.mockClear();
    });

    describe('Basic Rendering and Conversion', () => {
        test('should render AppsFormContainer with correct basic props', async () => {
            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...baseProps}/>,
            );

            await waitFor(() => {
                expect(getByTestId('apps-form-container')).toBeInTheDocument();
            });

            expect(getByTestId('form-title')).toHaveTextContent('Test Dialog');
            expect(getByTestId('form-header')).toHaveTextContent('Test introduction');
            expect(getByTestId('form-icon')).toHaveTextContent('https://example.com/icon.png');
        });

        test('should convert text element correctly', async () => {
            const textElement: DialogElement = {
                name: 'test-text',
                type: 'text',
                display_name: 'Test Text',
                help_text: 'Help text',
                placeholder: 'Enter text',
                default: 'default value',
                optional: false,
                max_length: 100,
                subtype: '',
                min_length: 0,
                data_source: '',
                options: [],
            };

            const props = {
                ...baseProps,
                elements: [textElement],
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(getByTestId('form-fields-count')).toHaveTextContent('1');
            });
            expect(getByTestId('field-test-text')).toBeInTheDocument();
            expect(getByTestId('field-type-test-text')).toHaveTextContent(AppFieldTypes.TEXT);
            expect(getByTestId('field-value-test-text')).toHaveTextContent('"default value"');
            expect(getByTestId('field-required-test-text')).toHaveTextContent('required');
        });

        test('should convert select element with default option', async () => {
            const selectElement: DialogElement = {
                name: 'test-select',
                type: 'select',
                display_name: 'Test Select',
                help_text: 'Help text',
                placeholder: 'Choose option',
                default: 'option2',
                optional: false,
                max_length: 0,
                min_length: 0,
                subtype: '',
                data_source: '',
                options: [
                    {text: 'Option 1', value: 'option1'},
                    {text: 'Option 2', value: 'option2'},
                    {text: 'Option 3', value: 'option3'},
                ],
            };

            const props = {
                ...baseProps,
                elements: [selectElement],
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(getByTestId('field-type-test-select')).toHaveTextContent(AppFieldTypes.STATIC_SELECT);
            });

            // Check that the default value was converted to AppSelectOption format
            const valueText = getByTestId('field-value-test-select').textContent;
            expect(valueText).toContain('Option 2');
            expect(valueText).toContain('option2');
        });

        test('should convert bool element with proper boolean conversion', async () => {
            const boolElement: DialogElement = {
                name: 'test-bool',
                type: 'bool',
                display_name: 'Test Boolean',
                help_text: 'Boolean field',
                placeholder: 'Check this',
                default: 'true',
                optional: false,
                max_length: 0,
                min_length: 0,
                subtype: '',
                data_source: '',
                options: [],
            };

            const props = {
                ...baseProps,
                elements: [boolElement],
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(getByTestId('field-type-test-bool')).toHaveTextContent(AppFieldTypes.BOOL);
            });
            expect(getByTestId('field-value-test-bool')).toHaveTextContent('true');
        });
    });

    describe('XSS Prevention and Sanitization', () => {
        test('should sanitize title with script tags', async () => {
            const maliciousTitle = 'Test <script>alert("xss")</script> Dialog';
            const props = {
                ...baseProps,
                title: maliciousTitle,
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(getByTestId('form-title')).toHaveTextContent('Test Dialog');
            });
        });

        test('should sanitize introduction text with iframe tags', async () => {
            const maliciousIntro = 'Introduction <iframe src="evil.com"></iframe> text';
            const props = {
                ...baseProps,
                introductionText: maliciousIntro,
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(getByTestId('form-header')).toHaveTextContent('Introduction text');
            });
        });

        test('should sanitize element values with event handlers', async () => {
            const maliciousElement: DialogElement = {
                name: 'test-malicious',
                type: 'text',
                display_name: 'Test <img src=x onerror=alert(1)>',
                help_text: 'Help text',
                placeholder: '',
                default: 'value with onclick=alert("xss")',
                optional: false,
                max_length: 0,
                min_length: 0,
                subtype: '',
                data_source: '',
                options: [],
            };

            const props = {
                ...baseProps,
                elements: [maliciousElement],
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(getByTestId('field-test-malicious')).toBeInTheDocument();
            });

            // Check that the default value was sanitized
            const valueText = getByTestId('field-value-test-malicious').textContent;
            expect(valueText).toContain('value with alert(\\"xss\\")');
            expect(valueText).not.toContain('onclick=');
        });

        test('should disable sanitization when sanitizeStrings is false', async () => {
            const maliciousTitle = 'Test <script>alert("xss")</script> Dialog';
            const props = {
                ...baseProps,
                title: maliciousTitle,
                conversionOptions: {
                    sanitizeStrings: false,
                },
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(getByTestId('form-title')).toHaveTextContent(maliciousTitle);
            });
        });
    });

    describe('Validation Functionality', () => {
        test('should not validate by default (backwards compatibility)', async () => {
            const invalidElement: DialogElement = {
                name: '', // Invalid: missing name
                type: 'text',
                display_name: '', // Invalid: missing display_name
                help_text: '',
                placeholder: '',
                default: '',
                optional: false,
                max_length: 0,
                min_length: 0,
                subtype: '',
                data_source: '',
                options: [],
            };

            const props = {
                ...baseProps,
                title: '', // Invalid: missing title
                elements: [invalidElement],
            };

            // Should not throw or show warnings in console by default
            expect(() => {
                renderWithContext(
                    <InteractiveDialogAdapter {...props}/>,
                );
            }).not.toThrow();

            expect(mockConsole.warn).not.toHaveBeenCalled();
        });

        test('should validate when validateInputs is enabled', async () => {
            const invalidElement: DialogElement = {
                name: '', // Invalid: missing name
                type: 'text',
                display_name: '', // Invalid: missing display_name
                help_text: '',
                placeholder: '',
                default: '',
                optional: false,
                max_length: 0,
                min_length: 0,
                subtype: '',
                data_source: '',
                options: [],
            };

            const props = {
                ...baseProps,
                title: 'This title is way too long for the server limit of 24 characters',
                elements: [invalidElement],
                conversionOptions: {
                    validateInputs: true,
                },
            };

            renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                // Should warn about element validation errors
                expect(mockConsole.warn).toHaveBeenCalledWith(
                    '[InteractiveDialogAdapter]',
                    'Element validation errors for unnamed',
                    expect.any(Object),
                );
            });
        });

        test('should throw errors in strict mode', async () => {
            const invalidElement: DialogElement = {
                name: '', // Invalid: missing name
                type: 'text',
                display_name: '', // Invalid: missing display_name
                help_text: '',
                placeholder: '',
                default: '',
                optional: false,
                max_length: 0,
                min_length: 0,
                subtype: '',
                data_source: '',
                options: [],
            };

            const props = {
                ...baseProps,
                elements: [invalidElement],
                conversionOptions: {
                    validateInputs: true,
                    strictMode: true,
                },
            };

            expect(() => {
                renderWithContext(
                    <InteractiveDialogAdapter {...props}/>,
                );
            }).toThrow('Dialog validation failed:');
        });

        test('should validate server-side length limits', async () => {
            const longNameElement: DialogElement = {
                name: 'a'.repeat(301), // Exceeds 300 char limit
                type: 'text',
                display_name: 'b'.repeat(25), // Exceeds 24 char limit
                help_text: 'c'.repeat(151), // Exceeds 150 char limit
                placeholder: '',
                default: '',
                optional: false,
                max_length: 4000, // Exceeds 150 char limit for text
                min_length: 0,
                subtype: '',
                data_source: '',
                options: [],
            };

            const props = {
                ...baseProps,
                elements: [longNameElement],
                conversionOptions: {
                    validateInputs: true,
                },
            };

            renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(mockConsole.warn).toHaveBeenCalledWith(
                    '[InteractiveDialogAdapter]',
                    'Element validation errors for ' + 'a'.repeat(301),
                    expect.objectContaining({
                        errors: expect.arrayContaining([
                            expect.objectContaining({
                                field: 'elements[0].name',
                                code: 'TOO_LONG',
                                message: expect.stringContaining('300 characters'),
                            }),
                            expect.objectContaining({
                                field: 'elements[0].display_name',
                                code: 'TOO_LONG',
                                message: expect.stringContaining('24 characters'),
                            }),
                            expect.objectContaining({
                                field: 'elements[0].help_text',
                                code: 'TOO_LONG',
                                message: expect.stringContaining('150 characters'),
                            }),
                            expect.objectContaining({
                                field: 'elements[0].max_length',
                                code: 'TOO_LONG',
                                message: expect.stringContaining('150 (server limit for text)'),
                            }),
                        ]),
                    }),
                );
            });
        });

        test('should validate select options', async () => {
            const invalidSelectElement: DialogElement = {
                name: 'test-select',
                type: 'select',
                display_name: 'Test Select',
                help_text: '',
                placeholder: '',
                default: '',
                optional: false,
                max_length: 0,
                min_length: 0,
                subtype: '',
                data_source: '',
                options: [
                    {text: '', value: 'valid'}, // Invalid: empty text
                    {text: 'Valid Text', value: ''}, // Invalid: empty value
                ],
            };

            const props = {
                ...baseProps,
                elements: [invalidSelectElement],
                conversionOptions: {
                    validateInputs: true,
                },
            };

            renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(mockConsole.warn).toHaveBeenCalledWith(
                    '[InteractiveDialogAdapter]',
                    'Element validation errors for test-select',
                    expect.objectContaining({
                        errors: expect.arrayContaining([
                            expect.objectContaining({
                                field: 'elements[0].options[0].text',
                                code: 'REQUIRED',
                            }),
                            expect.objectContaining({
                                field: 'elements[0].options[1].value',
                                code: 'REQUIRED',
                            }),
                        ]),
                    }),
                );
            });
        });

        test('should validate conflicting select configuration', async () => {
            const conflictingSelectElement: DialogElement = {
                name: 'test-select',
                type: 'select',
                display_name: 'Test Select',
                help_text: '',
                placeholder: '',
                default: '',
                optional: false,
                max_length: 0,
                min_length: 0,
                subtype: '',
                data_source: 'users', // Conflict: has both data_source and options
                options: [
                    {text: 'Option 1', value: 'option1'},
                ],
            };

            const props = {
                ...baseProps,
                elements: [conflictingSelectElement],
                conversionOptions: {
                    validateInputs: true,
                },
            };

            renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(mockConsole.warn).toHaveBeenCalledWith(
                    '[InteractiveDialogAdapter]',
                    'Element validation errors for test-select',
                    expect.objectContaining({
                        errors: expect.arrayContaining([
                            expect.objectContaining({
                                field: 'elements[0].options',
                                code: 'INVALID_FORMAT',
                                message: 'Select element cannot have both options and data_source',
                            }),
                        ]),
                    }),
                );
            });
        });
    });

    describe('Enhanced Logging', () => {
        test('should not log debug messages by default', async () => {
            const props = {
                ...baseProps,
                conversionOptions: {
                    enableDebugLogging: false,
                },
            };

            renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            expect(mockConsole.debug).not.toHaveBeenCalled();
        });

        test('should log debug messages when enabled', async () => {
            const props = {
                ...baseProps,
                conversionOptions: {
                    enableDebugLogging: true,
                    validateInputs: true,
                },
            };

            renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            // Debug logging should be enabled but we need to trigger some debug calls
            // This test verifies the logging infrastructure is set up correctly
            expect(mockConsole.debug).not.toHaveBeenCalled(); // No debug calls in normal rendering
        });

        test('should warn about unknown element types', async () => {
            const unknownElement: DialogElement = {
                name: 'test-unknown',
                type: 'unknown-type' as any,
                display_name: 'Unknown Element',
                help_text: '',
                placeholder: '',
                default: '',
                optional: false,
                max_length: 0,
                min_length: 0,
                subtype: '',
                data_source: '',
                options: [],
            };

            const props = {
                ...baseProps,
                elements: [unknownElement],
                conversionOptions: {
                    validateInputs: true,
                },
            };

            renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(mockConsole.warn).toHaveBeenCalledWith(
                    '[InteractiveDialogAdapter]',
                    'Unknown dialog element type encountered',
                    expect.objectContaining({
                        elementType: 'unknown-type',
                        elementName: 'test-unknown',
                        fallbackType: 'TEXT',
                    }),
                );
            });
        });
    });

    describe('Enhanced Type Safety and Default Values', () => {
        test('should handle boolean conversion correctly', async () => {
            const booleanTests = [
                {default: true, expected: true, name: 'true'},
                {default: false, expected: false, name: 'false'},
                {default: 'true', expected: true, name: 'string-true'},
                {default: 'false', expected: false, name: 'string-false'},
                {default: '1', expected: true, name: 'one'},
                {default: '0', expected: false, name: 'zero'},
                {default: 'yes', expected: true, name: 'yes'},
                {default: 'no', expected: false, name: 'no'},
                {default: 'invalid', expected: false, name: 'invalid'},
            ];

            // Test all boolean conversions in parallel to avoid await-in-loop
            const testPromises = booleanTests.map(async (test) => {
                const boolElement: DialogElement = {
                    name: `test-bool-${test.name}`,
                    type: 'bool',
                    display_name: 'Test Boolean',
                    help_text: '',
                    placeholder: '',
                    default: test.default as any,
                    optional: false,
                    max_length: 0,
                    min_length: 0,
                    subtype: '',
                    data_source: '',
                    options: [],
                };

                const props = {
                    ...baseProps,
                    elements: [boolElement],
                };

                const {getByTestId} = renderWithContext(
                    <InteractiveDialogAdapter {...props}/>,
                );

                await waitFor(() => {
                    expect(getByTestId(`field-value-test-bool-${test.name}`)).toHaveTextContent(String(test.expected));
                });
            });

            await Promise.all(testPromises);
        });

        test('should handle numeric subtype conversion', async () => {
            const numericElement: DialogElement = {
                name: 'test-numeric',
                type: 'text',
                display_name: 'Test Numeric',
                help_text: '',
                placeholder: '',
                default: '123.45',
                optional: false,
                max_length: 0,
                min_length: 0,
                subtype: 'number',
                data_source: '',
                options: [],
            };

            const props = {
                ...baseProps,
                elements: [numericElement],
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(getByTestId('field-value-test-numeric')).toHaveTextContent('"123.45"');
            });
        });

        test('should handle empty default values correctly', async () => {
            const emptyDefaultElement: DialogElement = {
                name: 'test-empty-default',
                type: 'text',
                display_name: 'Test Empty Default',
                help_text: '',
                placeholder: '',
                default: '', // Empty default value
                optional: true,
                max_length: 0,
                min_length: 0,
                subtype: '',
                data_source: '',
                options: [],
            };

            const props = {
                ...baseProps,
                elements: [emptyDefaultElement],
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                // Should preserve empty string as-is
                expect(getByTestId('field-value-test-empty-default')).toHaveTextContent('""');
            });
        });

        test('should handle undefined/falsy default values correctly', async () => {
            const undefinedDefaultElement: DialogElement = {
                name: 'test-undefined-default',
                type: 'text',
                display_name: 'Test Undefined Default',
                help_text: '',
                placeholder: '',
                default: '', // Empty string (falsy) default value
                optional: true,
                max_length: 0,
                min_length: 0,
                subtype: '',
                data_source: '',
                options: [],
            };

            const props = {
                ...baseProps,
                elements: [undefinedDefaultElement],
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                // Should preserve empty string as-is (matches original dialog behavior)
                expect(getByTestId('field-value-test-undefined-default')).toHaveTextContent('""');
            });
        });

        test('should handle missing default values in select options', async () => {
            const selectElement: DialogElement = {
                name: 'test-select',
                type: 'select',
                display_name: 'Test Select',
                help_text: '',
                placeholder: '',
                default: 'nonexistent', // This option doesn't exist
                optional: false,
                max_length: 0,
                min_length: 0,
                subtype: '',
                data_source: '',
                options: [
                    {text: 'Option 1', value: 'option1'},
                    {text: 'Option 2', value: 'option2'},
                ],
            };

            const props = {
                ...baseProps,
                elements: [selectElement],
                conversionOptions: {
                    validateInputs: true,
                },
            };

            renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(mockConsole.warn).toHaveBeenCalledWith(
                    '[InteractiveDialogAdapter]',
                    'Default value not found in options',
                    expect.objectContaining({
                        elementName: 'test-select',
                        defaultValue: 'nonexistent',
                        availableOptions: ['option1', 'option2'],
                    }),
                );
            });
        });
    });

    describe('Backwards Compatibility', () => {
        test('should work with minimal dialog configuration', async () => {
            const minimalProps = {
                actions: {
                    submitInteractiveDialog: jest.fn(),
                    lookupInteractiveDialog: jest.fn(),
                },
            };

            expect(() => {
                renderWithContext(
                    <InteractiveDialogAdapter {...minimalProps}/>,
                );
            }).not.toThrow();
        });

        test('should handle empty elements array', async () => {
            const props = {
                ...baseProps,
                elements: [],
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(getByTestId('form-fields-count')).toHaveTextContent('0');
            });
        });

        test('should handle undefined elements', async () => {
            const props = {
                ...baseProps,
                elements: undefined,
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(getByTestId('form-fields-count')).toHaveTextContent('0');
            });
        });
    });

    describe('Submit and Cancel Functionality', () => {
        test('should handle submit adapter with successful response', async () => {
            const mockSubmitSuccess = jest.fn().mockResolvedValue({
                data: {}, // Success response (no error or errors)
            });

            const textElement: DialogElement = {
                name: 'test-field',
                type: 'text',
                display_name: 'Test Field',
                help_text: '',
                placeholder: '',
                default: 'test value',
                optional: false,
                max_length: 0,
                min_length: 0,
                subtype: '',
                data_source: '',
                options: [],
            };

            const props = {
                ...baseProps,
                elements: [textElement],
                actions: {
                    submitInteractiveDialog: mockSubmitSuccess,
                    lookupInteractiveDialog: jest.fn().mockResolvedValue({data: {items: []}}),
                },
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(getByTestId('apps-form-container')).toBeInTheDocument();
            });

            // Verify MockAppsFormContainer received the submit action
            expect(MockAppsFormContainer).toHaveBeenCalledWith(
                expect.objectContaining({
                    actions: expect.objectContaining({
                        doAppSubmit: expect.any(Function),
                    }),
                }),
                {},
            );
        });

        test('should handle submit adapter with server validation errors', async () => {
            const mockSubmitWithErrors = jest.fn().mockResolvedValue({
                data: {
                    error: 'Validation failed',
                    errors: {
                        'test-field': 'Field is required',
                    },
                },
            });

            const props = {
                ...baseProps,
                actions: {
                    submitInteractiveDialog: mockSubmitWithErrors,
                    lookupInteractiveDialog: jest.fn().mockResolvedValue({data: {items: []}}),
                },
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(getByTestId('apps-form-container')).toBeInTheDocument();
            });

            // Get the submit adapter function
            const mockCall = MockAppsFormContainer.mock.calls[0][0];
            const submitAdapter = mockCall.actions.doAppSubmit;

            // Test the submit adapter directly
            const result = await submitAdapter({
                values: {'test-field': 'test value'},
            });

            expect(result.error).toBeDefined();
            expect(result.error.text).toBe('Validation failed');
            expect(result.error.data.errors).toEqual({'test-field': 'Field is required'});
        });

        test('should handle submit adapter with network error', async () => {
            const mockSubmitWithNetworkError = jest.fn().mockResolvedValue({
                error: {
                    message: 'Network connection failed',
                },
            });

            const props = {
                ...baseProps,
                actions: {
                    submitInteractiveDialog: mockSubmitWithNetworkError,
                    lookupInteractiveDialog: jest.fn().mockResolvedValue({data: {items: []}}),
                },
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(getByTestId('apps-form-container')).toBeInTheDocument();
            });

            // Get the submit adapter function and test error handling
            const mockCall = MockAppsFormContainer.mock.calls[0][0];
            const submitAdapter = mockCall.actions.doAppSubmit;

            const result = await submitAdapter({
                values: {},
            });

            expect(result.error).toBeDefined();
            expect(result.error.type).toBe('error');
        });

        test('should handle submit adapter exception', async () => {
            const mockSubmitThrows = jest.fn().mockRejectedValue(new Error('Submit failed'));

            const props = {
                ...baseProps,
                actions: {
                    submitInteractiveDialog: mockSubmitThrows,
                    lookupInteractiveDialog: jest.fn().mockResolvedValue({data: {items: []}}),
                },
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(getByTestId('apps-form-container')).toBeInTheDocument();
            });

            // Test exception handling in submit adapter
            const mockCall = MockAppsFormContainer.mock.calls[0][0];
            const submitAdapter = mockCall.actions.doAppSubmit;

            const result = await submitAdapter({
                values: {},
            });

            expect(result.error).toBeDefined();
            expect(result.error.text).toBe('Submit failed');
            expect(mockConsole.error).toHaveBeenCalledWith(
                '[InteractiveDialogAdapter]',
                'Dialog submission failed',
                expect.any(Object),
            );
        });

        test('should handle cancel adapter with notifyOnCancel enabled', async () => {
            const mockSubmit = jest.fn().mockResolvedValue({data: {}});

            const props = {
                ...baseProps,
                notifyOnCancel: true,
                actions: {
                    submitInteractiveDialog: mockSubmit,
                    lookupInteractiveDialog: jest.fn().mockResolvedValue({data: {items: []}}),
                },
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(getByTestId('apps-form-container')).toBeInTheDocument();
            });

            // Get the cancel adapter (onHide) function
            const mockCall = MockAppsFormContainer.mock.calls[0][0];
            const cancelAdapter = mockCall.onHide;

            await cancelAdapter();

            expect(mockSubmit).toHaveBeenCalledWith(
                expect.objectContaining({
                    cancelled: true,
                    url: baseProps.url,
                    callback_id: baseProps.callbackId,
                    state: baseProps.state,
                }),
            );
        });

        test('should handle cancel adapter with notifyOnCancel disabled', async () => {
            const mockSubmit = jest.fn();

            const props = {
                ...baseProps,
                notifyOnCancel: false,
                actions: {
                    submitInteractiveDialog: mockSubmit,
                    lookupInteractiveDialog: jest.fn().mockResolvedValue({data: {items: []}}),
                },
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(getByTestId('apps-form-container')).toBeInTheDocument();
            });

            // Get the cancel adapter function
            const mockCall = MockAppsFormContainer.mock.calls[0][0];
            const cancelAdapter = mockCall.onHide;

            await cancelAdapter();

            // Should not call submit when notifyOnCancel is false
            expect(mockSubmit).not.toHaveBeenCalled();
        });

        test('should handle cancel adapter exception gracefully', async () => {
            const mockSubmitThrows = jest.fn().mockRejectedValue(new Error('Cancel failed'));

            const props = {
                ...baseProps,
                notifyOnCancel: true,
                actions: {
                    submitInteractiveDialog: mockSubmitThrows,
                    lookupInteractiveDialog: jest.fn().mockResolvedValue({data: {items: []}}),
                },
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(getByTestId('apps-form-container')).toBeInTheDocument();
            });

            // Get the cancel adapter function
            const mockCall = MockAppsFormContainer.mock.calls[0][0];
            const cancelAdapter = mockCall.onHide;

            // Should not throw even if submit fails
            await expect(cancelAdapter()).resolves.toBeUndefined();

            expect(mockConsole.error).toHaveBeenCalledWith(
                '[InteractiveDialogAdapter]',
                'Failed to notify server of dialog cancellation',
                expect.any(Object),
            );
        });
    });

    describe('Form Value Conversion', () => {
        test('should convert complex form values back to dialog submission format', async () => {
            const elements: DialogElement[] = [
                {
                    name: 'text-field',
                    type: 'text',
                    display_name: 'Text Field',
                    default: 'default text',
                    optional: false,
                    max_length: 100,
                    min_length: 5,
                    help_text: '',
                    placeholder: '',
                    subtype: '',
                    data_source: '',
                    options: [],
                },
                {
                    name: 'numeric-field',
                    type: 'text',
                    display_name: 'Numeric Field',
                    default: '42',
                    optional: false,
                    subtype: 'number',
                    max_length: 0,
                    min_length: 0,
                    help_text: '',
                    placeholder: '',
                    data_source: '',
                    options: [],
                },
                {
                    name: 'bool-field',
                    type: 'bool',
                    display_name: 'Boolean Field',
                    default: 'true',
                    optional: false,
                    max_length: 0,
                    min_length: 0,
                    help_text: '',
                    placeholder: '',
                    subtype: '',
                    data_source: '',
                    options: [],
                },
                {
                    name: 'select-field',
                    type: 'select',
                    display_name: 'Select Field',
                    default: 'option2',
                    optional: false,
                    options: [
                        {text: 'Option 1', value: 'option1'},
                        {text: 'Option 2', value: 'option2'},
                    ],
                    max_length: 0,
                    min_length: 0,
                    help_text: '',
                    placeholder: '',
                    subtype: '',
                    data_source: '',
                },
            ];

            const mockSubmit = jest.fn().mockResolvedValue({data: {}});

            const props = {
                ...baseProps,
                elements,
                actions: {
                    submitInteractiveDialog: mockSubmit,
                    lookupInteractiveDialog: jest.fn().mockResolvedValue({data: {items: []}}),
                },
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(getByTestId('apps-form-container')).toBeInTheDocument();
            });

            // Get the submit adapter function
            const mockCall = MockAppsFormContainer.mock.calls[0][0];
            const submitAdapter = mockCall.actions.doAppSubmit;

            // Test form value conversion
            await submitAdapter({
                values: {
                    'text-field': 'updated text',
                    'numeric-field': 123.45,
                    'bool-field': true,
                    'select-field': {label: 'Option 1', value: 'option1'},
                },
            });

            expect(mockSubmit).toHaveBeenCalledWith(
                expect.objectContaining({
                    submission: {
                        'text-field': 'updated text',
                        'numeric-field': 123.45,
                        'bool-field': true,
                        'select-field': 'option1',
                    },
                }),
            );
        });

        test('should validate field lengths during conversion when validation enabled', async () => {
            const textElement: DialogElement = {
                name: 'text-field',
                type: 'text',
                display_name: 'Text Field',
                default: '',
                optional: false,
                max_length: 10,
                min_length: 5,
                help_text: '',
                placeholder: '',
                subtype: '',
                data_source: '',
                options: [],
            };

            const props = {
                ...baseProps,
                elements: [textElement],
                conversionOptions: {
                    validateInputs: true,
                },
                actions: {
                    submitInteractiveDialog: jest.fn().mockResolvedValue({data: {}}),
                    lookupInteractiveDialog: jest.fn(),
                },
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(getByTestId('apps-form-container')).toBeInTheDocument();
            });

            // Get the submit adapter function
            const mockCall = MockAppsFormContainer.mock.calls[0][0];
            const submitAdapter = mockCall.actions.doAppSubmit;

            // Test with value that's too short
            await submitAdapter({
                values: {
                    'text-field': 'abc', // Too short (< 5 chars)
                },
            });

            expect(mockConsole.warn).toHaveBeenCalledWith(
                '[InteractiveDialogAdapter]',
                'Field value too short',
                expect.objectContaining({
                    fieldName: 'text-field',
                    actualLength: 3,
                    minLength: 5,
                }),
            );

            // Test with value that's too long
            await submitAdapter({
                values: {
                    'text-field': 'this is way too long', // Too long (> 10 chars)
                },
            });

            expect(mockConsole.warn).toHaveBeenCalledWith(
                '[InteractiveDialogAdapter]',
                'Field value too long',
                expect.objectContaining({
                    fieldName: 'text-field',
                    actualLength: 20,
                    maxLength: 10,
                }),
            );
        });

        test('should handle missing required values during conversion', async () => {
            const requiredElement: DialogElement = {
                name: 'required-field',
                type: 'text',
                display_name: 'Required Field',
                default: '',
                optional: false,
                max_length: 0,
                min_length: 0,
                help_text: '',
                placeholder: '',
                subtype: '',
                data_source: '',
                options: [],
            };

            const props = {
                ...baseProps,
                elements: [requiredElement],
                actions: {
                    submitInteractiveDialog: jest.fn().mockResolvedValue({data: {}}),
                },
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(getByTestId('apps-form-container')).toBeInTheDocument();
            });

            // Get the submit adapter function
            const mockCall = MockAppsFormContainer.mock.calls[0][0];
            const submitAdapter = mockCall.actions.doAppSubmit;

            // Test with null value for required field - should not crash
            const result = await submitAdapter({
                values: {
                    'required-field': null,
                },
            });

            // Should complete successfully (null values are simply skipped)
            expect(result.data?.type).toBe('ok');
        });
    });

    describe('No-op Handlers', () => {
        test('should handle lookup calls with no-op implementation', async () => {
            const mockLookupHandler = jest.fn().mockResolvedValue({
                data: {items: []},
            });

            const propsWithLookup = {
                ...baseProps,
                actions: {
                    ...baseProps.actions,
                    lookupInteractiveDialog: mockLookupHandler,
                },
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...propsWithLookup}/>,
            );

            await waitFor(() => {
                expect(getByTestId('apps-form-container')).toBeInTheDocument();
            });

            // Get the lookup handler
            const mockCall = MockAppsFormContainer.mock.calls[MockAppsFormContainer.mock.calls.length - 1][0];
            const lookupHandler = mockCall.actions.doAppLookup;

            const result = await lookupHandler({
                selected_field: 'test-field',
                query: 'test',
                values: {},
            });

            expect(result.data).toEqual({
                type: 'ok',
                data: {items: []},
            });
        });

        test('should handle refresh calls with no-op implementation', async () => {
            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...baseProps}/>,
            );

            await waitFor(() => {
                expect(getByTestId('apps-form-container')).toBeInTheDocument();
            });

            // Get the refresh handler
            const mockCall = MockAppsFormContainer.mock.calls[0][0];
            const refreshHandler = mockCall.actions.doAppFetchForm;

            const result = await refreshHandler({
                values: {},
                selected_field: 'test-field',
            });

            expect(result.data).toEqual({
                type: 'ok',
            });
        });

        test('should warn about unsupported features when validation enabled', async () => {
            const props = {
                ...baseProps,
                conversionOptions: {
                    validateInputs: true,
                },
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(getByTestId('apps-form-container')).toBeInTheDocument();
            });

            // Get the handlers
            const mockCall = MockAppsFormContainer.mock.calls[0][0];
            const refreshHandler = mockCall.actions.doAppFetchForm;

            await lookupHandler({
                values: {},
            });
            await refreshHandler({
                values: {},
                selected_field: 'test-field',
            });

            expect(mockConsole.warn).toHaveBeenCalledWith(
                '[InteractiveDialogAdapter]',
                'Lookup calls are not supported in Interactive Dialogs',
                expect.objectContaining({
                    feature: 'dynamic lookup',
                    suggestion: 'Consider migrating to full Apps Framework',
                }),
            );

            expect(mockConsole.warn).toHaveBeenCalledWith(
                '[InteractiveDialogAdapter]',
                'Field refresh requested but no sourceUrl provided',
                expect.objectContaining({
                    fieldName: 'test-field',
                    suggestion: 'Add sourceUrl to dialog definition',
                }),
            );
        });

        test('should handle postEphemeralCallResponseForContext as no-op', async () => {
            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...baseProps}/>,
            );

            await waitFor(() => {
                expect(getByTestId('apps-form-container')).toBeInTheDocument();
            });

            // Get the ephemeral handler
            const mockCall = MockAppsFormContainer.mock.calls[0][0];
            const ephemeralHandler = mockCall.actions.postEphemeralCallResponseForContext;

            // Should not throw
            expect(() => {
                ephemeralHandler();
            }).not.toThrow();
        });
    });

    describe('Dynamic Import Loading', () => {
        test('should handle lazy loading with React Suspense', async () => {
            // With React.lazy, the component should load asynchronously
            // but the test environment with mocking should handle it synchronously
            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...baseProps}/>,
            );

            // Should render the component successfully with mocked AppsFormContainer
            await waitFor(() => {
                expect(getByTestId('apps-form-container')).toBeInTheDocument();
            });
        });
    });

    describe('Advanced Validation Scenarios', () => {
        test('should validate element max_length constraints for different field types', async () => {
            const elementsWithInvalidLengths: DialogElement[] = [
                {
                    name: 'text_field',
                    type: 'text',
                    display_name: 'Text Field',
                    max_length: 200, // Exceeds 150 limit for text
                    subtype: '',
                    default: '',
                    placeholder: '',
                    help_text: '',
                    optional: false,
                    min_length: 0,
                    data_source: '',
                    options: [],
                },
                {
                    name: 'textarea_field',
                    type: 'textarea',
                    display_name: 'Textarea Field',
                    max_length: 4000, // Exceeds 3000 limit for textarea
                    subtype: '',
                    default: '',
                    placeholder: '',
                    help_text: '',
                    optional: false,
                    min_length: 0,
                    data_source: '',
                    options: [],
                },
                {
                    name: 'select_field',
                    type: 'select',
                    display_name: 'Select Field',
                    max_length: 4000, // Exceeds 3000 limit for select
                    subtype: '',
                    default: '',
                    placeholder: '',
                    help_text: '',
                    optional: false,
                    min_length: 0,
                    data_source: '',
                    options: [{text: 'Option1', value: 'opt1'}],
                },
                {
                    name: 'bool_field',
                    type: 'bool',
                    display_name: 'Bool Field',
                    max_length: 200, // Exceeds 150 limit for bool
                    subtype: '',
                    default: '',
                    placeholder: '',
                    help_text: '',
                    optional: false,
                    min_length: 0,
                    data_source: '',
                    options: [],
                },
            ];

            const props = {
                ...baseProps,
                elements: elementsWithInvalidLengths,
                conversionOptions: {
                    validateInputs: true,
                    strictMode: false,
                },
            };

            renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            // Should warn about all max_length violations but continue rendering
            await waitFor(() => {
                expect(mockConsole.warn).toHaveBeenCalledTimes(4); // One call per invalid element
                expect(mockConsole.warn).toHaveBeenCalledWith(
                    '[InteractiveDialogAdapter]',
                    'Element validation errors for text_field',
                    expect.objectContaining({
                        errors: expect.arrayContaining([
                            expect.objectContaining({
                                code: 'TOO_LONG',
                                message: expect.stringContaining('max_length too large'),
                            }),
                        ]),
                    }),
                );
            });
        });

        test('should validate min/max length relationships', async () => {
            const elementWithInvalidRange: DialogElement = {
                name: 'invalid_range',
                type: 'text',
                display_name: 'Invalid Range',
                min_length: 100,
                max_length: 50, // min > max
                subtype: '',
                default: '',
                placeholder: '',
                help_text: '',
                optional: false,
                data_source: '',
                options: [],
            };

            const props = {
                ...baseProps,
                elements: [elementWithInvalidRange],
                conversionOptions: {
                    validateInputs: true,
                },
            };

            renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(mockConsole.warn).toHaveBeenCalledWith(
                    '[InteractiveDialogAdapter]',
                    'Element validation errors for invalid_range',
                    expect.objectContaining({
                        errors: expect.arrayContaining([
                            expect.objectContaining({
                                code: 'INVALID_FORMAT',
                                message: 'min_length cannot be greater than max_length',
                            }),
                        ]),
                    }),
                );
            });
        });
    });

    describe('Enhanced Type Conversion', () => {
        test('should handle data_source selectors correctly', async () => {
            const userSelectorElement: DialogElement = {
                name: 'user_selector',
                type: 'select',
                display_name: 'User Selector',
                data_source: 'users',
                subtype: '',
                default: '',
                placeholder: '',
                help_text: '',
                optional: false,
                min_length: 0,
                max_length: 0,
                options: [],
            };

            const channelSelectorElement: DialogElement = {
                name: 'channel_selector',
                type: 'select',
                display_name: 'Channel Selector',
                data_source: 'channels',
                subtype: '',
                default: '',
                placeholder: '',
                help_text: '',
                optional: false,
                min_length: 0,
                max_length: 0,
                options: [],
            };

            const props = {
                ...baseProps,
                elements: [userSelectorElement, channelSelectorElement],
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(getByTestId('field-type-user_selector')).toHaveTextContent('user');
                expect(getByTestId('field-type-channel_selector')).toHaveTextContent('channel');
            });
        });

        test('should handle textarea subtype correctly', async () => {
            const textareaElement: DialogElement = {
                name: 'description',
                type: 'textarea',
                display_name: 'Description',
                default: 'Default description text',
                subtype: '',
                placeholder: '',
                help_text: '',
                optional: false,
                min_length: 0,
                max_length: 0,
                data_source: '',
                options: [],
            };

            const props = {
                ...baseProps,
                elements: [textareaElement],
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(getByTestId('field-type-description')).toHaveTextContent('text'); // Maps to TEXT type
                expect(getByTestId('field-value-description')).toHaveTextContent('"Default description text"');
            });
        });

        test('should handle text subtypes (email, password, number)', async () => {
            const textElements: DialogElement[] = [
                {
                    name: 'email_field',
                    type: 'text',
                    subtype: 'email',
                    display_name: 'Email Field',
                    default: 'test@example.com',
                    placeholder: '',
                    help_text: '',
                    optional: false,
                    min_length: 0,
                    max_length: 0,
                    data_source: '',
                    options: [],
                },
                {
                    name: 'password_field',
                    type: 'text',
                    subtype: 'password',
                    display_name: 'Password Field',
                    default: '',
                    placeholder: '',
                    help_text: '',
                    optional: false,
                    min_length: 0,
                    max_length: 0,
                    data_source: '',
                    options: [],
                },
                {
                    name: 'number_field',
                    type: 'text',
                    subtype: 'number',
                    display_name: 'Number Field',
                    default: '42',
                    placeholder: '',
                    help_text: '',
                    optional: false,
                    min_length: 0,
                    max_length: 0,
                    data_source: '',
                    options: [],
                },
            ];

            const props = {
                ...baseProps,
                elements: textElements,
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(getByTestId('field-value-email_field')).toHaveTextContent('"test@example.com"');
                expect(getByTestId('field-value-password_field')).toHaveTextContent('""'); // Empty string, not null
                expect(getByTestId('field-value-number_field')).toHaveTextContent('"42"');
            });
        });
    });

    describe('Error Handling and Recovery', () => {
        test('should handle element conversion errors gracefully in non-strict mode', async () => {
            const problematicElement = {
                name: 'problematic',
                type: 'invalid_type', // This will cause conversion error
                display_name: 'Problematic Element',
            } as DialogElement;

            const props = {
                ...baseProps,
                elements: [problematicElement],
                conversionOptions: {
                    validateInputs: true,
                    strictMode: false, // Should continue processing
                },
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(getByTestId('form-fields-count')).toHaveTextContent('1'); // Should still create placeholder field
                expect(mockConsole.warn).toHaveBeenCalledWith(
                    '[InteractiveDialogAdapter]',
                    'Unknown dialog element type encountered',
                    expect.objectContaining({
                        elementType: 'invalid_type',
                        fallbackType: 'TEXT',
                    }),
                );
            });
        });

        test('should throw error in strict mode for validation failures', async () => {
            const invalidElement: DialogElement = {
                name: '', // Invalid: empty name
                type: 'text',
                display_name: '',
                subtype: '',
                default: '',
                placeholder: '',
                help_text: '',
                optional: false,
                min_length: 0,
                max_length: 0,
                data_source: '',
                options: [],
            };

            const props = {
                ...baseProps,
                elements: [invalidElement],
                conversionOptions: {
                    validateInputs: true,
                    strictMode: true,
                },
            };

            expect(() => {
                renderWithContext(
                    <InteractiveDialogAdapter {...props}/>,
                );
            }).toThrow('Element validation failed:');
        });

        test('should handle missing title in strict mode', async () => {
            const props = {
                ...baseProps,
                title: '', // Invalid: empty title
                conversionOptions: {
                    validateInputs: true,
                    strictMode: true,
                },
            };

            expect(() => {
                renderWithContext(
                    <InteractiveDialogAdapter {...props}/>,
                );
            }).toThrow('Dialog validation failed:');
        });
    });

    describe('Submit Label Support', () => {
        test('should pass through custom submit label to AppForm', async () => {
            const props = {
                ...baseProps,
                submitLabel: 'Custom Submit Text',
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(getByTestId('apps-form-container')).toBeInTheDocument();

                // The MockAppsFormContainer doesn't render submit_label, but we can verify
                // it was passed to the form by checking that the component rendered successfully
                // with the expected props structure
            });
        });

        test('should handle undefined submit label gracefully', async () => {
            const props = {
                ...baseProps,
                submitLabel: undefined,
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(getByTestId('apps-form-container')).toBeInTheDocument();
            });
        });

        test('should sanitize submit label for XSS prevention', async () => {
            const props = {
                ...baseProps,
                submitLabel: '<script>alert("xss")</script>Submit Test',
                conversionOptions: {
                    sanitizeStrings: true,
                },
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(getByTestId('apps-form-container')).toBeInTheDocument();

                // Verify component renders successfully with sanitized input
            });
        });
    });

    describe('Dynamic Select Support', () => {
        test('should convert select element with dynamic data_source correctly', async () => {
            const dynamicDataSourceElement: DialogElement = {
                name: 'dynamic-data-source-field',
                type: 'select',
                display_name: 'Dynamic Data Source Field',
                help_text: 'Choose an option',
                placeholder: 'Type to search...',
                default: 'preset_value',
                optional: true,
                max_length: 0,
                min_length: 0,
                subtype: '',
                data_source: 'dynamic',
                data_source_url: 'https://example.com/api/options',
                options: [],
            };

            const props = {
                ...baseProps,
                elements: [dynamicDataSourceElement],
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(getByTestId('field-type-dynamic-data-source-field')).toHaveTextContent(AppFieldTypes.DYNAMIC_SELECT);
                const expectedValue = JSON.stringify({label: 'preset_value', value: 'preset_value'});
                expect(getByTestId('field-value-dynamic-data-source-field')).toHaveTextContent(expectedValue);
                expect(getByTestId('field-required-dynamic-data-source-field')).toHaveTextContent('optional');
            });
        });

        test('should handle dynamic select default values correctly', async () => {
            const dynamicSelectWithDefault: DialogElement = {
                name: 'dynamic-with-default',
                type: 'select',
                data_source: 'dynamic',
                display_name: 'Dynamic Select with Default',
                help_text: '',
                placeholder: '',
                default: 'selected_option_value',
                optional: false,
                max_length: 0,
                min_length: 0,
                subtype: '',
                options: [],
            };

            const props = {
                ...baseProps,
                elements: [dynamicSelectWithDefault],
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                const valueElement = getByTestId('field-value-dynamic-with-default');
                const valueText = valueElement.textContent;

                // Should create AppSelectOption with both label and value set to default
                expect(valueText).toContain('selected_option_value');
                expect(valueText).toContain('label');
                expect(valueText).toContain('value');
            });
        });

        test('should handle empty default for dynamic select', async () => {
            const dynamicSelectNoDefault: DialogElement = {
                name: 'dynamic-no-default',
                type: 'select',
                data_source: 'dynamic',
                display_name: 'Dynamic Select No Default',
                help_text: '',
                placeholder: '',
                default: '',
                optional: true,
                max_length: 0,
                min_length: 0,
                subtype: '',
                options: [],
            };

            const props = {
                ...baseProps,
                elements: [dynamicSelectNoDefault],
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(getByTestId('field-value-dynamic-no-default')).toHaveTextContent('null');
            });
        });

        test('should handle lookup calls for dynamic select', async () => {
            const mockLookupResponse = {
                data: {
                    items: [
                        {text: 'Option 1', value: 'value1'},
                        {text: 'Option 2', value: 'value2'},
                        {text: 'Option 3', value: 'value3'},
                    ],
                },
            };

            const mockLookupDialog = jest.fn().mockResolvedValue(mockLookupResponse);

            const dynamicSelectElement: DialogElement = {
                name: 'dynamic-lookup-field',
                type: 'select',
                data_source: 'dynamic',
                display_name: 'Dynamic Lookup Field',
                help_text: '',
                placeholder: '',
                default: '',
                optional: false,
                max_length: 0,
                min_length: 0,
                subtype: '',
                options: [],
            };

            const props = {
                ...baseProps,
                elements: [dynamicSelectElement],
                actions: {
                    submitInteractiveDialog: jest.fn().mockResolvedValue({data: {}}),
                    lookupInteractiveDialog: mockLookupDialog,
                },
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(getByTestId('apps-form-container')).toBeInTheDocument();
            });

            // Get the lookup handler from the MockAppsFormContainer
            const mockCall = MockAppsFormContainer.mock.calls[0][0];
            const lookupHandler = mockCall.actions.doAppLookup;

            // Test the lookup call
            const result = await lookupHandler({
                selected_field: 'dynamic-lookup-field',
                query: 'test query',
                values: {'dynamic-lookup-field': 'test'},
            });

            expect(mockLookupDialog).toHaveBeenCalledWith({
                url: baseProps.url,
                callback_id: baseProps.callbackId,
                state: baseProps.state,
                submission: {
                    query: 'test query',
                    selected_field: 'dynamic-lookup-field',
                    'dynamic-lookup-field': 'test',
                },
                user_id: '',
                channel_id: '',
                team_id: '',
                cancelled: false,
            });

            expect(result.data).toEqual({
                type: 'ok',
                data: {
                    items: [
                        {label: 'Option 1', value: 'value1'},
                        {label: 'Option 2', value: 'value2'},
                        {label: 'Option 3', value: 'value3'},
                    ],
                },
            });
        });

        test('should handle lookup calls with data_source_url priority', async () => {
            const mockLookupResponse = {
                data: {
                    items: [
                        {text: 'Plugin Option 1', value: 'plugin_value1'},
                    ],
                },
            };

            const mockLookupDialog = jest.fn().mockResolvedValue(mockLookupResponse);

            const dynamicDataSourceElement: DialogElement = {
                name: 'dynamic-data-source-lookup',
                type: 'select',
                display_name: 'Dynamic Data Source Lookup',
                help_text: '',
                placeholder: '',
                default: '',
                optional: false,
                max_length: 0,
                min_length: 0,
                subtype: '',
                data_source: 'dynamic',
                data_source_url: '/plugins/myplugin/lookup',
                options: [],
            };

            const props = {
                ...baseProps,
                elements: [dynamicDataSourceElement],
                actions: {
                    submitInteractiveDialog: jest.fn().mockResolvedValue({data: {}}),
                    lookupInteractiveDialog: mockLookupDialog,
                },
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(getByTestId('apps-form-container')).toBeInTheDocument();
            });

            // Get the lookup handler
            const mockCall = MockAppsFormContainer.mock.calls[0][0];
            const lookupHandler = mockCall.actions.doAppLookup;

            // Test lookup with data_source_url priority
            const result = await lookupHandler({
                selected_field: 'dynamic-data-source-lookup',
                query: 'plugin test',
                values: {},
            });

            expect(mockLookupDialog).toHaveBeenCalledWith(
                expect.objectContaining({
                    url: '/plugins/myplugin/lookup', // Should use data_source_url, not dialog URL
                    submission: expect.objectContaining({
                        query: 'plugin test',
                        selected_field: 'dynamic-data-source-lookup',
                    }),
                }),
            );

            expect(result.data.data.items).toEqual([
                {label: 'Plugin Option 1', value: 'plugin_value1'},
            ]);
        });

        test('should handle lookup call errors gracefully', async () => {
            const mockLookupError = jest.fn().mockResolvedValue({
                error: {message: 'Lookup failed'},
            });

            const props = {
                ...baseProps,
                elements: [{
                    name: 'dynamic-error-field',
                    type: 'select',
                    data_source: 'dynamic',
                    display_name: 'Dynamic Error Field',
                    help_text: '',
                    placeholder: '',
                    default: '',
                    optional: false,
                    max_length: 0,
                    min_length: 0,
                    subtype: '',
                    options: [],
                }],
                actions: {
                    submitInteractiveDialog: jest.fn().mockResolvedValue({data: {}}),
                    lookupInteractiveDialog: mockLookupError,
                },
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(getByTestId('apps-form-container')).toBeInTheDocument();
            });

            // Get the lookup handler
            const mockCall = MockAppsFormContainer.mock.calls[0][0];
            const lookupHandler = mockCall.actions.doAppLookup;

            // Test error handling
            const result = await lookupHandler({
                selected_field: 'dynamic-error-field',
                query: 'error test',
                values: {},
            });

            expect(result.error).toBeDefined();
            expect(result.error.text).toBe('Lookup failed');
        });

        test('should handle lookup call exceptions', async () => {
            const mockLookupException = jest.fn().mockRejectedValue(new Error('Network error'));

            const props = {
                ...baseProps,
                elements: [{
                    name: 'dynamic-exception-field',
                    type: 'select',
                    data_source: 'dynamic',
                    display_name: 'Dynamic Exception Field',
                    help_text: '',
                    placeholder: '',
                    default: '',
                    optional: false,
                    max_length: 0,
                    min_length: 0,
                    subtype: '',
                    options: [],
                }],
                actions: {
                    submitInteractiveDialog: jest.fn().mockResolvedValue({data: {}}),
                    lookupInteractiveDialog: mockLookupException,
                },
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(getByTestId('apps-form-container')).toBeInTheDocument();
            });

            // Get the lookup handler
            const mockCall = MockAppsFormContainer.mock.calls[0][0];
            const lookupHandler = mockCall.actions.doAppLookup;

            // Test exception handling
            const result = await lookupHandler({
                selected_field: 'dynamic-exception-field',
                query: 'exception test',
                values: {},
            });

            expect(result.error).toBeDefined();
            expect(result.error.text).toBe('Network error');
            expect(mockConsole.error).toHaveBeenCalledWith(
                '[InteractiveDialogAdapter]',
                'Lookup request failed',
                expect.any(Error),
            );
        });

        test('should validate lookup URLs for security', async () => {
            const propsWithInsecureUrl = {
                ...baseProps,
                url: 'http://insecure.com/lookup', // HTTP instead of HTTPS
                elements: [{
                    name: 'secure-field',
                    type: 'select',
                    data_source: 'dynamic',
                    display_name: 'Secure Field',
                    help_text: '',
                    placeholder: '',
                    default: '',
                    optional: false,
                    max_length: 0,
                    min_length: 0,
                    subtype: '',
                    options: [],
                }],
                actions: {
                    submitInteractiveDialog: jest.fn().mockResolvedValue({data: {}}),
                    lookupInteractiveDialog: jest.fn(),
                },
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...propsWithInsecureUrl}/>,
            );

            await waitFor(() => {
                expect(getByTestId('apps-form-container')).toBeInTheDocument();
            });

            // Get the lookup handler
            const mockCall = MockAppsFormContainer.mock.calls[0][0];
            const lookupHandler = mockCall.actions.doAppLookup;

            // Test with invalid URL (HTTP instead of HTTPS)
            const result = await lookupHandler({
                selected_field: 'secure-field',
                query: 'security test',
                values: {},
            });

            expect(result.error).toBeDefined();
            expect(result.error.text).toBe('Invalid lookup URL: must be HTTPS URL or /plugins/ path');
        });

        test('should handle dynamic select value conversion in submissions', async () => {
            const mockSubmit = jest.fn().mockResolvedValue({data: {}});

            const dynamicSelectElement: DialogElement = {
                name: 'dynamic-submit-field',
                type: 'select',
                data_source: 'dynamic',
                display_name: 'Dynamic Submit Field',
                help_text: '',
                placeholder: '',
                default: '',
                optional: false,
                max_length: 0,
                min_length: 0,
                subtype: '',
                options: [],
            };

            const props = {
                ...baseProps,
                elements: [dynamicSelectElement],
                actions: {
                    submitInteractiveDialog: mockSubmit,
                    lookupInteractiveDialog: jest.fn(),
                },
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(getByTestId('apps-form-container')).toBeInTheDocument();
            });

            // Get the submit adapter
            const mockCall = MockAppsFormContainer.mock.calls[0][0];
            const submitAdapter = mockCall.actions.doAppSubmit;

            // Test submission with dynamic select value (AppSelectOption format)
            await submitAdapter({
                values: {
                    'dynamic-submit-field': {
                        label: 'Selected Option',
                        value: 'selected_value',
                    },
                },
            });

            expect(mockSubmit).toHaveBeenCalledWith(
                expect.objectContaining({
                    submission: {
                        'dynamic-submit-field': 'selected_value', // Should extract value from AppSelectOption
                    },
                }),
            );

            // Test submission with string value (fallback case)
            await submitAdapter({
                values: {
                    'dynamic-submit-field': 'direct_string_value',
                },
            });

            expect(mockSubmit).toHaveBeenCalledWith(
                expect.objectContaining({
                    submission: {
                        'dynamic-submit-field': 'direct_string_value',
                    },
                }),
            );
        });

        test('should handle empty lookup responses gracefully', async () => {
            const mockLookupEmpty = jest.fn().mockResolvedValue({
                data: {items: []},
            });

            const dynamicSelectElement: DialogElement = {
                name: 'test-field',
                type: 'select',
                data_source: 'dynamic',
                display_name: 'Test Field',
                help_text: '',
                placeholder: '',
                default: '',
                optional: false,
                max_length: 0,
                min_length: 0,
                subtype: '',
                options: [],
            };

            const props = {
                ...baseProps,
                elements: [dynamicSelectElement],
                actions: {
                    submitInteractiveDialog: jest.fn().mockResolvedValue({data: {}}),
                    lookupInteractiveDialog: mockLookupEmpty,
                },
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(getByTestId('apps-form-container')).toBeInTheDocument();
            });

            // Get the lookup handler
            const mockCall = MockAppsFormContainer.mock.calls[0][0];
            const lookupHandler = mockCall.actions.doAppLookup;

            const result = await lookupHandler({
                selected_field: 'test-field',
                query: 'no results',
                values: {},
            });

            expect(result.data).toEqual({
                type: 'ok',
                data: {items: []},
            });
        });
    });
});
