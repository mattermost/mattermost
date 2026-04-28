// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AccessControlVisualAST} from '@mattermost/types/access_control';
import type {FieldType, UserPropertyField} from '@mattermost/types/properties';

import {isSimpleExpression, isSimpleCondition, isMultiselectOrGroup} from 'components/admin_console/access_control/editors/shared';
import {parseExpression, findFirstAvailableAttributeFromList, rowToCEL, celStringLiteral} from 'components/admin_console/access_control/editors/table_editor/table_editor';

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

describe('parseExpression with multiselect attributes', () => {
    test('handles "hasAllOf" operator with multiselect attribute type', () => {
        const ast: AccessControlVisualAST = {
            conditions: [
                {
                    attribute: 'user.attributes.skills',
                    operator: 'hasAllOf',
                    value: ['JavaScript', 'Python'],
                    value_type: 0,
                    attribute_type: 'multiselect',
                },
            ],
        };

        expect(parseExpression(ast)).toEqual([
            {
                attribute: 'skills',
                operator: 'has all of',
                values: ['JavaScript', 'Python'],
                attribute_type: 'multiselect',
            },
        ]);
    });

    test('handles "hasAnyOf" operator with multiselect attribute type', () => {
        const ast: AccessControlVisualAST = {
            conditions: [
                {
                    attribute: 'user.attributes.programs',
                    operator: 'hasAnyOf',
                    value: ['Dragon', 'Phoenix'],
                    value_type: 0,
                    attribute_type: 'multiselect',
                },
            ],
        };

        expect(parseExpression(ast)).toEqual([
            {
                attribute: 'programs',
                operator: 'has any of',
                values: ['Dragon', 'Phoenix'],
                attribute_type: 'multiselect',
            },
        ]);
    });

    test('handles multiselect attribute with single value', () => {
        const ast: AccessControlVisualAST = {
            conditions: [
                {
                    attribute: 'user.attributes.skills',
                    operator: 'hasAllOf',
                    value: ['JavaScript'],
                    value_type: 0,
                    attribute_type: 'multiselect',
                },
            ],
        };

        expect(parseExpression(ast)).toEqual([
            {
                attribute: 'skills',
                operator: 'has all of',
                values: ['JavaScript'],
                attribute_type: 'multiselect',
            },
        ]);
    });
});

describe('findFirstAvailableAttributeFromList', () => {
    const createMockAttribute = (name: string, attrs: Partial<UserPropertyField['attrs']> = {}, type: FieldType = 'text'): UserPropertyField => ({
        id: `id-${name}`,
        group_id: 'custom_profile_attributes',
        name,
        type,
        create_at: 0,
        update_at: 0,
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

    test('returns first attribute that is plugin-managed (protected)', () => {
        const attributes = [
            createMockAttribute('invalid attribute'), // Has spaces
            createMockAttribute('unsafe_attribute'), // Not synced or protected
            createMockAttribute('protected_attribute', {protected: true, source_plugin_id: 'com.example.plugin'}), // Protected by plugin
        ];

        const result = findFirstAvailableAttributeFromList(attributes, false);
        expect(result?.name).toBe('protected_attribute');
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

describe('celStringLiteral', () => {
    test('wraps a plain value in double quotes', () => {
        expect(celStringLiteral('hello')).toBe('"hello"');
    });

    test('escapes embedded double quotes', () => {
        expect(celStringLiteral('say "hi"')).toBe('"say \\"hi\\""');
    });

    test('escapes backslashes before double quotes', () => {
        expect(celStringLiteral('path\\to\\"file')).toBe('"path\\\\to\\\\\\"file"');
    });

    test('handles empty string', () => {
        expect(celStringLiteral('')).toBe('""');
    });
});

describe('rowToCEL', () => {
    test('has_any_of with multiple values produces OR-joined expression with parentheses', () => {
        const cel = rowToCEL({
            attribute: 'programs',
            operator: 'has any of',
            values: ['Dragon', 'Phoenix'],
            attribute_type: 'multiselect',
        });
        expect(cel).toBe('("Dragon" in user.attributes.programs || "Phoenix" in user.attributes.programs)');
    });

    test('has_all_of with multiple values produces AND-joined expression', () => {
        const cel = rowToCEL({
            attribute: 'programs',
            operator: 'has all of',
            values: ['Dragon', 'Phoenix'],
            attribute_type: 'multiselect',
        });
        expect(cel).toBe('"Dragon" in user.attributes.programs && "Phoenix" in user.attributes.programs');
    });

    test('has_any_of with a single value produces no parentheses', () => {
        const cel = rowToCEL({
            attribute: 'programs',
            operator: 'has any of',
            values: ['Dragon'],
            attribute_type: 'multiselect',
        });
        expect(cel).toBe('"Dragon" in user.attributes.programs');
    });

    test('has_all_of with a single value', () => {
        const cel = rowToCEL({
            attribute: 'tags',
            operator: 'has all of',
            values: ['admin'],
            attribute_type: 'multiselect',
        });
        expect(cel).toBe('"admin" in user.attributes.tags');
    });

    test('"in" operator for select attribute produces attr in [values]', () => {
        const cel = rowToCEL({
            attribute: 'department',
            operator: 'in',
            values: ['Eng', 'Ops'],
            attribute_type: 'select',
        });
        expect(cel).toBe('user.attributes.department in ["Eng", "Ops"]');
    });

    test('"is" operator produces equality comparison', () => {
        const cel = rowToCEL({
            attribute: 'clearance',
            operator: 'is',
            values: ['TopSecret'],
            attribute_type: 'text',
        });
        expect(cel).toBe('user.attributes.clearance == "TopSecret"');
    });

    test('"contains" operator produces method call', () => {
        const cel = rowToCEL({
            attribute: 'email',
            operator: 'contains',
            values: ['@example.com'],
            attribute_type: 'text',
        });
        expect(cel).toBe('user.attributes.email.contains("@example.com")');
    });

    test('escapes quotes in values', () => {
        const cel = rowToCEL({
            attribute: 'team',
            operator: 'is',
            values: ['O\'Brien\'s "Team"'],
            attribute_type: 'text',
        });
        expect(cel).toBe('user.attributes.team == "O\'Brien\'s \\"Team\\""');
    });
});

describe('isSimpleExpression', () => {
    test('empty expression is simple', () => {
        expect(isSimpleExpression('')).toBe(true);
    });

    test('single equality condition is simple', () => {
        expect(isSimpleExpression('user.attributes.dept == "Eng"')).toBe(true);
    });

    test('select in condition is simple', () => {
        expect(isSimpleExpression('user.attributes.dept in ["Eng", "Ops"]')).toBe(true);
    });

    test('multiselect AND condition is simple', () => {
        expect(isSimpleExpression('"a" in user.attributes.skills && "b" in user.attributes.skills')).toBe(true);
    });

    test('parenthesized multiselect OR group is simple', () => {
        expect(isSimpleExpression('("a" in user.attributes.skills || "b" in user.attributes.skills)')).toBe(true);
    });

    test('multiselect OR group combined with other conditions is simple', () => {
        expect(isSimpleExpression('("Dragon" in user.attributes.programs || "Phoenix" in user.attributes.programs) && user.attributes.clearance == "TopSecret"')).toBe(true);
    });

    test('general OR between equality conditions is NOT simple', () => {
        expect(isSimpleExpression('user.attributes.dept == "Eng" || user.attributes.dept == "Ops"')).toBe(false);
    });

    test('nested function calls are NOT simple', () => {
        expect(isSimpleExpression('size(user.attributes.roles) > 0')).toBe(false);
    });
});

describe('isMultiselectOrGroup', () => {
    test('valid OR group with two values', () => {
        expect(isMultiselectOrGroup('("a" in user.attributes.X || "b" in user.attributes.X)')).toBe(true);
    });

    test('valid OR group with three values', () => {
        expect(isMultiselectOrGroup('("a" in user.attributes.X || "b" in user.attributes.X || "c" in user.attributes.X)')).toBe(true);
    });

    test('rejects expression without parentheses', () => {
        expect(isMultiselectOrGroup('"a" in user.attributes.X || "b" in user.attributes.X')).toBe(false);
    });

    test('rejects equality conditions in OR group', () => {
        expect(isMultiselectOrGroup('(user.attributes.X == "a" || user.attributes.X == "b")')).toBe(false);
    });

    test('rejects malformed inner expression', () => {
        expect(isMultiselectOrGroup('(garbage || more garbage)')).toBe(false);
    });
});

describe('isSimpleCondition', () => {
    test('equality', () => {
        expect(isSimpleCondition('user.attributes.dept == "Eng"')).toBe(true);
    });

    test('inequality', () => {
        expect(isSimpleCondition('user.attributes.dept != "Eng"')).toBe(true);
    });

    test('in with list', () => {
        expect(isSimpleCondition('user.attributes.dept in ["Eng", "Ops"]')).toBe(true);
    });

    test('scalar in attribute (multiselect)', () => {
        expect(isSimpleCondition('"val" in user.attributes.tags')).toBe(true);
    });

    test('startsWith', () => {
        expect(isSimpleCondition('user.attributes.email.startsWith("admin")')).toBe(true);
    });

    test('endsWith', () => {
        expect(isSimpleCondition('user.attributes.email.endsWith("@co.com")')).toBe(true);
    });

    test('contains', () => {
        expect(isSimpleCondition('user.attributes.desc.contains("important")')).toBe(true);
    });

    test('rejects function calls', () => {
        expect(isSimpleCondition('size(user.attributes.roles) > 0')).toBe(false);
    });
});
