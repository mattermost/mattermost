// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {test} from 'node:test';

import {
    Deadline,
    DestinationError,
    elementDriver,
    SemanticRoleError,
    stateDriver,
} from '../../lib/dist/surface/drivers.js';
import {
    settle,
    SettleHttpError,
    SettleTimeoutError,
} from '../../lib/dist/surface/settle.js';

function mockPage({responses = [], requests = [], stateCheck = true} = {}) {
    const emitter = new EventEmitter();
    return {
        on: (ev, fn) => emitter.on(ev, fn),
        off: (ev, fn) => emitter.off(ev, fn),
        waitForResponse: async (pred) => {
            for (const req of requests) {
                emitter.emit('request', req);
            }
            for (const res of responses) {
                if (pred(res)) {
                    return res;
                }
            }
            throw new Error('timeout');
        },
        getByTestId: (id) => ({
            page: () => mockPage({responses, requests, stateCheck}),
            click: async () => undefined,
            isVisible: async () => false,
            isChecked: async () => true,
            evaluate: async () => stateCheck,
            textContent: async () => id,
        }),
    };
}

test('Deadline enforces positive remaining budget', () => {
    const deadline = new Deadline(100);
    assert.ok(deadline.remaining() >= 1 && deadline.remaining() <= 100);
});

test('settle succeeds with JSON, fails fast on 500, and lists observed requests on timeout', async () => {
    const op = {id: 'CreatePost', method: 'POST', path: '/api/v4/posts'};
    const okPage = mockPage({
        responses: [{
            request: () => ({method: () => 'POST'}),
            url: () => 'http://localhost:8065/api/v4/posts',
            status: () => 201,
            ok: () => true,
            text: async () => JSON.stringify({id: 'post1'}),
        }],
    });
    const created = await settle(elementDriver(okPage, 'center.send--button'), {wait: op}).click();
    assert.deepEqual(created, {id: 'post1'});

    const errPage = mockPage({
        responses: [{
            request: () => ({method: () => 'POST'}),
            url: () => 'http://localhost:8065/api/v4/posts',
            status: () => 500,
            ok: () => false,
            text: async () => 'internal error',
        }],
    });
    await assert.rejects(() => settle(elementDriver(errPage, 'center.send--button'), {wait: op}).click(), SettleHttpError);

    const timeoutPage = mockPage({
        requests: [{method: () => 'GET', url: () => 'http://localhost:8065/api/v4/users/me'}],
    });
    await assert.rejects(
        () => settle(elementDriver(timeoutPage, 'center.send--button'), {wait: op, timeout: 10}).click(),
        (err) => err instanceof SettleTimeoutError && err.message.includes('GET /api/v4/users/me'),
    );

    const strictError = new Error('strict mode violation');
    await assert.rejects(
        () => settle({
            testId: 'center.send--button',
            locator: {page: () => mockPage()},
            click: async () => {
                throw strictError;
            },
        }, {wait: op}).click(),
        (err) => err === strictError && !(err instanceof SettleTimeoutError),
    );
});

test('clickTo rejects already-visible destinations and StateDriver rejects broken ARIA semantics', async () => {
    const page = mockPage({stateCheck: false});
    const alreadyOpenDest = {
        testId: 'modal.panel',
        locator: {isVisible: async () => true},
    };
    await assert.rejects(
        () => elementDriver(page, 'header.open--button').clickTo(alreadyOpenDest),
        DestinationError,
    );
    await assert.rejects(
        () => stateDriver(page, 'settings.toggle--checkbox', 'checkbox').isChecked(),
        SemanticRoleError,
    );
});

test('StateDriver.setChecked clicks associated label when present and falls back to control click', async () => {
    const clicks = [];
    const makeSwitchPage = (evalResult) => {
        let evalCalls = 0;
        const pageObj = {
            locator: (sel) => ({click: async () => clicks.push(sel)}),
            getByTestId: () => ({
                page: () => pageObj,
                isChecked: async () => true,
                evaluate: async () => {
                    evalCalls += 1;
                    return evalCalls <= 2 ? true : evalResult;
                },
                click: async () => clicks.push('direct'),
            }),
        };
        return pageObj;
    };

    await stateDriver(makeSwitchPage('join-leave-id'), 'settings.join_leave--switch', 'switch').uncheck();
    await stateDriver(makeSwitchPage(null), 'settings.plain--checkbox', 'checkbox').uncheck();
    assert.deepEqual(clicks, ['label[for="join-leave-id"]', 'direct']);
});
