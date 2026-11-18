// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// The deadline at the level of the page's events, without a browser: a fake page emits a request whose response or
// body never completes, and the wait must still end at its timeout and let go of the page.

import {EventEmitter} from 'node:events';

import {expect, test} from '@playwright/test';
import type {Locator, Page} from '@playwright/test';

import {ButtonDriver} from '../src/aria/drivers';
import {apiOp, defineApi} from '../src/aria/api';
import {settle, SettleError, waitForApi} from '../src/aria/settle';

import {unexpected} from './serve';

const {CreatePost} = defineApi({
    CreatePost: apiOp<{id: string}>()({op: 'CreatePost', method: 'POST', path: '/api/v4/posts'}),
});

const never = <T>() => new Promise<T>(() => undefined);

/** A request to `/api/v4/posts` whose response arrives at once; its body as `text()` gives it. */
function postRequest(text: () => Promise<string>) {
    const req = {
        url: () => 'http://app/api/v4/posts',
        method: () => 'POST',
        redirectedFrom: () => null,
        redirectedTo: () => null,
        response: async () => res,
    };
    const res = {status: () => 200, ok: () => true, text, request: () => req, url: req.url};
    return req;
}

function fakePage() {
    const page = new EventEmitter();
    const locator = {page: () => page, click: async () => undefined} as unknown as Locator;
    return {page, locator};
}

async function within<T>(p: Promise<T>, ms: number): Promise<T | 'still pending'> {
    return Promise.race([p, new Promise<'still pending'>((resolve) => setTimeout(() => resolve('still pending'), ms))]);
}

test('settle: a body that never completes fails at the timeout and releases the page', async () => {
    const {page, locator} = fakePage();
    const save = new ButtonDriver(locator, {
        testId: 'probe.save--button',
        role: 'button',
        source: 'Probe',
    });
    (locator as unknown as {click: () => Promise<void>}).click = async () => {
        page.emit('request', postRequest(never));
    };
    const started = Date.now();
    const outcome = await within(
        settle(save, {wait: CreatePost, timeout: 20})
            .click()
            .then(
                () => 'fulfilled',
                (e: unknown) => e,
            ),
        500,
    );
    expect(outcome).toBeInstanceOf(SettleError);
    expect((outcome as Error).message).toContain('did not arrive within 20 ms');
    expect(Date.now() - started).toBeLessThan(500);
    expect(page.listenerCount('request')).toBe(0);
});

test('waitForApi: a predicate that never returns fails at the timeout and releases the page', async () => {
    const {page} = fakePage();
    const waiting = waitForApi(page as unknown as Page, CreatePost, {timeout: 20, predicate: never});
    page.emit(
        'request',
        postRequest(async () => '{}'),
    );
    const outcome = await within(
        waiting.then(
            () => 'fulfilled',
            (e: unknown) => e,
        ),
        500,
    );
    expect(outcome).toBeInstanceOf(SettleError);
    expect(page.listenerCount('request')).toBe(0);
});

test('waitForApi: a body that never completes fails at the timeout', async () => {
    const {page} = fakePage();
    const waiting = waitForApi(page as unknown as Page, CreatePost, {timeout: 20});
    page.emit('request', postRequest(never));
    const outcome = await within(
        waiting.then(
            () => 'fulfilled',
            (e: unknown) => e,
        ),
        500,
    );
    expect(outcome).toBeInstanceOf(SettleError);
});

test('settle: an action that sends nothing fails at its deadline and releases the page', async () => {
    const {page, locator} = fakePage();
    const save = new ButtonDriver(locator, {
        testId: 'probe.save--button',
        role: 'button',
        source: 'Probe',
    });
    const started = Date.now();
    const error = await settle(save, {wait: CreatePost, timeout: 20})
        .click()
        .then(unexpected, (e: unknown) => e as Error);
    expect(error).toBeInstanceOf(SettleError);
    expect(error.message).toContain('no POST /api/v4/posts (CreatePost) within 20 ms');
    expect(Date.now() - started).toBeLessThan(500);
    expect(page.listenerCount('request')).toBe(0);
});

const connectionReset = () => Promise.reject(new Error('net::ERR_CONNECTION_RESET'));

test('settle: a body that fails to read is a failure, not an empty body, and releases the page', async () => {
    const {page, locator} = fakePage();
    const save = new ButtonDriver(locator, {
        testId: 'probe.save--button',
        role: 'button',
        source: 'Probe',
    });
    (locator as unknown as {click: () => Promise<void>}).click = async () => {
        page.emit('request', postRequest(connectionReset));
    };
    const error = await settle(save, {wait: CreatePost, timeout: 1_000})
        .click()
        .then(unexpected, (e: unknown) => e as Error);
    expect(error).toBeInstanceOf(SettleError);
    expect(error.message).toContain('could not be read');
    expect(error.message).toContain('ERR_CONNECTION_RESET');
    expect(page.listenerCount('request')).toBe(0);
});

test('waitForApi: a body that fails to read is a failure, not an empty body, and releases the page', async () => {
    const {page} = fakePage();
    const waiting = waitForApi(page as unknown as Page, CreatePost, {timeout: 1_000});
    page.emit('request', postRequest(connectionReset));
    const error = await waiting.then(unexpected, (e: unknown) => e as Error);
    expect(error).toBeInstanceOf(SettleError);
    expect(error.message).toContain('could not be read');
    expect(page.listenerCount('request')).toBe(0);
});

test('waitForApi: past the deadline an immediate result is not accepted, even after a predicate that overran it', async () => {
    const {page} = fakePage();
    const waiting = waitForApi(page as unknown as Page, CreatePost, {
        timeout: 5,
        predicate: () => {
            // synchronous work that runs past the deadline before it returns true
            const until = Date.now() + 30;
            while (Date.now() < until) {
                // busy
            }
            return true;
        },
    });
    page.emit(
        'request',
        postRequest(async () => '{"id": "p1"}'),
    );
    const error = await waiting.then(unexpected, (e: unknown) => e as Error);
    expect(error).toBeInstanceOf(SettleError);
    expect(error.message).toContain('did not return within 5 ms');
    expect(page.listenerCount('request')).toBe(0);
});
