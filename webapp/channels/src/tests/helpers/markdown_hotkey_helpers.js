// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @module makrdownHotkeyHelpers
 * consolidate testing of similar behavior across components
 */

import {shallow} from 'enzyme';

import Constants from 'utils/constants';
import {shallowWithIntl} from 'tests/helpers/intl-test-helper';

/**
 * @param  {string} [input] text input
 * @param  {int} [start] selection's start index
 * @param  {int} [end] selection's end index
 * @param  {object} [keycode] Keycode constant associated with key press
 * @return {object} keydown event object
 */

export function makeSelectionEvent(input, start, end) {
    return {
        preventDefault: jest.fn(),
        target: {
            selectionStart: start,
            selectionEnd: end,
            value: input,
        },
    };
}

function makeMarkdownHotkeyEvent(input, start, end, keycode, altKey = false) {
    return {
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        ctrlKey: true,
        altKey,
        key: keycode[0],
        keyCode: keycode[1],
        target: {
            selectionStart: start,
            selectionEnd: end,
            value: input,
        },
    };
}

/**
 * @param  {string} [input] text input
 * @param  {int} [start] selection's start index
 * @param  {int} [end] selection's end index
 * @return {object} keydown event object
 */
export function makeBoldHotkeyEvent(input, start, end) {
    return makeMarkdownHotkeyEvent(input, start, end, Constants.KeyCodes.B);
}

/**
 * @param  {string} [input] text input
 * @param  {int} [start] selection's start index
 * @param  {int} [end] selection's end index
 * @return {object} keydown event object
 */
export function makeItalicHotkeyEvent(input, start, end) {
    return makeMarkdownHotkeyEvent(input, start, end, Constants.KeyCodes.I);
}

function makeLinkHotKeyEvent(input, start, end) {
    return makeMarkdownHotkeyEvent(input, start, end, Constants.KeyCodes.K, true);
}

/**
 * helper to test markdown hotkeys on key down behavior common to many textarea inputs
 * @param  {function} generateInstance - single paramater "value" of the initial value
 * @param  {function} initRefs - React Component instance and setSelectionRange function
 * @param  {function} getValue - single parameter for the React Component instance
 * NOTE: runs Jest tests
 */
export function testComponentForMarkdownHotkeys(generateInstance, initRefs, find, getValue, intlInjected = true) {
    const shallowRender = intlInjected ? shallowWithIntl : shallow;
    test('component adds bold markdown', () => {
        // "Fafda" is selected with ctrl + B hotkey
        const input = 'Jalebi Fafda & Sambharo';
        const e = makeBoldHotkeyEvent(input, 7, 12);

        const instance = shallowRender(generateInstance(input));

        const setSelectionRange = jest.fn();
        initRefs(instance, setSelectionRange);

        find(instance).props().onKeyDown?.(e);
        find(instance).props().handleKeyDown?.(e);
        expect(getValue(instance)).toBe('Jalebi **Fafda** & Sambharo');
        expect(setSelectionRange).toHaveBeenCalled();
    });

    test('component adds italic markdown', () => {
        // "Fafda" is selected with ctrl + I hotkey
        const input = 'Jalebi Fafda & Sambharo';
        const e = makeItalicHotkeyEvent(input, 7, 12);

        const instance = shallowRender(generateInstance(input));

        const setSelectionRange = jest.fn();
        initRefs(instance, setSelectionRange);

        find(instance).props().onKeyDown?.(e);
        find(instance).props().handleKeyDown?.(e);
        expect(getValue(instance)).toBe('Jalebi *Fafda* & Sambharo');
        expect(setSelectionRange).toHaveBeenCalled();
    });

    test('component starts bold markdown', () => {
        // Nothing is selected, caret is just before "Fafde" with ctrl + B
        const input = 'Jalebi Fafda & Sambharo';
        const e = makeBoldHotkeyEvent(input, 7, 7);

        const instance = shallowRender(generateInstance(input));

        const setSelectionRange = jest.fn();
        initRefs(instance, setSelectionRange);

        find(instance).props().onKeyDown?.(e);
        find(instance).props().handleKeyDown?.(e);
        expect(getValue(instance)).toBe('Jalebi ****Fafda & Sambharo');
        expect(setSelectionRange).toHaveBeenCalled();
    });

    test('component starts italic markdown', () => {
        // Nothing is selected, caret is just before "Fafde" with ctrl + B
        const input = 'Jalebi Fafda & Sambharo';
        const e = makeItalicHotkeyEvent(input, 7, 7);

        const instance = shallowRender(generateInstance(input));

        const setSelectionRange = jest.fn();
        initRefs(instance, setSelectionRange);

        find(instance).props().onKeyDown?.(e);
        find(instance).props().handleKeyDown?.(e);
        expect(getValue(instance)).toBe('Jalebi **Fafda & Sambharo');
        expect(setSelectionRange).toHaveBeenCalled();
    });

    test('component adds link markdown when something is selected', () => {
        // "Fafda" is selected with ctrl + alt + K hotkey
        const input = 'Jalebi Fafda & Sambharo';
        const e = makeLinkHotKeyEvent(input, 7, 12);

        const instance = shallowRender(generateInstance(input));

        let selectionStart = -1;
        let selectionEnd = -1;
        const setSelectionRange = jest.fn((start, end) => {
            selectionStart = start;
            selectionEnd = end;
        });
        initRefs(instance, setSelectionRange);

        find(instance).props().onKeyDown?.(e);
        find(instance).props().handleKeyDown?.(e);
        expect(getValue(instance)).toBe('Jalebi [Fafda](url) & Sambharo');
        expect(setSelectionRange).toHaveBeenCalled();
        expect(selectionStart).toBe(15);
        expect(selectionEnd).toBe(18);
    });

    test('component adds link markdown when cursor is before a word', () => {
        // Cursor is before "Fafda" with ctrl + alt + K hotkey
        const input = 'Jalebi Fafda & Sambharo';
        const e = makeLinkHotKeyEvent(input, 7, 7);

        const instance = shallowRender(generateInstance(input));

        let selectionStart = -1;
        let selectionEnd = -1;
        const setSelectionRange = jest.fn((start, end) => {
            selectionStart = start;
            selectionEnd = end;
        });
        initRefs(instance, setSelectionRange);

        find(instance).props().onKeyDown?.(e);
        find(instance).props().handleKeyDown?.(e);
        expect(getValue(instance)).toBe('Jalebi [Fafda](url) & Sambharo');
        expect(setSelectionRange).toHaveBeenCalled();
        expect(selectionStart).toBe(15);
        expect(selectionEnd).toBe(18);
    });

    test('component adds link markdown when cursor is in a word', () => {
        // Cursor is after "Fafda" with ctrl + alt + K hotkey
        const input = 'Jalebi Fafda & Sambharo';
        const e = makeLinkHotKeyEvent(input, 10, 10);

        const instance = shallowRender(generateInstance(input));

        let selectionStart = -1;
        let selectionEnd = -1;
        const setSelectionRange = jest.fn((start, end) => {
            selectionStart = start;
            selectionEnd = end;
        });
        initRefs(instance, setSelectionRange);

        find(instance).props().onKeyDown?.(e);
        find(instance).props().handleKeyDown?.(e);
        expect(getValue(instance)).toBe('Jalebi [Fafda](url) & Sambharo');
        expect(setSelectionRange).toHaveBeenCalled();
        expect(selectionStart).toBe(15);
        expect(selectionEnd).toBe(18);
    });

    test('component adds link markdown when cursor is after a word', () => {
        // Cursor is after "Fafda" with ctrl + alt + K hotkey
        const input = 'Jalebi Fafda & Sambharo';
        const e = makeLinkHotKeyEvent(input, 12, 12);

        const instance = shallowRender(generateInstance(input));

        let selectionStart = -1;
        let selectionEnd = -1;
        const setSelectionRange = jest.fn((start, end) => {
            selectionStart = start;
            selectionEnd = end;
        });
        initRefs(instance, setSelectionRange);

        find(instance).props().onKeyDown?.(e);
        find(instance).props().handleKeyDown?.(e);
        expect(getValue(instance)).toBe('Jalebi [Fafda](url) & Sambharo');
        expect(setSelectionRange).toHaveBeenCalled();
        expect(selectionStart).toBe(15);
        expect(selectionEnd).toBe(18);
    });

    test('component adds link markdown when cursor is at the end of line', () => {
        // Cursor is after "Sambharo" with ctrl + alt + K hotkey
        const input = 'Jalebi Fafda & Sambharo';
        const e = makeLinkHotKeyEvent(input, 23, 23);

        const instance = shallowRender(generateInstance(input));

        let selectionStart = -1;
        let selectionEnd = -1;
        const setSelectionRange = jest.fn((start, end) => {
            selectionStart = start;
            selectionEnd = end;
        });
        initRefs(instance, setSelectionRange);

        find(instance).props().onKeyDown?.(e);
        find(instance).props().handleKeyDown?.(e);
        expect(getValue(instance)).toBe('Jalebi Fafda & Sambharo [](url)');
        expect(setSelectionRange).toHaveBeenCalled();
        expect(selectionStart).toBe(25);
        expect(selectionEnd).toBe(25);
    });

    test('component removes link markdown', () => {
        // "Fafda" is selected with ctrl + alt + K hotkey
        const input = 'Jalebi [Fafda](url) & Sambharo';
        const e = makeLinkHotKeyEvent(input, 8, 13);

        const instance = shallowRender(generateInstance(input));

        let selectionStart = -1;
        let selectionEnd = -1;
        const setSelectionRange = jest.fn((start, end) => {
            selectionStart = start;
            selectionEnd = end;
        });
        initRefs(instance, setSelectionRange);

        find(instance).props().onKeyDown?.(e);
        find(instance).props().handleKeyDown?.(e);
        expect(getValue(instance)).toBe('Jalebi Fafda & Sambharo');
        expect(setSelectionRange).toHaveBeenCalled();
        expect(selectionStart).toBe(7);
        expect(selectionEnd).toBe(12);
    });
}
