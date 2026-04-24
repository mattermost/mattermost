// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AccessControlVisualAST} from '@mattermost/types/access_control';
import type {FieldType, UserPropertyField} from '@mattermost/types/properties';

import {isSimpleExpression, isSimpleCondition, isMultiselectOrGroup} from 'components/admin_console/access_control/editors/shared';
import {parseExpression, findFirstAvailableAttributeFromList, rowToCEL, celStringLiteral, CORE_FIELD_EMAIL, CORE_FIELD_CHANNEL_TYPE, isResourceCoreField, attributeToUserCELPath, parseUserAttributePath} from 'components/admin_console/access_control/editors/table_editor/table_editor';

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
                attribute: CORE_FIELD_EMAIL,
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
                attribute: CORE_FIELD_EMAIL,
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

    test('parses resource.type into CORE_FIELD_CHANNEL_TYPE', () => {
        const ast: AccessControlVisualAST = {
            conditions: [
                {
                    attribute: 'resource.type',
                    operator: '==',
                    value: 'public',
                    value_type: 0,
                    attribute_type: 'select',
                },
            ],
        };

        expect(parseExpression(ast)).toEqual([
            {
                attribute: CORE_FIELD_CHANNEL_TYPE,
                operator: 'is',
                values: ['public'],
                attribute_type: 'select',
            },
        ]);
    });

    test('parses native user.email into CORE_FIELD_EMAIL', () => {
        const ast: AccessControlVisualAST = {
            conditions: [
                {
                    attribute: 'user.email',
                    operator: 'startsWith',
                    value: 'admin',
                    value_type: 0,
                    attribute_type: 'text',
                },
            ],
        };

        expect(parseExpression(ast)).toEqual([
            {
                attribute: CORE_FIELD_EMAIL,
                operator: 'starts with',
                values: ['admin'],
                attribute_type: 'text',
            },
        ]);
    });

    test('parses legacy user.attributes.email into CORE_FIELD_EMAIL (backward compat)', () => {
        const ast: AccessControlVisualAST = {
            conditions: [
                {
                    attribute: 'user.attributes.email',
                    operator: '==',
                    value: 'me@co.com',
                    value_type: 0,
                    attribute_type: 'text',
                },
            ],
        };

        expect(parseExpression(ast)).toEqual([
            {
                attribute: CORE_FIELD_EMAIL,
                operator: 'is',
                values: ['me@co.com'],
                attribute_type: 'text',
            },
        ]);
    });
});

describe('rowToCEL with resource core fields', () => {
    test('emits resource.type for channel type core field', () => {
        const cel = rowToCEL({
            attribute: CORE_FIELD_CHANNEL_TYPE,
            operator: 'is',
            values: ['public'],
            attribute_type: 'select',
        });
        expect(cel).toBe('resource.type == "public"');
    });

    test('emits resource.type with "in" for multi-value channel type', () => {
        const cel = rowToCEL({
            attribute: CORE_FIELD_CHANNEL_TYPE,
            operator: 'in',
            values: ['public', 'private'],
            attribute_type: 'select',
        });
        expect(cel).toBe('resource.type in ["public", "private"]');
    });
});

describe('rowToCEL with user core fields emits top-level paths', () => {
    test('emits user.email for email core field with "is" operator', () => {
        const cel = rowToCEL({
            attribute: CORE_FIELD_EMAIL,
            operator: 'is',
            values: ['me@co.com'],
            attribute_type: 'text',
        });
        expect(cel).toBe('user.email == "me@co.com"');
    });

    test('emits user.email.startsWith(...) for email core field', () => {
        const cel = rowToCEL({
            attribute: CORE_FIELD_EMAIL,
            operator: 'starts with',
            values: ['admin'],
            attribute_type: 'text',
        });
        expect(cel).toBe('user.email.startsWith("admin")');
    });
});

describe('isResourceCoreField', () => {
    test('returns true for CORE_FIELD_CHANNEL_TYPE', () => {
        expect(isResourceCoreField(CORE_FIELD_CHANNEL_TYPE)).toBe(true);
    });

    test('returns false for user core fields', () => {
        expect(isResourceCoreField(CORE_FIELD_EMAIL)).toBe(false);
    });

    test('returns false for unknown fields', () => {
        expect(isResourceCoreField('department')).toBe(false);
    });
});

describe('attributeToUserCELPath', () => {
    test('emits dot form for simple identifier', () => {
        expect(attributeToUserCELPath('Team')).toBe('user.attributes.Team');
    });

    test('emits index form for attribute with space', () => {
        expect(attributeToUserCELPath('Full Name')).toBe('user.attributes["Full Name"]');
    });

    test('emits index form for attribute with hyphen', () => {
        expect(attributeToUserCELPath('full-name')).toBe('user.attributes["full-name"]');
    });

    test('escapes double quotes and backslashes in the key', () => {
        expect(attributeToUserCELPath('has "quotes"')).toBe('user.attributes["has \\"quotes\\""]');
        expect(attributeToUserCELPath('with\\slash')).toBe('user.attributes["with\\\\slash"]');
    });
});

describe('parseUserAttributePath', () => {
    test('parses dot form', () => {
        expect(parseUserAttributePath('user.attributes.Team')).toBe('Team');
    });

    test('parses index form with spaces', () => {
        expect(parseUserAttributePath('user.attributes["Full Name"]')).toBe('Full Name');
    });

    test('unescapes quotes and backslashes in index form', () => {
        expect(parseUserAttributePath('user.attributes["has \\"quotes\\""]')).toBe('has "quotes"');
        expect(parseUserAttributePath('user.attributes["with\\\\slash"]')).toBe('with\\slash');
    });

    test('returns null for unrecognised paths', () => {
        expect(parseUserAttributePath('something.else')).toBeNull();
        expect(parseUserAttributePath('user.email')).toBeNull();
    });
});

describe('rowToCEL emits index form for special-char attribute names', () => {
    test('attribute with space uses index notation', () => {
        const cel = rowToCEL({
            attribute: 'Full Name',
            operator: 'is',
            values: ['Dr. Jane'],
            attribute_type: 'text',
        });
        expect(cel).toBe('user.attributes["Full Name"] == "Dr. Jane"');
    });

    test('attribute with space and startsWith method', () => {
        const cel = rowToCEL({
            attribute: 'Full Name',
            operator: 'starts with',
            values: ['Dr.'],
            attribute_type: 'text',
        });
        expect(cel).toBe('user.attributes["Full Name"].startsWith("Dr.")');
    });
});

describe('parseExpression handles index notation', () => {
    test('parses user.attributes["Spaced Name"] back into short attribute', () => {
        const ast: AccessControlVisualAST = {
            conditions: [
                {
                    attribute: 'user.attributes["Spaced Name"]',
                    operator: '==',
                    value: 'Schwabing',
                    value_type: 0,
                    attribute_type: 'text',
                },
            ],
        };

        expect(parseExpression(ast)).toEqual([
            {
                attribute: 'Spaced Name',
                operator: 'is',
                values: ['Schwabing'],
                attribute_type: 'text',
            },
        ]);
    });

    test('parses mixed native/dot/index conditions', () => {
        const ast: AccessControlVisualAST = {
            conditions: [
                {
                    attribute: 'user.email_verified',
                    operator: '==',
                    value: true,
                    value_type: 0,
                    attribute_type: 'text',
                },
                {
                    attribute: 'user.attributes.Team',
                    operator: '==',
                    value: 'Eng',
                    value_type: 0,
                    attribute_type: 'text',
                },
                {
                    attribute: 'user.attributes["Full Name"]',
                    operator: 'startsWith',
                    value: 'Dr.',
                    value_type: 0,
                    attribute_type: 'text',
                },
            ],
        };

        const rows = parseExpression(ast);
        expect(rows).toHaveLength(3);
        expect(rows[1].attribute).toBe('Team');
        expect(rows[2].attribute).toBe('Full Name');
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
            createMockAttribute('unsafe attribute'), // Not synced, not admin-managed
            createMockAttribute('unsafe_attribute'), // Not synced
            createMockAttribute('ldap_attribute', {ldap: 'ldap_field'}), // Synced from LDAP
        ];

        const result = findFirstAvailableAttributeFromList(attributes, false);
        expect(result?.name).toBe('ldap_attribute');
    });

    test('returns first attribute that is synced from SAML', () => {
        const attributes = [
            createMockAttribute('unsafe attribute'), // Not synced
            createMockAttribute('saml_attribute', {saml: 'saml_field'}), // Synced from SAML
        ];

        const result = findFirstAvailableAttributeFromList(attributes, false);
        expect(result?.name).toBe('saml_attribute');
    });

    test('returns first user-managed attribute when enableUserManagedAttributes is true', () => {
        const attributes = [
            createMockAttribute('spaced attribute'), // Spaces allowed — emitted with index notation
            createMockAttribute('user_managed_attribute'),
        ];

        // With user-managed enabled, the first attribute (including those with
        // spaces) is now considered available; the CEL emitter will use
        // index notation (user.attributes["spaced attribute"]).
        const result = findFirstAvailableAttributeFromList(attributes, true);
        expect(result?.name).toBe('spaced attribute');
    });

    test('returns first attribute that is admin-managed', () => {
        const attributes = [
            createMockAttribute('unsafe attribute'), // Not synced, not admin-managed
            createMockAttribute('unsafe_attribute'), // Not synced or admin-managed
            createMockAttribute('admin_managed_attribute', {managed: 'admin'}), // Admin-managed
        ];

        const result = findFirstAvailableAttributeFromList(attributes, false);
        expect(result?.name).toBe('admin_managed_attribute');
    });

    test('returns first attribute that is plugin-managed (protected)', () => {
        const attributes = [
            createMockAttribute('unsafe attribute'), // Not synced, not protected
            createMockAttribute('unsafe_attribute'), // Not synced or protected
            createMockAttribute('protected_attribute', {protected: true, source_plugin_id: 'com.example.plugin'}), // Protected by plugin
        ];

        const result = findFirstAvailableAttributeFromList(attributes, false);
        expect(result?.name).toBe('protected_attribute');
    });

    test('returns attributes with spaces when synced (spaces no longer disqualify)', () => {
        const attributes = [
            createMockAttribute('synced attribute', {ldap: 'ldap_field'}), // Has spaces and synced
            createMockAttribute('valid_synced_attribute', {ldap: 'ldap_field'}),
        ];

        // Spaces are now supported: the CEL emitter uses index notation
        // (user.attributes["synced attribute"]) for non-identifier names.
        const result = findFirstAvailableAttributeFromList(attributes, false);
        expect(result?.name).toBe('synced attribute');
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

    test('native user.email', () => {
        expect(isSimpleCondition('user.email == "me@co.com"')).toBe(true);
    });

    test('native user.is_bot with bool literal', () => {
        expect(isSimpleCondition('user.is_bot == false')).toBe(true);
    });

    test('native user.email_verified with bool literal', () => {
        expect(isSimpleCondition('user.email_verified == true')).toBe(true);
    });

    test('native user.email startsWith', () => {
        expect(isSimpleCondition('user.email.startsWith("admin")')).toBe(true);
    });

    test('resource.type equality', () => {
        expect(isSimpleCondition('resource.type == "public"')).toBe(true);
    });

    test('resource.type in list', () => {
        expect(isSimpleCondition('resource.type in ["public", "private"]')).toBe(true);
    });

    test('index notation equality', () => {
        expect(isSimpleCondition('user.attributes["Full Name"] == "Jane"')).toBe(true);
    });

    test('index notation startsWith', () => {
        expect(isSimpleCondition('user.attributes["Full Name"].startsWith("Dr.")')).toBe(true);
    });

    test('index notation in list', () => {
        expect(isSimpleCondition('user.attributes["Access Level"] in ["L1", "L2"]')).toBe(true);
    });

    test('scalar in index-form attribute', () => {
        expect(isSimpleCondition('"Staff" in user.attributes["Team Roles"]')).toBe(true);
    });

    test('equality with numeric literal', () => {
        expect(isSimpleCondition('user.attributes.score == 42')).toBe(true);
    });
});

describe('isSimpleExpression with native and index-form paths', () => {
    test('full policy combining native field and index notation', () => {
        expect(isSimpleExpression('user.email_verified == true && user.attributes["Location"] == "Schwabing"')).toBe(true);
    });

    test('combining resource, native, and CPA', () => {
        expect(isSimpleExpression('resource.type == "public" && user.email.endsWith("@co.com") && user.attributes.Team == "Eng"')).toBe(true);
    });
});

describe('isMultiselectOrGroup with index-form paths', () => {
    test('OR group on index-form attribute', () => {
        expect(isMultiselectOrGroup('("Staff" in user.attributes["Team Roles"] || "Admin" in user.attributes["Team Roles"])')).toBe(true);
    });
});
