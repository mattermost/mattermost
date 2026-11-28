// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// The verb list against the drivers: every acting method of a driver is a verb, and every verb is some driver's.

import {expect, test} from '@playwright/test';

import * as drivers from '../src/aria/drivers';
import {OBSERVING_VERBS, PREPARING_VERBS, VERBS} from '../src/aria/verbs';

// every method a driver class has, by class
const classes = Object.entries(drivers).filter(
    ([name, value]) => typeof value === 'function' && /Driver$/.test(name),
) as Array<[string, {prototype: object}]>;

const methodsOf = (cls: {prototype: object}) => {
    const names = new Set<string>();
    for (let proto = cls.prototype; proto && proto !== Object.prototype; proto = Object.getPrototypeOf(proto)) {
        for (const name of Object.getOwnPropertyNames(proto)) {
            if (name !== 'constructor') {
                names.add(name);
            }
        }
    }
    return names;
};

// Playwright actions a driver doesn't wrap: on the list so the lint rules see them on a raw Locator
const PLAYWRIGHT_ONLY = new Set(['dragTo']);

test('every verb is a method of some driver, or a Playwright action the lint rules read', () => {
    const all = new Set(classes.flatMap(([, cls]) => [...methodsOf(cls)]));
    for (const verb of VERBS) {
        expect(all.has(verb) || PLAYWRIGHT_ONLY.has(verb), verb).toBe(true);
    }
});

test('every driver method that acts is a verb; the rest only read or move nothing', () => {
    const verbs: ReadonlySet<string> = new Set(VERBS);
    const reads = new Set([
        'page',
        'isVisible',
        'isDisabled',
        'scrollIntoView',
        'step',
        'href',
        'isChecked',
        'isPressed',
        'isOn',
        'radio',
        'isChosen',
        'value',
        'isSelected',
        'isExpanded',
        'text',
        'textIfPresent',
        'flip',
        'chooseNative',
        'optionsHost',
        'input',
    ]);
    for (const [name, cls] of classes) {
        for (const method of methodsOf(cls)) {
            expect(verbs.has(method) || reads.has(method), `${name}.${method}`).toBe(true);
        }
    }
});

test('the preparing and observing verbs are verbs, and leaving a field is not preparing', () => {
    const verbs: readonly string[] = VERBS;
    expect(PREPARING_VERBS.every((verb) => verbs.includes(verb))).toBe(true);
    expect((PREPARING_VERBS as readonly string[]).includes('blur')).toBe(false);
    expect([...OBSERVING_VERBS]).toEqual(['clickTo', 'pressTo']);
});

test('every driver has pressTo; clickTo is on the drivers that click', () => {
    for (const [name, cls] of classes) {
        const methods = methodsOf(cls);
        expect(methods.has('pressTo'), name).toBe(true);
        expect(methods.has('clickTo'), name).toBe(methods.has('click'));
    }
});
