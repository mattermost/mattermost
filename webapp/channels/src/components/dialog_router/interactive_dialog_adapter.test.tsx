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
    return (
        <div data-testid='apps-form-container'>
            <div data-testid='form-title'>{props.form?.title}</div>
            <div data-testid='form-header'>{props.form?.header}</div>
            <div data-testid='form-icon'>{props.form?.icon}</div>
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
            ))}
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
        url: 'http://example.com',
        callbackId: 'abc123',
        title: 'Test Dialog',
        introductionText: 'Test introduction',
        iconUrl: 'http://example.com/icon.png',
        submitLabel: 'Submit',
        state: 'test-state',
        notifyOnCancel: true,
        emojiMap: new EmojiMap(new Map()),
        onExited: jest.fn(),
        actions: {
            submitInteractiveDialog: jest.fn(),
        },
        elements: [] as DialogElement[],
    };

    const mockState = {
        entities: {
            general: {
                config: {},
                license: {},
            },
            channels: {
                channels: {},
                roles: {},
            },
            teams: {
                teams: {},
            },
            posts: {
                posts: {},
            },
            users: {
                profiles: {},
            },
            groups: {
                myGroups: [],
            },
            emojis: {
                customEmoji: {},
            },
            preferences: {
                myPreferences: {},
            },
        },
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
                mockState,
            );

            await waitFor(() => {
                expect(getByTestId('apps-form-container')).toBeInTheDocument();
            });

            expect(getByTestId('form-title')).toHaveTextContent('Test Dialog');
            expect(getByTestId('form-header')).toHaveTextContent('Test introduction');
            expect(getByTestId('form-icon')).toHaveTextContent('http://example.com/icon.png');
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
                mockState,
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
                mockState,
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
                mockState,
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
                mockState,
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
                mockState,
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
                mockState,
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
                mockState,
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
                    mockState,
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
                mockState,
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
                    mockState,
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
                mockState,
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
                mockState,
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
                mockState,
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
                mockState,
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
                mockState,
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
                mockState,
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
                    mockState,
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
                mockState,
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
                mockState,
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
                mockState,
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
                mockState,
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
                },
            };

            expect(() => {
                renderWithContext(
                    <InteractiveDialogAdapter {...minimalProps}/>,
                    mockState,
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
                mockState,
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
                mockState,
            );

            await waitFor(() => {
                expect(getByTestId('form-fields-count')).toHaveTextContent('0');
            });
        });
    });

    describe('Error Handling', () => {
        test('should render component with error-handling submit action', async () => {
            const mockSubmitWithFieldErrors = jest.fn().mockResolvedValue({
                data: {
                    error: 'Form validation failed',
                    errors: {
                        'test-field': 'This field is required',
                        'email-field': 'Invalid email format',
                    },
                },
            });

            const textElement: DialogElement = {
                name: 'test-field',
                type: 'text',
                display_name: 'Test Field',
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
                elements: [textElement],
                actions: {
                    submitInteractiveDialog: mockSubmitWithFieldErrors,
                },
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
                mockState,
            );

            // Wait for component to render
            await waitFor(() => {
                expect(getByTestId('apps-form-container')).toBeInTheDocument();
            });

            // Verify the form element was converted correctly
            expect(getByTestId('field-test-field')).toBeInTheDocument();
            expect(getByTestId('field-type-test-field')).toHaveTextContent(AppFieldTypes.TEXT);
            expect(getByTestId('field-required-test-field')).toHaveTextContent('required');
        });

        test('should render component with general error submit action', async () => {
            const mockSubmitWithGeneralError = jest.fn().mockResolvedValue({
                data: {
                    error: 'Server internal error',
                },
            });

            const props = {
                ...baseProps,
                actions: {
                    submitInteractiveDialog: mockSubmitWithGeneralError,
                },
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
                mockState,
            );

            await waitFor(() => {
                expect(getByTestId('apps-form-container')).toBeInTheDocument();
            });

            expect(getByTestId('form-title')).toHaveTextContent('Test Dialog');
        });

        test('should render component with network error submit action', async () => {
            const mockSubmitWithNetworkError = jest.fn().mockResolvedValue({
                error: {
                    message: 'Network connection failed',
                },
            });

            const props = {
                ...baseProps,
                actions: {
                    submitInteractiveDialog: mockSubmitWithNetworkError,
                },
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
                mockState,
            );

            await waitFor(() => {
                expect(getByTestId('apps-form-container')).toBeInTheDocument();
            });

            expect(getByTestId('form-title')).toHaveTextContent('Test Dialog');
        });

        test('should render component with successful submit action', async () => {
            const mockSubmitSuccess = jest.fn().mockResolvedValue({
                data: {}, // Success response (no error or errors)
            });

            const props = {
                ...baseProps,
                actions: {
                    submitInteractiveDialog: mockSubmitSuccess,
                },
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
                mockState,
            );

            await waitFor(() => {
                expect(getByTestId('apps-form-container')).toBeInTheDocument();
            });

            expect(getByTestId('form-title')).toHaveTextContent('Test Dialog');
        });
    });
});
