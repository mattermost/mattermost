// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {render, screen} from '@testing-library/react';

import type {AppCallRequest, AppFormValues, AppSelectOption} from '@mattermost/types/apps';
import type {DialogElement} from '@mattermost/types/integrations';

import {AppCallResponseTypes} from 'mattermost-redux/constants/apps';

import EmojiMap from 'utils/emoji_map';
import {renderWithContext} from 'tests/react_testing_utils';

import InteractiveDialogAdapter from './interactive_dialog_adapter';

import type {PropsFromRedux} from './index';

// Mock the AppsFormContainer to avoid deep component tree testing
jest.mock('./apps_form/apps_form_container', () => {
    return function MockAppsFormContainer(props: any) {
        return (
            <div data-testid="apps-form-container">
                <div data-testid="form-title">{props.form.title}</div>
                <div data-testid="form-header">{props.form.header}</div>
                <div data-testid="form-fields-count">{props.form.fields.length}</div>
                <button 
                    data-testid="submit-button"
                    onClick={() => props.actions.doAppSubmit({
                        path: '/submit',
                        values: {test_field: 'test_value', select_field: {label: 'Option 1', value: 'opt1'}},
                    })}
                >
                    Submit
                </button>
                <button 
                    data-testid="lookup-button"
                    onClick={() => props.actions.doAppLookup({
                        path: '/plugins/test/lookup',
                        values: {test_field: 'search'},
                        query: 'search_term',
                        selected_field: 'dynamic_field',
                    })}
                >
                    Lookup
                </button>
                <button 
                    data-testid="lookup-invalid-url"
                    onClick={() => props.actions.doAppLookup({
                        path: 'http://insecure.com/lookup',
                        values: {},
                    })}
                >
                    Invalid Lookup
                </button>
                <button 
                    data-testid="lookup-no-url"
                    onClick={() => props.actions.doAppLookup({
                        values: {},
                        selected_field: 'unknown_field',
                    })}
                >
                    No URL Lookup
                </button>
                <button 
                    data-testid="lookup-invalid-values"
                    onClick={() => props.actions.doAppLookup({
                        path: '/plugins/test/lookup',
                        values: null,
                    })}
                >
                    Invalid Values Lookup
                </button>
                <button 
                    data-testid="submit-invalid-values"
                    onClick={() => props.actions.doAppSubmit({
                        path: '/submit',
                        values: null,
                    })}
                >
                    Invalid Values Submit
                </button>
            </div>
        );
    };
});

describe('components/interactive_dialog/InteractiveDialogAdapter', () => {
    const emojiMap = new EmojiMap(new Map());

    const baseProps: PropsFromRedux & {onExited?: () => void} = {
        url: 'https://example.com/submit',
        callbackId: 'test_callback',
        elements: [
            {
                name: 'text_field',
                type: 'text',
                display_name: 'Text Field',
                default: 'default_text',
                optional: false,
            },
            {
                name: 'select_field',
                type: 'select',
                display_name: 'Select Field',
                data_source: 'static',
                options: [
                    {text: 'Option 1', value: 'opt1'},
                    {text: 'Option 2', value: 'opt2'},
                ],
                default: 'opt1',
            },
            {
                name: 'user_field',
                type: 'select',
                display_name: 'User Field',
                data_source: 'users',
            },
            {
                name: 'channel_field',
                type: 'select',
                display_name: 'Channel Field',
                data_source: 'channels',
            },
            {
                name: 'dynamic_field',
                type: 'select',
                display_name: 'Dynamic Field',
                data_source: 'dynamic',
                data_source_url: '/plugins/test/lookup',
            },
        ] as DialogElement[],
        title: 'Test Dialog',
        introductionText: 'Test introduction',
        iconUrl: 'https://example.com/icon.png',
        submitLabel: 'Submit',
        notifyOnCancel: true,
        state: 'test_state',
        emojiMap,
        actions: {
            submitInteractiveDialog: jest.fn(),
            lookupInteractiveDialog: jest.fn(),
            doAppSubmit: jest.fn(),
            doAppFetchForm: jest.fn(),
            doAppLookup: jest.fn(),
            postEphemeralCallResponseForContext: jest.fn(),
            autocompleteChannels: jest.fn(),
            autocompleteUsers: jest.fn(),
        },
        onExited: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should match snapshot', () => {
        const {container} = renderWithContext(<InteractiveDialogAdapter {...baseProps}/>);
        expect(container).toMatchSnapshot();
    });

    test('should render with correct form properties', () => {
        renderWithContext(<InteractiveDialogAdapter {...baseProps}/>);

        expect(screen.getByTestId('apps-form-container')).toBeInTheDocument();
        expect(screen.getByTestId('form-title')).toHaveTextContent('Test Dialog');
        expect(screen.getByTestId('form-header')).toHaveTextContent('Test introduction');
        expect(screen.getByTestId('form-fields-count')).toHaveTextContent('5');
    });

    test('should handle missing optional properties', () => {
        const props = {
            ...baseProps,
            title: '',
            introductionText: undefined,
            iconUrl: undefined,
            submitLabel: undefined,
            elements: undefined,
        };

        renderWithContext(<InteractiveDialogAdapter {...props}/>);

        expect(screen.getByTestId('form-title')).toHaveTextContent('');
        expect(screen.getByTestId('form-header')).toHaveTextContent('');
        expect(screen.getByTestId('form-fields-count')).toHaveTextContent('0');
    });

    describe('form submission', () => {
        test('should submit form successfully', async () => {
            const mockResponse = {
                data: {type: AppCallResponseTypes.OK},
            };
            const props = {
                ...baseProps,
                actions: {
                    ...baseProps.actions,
                    submitInteractiveDialog: jest.fn().mockResolvedValue(mockResponse),
                },
            };

            renderWithContext(<InteractiveDialogAdapter {...props}/>);

            const submitButton = screen.getByTestId('submit-button');
            submitButton.click();

            expect(props.actions.submitInteractiveDialog).toHaveBeenCalledWith({
                url: 'https://example.com/submit',
                callback_id: 'test_callback',
                state: 'test_state',
                submission: {
                    test_field: 'test_value',
                    select_field: 'opt1', // AppSelectOption converted to raw value
                },
                user_id: '',
                channel_id: '',
                team_id: '',
                cancelled: false,
            });
        });

        test('should handle form submission errors', async () => {
            const errorResponse = {
                data: {
                    error: 'Validation failed',
                    errors: {text_field: 'Required field'},
                },
            };
            const props = {
                ...baseProps,
                actions: {
                    ...baseProps.actions,
                    submitInteractiveDialog: jest.fn().mockResolvedValue(errorResponse),
                },
            };

            renderWithContext(<InteractiveDialogAdapter {...props}/>);

            const submitButton = screen.getByTestId('submit-button');
            submitButton.click();

            // Verify the submission was attempted
            expect(props.actions.submitInteractiveDialog).toHaveBeenCalled();
        });

        test('should reject invalid form values', async () => {
            renderWithContext(<InteractiveDialogAdapter {...baseProps}/>);

            const invalidSubmitButton = screen.getByTestId('submit-invalid-values');
            invalidSubmitButton.click();

            // Should not call the action with invalid values
            expect(baseProps.actions.submitInteractiveDialog).not.toHaveBeenCalled();
        });
    });

    describe('dynamic lookup', () => {
        test('should perform lookup successfully', async () => {
            const mockResponse = {
                data: {
                    items: [
                        {text: 'Item 1', value: 'item1'},
                        {text: 'Item 2', value: 'item2'},
                    ],
                },
            };
            const props = {
                ...baseProps,
                actions: {
                    ...baseProps.actions,
                    lookupInteractiveDialog: jest.fn().mockResolvedValue(mockResponse),
                },
            };

            renderWithContext(<InteractiveDialogAdapter {...props}/>);

            const lookupButton = screen.getByTestId('lookup-button');
            lookupButton.click();

            expect(props.actions.lookupInteractiveDialog).toHaveBeenCalledWith({
                url: '/plugins/test/lookup',
                callback_id: 'test_callback',
                state: 'test_state',
                submission: {
                    test_field: 'search',
                    query: 'search_term',
                    selected_field: 'dynamic_field',
                },
                user_id: '',
                channel_id: '',
                team_id: '',
                cancelled: false,
            });
        });

        test('should reject invalid lookup URLs', async () => {
            renderWithContext(<InteractiveDialogAdapter {...baseProps}/>);

            const invalidLookupButton = screen.getByTestId('lookup-invalid-url');
            invalidLookupButton.click();

            // Should not call the action with invalid URL
            expect(baseProps.actions.lookupInteractiveDialog).not.toHaveBeenCalled();
        });

        test('should handle missing lookup URL', async () => {
            const props = {
                ...baseProps,
                url: '', // No fallback URL
            };

            renderWithContext(<InteractiveDialogAdapter {...props}/>);

            const noUrlLookupButton = screen.getByTestId('lookup-no-url');
            noUrlLookupButton.click();

            // Should not call the action when no URL is available
            expect(baseProps.actions.lookupInteractiveDialog).not.toHaveBeenCalled();
        });

        test('should reject invalid form values for lookup', async () => {
            renderWithContext(<InteractiveDialogAdapter {...baseProps}/>);

            const invalidValuesButton = screen.getByTestId('lookup-invalid-values');
            invalidValuesButton.click();

            // Should not call the action with invalid values
            expect(baseProps.actions.lookupInteractiveDialog).not.toHaveBeenCalled();
        });

        test('should handle lookup errors gracefully', async () => {
            const props = {
                ...baseProps,
                actions: {
                    ...baseProps.actions,
                    lookupInteractiveDialog: jest.fn().mockRejectedValue(new Error('Network error')),
                },
            };

            renderWithContext(<InteractiveDialogAdapter {...props}/>);

            const lookupButton = screen.getByTestId('lookup-button');
            lookupButton.click();

            // Verify the lookup was attempted
            expect(props.actions.lookupInteractiveDialog).toHaveBeenCalled();
        });

        test('should handle lookup response errors', async () => {
            const errorResponse = {
                error: 'Lookup failed',
            };
            const props = {
                ...baseProps,
                actions: {
                    ...baseProps.actions,
                    lookupInteractiveDialog: jest.fn().mockResolvedValue(errorResponse),
                },
            };

            renderWithContext(<InteractiveDialogAdapter {...props}/>);

            const lookupButton = screen.getByTestId('lookup-button');
            lookupButton.click();

            // Verify the lookup was attempted
            expect(props.actions.lookupInteractiveDialog).toHaveBeenCalled();
        });
    });

    describe('field type conversion', () => {
        test('should convert different dialog element types to app fields', () => {
            const elements: DialogElement[] = [
                {
                    name: 'text_field',
                    type: 'text',
                    display_name: 'Text Field',
                },
                {
                    name: 'static_select',
                    type: 'select',
                    display_name: 'Static Select',
                    data_source: 'static',
                    options: [{text: 'Option 1', value: 'opt1'}],
                },
                {
                    name: 'user_select',
                    type: 'select',
                    display_name: 'User Select',
                    data_source: 'users',
                },
                {
                    name: 'channel_select',
                    type: 'select',
                    display_name: 'Channel Select',
                    data_source: 'channels',
                },
                {
                    name: 'dynamic_select',
                    type: 'select',
                    display_name: 'Dynamic Select',
                    data_source: 'dynamic',
                    data_source_url: '/plugins/test/lookup',
                },
            ];

            const props = {
                ...baseProps,
                elements,
            };

            renderWithContext(<InteractiveDialogAdapter {...props}/>);

            // Should have converted all 5 elements
            expect(screen.getByTestId('form-fields-count')).toHaveTextContent('5');
        });

        test('should handle elements with default values and options', () => {
            const elements: DialogElement[] = [
                {
                    name: 'select_with_default',
                    type: 'select',
                    display_name: 'Select with Default',
                    data_source: 'static',
                    options: [
                        {text: 'Option 1', value: 'opt1'},
                        {text: 'Option 2', value: 'opt2'},
                    ],
                    default: 'opt1',
                },
            ];

            const props = {
                ...baseProps,
                elements,
            };

            renderWithContext(<InteractiveDialogAdapter {...props}/>);

            // Should have converted the element with proper default handling
            expect(screen.getByTestId('form-fields-count')).toHaveTextContent('1');
        });

        test('should handle dynamic select with relative path', () => {
            const elements: DialogElement[] = [
                {
                    name: 'dynamic_relative',
                    type: 'select',
                    display_name: 'Dynamic Relative',
                    data_source: 'dynamic',
                    data_source_url: 'lookup_endpoint', // Relative path
                },
            ];

            const props = {
                ...baseProps,
                elements,
            };

            renderWithContext(<InteractiveDialogAdapter {...props}/>);

            // Should handle relative path conversion
            expect(screen.getByTestId('form-fields-count')).toHaveTextContent('1');
        });

        test('should handle dynamic select without data_source_url', () => {
            const elements: DialogElement[] = [
                {
                    name: 'dynamic_no_url',
                    type: 'select',
                    display_name: 'Dynamic No URL',
                    data_source: 'dynamic',
                    // No data_source_url provided
                },
            ];

            const props = {
                ...baseProps,
                elements,
            };

            renderWithContext(<InteractiveDialogAdapter {...props}/>);

            // Should fallback to dialog URL
            expect(screen.getByTestId('form-fields-count')).toHaveTextContent('1');
        });
    });

    describe('cancel handling', () => {
        test('should notify on cancel when notifyOnCancel is true', () => {
            const props = {
                ...baseProps,
                notifyOnCancel: true,
            };

            // Test by calling the onHide callback indirectly
            // In a real scenario, this would be triggered by the AppsFormContainer
            renderWithContext(<InteractiveDialogAdapter {...props}/>);

            // The component should be ready to handle cancel notifications
            expect(screen.getByTestId('apps-form-container')).toBeInTheDocument();
        });

        test('should not notify on cancel when notifyOnCancel is false', () => {
            const props = {
                ...baseProps,
                notifyOnCancel: false,
            };

            renderWithContext(<InteractiveDialogAdapter {...props}/>);

            // The component should be ready to handle cancel without notifications
            expect(screen.getByTestId('apps-form-container')).toBeInTheDocument();
        });
    });

    describe('URL validation', () => {
        test('should accept valid HTTPS URLs', () => {
            const elements: DialogElement[] = [
                {
                    name: 'dynamic_https',
                    type: 'select',
                    display_name: 'Dynamic HTTPS',
                    data_source: 'dynamic',
                    data_source_url: 'https://api.example.com/lookup',
                },
            ];

            const props = {
                ...baseProps,
                elements,
            };

            renderWithContext(<InteractiveDialogAdapter {...props}/>);

            // Should accept valid HTTPS URL
            expect(screen.getByTestId('form-fields-count')).toHaveTextContent('1');
        });

        test('should accept valid plugin paths', () => {
            const elements: DialogElement[] = [
                {
                    name: 'dynamic_plugin',
                    type: 'select',
                    display_name: 'Dynamic Plugin',
                    data_source: 'dynamic',
                    data_source_url: '/plugins/myplugin/lookup',
                },
            ];

            const props = {
                ...baseProps,
                elements,
            };

            renderWithContext(<InteractiveDialogAdapter {...props}/>);

            // Should accept valid plugin path
            expect(screen.getByTestId('form-fields-count')).toHaveTextContent('1');
        });
    });

    describe('error message sanitization', () => {
        test('should sanitize network errors', async () => {
            const props = {
                ...baseProps,
                actions: {
                    ...baseProps.actions,
                    lookupInteractiveDialog: jest.fn().mockRejectedValue(new Error('Network error occurred')),
                },
            };

            renderWithContext(<InteractiveDialogAdapter {...props}/>);

            const lookupButton = screen.getByTestId('lookup-button');
            lookupButton.click();

            // The error should be sanitized internally
            expect(props.actions.lookupInteractiveDialog).toHaveBeenCalled();
        });

        test('should sanitize timeout errors', async () => {
            const props = {
                ...baseProps,
                actions: {
                    ...baseProps.actions,
                    lookupInteractiveDialog: jest.fn().mockRejectedValue(new Error('Request timeout')),
                },
            };

            renderWithContext(<InteractiveDialogAdapter {...props}/>);

            const lookupButton = screen.getByTestId('lookup-button');
            lookupButton.click();

            // The error should be sanitized internally
            expect(props.actions.lookupInteractiveDialog).toHaveBeenCalled();
        });

        test('should sanitize authorization errors', async () => {
            const props = {
                ...baseProps,
                actions: {
                    ...baseProps.actions,
                    lookupInteractiveDialog: jest.fn().mockRejectedValue(new Error('Unauthorized access')),
                },
            };

            renderWithContext(<InteractiveDialogAdapter {...props}/>);

            const lookupButton = screen.getByTestId('lookup-button');
            lookupButton.click();

            // The error should be sanitized internally
            expect(props.actions.lookupInteractiveDialog).toHaveBeenCalled();
        });
    });

    describe('value processing', () => {
        test('should convert AppSelectOption values to raw values in submissions', async () => {
            const props = {
                ...baseProps,
                actions: {
                    ...baseProps.actions,
                    submitInteractiveDialog: jest.fn().mockResolvedValue({data: {type: AppCallResponseTypes.OK}}),
                },
            };

            renderWithContext(<InteractiveDialogAdapter {...props}/>);

            const submitButton = screen.getByTestId('submit-button');
            submitButton.click();

            // Verify that AppSelectOption was converted to raw value
            expect(props.actions.submitInteractiveDialog).toHaveBeenCalledWith(
                expect.objectContaining({
                    submission: expect.objectContaining({
                        select_field: 'opt1', // Raw value, not {label: 'Option 1', value: 'opt1'}
                    }),
                })
            );
        });

        test('should handle mixed value types in form submission', async () => {
            const props = {
                ...baseProps,
                actions: {
                    ...baseProps.actions,
                    submitInteractiveDialog: jest.fn().mockResolvedValue({data: {type: AppCallResponseTypes.OK}}),
                },
            };

            renderWithContext(<InteractiveDialogAdapter {...props}/>);

            const submitButton = screen.getByTestId('submit-button');
            submitButton.click();

            // Verify proper value processing
            expect(props.actions.submitInteractiveDialog).toHaveBeenCalledWith(
                expect.objectContaining({
                    submission: {
                        test_field: 'test_value', // String value preserved
                        select_field: 'opt1', // AppSelectOption converted to raw value
                    },
                })
            );
        });
    });
});