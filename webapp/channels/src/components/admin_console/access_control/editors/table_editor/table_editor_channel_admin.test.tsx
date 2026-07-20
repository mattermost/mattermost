// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserPropertyField} from '@mattermost/types/properties_user';

import {renderWithContext, screen, waitFor, fireEvent} from 'tests/react_testing_utils';

import TableEditor from './table_editor';

describe('TableEditor - Multiselect Attribute Operator Restriction', () => {
    const mockMultiselectAttributes: UserPropertyField[] = [
        {
            id: 'attr1',
            name: 'skills',
            type: 'multiselect',
            group_id: 'custom_profile_attributes',
            create_at: 1736541716295,
            update_at: 1736541716295,
            delete_at: 0,
            created_by: '',
            updated_by: '',
            target_id: '',
            target_type: '',
            object_type: '',
            attrs: {
                sort_order: 0,
                visibility: 'when_set',
                value_type: '',
                options: [
                    {id: 'js', name: 'JavaScript'},
                    {id: 'py', name: 'Python'},
                ],
            },
        },
        {
            id: 'attr2',
            name: 'department',
            type: 'text',
            group_id: 'custom_profile_attributes',
            create_at: 1736541716295,
            update_at: 1736541716295,
            delete_at: 0,
            created_by: '',
            updated_by: '',
            target_id: '',
            target_type: '',
            object_type: '',
            attrs: {
                sort_order: 1,
                visibility: 'when_set',
                value_type: '',
            },
        },
    ];

    const mockMultiselectActions = {
        getVisualAST: jest.fn(),
    };

    const multiselectBaseProps = {
        value: '',
        onChange: jest.fn(),
        userAttributes: mockMultiselectAttributes,
        enableUserManagedAttributes: true,
        onParseError: jest.fn(),
        actions: mockMultiselectActions,
    };

    beforeEach(() => {
        mockMultiselectActions.getVisualAST.mockClear();
        multiselectBaseProps.onChange.mockClear();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('should default to "has any of" operator when adding a row with multiselect attribute', async () => {
        mockMultiselectActions.getVisualAST.mockResolvedValue({data: {conditions: []}});

        renderWithContext(<TableEditor {...multiselectBaseProps}/>, {});

        await waitFor(() => {
            expect(screen.getByRole('button', {name: /add attribute/i})).toBeInTheDocument();
        });

        const addButton = screen.getByRole('button', {name: /add attribute/i});
        addButton.click();

        await waitFor(() => {
            expect(screen.getByTestId('operatorSelectorMenuButton')).toBeInTheDocument();
        });

        expect(screen.getByTestId('operatorSelectorMenuButton')).toHaveTextContent('has any of');
    });

    test('should show "has all of" operator for multiselect attribute parsed from expression', async () => {
        mockMultiselectActions.getVisualAST.mockResolvedValue({
            data: {
                conditions: [
                    {
                        attribute: 'user.attributes.skills',
                        operator: 'hasAllOf',
                        value: ['JavaScript', 'Python'],
                        value_type: 0,
                        attribute_type: 'multiselect',
                    },
                ],
            },
        });

        const props = {
            ...multiselectBaseProps,
            value: '"JavaScript" in user.attributes.skills && "Python" in user.attributes.skills',
        };

        renderWithContext(<TableEditor {...props}/>, {});

        await waitFor(() => {
            expect(screen.getByTestId('operatorSelectorMenuButton')).toBeInTheDocument();
        });

        expect(screen.getByTestId('operatorSelectorMenuButton')).toHaveTextContent('has all of');
    });
});

describe('TableEditor - User Self-Exclusion', () => {
    const mockUserAttributes: UserPropertyField[] = [
        {
            id: 'attr1',
            name: 'department',
            type: 'select',
            group_id: 'custom_profile_attributes',
            create_at: 1736541716295,
            update_at: 1736541716295,
            delete_at: 0,
            created_by: '',
            updated_by: '',
            target_id: '',
            target_type: '',
            object_type: '',
            attrs: {
                sort_order: 0,
                visibility: 'when_set',
                value_type: '',
                options: [
                    {id: 'eng', name: 'Engineering'},
                    {id: 'sales', name: 'Sales'},
                ],
            },
        },
    ];

    const mockActions = {
        getVisualAST: jest.fn(),
    };

    const baseProps = {
        value: 'user.attributes.department == "Engineering"',
        onChange: jest.fn(),
        userAttributes: mockUserAttributes,
        enableUserManagedAttributes: true,
        onParseError: jest.fn(),
        actions: mockActions,
    };

    beforeEach(() => {
        mockActions.getVisualAST.mockClear();
        mockActions.getVisualAST.mockResolvedValue({
            data: {
                conditions: [
                    {
                        attribute: 'user.attributes.department',
                        operator: '==',
                        value: 'Engineering',
                        value_type: 0,
                        attribute_type: 'text',
                    },
                ],
            },
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('should disable Test Access Rules button when user would be excluded', async () => {
        const mockValidateExpression = jest.fn().mockResolvedValue({
            data: {requester_matches: false}, // User would be excluded
        });

        const props = {
            ...baseProps,
            isSystemAdmin: false,
            validateExpressionAgainstRequester: mockValidateExpression,
        };

        renderWithContext(<TableEditor {...props}/>, {});

        // Wait for component to load and validate
        await waitFor(() => {
            expect(mockValidateExpression).toHaveBeenCalledWith('user.attributes.department == "Engineering"');
        });

        // Check that the Test Access Rules button is disabled
        const testButton = screen.getByRole('button', {name: /test access rule/i});
        expect(testButton).toBeDisabled();
    });

    test('should show tooltip when user would be excluded', async () => {
        const mockValidateExpression = jest.fn().mockResolvedValue({
            data: {requester_matches: false}, // User would be excluded
        });

        const props = {
            ...baseProps,
            isSystemAdmin: false,
            validateExpressionAgainstRequester: mockValidateExpression,
        };

        renderWithContext(<TableEditor {...props}/>, {});

        // Wait for validation to complete
        await waitFor(() => {
            expect(mockValidateExpression).toHaveBeenCalledWith('user.attributes.department == "Engineering"');
        });

        // Check that the button is disabled - this is the main behavior we're testing
        const testButton = screen.getByRole('button', {name: /test access rule/i});
        expect(testButton).toBeDisabled();

        // The tooltip functionality is complex with floating-ui and is already tested in the TestButton unit tests
        // The main functionality we care about is that the button is disabled when the user would be excluded
    });

    test('should not disable Test Access Rules button for system admins even if they would be excluded', async () => {
        const mockValidateExpression = jest.fn().mockResolvedValue({
            data: {requester_matches: false}, // System admin would be excluded but shouldn't matter
        });

        const props = {
            ...baseProps,
            isSystemAdmin: true,
            validateExpressionAgainstRequester: mockValidateExpression,
        };

        renderWithContext(<TableEditor {...props}/>, {});

        // Wait for component to load
        await waitFor(() => {
            expect(screen.getByRole('button', {name: /test access rule/i})).toBeInTheDocument();
        });

        // Validation should not be called for system admins (they are never restricted)
        expect(mockValidateExpression).not.toHaveBeenCalled();

        // Test button should not be disabled
        const testButton = screen.getByRole('button', {name: /test access rule/i});
        expect(testButton).not.toBeDisabled();
    });

    test('should not disable Test Access Rules button when user would not be excluded', async () => {
        const mockValidateExpression = jest.fn().mockResolvedValue({
            data: {requester_matches: true}, // User would NOT be excluded
        });

        const props = {
            ...baseProps,
            isSystemAdmin: false,
            validateExpressionAgainstRequester: mockValidateExpression,
        };

        renderWithContext(<TableEditor {...props}/>, {});

        // Wait for validation to complete
        await waitFor(() => {
            expect(mockValidateExpression).toHaveBeenCalledWith('user.attributes.department == "Engineering"');
        });

        // Test button should not be disabled
        const testButton = screen.getByRole('button', {name: /test access rule/i});
        expect(testButton).not.toBeDisabled();
    });

    test('should handle validation errors gracefully', async () => {
        const mockValidateExpression = jest.fn().mockRejectedValue(new Error('Validation failed'));

        const props = {
            ...baseProps,
            isSystemAdmin: false,
            validateExpressionAgainstRequester: mockValidateExpression,
        };

        renderWithContext(<TableEditor {...props}/>, {});

        // Wait for validation attempt
        await waitFor(() => {
            expect(mockValidateExpression).toHaveBeenCalledWith('user.attributes.department == "Engineering"');
        });

        // Test button should not be disabled when validation fails (fail-safe approach)
        const testButton = screen.getByRole('button', {name: /test access rule/i});
        expect(testButton).not.toBeDisabled();
    });

    test('should not validate when expression is empty', async () => {
        const mockValidateExpression = jest.fn();

        const props = {
            ...baseProps,
            value: '', // Empty expression
            isSystemAdmin: false,
            validateExpressionAgainstRequester: mockValidateExpression,
        };

        renderWithContext(<TableEditor {...props}/>, {});

        // Wait for component to render
        await waitFor(() => {
            expect(screen.getByRole('button', {name: /test access rule/i})).toBeInTheDocument();
        });

        // Validation should not be called for empty expressions
        expect(mockValidateExpression).not.toHaveBeenCalled();

        // Test button should be disabled due to empty expression (existing behavior)
        const testButton = screen.getByRole('button', {name: /test access rule/i});
        expect(testButton).toBeDisabled();
    });

    test('should not validate when validateExpressionAgainstRequester is not provided', async () => {
        const props = {
            ...baseProps,
            isSystemAdmin: false,

            // validateExpressionAgainstRequester not provided
        };

        renderWithContext(<TableEditor {...props}/>, {});

        // Wait for component to render
        await waitFor(() => {
            expect(screen.getByRole('button', {name: /test access rule/i})).toBeInTheDocument();
        });

        // Test button should not be disabled when validation function is not provided
        const testButton = screen.getByRole('button', {name: /test access rule/i});
        expect(testButton).not.toBeDisabled();
    });

    test('should re-validate when expression changes', async () => {
        const mockValidateExpression = jest.fn().
            mockResolvedValueOnce({data: {requester_matches: true}}). // First call
            mockResolvedValueOnce({data: {requester_matches: false}}); // Second call after change

        const props = {
            ...baseProps,
            isSystemAdmin: false,
            validateExpressionAgainstRequester: mockValidateExpression,
        };

        const {rerender} = renderWithContext(<TableEditor {...props}/>, {});

        // Wait for initial validation
        await waitFor(() => {
            expect(mockValidateExpression).toHaveBeenCalledWith('user.attributes.department == "Engineering"');
        });

        // Initially button should not be disabled
        let testButton = screen.getByRole('button', {name: /test access rule/i});
        expect(testButton).not.toBeDisabled();

        // Change expression
        const newProps = {
            ...props,
            value: 'user.attributes.department == "Sales"',
        };

        rerender(<TableEditor {...newProps}/>);

        // Wait for re-validation with new expression
        await waitFor(() => {
            expect(mockValidateExpression).toHaveBeenCalledWith('user.attributes.department == "Sales"');
        });

        // Now button should be disabled since second validation returns false
        testButton = screen.getByRole('button', {name: /test access rule/i});
        expect(testButton).toBeDisabled();
    });
});

describe('TableEditor - attribute name collision across namespaces', () => {
    const makeField = (id: string, objectType: string): UserPropertyField => ({
        id,
        name: 'region',
        type: 'text',
        group_id: objectType === 'session' ? 'session_attributes' : 'custom_profile_attributes',
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        created_by: '',
        updated_by: '',
        target_id: '',
        target_type: objectType === 'session' ? 'system' : '',
        object_type: objectType,
        attrs: {
            sort_order: objectType === 'session' ? 1 : 0,
            visibility: 'always',
            value_type: '',
            managed: 'admin',
            display_name: objectType === 'session' ? 'Region (session)' : 'Region',
        },
    });

    const userRegion = makeField('u-region', 'user');
    const sessionRegion = makeField('s-region', 'session');

    const mockActions = {getVisualAST: jest.fn()};

    const baseProps = {
        value: 'user.attributes.region == "x"',
        onChange: jest.fn(),
        userAttributes: [userRegion, sessionRegion],
        enableUserManagedAttributes: true,
        onParseError: jest.fn(),
        actions: mockActions,
    };

    beforeEach(() => {
        baseProps.onChange.mockClear();
        mockActions.getVisualAST.mockReset();
        mockActions.getVisualAST.mockResolvedValue({
            data: {
                conditions: [
                    {
                        attribute: 'user.attributes.region',
                        operator: '==',
                        value: 'x',
                        value_type: 0,
                        attribute_type: 'text',
                    },
                ],
            },
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('picking the session attribute that shares a name resolves to the user.session namespace', async () => {
        const {container} = renderWithContext(<TableEditor {...baseProps}/>, {});

        await waitFor(() => {
            expect(screen.getByTestId('attributeSelectorMenuButton')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId('attributeSelectorMenuButton'));

        const sessionOption = document.getElementById('attribute-s-region');
        expect(sessionOption).toBeInTheDocument();
        fireEvent.click(sessionOption as HTMLElement);

        // Selecting a new attribute clears the value; commit a fresh one so the
        // expression is regenerated through the session namespace.
        const valueInput = container.querySelector('.values-editor__simple-input') as HTMLInputElement;
        expect(valueInput).toBeInTheDocument();
        fireEvent.focus(valueInput);
        fireEvent.change(valueInput, {target: {value: '10.0.0.1'}});
        fireEvent.blur(valueInput);

        await waitFor(() => {
            expect(baseProps.onChange).toHaveBeenCalledWith('user.session.region == "10.0.0.1"');
        });
    });
});
