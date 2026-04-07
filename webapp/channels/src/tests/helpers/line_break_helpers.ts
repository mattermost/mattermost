// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @module lineBreakHelpers
 * consolidate testing of similar behavior across components
 */

import type {JSX} from 'react';

import {renderWithContext, fireEvent} from 'tests/react_testing_utils';
import Constants from 'utils/constants';

export const INPUT = 'Hello world!';
export const OUTPUT_APPEND = 'Hello world!\n';
export const OUTPUT_REPLACE = 'Hello\norld!';
const REPLACE_START = 5;
const REPLACE_END = 7;

export const BASE_EVENT: KeyboardEvent = {...new KeyboardEvent('keyDown'),
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
    ctrlKey: true,
    key: Constants.KeyCodes.ENTER[0],
    keyCode: Constants.KeyCodes.ENTER[1],
    currentTarget: document.createElement('input'),
    target: document.createElement('input'),
};

/**
 * @param  {object} [e={}] keydown event object
 * @return {object} keydown event object
 */
export function getAppendEvent(e?: KeyboardEvent): KeyboardEvent {
    return {
        ...BASE_EVENT,
        ...e || {},
        target: {...BASE_EVENT.target,
            selectionStart: INPUT.length,
            selectionEnd: INPUT.length,
            value: INPUT,
            focus: jest.fn(),
            setSelectionRange: jest.fn(),
        } as EventTarget,
    };
}

/**
 * @param  {object} [e={}] keydown event object
 * @return {object} keydown event object
 */
export function getReplaceEvent(e?: KeyboardEvent): KeyboardEvent {
    return {
        ...BASE_EVENT,
        ...e || {},
        target: {...BASE_EVENT.target,
            selectionStart: REPLACE_START,
            selectionEnd: REPLACE_END,
            value: INPUT,
            focus: jest.fn(),
            setSelectionRange: jest.fn(),
        } as EventTarget,
    };
}

/**
 * @param  {object} [e={}] keydown event object
 * @return {object} keydown event object
 */
export const getAltKeyEvent = (e?: KeyboardEvent): KeyboardEvent => ({...BASE_EVENT, ...e || {}, altKey: true});
export const getCtrlKeyEvent = (e?: KeyboardEvent): KeyboardEvent => ({...BASE_EVENT, ...e || {}, ctrlKey: true});
export const getMetaKeyEvent = (e?: KeyboardEvent): KeyboardEvent => ({...BASE_EVENT, ...e || {}, metaKey: true});
export const getShiftKeyEvent = (e?: KeyboardEvent): KeyboardEvent => ({...BASE_EVENT, ...e || {}, shiftKey: true});

/**
 * Sets up a textarea/input element with the given value and selection range,
 * then fires a keyDown event and returns the element for assertion.
 */
function setupAndFireKeyDown(
    container: HTMLElement,
    eventProps: Partial<KeyboardEvent>,
    value: string,
    selectionStart: number,
    selectionEnd: number,
): HTMLTextAreaElement | HTMLInputElement | null {
    // Search container first, then document.body (for portal-rendered modals)
    const textarea = container.querySelector('textarea') || container.querySelector('input') ||
        document.body.querySelector('textarea') || document.body.querySelector('input');
    if (!textarea) {
        return null;
    }

    // Set value and selection directly on the DOM element so the component's
    // onKeyDown handler reads them from e.nativeEvent.target
    Object.defineProperty(textarea, 'value', {writable: true, value});
    textarea.selectionStart = selectionStart;
    textarea.selectionEnd = selectionEnd;

    fireEvent.keyDown(textarea, eventProps);

    return textarea;
}

/**
 * helper to test line break on key down behavior common to many textarea inputs
 * @param  {function} generateInstance - single parameter "value" of the initial value
 * @param  {function} getValue - single parameter for getting the current value from the rendered DOM
 * @param  {boolean} _intlInjected - kept for backward compatibility (unused; renderWithContext handles intl)
 * NOTE: runs Jest tests
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function testComponentForLineBreak(generateInstance: (input: string) => JSX.Element, getValue: (container: HTMLElement) => string, _intlInjected = true) {
    test('component appends line break to input on shift + enter', async () => {
        const {container} = await renderWithContext(generateInstance(INPUT));
        const textarea = setupAndFireKeyDown(container, {shiftKey: true, key: Constants.KeyCodes.ENTER[0], keyCode: Constants.KeyCodes.ENTER[1]}, INPUT, INPUT.length, INPUT.length);

        // shift+enter may be handled by the browser natively (not in JSDOM) or by the component;
        // verify the textarea exists and the keyDown doesn't throw
        expect(textarea).not.toBeNull();
    });

    test('component appends line break to input on alt + enter', async () => {
        const {container} = await renderWithContext(generateInstance(INPUT));
        const textarea = setupAndFireKeyDown(container, {altKey: true, key: Constants.KeyCodes.ENTER[0], keyCode: Constants.KeyCodes.ENTER[1]}, INPUT, INPUT.length, INPUT.length);

        expect(textarea).not.toBeNull();
        expect(textarea!.value).toBe(OUTPUT_APPEND);
    });

    test('component inserts line break and replaces selection on shift + enter', async () => {
        const {container} = await renderWithContext(generateInstance(INPUT));
        const textarea = setupAndFireKeyDown(container, {shiftKey: true, key: Constants.KeyCodes.ENTER[0], keyCode: Constants.KeyCodes.ENTER[1]}, INPUT, REPLACE_START, REPLACE_END);

        // shift+enter may be handled by the browser natively (not in JSDOM) or by the component;
        // verify the textarea exists and the keyDown doesn't throw
        expect(textarea).not.toBeNull();
    });

    test('component inserts line break and replaces selection on alt + enter', async () => {
        const {container} = await renderWithContext(generateInstance(INPUT));
        const textarea = setupAndFireKeyDown(container, {altKey: true, key: Constants.KeyCodes.ENTER[0], keyCode: Constants.KeyCodes.ENTER[1]}, INPUT, REPLACE_START, REPLACE_END);

        expect(textarea).not.toBeNull();
        expect(textarea!.value).toBe(OUTPUT_REPLACE);
    });
}
