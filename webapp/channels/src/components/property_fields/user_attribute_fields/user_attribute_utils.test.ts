// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {FieldType} from '@mattermost/types/properties';
import type {UserPropertyField} from '@mattermost/types/properties_user';

import {
    canEditUserAttribute,
    getEmptyUserAttributeValue,
    getVisibleUserAttributeFields,
    hasUserAttributeValue,
    isAdminManagedLocked,
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

const REQUIRED = 'property_fields.user_attribute_fields.required';
const INVALID_EMAIL = 'admin.user_item.invalidEmail';
const INVALID_URL = 'admin.user_item.invalidUrl';

describe('canEditUserAttribute', () => {
    test('allows a plain field', () => {
        expect(canEditUserAttribute(buildField(), opts)).toBe(true);
    });

    test('locks protected, synced and owner-managed fields', () => {
        const owners = [{id: 'scim', type: 'plugin' as const, scopes: []}];
        expect(canEditUserAttribute(buildField({}, {protected: true}), opts)).toBe(false);
        expect(canEditUserAttribute(buildField({}, {ldap: 'department'}), opts)).toBe(false);
        expect(canEditUserAttribute(buildField({}, {saml: 'department'}), opts)).toBe(false);
        expect(canEditUserAttribute(buildField({}, {owners}), opts)).toBe(false);
        expect(canEditUserAttribute(buildField({}, {owners: []}), opts)).toBe(true);
    });

    test.each(['select', 'multiselect', 'text'] as FieldType[])('locks a non-graph field with omitted options (%s)', (type) => {
        expect(canEditUserAttribute(buildField({type}, {options_omitted: true}), opts)).toBe(false);
    });

    test('allows a graph field with omitted options', () => {
        expect(canEditUserAttribute(buildField({type: 'graph'}, {options_omitted: true}), opts)).toBe(true);
    });

    test('locks managed=admin only without canEditAdminManaged', () => {
        const field = buildField({}, {managed: 'admin'});
        expect(canEditUserAttribute(field, {canEditAdminManaged: false})).toBe(false);
        expect(canEditUserAttribute(field, {canEditAdminManaged: true})).toBe(true);
    });

    test('locks permission_values none for everyone', () => {
        const field = buildField({permission_values: 'none'});
        expect(canEditUserAttribute(field, {canEditAdminManaged: true})).toBe(false);
        expect(canEditUserAttribute(field, {canEditAdminManaged: false})).toBe(false);
    });

    test.each(['sysadmin', 'admin'] as const)('requires manage_system for permission_values %s', (level) => {
        const field = buildField({permission_values: level});
        expect(canEditUserAttribute(field, {canEditAdminManaged: true})).toBe(true);
        expect(canEditUserAttribute(field, {canEditAdminManaged: false})).toBe(false);
    });

    test.each(['member', '', undefined] as const)('allows permission_values %p without manage_system', (level) => {
        expect(canEditUserAttribute(buildField({permission_values: level}), {canEditAdminManaged: false})).toBe(true);
    });
});

describe('isAdminManagedLocked', () => {
    test('is true only for managed=admin without canEditAdminManaged', () => {
        expect(isAdminManagedLocked(buildField({}, {managed: 'admin'}), {canEditAdminManaged: false})).toBe(true);
        expect(isAdminManagedLocked(buildField({}, {managed: 'admin'}), {canEditAdminManaged: true})).toBe(false);
        expect(isAdminManagedLocked(buildField(), {canEditAdminManaged: false})).toBe(false);
    });
});

describe('validateUserAttributeValue', () => {
    test('does not limit text length', () => {
        expect(validateUserAttributeValue(buildField(), 'a'.repeat(65))).toBeUndefined();
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

describe('getEmptyUserAttributeValue', () => {
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
        const empty = getEmptyUserAttributeValue(buildField({type}));
        expect(empty).toEqual(expected);
        expect(empty).not.toBeNull();
    });
});
