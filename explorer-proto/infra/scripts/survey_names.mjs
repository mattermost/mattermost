#!/usr/bin/env node
// Read-only UI name survey of the seeded channel page, for comparing two Mattermost builds.
//   node survey_names.mjs run --label=<name>      survey the live stack as qa-user, print the names
//   node survey_names.mjs show <label>            print a stored survey
//   node survey_names.mjs diff <labelA> <labelB>  table of names present in only one of the two surveys
// Stores .run/survey/<label>.json (git-ignored). Prints names only: no ids, URLs, ports or origins.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const INFRA = path.resolve(HERE, '..');
const PROTO = path.resolve(INFRA, '..');
const REPO = path.resolve(PROTO, '..');
const SURVEY_DIR = path.join(INFRA, '.run', 'survey');
const MANIFEST = path.join(INFRA, '.run', 'seed-manifest.json');
const PLAYWRIGHT_BIN = path.join(REPO, 'e2e-tests', 'playwright', 'node_modules', '.bin', 'playwright');
const LABEL = /^[a-z0-9.-]{1,40}$/;

const CATEGORIES = [
    ['landmarks', 'landmarks'],
    ['sidebar_links', 'sidebar channel links'],
    ['channel_header_buttons', 'channel-header buttons'],
    ['info_toggle_closed', 'Info toggle (panel closed)'],
    ['info_toggle_open', 'Info toggle (panel open)'],
    ['info_panel_landmarks', 'Info panel landmarks'],
    ['info_panel_controls', 'Info panel controls'],
    ['channel_menu_items', 'channel menu items'],
    ['favorite_controls', 'favorite/star controls'],
    ['bookmark_links', 'bookmark links'],
    ['bookmark_controls', 'bookmark controls'],
];

const UNSAFE = /https?:\/\/|127\.0\.0\.1|localhost|(?<![a-z0-9])[a-z0-9]{26}(?![a-z0-9])/i;

function fail(message, code = 1) {
    process.stderr.write(`${message}\n`);
    process.exit(code);
}

function storedPath(label) {
    if (!LABEL.test(label ?? '')) {
        fail('label must match [a-z0-9.-]{1,40}', 2);
    }
    return path.join(SURVEY_DIR, `${label}.json`);
}

function load(label) {
    const file = storedPath(label);
    if (!fs.existsSync(file)) {
        fail(`no survey stored for label ${label}`);
    }
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function assertSafe(survey) {
    for (const [key] of CATEGORIES) {
        for (const entry of survey[key] ?? []) {
            if (UNSAFE.test(entry)) {
                fail(`refusing to print: an entry in ${key} looks like an id, URL or origin`);
            }
        }
    }
}

function show(survey) {
    assertSafe(survey);
    const lines = [`survey ${survey.label}`];
    for (const [key, title] of CATEGORIES) {
        const entries = survey[key] ?? [];
        lines.push(
            `## ${title} (${entries.length})`,
            ...(entries.length ? entries.map((e) => `- ${e}`) : ['- (none)']),
        );
    }
    process.stdout.write(`${lines.join('\n')}\n`);
}

function diff(a, b) {
    assertSafe(a);
    assertSafe(b);
    const rows = [];
    let unchanged = 0;
    for (const [key, title] of CATEGORIES) {
        const before = new Set(a[key] ?? []);
        const after = new Set(b[key] ?? []);
        for (const name of before) {
            if (!after.has(name)) {
                rows.push([title, name, 'present', 'absent']);
            }
        }
        for (const name of after) {
            if (!before.has(name)) {
                rows.push([title, name, 'absent', 'present']);
            }
        }
        unchanged += [...before].filter((n) => after.has(n)).length;
    }
    const lines = [`| category | name | ${a.label} | ${b.label} |`, '| --- | --- | --- | --- |'];
    lines.push(...rows.map(([c, n, x, y]) => `| ${c} | \`${n}\` | ${x} | ${y} |`));
    lines.push('', `${rows.length} differences, ${unchanged} names identical in both`);
    process.stdout.write(`${lines.join('\n')}\n`);
}

function run(label) {
    if (!fs.existsSync(MANIFEST)) {
        fail('seed manifest missing: run explorer-proto/infra/scripts/up.sh first');
    }
    if (!fs.existsSync(path.join(PROTO, 'node_modules'))) {
        fail('explorer-proto/node_modules symlink missing (see explorer-proto/src/README-engine.md)');
    }
    const baseUrl = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')).base_url;
    const ping = spawnSync('node', [path.join(HERE, 'probe.mjs'), 'ready', baseUrl], {stdio: 'ignore'});
    if (ping.status !== 0) {
        fail('the stack does not answer on the forwarder: run up.sh first');
    }
    const env = {...process.env, SURVEY_LABEL: label, PW_BASE_URL: baseUrl};
    delete env.MM_LICENSE;
    delete env.PW_USE_TESTCONTAINERS;
    fs.rmSync(storedPath(label), {force: true});
    const result = spawnSync(PLAYWRIGHT_BIN, ['test', '-c', path.join(HERE, 'survey_names.config.ts')], {
        cwd: PROTO,
        env,
        encoding: 'utf8',
    });
    const summary = `${result.stdout}`.split('\n').filter((l) => /^\s+\d+ (passed|failed|skipped)/.test(l));
    process.stdout.write(`${summary.join('\n')}\n`);
    if (result.status !== 0 || !fs.existsSync(storedPath(label))) {
        fail('survey run failed (error bodies are not printed because they can carry ids and URLs)');
    }
    show(load(label));
}

const [command, ...args] = process.argv.slice(2);
if (command === 'run') {
    const arg = args.find((a) => a.startsWith('--label='));
    run(arg ? arg.slice('--label='.length) : undefined);
} else if (command === 'show') {
    show(load(args[0]));
} else if (command === 'diff') {
    diff(load(args[0]), load(args[1]));
} else {
    fail('usage: survey_names.mjs run --label=<name> | show <label> | diff <labelA> <labelB>', 2);
}
