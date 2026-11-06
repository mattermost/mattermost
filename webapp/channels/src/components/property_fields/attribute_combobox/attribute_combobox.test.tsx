// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

import type {PropertyFieldOption} from '@mattermost/types/properties';

import {act, fireEvent, renderWithContext, screen, userEvent, within} from 'tests/react_testing_utils';
import {ZIndex} from 'utils/constants';

import {AttributeCombobox} from './attribute_combobox';
import type {AttributeComboboxProps, AttributeComboboxType} from './attribute_combobox';

const OPTIONS: PropertyFieldOption[] = [
    {id: 'opt3', name: 'Option 3'},
    {id: 'opt1', name: 'Option 1'},
    {id: 'opt2', name: 'Option 2'},
];

const COLOURED: PropertyFieldOption[] = [
    {id: 'red', name: 'Red', color: '#c8102e'},
    {id: 'plain', name: 'Plain', color: ''},
    {id: 'none', name: 'None'},
];

const RANKS: PropertyFieldOption[] = [
    {id: 'low', name: 'Low', rank: 1},
    {id: 'top', name: 'Top', rank: 3},
    {id: 'mid', name: 'Mid', rank: 2, color: '#c8102e'},
    {id: 'zero', name: 'Zero', rank: 0},
];

// A rank option without a rank can't be persisted; this stands in for a stale cache.
const RANKS_WITH_UNRANKED: PropertyFieldOption[] = [
    {id: 'low', name: 'Low', rank: 1},
    {id: 'odd', name: 'Odd'},
    {id: 'top', name: 'Top', rank: 3},
];

const TEST_ID = 'attr';
const SWATCH = 'attribute-option-swatch';
const PLACEHOLDER = 'attribute-option-visual-placeholder';
const BADGE = 'rank-badge';

type ExtraProps = Partial<Pick<AttributeComboboxProps, 'type' | 'options' | 'required' | 'onBlur'>>;

type HarnessProps = ExtraProps & {
    initialValue?: string | string[];
    onChange?: (value: string | string[]) => void;
};

function SingleHarness({initialValue = '', onChange, options = OPTIONS, ...extra}: HarnessProps) {
    const [value, setValue] = useState(initialValue);
    return (
        <AttributeCombobox
            {...extra}
            id='attr-input'
            testId={TEST_ID}
            label='Department'
            options={options}
            value={value}
            onChange={(next) => {
                onChange?.(next);
                setValue(next);
            }}
        />
    );
}

function MultiHarness({initialValue = [], onChange, options = OPTIONS, ...extra}: HarnessProps) {
    const [value, setValue] = useState(initialValue);
    return (
        <AttributeCombobox
            {...extra}
            type='multiselect'
            testId={TEST_ID}
            label='Skills'
            options={options}
            value={value}
            onChange={(next) => {
                onChange?.(next);
                setValue(next);
            }}
        />
    );
}

type FormHarnessProps = {
    type?: AttributeComboboxType;
    initialValue?: string | string[];
    submitOnEnter?: boolean;
    onChange?: (value: string | string[]) => void;
    onSubmit: () => void;
};

function FormHarness({type = 'select', initialValue, submitOnEnter, onChange, onSubmit}: FormHarnessProps) {
    const multiple = type === 'multiselect';
    const [value, setValue] = useState<string | string[]>(initialValue ?? (multiple ? [] : ''));

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                onSubmit();
            }}
        >
            <input
                type='text'
                aria-label='Name'
            />
            <AttributeCombobox
                type={type}
                testId={TEST_ID}
                label={multiple ? 'Skills' : 'Department'}
                options={OPTIONS}
                value={value}
                submitOnEnter={submitOnEnter}
                onChange={(next) => {
                    onChange?.(next);
                    setValue(next);
                }}
            />
            <button type='submit'>{'Save'}</button>
        </form>
    );
}

const getChips = () => Array.from(document.querySelectorAll<HTMLElement>('[data-chip]'));
const getRow = (id: string) => within(screen.getByTestId(`${TEST_ID}-option-${id}`));

const getChipLabels = (label: string) => within(screen.getByRole('toolbar', {name: `${label} selections`})).
    queryAllByRole('button').
    map((chip) => chip.textContent);

describe('AttributeCombobox', () => {
    let documentKeys: string[];
    const onDocumentKeyDown = (e: KeyboardEvent) => documentKeys.push(e.key);

    beforeEach(() => {
        documentKeys = [];
        document.addEventListener('keydown', onDocumentKeyDown);
    });

    afterEach(() => {
        document.removeEventListener('keydown', onDocumentKeyDown);
    });

    test('puts the id and test id on the input and portals the menu at the given z-index', async () => {
        renderWithContext(
            <AttributeCombobox
                id='attr-input'
                testId={TEST_ID}
                label='Department'
                options={OPTIONS}
                value=''
                zIndex={ZIndex.MENU}
                onChange={jest.fn()}
            />,
        );

        const input = screen.getByRole('combobox', {name: 'Department'});
        expect(input).toHaveAttribute('id', 'attr-input');
        expect(input).toHaveAttribute('data-testid', TEST_ID);
        await userEvent.click(input);

        let layer: HTMLElement | null = screen.getByRole('listbox');
        while (layer && !layer.style.zIndex) {
            layer = layer.parentElement;
        }
        expect(layer?.style.zIndex).toBe(String(ZIndex.MENU));
    });

    test('lists options in definition order with per-option test IDs', async () => {
        renderWithContext(<SingleHarness/>);

        await userEvent.click(screen.getByRole('combobox', {name: 'Department'}));

        expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Option 3', 'Option 1', 'Option 2']);
        expect(screen.getByTestId(`${TEST_ID}-option-opt1`)).toHaveAccessibleName('Option 1');
    });

    test('shows the no-results message when there are no options', async () => {
        renderWithContext(
            <AttributeCombobox
                label='Department'
                options={[]}
                value=''
                onChange={jest.fn()}
            />,
        );

        await userEvent.click(screen.getByRole('combobox', {name: 'Department'}));

        expect(screen.queryAllByRole('option')).toHaveLength(0);
        expect(screen.getByText('No results')).toBeInTheDocument();
    });

    describe('single', () => {
        test('renders a present value with its option label and a named clear button', () => {
            renderWithContext(<SingleHarness initialValue='opt2'/>);

            expect(screen.getByRole('combobox', {name: 'Department'})).toHaveValue('Option 2');
            expect(screen.getByTestId(`${TEST_ID}-clear`)).toHaveAccessibleName('Clear Department');
        });

        test('inserts the field name literally into the clear label', () => {
            renderWithContext(
                <AttributeCombobox
                    testId={TEST_ID}
                    label='R&D {team} <b>'
                    options={OPTIONS}
                    value='opt1'
                    onChange={jest.fn()}
                />,
            );

            expect(screen.getByTestId(`${TEST_ID}-clear`)).toHaveAccessibleName('Clear R&D {team} <b>');
        });

        test('renders a value missing from options with its raw id', () => {
            renderWithContext(<SingleHarness initialValue='gone'/>);

            expect(screen.getByRole('combobox', {name: 'Department'})).toHaveValue('gone');
        });

        test('shows the first id of a list', () => {
            renderWithContext(<SingleHarness initialValue={['opt2', 'opt1']}/>);

            expect(screen.getByRole('combobox', {name: 'Department'})).toHaveValue('Option 2');
        });

        test('has no clear button while empty', () => {
            renderWithContext(<SingleHarness/>);

            expect(screen.queryByTestId(`${TEST_ID}-clear`)).not.toBeInTheDocument();
        });

        test('passes the picked id, and an empty string rather than null on clear', async () => {
            const onChange = jest.fn();
            renderWithContext(<SingleHarness onChange={onChange}/>);

            await userEvent.click(screen.getByRole('combobox', {name: 'Department'}));
            await userEvent.click(screen.getByRole('option', {name: 'Option 1'}));
            expect(onChange).toHaveBeenLastCalledWith('opt1');

            await userEvent.click(screen.getByTestId(`${TEST_ID}-clear`));
            expect(onChange).toHaveBeenLastCalledWith('');
        });

        test('Enter that picks an option and Escape that closes the menu do not reach document', async () => {
            const user = userEvent.setup();
            const onChange = jest.fn();
            renderWithContext(<SingleHarness onChange={onChange}/>);
            const input = screen.getByRole('combobox', {name: 'Department'});

            await user.click(input);
            await user.keyboard('{ArrowDown}{Enter}');
            expect(onChange).toHaveBeenLastCalledWith('opt1');

            await user.click(input);
            expect(input).toHaveAttribute('aria-expanded', 'true');
            await user.keyboard('{Escape}');
            expect(input).toHaveAttribute('aria-expanded', 'false');

            expect(documentKeys).not.toContain('Enter');
            expect(documentKeys).not.toContain('Escape');
        });

        test('Enter on the clear button does not reach document', async () => {
            const user = userEvent.setup();
            const onChange = jest.fn();
            renderWithContext(
                <SingleHarness
                    initialValue='opt1'
                    onChange={onChange}
                />,
            );

            act(() => screen.getByTestId(`${TEST_ID}-clear`).focus());
            await user.keyboard('{Enter}');

            expect(onChange).toHaveBeenCalledWith('');
            expect(documentKeys).not.toContain('Enter');
        });

        test('keeps its value and hides the clear button when disabled', () => {
            renderWithContext(
                <AttributeCombobox
                    testId={TEST_ID}
                    label='Department'
                    options={OPTIONS}
                    value='opt1'
                    disabled={true}
                    onChange={jest.fn()}
                />,
            );
            const input = screen.getByRole('combobox', {name: 'Department'});

            expect(input).toBeDisabled();
            expect(input).toHaveValue('Option 1');
            expect(screen.queryByTestId(`${TEST_ID}-clear`)).not.toBeInTheDocument();
        });
    });

    describe('multiple', () => {
        test('renders present values with their option labels and missing values with their raw ids, in value order', () => {
            renderWithContext(<MultiHarness initialValue={['opt2', 'gone', 'opt3']}/>);

            expect(getChipLabels('Skills')).toEqual(['Option 2', 'gone', 'Option 3']);
        });

        test('treats a lone id as a one-item list', () => {
            renderWithContext(
                <AttributeCombobox
                    type='multiselect'
                    label='Skills'
                    options={OPTIONS}
                    value='opt1'
                    onChange={jest.fn()}
                />,
            );

            expect(getChipLabels('Skills')).toEqual(['Option 1']);
        });

        test('has no clear button', () => {
            renderWithContext(<MultiHarness initialValue={['opt1']}/>);

            expect(screen.queryByTestId(`${TEST_ID}-clear`)).not.toBeInTheDocument();
        });

        test('passes the new array on toggle, and an empty array after the last chip is removed', async () => {
            const user = userEvent.setup();
            const onChange = jest.fn();
            renderWithContext(
                <MultiHarness
                    initialValue={['opt1']}
                    onChange={onChange}
                />,
            );

            await user.click(screen.getByRole('combobox', {name: 'Skills'}));
            await user.click(screen.getByRole('option', {name: 'Option 2'}));
            expect(onChange).toHaveBeenLastCalledWith(['opt1', 'opt2']);

            for (const chip of Array.from(document.querySelectorAll<HTMLElement>('[data-chip]'))) {
                // eslint-disable-next-line no-await-in-loop
                await user.click(chip.querySelector<HTMLElement>('[data-chip-remove]')!);
            }
            expect(onChange).toHaveBeenLastCalledWith([]);
        });

        test('Enter that toggles an option does not reach document', async () => {
            const user = userEvent.setup();
            const onChange = jest.fn();
            renderWithContext(<MultiHarness onChange={onChange}/>);

            await user.click(screen.getByRole('combobox', {name: 'Skills'}));
            await user.keyboard('{ArrowDown}{Enter}');

            expect(onChange).toHaveBeenLastCalledWith(['opt1']);
            expect(documentKeys).not.toContain('Enter');
        });

        // Disabled chips lose role="button", so getChipLabels (role-based) would find none.
        test('keeps its chips without remove buttons when disabled', () => {
            renderWithContext(
                <AttributeCombobox
                    type='multiselect'
                    label='Skills'
                    options={OPTIONS}
                    value={['opt1', 'opt2']}
                    disabled={true}
                    onChange={jest.fn()}
                />,
            );

            expect(screen.getByRole('combobox', {name: 'Skills'})).toBeDisabled();
            expect(getChips().map((chip) => chip.textContent)).toEqual(['Option 1', 'Option 2']);
            expect(document.querySelector('[data-chip-remove]')).toBeNull();
        });
    });

    describe('submitOnEnter', () => {
        let onSubmit: jest.Mock;

        beforeEach(() => {
            onSubmit = jest.fn();
        });

        test('Enter on a focused, closed single field does not submit or reach document', async () => {
            const user = userEvent.setup();
            const onChange = jest.fn();
            renderWithContext(
                <FormHarness
                    initialValue='opt1'
                    submitOnEnter={false}
                    onChange={onChange}
                    onSubmit={onSubmit}
                />,
            );
            const input = screen.getByRole('combobox', {name: 'Department'});

            act(() => input.focus());
            expect(input).toHaveAttribute('aria-expanded', 'false');
            await user.keyboard('{Enter}');

            expect(onSubmit).not.toHaveBeenCalled();
            expect(onChange).not.toHaveBeenCalled();
            expect(input).toHaveValue('Option 1');
            expect(documentKeys).not.toContain('Enter');
        });

        test('Enter on a focused, closed multi field with a chip does not submit', async () => {
            const user = userEvent.setup();
            const onChange = jest.fn();
            renderWithContext(
                <FormHarness
                    type='multiselect'
                    initialValue={['opt1']}
                    submitOnEnter={false}
                    onChange={onChange}
                    onSubmit={onSubmit}
                />,
            );
            const input = screen.getByRole('combobox', {name: 'Skills'});

            act(() => input.focus());
            expect(input).toHaveAttribute('aria-expanded', 'false');
            await user.keyboard('{Enter}');

            expect(onSubmit).not.toHaveBeenCalled();
            expect(onChange).not.toHaveBeenCalled();
            expect(getChips()).toHaveLength(1);
        });

        test.each<{type: AttributeComboboxType; label: string}>([
            {type: 'select', label: 'Department'},
            {type: 'multiselect', label: 'Skills'},
        ])('even without the prop, Enter with no matching option does not submit ($type)', async ({type, label}) => {
            const user = userEvent.setup();
            const onChange = jest.fn();
            renderWithContext(
                <FormHarness
                    type={type}
                    onChange={onChange}
                    onSubmit={onSubmit}
                />,
            );
            const input = screen.getByRole('combobox', {name: label});

            await user.click(input);
            await user.keyboard('zzz');
            expect(input).toHaveAttribute('aria-expanded', 'true');
            expect(screen.getByText('No results')).toBeInTheDocument();
            await user.keyboard('{Enter}');

            expect(onSubmit).not.toHaveBeenCalled();
            expect(onChange).not.toHaveBeenCalled();
            expect(documentKeys).not.toContain('Enter');
        });

        // The first ArrowDown opens on row 0 (opt3), the second moves to opt1.
        test.each<{type: AttributeComboboxType; label: string; expected: string | string[]}>([
            {type: 'select', label: 'Department', expected: 'opt1'},
            {type: 'multiselect', label: 'Skills', expected: ['opt1']},
        ])('Enter that picks an option still picks it and does not submit ($type)', async ({type, label, expected}) => {
            const user = userEvent.setup();
            const onChange = jest.fn();
            renderWithContext(
                <FormHarness
                    type={type}
                    submitOnEnter={false}
                    onChange={onChange}
                    onSubmit={onSubmit}
                />,
            );
            const input = screen.getByRole('combobox', {name: label});

            act(() => input.focus());
            await user.keyboard('{ArrowDown}');
            expect(input).toHaveAttribute('aria-expanded', 'true');
            await user.keyboard('{ArrowDown}{Enter}');

            expect(onChange).toHaveBeenLastCalledWith(expected);
            expect(onSubmit).not.toHaveBeenCalled();
            expect(documentKeys).not.toContain('Enter');
        });

        test('Enter in a sibling text input still submits', async () => {
            const user = userEvent.setup();
            renderWithContext(
                <FormHarness
                    initialValue='opt1'
                    submitOnEnter={false}
                    onSubmit={onSubmit}
                />,
            );

            await user.click(screen.getByRole('textbox', {name: 'Name'}));
            await user.keyboard('{Enter}');

            expect(onSubmit).toHaveBeenCalledTimes(1);
        });

        test('Enter after Escape closes the menu does not submit', async () => {
            const user = userEvent.setup();
            const onChange = jest.fn();
            renderWithContext(
                <FormHarness
                    initialValue='opt1'
                    submitOnEnter={false}
                    onChange={onChange}
                    onSubmit={onSubmit}
                />,
            );
            const input = screen.getByRole('combobox', {name: 'Department'});

            await user.click(input);
            await user.keyboard('{Escape}');
            expect(input).toHaveAttribute('aria-expanded', 'false');
            await user.keyboard('{Enter}');

            expect(onSubmit).not.toHaveBeenCalled();
            expect(onChange).not.toHaveBeenCalled();
            expect(input).toHaveValue('Option 1');
            expect(documentKeys).not.toContain('Enter');
        });

        // The default path user settings relies on (SettingItemMax listens on document).
        test.each<{type: AttributeComboboxType; label: string; initialValue: string | string[]}>([
            {type: 'select', label: 'Department', initialValue: 'opt1'},
            {type: 'multiselect', label: 'Skills', initialValue: ['opt1']},
            {type: 'rank', label: 'Department', initialValue: 'opt1'},
        ])('without the prop, Enter on a closed field submits and reaches document ($type)', async ({type, label, initialValue}) => {
            const user = userEvent.setup();
            const onChange = jest.fn();
            renderWithContext(
                <FormHarness
                    type={type}
                    initialValue={initialValue}
                    onChange={onChange}
                    onSubmit={onSubmit}
                />,
            );
            const input = screen.getByRole('combobox', {name: label});

            act(() => input.focus());
            expect(input).toHaveAttribute('aria-expanded', 'false');
            await user.keyboard('{Enter}');

            expect(onSubmit).toHaveBeenCalledTimes(1);
            expect(documentKeys).toContain('Enter');
            expect(onChange).not.toHaveBeenCalled();
        });

        // user-event can't set isComposing, so dispatch directly.
        test('Enter during IME composition is not prevented', () => {
            renderWithContext(
                <FormHarness
                    submitOnEnter={false}
                    onSubmit={onSubmit}
                />,
            );
            const input = screen.getByRole('combobox', {name: 'Department'});

            expect(fireEvent.keyDown(input, {key: 'Enter', isComposing: true})).toBe(true);
            expect(fireEvent.keyDown(input, {key: 'Enter'})).toBe(false);
        });
    });

    describe('inside a form', () => {
        test('clicking the clear button clears without submitting', async () => {
            const user = userEvent.setup();
            const onChange = jest.fn();
            const onSubmit = jest.fn();
            renderWithContext(
                <FormHarness
                    initialValue='opt1'
                    onChange={onChange}
                    onSubmit={onSubmit}
                />,
            );

            await user.click(screen.getByTestId(`${TEST_ID}-clear`));

            expect(onChange).toHaveBeenLastCalledWith('');
            expect(screen.getByRole('combobox', {name: 'Department'})).toHaveValue('');
            expect(onSubmit).not.toHaveBeenCalled();
        });

        test('clicking a chip remove button removes it without submitting', async () => {
            const user = userEvent.setup();
            const onChange = jest.fn();
            const onSubmit = jest.fn();
            renderWithContext(
                <FormHarness
                    type='multiselect'
                    initialValue={['opt1', 'opt2']}
                    onChange={onChange}
                    onSubmit={onSubmit}
                />,
            );

            await user.click(getChips()[0].querySelector<HTMLElement>('[data-chip-remove]')!);

            expect(onChange).toHaveBeenLastCalledWith(['opt2']);
            expect(getChips()).toHaveLength(1);
            expect(onSubmit).not.toHaveBeenCalled();
        });
    });

    describe('option visuals', () => {
        test('a single field shows a swatch only for options with a colour', async () => {
            renderWithContext(<SingleHarness options={COLOURED}/>);

            await userEvent.click(screen.getByRole('combobox', {name: 'Department'}));

            expect(getRow('red').getByTestId(SWATCH)).toHaveStyle({backgroundColor: 'rgb(200, 16, 46)'});
            expect(getRow('plain').queryByTestId(SWATCH)).not.toBeInTheDocument();
            expect(getRow('none').queryByTestId(SWATCH)).not.toBeInTheDocument();
        });

        test('uncoloured rows get a placeholder when any option has a visual', async () => {
            renderWithContext(<SingleHarness options={COLOURED}/>);

            await userEvent.click(screen.getByRole('combobox', {name: 'Department'}));

            expect(getRow('red').queryByTestId(PLACEHOLDER)).not.toBeInTheDocument();
            expect(getRow('plain').getByTestId(PLACEHOLDER)).toBeInTheDocument();
            expect(getRow('none').getByTestId(PLACEHOLDER)).toBeInTheDocument();
        });

        test('rows are unchanged when no option has a colour', async () => {
            renderWithContext(<SingleHarness/>);

            await userEvent.click(screen.getByRole('combobox', {name: 'Department'}));

            expect(screen.queryByTestId(SWATCH)).not.toBeInTheDocument();
            expect(screen.queryByTestId(PLACEHOLDER)).not.toBeInTheDocument();
            expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Option 3', 'Option 1', 'Option 2']);
            expect(screen.getByTestId(`${TEST_ID}-option-opt1`)).toHaveAccessibleName('Option 1');
        });

        test('a multiple field shows no swatch in rows or chips', async () => {
            renderWithContext(
                <MultiHarness
                    options={COLOURED}
                    initialValue={['red']}
                />,
            );

            await userEvent.click(screen.getByRole('combobox', {name: 'Skills'}));

            expect(screen.queryByTestId(SWATCH)).not.toBeInTheDocument();
            expect(screen.queryByTestId(PLACEHOLDER)).not.toBeInTheDocument();
            expect(getChips().map((chip) => chip.textContent)).toEqual(['Red']);
        });

        test('the closed single field shows the committed option\'s swatch', async () => {
            const {container} = renderWithContext(
                <SingleHarness
                    options={COLOURED}
                    initialValue='red'
                />,
            );
            const input = screen.getByRole('combobox', {name: 'Department'});

            expect(within(container).getByTestId(SWATCH)).toBeInTheDocument();

            await userEvent.click(input);
            await userEvent.click(screen.getByRole('option', {name: 'Plain'}));
            expect(within(container).queryByTestId(SWATCH)).not.toBeInTheDocument();

            await userEvent.click(input);
            await userEvent.click(screen.getByRole('option', {name: 'Red'}));
            expect(within(container).getByTestId(SWATCH)).toBeInTheDocument();

            await userEvent.click(screen.getByTestId(`${TEST_ID}-clear`));
            expect(within(container).queryByTestId(SWATCH)).not.toBeInTheDocument();
        });

        test('the closed single field uses the first id of a list for its swatch', () => {
            const {container} = renderWithContext(
                <SingleHarness
                    options={COLOURED}
                    initialValue={['red', 'plain']}
                />,
            );

            expect(within(container).getByTestId(SWATCH)).toBeInTheDocument();
        });

        test.each([
            {name: 'an empty value', initialValue: ''},
            {name: 'a raw id', initialValue: 'ghost'},
        ])('the closed single field has no icon for $name', ({initialValue}) => {
            const {container} = renderWithContext(
                <SingleHarness
                    options={COLOURED}
                    initialValue={initialValue}
                />,
            );

            expect(within(container).queryByTestId(SWATCH)).not.toBeInTheDocument();
        });

        test('the closed multiple field has no icon', () => {
            const {container} = renderWithContext(
                <MultiHarness
                    options={COLOURED}
                    initialValue={['red']}
                />,
            );

            expect(within(container).queryByTestId(SWATCH)).not.toBeInTheDocument();
        });

        test('a disabled single field still shows the swatch', () => {
            const {container} = renderWithContext(
                <AttributeCombobox
                    label='Department'
                    options={COLOURED}
                    value='red'
                    disabled={true}
                    onChange={jest.fn()}
                />,
            );

            expect(within(container).getByTestId(SWATCH)).toBeInTheDocument();
        });

        test('picking a coloured option still reports its id', async () => {
            const onChange = jest.fn();
            renderWithContext(
                <SingleHarness
                    options={COLOURED}
                    onChange={onChange}
                />,
            );

            await userEvent.click(screen.getByRole('combobox', {name: 'Department'}));
            await userEvent.click(screen.getByRole('option', {name: 'Red'}));

            expect(onChange).toHaveBeenLastCalledWith('red');
        });

        test('filtering by label keeps the matching row and its swatch', async () => {
            renderWithContext(<SingleHarness options={COLOURED}/>);

            await userEvent.click(screen.getByRole('combobox', {name: 'Department'}));
            await userEvent.keyboard('Red');

            expect(screen.getAllByRole('option')).toHaveLength(1);
            expect(getRow('red').getByTestId(SWATCH)).toBeInTheDocument();
        });

        test('switching a field from select to multiselect drops its swatches', async () => {
            const renderCombobox = (type: AttributeComboboxType) => (
                <AttributeCombobox
                    type={type}
                    testId={TEST_ID}
                    label='Department'
                    options={COLOURED}
                    value='red'
                    onChange={jest.fn()}
                />
            );
            const {container, rerender} = renderWithContext(renderCombobox('select'));
            expect(within(container).getByTestId(SWATCH)).toBeInTheDocument();

            rerender(renderCombobox('multiselect'));
            expect(within(container).queryByTestId(SWATCH)).not.toBeInTheDocument();

            await userEvent.click(screen.getByRole('combobox', {name: 'Department'}));

            expect(screen.queryByTestId(SWATCH)).not.toBeInTheDocument();
            expect(screen.queryByTestId(PLACEHOLDER)).not.toBeInTheDocument();
            expect(getChips().map((chip) => chip.textContent)).toEqual(['Red']);
        });
    });

    describe('rank', () => {
        const optionIds = () => screen.getAllByRole('option').map((o) => o.id);

        test('lists options highest rank first', async () => {
            renderWithContext(
                <SingleHarness
                    type='rank'
                    options={RANKS}
                />,
            );

            await userEvent.click(screen.getByRole('combobox', {name: 'Department'}));

            expect(optionIds()).toEqual([
                'attr-input-listbox-option-top',
                'attr-input-listbox-option-mid',
                'attr-input-listbox-option-low',
                'attr-input-listbox-option-zero',
            ]);
        });

        test('shows the rank badge for an uncoloured ranked option', async () => {
            renderWithContext(
                <SingleHarness
                    type='rank'
                    options={RANKS}
                />,
            );

            await userEvent.click(screen.getByRole('combobox', {name: 'Department'}));

            expect(getRow('top').getByTestId(BADGE)).toHaveTextContent('3');
            expect(getRow('top').queryByTestId(SWATCH)).not.toBeInTheDocument();
            expect(getRow('low').getByTestId(BADGE)).toHaveTextContent('1');
        });

        test('shows the swatch instead of the badge for a coloured option', async () => {
            renderWithContext(
                <SingleHarness
                    type='rank'
                    options={RANKS}
                />,
            );

            await userEvent.click(screen.getByRole('combobox', {name: 'Department'}));

            expect(getRow('mid').getByTestId(SWATCH)).toHaveStyle({backgroundColor: 'rgb(200, 16, 46)'});
            expect(getRow('mid').queryByTestId(BADGE)).not.toBeInTheDocument();
        });

        test('treats rank 0 as ranked', async () => {
            renderWithContext(
                <SingleHarness
                    type='rank'
                    options={RANKS}
                />,
            );

            await userEvent.click(screen.getByRole('combobox', {name: 'Department'}));

            expect(getRow('zero').getByTestId(BADGE)).toHaveTextContent('0');
            expect(optionIds().at(-1)).toBe('attr-input-listbox-option-zero');
        });

        test('keeps the badge out of the option\'s accessible name', async () => {
            renderWithContext(
                <SingleHarness
                    type='rank'
                    options={RANKS}
                />,
            );

            await userEvent.click(screen.getByRole('combobox', {name: 'Department'}));

            expect(screen.getByTestId(`${TEST_ID}-option-top`)).toHaveAccessibleName('Top');
            expect(getRow('top').getByTestId(BADGE).closest('[aria-hidden]')).not.toBeNull();
            expect(screen.getByRole('option', {name: 'Mid'})).toBeInTheDocument();
        });

        test('puts an unranked option last, keeping its slot without a badge', async () => {
            renderWithContext(
                <SingleHarness
                    type='rank'
                    options={RANKS_WITH_UNRANKED}
                />,
            );

            await userEvent.click(screen.getByRole('combobox', {name: 'Department'}));

            expect(optionIds()).toEqual([
                'attr-input-listbox-option-top',
                'attr-input-listbox-option-low',
                'attr-input-listbox-option-odd',
            ]);
            expect(getRow('odd').getByTestId(PLACEHOLDER)).toBeInTheDocument();
            expect(getRow('odd').queryByTestId(BADGE)).not.toBeInTheDocument();
            expect(screen.getByTestId(`${TEST_ID}-option-odd`)).toHaveAccessibleName('Odd');
        });

        test.each<{options: PropertyFieldOption[]; value: string; badge: string | null; swatch: boolean}>([
            {options: RANKS, value: 'top', badge: '3', swatch: false},
            {options: RANKS, value: 'zero', badge: '0', swatch: false},
            {options: RANKS, value: 'mid', badge: null, swatch: true},
            {options: RANKS_WITH_UNRANKED, value: 'odd', badge: null, swatch: false},
            {options: RANKS, value: '', badge: null, swatch: false},
            {options: RANKS, value: 'ghost', badge: null, swatch: false},
        ])('closed field for value $value shows badge $badge, swatch $swatch', ({options, value, badge, swatch}) => {
            const {container} = renderWithContext(
                <SingleHarness
                    type='rank'
                    options={options}
                    initialValue={value}
                />,
            );

            expect(within(container).queryByTestId(BADGE)?.textContent ?? null).toBe(badge);
            expect(within(container).queryByTestId(SWATCH) !== null).toBe(swatch);
        });

        test('stays single-select: shows the first id of a list, emits a string on pick and \'\' on clear', async () => {
            const onChange = jest.fn();
            renderWithContext(
                <SingleHarness
                    type='rank'
                    options={RANKS}
                    initialValue={['top', 'low']}
                    onChange={onChange}
                />,
            );
            const input = screen.getByRole('combobox', {name: 'Department'});

            expect(input).toHaveValue('Top');
            expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();

            await userEvent.click(input);
            await userEvent.click(screen.getByRole('option', {name: 'Low'}));
            expect(onChange).toHaveBeenLastCalledWith('low');

            await userEvent.click(screen.getByTestId(`${TEST_ID}-clear`));
            expect(onChange).toHaveBeenLastCalledWith('');
        });

        test('a select ignores ranks: stored order and no badges', async () => {
            renderWithContext(
                <SingleHarness
                    options={[
                        {id: 'low', name: 'Low', rank: 1},
                        {id: 'top', name: 'Top', rank: 3},
                    ]}
                />,
            );

            await userEvent.click(screen.getByRole('combobox', {name: 'Department'}));

            expect(optionIds()).toEqual(['attr-input-listbox-option-low', 'attr-input-listbox-option-top']);
            expect(screen.queryByTestId(BADGE)).not.toBeInTheDocument();
            expect(screen.queryByTestId(PLACEHOLDER)).not.toBeInTheDocument();
        });

        test('a multiselect ignores ranks and colours', async () => {
            renderWithContext(
                <MultiHarness
                    options={RANKS}
                    initialValue={['mid']}
                />,
            );

            await userEvent.click(screen.getByRole('combobox', {name: 'Skills'}));

            expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Low', 'Top', 'Mid', 'Zero']);
            expect(screen.queryByTestId(BADGE)).not.toBeInTheDocument();
            expect(screen.queryByTestId(SWATCH)).not.toBeInTheDocument();
            expect(screen.queryByTestId(PLACEHOLDER)).not.toBeInTheDocument();
            expect(getChips().map((chip) => chip.textContent)).toEqual(['Mid']);
        });
    });

    describe('pass-through props', () => {
        test('puts className on the wrapper only, and renders no class there without it', () => {
            const {rerender} = renderWithContext(
                <AttributeCombobox
                    label='Department'
                    options={OPTIONS}
                    value=''
                    className='custom'
                    onChange={jest.fn()}
                />,
            );
            const styled = document.querySelectorAll('.custom');

            expect(styled).toHaveLength(1);
            expect(styled[0]).toContainElement(screen.getByRole('combobox', {name: 'Department'}));

            rerender(
                <AttributeCombobox
                    label='Department'
                    options={OPTIONS}
                    value=''
                    onChange={jest.fn()}
                />,
            );

            expect(document.querySelector('.custom')).not.toBeInTheDocument();
        });

        test('puts aria-describedby on the input, and omits it without the prop', () => {
            const {rerender} = renderWithContext(
                <>
                    <AttributeCombobox
                        label='Department'
                        options={OPTIONS}
                        value=''
                        aria-describedby='err'
                        onChange={jest.fn()}
                    />
                    <div id='err'>{'Bad'}</div>
                </>,
            );
            const input = screen.getByRole('combobox', {name: 'Department'});

            expect(input).toHaveAttribute('aria-describedby', 'err');
            expect(input).toHaveAccessibleDescription('Bad');

            rerender(
                <AttributeCombobox
                    label='Department'
                    options={OPTIONS}
                    value=''
                    onChange={jest.fn()}
                />,
            );

            expect(screen.getByRole('combobox', {name: 'Department'})).not.toHaveAttribute('aria-describedby');
        });

        test('marks the input invalid only with invalid', () => {
            const {rerender} = renderWithContext(
                <AttributeCombobox
                    type='multiselect'
                    label='Skills'
                    options={OPTIONS}
                    value={['opt1']}
                    invalid={true}
                    onChange={jest.fn()}
                />,
            );

            expect(screen.getByRole('combobox', {name: 'Skills'})).toHaveAttribute('aria-invalid', 'true');

            rerender(
                <AttributeCombobox
                    type='multiselect'
                    label='Skills'
                    options={OPTIONS}
                    value={['opt1']}
                    onChange={jest.fn()}
                />,
            );

            expect(screen.getByRole('combobox', {name: 'Skills'})).not.toHaveAttribute('aria-invalid');
        });

        test('marks the input aria-required only with required', () => {
            const {rerender} = renderWithContext(
                <AttributeCombobox
                    label='Department'
                    options={OPTIONS}
                    value=''
                    required={true}
                    onChange={jest.fn()}
                />,
            );

            expect(screen.getByRole('combobox', {name: 'Department'})).toHaveAttribute('aria-required', 'true');

            rerender(
                <AttributeCombobox
                    label='Department'
                    options={OPTIONS}
                    value=''
                    onChange={jest.fn()}
                />,
            );

            expect(screen.getByRole('combobox', {name: 'Department'})).not.toHaveAttribute('aria-required');
        });

        test('calls onBlur when the input loses focus', async () => {
            const user = userEvent.setup();
            const onBlur = jest.fn();
            renderWithContext(<SingleHarness onBlur={onBlur}/>);
            const input = screen.getByRole('combobox', {name: 'Department'});

            await user.click(input);
            expect(onBlur).not.toHaveBeenCalled();

            await user.tab();

            expect(onBlur).toHaveBeenCalledTimes(1);
            expect(onBlur.mock.calls[0][0].target).toBe(input);
        });

        test('calls onBlur in multiple mode too', async () => {
            const user = userEvent.setup();
            const onBlur = jest.fn();
            renderWithContext(<MultiHarness onBlur={onBlur}/>);

            await user.click(screen.getByRole('combobox', {name: 'Skills'}));
            await user.tab();

            expect(onBlur).toHaveBeenCalledTimes(1);
        });
    });
});
