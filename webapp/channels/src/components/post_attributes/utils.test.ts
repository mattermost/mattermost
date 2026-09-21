// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {renderHook} from '@testing-library/react';

import type {FieldType, PropertyField, PropertyValue} from '@mattermost/types/properties';

import type {PostAttribute} from './utils';
import {
    allocateChipBudget,
    chipCount,
    hasValue,
    hasValueControl,
    isChipVisible,
    useAddableAttributes,
    useModalAttributes,
} from './utils';

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

function visible(field: PropertyField, value: unknown): PostAttribute {
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

    it('is zero for a set date field, which has no renderer', () => {
        expect(chipCount(makeField({type: 'date' as FieldType}), makeValue(1642694400000))).toBe(0);
    });

    /*
     * One slot per stored id, where the option branch counts only the entries
     * that still resolve. The asymmetry is deliberate: an option resolves
     * synchronously against the field, a user id does not, so a count taken now
     * cannot tell a deleted user from one whose profile has not arrived.
     */
    it('counts every stored entry of a multiuser, whether or not the user resolves', () => {
        const field = makeField({type: 'multiuser' as FieldType});

        expect(chipCount(field, makeValue(['user_1', 'user_2', 'user_3']))).toBe(3);
        expect(chipCount(field, makeValue(['user_1']))).toBe(1);

        // No profile fixture is loaded here at all, so all three ids are
        // unresolvable — and all three still count.
        expect(chipCount(field, makeValue(['nobody_1', 'nobody_2']))).toBe(2);

        // A bare value normalises to a one-entry list; an empty one is unset.
        expect(chipCount(field, makeValue('user_1'))).toBe(1);
        expect(chipCount(field, makeValue([]))).toBe(0);
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

    it('hides a set date field, which has no renderer', () => {
        expect(isChipVisible(makeField({type: 'date' as FieldType}), makeValue(1642694400000))).toBe(false);
        expect(isChipVisible(makeField({type: 'date' as FieldType, attrs: {visibility: 'always'}}), makeValue(1642694400000))).toBe(false);
    });

    it('shows a set multiuser field, which now has a renderer', () => {
        const field = makeField({type: 'multiuser' as FieldType});

        expect(isChipVisible(field, makeValue(['user_1', 'user_2']))).toBe(true);
        expect(isChipVisible(makeField({type: 'multiuser' as FieldType, attrs: {visibility: 'always'}}), makeValue(['user_1']))).toBe(true);

        // Still nothing to show when nothing is stored, and `hidden` still wins.
        expect(isChipVisible(field, makeValue([]))).toBe(false);
        expect(isChipVisible(makeField({type: 'multiuser' as FieldType, attrs: {visibility: 'hidden'}}), makeValue(['user_1']))).toBe(false);
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
        const twelve = Array.from({length: 12}, (_, index) => ({id: `opt_${index}`, name: `OPT_${index}`}));
        const attributes = [visible(
            makeField({id: 'a', type: 'multiselect', attrs: {options: twelve}}),
            twelve.map((option) => option.id),
        )];

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

    it('does not spend a slot on a field whose type has no renderer', () => {
        const attributes = [
            visible(makeField({id: 'a'}), 'SECRET'),
            visible(makeField({id: 'due', type: 'date'}), 1642694400000),
            visible(makeField({id: 'b'}), 'INTERNAL'),
        ];

        const {shown, overflow} = allocateChipBudget(attributes, 2);

        // Both selects fit. Counting the date would push `b` out of a row that had
        // room for it, and draw one visible chip where there should be two.
        expect(shown.map((entry) => entry.field.id)).toEqual(['a', 'b']);
        expect(overflow).toBe(0);
    });

    it('does not let a date inflate the overflow count', () => {
        const attributes = [
            visible(makeField({id: 'a'}), 'SECRET'),
            visible(makeField({id: 'b'}), 'INTERNAL'),
            visible(makeField({id: 'due', type: 'date'}), 1642694400000),
        ];

        const {shown, overflow} = allocateChipBudget(attributes, 2);

        expect(shown.map((entry) => entry.field.id)).toEqual(['a', 'b']);

        // Not +1: that one would promise a chip that can never be rendered.
        expect(overflow).toBe(0);
    });

    // The inverted half. Five users past a spent budget are five chips the user
    // cannot see, so `+N` has to say five — one slot per user, the same arity
    // `multiselect` has.
    it('counts every user of an unshown multiuser into the overflow', () => {
        const attributes = [
            visible(makeField({id: 'a'}), 'SECRET'),
            visible(makeField({id: 'b'}), 'INTERNAL'),
            visible(makeField({id: 'reviewers', type: 'multiuser'}), ['u1', 'u2', 'u3', 'u4', 'u5']),
        ];

        const {shown, overflow} = allocateChipBudget(attributes, 2);

        expect(shown.map((entry) => entry.field.id)).toEqual(['a', 'b']);
        expect(overflow).toBe(5);
    });

    // Without `multiuser` in `MULTI_VALUED_TYPES` the allocation carries no
    // `maxItems`, and the renderer would draw all three users inside the one
    // slot the budget paid for.
    it('caps a multiuser that only half fits and counts the rest as overflow', () => {
        const attributes = [
            visible(makeField({id: 'a'}), 'SECRET'),
            visible(makeField({id: 'reviewers', type: 'multiuser'}), ['u1', 'u2', 'u3']),
        ];

        const {shown, overflow} = allocateChipBudget(attributes, 2);

        expect(shown.map((entry) => entry.field.id)).toEqual(['a', 'reviewers']);
        expect(shown.map((entry) => entry.maxItems)).toEqual([undefined, 1]);
        expect(overflow).toBe(2);
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

describe('hasValueControl', () => {
    it.each([
        'select',
        'rank',
        'multiselect',
        'text',
        'user',
        'multiuser',
    ])('has a control for %s', (type) => {
        expect(hasValueControl(makeField({type: type as FieldType}))).toBe(true);
    });

    // The tripwire for whoever adds a date control: this test and
    // `UNRENDERABLE_TYPES`'s three go together, and the picker starts offering
    // `date` the moment this one is updated.
    it('has no control for date', () => {
        expect(hasValueControl(makeField({type: 'date' as FieldType}))).toBe(false);
    });
});

const ADDED_NONE: ReadonlySet<string> = new Set();

// Hoisted because the hooks memoise on the identity of what they are given: a
// `[]` written at the call site is a new array every render, which would make
// the reference-stability tests below assert nothing.
const NO_VALUES: Array<PropertyValue<unknown>> = [];

// Always writable. The two hooks disagreeing about permissions has its own tests
// below; everywhere else it would only be noise.
const ALWAYS_EDITABLE = () => true;

describe('useModalAttributes', () => {
    /*
     * The no-regression case, and the one that catches a `new Set()` default:
     * a default constructed per call is a fresh reference every render, which
     * defeats the `useMemo` for every caller that tracks no added rows — and
     * that is every caller but the modal.
     */
    it('with nothing added, returns what an explicitly empty set returns, stably', () => {
        const fields = [
            makeField({id: 'set', name: 'set'}),
            makeField({id: 'unset', name: 'unset'}),
        ];
        const values = [makeValue('SECRET', 'set')];

        const implicit = renderHook(() => useModalAttributes(fields, values));
        const explicit = renderHook(() => useModalAttributes(fields, values, ADDED_NONE));

        expect(implicit.result.current.map((entry) => entry.field.id)).toEqual(['set']);
        expect(explicit.result.current).toEqual(implicit.result.current);

        const first = implicit.result.current;
        implicit.rerender();
        expect(implicit.result.current).toBe(first);
    });

    // The row lands where `zipAttributes` puts it, which is field order — so it
    // can appear *above* the button that added it. The fixture sorts the added
    // field first on purpose: appending would pass a fixture that sorted it last.
    it('gives an added field a row with no value, in field order', () => {
        const fields = [
            makeField({id: 'added', name: 'added'}),
            makeField({id: 'set', name: 'set'}),
        ];
        const values = [makeValue('SECRET', 'set')];

        const {result} = renderHook(() => useModalAttributes(fields, values, new Set(['added'])));

        expect(result.current.map((entry) => entry.field.id)).toEqual(['added', 'set']);
        expect(result.current[0].value).toBeUndefined();
    });

    // The predicate is an `||`, which makes this obvious in the source and not at
    // all obvious in a fixture where the added field is also `always`.
    it('gives a field that is both visible and added exactly one row', () => {
        const fields = [makeField({id: 'always', name: 'always', attrs: {visibility: 'always'}})];

        const {result} = renderHook(() => useModalAttributes(fields, NO_VALUES, new Set(['always'])));

        expect(result.current).toHaveLength(1);
    });

    /*
     * `hidden` is a rule about the message list and the hover card, not about the
     * modal: the server sends these fields and their values to every client that
     * can read the post, so keeping them out of the edit surface would hide them
     * from the one person who could change them. Set, or asked for, they get a
     * row — and still no chip.
     */
    it('gives a hidden field a row once it is set, and when it is added', () => {
        const fields = [makeField({id: 'secret', name: 'secret', attrs: {visibility: 'hidden'}})];

        const set = renderHook(() => useModalAttributes(fields, [makeValue('SECRET', 'secret')]));
        expect(set.result.current.map((entry) => entry.field.id)).toEqual(['secret']);

        const added = renderHook(() => useModalAttributes(fields, NO_VALUES, new Set(['secret'])));
        expect(added.result.current.map((entry) => entry.field.id)).toEqual(['secret']);

        // Unset and not asked for, it waits for a value like any `when_set` field.
        const untouched = renderHook(() => useModalAttributes(fields, NO_VALUES, ADDED_NONE));
        expect(untouched.result.current).toEqual([]);

        // And it still earns no chip — that is what `hidden` decides.
        expect(isChipVisible(fields[0], makeValue('SECRET', 'secret'))).toBe(false);
    });

    it('returns the same array across renders with unchanged inputs', () => {
        const fields = [makeField({id: 'set', name: 'set'})];
        const values = [makeValue('SECRET', 'set')];
        const added: ReadonlySet<string> = new Set(['other']);

        const {result, rerender} = renderHook(() => useModalAttributes(fields, values, added));

        const first = result.current;
        rerender();

        expect(result.current).toBe(first);
    });
});

describe('useAddableAttributes', () => {
    /*
     * The single test that carries D20. One fixture holding every exclusion —
     * already set, locked, no control, already added — and two fields that
     * survive all of them, one of them `hidden`. If only one of this suite's
     * tests survives review, keep this one.
     */
    it('offers the fields that are unset, writable and not already added, hidden ones included', () => {
        const fields = [
            makeField({id: 'set', name: 'set'}),
            makeField({id: 'secret', name: 'secret', attrs: {visibility: 'hidden'}}),
            makeField({id: 'locked', name: 'locked'}),
            makeField({id: 'dated', name: 'dated', type: 'date' as FieldType}),
            makeField({id: 'added', name: 'added'}),
            makeField({id: 'open', name: 'open'}),
        ];
        const values = [makeValue('SECRET', 'set')];
        const canEdit = (field: PropertyField) => field.id !== 'locked';

        const {result} = renderHook(() => useAddableAttributes(fields, values, new Set(['added']), canEdit));

        // `secret` is offered: `visibility` decides where an attribute is
        // advertised, not who may set it. Setting it yields a value with no chip.
        expect(result.current.map((field) => field.id)).toEqual(['secret', 'open']);
    });

    // A hidden field that is already set is a row, so the picker must not offer
    // it a second time. The same "not already showing" rule as every other field.
    it('stops offering a hidden field once it has a value', () => {
        const fields = [makeField({id: 'secret', name: 'secret', attrs: {visibility: 'hidden'}})];

        const {result} = renderHook(() => useAddableAttributes(fields, [makeValue('SECRET', 'secret')], ADDED_NONE, ALWAYS_EDITABLE));

        expect(result.current).toEqual([]);
    });

    /*
     * D17 and D20 disagree here by design, and the disagreement is the point: the
     * modal row says "this channel declares this attribute on every post", which
     * is true whether or not this user may write it; the picker offers what the
     * user can act on. Without this, one rule gets refactored into the other and
     * nothing fails.
     */
    it('keeps a locked always field as a modal row while refusing it as a candidate', () => {
        const fields = [makeField({id: 'classification', name: 'classification', attrs: {visibility: 'always'}})];
        const denied = () => false;

        const rows = renderHook(() => useModalAttributes(fields, NO_VALUES, ADDED_NONE));
        const candidates = renderHook(() => useAddableAttributes(fields, NO_VALUES, ADDED_NONE, denied));

        expect(rows.result.current.map((entry) => entry.field.id)).toEqual(['classification']);
        expect(candidates.result.current).toEqual([]);
    });

    // The guard against 14.2 growing its own permission call later: the answer has
    // to come from the function the caller passed, which is the same one the rows
    // use. A second call site is a second chance to drift on an argument, and the
    // drift would be silent — the picker would offer a field whose row is locked.
    it('asks the caller about every field, and obeys the answer', () => {
        const fields = [makeField({id: 'open', name: 'open'})];
        const canEdit = jest.fn().mockReturnValue(false);

        const {result, rerender} = renderHook(() => useAddableAttributes(fields, NO_VALUES, ADDED_NONE, canEdit));

        expect(canEdit).toHaveBeenCalledWith(fields[0]);
        expect(result.current).toEqual([]);

        // Same function reference, so the memo does not recompute and the new
        // answer is not consulted. That is the contract, not a bug — it is why
        // the caller owes a stable `canEdit` and why the modal lifts it into a
        // `useCallback`.
        canEdit.mockReturnValue(true);
        rerender();
        expect(result.current).toEqual([]);

        const relaxed = renderHook(() => useAddableAttributes(fields, NO_VALUES, ADDED_NONE, ALWAYS_EDITABLE));
        expect(relaxed.result.current.map((field) => field.id)).toEqual(['open']);
    });

    // The plain case, easy to lose among the exclusions: a `when_set` field with
    // no value at all is what `+ Add attribute` exists for.
    it('offers an unset when_set field and drops it once it is set', () => {
        const fields = [makeField({id: 'open', name: 'open'})];

        const unset = renderHook(() => useAddableAttributes(fields, NO_VALUES, ADDED_NONE, ALWAYS_EDITABLE));
        expect(unset.result.current.map((field) => field.id)).toEqual(['open']);

        const set = renderHook(() => useAddableAttributes(fields, [makeValue('SECRET', 'open')], ADDED_NONE, ALWAYS_EDITABLE));
        expect(set.result.current).toEqual([]);
    });

    // A value naming an option the channel no longer defines renders nothing, so
    // the field reads as unset everywhere else. The picker has to agree, or the
    // attribute becomes unreachable — no chip, no row, and not offered.
    it('offers a field whose only value names a deleted option', () => {
        const fields = [makeField({id: 'open', name: 'open'})];
        const values = [makeValue('WITHDRAWN', 'open')];

        const {result} = renderHook(() => useAddableAttributes(fields, values, ADDED_NONE, ALWAYS_EDITABLE));

        expect(result.current.map((field) => field.id)).toEqual(['open']);
    });

    it('returns the same array across renders with unchanged inputs', () => {
        const fields = [makeField({id: 'open', name: 'open'})];
        const added: ReadonlySet<string> = new Set();

        const {result, rerender} = renderHook(() => useAddableAttributes(fields, NO_VALUES, added, ALWAYS_EDITABLE));

        const first = result.current;
        rerender();

        expect(result.current).toBe(first);
    });
});
