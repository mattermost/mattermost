// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField, PropertyValue} from '@mattermost/types/properties';

import type {VisibleAttribute} from './utils';
import {allocateChipBudget, hasValue, isChipVisible} from './utils';

function makeField(overrides: Partial<PropertyField> = {}): PropertyField {
    return {
        id: 'field_1',
        group_id: 'group_1',
        name: 'classification',
        type: 'select',
        target_id: '',
        target_type: 'system',
        object_type: 'post',
        attrs: {},
        create_at: 1,
        update_at: 1,
        delete_at: 0,
        created_by: 'user_1',
        updated_by: 'user_1',
        ...overrides,
    } as PropertyField;
}

function makeValue(value: unknown, fieldId = 'field_1'): PropertyValue<unknown> {
    return {
        id: `value_${fieldId}`,
        target_id: 'post_1',
        target_type: 'post',
        group_id: 'group_1',
        field_id: fieldId,
        value,
        create_at: 1,
        update_at: 1,
        delete_at: 0,
        created_by: 'user_1',
        updated_by: 'user_1',
    };
}

function visible(field: PropertyField, value: unknown): VisibleAttribute {
    return {field, value: makeValue(value, field.id)};
}

describe('hasValue', () => {
    it('treats a missing value as unset', () => {
        expect(hasValue(undefined)).toBe(false);
    });

    it.each([
        ['null', null],
        ['undefined', undefined],
        ['an empty string', ''],
        ['an empty array', []],
    ])('treats %s as unset', (_label, raw) => {
        expect(hasValue(makeValue(raw))).toBe(false);
    });

    // Clearing an attribute stores an empty value rather than deleting the row, so
    // these are the shapes an intentionally-cleared attribute arrives in.
    it.each([
        ['zero', 0],
        ['false', false],
        ['a string', 'SECRET'],
        ['a populated array', ['SECRET']],
    ])('treats %s as set', (_label, raw) => {
        expect(hasValue(makeValue(raw))).toBe(true);
    });
});

describe('isChipVisible', () => {
    it('hides a hidden field even when it is set', () => {
        expect(isChipVisible(makeField({attrs: {visibility: 'hidden'}}), makeValue('SECRET'))).toBe(false);
    });

    // `always` promises a chip with no content to put in it, and there is no edit
    // affordance to make that chip useful, so it behaves as `when_set`.
    it('renders nothing for an always field with no value', () => {
        expect(isChipVisible(makeField({attrs: {visibility: 'always'}}), undefined)).toBe(false);
        expect(isChipVisible(makeField({attrs: {visibility: 'always'}}), makeValue(''))).toBe(false);
    });

    it('shows an always field that is set', () => {
        expect(isChipVisible(makeField({attrs: {visibility: 'always'}}), makeValue('SECRET'))).toBe(true);
    });

    it('treats an absent visibility as when_set', () => {
        expect(isChipVisible(makeField(), makeValue('SECRET'))).toBe(true);
        expect(isChipVisible(makeField(), undefined)).toBe(false);
    });

    it('treats an unrecognised visibility as when_set', () => {
        const field = makeField({attrs: {visibility: 'sometimes'}});
        expect(isChipVisible(field, makeValue('SECRET'))).toBe(true);
        expect(isChipVisible(field, makeValue(''))).toBe(false);
    });
});

describe('allocateChipBudget', () => {
    it('spends one slot per single-valued field and counts the rest as overflow', () => {
        const attributes = [
            visible(makeField({id: 'a'}), 'SECRET'),
            visible(makeField({id: 'b'}), 'INTERNAL'),
            visible(makeField({id: 'c'}), 'Execution'),
        ];

        const {shown, overflow} = allocateChipBudget(attributes, 2);

        expect(shown.map((entry) => entry.field.id)).toEqual(['a', 'b']);
        expect(shown.every((entry) => entry.maxItems === undefined)).toBe(true);
        expect(overflow).toBe(1);
    });

    it('caps a single multi-valued field at the whole budget rather than the field', () => {
        // Slicing the field list would let one field with twelve entries render
        // twelve chips inside the first slot.
        const twelve = Array.from({length: 12}, (_, index) => `user_${index}`);
        const attributes = [visible(makeField({id: 'a', type: 'multiuser'}), twelve)];

        const {shown, overflow} = allocateChipBudget(attributes, 2);

        expect(shown).toHaveLength(1);
        expect(shown[0].maxItems).toBe(2);
        expect(overflow).toBe(10);
    });

    it('counts remaining values rather than remaining fields', () => {
        const attributes = [
            visible(makeField({id: 'a', type: 'multiselect'}), ['SECRET', 'INTERNAL', 'RESTRICTED']),
            visible(makeField({id: 'b'}), 'Execution'),
        ];

        const {shown, overflow} = allocateChipBudget(attributes, 2);

        expect(shown).toHaveLength(1);
        expect(shown[0].maxItems).toBe(2);

        // One value left on the multiselect plus the whole second field.
        expect(overflow).toBe(2);
    });

    it('gives a multi-valued field only what the budget has left', () => {
        const attributes = [
            visible(makeField({id: 'a'}), 'SECRET'),
            visible(makeField({id: 'b', type: 'multiselect'}), ['INTERNAL', 'RESTRICTED', 'CONFIDENTIAL']),
        ];

        const {shown, overflow} = allocateChipBudget(attributes, 2);

        expect(shown.map((entry) => entry.field.id)).toEqual(['a', 'b']);
        expect(shown[1].maxItems).toBe(1);
        expect(overflow).toBe(2);
    });

    it('treats a wrong-shaped multi value as a single entry', () => {
        const attributes = [visible(makeField({id: 'a', type: 'multiselect'}), 'SECRET')];

        const {shown, overflow} = allocateChipBudget(attributes, 2);

        expect(shown[0].maxItems).toBe(1);
        expect(overflow).toBe(0);
    });

    it('shows nothing and overflows everything when the budget is zero', () => {
        const attributes = [visible(makeField({id: 'a'}), 'SECRET')];

        expect(allocateChipBudget(attributes, 0)).toEqual({shown: [], overflow: 1});
    });

    it('has no overflow when everything fits', () => {
        const attributes = [visible(makeField({id: 'a'}), 'SECRET')];

        const {shown, overflow} = allocateChipBudget(attributes, 2);

        expect(shown).toHaveLength(1);
        expect(overflow).toBe(0);
    });

    it('shows nothing for an empty list', () => {
        expect(allocateChipBudget([], 2)).toEqual({shown: [], overflow: 0});
    });

    // A later field cannot jump the queue when an earlier multi-valued one has
    // already spent the budget — the row's order has to match the field order.
    it('never skips ahead to a field that would fit', () => {
        const attributes = [
            visible(makeField({id: 'a', type: 'multiselect'}), ['SECRET', 'INTERNAL']),
            visible(makeField({id: 'b'}), 'Execution'),
        ];

        const {shown, overflow} = allocateChipBudget(attributes, 2);

        expect(shown.map((entry) => entry.field.id)).toEqual(['a']);
        expect(overflow).toBe(1);
    });
});
