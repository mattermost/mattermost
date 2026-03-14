// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

import {isPSAv1PropertyField} from './property_utils';

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
