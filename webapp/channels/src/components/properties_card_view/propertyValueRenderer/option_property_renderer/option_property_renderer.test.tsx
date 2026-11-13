// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyField, PropertyValue, SelectPropertyField} from '@mattermost/types/properties';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import OptionPropertyRenderer from './option_property_renderer';

const OPTIONS = [
    {id: 'option1', name: 'option1', color: 'light_blue'},
    {id: 'option2', name: 'option2', color: 'dark_blue'},
    {id: 'option3', name: 'option3', color: 'dark_red'},
    {id: 'option4', name: 'option4', color: 'light_gray'},
];

const NEUTRAL = {
    backgroundColor: 'rgba(var(--center-channel-color-rgb), 0.12)',
    color: 'rgba(var(--center-channel-color-rgb), 1)',
};

const selectField = {
    id: 'test-field',
    name: 'Test Field',
    type: 'select',
    attrs: {editable: true, options: OPTIONS},
} as SelectPropertyField;

const multiselectField = {
    id: 'test-field',
    name: 'Tags',
    type: 'multiselect',
    attrs: {
        options: [
            {id: 'opt-1', name: 'Secret', color: 'red'},
            {id: 'opt-2', name: 'Unclassified', color: 'green'},
            {id: 'opt-3', name: 'Draft', color: 'blue'},
            {id: 'opt-4', name: 'Archived'},
        ],
    },
} as SelectPropertyField;

const valueOf = (value: unknown) => ({value} as PropertyValue<unknown>);

const chipTexts = () => screen.getAllByTestId('select-property').map((chip) => chip.textContent);

describe('OptionPropertyRenderer', () => {
    describe('a single-valued field', () => {
        it.each([
            ['light_blue', 'option1', {backgroundColor: 'var(--sidebar-text-active-border)', color: '#FFF'}],
            ['dark_blue', 'option2', {backgroundColor: 'rgba(var(--sidebar-text-active-border-rgb), 0.92)', color: '#FFF'}],
            ['dark_red', 'option3', {backgroundColor: 'var(--error-text)', color: '#FFF'}],
            ['light_gray', 'option4', NEUTRAL],
        ])('renders the %s option with its colour', (_label, optionId, expected) => {
            renderWithContext(
                <OptionPropertyRenderer
                    field={selectField}
                    value={valueOf(optionId)}
                />,
            );

            const element = screen.getByTestId('select-property');
            expect(element).toHaveTextContent(optionId);
            expect(element).toHaveStyle(expected);
        });

        // A select field on a boards attribute uses the palette, not content
        // flagging's semantic names, and its foreground is derived rather than
        // inherited from the theme — which is what keeps it legible in Onyx.
        it('renders a boards palette colour with a derived foreground', () => {
            const field = {
                ...selectField,
                attrs: {editable: false, options: [{id: 'option1', name: 'option1', color: 'red'}]},
            } as SelectPropertyField;

            renderWithContext(
                <OptionPropertyRenderer
                    field={field}
                    value={valueOf('option1')}
                />,
            );

            expect(screen.getByTestId('select-property')).toHaveStyle({backgroundColor: '#f3a4a0', color: '#000000'});
        });

        // Nothing on the server constrains `option.color`, so a token from another
        // feature's palette can reach this renderer. It falls back and says
        // nothing: the chip is still legible, just grey. No console spy here on
        // purpose — the suite fails on an unexpected warning (tests/setup_jest),
        // so this test passing is what proves the fallback is silent.
        it('falls to neutral when the option colour is not recognised', () => {
            const field = {
                ...selectField,
                attrs: {editable: false, options: [{id: 'option1', name: 'option1', color: 'unknown_color'}]},
            } as SelectPropertyField;

            renderWithContext(
                <OptionPropertyRenderer
                    field={field}
                    value={valueOf('option1')}
                />,
            );

            expect(screen.getByTestId('select-property')).toHaveStyle(NEUTRAL);
        });

        // The id is the durable key, so a value holding an id must resolve to that
        // option even when a *different* option has since taken the old name.
        it('prefers an option id match over a name match on another option', () => {
            const field = {
                ...selectField,
                attrs: {
                    editable: false,
                    options: [
                        {id: 'Secret', name: 'Confidential', color: 'dark_red'},
                        {id: 'option2', name: 'Secret', color: 'light_blue'},
                    ],
                },
            } as SelectPropertyField;

            renderWithContext(
                <OptionPropertyRenderer
                    field={field}
                    value={valueOf('Secret')}
                />,
            );

            const element = screen.getByTestId('select-property');
            expect(element).toHaveTextContent('Confidential');
            expect(element).toHaveStyle({backgroundColor: 'var(--error-text)'});
        });

        // Arity is the field type's, not the value's. The System Console lets an
        // admin switch a field between select and multiselect, so a select can
        // hold an array written while it was a multiselect. Drawing every entry
        // here would blow the post row's two-chip budget from inside one field.
        it('renders exactly one chip for an array value', () => {
            renderWithContext(
                <OptionPropertyRenderer
                    field={selectField}
                    value={valueOf(['option1', 'option2', 'option3'])}
                />,
            );

            expect(chipTexts()).toEqual(['option1']);
        });

        it('renders exactly one chip for a rank field with an array value', () => {
            renderWithContext(
                <OptionPropertyRenderer
                    field={{...selectField, type: 'rank'} as PropertyField}
                    value={valueOf(['option1', 'option2'])}
                />,
            );

            expect(chipTexts()).toEqual(['option1']);
        });
    });

    describe('a multiselect field', () => {
        it('renders one chip per entry of an array value', () => {
            renderWithContext(
                <OptionPropertyRenderer
                    field={multiselectField}
                    value={valueOf(['opt-1', 'opt-2'])}
                />,
            );

            expect(chipTexts()).toEqual(['Secret', 'Unclassified']);
        });

        it('renders a bare scalar as a single chip', () => {
            renderWithContext(
                <OptionPropertyRenderer
                    field={multiselectField}
                    value={valueOf('opt-3')}
                />,
            );

            expect(chipTexts()).toEqual(['Draft']);
        });

        it('resolves entries by option name as well as by id', () => {
            renderWithContext(
                <OptionPropertyRenderer
                    field={multiselectField}
                    value={valueOf(['Secret', 'opt-2'])}
                />,
            );

            expect(chipTexts()).toEqual(['Secret', 'Unclassified']);
        });

        it('colours each chip from its own option', () => {
            renderWithContext(
                <OptionPropertyRenderer
                    field={multiselectField}
                    value={valueOf(['opt-1', 'opt-2'])}
                />,
            );

            const [secret, unclassified] = screen.getAllByTestId('select-property');

            // #f3a4a0 and #c5e6bb, both with the derived black foreground.
            expect(secret).toHaveStyle({backgroundColor: '#f3a4a0', color: '#000000'});
            expect(unclassified).toHaveStyle({backgroundColor: '#c5e6bb', color: '#000000'});
        });

        it('falls to the neutral chip for an option with no colour', () => {
            renderWithContext(
                <OptionPropertyRenderer
                    field={multiselectField}
                    value={valueOf(['opt-4'])}
                />,
            );

            expect(screen.getByTestId('select-property')).toHaveStyle(NEUTRAL);
        });

        it('renders repeated entries rather than collapsing them', () => {
            renderWithContext(
                <OptionPropertyRenderer
                    field={multiselectField}
                    value={valueOf(['opt-1', 'opt-1'])}
                />,
            );

            expect(chipTexts()).toEqual(['Secret', 'Secret']);
        });

        it('truncates to maxItems, keeping the leading entries', () => {
            renderWithContext(
                <OptionPropertyRenderer
                    field={multiselectField}
                    value={valueOf(['opt-1', 'opt-2', 'opt-3'])}
                    maxItems={2}
                />,
            );

            expect(chipTexts()).toEqual(['Secret', 'Unclassified']);
        });

        it('renders every entry when maxItems is not given', () => {
            renderWithContext(
                <OptionPropertyRenderer
                    field={multiselectField}
                    value={valueOf(['opt-1', 'opt-2', 'opt-3'])}
                />,
            );

            expect(chipTexts()).toHaveLength(3);
        });

        // maxItems is a cap on *rendered* chips, and the row's budget counts the
        // same resolved entries. Slicing before dropping the unresolvable ones
        // would spend a slot on an entry that renders nothing: here that would
        // show only Secret.
        it('applies maxItems to the resolved entries, not to the raw list', () => {
            renderWithContext(
                <OptionPropertyRenderer
                    field={multiselectField}
                    value={valueOf(['opt-1', 'Retired', 'opt-2', 'opt-3'])}
                    maxItems={2}
                />,
            );

            expect(chipTexts()).toEqual(['Secret', 'Unclassified']);
        });
    });

    // The chip *is* the option: its text and its colour both come from the option
    // definition. A value naming an option that no longer exists has nothing to
    // render, so it renders nothing rather than falling back to the stored raw
    // text in a neutral chip.
    describe('a value that resolves to no option', () => {
        it('renders nothing when a single-valued field matches none of the options', () => {
            const {container} = renderWithContext(
                <OptionPropertyRenderer
                    field={selectField}
                    value={valueOf('nonexistent_option')}
                />,
            );

            expect(container).toBeEmptyDOMElement();
            expect(screen.queryByText('nonexistent_option')).not.toBeInTheDocument();
        });

        it('skips an entry of a multiselect that matches no option', () => {
            renderWithContext(
                <OptionPropertyRenderer
                    field={multiselectField}
                    value={valueOf(['opt-1', 'Retired'])}
                />,
            );

            expect(chipTexts()).toEqual(['Secret']);
            expect(screen.queryByText('Retired')).not.toBeInTheDocument();
        });

        it('renders nothing when no entry of a multiselect resolves', () => {
            const {container} = renderWithContext(
                <OptionPropertyRenderer
                    field={multiselectField}
                    value={valueOf(['Retired', 'Withdrawn'])}
                />,
            );

            expect(container).toBeEmptyDOMElement();
        });

        it.each([
            ['null', null],
            ['undefined', undefined],
            ['an empty string', ''],
            ['an empty array', []],
        ])('renders nothing for %s', (_label, raw) => {
            const {container} = renderWithContext(
                <OptionPropertyRenderer
                    field={selectField}
                    value={valueOf(raw)}
                />,
            );

            expect(container).toBeEmptyDOMElement();
        });
    });

    // Content flagging's `reporting_reason` is a select that defines no options:
    // the valid reasons are validated against server config
    // (`ContentFlaggingSettings.AdditionalSettings.Reasons`) and the chosen string
    // is stored straight onto the value. Nothing has been deleted here, so the
    // stored string is the content and renders uncoloured.
    describe('a field that defines no options', () => {
        it('renders the stored value when the option list is empty', () => {
            const field = {...selectField, attrs: {editable: false, options: []}} as SelectPropertyField;

            renderWithContext(
                <OptionPropertyRenderer
                    field={field}
                    value={valueOf('Classification mismatch')}
                />,
            );

            const element = screen.getByTestId('select-property');
            expect(element).toHaveTextContent('Classification mismatch');
            expect(element).toHaveStyle(NEUTRAL);
        });

        it('renders the stored value when the field carries no options at all', () => {
            const field = {id: 'test-field', name: 'Test Field', type: 'select'} as PropertyField;

            renderWithContext(
                <OptionPropertyRenderer
                    field={field}
                    value={valueOf('some_value')}
                />,
            );

            expect(screen.getByTestId('select-property')).toHaveTextContent('some_value');
        });

        it('still renders nothing for an unset value', () => {
            const field = {id: 'test-field', name: 'Test Field', type: 'select'} as PropertyField;

            const {container} = renderWithContext(
                <OptionPropertyRenderer
                    field={field}
                    value={valueOf(null)}
                />,
            );

            expect(container).toBeEmptyDOMElement();
        });
    });

    // The chip row is a flex container that budgets chips across fields, so a
    // multi-valued field must contribute its chips as siblings of every other
    // field's. Wrapping them in an element would make the whole field one flex
    // item and break both the wrapping and the two-chip budget.
    it('renders its chips as direct children, with no wrapper element', () => {
        const {container} = renderWithContext(
            <OptionPropertyRenderer
                field={multiselectField}
                value={valueOf(['opt-1', 'opt-2'])}
            />,
        );

        expect(container.childNodes).toHaveLength(2);
        expect(chipTexts()).toEqual(['Secret', 'Unclassified']);
    });
});
