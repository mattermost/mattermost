// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import type {KeyboardEvent, MouseEvent} from 'react';

import {Combobox} from '@mattermost/compass-ui/components/combobox';
import type {ComboboxOption} from '@mattermost/compass-ui/components/combobox';

import {act, render, screen, userEvent} from 'tests/react_testing_utils';

import {
    attributeComboboxKeyGuard,
    attributeComboboxMouseDownGuard,
    getAttributeComboboxClearButtonProps,
    getAttributeComboboxWrapperProps,
} from './attribute_combobox_utils';

function makeKeyEvent(key: string, defaultPrevented: boolean) {
    return {
        key,
        defaultPrevented,
        stopPropagation: jest.fn(),
        preventDefault: jest.fn(),
    } as unknown as KeyboardEvent<HTMLButtonElement> & {stopPropagation: jest.Mock; preventDefault: jest.Mock};
}

describe('attributeComboboxKeyGuard', () => {
    test.each(['ArrowDown', 'ArrowUp', 'Home', 'End', 'Tab', 'Backspace', ' ', 'a'])('lets %s through even when handled', (key) => {
        const e = makeKeyEvent(key, true);

        attributeComboboxKeyGuard(e);

        expect(e.stopPropagation).not.toHaveBeenCalled();
    });
});

describe('attributeComboboxMouseDownGuard', () => {
    function makeMouseEvent(currentTarget: HTMLElement, target: Node) {
        return {
            currentTarget,
            target,
            preventDefault: jest.fn(),
        } as unknown as MouseEvent<HTMLElement> & {preventDefault: jest.Mock};
    }

    test('leaves a mousedown inside the wrapper alone', () => {
        const wrapper = document.createElement('div');
        const child = wrapper.appendChild(document.createElement('span'));
        const e = makeMouseEvent(wrapper, child);

        attributeComboboxMouseDownGuard(e);

        expect(e.preventDefault).not.toHaveBeenCalled();
    });

    test('prevents a mousedown that arrives from outside the wrapper DOM, as from a portal', () => {
        const e = makeMouseEvent(document.createElement('div'), document.createElement('span'));

        attributeComboboxMouseDownGuard(e);

        expect(e.preventDefault).toHaveBeenCalledTimes(1);
    });
});

describe('getAttributeComboboxClearButtonProps', () => {
    test('stops Enter without preventing the button from activating', () => {
        const e = makeKeyEvent('Enter', false);

        getAttributeComboboxClearButtonProps('x').onKeyDown(e);

        expect(e.stopPropagation).toHaveBeenCalledTimes(1);
        expect(e.preventDefault).not.toHaveBeenCalled();
    });

    test.each([' ', 'Escape', 'Tab', 'a'])('lets %s through', (key) => {
        const e = makeKeyEvent(key, false);

        getAttributeComboboxClearButtonProps('x').onKeyDown(e);

        expect(e.stopPropagation).not.toHaveBeenCalled();
        expect(e.preventDefault).not.toHaveBeenCalled();
    });
});

describe('key guard with a real Combobox', () => {
    const options: ComboboxOption[] = [
        {value: 'a', label: 'Alpha'},
        {value: 'b', label: 'Bravo'},
        {value: 'c', label: 'Charlie'},
    ];

    let documentKeys: string[];
    const onDocumentKeyDown = (e: globalThis.KeyboardEvent) => documentKeys.push(e.key);

    beforeEach(() => {
        documentKeys = [];
        document.addEventListener('keydown', onDocumentKeyDown);
    });

    afterEach(() => {
        document.removeEventListener('keydown', onDocumentKeyDown);
    });

    type HarnessProps = {
        initialValue?: string | string[];
        multiple?: boolean;
        guard?: boolean;
        clearHandler?: boolean;
        mouseDownGuard?: boolean;
        onChange?: (next: string | string[] | null) => void;
    };

    function Harness({initialValue = '', multiple = false, guard = true, clearHandler = true, mouseDownGuard = true, onChange}: HarnessProps) {
        const [value, setValue] = useState<string | string[]>(initialValue);
        const clearButtonProps = clearHandler ? getAttributeComboboxClearButtonProps('x-clear') : {'data-testid': 'x-clear'};
        const wrapperProps = guard && mouseDownGuard ? getAttributeComboboxWrapperProps() : {
            onKeyDown: guard ? attributeComboboxKeyGuard : undefined,
            onMouseDown: mouseDownGuard ? attributeComboboxMouseDownGuard : undefined,
        };

        return (
            // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- key and focus guards only; the Combobox input owns keyboard interaction
            <div {...wrapperProps}>
                <Combobox
                    aria-label='Field'
                    options={options}
                    multiple={multiple}
                    value={value}
                    clearable={true}
                    clearButtonProps={clearButtonProps}
                    onChange={(next) => {
                        onChange?.(next);
                        setValue(next ?? (multiple ? [] : ''));
                    }}
                />
            </div>
        );
    }

    const getInput = () => screen.getByRole('combobox', {name: 'Field'});

    // The listbox's parent is the menu's scroll area, outside any option row:
    // where a click on the menu padding or scrollbar lands.
    const getMenuNonOptionArea = () => screen.getByRole('listbox').parentElement!;

    test('Enter that picks an option does not reach document', async () => {
        const user = userEvent.setup();
        const onChange = jest.fn();
        render(<Harness onChange={onChange}/>);

        await user.click(getInput());
        expect(getInput()).toHaveAttribute('aria-expanded', 'true');
        await user.keyboard('{ArrowDown}{Enter}');

        expect(onChange).toHaveBeenLastCalledWith('b');
        expect(getInput()).toHaveValue('Bravo');
        expect(documentKeys).not.toContain('Enter');
    });

    test('Enter on a freshly opened empty field picks the first option without reaching document', async () => {
        const user = userEvent.setup();
        const onChange = jest.fn();
        render(<Harness onChange={onChange}/>);

        await user.click(getInput());
        await user.keyboard('{Enter}');

        expect(onChange).toHaveBeenLastCalledWith('a');
        expect(documentKeys).not.toContain('Enter');
    });

    test('Enter on a closed field reaches document and changes nothing', async () => {
        const user = userEvent.setup();
        const onChange = jest.fn();
        render(
            <Harness
                initialValue='b'
                onChange={onChange}
            />,
        );

        await user.click(getInput());
        await user.keyboard('{Escape}');
        expect(getInput()).toHaveAttribute('aria-expanded', 'false');
        expect(documentKeys).not.toContain('Escape');

        await user.keyboard('{Enter}');

        expect(documentKeys).toEqual(['Enter']);
        expect(onChange).not.toHaveBeenCalled();
        expect(getInput()).toHaveValue('Bravo');
    });

    test('Escape with the menu open does not reach document, and a second Escape does', async () => {
        const user = userEvent.setup();
        render(<Harness/>);

        await user.click(getInput());
        expect(getInput()).toHaveAttribute('aria-expanded', 'true');

        await user.keyboard('{Escape}');
        expect(getInput()).toHaveAttribute('aria-expanded', 'false');
        expect(documentKeys).toEqual([]);

        await user.keyboard('{Escape}');
        expect(documentKeys).toEqual(['Escape']);
    });

    test('Enter on the clear button clears the value and does not reach document', async () => {
        const user = userEvent.setup();
        const onChange = jest.fn();
        render(
            <Harness
                initialValue='b'
                onChange={onChange}
            />,
        );

        const clear = screen.getByTestId('x-clear');
        act(() => clear.focus());
        await user.keyboard('{Enter}');

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(null);
        expect(getInput()).toHaveValue('');
        expect(screen.queryByTestId('x-clear')).not.toBeInTheDocument();
        expect(documentKeys).not.toContain('Enter');
    });

    test('Tab from the open menu to the clear button, then Enter, clears without reaching document', async () => {
        const user = userEvent.setup();
        const onChange = jest.fn();
        render(
            <Harness
                initialValue='b'
                onChange={onChange}
            />,
        );

        await user.click(getInput());
        await user.tab();
        expect(screen.getByTestId('x-clear')).toHaveFocus();

        await user.keyboard('{Enter}');

        expect(onChange).toHaveBeenLastCalledWith(null);
        expect(getInput()).toHaveValue('');
        expect(documentKeys).toEqual(['Tab']);
    });

    test('other keys always reach document', async () => {
        const user = userEvent.setup();
        render(<Harness initialValue='b'/>);

        await user.click(getInput());
        await user.keyboard('{ArrowDown}{ArrowUp}{Home}{End}c{Backspace}');
        await user.tab();

        expect(documentKeys).toEqual(['ArrowDown', 'ArrowUp', 'Home', 'End', 'c', 'Backspace', 'Tab']);
    });

    // Accepted residual risk: Combobox leaves Enter unhandled when the typed
    // filter matches nothing, so a surrounding form sees it.
    test('Enter with the menu open and no matching options reaches document and changes nothing', async () => {
        const user = userEvent.setup();
        const onChange = jest.fn();
        render(
            <Harness
                initialValue='b'
                onChange={onChange}
            />,
        );

        await user.click(getInput());
        await user.clear(getInput());
        await user.keyboard('zzz');
        expect(getInput()).toHaveAttribute('aria-expanded', 'true');
        expect(screen.queryByRole('option')).not.toBeInTheDocument();

        await user.keyboard('{Enter}');

        expect(documentKeys).toContain('Enter');
        expect(onChange).not.toHaveBeenCalled();
    });

    test('multiple: Enter that toggles an option does not reach document', async () => {
        const user = userEvent.setup();
        const onChange = jest.fn();
        render(
            <Harness
                multiple={true}
                initialValue={['a']}
                onChange={onChange}
            />,
        );

        await user.click(getInput());
        await user.keyboard('{ArrowDown}{Enter}');

        expect(onChange).toHaveBeenLastCalledWith(['a', 'b']);
        expect(documentKeys).not.toContain('Enter');
    });

    test('multiple: Enter on a focused chip removes it and does not reach document', async () => {
        const user = userEvent.setup();
        const onChange = jest.fn();
        render(
            <Harness
                multiple={true}
                initialValue={['a', 'b']}
                onChange={onChange}
            />,
        );

        const [firstChip] = document.querySelectorAll<HTMLElement>('[data-chip]');
        act(() => firstChip.focus());
        expect(firstChip).toHaveFocus();
        await user.keyboard('{Enter}');

        expect(onChange).toHaveBeenCalledWith(['b']);
        expect(documentKeys).not.toContain('Enter');
    });

    test('mousedown on a non-option area of the open menu keeps focus on the input, so Escape closes only the menu', async () => {
        const user = userEvent.setup();
        render(<Harness initialValue='b'/>);

        await user.click(getInput());
        await user.pointer({keys: '[MouseLeft]', target: getMenuNonOptionArea()});

        expect(getInput()).toHaveFocus();
        expect(getInput()).toHaveAttribute('aria-expanded', 'true');

        await user.keyboard('{Escape}');

        expect(getInput()).toHaveAttribute('aria-expanded', 'false');
        expect(documentKeys).toEqual([]);
    });

    test('mousedown guard leaves the input, clear button and option clicks working', async () => {
        const user = userEvent.setup();
        const onChange = jest.fn();
        render(
            <Harness
                initialValue='b'
                onChange={onChange}
            />,
        );

        await user.click(getInput());
        await user.click(screen.getByRole('option', {name: 'Charlie'}));
        expect(onChange).toHaveBeenLastCalledWith('c');
        expect(getInput()).toHaveFocus();

        await user.click(screen.getByTestId('x-clear'));
        expect(onChange).toHaveBeenLastCalledWith(null);
    });

    test('multiple: clicking a chip remove button removes it with the mousedown guard on', async () => {
        const user = userEvent.setup();
        const onChange = jest.fn();
        render(
            <Harness
                multiple={true}
                initialValue={['a', 'b']}
                onChange={onChange}
            />,
        );

        const [firstChip] = document.querySelectorAll<HTMLElement>('[data-chip]');
        await user.click(firstChip.querySelector<HTMLElement>('[data-chip-remove]')!);

        expect(onChange).toHaveBeenLastCalledWith(['b']);
        expect(document.querySelectorAll('[data-chip]')).toHaveLength(1);
    });

    describe('controls: the behaviour each helper prevents', () => {
        test('without the mousedown guard, mousedown on a non-option area of the menu moves focus and Escape reaches document', async () => {
            const user = userEvent.setup();
            render(
                <Harness
                    initialValue='b'
                    mouseDownGuard={false}
                />,
            );

            await user.click(getInput());
            await user.pointer({keys: '[MouseLeft]', target: getMenuNonOptionArea()});

            expect(getInput()).not.toHaveFocus();
            expect(getInput()).toHaveAttribute('aria-expanded', 'true');

            await user.keyboard('{Escape}');

            expect(documentKeys).toEqual(['Escape']);
            expect(getInput()).toHaveAttribute('aria-expanded', 'true');
        });

        test('without the guard, Enter that picks an option reaches document', async () => {
            const user = userEvent.setup();
            const onChange = jest.fn();
            render(
                <Harness
                    guard={false}
                    onChange={onChange}
                />,
            );

            await user.click(getInput());
            await user.keyboard('{ArrowDown}{Enter}');

            expect(onChange).toHaveBeenLastCalledWith('b');
            expect(documentKeys).toContain('Enter');
        });

        test('without the guard, Escape that closes the menu reaches document', async () => {
            const user = userEvent.setup();
            render(<Harness guard={false}/>);

            await user.click(getInput());
            await user.keyboard('{Escape}');

            expect(documentKeys).toEqual(['Escape']);
        });

        test('without the clear-button handler, Enter on the clear button reaches document', async () => {
            const user = userEvent.setup();
            const onChange = jest.fn();
            render(
                <Harness
                    initialValue='b'
                    clearHandler={false}
                    onChange={onChange}
                />,
            );

            const clear = screen.getByTestId('x-clear');
            act(() => clear.focus());
            await user.keyboard('{Enter}');

            expect(onChange).toHaveBeenCalledWith(null);
            expect(documentKeys).toContain('Enter');
        });
    });
});
