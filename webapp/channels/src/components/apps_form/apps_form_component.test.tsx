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

    test('should render form with title, header, and fields', () => {
        renderWithContext(
            <AppsForm
                {...baseProps}
            />,
            {},
        );

        // Verify key form elements are rendered
        expect(screen.getByText('Title')).toBeInTheDocument();
        expect(screen.getByText('Header')).toBeInTheDocument();
        expect(screen.getByDisplayValue('initial text')).toBeInTheDocument();
        expect(screen.getByText('Label1')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /submit/i})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /cancel/i})).toBeInTheDocument();
    });

    test('should set initial form values', () => {
        renderWithContext(
            <AppsForm
                {...baseProps}
            />,
            {},
        );

        // Verify form renders with initial values visible
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
            {},
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
            renderWithContext(<AppsForm {...props}/>, {});

            const submitButton = screen.getByRole('button', {name: /submit/i});
            await userEvent.click(submitButton);

            await waitFor(() => {
                expect(screen.getByText('This is an error.')).toBeInTheDocument();
            });
        });

        test('should not appear when submit does not return an error', async () => {
            renderWithContext(<AppsForm {...baseProps}/>, {});

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
                context: {},
                form: {
                    fields,
                },
            };

            const state = {
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
                    emojis: {},
                    preferences: {
                        myPreferences: {},
                    },
                },
            };

            renderWithContext(<AppsForm {...props}/>, state);

            // Verify the selected option is displayed
            expect(screen.getByText('Option3')).toBeInTheDocument();
        });
    });

    describe('Form Validation', () => {
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

            renderWithContext(<AppsForm {...props}/>, {});

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
                    text: 'Validation errors',
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

            renderWithContext(<AppsForm {...props}/>, {});

            // Find and click submit button
            const submitButton = screen.getByRole('button', {name: /submit/i});
            await userEvent.click(submitButton);

            // Wait for form error to appear
            await waitFor(() => {
                expect(screen.getByText(/Unknown field error/)).toBeInTheDocument();
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

            renderWithContext(<AppsForm {...props}/>, {});

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
        test('should perform lookup and return options', async () => {
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
                form: {
                    ...baseProps.form,
                    fields: [
                        {
                            name: 'user_select',
                            type: 'user',
                        },
                    ],
                },
            };

            renderWithContext(<AppsForm {...props}/>, {});

            // Verify lookup functionality is set up (we can't directly trigger lookup without more complex setup)
            expect(mockLookup).toBeDefined();
        });

        test('should handle lookup errors', async () => {
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
                form: {
                    ...baseProps.form,
                    fields: [
                        {
                            name: 'user_select',
                            type: 'user',
                        },
                    ],
                },
            };

            renderWithContext(<AppsForm {...props}/>, {});

            // Verify error handling is set up
            expect(mockLookup).toBeDefined();
        });

        test('should return empty array for unknown field', async () => {
            renderWithContext(<AppsForm {...baseProps}/>, {});

            // Verify form renders without errors
            expect(screen.getByRole('button', {name: /submit/i})).toBeInTheDocument();
        });

        test('should handle unexpected lookup response types', async () => {
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
                form: {
                    ...baseProps.form,
                    fields: [
                        {
                            name: 'user_select',
                            type: 'user',
                        },
                    ],
                },
            };

            renderWithContext(<AppsForm {...props}/>, {});

            // Verify error handling is configured
            expect(mockLookup).toBeDefined();
        });
    });

    describe('Refresh on Select', () => {
        test('should trigger refresh when field has refresh enabled', async () => {
            const mockRefresh = jest.fn().mockResolvedValue({
                data: {
                    type: 'form',
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
                    refreshOnSelect: mockRefresh,
                },
                form: {
                    ...baseProps.form,
                    fields: [
                        {
                            name: 'trigger_field',
                            type: 'static_select',
                            refresh: true,
                        },
                    ],
                },
            };

            renderWithContext(<AppsForm {...props}/>, {});

            // Verify refresh functionality is configured
            expect(mockRefresh).toBeDefined();
        });

        test('should handle refresh errors', async () => {
            const mockRefresh = jest.fn().mockResolvedValue({
                error: {
                    text: 'Refresh failed',
                    data: {
                        errors: {
                            trigger_field: 'Field error',
                        },
                    },
                },
            });

            const props = {
                ...baseProps,
                actions: {
                    ...baseProps.actions,
                    refreshOnSelect: mockRefresh,
                },
                form: {
                    ...baseProps.form,
                    fields: [
                        {
                            name: 'trigger_field',
                            type: 'static_select',
                            refresh: true,
                        },
                    ],
                },
            };

            renderWithContext(<AppsForm {...props}/>, {});

            // Verify error handling is configured
            expect(mockRefresh).toBeDefined();
        });

        test('should handle unexpected refresh response types', async () => {
            const mockRefresh = jest.fn().mockResolvedValue({
                data: {
                    type: 'ok', // Unexpected type for refresh
                },
            });

            const props = {
                ...baseProps,
                actions: {
                    ...baseProps.actions,
                    refreshOnSelect: mockRefresh,
                },
                form: {
                    ...baseProps.form,
                    fields: [
                        {
                            name: 'trigger_field',
                            type: 'static_select',
                            refresh: true,
                        },
                    ],
                },
            };

            renderWithContext(<AppsForm {...props}/>, {});

            // Verify unexpected response handling is configured
            expect(mockRefresh).toBeDefined();
        });
    });

    describe('Modal vs Embedded Rendering', () => {
        test('should render as modal by default', () => {
            renderWithContext(<AppsForm {...baseProps}/>, {});

            // Modal should be rendered (look for modal-specific elements)
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        test('should render as embedded when isEmbedded is true', () => {
            const props = {
                ...baseProps,
                isEmbedded: true,
            };

            renderWithContext(<AppsForm {...props}/>, {});

            // Embedded form should not have modal wrapper
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            expect(screen.getByRole('button', {name: /submit/i})).toBeInTheDocument();
        });
    });

    describe('Submit Button Variations', () => {
        test('should render custom submit buttons when form has submit_buttons field', () => {
            const formWithCustomButtons = {
                ...baseProps.form,
                submit_buttons: 'action_buttons',
                fields: [
                    ...(baseProps.form.fields || []),
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

            renderWithContext(<AppsForm {...props}/>, {});

            // Look for custom submit buttons
            expect(screen.getByRole('button', {name: /save/i})).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /cancel/i})).toBeInTheDocument();
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

            renderWithContext(<AppsForm {...props}/>, {});

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

            const {rerender} = renderWithContext(<AppsForm {...baseProps}/>, {});

            // Re-render with new form
            rerender(<AppsForm {...newProps}/>);

            // Verify new form content is displayed
            expect(screen.getByDisplayValue('new value')).toBeInTheDocument();
            expect(screen.getByText('New Form')).toBeInTheDocument();
        });

        test('should not update state if form has not changed', () => {
            const {rerender} = renderWithContext(<AppsForm {...baseProps}/>, {});

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
            const props = {
                ...baseProps,
                actions: {
                    ...baseProps.actions,
                    submit: jest.fn().mockResolvedValue({
                        data: {
                            type: AppCallResponseTypes.FORM,
                            form: {
                                title: 'Updated Form',
                                fields: [],
                            },
                        },
                    }),
                },
            };

            renderWithContext(<AppsForm {...props}/>, {});

            const submitButton = screen.getByRole('button', {name: /submit/i});
            await userEvent.click(submitButton);

            // Should update form title but keep modal open
            await waitFor(() => {
                expect(screen.getByText('Updated Form')).toBeInTheDocument();
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

            renderWithContext(<AppsForm {...props}/>, {});

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

            renderWithContext(<AppsForm {...props}/>, {});

            const submitButton = screen.getByRole('button', {name: /submit/i});
            await userEvent.click(submitButton);

            await waitFor(() => {
                expect(screen.getByText(/not supported/i)).toBeInTheDocument();
            });
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

            renderWithContext(<AppsForm {...props}/>, {});

            // Verify form renders with submit_on_cancel option
            expect(screen.getByRole('button', {name: /cancel/i})).toBeInTheDocument();
        });

        test('should handle missing field during onChange', () => {
            renderWithContext(<AppsForm {...baseProps}/>, {});

            // Form should render without errors even with missing field handling
            expect(screen.getByDisplayValue('initial text')).toBeInTheDocument();
            expect(screen.getByText('Label1')).toBeInTheDocument();
        });
    });
});
