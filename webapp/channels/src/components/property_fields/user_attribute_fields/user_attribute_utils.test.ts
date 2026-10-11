// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {FieldType} from '@mattermost/types/properties';
import type {UserPropertyField} from '@mattermost/types/properties_user';

import {
    canEditUserAttribute,
    getClearedUserAttributeValue,
    getUserAttributeLockReason,
    getVisibleUserAttributeFields,
    hasUserAttributeValue,
    isSameUserAttributeValue,
    validateUserAttributeValue,
} from './user_attribute_utils';

const buildField = (overrides: Partial<UserPropertyField> = {}, attrs: Partial<UserPropertyField['attrs']> = {}): UserPropertyField => ({
    id: 'field-1',
    name: 'department',
    type: 'text',
    group_id: 'custom_profile_attributes',
    create_at: 0,
    update_at: 0,
    delete_at: 0,
    created_by: '',
    updated_by: '',
    target_id: '',
    target_type: '',
    object_type: 'user',
    ...overrides,
    attrs: {sort_order: 0, visibility: 'when_set', value_type: '', ...attrs},
});

const opts = {canEditAdminManaged: true};

const TOO_LONG = 'property_fields.user_attribute_fields.too_long';
const REQUIRED = 'property_fields.user_attribute_fields.required';
const INVALID_EMAIL = 'admin.user_item.invalidEmail';
const INVALID_URL = 'admin.user_item.invalidUrl';

describe('getUserAttributeLockReason', () => {
    test('returns undefined for a plain editable field', () => {
        expect(getUserAttributeLockReason(buildField(), opts)).toBeUndefined();
    });

    test('returns protected when attrs.protected is set', () => {
        expect(getUserAttributeLockReason(buildField({}, {protected: true}), opts)).toBe('protected');
    });

    test('returns synced for an ldap attr', () => {
        expect(getUserAttributeLockReason(buildField({}, {ldap: 'department'}), opts)).toBe('synced');
    });

    test('returns synced for a saml attr', () => {
        expect(getUserAttributeLockReason(buildField({}, {saml: 'department'}), opts)).toBe('synced');
    });

    test('returns owner_managed when owners is non-empty', () => {
        const owners = [{id: 'scim', type: 'plugin' as const, scopes: []}];
        expect(getUserAttributeLockReason(buildField({}, {owners}), opts)).toBe('owner_managed');
        expect(getUserAttributeLockReason(buildField({}, {owners: []}), opts)).toBeUndefined();
    });

    test.each(['select', 'multiselect', 'text'] as FieldType[])('returns options_omitted for a non-graph field with omitted options (%s)', (type) => {
        expect(getUserAttributeLockReason(buildField({type}, {options_omitted: true}), opts)).toBe('options_omitted');
    });

    test('does not lock a graph field with omitted options', () => {
        expect(getUserAttributeLockReason(buildField({type: 'graph'}, {options_omitted: true}), opts)).toBeUndefined();
    });

    test('locks managed=admin only without canEditAdminManaged', () => {
        const field = buildField({}, {managed: 'admin'});
        expect(getUserAttributeLockReason(field, {canEditAdminManaged: false})).toBe('admin_managed');
        expect(getUserAttributeLockReason(field, {canEditAdminManaged: true})).toBeUndefined();
    });

    test('prefers the earliest reason', () => {
        const owners = [{id: 'scim', type: 'plugin' as const, scopes: []}];
        const noAdmin = {canEditAdminManaged: false};

        expect(getUserAttributeLockReason(buildField({type: 'select'}, {
            protected: true,
            ldap: 'dept',
            owners,
            options_omitted: true,
            managed: 'admin',
        }), noAdmin)).toBe('protected');
        expect(getUserAttributeLockReason(buildField({}, {ldap: 'dept', owners}), noAdmin)).toBe('synced');
        expect(getUserAttributeLockReason(buildField({type: 'select'}, {owners, options_omitted: true}), noAdmin)).toBe('owner_managed');
        expect(getUserAttributeLockReason(buildField({type: 'select'}, {options_omitted: true, managed: 'admin'}), noAdmin)).toBe('options_omitted');
    });
});

describe('canEditUserAttribute', () => {
    test('is true only when there is no lock reason', () => {
        expect(canEditUserAttribute(buildField(), opts)).toBe(true);
        expect(canEditUserAttribute(buildField({}, {protected: true}), opts)).toBe(false);

        const adminManaged = buildField({}, {managed: 'admin'});
        expect(canEditUserAttribute(adminManaged, {canEditAdminManaged: true})).toBe(true);
        expect(canEditUserAttribute(adminManaged, {canEditAdminManaged: false})).toBe(false);
    });
});

describe('validateUserAttributeValue', () => {
    const textField = buildField();

    test('accepts 64 ASCII bytes', () => {
        expect(validateUserAttributeValue(textField, 'a'.repeat(64))).toBeUndefined();
    });

    test('rejects 65 ASCII bytes', () => {
        expect(validateUserAttributeValue(textField, 'a'.repeat(65))?.id).toBe(TOO_LONG);
    });

    test('rejects multibyte text over 64 bytes even under 64 characters', () => {
        expect(validateUserAttributeValue(textField, 'é'.repeat(33))?.id).toBe(TOO_LONG);
        expect(validateUserAttributeValue(textField, 'é'.repeat(32))).toBeUndefined();
    });

    test('counts three-byte characters as three bytes', () => {
        expect(validateUserAttributeValue(textField, '日'.repeat(22))?.id).toBe(TOO_LONG);
        expect(validateUserAttributeValue(textField, '日'.repeat(21))).toBeUndefined();
    });

    test('counts astral characters as four bytes', () => {
        expect(validateUserAttributeValue(textField, '😀'.repeat(17))?.id).toBe(TOO_LONG);
        expect(validateUserAttributeValue(textField, '😀'.repeat(16))).toBeUndefined();
    });

    test('trims before counting', () => {
        expect(validateUserAttributeValue(textField, ` ${'a'.repeat(64)} `)).toBeUndefined();
        expect(validateUserAttributeValue(textField, ` ${'a'.repeat(65)} `)?.id).toBe(TOO_LONG);
    });

    test('only applies the length limit to text fields', () => {
        const longId = 'o'.repeat(65);
        const select = buildField({type: 'select'}, {options: [{id: longId, name: 'Long'}]});
        expect(validateUserAttributeValue(select, longId)).toBeUndefined();
    });

    test('requires a value when attrs.required is true', () => {
        expect(validateUserAttributeValue(buildField({}, {required: true}), '')?.id).toBe(REQUIRED);
        expect(validateUserAttributeValue(buildField({}, {required: true}), undefined)?.id).toBe(REQUIRED);
        expect(validateUserAttributeValue(buildField({type: 'multiselect'}, {required: true}), [])?.id).toBe(REQUIRED);
    });

    test('does not treat a non-boolean required as required', () => {
        expect(validateUserAttributeValue(buildField({}, {required: 'true'}), '')).toBeUndefined();
    });

    test('treats an empty optional value as valid', () => {
        expect(validateUserAttributeValue(buildField({}, {value_type: 'email'}), '')).toBeUndefined();
        expect(validateUserAttributeValue(buildField({type: 'multiselect'}), [])).toBeUndefined();
        expect(validateUserAttributeValue(buildField(), undefined)).toBeUndefined();
    });

    test('validates email', () => {
        const email = buildField({}, {value_type: 'email'});
        expect(validateUserAttributeValue(email, 'nope')?.id).toBe(INVALID_EMAIL);
        expect(validateUserAttributeValue(email, 'a@b.co')).toBeUndefined();
        expect(validateUserAttributeValue(email, ' a@b.co ')).toBeUndefined();
        expect(validateUserAttributeValue(email, 'a @b.co')?.id).toBe(INVALID_EMAIL);
    });

    test('validates URL', () => {
        const url = buildField({}, {value_type: 'url'});
        expect(validateUserAttributeValue(url, 'not a url')?.id).toBe(INVALID_URL);
        expect(validateUserAttributeValue(url, 'https://mattermost.com')).toBeUndefined();
        expect(validateUserAttributeValue(url, '  https://mattermost.com  ')).toBeUndefined();
    });

    test('treats a whitespace-only value as empty', () => {
        expect(validateUserAttributeValue(buildField({}, {value_type: 'email'}), '   ')).toBeUndefined();
        expect(validateUserAttributeValue(buildField({}, {value_type: 'url'}), ' \t ')).toBeUndefined();
        expect(validateUserAttributeValue(buildField(), '   ')).toBeUndefined();
        expect(validateUserAttributeValue(buildField({}, {required: true}), '   ')?.id).toBe(REQUIRED);
        expect(validateUserAttributeValue(buildField({}, {required: true, value_type: 'email'}), '   ')?.id).toBe(REQUIRED);
    });

    test('reports length before format', () => {
        const email = buildField({}, {value_type: 'email'});
        expect(validateUserAttributeValue(email, `${'a'.repeat(60)}@b.co`)?.id).toBe(TOO_LONG);
    });

    test('does not validate phone', () => {
        expect(validateUserAttributeValue(buildField({}, {value_type: 'phone'}), 'abc')).toBeUndefined();
    });

    test('ignores array values beyond the required check', () => {
        expect(validateUserAttributeValue(buildField({type: 'multiselect'}, {required: true}), ['a'])).toBeUndefined();
        expect(validateUserAttributeValue(buildField({type: 'multiselect'}, {value_type: 'email'}), ['nope'])).toBeUndefined();
    });
});

describe('getVisibleUserAttributeFields', () => {
    test('drops source_only and sorts by sort_order without mutating the input', () => {
        const second = buildField({id: 'second'}, {sort_order: 2});
        const hidden = buildField({id: 'hidden'}, {sort_order: 1, access_mode: 'source_only'});
        const first = buildField({id: 'first'}, {sort_order: 0});
        const unsorted = {...buildField({id: 'unsorted'}), attrs: {visibility: 'when_set', value_type: ''} as unknown as UserPropertyField['attrs']};
        const input = [second, hidden, first, unsorted];

        const result = getVisibleUserAttributeFields(input);

        expect(result.map((field) => field.id)).toEqual(['first', 'unsorted', 'second']);
        expect(input.map((field) => field.id)).toEqual(['second', 'hidden', 'first', 'unsorted']);
    });

    test('keeps shared_only fields', () => {
        const shared = buildField({id: 'shared'}, {access_mode: 'shared_only'});
        expect(getVisibleUserAttributeFields([shared]).map((field) => field.id)).toEqual(['shared']);
    });
});

describe('hasUserAttributeValue', () => {
    test("treats undefined, '' and [] as empty", () => {
        expect(hasUserAttributeValue(undefined)).toBe(false);
        expect(hasUserAttributeValue('')).toBe(false);
        expect(hasUserAttributeValue([])).toBe(false);
        expect(hasUserAttributeValue('   ')).toBe(true);
        expect(hasUserAttributeValue(['a'])).toBe(true);
    });
});

describe('isSameUserAttributeValue', () => {
    test('isSameUserAttributeValue normalizes empty values', () => {
        expect(isSameUserAttributeValue(undefined, '')).toBe(true);
        expect(isSameUserAttributeValue('', [])).toBe(true);
        expect(isSameUserAttributeValue(undefined, [])).toBe(true);
        expect(isSameUserAttributeValue(undefined, undefined)).toBe(true);
        expect(isSameUserAttributeValue('', 'a')).toBe(false);
    });

    test('isSameUserAttributeValue compares arrays by order and content', () => {
        expect(isSameUserAttributeValue(['a', 'b'], ['a', 'b'])).toBe(true);
        expect(isSameUserAttributeValue(['a', 'b'], ['b', 'a'])).toBe(false);
        expect(isSameUserAttributeValue(['a', 'b'], ['a'])).toBe(false);
    });

    test('isSameUserAttributeValue does not equate a string with a single-item array', () => {
        expect(isSameUserAttributeValue('a', ['a'])).toBe(false);
        expect(isSameUserAttributeValue('a', 'a')).toBe(true);
        expect(isSameUserAttributeValue('a', 'b')).toBe(false);
    });
});

describe('getClearedUserAttributeValue', () => {
    test.each([
        ['text', ''],
        ['select', ''],
        ['rank', ''],
        ['date', ''],
        ['user', ''],
        ['multiselect', []],
        ['graph', []],
        ['multiuser', []],
    ] as Array<[FieldType, string | string[]]>)("returns [] for multiselect, graph and multiuser and '' otherwise (%s)", (type, expected) => {
        const cleared = getClearedUserAttributeValue(buildField({type}));
        expect(cleared).toEqual(expected);
        expect(cleared).not.toBeNull();
    });
});
