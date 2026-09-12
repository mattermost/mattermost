// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField, PropertyValue} from '@mattermost/types/properties';

import type {VisibleAttribute} from './utils';
import {allocateChipBudget, chipCount, hasValue, isChipVisible} from './utils';

// Every name these tests store as a value. An option-bearing field only earns a
// chip for a value that resolves to one of its options, so the fixture has to
// define them or nothing would render.
const OPTIONS = [
    {id: 'opt_secret', name: 'SECRET'},
    {id: 'opt_internal', name: 'INTERNAL'},
    {id: 'opt_restricted', name: 'RESTRICTED'},
    {id: 'opt_confidential', name: 'CONFIDENTIAL'},
    {id: 'opt_execution', name: 'Execution'},
];

function makeField(overrides: Partial<PropertyField> = {}): PropertyField {
    const {attrs, ...rest} = overrides;

    return {
        id: 'field_1',
        group_id: 'group_1',
        name: 'classification',
        type: 'select',
        target_id: '',
        target_type: 'system',
        object_type: 'post',
        create_at: 1,
        update_at: 1,
        delete_at: 0,
        created_by: 'user_1',
        updated_by: 'user_1',
        ...rest,

        // Merged, not replaced: an override that sets `visibility` still needs the
        // options, or the value it stores would resolve to nothing.
        attrs: {options: OPTIONS, ...attrs},
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

describe('chipCount', () => {
    it('is zero for a missing value', () => {
        expect(chipCount(makeField(), undefined)).toBe(0);
    });

    it.each([
        ['null', null],
        ['an empty string', ''],
        ['an empty array', []],
    ])('is zero for %s', (_label, raw) => {
        expect(chipCount(makeField(), makeValue(raw))).toBe(0);
    });

    it('is one for a single-valued field whose value resolves to an option', () => {
        expect(chipCount(makeField(), makeValue('SECRET'))).toBe(1);
    });

    // The chip *is* the option: both its text and its colour come from the option
    // definition, so a value naming an option the channel no longer defines has
    // nothing to render. Counting it would spend a chip slot on nothing and, when
    // it is the post's only attribute, leave an empty chip row on screen.
    it('is zero when the value names an option that no longer exists', () => {
        expect(chipCount(makeField(), makeValue('WITHDRAWN'))).toBe(0);
    });

    // A field that defines no options has had nothing deleted — its choices simply
    // live somewhere the field cannot see, as content flagging's `reporting_reason`
    // keeps them in server config. The stored string is the content, so it counts.
    it('counts a set value on a field that defines no options', () => {
        expect(chipCount(makeField({attrs: {options: []}}), makeValue('Classification mismatch'))).toBe(1);
    });

    it('counts only the resolvable entries of a multiselect', () => {
        const field = makeField({type: 'multiselect'});

        expect(chipCount(field, makeValue(['SECRET', 'WITHDRAWN', 'INTERNAL']))).toBe(2);
        expect(chipCount(field, makeValue(['WITHDRAWN', 'RETIRED']))).toBe(0);
    });

    it('counts a rank field by its options, the same as a select', () => {
        expect(chipCount(makeField({type: 'rank'}), makeValue('SECRET'))).toBe(1);
        expect(chipCount(makeField({type: 'rank'}), makeValue('WITHDRAWN'))).toBe(0);
    });

    // A field with no options has no option to resolve against, so a set value is
    // a chip on its own terms.
    it('is one for a set field that carries no options', () => {
        expect(chipCount(makeField({type: 'text'}), makeValue('free text'))).toBe(1);
        expect(chipCount(makeField({type: 'text'}), makeValue(0))).toBe(1);
        expect(chipCount(makeField({type: 'user'}), makeValue('user_1'))).toBe(1);
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

    // Same rule as `chipCount`, reached through the filter the row actually runs:
    // a value the renderer cannot turn into a chip is indistinguishable from unset.
    it('hides a field whose value names an option that no longer exists', () => {
        expect(isChipVisible(makeField(), makeValue('WITHDRAWN'))).toBe(false);
        expect(isChipVisible(makeField({attrs: {visibility: 'always'}}), makeValue('WITHDRAWN'))).toBe(false);
    });

    it('shows a multiselect when at least one entry still resolves', () => {
        const field = makeField({type: 'multiselect'});

        expect(isChipVisible(field, makeValue(['WITHDRAWN', 'SECRET']))).toBe(true);
        expect(isChipVisible(field, makeValue(['WITHDRAWN']))).toBe(false);
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

    // The budget and the renderer must agree on how many chips a field is worth,
    // or `+N` misreports. Both count resolved options, so an unresolvable entry
    // is invisible to both.
    it('budgets a multiselect by its resolvable entries only', () => {
        const attributes = [
            visible(makeField({id: 'a', type: 'multiselect'}), ['SECRET', 'WITHDRAWN', 'INTERNAL', 'RESTRICTED']),
        ];

        const {shown, overflow} = allocateChipBudget(attributes, 2);

        expect(shown[0].maxItems).toBe(2);

        // Three entries resolve, two fit, so one overflows — the deleted option is
        // not counted as a fourth.
        expect(overflow).toBe(1);
    });

    it('leaves a field whose value resolves to nothing out of the row and out of +N', () => {
        const attributes = [
            visible(makeField({id: 'a'}), 'SECRET'),
            visible(makeField({id: 'gone'}), 'WITHDRAWN'),
            visible(makeField({id: 'b'}), 'INTERNAL'),
            visible(makeField({id: 'c'}), 'RESTRICTED'),
        ];

        const {shown, overflow} = allocateChipBudget(attributes, 2);

        expect(shown.map((entry) => entry.field.id)).toEqual(['a', 'b']);

        // Only `c` is unshown. Counting the unresolvable field would say +2 and
        // promise the user an attribute that cannot be displayed anywhere.
        expect(overflow).toBe(1);
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
