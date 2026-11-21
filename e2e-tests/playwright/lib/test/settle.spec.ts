// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'node:path';

import {ButtonDriver} from '../src/aria/drivers';
import {settle, SettleError, waitForApi} from '../src/aria/settle';

import {composer} from './fixture';
import {
    Api,
    CreatePost,
    GetChannel,
    GetMe,
    GetUser,
    GetUsers,
    PatchChannel,
    UploadFile,
    button,
    expect,
    json,
    sleep,
    test,
    unexpected,
} from './serve';

const COMPOSER = [
    button('composer.save--button', "fetch('/api/v4/posts', {method: 'POST'})"),
    button(
        'composer.send--button',
        "fetch('/api/v4/channels/c1/patch', {method: 'PUT'}).then(() => fetch('/api/v4/posts', {method: 'POST', body: 'sent'}))",
    ),
    "<input data-testid=\"composer.message--textbox\" onkeydown=\"if (event.key === 'Enter') fetch('/api/v4/posts', {method: 'POST', body: this.value})\">",
    '<input type="file" multiple data-testid="composer.attach" onchange="for (const f of this.files) fetch(\'/api/v4/files\', {method: \'POST\', body: f.name})">',
    button('composer.action:post--menuitem', "fetch('/api/v4/posts', {method: 'POST'})", 'Post'),
    button('composer.action:a:b--c--menuitem', "fetch('/api/v4/channels/c9/patch', {method: 'PUT'})", 'Patch'),
].join('');

test.describe('settle(driver, {wait})', () => {
    test('waits for the named request and resolves to its body', async ({page, server}) => {
        server.handle((_, res) => json(res, {id: 'p1'}));
        await server.open(page, COMPOSER);
        const post = await settle(composer(page).saveButton, {wait: CreatePost}).click();
        expect(post).toEqual({id: 'p1'});
    });

    test('waits for the named one of several requests, bound to one entity', async ({page, server}) => {
        server.handle((req, res, body) => json(res, {id: req.url === '/api/v4/posts' ? body : 'channel'}));
        await server.open(page, COMPOSER);
        const app = composer(page);
        expect(await settle(app.sendButton, {wait: CreatePost}).click()).toEqual({id: 'sent'});
        expect(await settle(app.sendButton, {wait: PatchChannel, params: {channel_id: 'c1'}}).click()).toEqual({
            id: 'channel',
        });
    });

    test('any verb of the driver can be settled: press on a textbox that sends on Enter', async ({page, server}) => {
        server.handle((_, res, body) => json(res, {id: body}));
        await server.open(page, COMPOSER);
        const message = composer(page).messageTextbox;
        await message.fill('hello');
        expect(await settle(message, {wait: CreatePost}).press('Enter')).toEqual({id: 'hello'});
    });

    test('a key may hold any character', async ({page, server}) => {
        server.handle((req, res) => json(res, {id: req.url!}));
        await server.open(page, COMPOSER);
        expect(await settle(composer(page).action('a:b--c'), {wait: PatchChannel}).click()).toEqual({
            id: '/api/v4/channels/c9/patch',
        });
    });

    test('count: a file input waits for one upload per file, in the order issued', async ({page, server}, testInfo) => {
        server.handle((_, res, body) => json(res, {id: body}));
        await server.open(page, COMPOSER);
        const files = ['a.txt', 'b.txt'].map((name) => testInfo.outputPath(name));
        const fs = await import('node:fs');
        for (const f of files) {
            fs.writeFileSync(f, path.basename(f));
        }
        const uploaded = await settle(composer(page).attach, {wait: UploadFile, count: 2}).chooseFiles(files);
        expect(uploaded).toEqual([{id: 'a.txt'}, {id: 'b.txt'}]);
    });

    test('count must be a positive integer', async ({page, server}) => {
        await server.open(page, COMPOSER);
        expect(() => settle(composer(page).saveButton, {wait: CreatePost, count: 0})).toThrow(/positive integer/);
        expect(() => settle(composer(page).saveButton, {wait: CreatePost, count: 1.5})).toThrow(/positive integer/);
        expect(server.received).toEqual([]);
    });

    test('a wait is required, at run time too', async ({page, server}) => {
        await server.open(page, COMPOSER);
        const save = composer(page).saveButton;
        expect(() => (settle as unknown as (d: unknown, o?: unknown) => unknown)(save)).toThrow(/name the request/);
        expect(server.received).toEqual([]);
    });

    test('clickTo and pressTo are not offered: they wait for a destination', async ({page, server}) => {
        await server.open(page, COMPOSER);
        const verbs = settle(composer(page).saveButton, {wait: CreatePost}) as unknown as Record<string, unknown>;
        expect(typeof verbs.click).toBe('function');
        expect(typeof verbs.press).toBe('function');
        expect(verbs.clickTo).toBeUndefined();
        expect(verbs.pressTo).toBeUndefined();
    });

    test('ignores a matching request already in flight when the action starts', async ({page, server}) => {
        let releaseOld!: () => void;
        const oldHeld = new Promise<void>((resolve) => {
            releaseOld = resolve;
        });
        server.handle(async (_, res, body) => {
            if (body === 'old') {
                await oldHeld;
                json(res, {id: 'old'});
                return;
            }

            // the old request's response arrives first, after the action's request was issued
            releaseOld();
            await sleep(300);
            json(res, {id: 'new'});
        });
        await server.open(
            page,
            button('composer.save--button', "fetch('/api/v4/posts', {method: 'POST', body: 'new'})"),
        );
        const inFlight = page.waitForRequest('**/api/v4/posts');
        await page.evaluate(() => {
            fetch('/api/v4/posts', {method: 'POST', body: 'old'}).catch(() => undefined);
        });
        await inFlight;
        expect(await settle(composer(page).saveButton, {wait: CreatePost}).click()).toEqual({id: 'new'});
    });

    test('follows a redirect to the final response', async ({page, server}) => {
        server.handle((req, res) => {
            if (req.url === '/api/v4/posts') {
                res.writeHead(307, {location: '/api/v4/moved'}).end();
            } else {
                json(res, {id: 'moved'});
            }
        });
        await server.open(page, COMPOSER);
        expect(await settle(composer(page).saveButton, {wait: CreatePost, timeout: 5_000}).click()).toEqual({
            id: 'moved',
        });
    });

    test('takes the retry when a request fails at the network level', async ({page, server}) => {
        let calls = 0;
        server.handle((_, res) => {
            calls++;
            if (calls === 1) {
                res.destroy();
            } else {
                json(res, {id: 'retry'});
            }
        });
        await server.open(
            page,
            button(
                'composer.save--button',
                "(async () => { try { await fetch('/api/v4/posts', {method: 'POST'}); } catch { await fetch('/api/v4/posts', {method: 'POST'}); } })()",
            ),
        );
        expect(await settle(composer(page).saveButton, {wait: CreatePost}).click()).toEqual({id: 'retry'});
        expect(calls).toBe(2);
    });

    test('fails at once on an HTTP error, with the status, body, verb and element', async ({page, server}) => {
        server.handle((_, res) => json(res, {id: 'api.post.bad', message: 'bad post'}, 400));
        await server.open(page, COMPOSER);
        const started = Date.now();
        const error = await settle(composer(page).saveButton, {wait: CreatePost, timeout: 10_000})
            .click()
            .then(unexpected, (e: unknown) => e as Error);
        expect(error).toBeInstanceOf(SettleError);
        expect(error.message).toContain('POST /api/v4/posts returned 400');
        expect(error.message).toContain('bad post');
        expect(error.message).toContain('after click() on "composer.save--button" (Composer)');
        expect(Date.now() - started).toBeLessThan(5_000);
    });

    test('accepts the expected status of a negative test', async ({page, server}) => {
        server.handle((_, res) => json(res, {id: 'no'}, 403));
        await server.open(page, COMPOSER);
        expect(await settle(composer(page).saveButton, {wait: CreatePost, status: 403}).click()).toEqual({id: 'no'});
    });

    test('times out naming the request, the element, and what the page sent by operation', async ({page, server}) => {
        await server.open(
            page,
            button('composer.save--button', "fetch('/api/v4/channels/c1'); fetch('/api/v4/unknown/thing')"),
        );
        const error = await settle(composer(page).saveButton, {wait: CreatePost, timeout: 500})
            .click()
            .then(unexpected, (e: unknown) => e as Error);
        expect(error).toBeInstanceOf(SettleError);
        expect(error.message).toContain(
            'no POST /api/v4/posts (CreatePost) within 500 ms after click() on "composer.save--button"',
        );
        expect(error.message).toContain('API requests the page issued: GetChannel, GET /api/v4/unknown/thing.');
    });

    test('one deadline: a response whose body never completes fails within the timeout', async ({page, server}) => {
        server.handle((_, res) => {
            // headers flushed, body withheld
            res.writeHead(200, {'content-type': 'application/json'});
            res.write('{"id":');
        });
        await server.open(page, COMPOSER);
        const started = Date.now();
        const error = await settle(composer(page).saveButton, {wait: CreatePost, timeout: 1_000})
            .click()
            .then(unexpected, (e: unknown) => e as Error);
        expect(error).toBeInstanceOf(SettleError);
        expect(error.message).toContain('did not arrive within 1000 ms');
        expect(Date.now() - started).toBeLessThan(4_000);
    });

    test('a driver built by hand settles like a generated one', async ({page, server}) => {
        server.handle((_, res) => json(res, {id: 'p1'}));
        await server.open(page, COMPOSER);
        const unbound = new ButtonDriver(page.getByTestId('composer.save--button'), {
            testId: 'composer.save--button',
            role: 'button',
            source: 'Composer',
        });
        expect(await settle(unbound, {wait: CreatePost}).click()).toEqual({id: 'p1'});
    });
});

test.describe('request matching', () => {
    const page2 = (calls: string) => button('composer.save--button', calls);

    test('a request belongs to the most specific operation: /users/me is GetMe, not GetUser', async ({
        page,
        server,
    }) => {
        server.handle((req, res) => json(res, {id: req.url!}));
        await server.open(page, page2("fetch('/api/v4/users/me').then(() => fetch('/api/v4/users/u2'))"));
        expect(await settle(composer(page).saveButton, {wait: GetUser}).click()).toEqual({id: '/api/v4/users/u2'});
    });

    test('GetMe waits for /users/me', async ({page, server}) => {
        server.handle((req, res) => json(res, {id: req.url!}));
        await server.open(page, page2("fetch('/api/v4/users/u2').then(() => fetch('/api/v4/users/me'))"));
        expect(await settle(composer(page).saveButton, {wait: GetMe}).click()).toEqual({id: '/api/v4/users/me'});
    });

    test('every placeholder filled: the exact path, even where another operation is more specific', async ({
        page,
        server,
    }) => {
        server.handle((req, res) => json(res, {id: req.url!}));
        await server.open(page, page2("fetch('/api/v4/users/u2').then(() => fetch('/api/v4/users/me'))"));
        expect(await settle(composer(page).saveButton, {wait: GetUser, params: {user_id: 'me'}}).click()).toEqual({
            id: '/api/v4/users/me',
        });
    });

    test('a placeholder left open: the more specific operation still wins, and filled ones must agree', async ({
        page,
        server,
    }) => {
        server.handle((req, res) => json(res, {id: req.url!}));
        await server.open(
            page,
            page2(
                "fetch('/api/v4/channels/c1/members/me').then(() => fetch('/api/v4/channels/c2/members/u1')).then(() => fetch('/api/v4/channels/c1/members/u1'))",
            ),
        );
        expect(
            await settle(composer(page).saveButton, {wait: Api.GetChannelMember, params: {channel_id: 'c1'}}).click(),
        ).toEqual({id: '/api/v4/channels/c1/members/u1'});
    });

    test('a filled value is compared decoded', async ({page, server}) => {
        server.handle((req, res) => json(res, {id: req.url!}));
        await server.open(page, page2("fetch('/api/v4/users/a%2Fb')"));
        expect(await settle(composer(page).saveButton, {wait: GetUser, params: {user_id: 'a/b'}}).click()).toEqual({
            id: '/api/v4/users/a%2Fb',
        });
    });

    test('a request with malformed encoding matches no filled value and does not abort the wait', async ({
        page,
        server,
    }) => {
        server.handle((req, res) => json(res, {id: req.url!}));
        await server.open(page, page2("fetch('/api/v4/users/%E0%A4%A').then(() => fetch('/api/v4/users/abc'))"));
        expect(await settle(composer(page).saveButton, {wait: GetUser, params: {user_id: 'abc'}}).click()).toEqual({
            id: '/api/v4/users/abc',
        });
    });

    test('the query and a trailing slash are not part of the path', async ({page, server}) => {
        server.handle((req, res) => json(res, {id: req.url!}));
        await server.open(page, page2("fetch('/api/v4/channels/c1/?include_deleted=true')"));
        expect(await settle(composer(page).saveButton, {wait: GetChannel, params: {channel_id: 'c1'}}).click()).toEqual(
            {id: '/api/v4/channels/c1/?include_deleted=true'},
        );
    });
});

test.describe('waitForApi', () => {
    test('waits for a request the page sends on its own, by entity', async ({page, server}) => {
        server.handle((req, res) => json(res, {id: req.url!.split('/').pop()!}));
        await server.open(page, '');
        const second = waitForApi(page, GetChannel, {params: {channel_id: 'c2'}});
        await page.evaluate(() => Promise.all([fetch('/api/v4/channels/c1'), fetch('/api/v4/channels/c2')]));
        expect(await second).toEqual({id: 'c2'});
    });

    test('several waits on one action: the waiters first, then the action', async ({page, server}) => {
        server.handle((req, res, body) => json(res, {id: req.url === '/api/v4/posts' ? body : 'channel'}));
        await server.open(page, COMPOSER);
        const app = composer(page);
        const [patched, post] = await Promise.all([
            waitForApi(page, PatchChannel),
            settle(app.sendButton, {wait: CreatePost}).click(),
        ]);
        expect(patched).toEqual({id: 'channel'});
        expect(post).toEqual({id: 'sent'});
    });

    test('skips responses until the predicate holds', async ({page, server}) => {
        let n = 0;
        server.handle((_, res) => json(res, {id: String(++n)}));
        await server.open(page, '');
        const third = waitForApi(page, GetChannel, {predicate: (body) => body.id === '3'});
        await page.evaluate(async () => {
            for (let i = 0; i < 3; i++) {
                await fetch('/api/v4/channels/c1');
            }
        });
        expect(await third).toEqual({id: '3'});
    });

    test('one deadline: a predicate that never returns fails within the timeout', async ({page, server}) => {
        await server.open(page, '');
        const started = Date.now();
        const waiting = waitForApi(page, GetChannel, {
            timeout: 1_000,
            predicate: () => new Promise<boolean>(() => undefined),
        });
        await page.evaluate(() => fetch('/api/v4/channels/c1'));
        const error = await waiting.then(unexpected, (e: unknown) => e as Error);
        expect(error).toBeInstanceOf(SettleError);
        expect(error.message).toContain(
            'the predicate for GET /api/v4/channels/{channel_id} (GetChannel) did not return within 1000 ms',
        );
        expect(Date.now() - started).toBeLessThan(4_000);
    });
});

test.describe('query filter', () => {
    /** The two variants of GET /users a member picker sends: in the team, and in the team but not in the channel. */
    const PICKER = button(
        'composer.save--button',
        "fetch('/api/v4/users?in_team=t1&amp;not_in_channel=c1').catch(() => {}); setTimeout(() => fetch('/api/v4/users?in_team=t1&amp;page=0'), 100)",
    );

    test('a variant that answers 500 is not a candidate: the wanted one resolves the wait', async ({page, server}) => {
        server.handle((req, res) => {
            if (req.url!.includes('not_in_channel')) {
                json(res, {id: 'unwanted'}, 500);
            } else {
                json(res, {id: 'wanted'});
            }
        });
        await server.open(page, PICKER);
        expect(
            await settle(composer(page).saveButton, {
                wait: GetUsers,
                query: {in_team: 't1', not_in_channel: null},
            }).click(),
        ).toEqual({id: 'wanted'});
        expect(server.received).toContain('GET /api/v4/users?in_team=t1&not_in_channel=c1');
    });

    test('a variant whose body never arrives is not waited for', async ({page, server}) => {
        server.handle((req, res) => {
            if (req.url!.includes('not_in_channel')) {
                res.writeHead(200, {'content-type': 'application/json'});
                res.write('{"id":');
                return;
            }
            json(res, {id: 'wanted'});
        });
        await server.open(page, PICKER);
        expect(
            await settle(composer(page).saveButton, {
                wait: GetUsers,
                query: {in_team: 't1', not_in_channel: null},
                timeout: 5_000,
            }).click(),
        ).toEqual({id: 'wanted'});
        expect(server.received).toContain('GET /api/v4/users?in_team=t1&not_in_channel=c1');
    });

    test('waitForApi takes the same filter', async ({page, server}) => {
        server.handle((req, res) => json(res, {id: req.url!}));
        await server.open(page, '');
        const wanted = waitForApi(page, GetUsers, {query: {not_in_channel: 'c1'}});
        await page.evaluate(async () => {
            await fetch('/api/v4/users?in_team=t1');
            await fetch('/api/v4/users?in_team=t1&not_in_channel=c1');
        });
        expect(await wanted).toEqual({id: '/api/v4/users?in_team=t1&not_in_channel=c1'});
    });

    test('a timeout names the query it wanted and the requests seen with their query strings', async ({
        page,
        server,
    }) => {
        server.handle((_, res) => json(res, {id: 'x'}));
        await server.open(
            page,
            button('composer.save--button', "fetch('/api/v4/users?in_team=t1&amp;not_in_channel=c1')"),
        );
        const error = await settle(composer(page).saveButton, {
            wait: GetUsers,
            query: {in_team: 't1', not_in_channel: null},
            timeout: 500,
        })
            .click()
            .then(unexpected, (e: unknown) => e as Error);
        expect(error.message).toContain(
            'no GET /api/v4/users (GetUsers) with query in_team=t1, not_in_channel absent within 500 ms',
        );
        expect(error.message).toContain('API requests the page issued: GetUsers?in_team=t1&not_in_channel=c1.');
    });

    test('a timeout lists the first 20 requests seen and how many it left out', async ({page, server}) => {
        server.handle((_, res) => json(res, {id: 'x'}));
        await server.open(
            page,
            button('composer.save--button', "for (let i = 0; i < 25; i++) fetch('/api/v4/channels/c' + i)"),
        );
        const error = await settle(composer(page).saveButton, {wait: CreatePost, timeout: 1_000})
            .click()
            .then(unexpected, (e: unknown) => e as Error);
        expect(error.message).toContain('GetChannel, … and 5 more.');
    });
});
