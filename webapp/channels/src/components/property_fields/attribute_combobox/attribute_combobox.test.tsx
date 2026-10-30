// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

import type {PropertyFieldOption} from '@mattermost/types/properties';

import {act, fireEvent, renderWithContext, screen, userEvent, within} from 'tests/react_testing_utils';
import {ZIndex} from 'utils/constants';

import {AttributeCombobox} from './attribute_combobox';

const OPTIONS: PropertyFieldOption[] = [
    {id: 'opt3', name: 'Option 3'},
    {id: 'opt1', name: 'Option 1'},
    {id: 'opt2', name: 'Option 2'},
];

const TEST_ID = 'attr';

function SingleHarness({initialValue = '', onChange}: {initialValue?: string; onChange?: (value: string) => void}) {
    const [value, setValue] = useState(initialValue);
    return (
        <AttributeCombobox
            id='attr-input'
            testId={TEST_ID}
            label='Department'
            options={OPTIONS}
            value={value}
            onChange={(next) => {
                onChange?.(next);
                setValue(next);
            }}
        />
    );
}

function MultiHarness({initialValue = [], onChange}: {initialValue?: string[]; onChange?: (value: string[]) => void}) {
    const [value, setValue] = useState(initialValue);
    return (
        <AttributeCombobox
            multiple={true}
            testId={TEST_ID}
            label='Skills'
            options={OPTIONS}
            value={value}
            onChange={(next) => {
                onChange?.(next);
                setValue(next);
            }}
        />
    );
}

type FormHarnessProps = {
    multiple?: boolean;
    initialValue?: string | string[];
    preventEnterSubmit?: boolean;
    onChange?: (value: string | string[]) => void;
    onSubmit: () => void;
};

function FormHarness({multiple = false, initialValue, preventEnterSubmit, onChange, onSubmit}: FormHarnessProps) {
    const [value, setValue] = useState<string | string[]>(initialValue ?? (multiple ? [] : ''));
    const handleChange = (next: string | string[]) => {
        onChange?.(next);
        setValue(next);
    };
    const shared = {testId: TEST_ID, options: OPTIONS, preventEnterSubmit};

    let combobox: React.ReactNode;
    if (multiple) {
        combobox = (
            <AttributeCombobox
                {...shared}
                multiple={true}
                label='Skills'
                value={value}
                onChange={handleChange}
            />
        );
    } else {
        combobox = (
            <AttributeCombobox
                {...shared}
                label='Department'
                value={typeof value === 'string' ? value : ''}
                onChange={handleChange}
            />
        );
    }

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
            {combobox}
            <button type='submit'>{'Save'}</button>
        </form>
    );
}

const getChips = () => Array.from(document.querySelectorAll<HTMLElement>('[data-chip]'));

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
                    multiple={true}
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
                    multiple={true}
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

    describe('preventEnterSubmit', () => {
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
                    preventEnterSubmit={true}
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
                    multiple={true}
                    initialValue={['opt1']}
                    preventEnterSubmit={true}
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

        test.each([
            {multiple: false, label: 'Department'},
            {multiple: true, label: 'Skills'},
        ])('Enter with no matching option does not submit (multiple: $multiple)', async ({multiple, label}) => {
            const user = userEvent.setup();
            const onChange = jest.fn();
            renderWithContext(
                <FormHarness
                    multiple={multiple}
                    preventEnterSubmit={true}
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
        test.each([
            {multiple: false, label: 'Department', expected: 'opt1'},
            {multiple: true, label: 'Skills', expected: ['opt1']},
        ])('Enter that picks an option still picks it and does not submit (multiple: $multiple)', async ({multiple, label, expected}) => {
            const user = userEvent.setup();
            const onChange = jest.fn();
            renderWithContext(
                <FormHarness
                    multiple={multiple}
                    preventEnterSubmit={true}
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
                    preventEnterSubmit={true}
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
                    preventEnterSubmit={true}
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
        test.each([
            {multiple: false, label: 'Department', initialValue: 'opt1'},
            {multiple: true, label: 'Skills', initialValue: ['opt1']},
        ])('without the prop, Enter on a closed field submits and reaches document (multiple: $multiple)', async ({multiple, label, initialValue}) => {
            const user = userEvent.setup();
            const onChange = jest.fn();
            renderWithContext(
                <FormHarness
                    multiple={multiple}
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

        test('without the prop, Enter with no matching option submits', async () => {
            const user = userEvent.setup();
            const onChange = jest.fn();
            renderWithContext(
                <FormHarness
                    onChange={onChange}
                    onSubmit={onSubmit}
                />,
            );
            const input = screen.getByRole('combobox', {name: 'Department'});

            await user.click(input);
            await user.keyboard('zzz');
            expect(input).toHaveAttribute('aria-expanded', 'true');
            expect(screen.getByText('No results')).toBeInTheDocument();
            await user.keyboard('{Enter}');

            expect(onSubmit).toHaveBeenCalledTimes(1);
            expect(documentKeys).toContain('Enter');
            expect(onChange).not.toHaveBeenCalled();
        });

        // user-event can't set isComposing, so dispatch directly.
        test('Enter during IME composition is not prevented', () => {
            renderWithContext(
                <FormHarness
                    preventEnterSubmit={true}
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
                    multiple={true}
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
            expect(styled[0]).toHaveAttribute('role', 'presentation');
            expect(styled[0]).toContainElement(screen.getByRole('combobox', {name: 'Department'}));

            rerender(
                <AttributeCombobox
                    label='Department'
                    options={OPTIONS}
                    value=''
                    onChange={jest.fn()}
                />,
            );

            expect(screen.getByRole('combobox', {name: 'Department'}).closest('[role="presentation"]')).not.toHaveAttribute('class');
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

        test('puts aria-errormessage on the input alongside aria-invalid', () => {
            renderWithContext(
                <>
                    <AttributeCombobox
                        multiple={true}
                        label='Skills'
                        options={OPTIONS}
                        value={['opt1']}
                        invalid={true}
                        aria-errormessage='err'
                        onChange={jest.fn()}
                    />
                    <div id='err'>{'Bad'}</div>
                </>,
            );
            const input = screen.getByRole('combobox', {name: 'Skills'});

            expect(input).toHaveAttribute('aria-errormessage', 'err');
            expect(input).toHaveAttribute('aria-invalid', 'true');
            expect(input).toHaveAccessibleErrorMessage('Bad');
        });
    });
});
