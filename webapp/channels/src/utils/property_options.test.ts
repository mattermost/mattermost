// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField, PropertyFieldOption, SelectPropertyField} from '@mattermost/types/properties';

import {hasOptions, resolveOption, resolveOptionChips} from './property_options';

const fieldWith = (options: PropertyFieldOption[]): PropertyField => ({
    id: 'field-1',
    name: 'Classification',
    type: 'select',
    attrs: {options},
} as SelectPropertyField);

describe('resolveOption', () => {
    it('matches on the option id', () => {
        const field = fieldWith([
            {id: 'opt-1', name: 'Secret'},
            {id: 'opt-2', name: 'Unclassified'},
        ]);

        expect(resolveOption(field, 'opt-2')).toEqual({id: 'opt-2', name: 'Unclassified'});
    });

    it('falls back to the option name when no id matches', () => {
        const field = fieldWith([
            {id: 'opt-1', name: 'Secret'},
            {id: 'opt-2', name: 'Unclassified'},
        ]);

        expect(resolveOption(field, 'Unclassified')).toEqual({id: 'opt-2', name: 'Unclassified'});
    });

    it('prefers an id match over a name match on a different option', () => {
        const field = fieldWith([
            {id: 'Secret', name: 'Confidential'},
            {id: 'opt-2', name: 'Secret'},
        ]);

        expect(resolveOption(field, 'Secret')).toEqual({id: 'Secret', name: 'Confidential'});
    });

    it('returns undefined when nothing matches', () => {
        const field = fieldWith([{id: 'opt-1', name: 'Secret'}]);

        expect(resolveOption(field, 'Retired')).toBeUndefined();
    });

    it('returns undefined for an empty option list', () => {
        expect(resolveOption(fieldWith([]), 'Secret')).toBeUndefined();
    });

    it('returns undefined when the field carries no options at all', () => {
        const field = {id: 'field-1', name: 'Notes', type: 'text'} as PropertyField;

        expect(resolveOption(field, 'Secret')).toBeUndefined();
    });

    it('compares strictly, so 0 does not match an empty-string id', () => {
        const field = fieldWith([{id: '', name: ''}]);

        expect(resolveOption(field, 0)).toBeUndefined();
    });
});

describe('hasOptions', () => {
    it('is true for a field with options', () => {
        expect(hasOptions(fieldWith([{id: 'opt-1', name: 'Secret'}]))).toBe(true);
    });

    // Content flagging's `reporting_reason` is a select whose choices live in
    // server config rather than on the field. An empty list and an absent one are
    // not meaningfully distinguishable on the wire, so they answer the same.
    it('is false for an empty list and for no list at all', () => {
        expect(hasOptions(fieldWith([]))).toBe(false);
        expect(hasOptions({id: 'f', name: 'Reason', type: 'select'} as PropertyField)).toBe(false);
    });
});

describe('resolveOptionChips', () => {
    const OPTIONS = [
        {id: 'opt-1', name: 'Secret', color: 'red'},
        {id: 'opt-2', name: 'Unclassified'},
    ];

    const field = fieldWith(OPTIONS);

    // Multi-entry behaviour has to be exercised on a multiselect: a select is
    // capped at one chip by design, so the same assertions on a select field would
    // only be re-testing the cap.
    const multiField = {...fieldWith(OPTIONS), type: 'multiselect'} as PropertyField;

    describe('when the field defines options', () => {
        it('resolves every entry of an array, carrying the option colour', () => {
            expect(resolveOptionChips(multiField, ['opt-1', 'opt-2'])).toEqual([
                {key: 'opt-1', label: 'Secret', color: 'red'},
                {key: 'opt-2', label: 'Unclassified', color: undefined},
            ]);
        });

        it('resolves a bare scalar as a single chip', () => {
            expect(resolveOptionChips(field, 'opt-2')).toEqual([{key: 'opt-2', label: 'Unclassified', color: undefined}]);
        });

        // The chip *is* the option, so a value naming an option that no longer
        // exists has nothing to render. Dropping rather than substituting is also
        // what keeps the budget honest: chips returned == chips rendered.
        it('drops an entry that matches no option', () => {
            expect(resolveOptionChips(multiField, ['opt-1', 'deleted', 'opt-2']).map((chip) => chip.label)).
                toEqual(['Secret', 'Unclassified']);
        });

        it('returns nothing when no entry resolves', () => {
            expect(resolveOptionChips(field, ['deleted', 'also-gone'])).toEqual([]);
            expect(resolveOptionChips(multiField, ['deleted', 'also-gone'])).toEqual([]);
        });

        it('resolves by name as well as by id', () => {
            expect(resolveOptionChips(multiField, ['Secret', 'opt-2']).map((chip) => chip.label)).
                toEqual(['Secret', 'Unclassified']);
        });

        it('keeps a repeated entry once per occurrence', () => {
            expect(resolveOptionChips(multiField, ['opt-1', 'opt-1']).map((chip) => chip.label)).
                toEqual(['Secret', 'Secret']);
        });
    });

    // Content flagging's `reporting_reason` is a select with no options: the
    // choices are validated against server config and the chosen string is stored
    // straight onto the value. Nothing has been deleted, so the string is the
    // content and it renders uncoloured. Dropping it would blank a shipped chip.
    describe('when the field defines no options', () => {
        const optionless = fieldWith([]);

        it('renders the stored string as its own uncoloured chip', () => {
            expect(resolveOptionChips(optionless, 'Classification mismatch')).
                toEqual([{key: 'Classification mismatch', label: 'Classification mismatch'}]);
        });

        it('renders one chip per entry of an array', () => {
            const optionlessMulti = {id: 'f', name: 'Tags', type: 'multiselect'} as PropertyField;

            expect(resolveOptionChips(optionlessMulti, ['one', 'two']).map((chip) => chip.label)).toEqual(['one', 'two']);
        });

        it('stringifies a non-string entry, including the falsy ones', () => {
            const optionlessMulti = {id: 'f', name: 'Tags', type: 'multiselect'} as PropertyField;

            expect(resolveOptionChips(optionlessMulti, [0, false]).map((chip) => chip.label)).toEqual(['0', 'false']);
        });

        it('drops null, undefined and empty entries rather than labelling them', () => {
            expect(resolveOptionChips(optionless, [null, 'kept', undefined, ''])).
                toEqual([{key: 'kept', label: 'kept'}]);
        });

        // The cap takes the first *labelled* chip, so a leading null does not
        // consume the single slot a select gets.
        it('takes the first labellable entry when a select leads with null', () => {
            expect(resolveOptionChips(optionless, [null, 'kept'])).toEqual([{key: 'kept', label: 'kept'}]);
        });
    });

    // Arity belongs to the field type, not to the renderer that happens to draw
    // the chips.
    describe('arity', () => {
        const options = [
            {id: 'opt-1', name: 'Secret'},
            {id: 'opt-2', name: 'Unclassified'},
        ];

        it.each([
            ['select', 'select'],
            ['rank', 'rank'],
        ])('caps a %s field at one chip even when the value is an array', (_label, type) => {
            const field = {...fieldWith(options), type} as PropertyField;

            expect(resolveOptionChips(field, ['opt-1', 'opt-2'])).toEqual([
                {key: 'opt-1', label: 'Secret', color: undefined},
            ]);
        });

        it('renders every entry of a multiselect', () => {
            const field = {...fieldWith(options), type: 'multiselect'} as PropertyField;

            expect(resolveOptionChips(field, ['opt-1', 'opt-2'])).toHaveLength(2);
        });

        // Same cap on the option-less path, or content flagging's single-valued
        // reason could fan out into several chips on malformed data.
        it('caps a select field with no options at one chip too', () => {
            const field = {id: 'f', name: 'Reason', type: 'select'} as PropertyField;

            expect(resolveOptionChips(field, ['first', 'second'])).toEqual([{key: 'first', label: 'first'}]);
        });

        // The cap is on what renders, so it must not resurrect a dropped entry:
        // the first *resolvable* option is the one chip, not the first entry.
        it('takes the first resolvable option, not the first stored entry', () => {
            const field = {...fieldWith(options), type: 'select'} as PropertyField;

            expect(resolveOptionChips(field, ['deleted', 'opt-2'])).toEqual([
                {key: 'opt-2', label: 'Unclassified', color: undefined},
            ]);
        });
    });

    it.each([
        ['null', null],
        ['undefined', undefined],
        ['an empty string', ''],
        ['an empty array', []],
    ])('returns nothing for %s, with or without options', (_label, raw) => {
        expect(resolveOptionChips(field, raw)).toEqual([]);
        expect(resolveOptionChips(fieldWith([]), raw)).toEqual([]);
    });
});
