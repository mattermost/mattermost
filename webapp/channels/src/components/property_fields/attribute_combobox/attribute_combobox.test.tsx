// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

import type {PropertyFieldOption} from '@mattermost/types/properties';

import {act, renderWithContext, screen, userEvent, within} from 'tests/react_testing_utils';
import {A11yAttributeNames, ZIndex} from 'utils/constants';

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

    test('opts its wrapper out of SettingItemMax initial focus', () => {
        renderWithContext(<SingleHarness/>);

        const input = screen.getByRole('combobox', {name: 'Department'});
        expect(input.closest(`[${A11yAttributeNames.SKIP_INITIAL_FOCUS}]`)).not.toBeNull();
    });

    test('puts the id, test id and aria-describedby on the input and portals the menu at the given z-index', async () => {
        renderWithContext(
            <AttributeCombobox
                id='attr-input'
                testId={TEST_ID}
                label='Department'
                options={OPTIONS}
                value=''
                aria-describedby='attr-help'
                zIndex={ZIndex.MENU}
                onChange={jest.fn()}
            />,
        );

        const input = screen.getByRole('combobox', {name: 'Department'});
        expect(input).toHaveAttribute('id', 'attr-input');
        expect(input).toHaveAttribute('data-testid', TEST_ID);
        expect(input).toHaveAttribute('aria-describedby', 'attr-help');

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
    });
});
