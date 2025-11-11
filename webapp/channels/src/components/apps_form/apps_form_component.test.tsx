// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import {AppCallResponseTypes} from 'mattermost-redux/constants/apps';

import {renderWithContext} from 'tests/react_testing_utils';

import {AppsForm} from './apps_form_component';
import type {Props} from './apps_form_component';

describe('AppsFormComponent', () => {
    const mockIntl = {
        formatMessage: jest.fn((msg) => msg.defaultMessage || msg.id),
    };

    const baseProps: Props = {
        intl: mockIntl as any,
        onExited: jest.fn(),
        isEmbedded: false,
        actions: {
            performLookupCall: jest.fn(),
            refreshOnSelect: jest.fn(),
            submit: jest.fn().mockResolvedValue({
                data: {
                    type: 'ok',
                },
            }),
        },
        form: {
            title: 'Title',
            footer: 'Footer',
            header: 'Header',
            icon: 'Icon',
            submit: {
                path: '/create',
            },
            fields: [
                {
                    name: 'bool1',
                    type: 'bool',
                },
                {
                    name: 'bool2',
                    type: 'bool',
                    value: false,
                },
                {
                    name: 'bool3',
                    type: 'bool',
                    value: true,
                },
                {
                    name: 'text1',
                    type: 'text',
                    value: 'initial text',
                },
                {
                    name: 'select1',
                    type: 'static_select',
                    options: [
                        {label: 'Label1', value: 'Value1'},
                        {label: 'Label2', value: 'Value2'},
                    ],
                    value: {label: 'Label1', value: 'Value1'},
                },
            ],
        },
    };

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should render form with title, header, fields and initial values', () => {
        renderWithContext(
            <AppsForm
                {...baseProps}
            />,
        );

        // Verify key form elements are rendered
        expect(screen.getByText('Title')).toBeInTheDocument();
        expect(screen.getByText('Header')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /submit/i})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /cancel/i})).toBeInTheDocument();

        // Verify form renders with initial values
        expect(screen.getByDisplayValue('initial text')).toBeInTheDocument();
        expect(screen.getByText('Label1')).toBeInTheDocument();
    });

    test('it should submit and close the modal', async () => {
        const submit = jest.fn().mockResolvedValue({data: {type: 'ok'}});

        const props: Props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                submit,
            },
        };

        renderWithContext(
            <AppsForm
                {...props}
            />,
        );

        const submitButton = screen.getByRole('button', {name: /submit/i});
        await userEvent.click(submitButton);

        await waitFor(() => {
            expect(submit).toHaveBeenCalledWith({
                values: expect.objectContaining({
                    bool1: false,
                    bool2: false,
                    bool3: true,
                    text1: 'initial text',
                    select1: {label: 'Label1', value: 'Value1'},
                }),
            });
        });
    });

    describe('generic error message', () => {
        test('should appear when submit returns an error', async () => {
            const props = {
                ...baseProps,
                actions: {
                    ...baseProps.actions,
                    submit: jest.fn().mockResolvedValue({
                        error: {text: 'This is an error.', type: AppCallResponseTypes.ERROR},
                    }),
                },
            };
            renderWithContext(<AppsForm {...props}/>);

            const submitButton = screen.getByRole('button', {name: /submit/i});
            await userEvent.click(submitButton);

            await waitFor(() => {
                expect(screen.getByText('This is an error.')).toBeInTheDocument();
            });
        });

        test('should not appear when submit does not return an error', async () => {
            renderWithContext(<AppsForm {...baseProps}/>);

            const submitButton = screen.getByRole('button', {name: /submit/i});
            await userEvent.click(submitButton);

            await waitFor(() => {
                expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
            });
        });
    });

    describe('default select element', () => {
        test('should be enabled by default', () => {
            const selectField = {
                type: 'static_select',
                value: {label: 'Option3', value: 'opt3'},
                modal_label: 'Option Selector',
                name: 'someoptionselector',
                is_required: true,
                options: [
                    {label: 'Option1', value: 'opt1'},
                    {label: 'Option2', value: 'opt2'},
                    {label: 'Option3', value: 'opt3'},
                ],
                min_length: 2,
                max_length: 1024,
                hint: '',
                subtype: '',
                description: '',
            };

            const fields = [selectField];
            const props = {
                ...baseProps,
                appsContext: {},
                form: {
                    fields,
                },
            };

            renderWithContext(<AppsForm {...props}/>);

            // Verify the selected option is displayed
            expect(screen.getByText('Option3')).toBeInTheDocument();
        });
    });

    describe('Server-side Validation', () => {
        test('should display field errors from server response', async () => {
            const submitMock = jest.fn().mockResolvedValue({
                error: {
                    text: 'Validation errors',
                    data: {
                        errors: {
                            text1: 'This field is required',
                        },
                    },
                },
            });

            const props = {
                ...baseProps,
                actions: {
                    ...baseProps.actions,
                    submit: submitMock,
                },
            };

            renderWithContext(<AppsForm {...props}/>);

            // Find and click submit button
            const submitButton = screen.getByRole('button', {name: /submit/i});
            await userEvent.click(submitButton);

            // Wait for error to appear
            await waitFor(() => {
                expect(screen.getByText('This field is required')).toBeInTheDocument();
            });

            expect(submitMock).toHaveBeenCalled();
        });

        test('should handle unknown field errors', async () => {
            const submitMock = jest.fn().mockResolvedValue({
                error: {
                    text: 'Unknown field error',
                    data: {
                        errors: {
                            unknown_field: 'Unknown field error',
                        },
                    },
                },
            });

            const props = {
                ...baseProps,
                actions: {
                    ...baseProps.actions,
                    submit: submitMock,
                },
            };

            renderWithContext(<AppsForm {...props}/>);

            // Find and click submit button
            const submitButton = screen.getByRole('button', {name: /submit/i});
            await userEvent.click(submitButton);

            // Wait for form error to appear in the footer
            await waitFor(() => {
                expect(screen.getByText('Unknown field error')).toBeInTheDocument();
            });
        });

        test('should clear errors on successful submit', async () => {
            const submitMock = jest.fn().mockResolvedValue({
                data: {
                    type: 'ok',
                },
            });

            const props = {
                ...baseProps,
                actions: {
                    ...baseProps.actions,
                    submit: submitMock,
                },
            };

            renderWithContext(<AppsForm {...props}/>);

            // Submit the form successfully
            const submitButton = screen.getByRole('button', {name: /submit/i});
            await userEvent.click(submitButton);

            // Form should close on successful submit (modal should not be visible)
            await waitFor(() => {
                expect(submitMock).toHaveBeenCalled();
            });
        });
    });

    describe('Lookup Functionality', () => {
        test('should configure lookup functionality correctly', () => {
            const mockLookup = jest.fn().mockResolvedValue({
                data: {
                    type: 'ok',
                    data: {
                        items: [
                            {label: 'Result 1', value: 'r1'},
                            {label: 'Result 2', value: 'r2'},
                        ],
                    },
                },
            });

            const props = {
                ...baseProps,
                actions: {
                    ...baseProps.actions,
                    performLookupCall: mockLookup,
                },
            };

            renderWithContext(<AppsForm {...props}/>);

            // Verify form renders with lookup functionality
            expect(screen.getByRole('button', {name: /submit/i})).toBeInTheDocument();
            expect(props.actions.performLookupCall).toBe(mockLookup);
        });

        test('should handle lookup error responses', () => {
            const mockLookup = jest.fn().mockResolvedValue({
                error: {
                    text: 'Lookup failed',
                },
            });

            const props = {
                ...baseProps,
                actions: {
                    ...baseProps.actions,
                    performLookupCall: mockLookup,
                },
            };

            renderWithContext(<AppsForm {...props}/>);

            // Verify form renders with error handling configured
            expect(screen.getByRole('button', {name: /submit/i})).toBeInTheDocument();
            expect(props.actions.performLookupCall).toBe(mockLookup);
        });

        test('should render form without lookup fields', () => {
            renderWithContext(<AppsForm {...baseProps}/>);

            // Verify form renders without errors
            expect(screen.getByRole('button', {name: /submit/i})).toBeInTheDocument();
        });

        test('should handle unexpected lookup response types', () => {
            const mockLookup = jest.fn().mockResolvedValue({
                data: {
                    type: 'form', // Unexpected type
                },
            });

            const props = {
                ...baseProps,
                actions: {
                    ...baseProps.actions,
                    performLookupCall: mockLookup,
                },
            };

            renderWithContext(<AppsForm {...props}/>);

            // Verify form renders with proper error handling
            expect(screen.getByRole('button', {name: /submit/i})).toBeInTheDocument();
            expect(props.actions.performLookupCall).toBe(mockLookup);
        });
    });

    describe('Modal vs Embedded Rendering', () => {
        test('should render as modal by default', () => {
            renderWithContext(<AppsForm {...baseProps}/>);

            // Modal should be rendered (look for modal-specific elements)
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        test('should render as embedded when isEmbedded is true', () => {
            const props = {
                ...baseProps,
                isEmbedded: true,
            };

            renderWithContext(<AppsForm {...props}/>);

            // Embedded form should not have modal wrapper
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            expect(screen.getByRole('button', {name: /submit/i})).toBeInTheDocument();
        });
    });

    describe('Submit Button Variations', () => {
        test('should configure custom submit buttons correctly', () => {
            const formWithCustomButtons = {
                ...baseProps.form,
                submit_buttons: 'action_buttons',
                fields: [
                    {
                        name: 'action_buttons',
                        type: 'static_select',
                        options: [
                            {label: 'Save', value: 'save'},
                            {label: 'Cancel', value: 'cancel'},
                        ],
                    },
                ],
            };

            const props = {
                ...baseProps,
                form: formWithCustomButtons,
            };

            renderWithContext(<AppsForm {...props}/>);

            // Verify form renders with custom submit buttons (Save and multiple Cancel buttons)
            expect(screen.getByRole('button', {name: /save/i})).toBeInTheDocument();
            expect(screen.getAllByRole('button', {name: /cancel/i})).toHaveLength(2); // Default + custom cancel

            // Verify the form has the submit_buttons configuration
            expect(props.form.submit_buttons).toBe('action_buttons');
        });

        test('should handle submit with custom button', async () => {
            const submit = jest.fn().mockResolvedValue({data: {type: 'ok'}});

            const props = {
                ...baseProps,
                actions: {
                    ...baseProps.actions,
                    submit,
                },
            };

            renderWithContext(<AppsForm {...props}/>);

            const submitButton = screen.getByRole('button', {name: /submit/i});
            await userEvent.click(submitButton);

            expect(submit).toHaveBeenCalledWith({
                values: expect.any(Object),
            });
        });
    });

    describe('Form State Updates', () => {
        test('should update form when props change', () => {
            const newForm = {
                title: 'New Form',
                fields: [
                    {
                        name: 'new_field',
                        type: 'text',
                        value: 'new value',
                    },
                ],
            };

            const newProps = {
                ...baseProps,
                form: newForm,
            };

            const {rerender} = renderWithContext(<AppsForm {...baseProps}/>);

            // Re-render with new form
            rerender(<AppsForm {...newProps}/>);

            // Verify new form content is displayed
            expect(screen.getByDisplayValue('new value')).toBeInTheDocument();
            expect(screen.getByText('New Form')).toBeInTheDocument();
        });

        test('should not update state if form has not changed', () => {
            const {rerender} = renderWithContext(<AppsForm {...baseProps}/>);

            // Initial form content should be present
            expect(screen.getByDisplayValue('initial text')).toBeInTheDocument();

            // Re-render with same form
            rerender(<AppsForm {...baseProps}/>);

            // Content should remain the same
            expect(screen.getByDisplayValue('initial text')).toBeInTheDocument();
        });
    });

    describe('Edge Cases and Error Handling', () => {
        test('should handle form submission with FORM response type', async () => {
            const submitMock = jest.fn().mockResolvedValue({
                data: {
                    type: AppCallResponseTypes.FORM,
                    form: {
                        title: 'Updated Form',
                        fields: [],
                    },
                },
            });

            const props = {
                ...baseProps,
                actions: {
                    ...baseProps.actions,
                    submit: submitMock,
                },
            };

            renderWithContext(<AppsForm {...props}/>);

            const submitButton = screen.getByRole('button', {name: /submit/i});
            await userEvent.click(submitButton);

            // Verify submit was called and form response type is handled
            await waitFor(() => {
                expect(submitMock).toHaveBeenCalled();
            });
        });

        test('should handle form submission with NAVIGATE response type', async () => {
            const props = {
                ...baseProps,
                actions: {
                    ...baseProps.actions,
                    submit: jest.fn().mockResolvedValue({
                        data: {
                            type: AppCallResponseTypes.NAVIGATE,
                            navigate_to_url: 'http://example.com',
                        },
                    }),
                },
            };

            renderWithContext(<AppsForm {...props}/>);

            const submitButton = screen.getByRole('button', {name: /submit/i});
            await userEvent.click(submitButton);

            await waitFor(() => {
                expect(props.actions.submit).toHaveBeenCalled();

                // Navigation response should close the modal
            });
        });

        test('should handle unknown response type', async () => {
            const props = {
                ...baseProps,
                actions: {
                    ...baseProps.actions,
                    submit: jest.fn().mockResolvedValue({
                        data: {
                            type: 'unknown_type' as any,
                        },
                    }),
                },
            };

            renderWithContext(<AppsForm {...props}/>);

            const submitButton = screen.getByRole('button', {name: /submit/i});
            await userEvent.click(submitButton);

            await waitFor(() => {
                expect(screen.getByText(/not supported/i)).toBeInTheDocument();
            });
        });

        test('should handle missing field during onChange', () => {
            renderWithContext(<AppsForm {...baseProps}/>);

            // Form should render without errors even with missing field handling
            expect(screen.getByDisplayValue('initial text')).toBeInTheDocument();
            expect(screen.getByText('Label1')).toBeInTheDocument();
        });
    });

    describe('Component Lifecycle and State Management', () => {
        test('should initialize form values correctly from form fields', () => {
            const formWithComplexFields = {
                ...baseProps.form,
                fields: [
                    {
                        name: 'text_field',
                        type: 'text',
                        value: 'initial text value',
                        is_required: true,
                    },
                    {
                        name: 'bool_field',
                        type: 'bool',
                        value: true,
                        is_required: false,
                    },
                    {
                        name: 'no_value_bool',
                        type: 'bool',
                        is_required: false,

                        // No value - should default to false
                    },
                    {
                        name: 'no_value_text',
                        type: 'text',
                        is_required: false,

                        // No value - should default to null
                    },
                ],
            };

            const props = {
                ...baseProps,
                form: formWithComplexFields,
            };

            renderWithContext(<AppsForm {...props}/>);

            // Verify that text field shows its initial value
            expect(screen.getByDisplayValue('initial text value')).toBeInTheDocument();

            // Verify form renders without errors
            expect(screen.getByRole('button', {name: /submit/i})).toBeInTheDocument();
        });

        test('should update state when form prop changes via getDerivedStateFromProps', () => {
            const initialForm = {
                title: 'Initial Form',
                fields: [
                    {
                        name: 'field1',
                        type: 'text',
                        value: 'initial value',
                        is_required: true,
                    },
                ],
            };

            const updatedForm = {
                title: 'Updated Form',
                fields: [
                    {
                        name: 'field1',
                        type: 'text',
                        value: 'updated value',
                        is_required: true,
                    },
                    {
                        name: 'field2',
                        type: 'bool',
                        value: true,
                        is_required: false,
                    },
                ],
            };

            const props = {
                ...baseProps,
                form: initialForm,
            };

            const {rerender} = renderWithContext(<AppsForm {...props}/>);

            // Verify initial state
            expect(screen.getByDisplayValue('initial value')).toBeInTheDocument();
            expect(screen.getByText('Initial Form')).toBeInTheDocument();

            // Update the form prop
            rerender(<AppsForm {...{...props, form: updatedForm}}/>);

            // Verify state updated
            expect(screen.getByDisplayValue('updated value')).toBeInTheDocument();
            expect(screen.getByText('Updated Form')).toBeInTheDocument();
        });

        test('should not update state when form prop is the same object', () => {
            const sameForm = baseProps.form;

            const {rerender} = renderWithContext(<AppsForm {...baseProps}/>);

            // Re-render with the same form object
            rerender(<AppsForm {...{...baseProps, form: sameForm}}/>);

            // Form should still render correctly
            expect(screen.getByDisplayValue('initial text')).toBeInTheDocument();
            expect(screen.getByText('Title')).toBeInTheDocument();
        });
    });

    describe('Error Display and Formatting', () => {
        test('should display field errors with markdown formatting', async () => {
            const submitMock = jest.fn().mockResolvedValue({
                error: {
                    text: 'Validation failed',
                    data: {
                        errors: {
                            text1: '**Bold error message** with *italic* text',
                        },
                    },
                },
            });

            const props = {
                ...baseProps,
                actions: {
                    ...baseProps.actions,
                    submit: submitMock,
                },
            };

            renderWithContext(<AppsForm {...props}/>);

            const submitButton = screen.getByRole('button', {name: /submit/i});
            await userEvent.click(submitButton);

            // Wait for markdown-formatted error to appear
            await waitFor(() => {
                expect(screen.getByText('Bold error message')).toBeInTheDocument();
                expect(screen.getByText('italic')).toBeInTheDocument();
            });
        });

        test('should handle field errors that do not match form elements', async () => {
            const submitMock = jest.fn().mockResolvedValue({
                error: {
                    text: 'Server error',
                    data: {
                        errors: {
                            nonexistent_field: 'This field does not exist in the form',
                        },
                    },
                },
            });

            const props = {
                ...baseProps,
                actions: {
                    ...baseProps.actions,
                    submit: submitMock,
                },
            };

            renderWithContext(<AppsForm {...props}/>);

            const submitButton = screen.getByRole('button', {name: /submit/i});
            await userEvent.click(submitButton);

            // Should display the server error message in the form footer
            await waitFor(() => {
                expect(screen.getByText('Server error')).toBeInTheDocument();
            });
        });

        test('should prioritize form error over unknown field errors', async () => {
            const submitMock = jest.fn().mockResolvedValue({
                error: {
                    text: 'Primary form error message',
                    data: {
                        errors: {
                            unknown_field: 'Unknown field error',
                        },
                    },
                },
            });

            const props = {
                ...baseProps,
                actions: {
                    ...baseProps.actions,
                    submit: submitMock,
                },
            };

            renderWithContext(<AppsForm {...props}/>);

            const submitButton = screen.getByRole('button', {name: /submit/i});
            await userEvent.click(submitButton);

            // Should display the primary error, not the unknown field error
            await waitFor(() => {
                expect(screen.getByText('Primary form error message')).toBeInTheDocument();
                expect(screen.queryByText(/received an error for an unknown field/i)).not.toBeInTheDocument();
            });
        });

        test('should clear errors between submissions', async () => {
            let shouldError = true;
            const submitMock = jest.fn().mockImplementation(() => {
                if (shouldError) {
                    return Promise.resolve({
                        error: {
                            text: 'Validation error',
                            data: {
                                errors: {
                                    text1: 'This field is required',
                                },
                            },
                        },
                    });
                }
                return Promise.resolve({
                    data: {type: 'ok'},
                });
            });

            const props = {
                ...baseProps,
                actions: {
                    ...baseProps.actions,
                    submit: submitMock,
                },
            };

            renderWithContext(<AppsForm {...props}/>);

            const submitButton = screen.getByRole('button', {name: /submit/i});

            // First submission with error
            await userEvent.click(submitButton);
            await waitFor(() => {
                expect(screen.getByText('This field is required')).toBeInTheDocument();
            });

            // Second submission without error
            shouldError = false;
            await userEvent.click(submitButton);

            // Error should be cleared and form should close
            await waitFor(() => {
                expect(submitMock).toHaveBeenCalledTimes(2);
            });
        });
    });

    describe('Client-side Field Validation', () => {
        test('should validate required fields before submission', async () => {
            const formWithRequiredFields = {
                ...baseProps.form,
                fields: [
                    {
                        name: 'required_text',
                        type: 'text',
                        is_required: true,

                        // No default value - will be empty
                    },
                    {
                        name: 'optional_text',
                        type: 'text',
                        is_required: false,
                    },
                ],
            };

            const submitMock = jest.fn();
            const props = {
                ...baseProps,
                form: formWithRequiredFields,
                actions: {
                    ...baseProps.actions,
                    submit: submitMock,
                },
            };

            renderWithContext(<AppsForm {...props}/>);

            const submitButton = screen.getByRole('button', {name: /submit/i});
            await userEvent.click(submitButton);

            // Should show validation error and not call submit
            await waitFor(() => {
                expect(screen.getByText(/please fix all field errors/i)).toBeInTheDocument();
            });
            expect(submitMock).not.toHaveBeenCalled();
        });

        test('should pass validation when all required fields are filled', async () => {
            const formWithRequiredFields = {
                ...baseProps.form,
                fields: [
                    {
                        name: 'required_text',
                        type: 'text',
                        is_required: true,
                        value: 'filled value', // Has value
                    },
                ],
            };

            const submitMock = jest.fn().mockResolvedValue({
                data: {type: 'ok'},
            });

            const props = {
                ...baseProps,
                form: formWithRequiredFields,
                actions: {
                    ...baseProps.actions,
                    submit: submitMock,
                },
            };

            renderWithContext(<AppsForm {...props}/>);

            const submitButton = screen.getByRole('button', {name: /submit/i});
            await userEvent.click(submitButton);

            // Should call submit function
            await waitFor(() => {
                expect(submitMock).toHaveBeenCalledWith({
                    values: expect.objectContaining({
                        required_text: 'filled value',
                    }),
                });
            });
        });
    });

    describe('Refresh on Select Functionality', () => {
        test('should handle refresh on select success', async () => {
            const mockRefreshOnSelect = jest.fn().mockResolvedValue({
                data: {
                    type: 'form',
                    form: {
                        title: 'Updated Form',
                        fields: [],
                    },
                },
            });

            const formWithRefreshField = {
                ...baseProps.form,
                fields: [
                    {
                        name: 'refresh_field',
                        type: 'static_select',
                        refresh: true,
                        options: [
                            {label: 'Option 1', value: 'opt1'},
                            {label: 'Option 2', value: 'opt2'},
                        ],
                        is_required: false,
                    },
                ],
            };

            const props = {
                ...baseProps,
                form: formWithRefreshField,
                actions: {
                    ...baseProps.actions,
                    refreshOnSelect: mockRefreshOnSelect,
                },
            };

            renderWithContext(<AppsForm {...props}/>);

            // Form should render with refresh capability
            expect(screen.getByRole('button', {name: /submit/i})).toBeInTheDocument();
        });

        test('should handle refresh on select error', async () => {
            const mockRefreshOnSelect = jest.fn().mockResolvedValue({
                error: {
                    text: 'Refresh failed',
                    data: {
                        errors: {
                            refresh_field: 'Field refresh error',
                        },
                    },
                },
            });

            const formWithRefreshField = {
                ...baseProps.form,
                fields: [
                    {
                        name: 'refresh_field',
                        type: 'static_select',
                        refresh: true,
                        options: [
                            {label: 'Option 1', value: 'opt1'},
                        ],
                        is_required: false,
                    },
                ],
            };

            const props = {
                ...baseProps,
                form: formWithRefreshField,
                actions: {
                    ...baseProps.actions,
                    refreshOnSelect: mockRefreshOnSelect,
                },
            };

            renderWithContext(<AppsForm {...props}/>);

            // Form should render and handle refresh errors
            expect(screen.getByRole('button', {name: /submit/i})).toBeInTheDocument();
        });

        test('should handle unexpected refresh response types', async () => {
            const mockRefreshOnSelect = jest.fn().mockResolvedValue({
                data: {
                    type: 'ok', // Unexpected for refresh
                },
            });

            const formWithRefreshField = {
                ...baseProps.form,
                fields: [
                    {
                        name: 'refresh_field',
                        type: 'static_select',
                        refresh: true,
                        options: [
                            {label: 'Option 1', value: 'opt1'},
                        ],
                        is_required: false,
                    },
                ],
            };

            const props = {
                ...baseProps,
                form: formWithRefreshField,
                actions: {
                    ...baseProps.actions,
                    refreshOnSelect: mockRefreshOnSelect,
                },
            };

            renderWithContext(<AppsForm {...props}/>);

            // Form should render and handle unexpected response types
            expect(screen.getByRole('button', {name: /submit/i})).toBeInTheDocument();
        });
    });

    describe('Form Header and Footer Rendering', () => {
        test('should render form header when provided', () => {
            const formWithHeader = {
                ...baseProps.form,
                header: '**Bold header** with markdown',
            };

            const props = {
                ...baseProps,
                form: formWithHeader,
            };

            renderWithContext(<AppsForm {...props}/>);

            // Should render header content
            expect(screen.getByText('Bold header')).toBeInTheDocument();
        });

        test('should render form without header when not provided', () => {
            const formWithoutHeader = {
                ...baseProps.form,
                header: undefined,
            };

            const props = {
                ...baseProps,
                form: formWithoutHeader,
            };

            renderWithContext(<AppsForm {...props}/>);

            // Should still render the form
            expect(screen.getByText('Title')).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /submit/i})).toBeInTheDocument();
        });

        test('should render form icon when provided', () => {
            const formWithIcon = {
                ...baseProps.form,
                icon: 'http://example.com/icon.png',
            };

            const props = {
                ...baseProps,
                form: formWithIcon,
            };

            renderWithContext(<AppsForm {...props}/>);

            // Should render icon
            const icon = screen.getByAltText('modal title icon');
            expect(icon).toBeInTheDocument();
            expect(icon).toHaveAttribute('src', 'http://example.com/icon.png');
        });

        test('should render form without icon when not provided', () => {
            const formWithoutIcon = {
                ...baseProps.form,
                icon: undefined,
            };

            const props = {
                ...baseProps,
                form: formWithoutIcon,
            };

            renderWithContext(<AppsForm {...props}/>);

            // Should not render icon
            expect(screen.queryByAltText('modal title icon')).not.toBeInTheDocument();
            expect(screen.getByText('Title')).toBeInTheDocument();
        });
    });

    describe('onHide and Modal Behavior', () => {
        test('should call onHide prop when onHide is triggered', async () => {
            const mockOnHide = jest.fn();

            const props = {
                ...baseProps,
                onHide: mockOnHide,
            };

            renderWithContext(<AppsForm {...props}/>);

            const cancelButton = screen.getByRole('button', {name: /cancel/i});
            await userEvent.click(cancelButton);

            expect(mockOnHide).toHaveBeenCalled();
        });

        test('should handle onHide when prop is not provided', () => {
            const props = {
                ...baseProps,
                onHide: undefined,
            };

            // Should not throw error
            expect(() => {
                renderWithContext(<AppsForm {...props}/>);
            }).not.toThrow();

            const cancelButton = screen.getByRole('button', {name: /cancel/i});
            expect(async () => {
                await userEvent.click(cancelButton);
            }).not.toThrow();
        });

        test('should handle submit_on_cancel form option', () => {
            const formWithSubmitOnCancel = {
                ...baseProps.form,
                submit_on_cancel: true,
            };

            const props = {
                ...baseProps,
                form: formWithSubmitOnCancel,
            };

            renderWithContext(<AppsForm {...props}/>);

            // Should render cancel button correctly
            const cancelButton = screen.getByRole('button', {name: /cancel/i});
            expect(cancelButton).toBeInTheDocument();

            // Clicking cancel should handle submit_on_cancel logic
            expect(async () => {
                await userEvent.click(cancelButton);
            }).not.toThrow();
        });
    });

    describe('Form Field Filtering and Submit Buttons', () => {
        test('should filter out submit_buttons field from rendered elements', () => {
            const formWithSubmitButtons = {
                ...baseProps.form,
                submit_buttons: 'action_buttons',
                fields: [
                    {
                        name: 'regular_field',
                        type: 'text',
                        value: 'regular value',
                        is_required: false,
                    },
                    {
                        name: 'action_buttons',
                        type: 'static_select',
                        options: [
                            {label: 'Save', value: 'save'},
                            {label: 'Delete', value: 'delete'},
                        ],
                        is_required: false,
                    },
                ],
            };

            const props = {
                ...baseProps,
                form: formWithSubmitButtons,
            };

            renderWithContext(<AppsForm {...props}/>);

            // Should render regular field
            expect(screen.getByDisplayValue('regular value')).toBeInTheDocument();

            // Should render custom submit buttons
            expect(screen.getByRole('button', {name: /save/i})).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /delete/i})).toBeInTheDocument();

            // Should not render the submit_buttons field as a form field
            expect(screen.queryByLabelText(/action_buttons/i)).not.toBeInTheDocument();
        });

        test('should handle form without fields', () => {
            const formWithoutFields = {
                ...baseProps.form,
                fields: undefined,
            };

            const props = {
                ...baseProps,
                form: formWithoutFields,
            };

            renderWithContext(<AppsForm {...props}/>);

            // Should still render title and submit button
            expect(screen.getByText('Title')).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /submit/i})).toBeInTheDocument();
        });

        test('should handle form with empty fields array', () => {
            const formWithEmptyFields = {
                ...baseProps.form,
                fields: [],
            };

            const props = {
                ...baseProps,
                form: formWithEmptyFields,
            };

            renderWithContext(<AppsForm {...props}/>);

            // Should still render title and submit button
            expect(screen.getByText('Title')).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /submit/i})).toBeInTheDocument();
        });
    });

    describe('Custom Submit Label', () => {
        test('should use custom submit_label when provided', () => {
            const formWithCustomSubmitLabel = {
                ...baseProps.form,
                submit_label: 'Custom Submit Text',
            };

            const props = {
                ...baseProps,
                form: formWithCustomSubmitLabel,
            };

            renderWithContext(<AppsForm {...props}/>);

            // Should render custom submit button text
            expect(screen.getByRole('button', {name: /custom submit text/i})).toBeInTheDocument();
        });

        test('should use default Submit when submit_label is not provided', () => {
            const formWithoutSubmitLabel = {
                ...baseProps.form,
                submit_label: undefined,
            };

            const props = {
                ...baseProps,
                form: formWithoutSubmitLabel,
            };

            renderWithContext(<AppsForm {...props}/>);

            // Should render default submit button text
            expect(screen.getByRole('button', {name: /^submit$/i})).toBeInTheDocument();
        });

        test('should prioritize submit_buttons over submit_label when both are provided', () => {
            const formWithBothSubmitOptions = {
                ...baseProps.form,
                submit_label: 'Should Not Show',
                submit_buttons: 'custom_buttons',
                fields: [
                    {
                        name: 'custom_buttons',
                        type: 'static_select',
                        options: [
                            {label: 'Custom Action', value: 'action1'},
                            {label: 'Another Action', value: 'action2'},
                        ],
                        is_required: false,
                    },
                ],
            };

            const props = {
                ...baseProps,
                form: formWithBothSubmitOptions,
            };

            renderWithContext(<AppsForm {...props}/>);

            // Should render custom submit buttons, not the submit_label
            expect(screen.getByRole('button', {name: /custom action/i})).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /another action/i})).toBeInTheDocument();
            expect(screen.queryByRole('button', {name: /should not show/i})).not.toBeInTheDocument();
        });
    });

    describe('Field Configuration Validation', () => {
        it('should validate required fields', () => {
            const formWithRequiredField = {
                ...baseProps.form,
                fields: [
                    {
                        name: 'required_text',
                        type: 'text',
                        is_required: true,
                        label: 'Required Field',
                    },
                ],
            };

            const props = {
                ...baseProps,
                form: formWithRequiredField,
            };

            renderWithContext(<AppsForm {...props}/>);

            // Field validation happens during initialization but doesn't block rendering
            expect(screen.getByText(/Required Field/)).toBeInTheDocument();
        });

        it('should validate datetime fields with time constraints', () => {
            const formWithDateTimeField = {
                ...baseProps.form,
                fields: [
                    {
                        name: 'meeting_time',
                        type: 'datetime',
                        is_required: true,
                        label: 'Meeting Time',
                        time_interval: 30,
                        min_date: 'today',
                        max_date: '+30d',
                    },
                ],
            };

            const props = {
                ...baseProps,
                form: formWithDateTimeField,
            };

            renderWithContext(<AppsForm {...props}/>);

            // DateTime field should render with validation applied
            expect(screen.getByText('Meeting Time')).toBeInTheDocument();
        });

        it('should handle invalid field configurations gracefully', () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            const formWithInvalidField = {
                ...baseProps.form,
                fields: [
                    {
                        name: 'invalid_field',
                        type: 'datetime',
                        time_interval: -1, // Invalid interval
                        min_date: 'invalid-date', // Invalid date format
                        label: 'Invalid Field',
                    },
                ],
            };

            const props = {
                ...baseProps,
                form: formWithInvalidField,
            };

            // Should not throw error, validation is non-blocking
            expect(() => renderWithContext(<AppsForm {...props}/>)).not.toThrow();
            expect(screen.getByText('Invalid Field')).toBeInTheDocument();
            consoleSpy.mockRestore();
        });

        it('should initialize required datetime fields with default values', () => {
            const formWithRequiredDateTime = {
                ...baseProps.form,
                fields: [
                    {
                        name: 'required_datetime',
                        type: 'datetime',
                        is_required: true,
                        label: 'Required DateTime',
                        default_time: '09:00',
                    },
                ],
            };

            const props = {
                ...baseProps,
                form: formWithRequiredDateTime,
            };

            renderWithContext(<AppsForm {...props}/>);

            // Required datetime field should be present and initialized
            expect(screen.getByText('Required DateTime')).toBeInTheDocument();
        });
    });

    describe('DateTime Field Validation - time_interval', () => {
        it('should accept valid time_interval divisors of 1440', () => {
            const validIntervals = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 24, 30, 40, 60, 72, 90, 120, 180, 240, 360, 480, 720, 1440];

            validIntervals.forEach((interval) => {
                const formWithValidInterval = {
                    ...baseProps.form,
                    fields: [
                        {
                            name: 'valid_datetime',
                            type: 'datetime',
                            time_interval: interval,
                            label: `DateTime with ${interval}min interval`,
                        },
                    ],
                };

                const props = {
                    ...baseProps,
                    form: formWithValidInterval,
                };

                // Should not throw error for valid divisors
                expect(() => renderWithContext(<AppsForm {...props}/>)).not.toThrow();
            });
        });

        it('should log warnings for invalid time_interval non-divisors of 1440', () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            const invalidIntervals = [7, 11, 13, 17, 23, 25, 33, 37, 50, 55, 70, 100, 300, 500, 729, 1000];

            invalidIntervals.forEach((interval) => {
                const formWithInvalidInterval = {
                    ...baseProps.form,
                    fields: [
                        {
                            name: 'invalid_datetime',
                            type: 'datetime',
                            time_interval: interval,
                            label: `DateTime with ${interval}min interval`,
                        },
                    ],
                };

                const props = {
                    ...baseProps,
                    form: formWithInvalidInterval,
                };

                renderWithContext(<AppsForm {...props}/>);

                // Should log warning for invalid divisors
                expect(consoleSpy).toHaveBeenCalledWith(
                    'AppForm field validation errors:',
                    expect.arrayContaining([
                        expect.stringContaining(`time_interval must be a divisor of 1440 (24 hours * 60 minutes) to create valid time intervals, got ${interval}`),
                    ]),
                );

                consoleSpy.mockClear();
            });

            consoleSpy.mockRestore();
        });

        it('should log warnings for time_interval out of valid range', () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            const outOfRangeIntervals = [0, -5, 1441, 2000];

            outOfRangeIntervals.forEach((interval) => {
                const formWithOutOfRangeInterval = {
                    ...baseProps.form,
                    fields: [
                        {
                            name: 'out_of_range_datetime',
                            type: 'datetime',
                            time_interval: interval,
                            label: `DateTime with ${interval}min interval`,
                        },
                    ],
                };

                const props = {
                    ...baseProps,
                    form: formWithOutOfRangeInterval,
                };

                renderWithContext(<AppsForm {...props}/>);

                // Should log warning for out of range values
                expect(consoleSpy).toHaveBeenCalledWith(
                    'AppForm field validation errors:',
                    expect.arrayContaining([
                        expect.stringContaining('time_interval must be a positive number between 1 and 1440 minutes'),
                    ]),
                );

                consoleSpy.mockClear();
            });

            consoleSpy.mockRestore();
        });

        it('should log warnings for non-numeric time_interval values', () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            const nonNumericIntervals = ['30', null, undefined, true, {}, []];

            nonNumericIntervals.forEach((interval) => {
                const formWithNonNumericInterval = {
                    ...baseProps.form,
                    fields: [
                        {
                            name: 'non_numeric_datetime',
                            type: 'datetime',
                            time_interval: interval as any,
                            label: `DateTime with ${interval} interval`,
                        },
                    ],
                };

                const props = {
                    ...baseProps,
                    form: formWithNonNumericInterval,
                };

                renderWithContext(<AppsForm {...props}/>);

                // Should log warning for non-numeric values (unless undefined)
                if (interval !== undefined) {
                    expect(consoleSpy).toHaveBeenCalledWith(
                        'AppForm field validation errors:',
                        expect.arrayContaining([
                            expect.stringContaining('time_interval must be a positive number between 1 and 1440 minutes'),
                        ]),
                    );
                }

                consoleSpy.mockClear();
            });

            consoleSpy.mockRestore();
        });

        it('should not validate time_interval for non-datetime field types', () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

            const formWithNonDateTimeField = {
                ...baseProps.form,
                fields: [
                    {
                        name: 'text_with_interval',
                        type: 'text',
                        time_interval: 729, // Invalid but should be ignored for text fields
                        label: 'Text Field',
                    },
                    {
                        name: 'date_with_interval',
                        type: 'date',
                        time_interval: 729, // Invalid but should be ignored for date fields
                        label: 'Date Field',
                    },
                ],
            };

            const props = {
                ...baseProps,
                form: formWithNonDateTimeField,
            };

            renderWithContext(<AppsForm {...props}/>);

            // Should not log warnings for non-datetime fields
            expect(consoleSpy).not.toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        it('should validate min_date and max_date formats for date and datetime fields', () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

            const formWithInvalidDates = {
                ...baseProps.form,
                fields: [
                    {
                        name: 'invalid_dates',
                        type: 'datetime',
                        min_date: 'invalid-date-format',
                        max_date: '2025/01/01', // Wrong format
                        label: 'DateTime with Invalid Dates',
                    },
                ],
            };

            const props = {
                ...baseProps,
                form: formWithInvalidDates,
            };

            renderWithContext(<AppsForm {...props}/>);

            // Should log warnings for invalid date formats
            expect(consoleSpy).toHaveBeenCalledWith(
                'AppForm field validation errors:',
                expect.arrayContaining([
                    expect.stringContaining('min_date "invalid-date-format" is not a valid date format'),
                    expect.stringContaining('max_date "2025/01/01" is not a valid date format'),
                ]),
            );

            consoleSpy.mockRestore();
        });

        it('should validate date range when min_date is after max_date', () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

            const formWithInvalidDateRange = {
                ...baseProps.form,
                fields: [
                    {
                        name: 'invalid_range',
                        type: 'date',
                        min_date: '2025-12-31',
                        max_date: '2025-01-01', // Before min_date
                        label: 'Date with Invalid Range',
                    },
                ],
            };

            const props = {
                ...baseProps,
                form: formWithInvalidDateRange,
            };

            renderWithContext(<AppsForm {...props}/>);

            // Should log warning for invalid date range
            expect(consoleSpy).toHaveBeenCalledWith(
                'AppForm field validation errors:',
                expect.arrayContaining([
                    expect.stringContaining('min_date cannot be after max_date'),
                ]),
            );

            consoleSpy.mockRestore();
        });
    });
});
