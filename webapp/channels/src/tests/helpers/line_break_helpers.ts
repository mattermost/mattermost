// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @module lineBreakHelpers
 * consolidate testing of similar behavior across components
 */

import type {ShallowWrapper} from 'enzyme';
import {shallow} from 'enzyme';
import type React from 'react';

import {shallowWithIntl} from 'tests/helpers/intl-test-helper';
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
 * helper to test line break on key down behavior common to many textarea inputs
 * @param  {function} generateInstance - single paramater "value" of the initial value
 * @param  {function} getValue - single parameter for the React Component instance
 * @param  {boolean} intlInhected -
 * NOTE: runs Jest tests
 */
export function testComponentForLineBreak(generateInstance: (input: string) => JSX.Element, getValue: (instance: React.Component<any, any>) => string, intlInjected = true) {
    const shallowRender: (instance: JSX.Element) => ShallowWrapper = intlInjected ? shallowWithIntl : shallow;

    test('component appends line break to input on shift + enter', () => {
        const event = getAppendEvent(getShiftKeyEvent());
        const instance = shallowRender(generateInstance(INPUT));
        instance.simulate('keyDown', event);
        setTimeout(() => {
            expect(getValue(instance.instance())).toBe(OUTPUT_APPEND);
            expect((event.target as any).value).toBe(OUTPUT_APPEND);
        }, 0);
    });

    test('component appends line break to input on alt + enter', () => {
        const event = getAppendEvent(getAltKeyEvent());
        const instance = shallowRender(generateInstance(INPUT));
        instance.simulate('keyDown', event);
        setTimeout(() => {
            expect(getValue(instance.instance())).toBe(OUTPUT_APPEND);
            expect((event.target as any).value).toBe(OUTPUT_APPEND);
        }, 0);
    });

    test('component inserts line break and replaces selection on shift + enter', () => {
        const event = getReplaceEvent(getShiftKeyEvent());
        const instance = shallowRender(generateInstance(INPUT));
        instance.simulate('keyDown', event);
        setTimeout(() => {
            expect(getValue(instance.instance())).toBe(OUTPUT_REPLACE);
            expect((event.target as any).value).toBe(OUTPUT_REPLACE);
        }, 0);
    });

    test('component inserts line break and replaces selection on alt + enter', () => {
        const event = getReplaceEvent(getAltKeyEvent());
        const instance = shallowRender(generateInstance(INPUT));
        instance.simulate('keyDown', event);
        setTimeout(() => {
            expect(getValue(instance.instance())).toBe(OUTPUT_REPLACE);
            expect((event.target as any).value).toBe(OUTPUT_REPLACE);
        }, 0);
    });
}
