#!/usr/bin/env node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @stylistic/indent, @stylistic/multiline-ternary, @stylistic/operator-linebreak, @stylistic/wrap-regex, no-process-env -- Prettier owns formatting and the repo config relaxes these rules for .ts/.js only */

// A fake infra stack for the orchestrator selftest (never used by a real run). It stands in for gate.sh, up.sh, down.sh,
// bookmark_ctl.mjs and the engine's replay: a loopback HTTP server that answers the bookmark reads the fixture probe
// makes, a seed manifest, a bookmark title state, and Playwright-shaped JSON reports. Selftest wrappers call it as
//   node selftest_fake_infra.mjs <gate|up|down|ctl|replay|server> [args]   with FAKE_RUN=<dir>.
// FAKE_OMIT_SESSION=1 makes `up` write a manifest without the session key (the seed defect the stage must catch).
// FAKE_REPLAY_SLEEP=<ms> delays a coordinator replay (so a test can kill the coordinator in the middle of one);
// FAKE_VERIFIER_SLEEP=<ms> does the same for a verifier replay (the verifier's reporter sets PILOT_STEP_OUT). `replay` also
// writes the step file the verifier's reporter would (PILOT_STEP_OUT), and `verify_seed` stands in for verify_seed.mjs.
import {spawn} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const RUN = process.env.FAKE_RUN;
const STATE = path.join(RUN ?? '.', 'state.json');
const MANIFEST = path.join(RUN ?? '.', 'seed-manifest.json');
const PID = path.join(RUN ?? '.', 'server.pid');
const PORT = path.join(RUN ?? '.', 'port');
const CALLS = path.join(RUN ?? '.', 'calls.log');
const ARGS = path.join(RUN ?? '.', 'args.log');
const CHARTER = path.join(import.meta.dirname, '..', '..', 'sessions', 'bookmarks', 'charter.json');
const SPEC = path.join(
    import.meta.dirname,
    '..',
    '..',
    'sessions',
    'bookmarks',
    'generated',
    'channels_bookmarks_bar_follows_switch.spec.ts',
);

const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const log = (line) => fs.appendFileSync(CALLS, `${line}\n`);
const logArgs = (cmd, args) =>
    fs.appendFileSync(ARGS, `${cmd} [${args.join(' ')}] image=${process.env.MATTERMOST_PILOT_IMAGE ?? 'unset'}\n`);
const rand = () => crypto.randomBytes(6).toString('hex');

function serverAlive() {
    try {
        process.kill(Number(fs.readFileSync(PID, 'utf8')), 0);
        return true;
    } catch {
        return false;
    }
}

async function startServer() {
    if (serverAlive()) {
        return;
    }
    fs.rmSync(PORT, {force: true});
    const child = spawn(process.execPath, [import.meta.filename, 'server'], {
        detached: true,
        stdio: 'ignore',
        env: process.env,
    });
    child.unref();
    fs.writeFileSync(PID, String(child.pid));
    for (let i = 0; i < 100 && !fs.existsSync(PORT); i++) {
        await new Promise((r) => setTimeout(r, 50));
    }
}

function serve() {
    const server = http.createServer((req, res) => {
        const json = (status, body, headers = {}) => {
            res.writeHead(status, {'Content-Type': 'application/json', ...headers});
            res.end(JSON.stringify(body));
        };
        if (req.method === 'POST' && req.url === '/api/v4/users/login') {
            return json(200, {id: 'fake-admin'}, {token: 'fake-token'});
        }
        const m = /^\/api\/v4\/channels\/([^/]+)\/bookmarks$/.exec(req.url ?? '');
        if (req.method === 'GET' && m && req.headers.authorization === 'Bearer fake-token') {
            const state = read(STATE);
            const hit = Object.values(state.bookmarks).find((b) => b.channel_id === m[1]);
            return json(200, hit ? [{id: hit.id, display_name: hit.title, delete_at: 0}] : []);
        }
        return json(404, {});
    });
    server.listen(0, '127.0.0.1', () => fs.writeFileSync(PORT, String(server.address().port)));
}

function declared() {
    return read(CHARTER).fixture_setup.bookmarks.map((b) => ({channel: b.channel, title: b.display_name}));
}

async function up(args) {
    logArgs('up', args);
    const session = args.includes('--session=bookmarks');
    log(`up${session ? ' session=bookmarks' : ''}`);
    let state = fs.existsSync(STATE) ? read(STATE) : null;
    if (!state) {
        const stack = rand();
        state = {
            stack,
            bookmarks: Object.fromEntries(
                declared().map((d) => [
                    d.channel,
                    {id: `bm-${d.channel}-${stack}`, channel_id: `ch-${d.channel}-${stack}`, title: d.title},
                ]),
            ),
        };
        write(STATE, state);
    }
    await startServer();
    const manifest = {
        schema: 'explorer-pilot-seed/v1',
        base_url: `http://127.0.0.1:${fs.readFileSync(PORT, 'utf8')}`,
        variant: 'default',
        team: {id: 'team', name: 'qa-team', display_name: 'QA Team'},
        channels: Object.fromEntries(
            Object.entries(state.bookmarks).map(([channel, b]) => [channel, {id: b.channel_id, name: channel}]),
        ),
    };
    if (session && process.env.FAKE_OMIT_SESSION !== '1') {
        manifest.session = {
            name: 'bookmarks',
            bookmarks: Object.fromEntries(
                Object.entries(state.bookmarks).map(([channel, b]) => [
                    channel,
                    {id: b.id, display_name: b.title, type: 'link'},
                ]),
            ),
        };
    }
    write(MANIFEST, manifest);
    process.stdout.write('ready\n');
}

function gate(args) {
    logArgs('gate', args);
    log('gate');
    fs.rmSync(STATE, {force: true});
    fs.rmSync(MANIFEST, {force: true});
    if (serverAlive()) {
        process.kill(Number(fs.readFileSync(PID, 'utf8')));
    }
    fs.rmSync(PID, {force: true});
    process.stdout.write("[DIRECT  ] PASS IsLicensed === 'true': PASS\nGATE: PASS\n");
}

function down() {
    log('down');
    if (serverAlive()) {
        process.kill(Number(fs.readFileSync(PID, 'utf8')));
    }
    for (const f of [STATE, MANIFEST, PID, PORT]) {
        fs.rmSync(f, {force: true});
    }
    process.stdout.write('down\n');
}

function ctl(args) {
    const [cmd, ...rest] = args;
    const channel = rest.find((a) => a.startsWith('--channel='))?.slice(10);
    const state = read(STATE);
    const entry = state.bookmarks[channel];
    if (!entry) {
        process.stdout.write('FAIL (no bookmark)\n');
        process.exit(1);
    }
    if (cmd === 'read') {
        process.stdout.write(`${JSON.stringify([entry.title])}\n`);
        return;
    }
    entry.title = rest.find((a) => a.startsWith('--title=')).slice(8);
    write(STATE, state);
    process.stdout.write('PASS\n');
}

function verifySeed() {
    log('verify_seed');
    const manifest = read(MANIFEST);
    const ok = declared().every((d) => manifest.session?.bookmarks?.[d.channel]?.display_name === d.title);
    const state = read(STATE);
    const live = declared().every((d) => state.bookmarks[d.channel].title === d.title);
    process.stdout.write(`[DIRECT  ] ${ok && live ? 'PASS' : 'FAIL'} seed\n`);
    process.exit(ok && live ? 0 : 1);
}

function stepRows(changed) {
    const matchers = ['toHaveURL', 'toBeVisible', 'toBeVisible', 'toHaveCount', 'toHaveCount'];
    const lines = [33, 34, 35, 36, 37, 43, 44, 45, 46, 47];
    const rows = lines.map((line, i) => ({line, matcher: matchers[i % 5], error: false}));
    return changed ? rows.slice(0, 8).map((r, i) => ({...r, error: i === 7})) : rows;
}

async function replay() {
    log('replay');
    const sleep = Number(
        (process.env.PILOT_STEP_OUT ? process.env.FAKE_VERIFIER_SLEEP : process.env.FAKE_REPLAY_SLEEP) ?? 0,
    );
    if (sleep > 0) {
        await new Promise((r) => setTimeout(r, sleep));
    }
    const state = read(STATE);
    const titleNow = state.bookmarks['release-planning'].title;
    const changed = titleNow !== declared().find((d) => d.channel === 'release-planning').title;
    const spec = {
        title: 'channels.bookmarks:bar-follows-switch: initial_bar then follows_switch',
        file: path.basename(SPEC),
    };
    const report = (test, stats) => ({
        config: {projects: [{name: 'chrome', retries: 0}], workers: 1},
        suites: [{title: spec.file, file: spec.file, specs: [{...spec, tests: [test]}]}],
        errors: [],
        stats,
    });
    let doc;
    if (changed) {
        const context = path.join(RUN, 'error-context.md');
        fs.writeFileSync(
            context,
            [
                '# Error details',
                '',
                '```',
                'Error: expect(locator).toBeVisible() failed',
                '```',
                '',
                '```yaml',
                '- generic [ref=e1]:',
                '  - link "release planning public channel" [ref=e5]:',
                `    - /url: ${read(MANIFEST).base_url}/qa-team/channels/release-planning`,
                `  - link "${titleNow}" [ref=e9]:`,
                `    - /url: ${read(MANIFEST).base_url}/qa-team/channels/release-planning`,
                '  - button "Bookmark menu" [ref=e10]',
                '  - button "Add a bookmark" [ref=e11]',
                '```',
                '',
            ].join('\n'),
        );
        const message = `Error: expect(locator).toBeVisible() failed\n\nLocator: getByTestId('channel-bookmarks-container').getByRole('link', { name: 'Release brief echo 5b90', exact: true })\nExpected: visible\nTimeout: 10000ms\nError: element(s) not found\n\nPage: ${read(MANIFEST).base_url}/qa-team/channels/release-planning\n\n  44 |         await expect(bookmarkBar).toBeVisible();\n> 45 |         await expect(bookmarkBar.getByRole('link')).toBeVisible();\n     |                                                      ^`;
        doc = report(
            {
                expectedStatus: 'passed',
                status: 'unexpected',
                results: [
                    {
                        status: 'failed',
                        retry: 0,
                        errors: [{message, location: {file: SPEC, line: 45, column: 3}}],
                        attachments: [{name: 'error-context', path: context}],
                    },
                ],
            },
            {expected: 0, unexpected: 1, flaky: 0, skipped: 0},
        );
    } else {
        doc = report(
            {expectedStatus: 'passed', status: 'expected', results: [{status: 'passed', retry: 0, errors: []}]},
            {expected: 1, unexpected: 0, flaky: 0, skipped: 0},
        );
    }
    write(process.env.PILOT_REPLAY_REPORT, doc);
    if (process.env.PILOT_STEP_OUT) {
        fs.writeFileSync(process.env.PILOT_STEP_OUT, JSON.stringify(stepRows(changed)));
    }
    process.exit(changed ? 1 : 0);
}

const [command, ...args] = process.argv.slice(2);
const commands = {gate, up, down, ctl, replay, server: serve, verify_seed: verifySeed};
if (!commands[command]) {
    process.stderr.write('unknown fake infra command\n');
    process.exit(2);
}
await commands[command](args);
