// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, {useState} from 'react';

import type {PropertyField, PropertyFieldOption} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';
import {PROPERTY_TEXT_VALUE_MAX_LENGTH} from 'mattermost-redux/constants/properties';

import {AttributeCombobox} from 'components/property_fields/attribute_combobox';
import {clearPropertyFieldOptionWalks} from 'components/property_fields/graph/page_all_access_control_field_options';
import {clearGraphOptionNameCache} from 'components/property_fields/graph/use_graph_option_names';

import {renderWithContext} from 'tests/react_testing_utils';
import {ZIndex} from 'utils/constants';

import ChannelAttributesForm from './channel_attributes_form';
import type {ChannelAttributeSelection} from './channel_attributes_form';

function field(overrides: Partial<PropertyField> & {id: string; name: string}): PropertyField {
    return {
        group_id: 'group1',
        type: 'select',
        target_id: '',
        target_type: 'system',
        object_type: 'channel',
        create_at: 1,
        update_at: 1,
        delete_at: 0,
        created_by: '',
        updated_by: '',
        ...overrides,
    };
}

const program = field({
    id: 'f_program',
    name: 'program',
    attrs: {display_name: 'Program', options: [{id: 'opt_a', name: 'AURORA'}, {id: 'opt_b', name: 'BOREALIS'}]},
});

const requiredProgram = field({
    id: 'f_program',
    name: 'program',
    attrs: {...program.attrs, required: true},
});

const caveatOptions: PropertyFieldOption[] = [{id: 'opt_a', name: 'NOFORN'}, {id: 'opt_b', name: 'ORCON'}];

const caveats = field({
    id: 'f_caveats',
    name: 'caveats',
    type: 'multiselect',
    attrs: {display_name: 'Caveats', required: true, options: caveatOptions},
});

const level = field({
    id: 'f_rank',
    name: 'rank',
    type: 'rank',
    attrs: {
        display_name: 'Level',
        options: [
            {id: 'l1', name: 'UNCLASSIFIED', rank: 1, color: '#007A33'},
            {id: 'l3', name: 'SECRET', rank: 3, color: '#C8102E'},
            {id: 'l2', name: 'CONFIDENTIAL', rank: 2},
        ],
    },
});

const requiredLevel: PropertyField = {...level, attrs: {...level.attrs, required: true}};

const colouredProgram = field({
    id: 'f_color',
    name: 'color',
    attrs: {display_name: 'Colour', options: [{id: 'opt_a', name: 'AURORA', color: '#1e325c'}, {id: 'opt_b', name: 'BOREALIS'}]},
});

const optional = (f: PropertyField): PropertyField => ({...f, attrs: {...f.attrs, required: false}});

const getChips = () => Array.from(document.querySelectorAll<HTMLElement>('[data-chip]'));
const rowOf = (name: string) => screen.getByTestId(`channelAttributeRow-${name}`);

type HarnessProps = {
    fields: PropertyField[];
    initial?: ChannelAttributeSelection;
    onChange?: (fieldId: string, value: string | string[] | undefined) => void;
    disabled?: boolean;
};

// Applies emits the way the modal's handleAttributeChange does.
function Harness({fields, initial = {}, onChange, disabled}: HarnessProps) {
    const [values, setValues] = useState<ChannelAttributeSelection>(initial);
    return (
        <ChannelAttributesForm
            fields={fields}
            values={values}
            disabled={disabled}
            onChange={(fieldId, value) => {
                onChange?.(fieldId, value);
                setValues((current) => {
                    const next = {...current};
                    if (value === undefined) {
                        Reflect.deleteProperty(next, fieldId);
                    } else {
                        next[fieldId] = value;
                    }
                    return next;
                });
            }}
        />
    );
}

describe('ChannelAttributesForm', () => {
    test('renders nothing when there is no field with a control', () => {
        const {container} = renderWithContext(
            <ChannelAttributesForm
                fields={[field({id: 'f_when', name: 'when', type: 'date'})]}
                values={{}}
                onChange={jest.fn()}
            />,
        );

        expect(container).toBeEmptyDOMElement();
    });

    test('renders nothing at all when there are no fields', () => {
        const {container} = renderWithContext(
            <ChannelAttributesForm
                fields={[]}
                values={{}}
                onChange={jest.fn()}
            />,
        );

        expect(container).toBeEmptyDOMElement();
    });

    test('prefers display_name over the machine name', () => {
        renderWithContext(
            <ChannelAttributesForm
                fields={[program]}
                values={{}}
                onChange={jest.fn()}
            />,
        );

        expect(screen.getByText('Program')).toBeInTheDocument();
        expect(screen.queryByText('program')).not.toBeInTheDocument();
    });

    test('reports the selected option id, not its label', async () => {
        const onChange = jest.fn();
        renderWithContext(
            <ChannelAttributesForm
                fields={[program]}
                values={{}}
                onChange={onChange}
            />,
        );

        await userEvent.click(screen.getByRole('combobox', {name: 'Program'}));
        await userEvent.click(screen.getByRole('option', {name: 'AURORA'}));

        expect(onChange).toHaveBeenCalledWith('f_program', 'opt_a');
    });

    test('reports a multiselect as an array of option ids', async () => {
        const onChange = jest.fn();
        const caveats = field({
            id: 'f_caveats',
            name: 'caveats',
            type: 'multiselect',
            attrs: {options: [{id: 'opt_a', name: 'NOFORN'}, {id: 'opt_b', name: 'ORCON'}]},
        });

        renderWithContext(
            <ChannelAttributesForm
                fields={[caveats]}
                values={{f_caveats: ['opt_a']}}
                onChange={onChange}
            />,
        );

        // The Compass input opens the menu on click even with a chip present.
        await userEvent.click(screen.getByRole('combobox'));
        await userEvent.click(screen.getByRole('option', {name: 'ORCON'}));

        expect(onChange).toHaveBeenCalledWith('f_caveats', ['opt_a', 'opt_b']);
    });

    test('reports undefined when a text value is emptied, so no row is written', async () => {
        const onChange = jest.fn();
        const note = field({id: 'f_note', name: 'note', type: 'text'});

        renderWithContext(
            <ChannelAttributesForm
                fields={[note]}
                values={{f_note: 'x'}}
                onChange={onChange}
            />,
        );

        await userEvent.clear(screen.getByLabelText('note'));

        expect(onChange).toHaveBeenCalledWith('f_note', undefined);
    });

    test('names a select control with its field label, not the shared placeholder', () => {
        renderWithContext(
            <ChannelAttributesForm
                fields={[program]}
                values={{}}
                onChange={jest.fn()}
            />,
        );

        expect(screen.getByRole('combobox', {name: 'Program'})).toBeInTheDocument();
    });

    test('caps a text value at the length the server accepts', () => {
        const note = field({id: 'f_note', name: 'note', type: 'text'});

        renderWithContext(
            <ChannelAttributesForm
                fields={[note]}
                values={{}}
                onChange={jest.fn()}
            />,
        );

        expect(screen.getByLabelText('note')).toHaveAttribute('maxLength', String(PROPERTY_TEXT_VALUE_MAX_LENGTH));
    });

    test('puts the id and test id on the input and links the label', async () => {
        renderWithContext(
            <ChannelAttributesForm
                fields={[program]}
                values={{}}
                onChange={jest.fn()}
            />,
        );

        const input = screen.getByRole('combobox', {name: 'Program'});
        expect(input).toHaveAttribute('id', 'channelAttribute-f_program');
        expect(input).toHaveAttribute('data-testid', 'channelAttribute-program');

        const label = screen.getByText('Program').closest('label');
        expect(label).not.toBeNull();
        expect(label).toHaveAttribute('for', 'channelAttribute-f_program');

        await userEvent.click(label!);
        expect(input).toHaveFocus();

        await userEvent.click(input);
        expect(screen.getByRole('listbox')).toHaveAttribute('id', 'channelAttribute-f_program-listbox');
    });

    test('keeps a span label for text fields', () => {
        renderWithContext(
            <ChannelAttributesForm
                fields={[field({id: 'f_note', name: 'note', type: 'text'})]}
                values={{}}
                onChange={jest.fn()}
            />,
        );

        // The Input widget renders its own legend label, so only the form's label is checked.
        expect(rowOf('note').querySelector('.channel-attributes-form__label')?.tagName).toBe('SPAN');
    });

    test('portals the menu above the modal', async () => {
        renderWithContext(
            <ChannelAttributesForm
                fields={[program]}
                values={{}}
                onChange={jest.fn()}
            />,
        );

        await userEvent.click(screen.getByRole('combobox', {name: 'Program'}));

        let layer: HTMLElement | null = screen.getByRole('listbox');
        while (layer && !layer.style.zIndex) {
            layer = layer.parentElement;
        }
        expect(layer?.style.zIndex).toBe(String(ZIndex.MENU));
    });

    test('lists a rank field highest first with a badge or swatch and no rank text', async () => {
        const onChange = jest.fn();
        renderWithContext(
            <ChannelAttributesForm
                fields={[level]}
                values={{}}
                onChange={onChange}
            />,
        );

        await userEvent.click(screen.getByRole('combobox', {name: 'Level'}));

        expect(screen.getAllByRole('option').map((o) => o.id)).toEqual([
            'channelAttribute-f_rank-listbox-option-l3',
            'channelAttribute-f_rank-listbox-option-l2',
            'channelAttribute-f_rank-listbox-option-l1',
        ]);

        const secret = within(screen.getByTestId('channelAttribute-rank-option-l3'));
        expect(secret.getByTestId('attribute-option-swatch')).toBeInTheDocument();
        expect(secret.queryByTestId('rank-badge')).not.toBeInTheDocument();
        expect(within(screen.getByTestId('channelAttribute-rank-option-l2')).getByTestId('rank-badge')).toHaveTextContent('2');
        for (const id of ['l3', 'l2', 'l1']) {
            expect(screen.getByTestId(`channelAttribute-rank-option-${id}`)).not.toHaveTextContent(/Rank/);
        }

        await userEvent.click(screen.getByRole('option', {name: 'SECRET'}));
        expect(onChange).toHaveBeenCalledWith('f_rank', 'l3');
    });

    test('shows a swatch for a coloured select in rows and the closed field', async () => {
        const {container} = renderWithContext(
            <ChannelAttributesForm
                fields={[colouredProgram]}
                values={{f_color: 'opt_a'}}
                onChange={jest.fn()}
            />,
        );

        expect(within(container).getByTestId('attribute-option-swatch')).toHaveStyle({backgroundColor: 'rgb(30, 50, 92)'});

        await userEvent.click(screen.getByRole('combobox', {name: 'Colour'}));

        expect(within(screen.getByTestId('channelAttribute-color-option-opt_a')).getByTestId('attribute-option-swatch')).toBeInTheDocument();
        expect(within(screen.getByTestId('channelAttribute-color-option-opt_b')).getByTestId('attribute-option-visual-placeholder')).toBeInTheDocument();
    });

    test('shows no swatch for a coloured multiselect', async () => {
        const tags = field({
            id: 'f_tags',
            name: 'tags',
            type: 'multiselect',
            attrs: {display_name: 'Tags', options: [{id: 'opt_a', name: 'NOFORN', color: '#1e325c'}, {id: 'opt_b', name: 'ORCON'}]},
        });
        renderWithContext(
            <ChannelAttributesForm
                fields={[tags]}
                values={{f_tags: ['opt_a']}}
                onChange={jest.fn()}
            />,
        );

        expect(screen.queryByTestId('attribute-option-swatch')).not.toBeInTheDocument();
        expect(screen.queryByTestId('attribute-option-visual-placeholder')).not.toBeInTheDocument();

        await userEvent.click(screen.getByRole('combobox', {name: 'Tags'}));

        expect(screen.queryByTestId('attribute-option-swatch')).not.toBeInTheDocument();
        expect(screen.queryByTestId('attribute-option-visual-placeholder')).not.toBeInTheDocument();
        expect(within(screen.getByRole('toolbar', {name: 'Tags selections'})).getAllByRole('button').map((c) => c.textContent)).toEqual(['NOFORN']);
    });

    test('marks required comboboxes aria-required and leaves optional ones unmarked', () => {
        const requiredFields = [requiredProgram, caveats, requiredLevel];
        const {unmount} = renderWithContext(
            <ChannelAttributesForm
                fields={requiredFields}
                values={{}}
                onChange={jest.fn()}
            />,
        );

        for (const name of ['Program', 'Caveats', 'Level']) {
            expect(screen.getByRole('combobox', {name})).toHaveAttribute('aria-required', 'true');
        }
        unmount();

        renderWithContext(
            <ChannelAttributesForm
                fields={requiredFields.map(optional)}
                values={{}}
                onChange={jest.fn()}
            />,
        );

        for (const name of ['Program', 'Caveats', 'Level']) {
            expect(screen.getByRole('combobox', {name})).not.toHaveAttribute('aria-required');
        }
    });

    test('shows the required error after blur on an empty field', async () => {
        const user = userEvent.setup();
        renderWithContext(<Harness fields={[requiredProgram]}/>);

        const combobox = screen.getByRole('combobox', {name: 'Program'});
        expect(within(rowOf('program')).queryByRole('alert')).not.toBeInTheDocument();
        expect(combobox).not.toHaveAttribute('aria-invalid');

        await user.click(combobox);
        await user.tab();

        const alert = within(rowOf('program')).getByRole('alert');
        expect(alert).toHaveTextContent('This field is required');
        expect(alert).toHaveAttribute('id', 'channelAttribute-f_program-error');
        expect(combobox).toHaveAttribute('aria-invalid', 'true');
        expect(combobox).toHaveAccessibleDescription('This field is required');
        expect(rowOf('program')).toHaveClass('channel-attributes-form__row--error');

        await user.click(combobox);
        await user.click(screen.getByRole('option', {name: 'AURORA'}));

        expect(within(rowOf('program')).queryByRole('alert')).not.toBeInTheDocument();
        expect(combobox).not.toHaveAttribute('aria-invalid');
        expect(combobox).not.toHaveAttribute('aria-describedby');
        expect(rowOf('program')).not.toHaveClass('channel-attributes-form__row--error');
    });

    test('shows the required error after blur on an empty required rank field', async () => {
        const user = userEvent.setup();
        renderWithContext(<Harness fields={[requiredLevel]}/>);

        const combobox = screen.getByRole('combobox', {name: 'Level'});
        expect(within(rowOf('rank')).queryByRole('alert')).not.toBeInTheDocument();

        await user.click(combobox);
        await user.tab();

        expect(within(rowOf('rank')).getByRole('alert')).toHaveTextContent('This field is required');
        expect(combobox).toHaveAttribute('aria-invalid', 'true');
        expect(combobox).toHaveAccessibleDescription('This field is required');
    });

    test('hides the required marker from assistive technology', () => {
        renderWithContext(
            <ChannelAttributesForm
                fields={[requiredProgram, field({id: 'f_note', name: 'note', type: 'text', attrs: {required: true}})]}
                values={{}}
                onChange={jest.fn()}
            />,
        );

        for (const name of ['program', 'note']) {
            const marker = within(rowOf(name)).getByText('*');
            expect(marker).toHaveAttribute('aria-hidden', 'true');
        }
    });

    test('does not show an error before the field is touched or for an optional field', async () => {
        const user = userEvent.setup();
        const other = optional(field({id: 'f_other', name: 'other', attrs: {display_name: 'Other', options: [{id: 'opt_a', name: 'AURORA'}]}}));
        renderWithContext(<Harness fields={[requiredProgram, other]}/>);

        expect(screen.queryByRole('alert')).not.toBeInTheDocument();

        await user.click(screen.getByRole('combobox', {name: 'Other'}));
        await user.tab();

        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(screen.getByRole('combobox', {name: 'Other'})).not.toHaveAttribute('aria-invalid');
    });

    test('does not flash the error when focus moves from a filled field to the clear button', async () => {
        const user = userEvent.setup();
        const onChange = jest.fn();
        renderWithContext(
            <Harness
                fields={[requiredProgram]}
                initial={{f_program: 'opt_a'}}
                onChange={onChange}
            />,
        );

        const combobox = screen.getByRole('combobox', {name: 'Program'});
        expect(combobox).toHaveValue('AURORA');

        await user.click(combobox);
        await user.tab();

        expect(screen.getByTestId('channelAttribute-program-clear')).toHaveFocus();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();

        await user.keyboard('{Enter}');

        expect(onChange).toHaveBeenCalledWith('f_program', undefined);
        expect(within(rowOf('program')).getByRole('alert')).toBeInTheDocument();
        expect(combobox).toHaveFocus();
    });

    test('shows the required error right after clearing a select, even if it never had focus', async () => {
        const onChange = jest.fn();
        renderWithContext(
            <Harness
                fields={[requiredProgram]}
                initial={{f_program: 'opt_a'}}
                onChange={onChange}
            />,
        );

        expect(screen.queryByRole('alert')).not.toBeInTheDocument();

        await userEvent.click(screen.getByTestId('channelAttribute-program-clear'));

        expect(onChange).toHaveBeenCalledWith('f_program', undefined);
        expect(within(rowOf('program')).getByRole('alert')).toBeInTheDocument();
        expect(screen.getByRole('combobox', {name: 'Program'})).toHaveValue('');
    });

    test('shows the required error after removing the last chip', async () => {
        const onChange = jest.fn();
        renderWithContext(
            <Harness
                fields={[caveats]}
                initial={{f_caveats: ['opt_a']}}
                onChange={onChange}
            />,
        );

        await userEvent.click(getChips()[0].querySelector<HTMLElement>('[data-chip-remove]')!);

        expect(onChange).toHaveBeenCalledWith('f_caveats', undefined);
        expect(within(rowOf('caveats')).getByRole('alert')).toBeInTheDocument();
        expect(getChips()).toHaveLength(0);
        expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
    });

    test('maps an emptied multiselect to undefined but keeps a partial one as an array', async () => {
        const onChange = jest.fn();
        renderWithContext(
            <Harness
                fields={[caveats]}
                initial={{f_caveats: ['opt_a', 'opt_b']}}
                onChange={onChange}
            />,
        );

        await userEvent.click(getChips()[0].querySelector<HTMLElement>('[data-chip-remove]')!);

        expect(onChange).toHaveBeenLastCalledWith('f_caveats', ['opt_b']);
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    test('disables the combobox with the form', () => {
        renderWithContext(
            <ChannelAttributesForm
                fields={[program]}
                values={{f_program: 'opt_a'}}
                onChange={jest.fn()}
                disabled={true}
            />,
        );

        expect(screen.getByRole('combobox', {name: 'Program'})).toBeDisabled();
        expect(screen.queryByTestId('channelAttribute-program-clear')).not.toBeInTheDocument();
    });

    describe('Enter on a chip', () => {
        const caveatsRow = (
            <Harness
                fields={[caveats]}
                initial={{f_caveats: ['opt_a', 'opt_b']}}
            />
        );

        async function focusFirstChip(user: ReturnType<typeof userEvent.setup>) {
            await user.click(screen.getByRole('combobox', {name: 'Caveats'}));
            await user.keyboard('{Escape}');
            await user.tab({shift: true});
            expect(document.activeElement).toHaveAttribute('data-chip');
        }

        test('removes the chip without reaching a parent key handler', async () => {
            const user = userEvent.setup();
            const keys: string[] = [];
            renderWithContext(
                <div
                    role='presentation'
                    onKeyDown={(e) => keys.push(e.key)}
                >
                    {caveatsRow}
                </div>,
            );

            await focusFirstChip(user);
            await user.keyboard('{Enter}');

            expect(getChips()).toHaveLength(1);
            expect(keys).not.toContain('Enter');
        });

        test('still lets Enter from the closed input reach a parent key handler', async () => {
            const user = userEvent.setup();
            const keys: string[] = [];
            renderWithContext(
                <div
                    role='presentation'
                    onKeyDown={(e) => keys.push(e.key)}
                >
                    {caveatsRow}
                </div>,
            );

            const input = screen.getByRole('combobox', {name: 'Caveats'});
            await user.click(input);
            await user.keyboard('{Escape}');
            expect(input).toHaveAttribute('aria-expanded', 'false');

            await user.keyboard('{Enter}');

            expect(keys).toContain('Enter');
            expect(getChips()).toHaveLength(2);
        });

        // Guards the guard: if Compass starts stopping the key itself, drop both tests.
        test('control: the same Enter reaches a parent when the form guard is absent', async () => {
            const user = userEvent.setup();
            const keys: string[] = [];

            function Bare() {
                const [value, setValue] = useState<string[]>(['opt_a', 'opt_b']);
                return (
                    <AttributeCombobox
                        id='bare'
                        label='Caveats'
                        multiple={true}
                        options={caveatOptions}
                        value={value}
                        onChange={(next) => setValue(next as string[])}
                    />
                );
            }

            renderWithContext(
                <div
                    role='presentation'
                    onKeyDown={(e) => keys.push(e.key)}
                >
                    <Bare/>
                </div>,
            );

            await focusFirstChip(user);
            await user.keyboard('{Enter}');

            expect(keys).toContain('Enter');
        });
    });

    test('renders a select with no options without crashing', async () => {
        renderWithContext(
            <ChannelAttributesForm
                fields={[field({id: 'f_empty', name: 'empty', attrs: {display_name: 'Empty'}})]}
                values={{}}
                onChange={jest.fn()}
            />,
        );

        await userEvent.click(screen.getByRole('combobox', {name: 'Empty'}));

        expect(screen.getByText('No results')).toBeInTheDocument();
    });

    describe('graph attributes', () => {
        const graphProgram = field({
            id: 'f_graph_program',
            name: 'graph_program',
            type: 'graph',
            attrs: {display_name: 'Graph Program'},
        });

        beforeEach(() => {
            // The picker pages the options endpoint and caches the walk and the
            // option names at module level, so both outlive a single test.
            clearPropertyFieldOptionWalks();
            clearGraphOptionNameCache();
            jest.spyOn(Client4, 'getPropertyFieldOptions').mockResolvedValue({
                options: [{id: 'opt_program', name: 'VALUE_PROGRAM', create_at: 1}],
                has_more: false,
            });
        });

        test('renders the picker and reports the picked option id', async () => {
            const onChange = jest.fn();
            renderWithContext(
                <ChannelAttributesForm
                    fields={[graphProgram]}
                    values={{}}
                    onChange={onChange}
                />,
            );

            expect(screen.getByTestId('channelAttributeRow-graph_program')).toBeInTheDocument();

            await userEvent.click(screen.getByTestId('channelAttribute-graph_program'));
            await userEvent.click(await screen.findByRole('menuitemcheckbox', {name: 'VALUE_PROGRAM'}));

            expect(onChange).toHaveBeenCalledWith('f_graph_program', ['opt_program']);
        });

        test('keeps a span label, not a label element', () => {
            renderWithContext(
                <ChannelAttributesForm
                    fields={[graphProgram]}
                    values={{}}
                    onChange={jest.fn()}
                />,
            );

            const row = screen.getByTestId('channelAttributeRow-graph_program');
            expect(row.querySelector('label')).toBeNull();
            expect(row.querySelector('.channel-attributes-form__label')?.tagName).toBe('SPAN');
        });

        test('deselecting the only selected value reports undefined, so no row is written', async () => {
            const onChange = jest.fn();
            renderWithContext(
                <ChannelAttributesForm
                    fields={[graphProgram]}
                    values={{f_graph_program: ['opt_program']}}
                    onChange={onChange}
                />,
            );

            await userEvent.click(screen.getByTestId('channelAttribute-graph_program'));
            const option = await screen.findByRole('menuitemcheckbox', {name: 'VALUE_PROGRAM'});
            expect(option).toHaveAttribute('aria-checked', 'true');

            await userEvent.click(option);

            expect(onChange).toHaveBeenCalledWith('f_graph_program', undefined);
        });
    });
});
