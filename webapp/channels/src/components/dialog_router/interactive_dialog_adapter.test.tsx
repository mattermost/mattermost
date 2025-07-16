// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {waitFor} from '@testing-library/react';
import React from 'react';

import type {DialogElement} from '@mattermost/types/integrations';

import {AppFieldTypes} from 'mattermost-redux/constants/apps';

import {renderWithContext} from 'tests/react_testing_utils';
import EmojiMap from 'utils/emoji_map';

import InteractiveDialogAdapter from './interactive_dialog_adapter';

jest.mock('components/apps_form/apps_form_container', () => {
    return {
        __esModule: true,
        default: jest.fn((props: any) => {
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
        }),
    };
});

// Mock console methods for testing logging
const mockConsole = {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};

// Get the mock function reference
const MockAppsFormContainer = require('components/apps_form/apps_form_container').default;

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

    });

    describe('XSS Prevention and Sanitization', () => {
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
                // Should escape HTML tags
                expect(getByTestId('form-header')).toHaveTextContent('Introduction &lt;iframe src=&quot;evil.com&quot;&gt;&lt;/iframe&gt; text');
            });
        });

        test('should not sanitize element values - only introductionText is sanitized', async () => {
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

            // Element values are not sanitized - only introductionText is
            const valueText = getByTestId('field-value-test-malicious').textContent;
            expect(valueText).toContain('value with onclick=alert(\\"xss\\")');
        });
    });

    describe('Validation Functionality', () => {
        test('should render successfully with invalid elements in default mode', async () => {
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
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(getByTestId('apps-form-container')).toBeInTheDocument();
            });

            // Should render successfully in default mode with fallback behavior
            expect(getByTestId('form-fields-count')).toHaveTextContent('1');
            expect(mockConsole.warn).not.toHaveBeenCalled();
        });

        test('should block rendering when enhanced validation is enabled and validation fails', async () => {
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
                    enhanced: true,
                },
            };

            const {container} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                // Should return null when validation fails in enhanced mode
                expect(container.firstChild).toBeNull();
            });

            // Should log error about failed conversion
            expect(mockConsole.error).toHaveBeenCalledWith(
                '[InteractiveDialogAdapter]',
                'Failed to convert dialog to app form',
                expect.any(String),
            );
        });

        test('should render successfully with valid elements in enhanced mode', async () => {
            const validElement: DialogElement = {
                name: 'valid-text',
                type: 'text',
                display_name: 'Valid Text Field',
                help_text: 'This is a valid text field',
                placeholder: 'Enter text',
                default: 'default value',
                optional: false,
                max_length: 100,
                min_length: 0,
                subtype: '',
                data_source: '',
                options: [],
            };

            const props = {
                ...baseProps,
                elements: [validElement],
                conversionOptions: {
                    enhanced: true,
                },
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(getByTestId('apps-form-container')).toBeInTheDocument();
                expect(getByTestId('field-valid-text')).toBeInTheDocument();
            });

            // Should not log any warnings for valid elements
            expect(mockConsole.warn).not.toHaveBeenCalled();
        });

        test('should handle server-side length validation by logging warnings in enhanced mode', async () => {
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
                    enhanced: true,
                },
            };

            const {container} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(container.firstChild).toBeNull();
            });

            // Should log error about conversion failure due to validation
            expect(mockConsole.error).toHaveBeenCalledWith(
                '[InteractiveDialogAdapter]',
                'Failed to convert dialog to app form',
                expect.any(String),
            );
        });

        test('should validate select options and render with fallback in default mode', async () => {
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
                // Default mode (enhanced: false)
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(getByTestId('apps-form-container')).toBeInTheDocument();
                expect(getByTestId('field-test-select')).toBeInTheDocument();
            });

            // Should render successfully in default mode
            expect(getByTestId('field-type-test-select')).toHaveTextContent(AppFieldTypes.STATIC_SELECT);
        });

        test('should detect conflicting select configuration and render with fallback', async () => {
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
                // Default mode (enhanced: false)
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(getByTestId('apps-form-container')).toBeInTheDocument();
                expect(getByTestId('field-test-select')).toBeInTheDocument();
            });

            // Should render successfully with fallback behavior
            expect(getByTestId('field-type-test-select')).toHaveTextContent('user');
        });
    });

    describe('Enhanced Logging', () => {

        test('should handle unknown element types with fallback behavior', async () => {
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
                // Default mode (enhanced: false)
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(getByTestId('apps-form-container')).toBeInTheDocument();
                expect(getByTestId('field-test-unknown')).toBeInTheDocument();
            });

            // Should log validation warnings about unknown type
            expect(mockConsole.warn).toHaveBeenCalledWith(
                '[InteractiveDialogAdapter]',
                'Dialog validation errors detected (non-blocking)',
                expect.objectContaining({
                    errorCount: expect.any(Number),
                    errors: expect.arrayContaining([
                        expect.objectContaining({
                            field: 'test-unknown',
                            message: expect.stringContaining('Unknown field type'),
                            code: 'INVALID_TYPE',
                        }),
                    ]),
                }),
            );
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


        test('should handle missing default values in select options gracefully', async () => {
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
                    enhanced: true,
                },
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(getByTestId('apps-form-container')).toBeInTheDocument();
                expect(getByTestId('field-test-select')).toBeInTheDocument();
            });

            // Should render successfully even with nonexistent default value
            // Server-side validation will handle this case
            expect(getByTestId('field-type-test-select')).toHaveTextContent(AppFieldTypes.STATIC_SELECT);
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

        test('should handle cancel adapter when notifyOnCancel is disabled', async () => {
            const mockSubmit = jest.fn();

            const props = {
                ...baseProps,
                notifyOnCancel: false,
                actions: {
                    submitInteractiveDialog: mockSubmit,
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

            // Should complete successfully without making API call
            await expect(cancelAdapter()).resolves.toBeUndefined();

            // Should not call submit when notifyOnCancel is false
            expect(mockSubmit).not.toHaveBeenCalled();
        });

        test('should handle cancel adapter errors gracefully', async () => {
            const mockSubmitThrows = jest.fn().mockRejectedValue(new Error('Cancel failed'));

            const props = {
                ...baseProps,
                notifyOnCancel: true,
                actions: {
                    submitInteractiveDialog: mockSubmitThrows,
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

            // Should complete successfully even if submit fails
            await expect(cancelAdapter()).resolves.toBeUndefined();

            // Should log error about failed cancellation notification
            expect(mockConsole.error).toHaveBeenCalledWith(
                '[InteractiveDialogAdapter]',
                'Failed to notify server of dialog cancellation',
                expect.objectContaining({
                    error: 'Cancel failed',
                    callbackId: baseProps.callbackId,
                    url: baseProps.url,
                }),
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

        test('should validate form submission with various validation scenarios', async () => {
            const elements: DialogElement[] = [
                {
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
                },
                {
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
                },
            ];

            const props = {
                ...baseProps,
                elements,
                conversionOptions: {
                    enhanced: true,
                },
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

            // Test field length validation - too short
            await submitAdapter({
                values: {
                    'text-field': 'abc', // Too short (< 5 chars)
                    'required-field': 'valid',
                },
            });

            expect(mockConsole.warn).toHaveBeenCalledWith(
                '[InteractiveDialogAdapter]',
                'Form submission validation errors',
                expect.objectContaining({
                    errorCount: expect.any(Number),
                    errors: expect.arrayContaining([
                        expect.objectContaining({
                            field: expect.stringContaining('text-field'),
                            message: expect.any(String),
                        }),
                    ]),
                }),
            );

            // Test field length validation - too long
            await submitAdapter({
                values: {
                    'text-field': 'this is way too long', // Too long (> 10 chars)
                    'required-field': 'valid',
                },
            });

            expect(mockConsole.warn).toHaveBeenCalledWith(
                '[InteractiveDialogAdapter]',
                'Form submission validation errors',
                expect.objectContaining({
                    errorCount: expect.any(Number),
                    errors: expect.arrayContaining([
                        expect.objectContaining({
                            field: expect.stringContaining('text-field'),
                            message: expect.any(String),
                        }),
                    ]),
                }),
            );

            // Test required field validation
            await submitAdapter({
                values: {
                    'text-field': 'valid',
                    'required-field': null, // Missing required field
                },
            });

            expect(mockConsole.warn).toHaveBeenCalledWith(
                '[InteractiveDialogAdapter]',
                'Form submission validation errors',
                expect.objectContaining({
                    errorCount: expect.any(Number),
                    errors: expect.arrayContaining([
                        expect.objectContaining({
                            field: expect.stringContaining('required-field'),
                            message: expect.any(String),
                        }),
                    ]),
                }),
            );
        });
    });

    describe('No-op Handlers', () => {
        test('should provide no-op handlers for unsupported legacy features', async () => {
            const props = {
                ...baseProps,
                conversionOptions: {
                    enhanced: true,
                },
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(getByTestId('apps-form-container')).toBeInTheDocument();
            });

            // Get all handlers
            const mockCall = MockAppsFormContainer.mock.calls[0][0];
            const {
                doAppLookup,
                doAppFetchForm,
                postEphemeralCallResponseForContext,
            } = mockCall.actions;

            // Test lookup handler returns empty items
            const lookupResult = await doAppLookup();
            expect(lookupResult.data).toEqual({
                type: 'ok',
                data: {items: []},
            });

            // Test refresh handler returns ok
            const refreshResult = await doAppFetchForm();
            expect(refreshResult.data).toEqual({
                type: 'ok',
            });

            // Test ephemeral handler is a no-op function
            expect(() => {
                postEphemeralCallResponseForContext();
            }).not.toThrow();
            expect(typeof postEphemeralCallResponseForContext).toBe('function');

            // Should log warnings about unsupported features
            expect(mockConsole.warn).toHaveBeenCalledWith(
                '[InteractiveDialogAdapter]',
                'Unexpected lookup call in Interactive Dialog adapter - this should not happen',
                '',
            );

            expect(mockConsole.warn).toHaveBeenCalledWith(
                '[InteractiveDialogAdapter]',
                'Unexpected refresh call in Interactive Dialog adapter - this should not happen',
                '',
            );
        });
    });

    describe('Dynamic Import Loading', () => {
    });

    describe('Advanced Validation Scenarios', () => {
        test('should handle element max_length constraints for different field types', async () => {
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
                    enhanced: false,
                },
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(getByTestId('apps-form-container')).toBeInTheDocument();
                expect(getByTestId('form-fields-count')).toHaveTextContent('4');
            });

            // Should render all fields successfully, with validation handled by server-side logic
            expect(getByTestId('field-text_field')).toBeInTheDocument();
            expect(getByTestId('field-textarea_field')).toBeInTheDocument();
            expect(getByTestId('field-select_field')).toBeInTheDocument();
            expect(getByTestId('field-bool_field')).toBeInTheDocument();
        });

        test('should detect invalid min/max length relationships', async () => {
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
                // Default mode (enhanced: false)
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(getByTestId('apps-form-container')).toBeInTheDocument();
                expect(getByTestId('field-invalid_range')).toBeInTheDocument();
            });

            // Should render successfully with fallback behavior
            expect(getByTestId('field-type-invalid_range')).toHaveTextContent(AppFieldTypes.TEXT);
        });

        test('should detect conflicting select configurations', async () => {
            const conflictingSelectElement: DialogElement = {
                name: 'conflicting_select',
                type: 'select',
                display_name: 'Conflicting Select',
                options: [{text: 'Option1', value: 'opt1'}],
                data_source: 'users', // Conflict: both options and data_source
                subtype: '',
                default: '',
                placeholder: '',
                help_text: '',
                optional: false,
                min_length: 0,
                max_length: 0,
            };

            const props = {
                ...baseProps,
                elements: [conflictingSelectElement],
                // Default mode (enhanced: false)
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(getByTestId('apps-form-container')).toBeInTheDocument();
                expect(getByTestId('field-conflicting_select')).toBeInTheDocument();
            });

            // Should render successfully with data_source taking precedence
            expect(getByTestId('field-type-conflicting_select')).toHaveTextContent('user');
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
        test('should handle element conversion errors with fallback behavior', async () => {
            const problematicElement = {
                name: 'problematic',
                type: 'invalid_type', // This will cause conversion error
                display_name: 'Problematic Element',
            } as DialogElement;

            const props = {
                ...baseProps,
                elements: [problematicElement],
                conversionOptions: {
                    enhanced: false, // Should continue processing
                },
            };

            const {getByTestId} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(getByTestId('apps-form-container')).toBeInTheDocument();
                expect(getByTestId('form-fields-count')).toHaveTextContent('1'); // Should still create field
                expect(getByTestId('field-problematic')).toBeInTheDocument();
            });

            // Should log validation warnings about unknown type
            expect(mockConsole.warn).toHaveBeenCalledWith(
                '[InteractiveDialogAdapter]',
                'Dialog validation errors detected (non-blocking)',
                expect.objectContaining({
                    errorCount: 1,
                    errors: expect.arrayContaining([
                        expect.objectContaining({
                            code: 'INVALID_TYPE',
                            field: 'problematic',
                            message: expect.stringContaining('Unknown field type: invalid_type'),
                        }),
                    ]),
                    note: 'These are warnings - processing will continue for backwards compatibility',
                }),
            );
        });

        test('should render null when enhanced validation fails', async () => {
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
                    enhanced: true,
                },
            };

            const {container} = renderWithContext(
                <InteractiveDialogAdapter {...props}/>,
            );

            await waitFor(() => {
                expect(container.firstChild).toBeNull();
            });

            // Should log error about conversion failure
            expect(mockConsole.error).toHaveBeenCalledWith(
                '[InteractiveDialogAdapter]',
                'Failed to convert dialog to app form',
                expect.any(String),
            );
        });

    });

    describe('Submit Label Support', () => {
    });
});
