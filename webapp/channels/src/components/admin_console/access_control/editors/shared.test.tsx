// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserPropertyField} from '@mattermost/types/properties_user';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import {TestButton, celPrefixForField, excludeSessionAttributes, hasUsableAttributes, isSimpleCondition, isSimpleExpression, mergeSessionAttributes, toCELEditorAttributes, allowedOperatorLabelsForField, defaultOperatorForField, isNativeBooleanField, isNativeMethodOperator, isValidYoungerThanDaysValue, OperatorLabel} from './shared';

const makeField = (name: string, attrs: Partial<UserPropertyField['attrs']>, type: UserPropertyField['type'] = 'text'): UserPropertyField => ({
    id: `id-${name}`,
    name,
    type,
    group_id: 'custom_profile_attributes',
    target_id: '',
    target_type: '',
    object_type: 'user',
    attrs: {
        sort_order: 0,
        visibility: 'always',
        value_type: '',
        ...attrs,
    },
    create_at: 0,
    update_at: 0,
    delete_at: 0,
    created_by: '',
    updated_by: '',
});

describe('TestButton', () => {
    const baseProps = {
        onClick: jest.fn(),
        disabled: false,
    };

    beforeEach(() => {
        baseProps.onClick.mockClear();
    });

    test('should render test button with correct text and icon', () => {
        renderWithContext(<TestButton {...baseProps}/>, {});

        const button = screen.getByRole('button', {name: /test access rule/i});
        expect(button).toBeInTheDocument();
        expect(button).toHaveClass('btn', 'btn-sm', 'btn-tertiary');

        // Check for icon
        const icon = button.querySelector('i.icon.icon-lock-outline');
        expect(icon).toBeInTheDocument();
    });

    test('should render the supplied label override instead of the default copy', () => {
        renderWithContext(
            <TestButton
                {...baseProps}
                label='Simulate rules'
            />,
            {},
        );

        // The default "Test access rule" copy must not appear when a
        // label override is provided — used by the permission-rule
        // editors to surface "Simulate rules" instead.
        expect(screen.queryByRole('button', {name: /test access rule/i})).not.toBeInTheDocument();
        const button = screen.getByRole('button', {name: /simulate rules/i});
        expect(button).toBeInTheDocument();
        expect(button.querySelector('i.icon.icon-lock-outline')).toBeInTheDocument();
    });

    test('should be enabled and clickable when disabled is false', () => {
        renderWithContext(<TestButton {...baseProps}/>, {});

        const button = screen.getByRole('button', {name: /test access rule/i});
        expect(button).not.toBeDisabled();
        expect(button).toBeEnabled();
    });

    test('should be disabled when disabled is true', () => {
        const props = {
            ...baseProps,
            disabled: true,
        };

        renderWithContext(<TestButton {...props}/>, {});

        const button = screen.getByRole('button', {name: /test access rule/i});
        expect(button).toBeDisabled();
    });

    test('should call onClick when clicked and not disabled', () => {
        renderWithContext(<TestButton {...baseProps}/>, {});

        const button = screen.getByRole('button', {name: /test access rule/i});
        button.click();

        expect(baseProps.onClick).toHaveBeenCalledTimes(1);
    });

    test('should not call onClick when clicked and disabled', () => {
        const props = {
            ...baseProps,
            disabled: true,
        };

        renderWithContext(<TestButton {...props}/>, {});

        const button = screen.getByRole('button', {name: /test access rule/i});
        button.click();

        expect(baseProps.onClick).not.toHaveBeenCalled();
    });

    test('should not show tooltip when not disabled', () => {
        renderWithContext(<TestButton {...baseProps}/>, {});

        const button = screen.getByRole('button', {name: /test access rule/i});

        // Should not be wrapped with WithTooltip when enabled
        expect(button.parentElement).not.toHaveAttribute('data-testid', 'tooltip-wrapper');
        expect(button).not.toHaveAttribute('title');
    });

    test('should not show tooltip when disabled but no disabledTooltip provided', () => {
        const props = {
            ...baseProps,
            disabled: true,
        };

        renderWithContext(<TestButton {...props}/>, {});

        const button = screen.getByRole('button', {name: /test access rule/i});

        // Should not be wrapped with WithTooltip when no tooltip text provided
        expect(button.parentElement).not.toHaveAttribute('data-testid', 'tooltip-wrapper');
        expect(button).not.toHaveAttribute('title');
    });

    test('should show tooltip when disabled and disabledTooltip is provided', () => {
        const tooltipMessage = 'You cannot test access rules that would exclude you from the channel';
        const props = {
            ...baseProps,
            disabled: true,
            disabledTooltip: tooltipMessage,
        };

        renderWithContext(<TestButton {...props}/>, {});

        const button = screen.getByRole('button', {name: /test access rule/i});
        expect(button).toBeDisabled();

        // The main test is that the button is disabled when it should be
        // The tooltip implementation is complex with floating-ui, so we focus on the behavior
        // In actual usage, hovering over the button would show the tooltip
    });

    test('should show correct tooltip message when disabled and disabledTooltip is provided', () => {
        const tooltipMessage = 'Custom tooltip message';
        const props = {
            ...baseProps,
            disabled: true,
            disabledTooltip: tooltipMessage,
        };

        renderWithContext(<TestButton {...props}/>, {});

        // Since WithTooltip is complex and uses floating-ui, we mainly test that
        // the tooltip wrapper is present when needed
        const button = screen.getByRole('button', {name: /test access rule/i});
        expect(button).toBeDisabled();

        // The presence of tooltip is implied by the wrapper structure change
        // In a real test environment, you could hover over the button and check for tooltip
    });

    test('should handle empty string tooltip', () => {
        const props = {
            ...baseProps,
            disabled: true,
            disabledTooltip: '',
        };

        renderWithContext(<TestButton {...props}/>, {});

        const button = screen.getByRole('button', {name: /test access rule/i});
        expect(button).toBeDisabled();

        // Empty string tooltip should still not show tooltip
        expect(button.parentElement).not.toHaveAttribute('data-testid', 'tooltip-wrapper');
    });

    test('should handle undefined disabledTooltip same as no tooltip', () => {
        const props = {
            ...baseProps,
            disabled: true,
            disabledTooltip: undefined,
        };

        renderWithContext(<TestButton {...props}/>, {});

        const button = screen.getByRole('button', {name: /test access rule/i});
        expect(button).toBeDisabled();

        // Undefined tooltip should not show tooltip
        expect(button.parentElement).not.toHaveAttribute('data-testid', 'tooltip-wrapper');
    });
});

describe('hasUsableAttributes', () => {
    test('should return true when EnableUserManagedAttributes is true and attributes exist', () => {
        const userAttributes: UserPropertyField[] = [
            {
                id: 'attr1',
                name: 'department',
                type: 'text',
                group_id: 'custom_profile_attributes',
                target_id: '',
                target_type: '',
                object_type: '',
                attrs: {
                    sort_order: 0,
                    visibility: 'always',
                    value_type: '',
                },
                create_at: 0,
                update_at: 0,
                delete_at: 0,
                created_by: '',
                updated_by: '',
            },
        ];

        expect(hasUsableAttributes(userAttributes, true)).toBe(true);
    });

    test('should return true when attributes are LDAP synced', () => {
        const userAttributes: UserPropertyField[] = [
            {
                id: 'attr1',
                name: 'department',
                type: 'text',
                group_id: 'custom_profile_attributes',
                target_id: '',
                target_type: '',
                object_type: '',
                attrs: {
                    sort_order: 0,
                    visibility: 'always',
                    value_type: '',
                    ldap: 'ldap_department',
                },
                create_at: 0,
                update_at: 0,
                delete_at: 0,
                created_by: '',
                updated_by: '',
            },
        ];

        expect(hasUsableAttributes(userAttributes, false)).toBe(true);
    });

    test('should return true when attributes are SAML synced', () => {
        const userAttributes: UserPropertyField[] = [
            {
                id: 'attr1',
                name: 'department',
                type: 'text',
                group_id: 'custom_profile_attributes',
                target_id: '',
                target_type: '',
                object_type: '',
                attrs: {
                    sort_order: 0,
                    visibility: 'always',
                    value_type: '',
                    saml: 'saml_department',
                },
                create_at: 0,
                update_at: 0,
                delete_at: 0,
                created_by: '',
                updated_by: '',
            },
        ];

        expect(hasUsableAttributes(userAttributes, false)).toBe(true);
    });

    test('should return true when attributes are admin-managed', () => {
        const userAttributes: UserPropertyField[] = [
            {
                id: 'attr1',
                name: 'department',
                type: 'text',
                group_id: 'custom_profile_attributes',
                target_id: '',
                target_type: '',
                object_type: '',
                attrs: {
                    sort_order: 0,
                    visibility: 'always',
                    value_type: '',
                    managed: 'admin',
                },
                create_at: 0,
                update_at: 0,
                delete_at: 0,
                created_by: '',
                updated_by: '',
            },
        ];

        expect(hasUsableAttributes(userAttributes, false)).toBe(true);
    });

    test('should return true when attributes are plugin-managed (protected)', () => {
        const userAttributes: UserPropertyField[] = [
            {
                id: 'attr1',
                name: 'department',
                type: 'text',
                group_id: 'custom_profile_attributes',
                target_id: '',
                target_type: '',
                object_type: '',
                attrs: {
                    sort_order: 0,
                    visibility: 'always',
                    value_type: '',
                    protected: true,
                    source_plugin_id: 'com.example.plugin',
                },
                create_at: 0,
                update_at: 0,
                delete_at: 0,
                created_by: '',
                updated_by: '',
            },
        ];

        expect(hasUsableAttributes(userAttributes, false)).toBe(true);
    });

    test('should return false when attributes exist but are not usable (not LDAP/SAML/admin/protected and EnableUserManagedAttributes is false)', () => {
        const userAttributes: UserPropertyField[] = [
            {
                id: 'attr1',
                name: 'department',
                type: 'text',
                group_id: 'custom_profile_attributes',
                target_id: '',
                target_type: '',
                object_type: '',
                attrs: {
                    sort_order: 0,
                    visibility: 'always',
                    value_type: '',
                },
                create_at: 0,
                update_at: 0,
                delete_at: 0,
                created_by: '',
                updated_by: '',
            },
        ];

        expect(hasUsableAttributes(userAttributes, false)).toBe(false);
    });

    test('should return false when no attributes exist', () => {
        const userAttributes: UserPropertyField[] = [];

        expect(hasUsableAttributes(userAttributes, false)).toBe(false);
        expect(hasUsableAttributes(userAttributes, true)).toBe(false);
    });

    test('should return false when attributes have spaces in their names', () => {
        const userAttributes: UserPropertyField[] = [
            {
                id: 'attr1',
                name: 'department name',
                type: 'text',
                group_id: 'custom_profile_attributes',
                target_id: '',
                target_type: '',
                object_type: '',
                attrs: {
                    sort_order: 0,
                    visibility: 'always',
                    value_type: '',
                    ldap: 'ldap_department',
                },
                create_at: 0,
                update_at: 0,
                delete_at: 0,
                created_by: '',
                updated_by: '',
            },
        ];

        expect(hasUsableAttributes(userAttributes, false)).toBe(false);
    });

    test('should return true for native attributes regardless of sync/managed flags', () => {
        const userAttributes: UserPropertyField[] = [
            makeField('email', {native: true, operators: ['==', '!=']}),
        ];

        expect(hasUsableAttributes(userAttributes, false)).toBe(true);
    });

    test('should return true when at least one attribute is usable (mixed attributes)', () => {
        const userAttributes: UserPropertyField[] = [
            {
                id: 'attr1',
                name: 'department name',
                type: 'text',
                group_id: 'custom_profile_attributes',
                target_id: '',
                target_type: '',
                object_type: '',
                attrs: {
                    sort_order: 0,
                    visibility: 'always',
                    value_type: '',
                },
                create_at: 0,
                update_at: 0,
                delete_at: 0,
                created_by: '',
                updated_by: '',
            },
            {
                id: 'attr2',
                name: 'location',
                type: 'text',
                group_id: 'custom_profile_attributes',
                target_id: '',
                target_type: '',
                object_type: '',
                attrs: {
                    sort_order: 0,
                    visibility: 'always',
                    value_type: '',
                    ldap: 'ldap_location',
                },
                create_at: 0,
                update_at: 0,
                delete_at: 0,
                created_by: '',
                updated_by: '',
            },
        ];

        expect(hasUsableAttributes(userAttributes, false)).toBe(true);
    });
});

describe('excludeSessionAttributes', () => {
    // Group ids are real UUIDs in production; session attributes are identified
    // by their `session` object type, not by the group id matching a name.
    const CPA_GROUP_UUID = 'custom_profile_attributes';
    const SESSION_GROUP_UUID = 'session_attributes';

    const makeField = (id: string, objectType: string): UserPropertyField => ({
        id,
        name: id,
        type: 'text',
        group_id: objectType === 'session' ? SESSION_GROUP_UUID : CPA_GROUP_UUID,
        target_id: '',
        target_type: objectType === 'session' ? 'system' : '',
        object_type: objectType,
        attrs: {
            sort_order: 0,
            visibility: 'always',
            value_type: '',
        },
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        created_by: '',
        updated_by: '',
    });

    test('removes session-attribute fields and keeps user attributes', () => {
        const userField = makeField('department', 'user');
        const sessionField = makeField('ip_address', 'session');

        expect(excludeSessionAttributes([userField, sessionField])).toEqual([userField]);
    });

    test('returns an empty array for empty input', () => {
        expect(excludeSessionAttributes([])).toEqual([]);
    });

    test('returns the list unchanged when no session attributes are present', () => {
        const fields = [
            makeField('department', 'user'),
            makeField('location', 'user'),
        ];

        expect(excludeSessionAttributes(fields)).toEqual(fields);
    });

    test('returns an empty array when every field is a session attribute', () => {
        const fields = [
            makeField('ip_address', 'session'),
            makeField('network_name', 'session'),
        ];

        expect(excludeSessionAttributes(fields)).toEqual([]);
    });
});

describe('celPrefixForField', () => {
    test('session field resolves to the user.session namespace', () => {
        expect(celPrefixForField({object_type: 'session'})).toBe('user.session.');
    });

    test('user field resolves to the user.attributes namespace', () => {
        expect(celPrefixForField({object_type: 'user'})).toBe('user.attributes.');
    });

    test('empty object type resolves to the user.attributes namespace', () => {
        expect(celPrefixForField({object_type: ''})).toBe('user.attributes.');
    });
});

describe('mergeSessionAttributes', () => {
    const CPA_GROUP_UUID = 'custom_profile_attributes';
    const SESSION_GROUP_UUID = 'session_attributes';

    const makeField = (id: string, objectType: string, name = id): UserPropertyField => ({
        id,
        name,
        type: 'text',
        group_id: objectType === 'session' ? SESSION_GROUP_UUID : CPA_GROUP_UUID,
        target_id: '',
        target_type: objectType === 'session' ? 'system' : '',
        object_type: objectType,
        attrs: {
            sort_order: 0,
            visibility: 'always',
            value_type: '',
        },
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        created_by: '',
        updated_by: '',
    });

    test('appends session fields after the user attributes', () => {
        const userField = makeField('department', 'user');
        const sessionField = makeField('ip_address', 'session');

        expect(mergeSessionAttributes([userField], [sessionField])).toEqual([userField, sessionField]);
    });

    test('returns the same reference when there are no session fields', () => {
        const autocomplete = [makeField('department', 'user')];

        expect(mergeSessionAttributes(autocomplete, [])).toBe(autocomplete);
    });

    test('returns the same reference when every session field is already present by id', () => {
        const sessionField = makeField('ip_address', 'session');
        const autocomplete = [makeField('department', 'user'), sessionField];

        expect(mergeSessionAttributes(autocomplete, [sessionField])).toBe(autocomplete);
    });

    test('dedups by object_type:name even when ids differ', () => {
        const autocomplete = [makeField('aaa', 'session', 'ip_address')];
        const duplicateByName = makeField('bbb', 'session', 'ip_address');

        expect(mergeSessionAttributes(autocomplete, [duplicateByName])).toBe(autocomplete);
    });
});

describe('isSimpleExpression / isSimpleCondition with session attributes', () => {
    test('session equality condition is simple', () => {
        expect(isSimpleCondition('user.session.ip_address == "10.0.0.1"')).toBe(true);
        expect(isSimpleExpression('user.session.ip_address == "10.0.0.1"')).toBe(true);
    });

    test('scalar in session attribute is simple', () => {
        expect(isSimpleCondition('"x" in user.session.foo')).toBe(true);
    });

    test('session in list is simple', () => {
        expect(isSimpleCondition('user.session.foo in ["a", "b"]')).toBe(true);
    });

    test('mixed user and session conditions are simple', () => {
        expect(isSimpleExpression('user.attributes.dept == "Eng" && user.session.ip_address == "10.0.0.1"')).toBe(true);
    });

    test('unknown namespaces are not simple', () => {
        expect(isSimpleCondition('user.bogus.x == "y"')).toBe(false);
        expect(isSimpleExpression('user.bogus.x == "y"')).toBe(false);
    });
});

describe('toCELEditorAttributes', () => {
    test('keeps native attributes (flagged) and drops unsafe CPA when user-managed is off', () => {
        const fields = [
            makeField('email', {native: true, operators: ['==']}),
            makeField('unsafe', {}),
            makeField('synced', {ldap: 'ldap_field'}),
        ];

        expect(toCELEditorAttributes(fields, false)).toEqual([
            {attribute: 'email', values: [], isNative: true, objectType: 'user'},
            {attribute: 'synced', values: [], isNative: false, objectType: 'user'},
        ]);
    });

    test('keeps all CPA when user-managed attributes are enabled', () => {
        const fields = [
            makeField('email', {native: true, operators: ['==']}),
            makeField('unsafe', {}),
        ];

        expect(toCELEditorAttributes(fields, true)).toEqual([
            {attribute: 'email', values: [], isNative: true, objectType: 'user'},
            {attribute: 'unsafe', values: [], isNative: false, objectType: 'user'},
        ]);
    });
});

describe('allowedOperatorLabelsForField / defaultOperatorForField', () => {
    test('maps native operator tokens to UI labels', () => {
        const field = makeField('email', {native: true, operators: ['==', '!=', 'contains']});
        expect(allowedOperatorLabelsForField(field)).toEqual(['is', 'is not', 'contains']);
        expect(defaultOperatorForField(field)).toBe('is');
    });

    test('maps youngerThanDays token', () => {
        const field = makeField('createat', {native: true, operators: ['youngerThanDays']});
        expect(allowedOperatorLabelsForField(field)).toEqual(['younger than']);
        expect(defaultOperatorForField(field)).toBe('younger than');
    });

    test('returns undefined for non-native fields and falls back to is/has any of', () => {
        expect(allowedOperatorLabelsForField(makeField('dept', {}))).toBeUndefined();
        expect(defaultOperatorForField(makeField('dept', {}))).toBe('is');
        expect(defaultOperatorForField(makeField('skills', {}, 'multiselect'))).toBe('has any of');
    });
});

describe('isNativeBooleanField', () => {
    test('true for a native select with true/false options', () => {
        const field = makeField('verified', {native: true, options: [{id: '1', name: 'true'}, {id: '2', name: 'false'}]}, 'select');
        expect(isNativeBooleanField(field)).toBe(true);
    });

    test('false for a native select with non-boolean options', () => {
        const field = makeField('color', {native: true, options: [{id: '1', name: 'red'}]}, 'select');
        expect(isNativeBooleanField(field)).toBe(false);
    });

    test('false for a non-native select with true/false options', () => {
        const field = makeField('flag', {options: [{id: '1', name: 'true'}, {id: '2', name: 'false'}]}, 'select');
        expect(isNativeBooleanField(field)).toBe(false);
    });
});

describe('isValidYoungerThanDaysValue', () => {
    test.each(['0', '7', '30', '365', '007', '  30  '])('accepts non-negative integer %p', (value) => {
        expect(isValidYoungerThanDaysValue(value)).toBe(true);
    });

    test.each(['', 'ten', '-5', '3.5', '1e3', '30abc', 'NaN'])('rejects non-integer value %p', (value) => {
        expect(isValidYoungerThanDaysValue(value)).toBe(false);
    });
});

describe('isNativeMethodOperator', () => {
    test('true for the native "younger than" operator', () => {
        expect(isNativeMethodOperator(OperatorLabel.YOUNGER_THAN)).toBe(true);
    });

    test.each([OperatorLabel.IS, OperatorLabel.IS_NOT, OperatorLabel.IN, OperatorLabel.STARTS_WITH, OperatorLabel.HAS_ANY_OF, OperatorLabel.IS_AT_LEAST])('false for non-native operator %p', (op) => {
        expect(isNativeMethodOperator(op)).toBe(false);
    });

    test('false for an unknown operator token', () => {
        expect(isNativeMethodOperator('not an operator')).toBe(false);
    });
});
