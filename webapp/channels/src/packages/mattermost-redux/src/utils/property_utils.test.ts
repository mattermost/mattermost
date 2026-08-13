// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

import {
    getPropertyFieldLabel,
    isPropertyFieldEditable,
    isPropertyFieldRequired,
    isPSAv1PropertyField,
} from './property_utils';

function makeField(overrides: Partial<PropertyField> = {}): PropertyField {
    return {
        id: 'field-1',
        group_id: 'group-1',
        name: 'test',
        type: 'text',
        target_id: '',
        target_type: '',
        object_type: '',
        create_at: 1000,
        update_at: 1000,
        delete_at: 0,
        created_by: 'user-1',
        updated_by: 'user-1',
        ...overrides,
    };
}

describe('isPSAv1PropertyField', () => {
    test('returns true when object_type is undefined', () => {
        const field = makeField({object_type: undefined});
        expect(isPSAv1PropertyField(field)).toBe(true);
    });

    test('returns true when object_type is empty string', () => {
        const field = makeField({object_type: ''});
        expect(isPSAv1PropertyField(field)).toBe(true);
    });

    test('returns true when object_type is null (from JSON deserialization)', () => {
        const field = makeField({object_type: null as unknown as string});
        expect(isPSAv1PropertyField(field)).toBe(true);
    });

    test('returns false when object_type is a non-empty string', () => {
        const field = makeField({object_type: 'post'});
        expect(isPSAv1PropertyField(field)).toBe(false);
    });
});

describe('isPropertyFieldRequired', () => {
    test('returns true only for an explicit true', () => {
        expect(isPropertyFieldRequired(makeField({attrs: {required: true}}))).toBe(true);
    });

    test('returns false when absent, false, or a non-boolean', () => {
        expect(isPropertyFieldRequired(makeField())).toBe(false);
        expect(isPropertyFieldRequired(makeField({attrs: {}}))).toBe(false);
        expect(isPropertyFieldRequired(makeField({attrs: {required: false}}))).toBe(false);
        expect(isPropertyFieldRequired(makeField({attrs: {required: 'true'}}))).toBe(false);
    });
});

describe('isPropertyFieldEditable', () => {
    test('returns true when absent, so fields predating the key are not read as locked', () => {
        expect(isPropertyFieldEditable(makeField())).toBe(true);
        expect(isPropertyFieldEditable(makeField({attrs: {}}))).toBe(true);
    });

    test('returns false only for an explicit false', () => {
        expect(isPropertyFieldEditable(makeField({attrs: {editable: false}}))).toBe(false);
        expect(isPropertyFieldEditable(makeField({attrs: {editable: true}}))).toBe(true);
    });

    test('ignores a non-boolean rather than locking the field', () => {
        expect(isPropertyFieldEditable(makeField({attrs: {editable: 'false'}}))).toBe(true);
    });
});

describe('getPropertyFieldLabel', () => {
    test('prefers display_name', () => {
        expect(getPropertyFieldLabel(makeField({name: 'caveat', attrs: {display_name: 'Caveat / Releasability'}}))).toBe('Caveat / Releasability');
    });

    test('falls back to name when display_name is missing or empty', () => {
        expect(getPropertyFieldLabel(makeField({name: 'caveat'}))).toBe('caveat');
        expect(getPropertyFieldLabel(makeField({name: 'caveat', attrs: {display_name: ''}}))).toBe('caveat');
        expect(getPropertyFieldLabel(makeField({name: 'caveat', attrs: {display_name: 42}}))).toBe('caveat');
    });
});
