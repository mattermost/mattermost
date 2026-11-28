// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// clickTo's one budget, without a browser: a fake page whose steps finish late, or never, must fail at the deadline,
// and nothing that comes back after it is accepted.

import {expect, test} from '@playwright/test';
import type {Locator, Page} from '@playwright/test';

import {DestinationError} from '../src/aria/destinations';
import {ButtonDriver} from '../src/aria/drivers';
import {SurfacePage} from '../src/aria/pages';

import {unexpected} from './serve';

const later = <T>(ms: number, value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));
const never = <T>() => new Promise<T>(() => undefined);

/** A fake page at `path`, and a driver on it whose click runs `onClick`. */
function fakePage(path = '/start') {
    const state = {path, clicks: 0};
    const page = {url: () => `http://app${state.path}`} as unknown as Page;
    const button = (onClick: () => Promise<void>) =>
        new ButtonDriver(
            {
                page: () => page,
                click: async () => {
                    state.clicks++;
                    await onClick();
                },
            } as unknown as Locator,
            {testId: 'probe.go--button', role: 'button', source: 'Probe'},
        );
    return {page, state, button};
}

/** An element on `page` whose visibility check and wait take as long as given. */
function element(page: Page, opts: {visible?: () => Promise<boolean>; shows?: () => Promise<void>} = {}) {
    return {
        locator: {
            page: () => page,
            isVisible: opts.visible ?? (async () => false),
            waitFor: opts.shows ?? (async () => undefined),
        } as unknown as Locator,
        meta: {testId: 'probe.dialog--dialog', role: 'dialog' as const, source: 'Probe'},
    };
}

class ProbePage extends SurfacePage<void, true> {
    constructor(
        page: Page,
        private readonly readyCheck: () => Promise<boolean>,
    ) {
        super(page);
    }

    pathFor(): string {
        return '/there';
    }

    get ready(): readonly [Locator] {
        return [{isVisible: this.readyCheck} as unknown as Locator];
    }
}

test('an action that finishes after the deadline is a failure, even when the destination is there', async () => {
    const {page, button} = fakePage();
    const error = await button(() => later(30, undefined))
        .clickTo(element(page), {timeout: 5})
        .then(unexpected, (e: unknown) => e as Error);
    expect(error).toBeInstanceOf(DestinationError);
    expect(error.message).toContain('the action did not finish within 5 ms');
});

test('a page reached by an action that finishes late is a failure', async () => {
    const {page, state, button} = fakePage();
    const slow = button(async () => {
        state.path = '/there';
        await later(30, undefined);
    });
    const error = await slow
        .clickTo(new ProbePage(page, async () => true), undefined, {timeout: 5})
        .then(unexpected, (e: unknown) => e as Error);
    expect(error).toBeInstanceOf(DestinationError);
    expect(error.message).toContain('the action did not finish within 5 ms');
});

test('a check before acting that finishes after the deadline fails without acting', async () => {
    const {page, state, button} = fakePage();
    const error = await button(async () => undefined)
        .clickTo(element(page, {visible: () => later(30, false)}), {timeout: 5})
        .then(unexpected, (e: unknown) => e as Error);
    expect(error).toBeInstanceOf(DestinationError);
    expect(error.message).toContain('before acting did not finish within 5 ms');
    expect(state.clicks).toBe(0);
});

test('a ready check that never returns fails at the deadline', async () => {
    const {page, state, button} = fakePage();
    const started = Date.now();
    const error = await button(async () => {
        state.path = '/there';
    })
        .clickTo(new ProbePage(page, never), undefined, {timeout: 20})
        .then(unexpected, (e: unknown) => e as Error);
    expect(error).toBeInstanceOf(DestinationError);
    expect(error.message).toContain('did not reach ProbePage (/there) within 20 ms');
    expect(Date.now() - started).toBeLessThan(500);
});

test('a wait for the destination that never returns fails at the deadline', async () => {
    const {page, button} = fakePage();
    const started = Date.now();
    const error = await button(async () => undefined)
        .clickTo(element(page, {shows: never}), {timeout: 20})
        .then(unexpected, (e: unknown) => e as Error);
    expect(error).toBeInstanceOf(DestinationError);
    expect(error.message).toContain('did not show "probe.dialog--dialog" (Probe) within 20 ms');
    expect(Date.now() - started).toBeLessThan(500);
});

test('within the budget, clickTo still arrives', async () => {
    const {page, button} = fakePage();
    const dialog = element(page, {shows: () => later(5, undefined)});
    expect(await button(() => later(5, undefined)).clickTo(dialog, {timeout: 1_000})).toBe(dialog);
});
