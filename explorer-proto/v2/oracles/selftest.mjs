// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-await-in-loop -- sequential browser steps */
// Unit tests for every oracle, the fault proxy and the guard, on local static fixtures. No Mattermost needed.
// Run from the repository root:  node explorer-proto/v2/oracles/selftest.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {after, before, describe, it} from 'node:test';
import {fileURLToPath} from 'node:url';

import {applyJsonRule, startFaultProxy} from './faults/fault-proxy.ts';
import {attachOracles} from './lib/attach.ts';
import {FindingSink, globToRegExp, loadAllowlist} from './lib/findings.ts';
import {FIXTURE_CHANNELS, startFixtureServer} from './lib/fixture-server.ts';
import {closeFixtureSession, launchBrowser, openFixtureSession} from './lib/fixture-session.ts';
import {snapshotIssues} from './lib/oracle-a11y.ts';
import {checkEnterWhileConfirmDisabled, checkNonOkSubmitFeedback} from './lib/oracle-modal.ts';
import {normalizeValue, runCheck, validateCheck} from './lib/oracle-uirest.ts';
import {createScrubber} from './lib/scrub.ts';
import {encodeFrame, FrameParser, MessageAssembler} from './lib/ws-frames.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(here, 'fixtures');

let fixture;
let second;
let browser;

before(async () => {
    fixture = await startFixtureServer(FIXTURES);
    second = await startFixtureServer(FIXTURES);
    browser = await launchBrowser();
});

after(async () => {
    await browser?.close();
    await fixture?.close();
    await second?.close();
});

/** Opens a guarded fixture session, attaches oracles, runs `act`, checkpoints, and returns what was found. */
async function observe(url, options, act = async () => {}) {
    const session = await openFixtureSession(browser, fixture.origin);
    const oracles = attachOracles(session, options);
    try {
        await session.page.goto(`${fixture.origin}${url}`);
        await act(session, oracles);
        await oracles.checkpoint();
        await session.page.waitForTimeout(250);
        await oracles.drain();
        oracles.detach();
        return {oracles, session, findings: oracles.findings()};
    } finally {
        oracles.detach();
        await closeFixtureSession(session);
    }
}

const classes = (findings, oracle) => findings.filter((f) => f.oracle === oracle).map((f) => f.class);

describe('scrubber', () => {
    const scrub = createScrubber({
        origins: ['http://127.0.0.1:8065'],
        ids: ['seededidvalue0000000001'],
        literals: ['Sup3r-synthetic-pw'],
    });

    it('replaces ids in paths and keeps only sorted query keys', () => {
        assert.equal(
            scrub.path('http://127.0.0.1:8065/api/v4/channels/abcdefghijklmnopqrstuvwxyz/posts?per_page=60&page=0'),
            '/api/v4/channels/<id>/posts?page&per_page',
        );
        assert.equal(scrub.path('/static/main.0123456789abcdef0123.js'), '/static/main.<hash>.js');
    });

    it('removes origins, ports, tokens, literals, times and dates', () => {
        const text = scrub.text(
            'GET http://127.0.0.1:8065/x ws://localhost:1234/y 127.0.0.1:9999 MMAUTHTOKEN=abc123 Bearer abc.def Sup3r-synthetic-pw at 9:03 AM on November 21, 2026 id abcdefghijklmnopqrstuvwxyz',
        );
        assert.equal(
            text,
            'GET <origin>/x <origin>/y <host> MMAUTHTOKEN=<token> Bearer <token> <redacted> at <time> on <date> id <id>',
        );
        assert.doesNotThrow(() => scrub.assertClean(text));
    });

    it('writes known seeded ids as <id> and secrets as <redacted>, consistently', () => {
        assert.equal(scrub.path('/api/v4/users/seededidvalue0000000001/x'), '/api/v4/users/<id>/x');
        assert.equal(scrub.text('user seededidvalue0000000001 pw Sup3r-synthetic-pw'), 'user <id> pw <redacted>');
        assert.throws(() => scrub.assertClean('x seededidvalue0000000001'), /Scrub failure/);
    });

    it('assertClean refuses loopback hosts, URLs and literals', () => {
        assert.throws(() => scrub.assertClean('see 127.0.0.1'), /Scrub failure/);
        assert.throws(() => scrub.assertClean('see https://example.com'), /Scrub failure/);
        assert.throws(() => scrub.assertClean('pw Sup3r-synthetic-pw'), /Scrub failure/);
    });
});

describe('findings sink', () => {
    const make = () => new FindingSink(createScrubber({origins: ['http://127.0.0.1:1']}));
    const inputs = [
        {oracle: 'O-B', class: 'x', path: '/p/abcdefghijklmnopqrstuvwxyz', evidence: 'second', action: 4},
        {oracle: 'O-A', class: 'x', path: '/p', evidence: 'first', action: 2},
        {oracle: 'O-A', class: 'x', path: '/p', evidence: 'first', action: 1},
        {oracle: 'O-A', class: 'x', path: '/p', evidence: 'first', action: 3, weight: 2},
    ];

    it('de-duplicates, counts and keeps the first-seen action', () => {
        const sink = make();
        inputs.forEach((i) => sink.add(i));
        assert.deepEqual(sink.list(), [
            {oracle: 'O-A', class: 'x', path: '/p', evidence: 'first', count: 4, first_action: 1},
            {oracle: 'O-B', class: 'x', path: '/p/<id>', evidence: 'second', count: 1, first_action: 4},
        ]);
    });

    it('serializes identically whatever the insertion order', () => {
        const forward = make();
        const backward = make();
        inputs.forEach((i) => forward.add(i));
        [...inputs].reverse().forEach((i) => backward.add(i));
        assert.equal(
            forward.toJsonl().replace(/"first_action":\d+/g, ''),
            backward.toJsonl().replace(/"first_action":\d+/g, ''),
        );
        assert.equal(forward.toJsonl(), backward.toJsonl());
    });

    it('applies allowlist entries and counts what they suppress', () => {
        const sink = new FindingSink(createScrubber(), {
            schema: 'explorer-oracle-allowlist/v1',
            entries: [
                {
                    id: 'optional-404',
                    oracle: 'O-NET',
                    path_glob: '/api/optional/*',
                    method: 'GET',
                    statuses: [404],
                    reason: 'test',
                },
            ],
        });
        sink.add({
            oracle: 'O-NET',
            class: 'http-4xx',
            path: '/api/optional/a',
            evidence: 'e',
            action: 1,
            meta: {method: 'GET', status: 404},
        });
        sink.add({
            oracle: 'O-NET',
            class: 'http-5xx',
            path: '/api/optional/a',
            evidence: 'e',
            action: 1,
            meta: {method: 'GET', status: 500},
        });
        sink.add({
            oracle: 'O-NET',
            class: 'http-4xx',
            path: '/api/other',
            evidence: 'e',
            action: 1,
            meta: {method: 'GET', status: 404},
        });
        assert.equal(sink.list().length, 2);
        assert.deepEqual(sink.suppressed(), {'optional-404': 1});
    });

    it('ships an empty allowlist', () => {
        assert.deepEqual(loadAllowlist(path.join(here, 'allowlist.json')).entries, []);
    });

    it('matches globs per segment', () => {
        assert.ok(globToRegExp('/api/v4/channels/*/posts').test('/api/v4/channels/x/posts'));
        assert.ok(!globToRegExp('/api/v4/channels/*/posts').test('/api/v4/channels/x/y/posts'));
        assert.ok(globToRegExp('/api/**').test('/api/v4/channels/x'));
    });
});

describe('websocket frames', () => {
    it('round-trips masked and fragmented messages', () => {
        const parser = new FrameParser();
        const assembler = new MessageAssembler();
        const bytes = Buffer.concat([
            encodeFrame(1, Buffer.from('{"a":'), {fin: false, mask: true}),
            encodeFrame(0, Buffer.from('1}'), {mask: true}),
            encodeFrame(9, Buffer.from('p')),
        ]);
        const messages = [];
        for (const chunk of [bytes.subarray(0, 3), bytes.subarray(3)]) {
            for (const frame of parser.push(chunk)) {
                const message = assembler.push(frame);
                if (message) {
                    messages.push([message.opcode, message.payload.toString()]);
                }
            }
        }
        assert.deepEqual(messages, [
            [1, '{"a":1}'],
            [9, 'p'],
        ]);
    });
});

describe('O-CONSOLE', () => {
    it('reports console.error and uncaught exceptions, not log or warn', async () => {
        const {findings} = await observe('/console.html', {a11y: false});
        assert.deepEqual(
            findings.map((f) => `${f.class}: ${f.evidence}`),
            [
                'console-error: fixture benign message 7',
                'console-error: fixture console error one',
                'uncaught-exception: Error: fixture uncaught exception',
            ],
        );
        assert.ok(findings.every((f) => f.path === '/console.html' && f.first_action === 0));
    });

    it('suppresses allowlisted messages and counts them', async () => {
        const allowlist = {
            schema: 'explorer-oracle-allowlist/v1',
            entries: [
                {
                    id: 'benign-7',
                    oracle: 'O-CONSOLE',
                    class: 'console-error',
                    evidence_regex: 'benign message \\d+',
                    reason: 'self-test',
                },
            ],
        };
        const {findings, oracles} = await observe('/console.html', {a11y: false, allowlist});
        assert.equal(findings.length, 2);
        assert.deepEqual(oracles.sink.suppressed(), {'benign-7': 1});
    });
});

describe('O-NET', () => {
    it('reports 4xx and 5xx from the app origin and leaves resource-failure console lines to it', async () => {
        const {findings} = await observe('/net.html', {a11y: false});
        assert.deepEqual(
            findings.filter((f) => f.oracle === 'O-NET').map((f) => `${f.class}: ${f.evidence}`),
            ['http-4xx: GET /api/missing -> 404', 'http-5xx: GET /api/boom -> 500'],
        );
        assert.deepEqual(classes(findings, 'O-CONSOLE'), []);
    });

    it('applies a per-path expected-status allowlist', async () => {
        const allowlist = {
            schema: 'explorer-oracle-allowlist/v1',
            entries: [
                {
                    id: 'optional-resource',
                    oracle: 'O-NET',
                    path_glob: '/api/missing',
                    method: 'GET',
                    statuses: [404],
                    reason: 'self-test',
                },
            ],
        };
        const {findings, oracles} = await observe('/net.html', {a11y: false, allowlist});
        assert.deepEqual(
            findings.map((f) => f.class),
            ['http-5xx'],
        );
        assert.deepEqual(oracles.sink.suppressed(), {'optional-resource': 1});
    });

    it('reports an unexpected WebSocket close', async () => {
        const {findings} = await observe('/ws.html?mode=close', {a11y: false}, (s) => s.page.waitForTimeout(900));
        assert.deepEqual(
            findings.map((f) => f.class),
            ['ws-close'],
        );
        assert.equal(findings[0].path, '/ws-close');
    });

    it('reports a WebSocket handshake error', async () => {
        const {findings} = await observe('/ws.html?mode=deny', {a11y: false}, (s) => s.page.waitForTimeout(600));
        assert.ok(
            findings.some((f) => f.class === 'ws-error'),
            JSON.stringify(findings),
        );
    });

    it('does not report a WebSocket that closes because the document navigated away', async () => {
        const {findings} = await observe('/ws.html?mode=navigate', {a11y: false}, (s) => s.page.waitForTimeout(1200));
        assert.deepEqual(findings, []);
    });

    it('does not report a healthy WebSocket', async () => {
        const {findings} = await observe('/ws.html', {a11y: false}, async (s) => {
            await s.page.waitForFunction(() => window.fixtureSocketEvents.length === 3);
        });
        assert.deepEqual(findings, []);
    });
});

describe('O-A11Y', () => {
    const snapshot = [
        '- banner:',
        '  - button:',
        '    - img',
        '  - link:',
        '    - /url: /somewhere',
        '- navigation "Main"',
        '- navigation "Main"',
        '- main',
        '- main',
        '- region "Named"',
        '- region',
        '- region',
        '- dialog:',
        '  - heading "Title" [level=2]',
        '- alertdialog "Fine"',
        '- textbox "ok"',
        '- combobox',
    ].join('\n');

    it('finds structure problems in snapshot text', () => {
        assert.deepEqual(
            snapshotIssues(snapshot).map((i) => `${i.class}: ${i.evidence}`),
            [
                'empty-accessible-name: button has an empty accessible name [children: img]',
                'empty-accessible-name: link has an empty accessible name -> /somewhere',
                'dialog-without-name: dialog has no accessible name (first heading "Title")',
                'empty-accessible-name: combobox has an empty accessible name',
                'duplicate-landmark: 2 navigation landmarks share the name "Main"',
                'duplicate-landmark: 2 main landmarks share the empty name',
            ],
        );
    });

    it('flags every defect on the bad fixture and nothing on the good fixture', async () => {
        const bad = (await observe('/a11y-bad.html', {})).findings.filter((f) => f.oracle === 'O-A11Y');
        const kinds = new Set(bad.map((f) => f.class));
        assert.deepEqual([...kinds].sort(), [
            'dangling-aria-reference',
            'dialog-without-name',
            'duplicate-landmark',
            'empty-accessible-name',
        ]);
        const evidence = bad.map((f) => f.evidence).join('\n');
        assert.match(evidence, /aria-labelledby on <div> references missing id "ghost-label-id"/);
        assert.match(evidence, /aria-describedby on <input> references missing id "ghost-hint-id"/);
        assert.match(evidence, /aria-labelledby on <div role=dialog> references missing id "gone-title"/);
        assert.match(evidence, /2 navigation landmarks share the name "Main"/);
        assert.equal(bad.filter((f) => f.class === 'dialog-without-name').length, 2);
        assert.equal(bad.filter((f) => f.class === 'empty-accessible-name').length, 2);
        assert.ok(!evidence.includes('hidden-label'));

        const good = (await observe('/a11y-good.html', {})).findings;
        assert.deepEqual(good, []);
    });

    it('counts a persistent finding once per checkpoint', async () => {
        const {findings} = await observe('/a11y-bad.html', {}, async (_s, oracles) => {
            await oracles.checkpoint();
            oracles.action('first');
            await oracles.checkpoint();
        });
        const dup = findings.find((f) => f.class === 'duplicate-landmark');
        assert.equal(dup.count, 3);
        assert.equal(dup.first_action, 0);
    });
});

describe('O-UIREST', () => {
    const data = {
        manifest: {
            channels: Object.fromEntries(
                Object.entries(FIXTURE_CHANNELS).map(([name, c]) => [
                    name,
                    {id: c.id, name, archived: false, url_path: `/team/channels/${name}`},
                ]),
            ),
        },
    };
    const check = (overrides = {}) => ({
        schema: 'explorer-oracle-check/v1',
        id: 'fixture-display-name',
        description: 'fixture',
        needs_typing: false,
        subjects: {from: 'manifest.channels', as: 'channel', where: {archived: false}},
        ui: {
            locator: {css: 'a[href$="/channels/{channel.name}"]', within: {role: 'navigation', name: 'Channels'}},
            read: 'text',
            normalize: ['trim'],
            required: true,
        },
        rest: {method: 'GET', path: '/api/v4/channels/{channel.id}', field: 'display_name'},
        rule: {op: 'equals'},
        settle_ms: 1800,
        ...overrides,
    });
    const run = (url, spec) => observe(url, {a11y: false, checks: [spec], checkData: data});

    it('passes when the UI equals the REST field', async () => {
        const {findings, oracles} = await run('/uirest.html', check());
        assert.deepEqual(findings, []);
        assert.deepEqual(
            oracles.checkResults().map((r) => r.status),
            ['pass', 'pass'],
        );
    });

    it('reports a persistent disagreement with both values', async () => {
        const {findings} = await run('/uirest.html?mode=mismatch', check({settle_ms: 400}));
        assert.equal(findings.length, 1);
        assert.equal(findings[0].oracle, 'O-UIREST');
        assert.equal(
            findings[0].evidence,
            'check fixture-display-name [chan-one]: ui "Chan Uno" vs rest display_name "Chan One" (equals)',
        );
    });

    it('does not report a UI that converges inside the settle window', async () => {
        const {findings} = await run('/uirest.html?mode=late', check());
        assert.deepEqual(findings, []);
    });

    it('reports a required UI element that is absent', async () => {
        const {findings} = await run('/uirest.html?mode=missing', check({settle_ms: 300}));
        assert.match(findings[0].evidence, /ui "<absent>" vs rest display_name "Chan One"/);
    });

    it('treats a REST error as an error result, not a finding', async () => {
        const broken = {manifest: {channels: {'chan-one': {id: 'nonexistent1', name: 'chan-one', archived: false}}}};
        const {findings, oracles} = await observe('/uirest.html', {a11y: false, checks: [check()], checkData: broken});
        assert.deepEqual(findings, []);
        assert.deepEqual(
            oracles.checkResults().map((r) => r.status),
            ['error'],
        );
    });

    it('supports contains and equals-list rules and reports vacuous results', async () => {
        const contains = check({
            id: 'fixture-contains',
            subjects: {from: 'manifest.channels', as: 'channel', where: {archived: false}},
            ui: {locator: {css: 'body'}, read: 'text', normalize: ['collapse-whitespace'], required: true},
            rest: {method: 'GET', path: '/api/v4/channels/{channel.id}', field: ['purpose', 'display_name']},
            rule: {op: 'contains'},
        });
        const {findings, oracles} = await run('/uirest.html', {...contains, settle_ms: 300});
        assert.deepEqual(
            oracles.checkResults().map((r) => `${r.subject}:${r.status}`),
            [
                'chan-one.purpose:mismatch',
                'chan-one.display_name:pass',
                'chan-two.purpose:mismatch',
                'chan-two.display_name:pass',
            ],
        );
        assert.equal(findings.length, 2);
        assert.match(findings[0].evidence, /ui text does not contain rest purpose "Purpose one" \(ui text starts /);

        const list = check({
            id: 'fixture-list',
            ui: {locator: {css: '.nothing-here'}, read: 'text-all'},
            rest: {method: 'GET', path: '/api/v4/users/me/channels', field: '[].nothing'},
            rule: {op: 'equals-list'},
        });
        const empty = await run('/uirest.html', list);
        assert.ok(empty.oracles.checkResults().every((r) => r.status === 'mismatch' || r.status === 'vacuous'));
    });

    it('can read the REST truth from another loopback origin, and refuses a non-loopback one', async () => {
        const proxy = await startFaultProxy({
            config: {
                schema: 'explorer-oracle-faults/v1',
                synthetic: true,
                description: 'self-test',
                enabled: true,
                rules: [
                    {id: 'drop', kind: 'json_drop_field', match: {path: '/api/v4/channels/*'}, field: 'display_name'},
                ],
            },
            upstreamPort: fixture.port,
        });
        try {
            const spec = check({settle_ms: 300});
            const observeThroughProxy = async (restOrigin) => {
                const session = await openFixtureSession(browser, proxy.origin);
                const oracles = attachOracles(session, {a11y: false, checks: [spec], checkData: data, restOrigin});
                try {
                    await session.page.goto(`${proxy.origin}/uirest.html`);
                    await oracles.checkpoint();
                    oracles.detach();
                    return oracles.findings();
                } finally {
                    await closeFixtureSession(session);
                }
            };
            assert.equal((await observeThroughProxy(undefined)).length, 2);
            assert.deepEqual(await observeThroughProxy(fixture.origin), []);
            assert.throws(
                () =>
                    attachOracles({context: {}, page: {}, origin: proxy.origin}, {restOrigin: 'http://example.com:80'}),
                /restOrigin/,
            );
        } finally {
            await proxy.close();
        }
    });

    it('refuses a REST template that leaves the session origin', async () => {
        const absolute = check({rest: {method: 'GET', path: 'http://127.0.0.1:1/api/x', field: 'a'}});
        assert.throws(() => validateCheck(absolute), /\/api\/ path/);
        const session = await openFixtureSession(browser, fixture.origin);
        try {
            await session.page.goto(`${fixture.origin}/uirest.html`);
            const spec = check({rest: {method: 'GET', path: '//example.invalid/api/x', field: 'a'}});
            await assert.rejects(
                runCheck(session.page, session.context, session.origin, spec, data, () => {}, 0),
                /session origin/,
            );
        } finally {
            await closeFixtureSession(session);
        }
    });

    it('validates the shipped check files', () => {
        const dir = path.join(here, 'checks');
        const files = fs.readdirSync(dir).filter((f) => f.endsWith('.check.json'));
        assert.ok(files.length >= 3);
        const ids = new Set();
        for (const file of files) {
            const spec = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
            assert.doesNotThrow(() => validateCheck(spec), file);
            assert.ok(!ids.has(spec.id));
            ids.add(spec.id);
        }
        assert.throws(() => validateCheck({...check(), rule: {op: 'regex'}}), /rule.op/);
        assert.equal(normalizeValue(' \ue000 Name  ', ['strip-private-use', 'collapse-whitespace', 'trim']), 'Name');
    });
});

describe('O-MODAL', () => {
    async function withDialog(variant, extra, act) {
        const session = await openFixtureSession(browser, fixture.origin);
        const oracles = attachOracles(session, {a11y: false});
        try {
            await session.page.goto(`${fixture.origin}/modal.html?variant=${variant}${extra}`);
            const target = {
                page: session.page,
                context: session.context,
                origin: session.origin,
                sink: oracles.sink,
                action: 1,
                dialog: session.page.getByRole('dialog', {name: 'Create thing'}),
                confirm: session.page.getByRole('button', {name: 'Create'}),
                field: session.page.getByLabel('Name'),
            };
            const result = await act(target);
            return {result, findings: oracles.findings()};
        } finally {
            oracles.detach();
            await closeFixtureSession(session);
        }
    }

    it('passes when Enter on a disabled form sends nothing', async () => {
        const {result, findings} = await withDialog('good', '', (t) => checkEnterWhileConfirmDisabled(t));
        assert.equal(result.status, 'pass');
        assert.deepEqual(findings, []);
    });

    it('fails when Enter submits while the confirm button is disabled', async () => {
        const {result, findings} = await withDialog('enter-bug', '', (t) => checkEnterWhileConfirmDisabled(t));
        assert.equal(result.status, 'fail');
        assert.deepEqual(result.requests, ['POST /api/submit']);
        assert.equal(findings[0].class, 'enter-submits-while-disabled');
        assert.match(findings[0].evidence, /POST \/api\/submit/);
    });

    it('ignores background polls: the default ignore list, and anything already seen in the baseline window', async () => {
        const known = await withDialog('good', '&poll=/api/v4/users/status/ids', (t) =>
            checkEnterWhileConfirmDisabled(t),
        );
        assert.equal(known.result.status, 'pass');
        const baselined = await withDialog('good', '&poll=/api/some-other-poll', (t) =>
            checkEnterWhileConfirmDisabled(t),
        );
        assert.equal(baselined.result.status, 'pass');
        const unfiltered = await withDialog('good', '&poll=/api/some-other-poll', (t) =>
            checkEnterWhileConfirmDisabled(t, {baselineMs: 0}),
        );
        assert.equal(unfiltered.result.status, 'fail');
    });

    it('counts only the declared submit paths when asked to', async () => {
        const other = await withDialog('enter-bug', '', (t) =>
            checkEnterWhileConfirmDisabled(t, {submitPaths: ['/api/other']}),
        );
        assert.equal(other.result.status, 'pass');
        const declared = await withDialog('enter-bug', '', (t) =>
            checkEnterWhileConfirmDisabled(t, {submitPaths: ['/api/submit']}),
        );
        assert.equal(declared.result.status, 'fail');
    });

    it('reports a precondition failure when the confirm button is enabled', async () => {
        const {result, findings} = await withDialog('good', '', async (t) => {
            await t.field.fill('typed');
            return checkEnterWhileConfirmDisabled(t);
        });
        assert.equal(result.status, 'precondition-unmet');
        assert.deepEqual(findings, []);
    });

    it('passes a non-2xx submit that shows error text', async () => {
        const {result, findings} = await withDialog('good', '', async (t) => {
            await t.field.fill('typed');
            return checkNonOkSubmitFeedback(t, {submit: 'click'});
        });
        assert.equal(result.status, 'pass');
        assert.equal(result.feedback, 'text');
        assert.deepEqual(
            findings.map((f) => `${f.oracle} ${f.class}`),
            ['O-NET http-5xx'],
        );
    });

    it('passes a non-2xx submit that keeps the dialog open, and says so', async () => {
        const {result} = await withDialog('stay-open', '', async (t) => {
            await t.field.fill('typed');
            return checkNonOkSubmitFeedback(t, {submit: 'enter'});
        });
        assert.equal(result.status, 'pass');
        assert.equal(result.feedback, 'dialog-open');
    });

    it('fails a non-2xx submit that closes the dialog without feedback', async () => {
        const {result, findings} = await withDialog('silent-fail', '', async (t) => {
            await t.field.fill('typed');
            return checkNonOkSubmitFeedback(t, {submit: 'click'});
        });
        assert.equal(result.status, 'fail');
        assert.equal(findings[0].class, 'non-ok-submit-without-feedback');
    });

    it('can force the non-2xx response so a succeeding endpoint is still exercised', async () => {
        const {result, findings} = await withDialog('silent-fail', '&ok=1', async (t) => {
            await t.field.fill('typed');
            return checkNonOkSubmitFeedback(t, {
                submit: 'click',
                forceStatus: {urlGlob: '**/api/submit-ok', status: 500},
            });
        });
        assert.equal(result.status, 'fail');
        assert.match(findings[0].evidence, /harness-forced 500/);
    });
});

describe('guard stays enforced around the oracles', () => {
    it('blocks a second loopback origin for navigation, fetch, image and WebSocket, with zero hits', async () => {
        second.hits.length = 0;
        second.upgrades.length = 0;
        const session = await openFixtureSession(browser, fixture.origin);
        const oracles = attachOracles(session, {a11y: false});
        try {
            await session.page.goto(`${fixture.origin}/blank.html`);
            const results = await session.page.evaluate(async (target) => {
                const out = [];
                out.push(
                    await fetch(`${target}/x`, {mode: 'no-cors'}).then(
                        () => 'fetch:loaded',
                        () => 'fetch:failed',
                    ),
                );
                out.push(
                    await new Promise((resolve) => {
                        const img = new Image();
                        img.onload = () => resolve('image:loaded');
                        img.onerror = () => resolve('image:failed');
                        img.src = `${target}/blank.html?img`;
                    }),
                );
                out.push(
                    await new Promise((resolve) => {
                        const socket = new WebSocket(`${target.replace('http', 'ws')}/ws-close`);
                        socket.onopen = () => resolve('ws:open');
                        socket.onerror = () => resolve('ws:failed');
                        socket.onclose = () => resolve('ws:failed');
                    }),
                );
                return out;
            }, second.origin);
            assert.deepEqual(results, ['fetch:failed', 'image:failed', 'ws:failed']);
            const probe = await session.context.newPage();
            const outcome = await probe.goto(`${second.origin}/blank.html`, {timeout: 5000}).then(
                () => 'loaded',
                (error) => (String(error).includes('ERR_BLOCKED_BY_CLIENT') ? 'blocked' : 'failed'),
            );
            await probe.close();
            assert.equal(outcome, 'blocked');
            assert.deepEqual(second.hits, []);
            assert.deepEqual(second.upgrades, []);
            assert.ok(session.ledger.blocked.length >= 4);
            assert.deepEqual(session.ledger.violations, []);
        } finally {
            oracles.detach();
            await closeFixtureSession(session);
        }
    });

    it('never requests a service worker script even when the page registers one', async () => {
        const session = await openFixtureSession(browser, fixture.origin);
        try {
            await session.page.goto(`${fixture.origin}/blank.html`);
            await session.page.evaluate(() => navigator.serviceWorker.register('/sw.js').catch(() => undefined));
            await session.page.waitForTimeout(600);
            assert.ok(!fixture.hits.includes('/sw.js'));
        } finally {
            await closeFixtureSession(session);
        }
    });
});

describe('fault proxy (SYNTHETIC)', () => {
    const config = (rules, enabled = true) => ({
        schema: 'explorer-oracle-faults/v1',
        synthetic: true,
        description: 'self-test',
        enabled,
        rules,
    });
    const start = (rules) => startFaultProxy({config: config(rules), upstreamPort: fixture.port});
    const getJson = async (proxy, urlPath, init) => (await fetch(`${proxy.origin}${urlPath}`, init)).json();
    const channelPath = `/api/v4/channels/${FIXTURE_CHANNELS['chan-one'].id}`;

    async function collect(proxy, ms) {
        const events = [];
        const startedAt = Date.now();
        const socket = new WebSocket(`${proxy.origin.replace('http', 'ws')}/api/v4/websocket`);
        socket.onmessage = (m) => {
            const body = JSON.parse(m.data);
            events.push({event: body.event, seq: body.seq, at: Date.now() - startedAt});
        };
        await new Promise((resolve) => setTimeout(resolve, ms));
        socket.close();
        return events;
    }

    it('is OFF by default and refuses to start', async () => {
        const shipped = JSON.parse(fs.readFileSync(path.join(here, 'faults', 'default.json'), 'utf8'));
        assert.equal(shipped.enabled, false);
        assert.equal(shipped.synthetic, true);
        await assert.rejects(startFaultProxy({config: shipped, upstreamPort: fixture.port}), /OFF/);
        await assert.rejects(
            startFaultProxy({config: {...config([]), synthetic: false}, upstreamPort: fixture.port}),
            /synthetic: true/,
        );
    });

    it('drops and renames JSON fields, element-wise on arrays, and logs each activation as SYNTHETIC-INJECTED', async () => {
        const proxy = await start([
            {
                id: 'drop',
                kind: 'json_drop_field',
                match: {method: 'GET', path: '/api/v4/users/me/channels'},
                field: 'display_name',
            },
            {
                id: 'rename',
                kind: 'json_rename_field',
                match: {path: '/api/v4/channels/*'},
                field: 'purpose',
                to: 'purpose_x',
            },
        ]);
        try {
            const list = await getJson(proxy, '/api/v4/users/me/channels');
            assert.ok(list.every((c) => !('display_name' in c) && 'purpose' in c));
            const one = await getJson(proxy, channelPath);
            assert.equal(one.purpose_x, 'Purpose one');
            assert.ok(!('purpose' in one));
            assert.equal(one.display_name, 'Chan One');
            assert.deepEqual(
                proxy.log.map((e) => [e.label, e.rule, e.kind, e.path]),
                [
                    ['SYNTHETIC-INJECTED', 'drop', 'json_drop_field', '/api/v4/users/me/channels'],
                    ['SYNTHETIC-INJECTED', 'rename', 'json_rename_field', '/api/v4/channels/<id>'],
                ],
            );
            assert.doesNotMatch(JSON.stringify(proxy.log), /127\.0\.0\.1|:\d{4,5}/);
        } finally {
            await proxy.close();
        }
        assert.deepEqual(
            applyJsonRule({a: {b: 1, c: 2}}, {id: 'x', kind: 'json_drop_field', match: {path: '/'}, field: 'a.b'}),
            true,
        );
    });

    it('returns 500 only after N matching requests, and only `times` times', async () => {
        const proxy = await start([
            {
                id: 'err',
                kind: 'http_error_after',
                match: {method: 'GET', path: '/api/v4/channels/*'},
                after_hits: 2,
                times: 1,
                status: 500,
            },
        ]);
        try {
            const statuses = [];
            for (let i = 0; i < 5; i++) {
                statuses.push((await fetch(`${proxy.origin}${channelPath}`)).status);
            }
            assert.deepEqual(statuses, [200, 200, 500, 200, 200]);
            assert.equal(proxy.log.length, 1);
        } finally {
            await proxy.close();
        }
    });

    it('delays only matching responses', async () => {
        const proxy = await start([
            {id: 'slow', kind: 'http_delay', match: {path: '/api/v4/channels/*'}, delay_ms: 500},
        ]);
        try {
            const timed = async (urlPath) => {
                const startedAt = Date.now();
                await fetch(`${proxy.origin}${urlPath}`);
                return Date.now() - startedAt;
            };
            assert.ok((await timed(channelPath)) >= 450);
            assert.ok((await timed('/api/v4/users/me/channels')) < 300);
        } finally {
            await proxy.close();
        }
    });

    it('rewrites Origin to the site origin and asks upstream for identity encoding', async () => {
        const proxy = await startFaultProxy({
            config: config([]),
            upstreamPort: fixture.port,
            siteOrigin: 'http://127.0.0.1:65000',
        });
        try {
            const echoed = await getJson(proxy, '/api/echo', {
                headers: {Origin: proxy.origin, 'Accept-Encoding': 'gzip'},
            });
            assert.equal(echoed.origin, 'http://127.0.0.1:65000');
            assert.equal(echoed.accept_encoding, null);
            assert.match(echoed.host, /^127\.0\.0\.1:\d+$/);
        } finally {
            await proxy.close();
        }
    });

    it('passes WebSocket events through unchanged with no rule', async () => {
        const proxy = await start([]);
        try {
            const events = await collect(proxy, 600);
            assert.deepEqual(
                events.map((e) => [e.event, e.seq]),
                [
                    ['typing', 1],
                    ['channel_updated', 2],
                    ['posted', 3],
                ],
            );
        } finally {
            await proxy.close();
        }
    });

    it('drops a WebSocket event type and renumbers seq so the client sees no gap', async () => {
        const proxy = await start([
            {
                id: 'wsdrop',
                kind: 'ws_drop',
                match: {path: '/api/v4/websocket'},
                event: 'channel_updated',
                renumber_seq: true,
            },
        ]);
        try {
            const events = await collect(proxy, 600);
            assert.deepEqual(
                events.map((e) => [e.event, e.seq]),
                [
                    ['typing', 1],
                    ['posted', 2],
                ],
            );
            assert.deepEqual(
                proxy.log.map((e) => [e.kind, e.detail]),
                [['ws_drop', 'dropped event=channel_updated']],
            );
        } finally {
            await proxy.close();
        }
    });

    it('delays a WebSocket event type, holding later events behind it by default', async () => {
        const proxy = await start([
            {
                id: 'wsdelay',
                kind: 'ws_delay',
                match: {path: '/api/v4/websocket'},
                event: 'channel_updated',
                delay_ms: 500,
            },
        ]);
        try {
            const events = await collect(proxy, 1300);
            assert.deepEqual(
                events.map((e) => e.event),
                ['typing', 'channel_updated', 'posted'],
            );
            const [typing, updated, posted] = events;
            assert.ok(
                updated.at - typing.at >= 400,
                `channel_updated arrived ${updated.at - typing.at} ms after typing`,
            );
            assert.ok(posted.at >= updated.at);
        } finally {
            await proxy.close();
        }
        const reordering = await start([
            {
                id: 'wsdelay2',
                kind: 'ws_delay',
                match: {path: '/api/v4/websocket'},
                event: 'channel_updated',
                delay_ms: 500,
                preserve_order: false,
            },
        ]);
        try {
            const events = await collect(reordering, 1300);
            assert.deepEqual(
                events.map((e) => e.event),
                ['typing', 'posted', 'channel_updated'],
            );
        } finally {
            await reordering.close();
        }
    });

    it('keeps the exact-origin guard and WebSocket pass-through working through the proxy', async () => {
        const proxy = await start([]);
        try {
            const session = await openFixtureSession(browser, proxy.origin);
            const oracles = attachOracles(session, {a11y: false});
            try {
                await session.page.goto(`${proxy.origin}/ws.html`);
                await session.page.waitForFunction(() => window.fixtureSocketEvents.length === 3);
                assert.deepEqual(await session.page.evaluate(() => window.fixtureSocketEvents), [
                    'typing',
                    'channel_updated',
                    'posted',
                ]);
                const direct = await session.context.newPage();
                const outcome = await direct.goto(`${fixture.origin}/blank.html`, {timeout: 5000}).then(
                    () => 'loaded',
                    (error) => (String(error).includes('ERR_BLOCKED_BY_CLIENT') ? 'blocked' : 'failed'),
                );
                await direct.close();
                assert.equal(outcome, 'blocked');
                assert.deepEqual(oracles.findings(), []);
                assert.deepEqual(session.ledger.violations, []);
            } finally {
                oracles.detach();
                await closeFixtureSession(session);
            }
        } finally {
            await proxy.close();
        }
    });
});
