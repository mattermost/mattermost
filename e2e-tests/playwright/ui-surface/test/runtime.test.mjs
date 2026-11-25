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
    formatMessage,
    messageFragment,
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
        responses: [
            {
                request: () => ({method: () => 'POST'}),
                url: () => 'http://localhost:8065/api/v4/posts',
                status: () => 201,
                ok: () => true,
                text: async () => JSON.stringify({id: 'post1'}),
            },
        ],
    });
    const created = await settle(elementDriver(okPage, 'center.send--button'), {wait: op}).click();
    assert.deepEqual(created, {id: 'post1'});

    const errPage = mockPage({
        responses: [
            {
                request: () => ({method: () => 'POST'}),
                url: () => 'http://localhost:8065/api/v4/posts',
                status: () => 500,
                ok: () => false,
                text: async () => 'internal error',
            },
        ],
    });
    await assert.rejects(
        () => settle(elementDriver(errPage, 'center.send--button'), {wait: op}).click(),
        SettleHttpError,
    );

    const timeoutPage = mockPage({
        requests: [{method: () => 'GET', url: () => 'http://localhost:8065/api/v4/users/me'}],
    });
    await assert.rejects(
        () => settle(elementDriver(timeoutPage, 'center.send--button'), {wait: op, timeout: 10}).click(),
        (err) => err instanceof SettleTimeoutError && err.message.includes('GET /api/v4/users/me'),
    );

    const patchOp = {
        id: 'PatchChannel',
        method: 'PUT',
        path: '/api/v4/channels/{channel_id}/patch',
        pathParams: ['channel_id'],
    };
    await assert.rejects(
        () =>
            settle(elementDriver(okPage, 'channel_settings.save--button'), {
                wait: patchOp,
                params: {channelId: 'abc'},
            }).click(),
        (err) => err instanceof TypeError && err.message.includes('"channelId"') && err.message.includes('channel_id'),
    );

    const strictError = new Error('strict mode violation');
    await assert.rejects(
        () =>
            settle(
                {
                    testId: 'center.send--button',
                    locator: {page: () => mockPage()},
                    click: async () => {
                        throw strictError;
                    },
                },
                {wait: op},
            ).click(),
        (err) => err === strictError && !(err instanceof SettleTimeoutError),
    );
});

test('clickTo rejects already-visible destinations and StateDriver rejects broken ARIA semantics', async () => {
    const page = mockPage({stateCheck: false});
    const alreadyOpenDest = {
        testId: 'modal.panel',
        locator: {isVisible: async () => true},
    };
    await assert.rejects(() => elementDriver(page, 'header.open--button').clickTo(alreadyOpenDest), DestinationError);
    await assert.rejects(
        () => stateDriver(page, 'settings.toggle--checkbox', 'checkbox').isChecked(),
        SemanticRoleError,
    );
});

test('StateDriver.setChecked clicks associated label when present and falls back to control click', async () => {
    const clicks = [];

    // assertStateSemantics passes (fn, role); the label lookup passes only fn. Any click flips the state.
    const makeSwitchPage = (labelTarget) => {
        let checked = true;
        const flip = (what) => async () => {
            clicks.push(what);
            checked = !checked;
        };
        const pageObj = {
            locator: (sel) => ({click: flip(sel)}),
            getByTestId: () => ({
                page: () => pageObj,
                isChecked: async () => checked,
                evaluate: async (_fn, role) => (role === undefined ? labelTarget : true),
                click: flip('direct'),
            }),
        };
        return pageObj;
    };

    await stateDriver(makeSwitchPage('join-leave-id'), 'settings.join_leave--switch', 'switch').uncheck();
    await stateDriver(makeSwitchPage(null), 'settings.plain--checkbox', 'checkbox').uncheck();
    assert.deepEqual(clicks, ['label[for="join-leave-id"]', 'direct']);
});

test('StateDriver reads tab/option state from aria-selected and fails when a click does not change state', async () => {
    const tabPage = {
        getByTestId: () => ({
            page: () => tabPage,
            isChecked: async () => {
                throw new Error('isChecked() must not be called for aria-selected roles');
            },
            evaluate: async (_fn, role) => role === undefined || true,
            click: async () => undefined,
        }),
    };
    assert.equal(await stateDriver(tabPage, 'settings.general--tab', 'tab').isChecked(), true);
    await assert.rejects(() => stateDriver(tabPage, 'settings.general--tab', 'tab').uncheck(), TypeError);

    const stuck = {
        getByTestId: () => ({
            page: () => stuck,
            isChecked: async () => false,
            evaluate: async (_fn, role) => (role === undefined ? null : true),
            click: async () => undefined,
        }),
    };
    await assert.rejects(
        () => stateDriver(stuck, 'settings.stuck--checkbox', 'checkbox').setChecked(true),
        /did not become checked/,
    );
});

test('formatMessage fills simple placeholders and rejects ICU plural/select messages', () => {
    assert.equal(formatMessage('Hello {name}', {name: 'Ana'}), 'Hello Ana');
    assert.throws(() => formatMessage('{count, plural, one {# reply} other {# replies}}', {count: 2}), /ICU message/);
});

test('messageFragment returns the longest static run of an en.json message', () => {
    assert.equal(messageFragment('{firstUser} **joined the channel**.'), 'joined the channel');
    assert.equal(messageFragment('{firstUser} **added to the channel** by {actor}.'), 'added to the channel');
    assert.equal(
        messageFragment('Channel names must have at least 1 character.'),
        'Channel names must have at least 1 character',
    );
    assert.throws(() => messageFragment('{only}'), /no static text/);
});
