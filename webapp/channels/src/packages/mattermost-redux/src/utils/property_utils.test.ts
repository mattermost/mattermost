// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

import {
    canMoveToOption,
    getOptionRank,
    getPropertyFieldChangePolicy,
    getPropertyFieldLabel,
    isPropertyFieldEditable,
    isPropertyFieldRequired,
    isPropertyValueSet,
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

function makeRankField(policy?: string): PropertyField {
    return makeField({
        type: 'rank',
        attrs: {
            change_policy: policy,
            options: [
                {id: 'low', name: 'LOW', rank: 1},
                {id: 'mid', name: 'MID', rank: 2},
                {id: 'high', name: 'HIGH', rank: 3},
            ],
        },
    });
}

describe('getPropertyFieldChangePolicy', () => {
    test('defaults to any when absent or unrecognised', () => {
        expect(getPropertyFieldChangePolicy(makeField())).toBe('any');
        expect(getPropertyFieldChangePolicy(makeField({attrs: {}}))).toBe('any');
        expect(getPropertyFieldChangePolicy(makeField({attrs: {change_policy: 'frozen'}}))).toBe('any');
    });

    test('reads each known policy', () => {
        expect(getPropertyFieldChangePolicy(makeField({attrs: {change_policy: 'never'}}))).toBe('never');
        expect(getPropertyFieldChangePolicy(makeField({attrs: {change_policy: 'raise_only'}}))).toBe('raise_only');
        expect(getPropertyFieldChangePolicy(makeField({attrs: {change_policy: 'lower_only'}}))).toBe('lower_only');
    });

    test('folds a legacy editable=false into never, and change_policy wins over it', () => {
        expect(getPropertyFieldChangePolicy(makeField({attrs: {editable: false}}))).toBe('never');
        expect(getPropertyFieldChangePolicy(makeField({attrs: {editable: false, change_policy: 'raise_only'}}))).toBe('raise_only');
    });
});

describe('isPropertyValueSet', () => {
    test('treats null, undefined, empty string and empty list as unset', () => {
        expect(isPropertyValueSet(null)).toBe(false);
        expect(isPropertyValueSet(undefined)).toBe(false);
        expect(isPropertyValueSet('')).toBe(false);
        expect(isPropertyValueSet([])).toBe(false);
    });

    test('treats anything else as set', () => {
        expect(isPropertyValueSet('SECRET')).toBe(true);
        expect(isPropertyValueSet(['a'])).toBe(true);
        expect(isPropertyValueSet(0)).toBe(true);
        expect(isPropertyValueSet(false)).toBe(true);
    });
});

describe('getOptionRank', () => {
    test('reads the explicit rank', () => {
        expect(getOptionRank(makeRankField(), 'mid')).toBe(2);
    });

    test('falls back to position for options cached before the server normalised them', () => {
        const field = makeField({type: 'rank', attrs: {options: [{id: 'a', name: 'A'}, {id: 'b', name: 'B'}]}});
        expect(getOptionRank(field, 'a')).toBe(1);
        expect(getOptionRank(field, 'b')).toBe(2);
    });

    test('returns undefined for an option that is no longer on the field', () => {
        expect(getOptionRank(makeRankField(), 'gone')).toBeUndefined();
    });
});

describe('canMoveToOption', () => {
    test('allows the first write under every policy', () => {
        for (const policy of ['any', 'never', 'raise_only', 'lower_only']) {
            expect(canMoveToOption(makeRankField(policy), null, 'low')).toBe(true);
        }
    });

    test('any permits every move, never permits none', () => {
        expect(canMoveToOption(makeRankField('any'), 'mid', 'low')).toBe(true);
        expect(canMoveToOption(makeRankField('never'), 'mid', 'high')).toBe(false);
    });

    test('raise_only permits only a higher rank, equal included as a refusal', () => {
        const field = makeRankField('raise_only');
        expect(canMoveToOption(field, 'mid', 'high')).toBe(true);
        expect(canMoveToOption(field, 'mid', 'mid')).toBe(false);
        expect(canMoveToOption(field, 'mid', 'low')).toBe(false);
    });

    test('lower_only is the mirror', () => {
        const field = makeRankField('lower_only');
        expect(canMoveToOption(field, 'mid', 'low')).toBe(true);
        expect(canMoveToOption(field, 'mid', 'mid')).toBe(false);
        expect(canMoveToOption(field, 'mid', 'high')).toBe(false);
    });

    test('fails closed when the stored option is gone', () => {
        expect(canMoveToOption(makeRankField('raise_only'), 'deleted-option', 'high')).toBe(false);
    });
});
