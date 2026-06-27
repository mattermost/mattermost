// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AccessControlVisualAST} from '@mattermost/types/access_control';
import type {FieldType} from '@mattermost/types/properties';
import type {UserPropertyField} from '@mattermost/types/properties_user';

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
                hasMaskedValues: false,
            },
        ]);
    });

    test.each([
        ['==', 'is exactly'],
        ['>=', 'is at least'],
        ['>', 'is greater than'],
        ['<=', 'is at most'],
        ['<', 'is less than'],
        ['!=', 'is not'],
    ])('maps ranked operator %s to "%s"', (celOp, label) => {
        const ast: AccessControlVisualAST = {
            conditions: [
                {
                    attribute: 'user.attributes.clearance',
                    operator: celOp,
                    value: 'Secret',
                    value_type: 0,
                    attribute_type: 'rank',
                },
            ],
        };

        expect(parseExpression(ast)).toEqual([
            {
                attribute: 'clearance',
                operator: label,
                values: ['Secret'],
                attribute_type: 'rank',
                hasMaskedValues: false,
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
                hasMaskedValues: false,
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
                hasMaskedValues: false,
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
                hasMaskedValues: false,
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
                hasMaskedValues: false,
            },
            {
                attribute: 'department',
                operator: 'is',
                values: ['Engineering'],
                attribute_type: 'text',
                hasMaskedValues: false,
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
                hasMaskedValues: false,
            },
        ]);
    });

    test('handles empty or null AST', () => {
        expect(parseExpression(null as any)).toEqual([]);
        expect(parseExpression(undefined as any)).toEqual([]);
        expect(parseExpression({conditions: []})).toEqual([]);
    });

    test('sets hasMaskedValues=true when condition has has_masked_values flag', () => {
        const ast: AccessControlVisualAST = {
            conditions: [
                {
                    attribute: 'user.attributes.program',
                    operator: 'in',
                    value: ['Alpha'],
                    value_type: 0,
                    attribute_type: 'text',
                    has_masked_values: true,
                },
                {
                    attribute: 'user.attributes.clearance',
                    operator: 'in',
                    value: [],
                    value_type: 0,
                    attribute_type: 'text',
                    has_masked_values: true,
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

        const rows = parseExpression(ast);
        expect(rows[0].hasMaskedValues).toBe(true); // partial: caller holds Alpha
        expect(rows[0].values).toEqual(['Alpha']);
        expect(rows[1].hasMaskedValues).toBe(true); // fully masked: caller holds nothing
        expect(rows[1].values).toEqual([]);
        expect(rows[2].hasMaskedValues).toBe(false); // no masking
        expect(rows[2].values).toEqual(['Engineering']);
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
                hasMaskedValues: false,
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
                hasMaskedValues: false,
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
                hasMaskedValues: false,
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
            hasMaskedValues: false,
        });
        expect(cel).toBe('("Dragon" in user.attributes.programs || "Phoenix" in user.attributes.programs)');
    });

    test('has_all_of with multiple values produces AND-joined expression', () => {
        const cel = rowToCEL({
            attribute: 'programs',
            operator: 'has all of',
            values: ['Dragon', 'Phoenix'],
            attribute_type: 'multiselect',
            hasMaskedValues: false,
        });
        expect(cel).toBe('"Dragon" in user.attributes.programs && "Phoenix" in user.attributes.programs');
    });

    test('has_any_of with a single value produces no parentheses', () => {
        const cel = rowToCEL({
            attribute: 'programs',
            operator: 'has any of',
            values: ['Dragon'],
            attribute_type: 'multiselect',
            hasMaskedValues: false,
        });
        expect(cel).toBe('"Dragon" in user.attributes.programs');
    });

    test('has_all_of with a single value', () => {
        const cel = rowToCEL({
            attribute: 'tags',
            operator: 'has all of',
            values: ['admin'],
            attribute_type: 'multiselect',
            hasMaskedValues: false,
        });
        expect(cel).toBe('"admin" in user.attributes.tags');
    });

    test('"in" operator for select attribute produces attr in [values]', () => {
        const cel = rowToCEL({
            attribute: 'department',
            operator: 'in',
            values: ['Eng', 'Ops'],
            attribute_type: 'select',
            hasMaskedValues: false,
        });
        expect(cel).toBe('user.attributes.department in ["Eng", "Ops"]');
    });

    test('"is" operator produces equality comparison', () => {
        const cel = rowToCEL({
            attribute: 'clearance',
            operator: 'is',
            values: ['TopSecret'],
            attribute_type: 'text',
            hasMaskedValues: false,
        });
        expect(cel).toBe('user.attributes.clearance == "TopSecret"');
    });

    test('"contains" operator produces method call', () => {
        const cel = rowToCEL({
            attribute: 'email',
            operator: 'contains',
            values: ['@example.com'],
            attribute_type: 'text',
            hasMaskedValues: false,
        });
        expect(cel).toBe('user.attributes.email.contains("@example.com")');
    });

    test('escapes quotes in values', () => {
        const cel = rowToCEL({
            attribute: 'team',
            operator: 'is',
            values: ['O\'Brien\'s "Team"'],
            attribute_type: 'text',
            hasMaskedValues: false,
        });
        expect(cel).toBe('user.attributes.team == "O\'Brien\'s \\"Team\\""');
    });

    // --- Ranked attribute comparison operators ---

    test.each([
        ['is exactly', '=='],
        ['is at least', '>='],
        ['is greater than', '>'],
        ['is at most', '<='],
        ['is less than', '<'],
    ])('ranked operator %s produces "attr %s value" comparison', (operator, celOp) => {
        const cel = rowToCEL({
            attribute: 'clearance',
            operator,
            values: ['Secret'],
            attribute_type: 'rank',
            hasMaskedValues: false,
        });
        expect(cel).toBe(`user.attributes.clearance ${celOp} "Secret"`);
    });

    test('ranked "is not" produces inequality comparison', () => {
        const cel = rowToCEL({
            attribute: 'clearance',
            operator: 'is not',
            values: ['Secret'],
            attribute_type: 'rank',
            hasMaskedValues: false,
        });
        expect(cel).toBe('user.attributes.clearance != "Secret"');
    });

    // --- Masking-related tests ---

    test('fully-masked row (hasMaskedValues=true, values=[]) emits "in []" placeholder regardless of operator', () => {
        // The placeholder is needed so the backend merge can locate this condition
        // by attribute and re-inject the hidden values.  The operator is irrelevant
        // because the backend always overrides it from the stored expression.
        const operators = ['in', 'is', 'has all of', 'has any of', 'contains', 'starts with'];
        for (const operator of operators) {
            const cel = rowToCEL({
                attribute: 'program',
                operator,
                values: [],
                attribute_type: 'text',
                hasMaskedValues: true,
            });
            expect(cel).toBe('user.attributes.program in []');
        }
    });

    test('partially-masked row (hasMaskedValues=true, values non-empty) uses normal CEL path', () => {
        // The caller holds "Alpha"; "Bravo" and "Charlie" are hidden.
        // The row should emit the visible value normally — backend merge appends the rest.
        const cel = rowToCEL({
            attribute: 'program',
            operator: 'in',
            values: ['Alpha'],
            attribute_type: 'text',
            hasMaskedValues: true,
        });
        expect(cel).toBe('user.attributes.program in ["Alpha"]');
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

    test.each(['>=', '>', '<=', '<'])('ranked comparison %s against a quoted value is simple', (op) => {
        expect(isSimpleCondition(`user.attributes.clearance ${op} "Secret"`)).toBe(true);
    });

    test('rejects function calls', () => {
        expect(isSimpleCondition('size(user.attributes.roles) > 0')).toBe(false);
    });

    test('rejects comparison against an unquoted numeric value', () => {
        // Guards the ranked-operator regex change: `size(...) > 0` style
        // numeric comparisons must still fall through to advanced mode.
        expect(isSimpleCondition('user.attributes.count > 0')).toBe(false);
    });
});
