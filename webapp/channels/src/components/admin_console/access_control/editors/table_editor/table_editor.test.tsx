// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AccessControlVisualAST} from '@mattermost/types/access_control';
import type {UserPropertyField} from '@mattermost/types/properties';

import {parseExpression, findFirstAvailableAttributeFromList} from 'components/admin_console/access_control/editors/table_editor/table_editor';

describe('parseExpression', () => {
    test('handles "==" operator mapping to "is"', () => {
        const ast: AccessControlVisualAST = {
            conditions: [
                {
                    attribute: 'user.attributes.department',
                    operator: '==',
                    value: 'Engineering',
                    value_type: 0,
                    attribute_type: 'text',
                },
            ],
        };

        expect(parseExpression(ast)).toEqual([
            {
                attribute: 'department',
                operator: 'is',
                values: ['Engineering'],
                attribute_type: 'text',
            },
        ]);
    });

    test('handles "in" operator with multiple values', () => {
        const ast: AccessControlVisualAST = {
            conditions: [
                {
                    attribute: 'user.attributes.location',
                    operator: 'in',
                    value: ['US', 'CA'],
                    value_type: 0,
                    attribute_type: 'text',
                },
            ],
        };

        expect(parseExpression(ast)).toEqual([
            {
                attribute: 'location',
                operator: 'in',
                values: ['US', 'CA'],
                attribute_type: 'text',
            },
        ]);
    });

    test('handles "!=" operator mapping to "is not"', () => {
        const ast: AccessControlVisualAST = {
            conditions: [
                {
                    attribute: 'user.attributes.role',
                    operator: '!=',
                    value: 'guest',
                    value_type: 0,
                    attribute_type: 'text',
                },
            ],
        };

        expect(parseExpression(ast)).toEqual([
            {
                attribute: 'role',
                operator: 'is not',
                values: ['guest'],
                attribute_type: 'text',
            },
        ]);
    });

    test('handles method style operators like "startsWith"', () => {
        const ast: AccessControlVisualAST = {
            conditions: [
                {
                    attribute: 'user.attributes.email',
                    operator: 'startsWith',
                    value: 'admin',
                    value_type: 0,
                    attribute_type: 'text',
                },
            ],
        };

        expect(parseExpression(ast)).toEqual([
            {
                attribute: 'email',
                operator: 'starts with',
                values: ['admin'],
                attribute_type: 'text',
            },
        ]);
    });

    test('handles multiple conditions', () => {
        const ast: AccessControlVisualAST = {
            conditions: [
                {
                    attribute: 'user.attributes.email',
                    operator: 'startsWith',
                    value: 'admin',
                    value_type: 0,
                    attribute_type: 'text',
                },
                {
                    attribute: 'user.attributes.department',
                    operator: '==',
                    value: 'Engineering',
                    value_type: 0,
                    attribute_type: 'text',
                },
            ],
        };

        expect(parseExpression(ast)).toEqual([
            {
                attribute: 'email',
                operator: 'starts with',
                values: ['admin'],
                attribute_type: 'text',
            },
            {
                attribute: 'department',
                operator: 'is',
                values: ['Engineering'],
                attribute_type: 'text',
            },
        ]);
    });

    test('throws on unknown operator', () => {
        const ast: AccessControlVisualAST = {
            conditions: [
                {
                    attribute: 'user.attributes.department',
                    operator: 'unknownOp',
                    value: 'foo',
                    value_type: 0,
                    attribute_type: 'text',
                },
            ],
        };

        expect(parseExpression(ast)).toEqual([
            {
                attribute: 'department',
                operator: 'is',
                values: ['foo'],
                attribute_type: 'text',
            },
        ]);
    });

    test('handles empty or null AST', () => {
        expect(parseExpression(null as any)).toEqual([]);
        expect(parseExpression(undefined as any)).toEqual([]);
        expect(parseExpression({conditions: []})).toEqual([]);
    });
});

describe('findFirstAvailableAttributeFromList', () => {
    const createMockAttribute = (name: string, attrs: Partial<UserPropertyField['attrs']> = {}): UserPropertyField => ({
        id: `id-${name}`,
        group_id: 'custom_profile_attributes',
        name,
        type: 'text',
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        attrs: {
            sort_order: 1,
            visibility: 'when_set',
            value_type: '',
            ...attrs,
        },
    });

    test('returns first attribute that is synced from LDAP', () => {
        const attributes = [
            createMockAttribute('invalid attribute'), // Has spaces
            createMockAttribute('unsafe_attribute'), // Not synced
            createMockAttribute('ldap_attribute', {ldap: 'ldap_field'}), // Synced from LDAP
        ];

        const result = findFirstAvailableAttributeFromList(attributes, false);
        expect(result?.name).toBe('ldap_attribute');
    });

    test('returns first attribute that is synced from SAML', () => {
        const attributes = [
            createMockAttribute('invalid attribute'), // Has spaces
            createMockAttribute('saml_attribute', {saml: 'saml_field'}), // Synced from SAML
        ];

        const result = findFirstAvailableAttributeFromList(attributes, false);
        expect(result?.name).toBe('saml_attribute');
    });

    test('returns first user-managed attribute when enableUserManagedAttributes is true', () => {
        const attributes = [
            createMockAttribute('invalid attribute'), // Has spaces - still skipped
            createMockAttribute('user_managed_attribute'), // User managed
        ];

        const result = findFirstAvailableAttributeFromList(attributes, true);
        expect(result?.name).toBe('user_managed_attribute');
    });

    test('returns first attribute that is admin-managed', () => {
        const attributes = [
            createMockAttribute('invalid attribute'), // Has spaces
            createMockAttribute('unsafe_attribute'), // Not synced or admin-managed
            createMockAttribute('admin_managed_attribute', {managed: 'admin'}), // Admin-managed
        ];

        const result = findFirstAvailableAttributeFromList(attributes, false);
        expect(result?.name).toBe('admin_managed_attribute');
    });

    test('skips attributes with spaces even when synced', () => {
        const attributes = [
            createMockAttribute('synced attribute', {ldap: 'ldap_field'}), // Has spaces but synced
            createMockAttribute('valid_synced_attribute', {ldap: 'ldap_field'}), // Valid and synced
        ];

        const result = findFirstAvailableAttributeFromList(attributes, false);
        expect(result?.name).toBe('valid_synced_attribute');
    });
});
