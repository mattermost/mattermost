// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ExpectMatcherState, Locator} from '@playwright/test';
import {expect as baseExpect} from '@playwright/test';

import {expect as subpathExpect} from '../expect';

import {Driver, withElement, type AnyDriver, type ElementInfo} from './drivers';
import {formatMessage, type Message, type ParamsOf} from './msg';
import {KeyedList, Scope} from './scope';

type MatcherOptions = {timeout?: number};

/** The subpath-aware expect (`toHavePath`, `toHaveHrefPath`) is the base every assertion builds on. */
type BaseExpect = typeof subpathExpect;

type LocatorAssertions = ReturnType<typeof subpathExpect<Locator>>;

/** The matchers over ARIA state. */
export type AriaMatchers = {
    toBeOn(options?: MatcherOptions): Promise<void>;
    toBePressed(options?: MatcherOptions): Promise<void>;
    toBeSelected(options?: MatcherOptions): Promise<void>;
    toBeExpanded(options?: MatcherOptions): Promise<void>;
    toBeSaved(options?: MatcherOptions): Promise<void>;
};

/** The matchers over catalog messages: the element shows the message the UI formats, with the same values. */
export type MessageMatchers = {
    toContainMessage<M extends Message<any>>(message: M, values?: ParamsOf<M>, options?: MatcherOptions): Promise<void>;
    toHaveMessage<M extends Message<any>>(message: M, values?: ParamsOf<M>, options?: MatcherOptions): Promise<void>;
};

type OwnMatchers = AriaMatchers & MessageMatchers;

export type ElementAssertions = LocatorAssertions &
    OwnMatchers & {readonly not: LocatorAssertions['not'] & OwnMatchers};

export type ListAssertions<K> = {
    toHaveKeys(expected: readonly K[], options?: MatcherOptions & {ordered?: boolean}): Promise<void>;
    toContainKeys(expected: readonly K[], options?: MatcherOptions): Promise<void>;
    toHaveKeyCount(count: number, options?: MatcherOptions): Promise<void>;
    readonly not: Omit<ListAssertions<K>, 'not'>;
};

/** `never` for `any` and `unknown`, so a value whose type isn't known (a parsed body) is not taken for an element and gets every matcher. */
type NotAny<T> = T & (unknown extends T ? never : unknown);

type ExpectElement = {
    /**
     * A driver or a scope is asserted on directly, with every locator matcher and the ARIA ones:
     * `await expect(modal.confirmButton).toBeEnabled()`. Specs never reach for `.locator` to assert. A failure ends
     * with the element's testid and component. `NotRendered` is neither, so asserting on a part its mount never
     * renders does not compile.
     *
     * (Generic so that these signatures win over Playwright's own `<T>(actual: T)`, which accepts anything.)
     */
    <E extends AnyDriver | Scope<any> | Locator>(
        actual: NotAny<E>,
        messageOrOptions?: string | {message?: string; timeout?: number},
    ): ElementAssertions;
    <L extends KeyedList<any, unknown>>(
        actual: NotAny<L>,
        messageOrOptions?: string | {message?: string},
    ): ListAssertions<L extends KeyedList<infer K, unknown> ? K : never>;
};

/** Playwright's `expect` without its call signature: `poll`, `extend`, `configure`, the asymmetric matchers. */
type ExpectStatics = {readonly [K in keyof BaseExpect]: BaseExpect[K]};

/**
 * The lib's `expect`: Playwright's, with drivers, scopes and keyed lists accepted wherever a locator is. Any other
 * value is asserted on as before.
 */
export type SurfaceExpect = ExpectElement &
    (<T>(
        actual: T,
        messageOrOptions?: string | {message?: string; timeout?: number},
    ) => ReturnType<typeof subpathExpect<T>>) &
    Omit<ExpectStatics, 'soft'> & {readonly soft: ExpectElement & BaseExpect['soft']};

/** Retrying matchers over ARIA state, catalog messages and keyed lists. They retry like `toBeVisible()`. */
const extended = subpathExpect.extend({
    /** A switch or checkbox that is on: `aria-checked="true"`, or a native input's checked state (compass's Switch). */
    async toBeOn(this: ExpectMatcherState, received: Locator, options?: MatcherOptions) {
        try {
            await baseExpect(received).toBeChecked({checked: !this.isNot, ...options});
            return {pass: !this.isNot, name: 'toBeOn', message: () => `toBeOn: is ${this.isNot ? 'off' : 'on'}`};
        } catch (e) {
            return {
                pass: this.isNot,
                name: 'toBeOn',
                message: () => `toBeOn: expected ${this.isNot ? 'off' : 'on'}\n${(e as Error).message}`,
            };
        }
    },
    async toBePressed(this: ExpectMatcherState, received: Locator, options?: MatcherOptions) {
        return attribute.call(this, 'toBePressed', received, 'aria-pressed', 'true', options);
    },
    async toBeSelected(this: ExpectMatcherState, received: Locator, options?: MatcherOptions) {
        return attribute.call(this, 'toBeSelected', received, 'aria-selected', 'true', options);
    },
    async toBeExpanded(this: ExpectMatcherState, received: Locator, options?: MatcherOptions) {
        return attribute.call(this, 'toBeExpanded', received, 'aria-expanded', 'true', options);
    },

    /**
     * A save button whose save has finished: disabled again and no longer busy. It's disabled while it saves too,
     * so `toBeDisabled()` alone passes mid-save, and a reload then drops the save.
     */
    async toBeSaved(this: ExpectMatcherState, received: Locator, options?: MatcherOptions) {
        if (this.isNot) {
            throw new Error('not.toBeSaved() is ambiguous (unsaved, or still saving?): assert toBeEnabled() instead');
        }
        // both read in one snapshot: checked one after the other, 'disabled' can hold while it saves and 'not busy'
        // once a failed save has enabled it again, and the matcher would pass a save that never finished
        const state = () =>
            received.evaluate((el) => ({
                disabled: el.matches(':disabled') || el.getAttribute('aria-disabled') === 'true',
                busy: el.getAttribute('aria-busy') === 'true',
            }));
        let last: {disabled: boolean; busy: boolean} | undefined;
        try {
            await baseExpect
                .poll(
                    async () => {
                        last = await state();
                        return last.disabled && !last.busy;
                    },
                    {timeout: options?.timeout ?? this.timeout},
                )
                .toBe(true);
            return {pass: true, name: 'toBeSaved', message: () => 'toBeSaved: disabled and not busy'};
        } catch (e) {
            const seen = last
                ? ` (last seen: ${last.disabled ? 'disabled' : 'enabled'}, ${last.busy ? 'busy' : 'not busy'})`
                : '';
            return {
                pass: false,
                name: 'toBeSaved',
                message: () =>
                    `toBeSaved: expected the save to finish (disabled, not busy)${seen}\n${(e as Error).message}`,
            };
        }
    },

    /** The element's text contains the catalog message, formatted with `values`. */
    async toContainMessage<M extends Message<any>>(
        this: ExpectMatcherState,
        received: Locator,
        message: M,
        values?: ParamsOf<M>,
        options?: MatcherOptions,
    ) {
        return messageText.call(
            this,
            'toContainMessage',
            received,
            formatMessage(message, values),
            message.id,
            false,
            options,
        );
    },

    /** The element's whole text is the catalog message (where one message's text contains another's: "Follow" / "Following"). */
    async toHaveMessage<M extends Message<any>>(
        this: ExpectMatcherState,
        received: Locator,
        message: M,
        values?: ParamsOf<M>,
        options?: MatcherOptions,
    ) {
        return messageText.call(
            this,
            'toHaveMessage',
            received,
            formatMessage(message, values),
            message.id,
            true,
            options,
        );
    },

    /** The list shows exactly these keys (in this order unless `ordered: false`); retries until it does. */
    async toHaveKeys<K extends string | number>(
        this: ExpectMatcherState,
        received: KeyedList<K, unknown>,
        expected: readonly K[],
        options?: MatcherOptions & {ordered?: boolean},
    ) {
        const ordered = options?.ordered ?? true;
        const norm = (keys: readonly unknown[]) => {
            const strings = keys.map(String);
            return ordered ? strings : strings.sort();
        };
        return keyPoll.call(
            this,
            'toHaveKeys',
            received,
            async (keys) => norm(keys),
            (p) => p.toEqual(norm(expected)),
            options,
        );
    },

    /** The list shows at least these keys (in any order); retries until it does. */
    async toContainKeys<K extends string | number>(
        this: ExpectMatcherState,
        received: KeyedList<K, unknown>,
        expected: readonly K[],
        options?: MatcherOptions,
    ) {
        return keyPoll.call(
            this,
            'toContainKeys',
            received,
            async (keys) => keys.map(String),
            (p) => p.toEqual(baseExpect.arrayContaining(expected.map(String))),
            options,
        );
    },

    /** The list shows this many items; retries until it does. */
    async toHaveKeyCount(
        this: ExpectMatcherState,
        received: KeyedList<string | number, unknown>,
        count: number,
        options?: MatcherOptions,
    ) {
        return keyPoll.call(
            this,
            'toHaveKeyCount',
            received,
            async (keys) => keys.length,
            (p) => p.toBe(count),
            options,
        );
    },
});

/** The locator to assert on for a driver or a scope, and what a failure says about it. */
function unwrap(actual: unknown): {value: unknown; info?: ElementInfo} {
    if (actual instanceof Driver) {
        return {value: actual.locator, info: actual.meta};
    }
    if (actual instanceof Scope) {
        return {value: actual.locator, info: {testId: actual.scope, source: actual.constructor.name}};
    }
    return {value: actual};
}

/** Assertions whose failures end with the element's testid and component. */
function annotated<T extends object>(assertions: T, info: ElementInfo): T {
    return new Proxy(assertions, {
        get(target, prop, receiver) {
            const value = Reflect.get(target, prop, receiver);
            if (prop === 'not' && value && typeof value === 'object') {
                return annotated(value, info);
            }
            if (typeof value !== 'function') {
                return value;
            }
            return (...args: unknown[]) => {
                let result: unknown;
                try {
                    result = value.apply(target, args);
                } catch (e) {
                    throw withElement(e, info);
                }
                if (result instanceof Promise) {
                    return result.catch((e: unknown) => {
                        throw withElement(e, info);
                    });
                }
                return result;
            };
        },
    });
}

type AnyExpect = (actual: unknown, messageOrOptions?: unknown) => object;

function accepting(base: AnyExpect): AnyExpect {
    return (actual, messageOrOptions) => {
        const {value, info} = unwrap(actual);
        const assertions = base(value, messageOrOptions);
        return info ? annotated(assertions, info) : assertions;
    };
}

const call = accepting(extended as unknown as AnyExpect);
const soft = accepting(extended.soft as unknown as AnyExpect);

/**
 * The lib's `expect`: Playwright's, with the subpath matchers, drivers, scopes and keyed lists accepted wherever a
 * locator is, and the matchers above.
 */
export const expect = new Proxy(call, {
    get(_, prop) {
        if (prop === 'soft') {
            return new Proxy(soft, {get: (target, p) => Reflect.get(extended.soft, p)});
        }
        return Reflect.get(extended, prop);
    },
}) as unknown as SurfaceExpect;

/** A list matcher: polls the list's keys (mapped by `read`) until `check` passes. */
async function keyPoll<T>(
    this: ExpectMatcherState,
    name: string,
    received: KeyedList<any, unknown>,
    read: (keys: unknown[]) => Promise<T>,
    check: (poll: any) => Promise<unknown>,
    options?: MatcherOptions,
) {
    if (!(received instanceof KeyedList)) {
        throw new Error(`${name}: expected a KeyedList (a page object's list of keyed items), got ${String(received)}`);
    }
    const poll = baseExpect.poll(async () => read(await received.keys()), {timeout: options?.timeout ?? this.timeout});
    try {
        await check(this.isNot ? poll.not : poll);
        return {pass: !this.isNot, name, message: () => `${name}: ${received.label}`};
    } catch (e) {
        let keys = '';
        try {
            keys = (await received.keys()).join(', ');
        } catch {
            // the page is gone: the poll's own message says what it last saw
        }
        return {
            pass: this.isNot,
            name,
            message: () =>
                `${name}: ${received.label}${this.isNot ? ' (not)' : ''}; keys now: [${keys}]\n${(e as Error).message}`,
        };
    }
}

async function attribute(
    this: ExpectMatcherState,
    name: string,
    locator: Locator,
    attr: string,
    value: string,
    options?: MatcherOptions,
) {
    try {
        if (this.isNot) {
            await baseExpect(locator).not.toHaveAttribute(attr, value, options);
        } else {
            await baseExpect(locator).toHaveAttribute(attr, value, options);
        }
        return {pass: !this.isNot, name, message: () => `${name}: ${attr} is ${this.isNot ? 'not ' : ''}"${value}"`};
    } catch (e) {
        return {
            pass: this.isNot,
            name,
            message: () =>
                `${name}: expected ${attr}${this.isNot ? ' not' : ''} to be "${value}"\n${(e as Error).message}`,
        };
    }
}

async function messageText(
    this: ExpectMatcherState,
    name: string,
    locator: Locator,
    text: string,
    id: string,
    exact: boolean,
    options?: MatcherOptions,
) {
    const verb = exact ? 'have' : 'contain';
    try {
        const e = this.isNot ? baseExpect(locator).not : baseExpect(locator);
        await (exact ? e.toHaveText(text, options) : e.toContainText(text, options));
        return {
            pass: !this.isNot,
            name,
            message: () => `expected ${this.isNot ? 'not ' : ''}to ${verb} "${text}" (${id})`,
        };
    } catch (e) {
        return {
            pass: this.isNot,
            name,
            message: () =>
                `${this.isNot ? 'expected not ' : 'expected '}to ${verb} message ${id}: "${text}"\n${(e as Error).message}`,
        };
    }
}
