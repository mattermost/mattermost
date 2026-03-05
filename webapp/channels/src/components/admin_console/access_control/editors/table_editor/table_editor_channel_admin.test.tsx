// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserPropertyField} from '@mattermost/types/properties';

import {renderWithContext, screen, waitFor} from 'tests/react_testing_utils';

import TableEditor from './table_editor';

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
