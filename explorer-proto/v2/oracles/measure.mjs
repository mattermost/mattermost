// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-process-env, no-process-exit, no-await-in-loop, @stylistic/indent, @stylistic/dot-location, @stylistic/multiline-ternary, @stylistic/operator-linebreak -- CLI script: the repo config relaxes these for .ts/.js only, Prettier owns formatting */
// Measures the oracles on the live seeded stack. Run from the repository root after
// `explorer-proto/v2/oracles/stack.sh up` (or infra up.sh):
//   node explorer-proto/v2/oracles/measure.mjs [--out=<dir>] [--repeat=3] [--skip-bookmarks] [--render-only]
// Writes measurement.json and measurement.md (port-free, id-free) plus the raw findings JSONL files.
// Every traversal is a fixed MEASUREMENT SCRIPT, not discovery. Every fault is SYNTHETIC and labelled INJECTED.
import {spawn, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {startFaultProxy} from './faults/fault-proxy.ts';
import {attachOracles} from './lib/attach.ts';
import {CATALOG} from './lib/catalog.ts';
import {startFixtureServer} from './lib/fixture-server.ts';
import {closeFixtureSession, launchBrowser, openFixtureSession} from './lib/fixture-session.ts';
import {checkEnterWhileConfirmDisabled} from './lib/oracle-modal.ts';
import {SCENARIOS} from './lib/scenarios.ts';
import {createScrubber} from './lib/scrub.ts';
import {EXTRA_TRAVERSALS, TRAVERSALS} from './lib/traversals.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const PROTO = path.resolve(here, '..', '..');
const REPO = path.dirname(PROTO);
const INFRA_SCRIPTS = path.join(PROTO, 'infra', 'scripts');
const MANIFEST = path.join(PROTO, 'infra', '.run', 'seed-manifest.json');
const PLAYWRIGHT_BIN = path.join(REPO, 'e2e-tests', 'playwright', 'node_modules', '.bin', 'playwright');
const MM_IMAGE_DEFAULT =
    'mattermost/mattermost-enterprise-edition:12.1.0@sha256:059c6ae272a7d54c1f38ed946fb6005aca7b02a096192800da8ee0bd79ade0e7';
const SITE_ORIGIN = process.env.ORACLE_SITE_ORIGIN || 'http://127.0.0.1:8065';

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const OUT = path.resolve(arg('out') ?? path.join(here, 'results'));
const REPEAT = Number(arg('repeat') ?? 3);
const SKIP_BOOKMARKS = process.argv.includes('--skip-bookmarks');
const RUN_ROOT = path.join(here, '.run', 'measure');

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const baseUrl = process.env.PW_BASE_URL || manifest.base_url;
const upstreamPort = Number(new URL(baseUrl).port);
const ids = [manifest.user.id, manifest.team.id, ...Object.values(manifest.channels).map((c) => c.id)];
const scrubber = createScrubber({origins: [baseUrl, SITE_ORIGIN], ids, literals: [manifest.user.password]});

const say = (line) => process.stdout.write(`${scrubber.text(line, 400)}\n`);
const ERROR_LINE = /Error|expect|Timeout|✘/;
const compare = (a, b) => {
    if (a === b) {
        return 0;
    }
    return a < b ? -1 : 1;
};

function probe(kind) {
    return spawnSync('node', [path.join(INFRA_SCRIPTS, 'probe.mjs'), kind, baseUrl], {stdio: 'ignore'}).status === 0;
}

function playwrightEnv(extra) {
    const env = {...process.env, ...extra};
    delete env.MM_LICENSE;
    delete env.PW_USE_TESTCONTAINERS;
    delete env.NO_COLOR;
    return env;
}

/** Runs the Playwright measurement spec in a child process; async so an in-process fault proxy keeps serving. */
async function runSpec({tag, outDir, runDir, url, env}) {
    fs.mkdirSync(outDir, {recursive: true});
    fs.rmSync(runDir, {recursive: true, force: true});
    fs.mkdirSync(runDir, {recursive: true});
    const child = spawn(PLAYWRIGHT_BIN, ['test', '-c', 'v2/oracles/playwright.config.ts'], {
        cwd: PROTO,
        env: playwrightEnv({PW_BASE_URL: url, ORACLE_OUT: outDir, ORACLE_RUN_DIR: runDir, ...env}),
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk) => {
        output += chunk;
    });
    child.stderr.on('data', (chunk) => {
        output += chunk;
    });
    const status = await new Promise((resolve) => child.on('close', resolve));
    let stats = {expected: 0, unexpected: 0, skipped: 0, flaky: 0};
    try {
        stats = JSON.parse(fs.readFileSync(path.join(runDir, 'playwright-report.json'), 'utf8')).stats;
    } catch {
        // No report: treated as a failed spawn below.
    }
    const ok = status === 0 && stats.unexpected === 0 && stats.skipped === 0 && stats.flaky === 0 && stats.expected > 0;
    say(`  ${tag}: ${ok ? 'ok' : 'FAILED'} (${stats.expected} passed, ${stats.unexpected} failed)`);
    if (!ok) {
        const lines = scrubber.text(
            output
                .split('\n')
                .filter((l) => ERROR_LINE.test(l))
                .slice(0, 12)
                .join(' || '),
            1200,
        );
        say(`    ${lines}`);
    }
    return {ok, stats};
}

function readJsonl(file) {
    if (!fs.existsSync(file)) {
        return [];
    }
    return fs
        .readFileSync(file, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line));
}
const withoutCounts = (bytes) => {
    if (bytes === null) {
        return null;
    }
    return bytes
        .toString('utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => {
            const finding = JSON.parse(line);
            delete finding.count;
            return JSON.stringify(finding);
        })
        .join('\n');
};
const keyOf = (f) => JSON.stringify([f.oracle, f.class, f.path, f.evidence]);
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const hintsFile = path.join(here, 'benign-hints.json');
const hints = fs.existsSync(hintsFile) ? readJson(hintsFile).entries : [];
const hintFor = (f) =>
    hints.find((h) => h.oracle === f.oracle && h.class === f.class && new RegExp(h.evidence_regex).test(f.evidence));

/* ---------- phase A: clean-build false positives ---------- */

function cleanPhase(outDir, tag, extraEnv = {}) {
    return runSpec({
        tag,
        outDir,
        runDir: path.join(RUN_ROOT, tag),
        url: baseUrl,
        env: {ORACLE_REPEAT: String(REPEAT), ...extraEnv},
    });
}

function summarizeClean(outDir, repeat, list) {
    const traversals = [];
    for (const traversal of list) {
        const runs = [];
        for (let i = 1; i <= repeat; i++) {
            const file = path.join(outDir, 'findings', `${traversal.id}.run${i}.jsonl`);
            runs.push({file, bytes: fs.existsSync(file) ? fs.readFileSync(file) : null});
        }
        const distinct = new Map();
        runs.forEach((run, index) => {
            for (const f of run.bytes ? readJsonl(run.file) : []) {
                const entry = distinct.get(keyOf(f)) ?? {...f, runs_present: 0, counts: []};
                entry.runs_present += 1;
                entry.counts[index] = f.count;
                distinct.set(keyOf(f), entry);
            }
        });
        const present = runs.filter((r) => r.bytes);
        const identical = present.length === repeat && present.every((r) => r.bytes.equals(present[0].bytes));
        const identicalIgnoringCount =
            present.length === repeat &&
            present.every((r) => withoutCounts(r.bytes) === withoutCounts(present[0].bytes));
        const summary = readJson(path.join(outDir, 'runs', `${traversal.id}.run1.json`));
        const findings = [...distinct.values()]
            .sort(
                (a, b) =>
                    compare(a.oracle, b.oracle) ||
                    compare(a.class, b.class) ||
                    compare(a.path, b.path) ||
                    compare(a.evidence, b.evidence),
            )
            .map((f) => ({
                oracle: f.oracle,
                class: f.class,
                path: f.path,
                evidence: f.evidence,
                runs_present: f.runs_present,
                of_runs: repeat,
                counts: Array.from({length: repeat}, (_, i) => f.counts[i] ?? 0),
                first_action: f.first_action,
                benign_candidate: hintFor(f)?.reason ?? null,
            }));
        traversals.push({
            id: traversal.id,
            title: traversal.title,
            actions: summary.actions.length,
            findings,
            byte_identical_across_repeats: identical,
            identical_ignoring_count_across_repeats: identicalIgnoringCount,
        });
    }
    return traversals;
}

function runStats(outDir) {
    const dir = path.join(outDir, 'runs');
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).sort() : [];
    const checks = {};
    const websockets = [];
    let oracleErrors = 0;
    let guardBlocked = 0;
    for (const file of files) {
        const run = readJson(path.join(dir, file));
        oracleErrors += run.oracle_errors.length;
        guardBlocked += Object.keys(run.guard_blocked).length;
        websockets.push(run.websocket);
        for (const [check, statuses] of Object.entries(run.checks)) {
            for (const [status, n] of Object.entries(statuses)) {
                checks[check] ??= {};
                checks[check][status] = (checks[check][status] ?? 0) + n;
            }
        }
    }
    const sorted = Object.fromEntries(Object.entries(checks).sort(([a], [b]) => compare(a, b)));
    return {
        runs: files.length,
        oracle_errors: oracleErrors,
        runs_with_guard_blocked_requests: guardBlocked,
        websocket_opened_in_every_run: websockets.every((w) => w.opened > 0 && w.frames_received > 0),
        check_results: sorted,
    };
}

/* ---------- phase B: injected faults ---------- */

function activationCounts(log) {
    const counts = {};
    for (const e of log) {
        counts[e.rule] = (counts[e.rule] ?? 0) + 1;
    }
    return counts;
}

async function runFixtureModal(label, outDir) {
    const server = await startFixtureServer(path.join(here, 'fixtures'));
    const browser = await launchBrowser();
    try {
        const session = await openFixtureSession(browser, server.origin);
        const oracles = attachOracles(session, {a11y: false});
        try {
            await session.page.goto(
                `${server.origin}/modal.html?variant=${label === 'control' ? 'good' : 'enter-bug'}`,
            );
            await oracles.checkpoint();
            oracles.action('press Enter in the Name field while the Create button is disabled');
            await checkEnterWhileConfirmDisabled({
                page: session.page,
                context: session.context,
                origin: session.origin,
                sink: oracles.sink,
                action: 1,
                dialog: session.page.getByRole('dialog', {name: 'Create thing'}),
                confirm: session.page.getByRole('button', {name: 'Create'}),
                field: session.page.getByLabel('Name'),
            });
            oracles.detach();
            fs.mkdirSync(path.join(outDir, 'findings'), {recursive: true});
            oracles.sink.write(path.join(outDir, 'findings', `S6-modal-enter-while-disabled.${label}.jsonl`));
        } finally {
            await closeFixtureSession(session);
        }
    } finally {
        await browser.close();
        await server.close();
    }
}

async function runOne(scenario, label, dir) {
    const outDir = path.join(dir, label);
    const tag = `${scenario.id} ${label}`;
    if (scenario.kind === 'fixture') {
        await runFixtureModal(label, outDir);
        say(`  ${tag}: ok (local static fixture)`);
        return {ok: true, log: []};
    }
    const env = {
        ORACLE_SCENARIO: scenario.id,
        ORACLE_RUN_LABEL: label,
        ...(scenario.kind === 'proxy' && scenario.rest !== 'via-fault-layer' ? {ORACLE_REST_ORIGIN: baseUrl} : {}),
    };
    if (scenario.kind === 'proxy') {
        const configName = label === 'control' ? 'control-passthrough.json' : scenario.faultConfig;
        const config = readJson(path.join(here, 'faults', configName));
        fs.mkdirSync(outDir, {recursive: true});
        const logPath = path.join(outDir, 'fault-log.jsonl');
        const proxy = await startFaultProxy({config, upstreamPort, siteOrigin: SITE_ORIGIN, logPath});
        try {
            const result = await runSpec({
                tag,
                outDir,
                runDir: path.join(RUN_ROOT, scenario.id, label),
                url: proxy.origin,
                env,
            });
            return {...result, log: [...proxy.log]};
        } finally {
            await proxy.close();
        }
    }
    const result = await runSpec({tag, outDir, runDir: path.join(RUN_ROOT, scenario.id, label), url: baseUrl, env});
    return {...result, log: []};
}

function evaluateScenario(scenario, dir, spawns) {
    const base = scenario.id;
    const fileOf = (label) => path.join(dir, label, 'findings', `${base}.${label}.jsonl`);
    const control = readJsonl(fileOf('control'));
    const controlKeys = new Set(control.map(keyOf));
    const faulted = readJsonl(fileOf('faulted-1'));
    const novel = faulted.filter((f) => !controlKeys.has(keyOf(f)));
    const wanted = novel.filter(
        (f) =>
            scenario.expect.oracle === '*' ||
            (f.oracle === scenario.expect.oracle &&
                f.class === scenario.expect.class &&
                (!scenario.expect.evidence_includes || f.evidence.includes(scenario.expect.evidence_includes))),
    );
    const runFile = path.join(dir, 'faulted-1', 'runs', `${base}.faulted-1.json`);
    const traversalError = fs.existsSync(runFile) ? readJson(runFile).traversal_error : null;
    const first = wanted.length > 0 ? Math.min(...wanted.map((f) => f.first_action)) : null;
    const a = fs.existsSync(fileOf('faulted-1')) ? fs.readFileSync(fileOf('faulted-1')) : null;
    const b = fs.existsSync(fileOf('faulted-2')) ? fs.readFileSync(fileOf('faulted-2')) : null;
    const activations = activationCounts(spawns['faulted-1']?.log ?? []);
    const wantsActivation = scenario.kind === 'proxy';
    return {
        id: scenario.id,
        label: 'INJECTED (SYNTHETIC)',
        title: scenario.title,
        mechanism: scenario.kind,
        traversal: scenario.traversal,
        expected_oracle:
            scenario.expect.oracle === '*'
                ? 'any oracle (none designed for this)'
                : `${scenario.expect.oracle} / ${scenario.expect.class}`,
        trigger_action: scenario.trigger_action,
        detected: wanted.length > 0,
        first_detection_action: first,
        time_to_detect_actions: first === null ? null : first - scenario.trigger_action,
        traversal_error_under_fault: traversalError,
        matching_findings: wanted.map((f) => ({
            oracle: f.oracle,
            class: f.class,
            path: f.path,
            evidence: f.evidence,
            count: f.count,
            first_action: f.first_action,
        })),
        collateral_new_findings: novel
            .filter((f) => !wanted.includes(f))
            .map((f) => ({
                oracle: f.oracle,
                class: f.class,
                path: f.path,
                evidence: f.evidence,
                count: f.count,
                first_action: f.first_action,
            })),
        control_findings: control.length,
        fault_activations: wantsActivation ? activations : null,
        fault_activated: wantsActivation ? Object.keys(activations).length > 0 : true,
        spawns_ok: Object.values(spawns).every((s) => s.ok),
        byte_identical_across_two_runs: a !== null && b !== null && a.equals(b),
        identical_ignoring_count_across_two_runs: a !== null && b !== null && withoutCounts(a) === withoutCounts(b),
    };
}

async function scenarioPhase(scenario, root) {
    say(`scenario ${scenario.id} (${scenario.kind}; SYNTHETIC)`);
    const dir = path.join(root, scenario.id);
    const spawns = {};
    for (const label of ['control', 'faulted-1', 'faulted-2']) {
        spawns[label] = await runOne(scenario, label, dir);
    }
    return evaluateScenario(scenario, dir, spawns);
}

/* ---------- report ---------- */

function identity(strict, ignoringCount) {
    if (strict) {
        return 'yes';
    }
    return ignoringCount ? 'only count differs' : 'NO';
}

function table(headers, rows) {
    return [
        `| ${headers.join(' | ')} |`,
        `| ${headers.map(() => '---').join(' | ')} |`,
        ...rows.map((r) => `| ${r.join(' | ')} |`),
    ].join('\n');
}

function renderReport(result) {
    const lines = [];
    lines.push('# Oracle measurement', '');
    lines.push(
        'Generated by `explorer-proto/v2/oracles/measure.mjs`. Port-free and id-free. The traversals are fixed **measurement scripts, not discovery**. Every fault below is **SYNTHETIC and INJECTED**; none is a product bug.',
        '',
        `- Mattermost image: \`${result.image}\``,
        `- IsLicensed === 'true': ${result.is_licensed}`,
        `- Commit: \`${result.commit}\``,
        `- Browser flag \`--disable-features=LocalNetworkAccessChecks\` (see README): ${result.browser_flag_lna_workaround}`,
        '',
    );
    lines.push('## Clean-build false positives (unfaulted, default seed)', '');
    const oracles = CATALOG.map((c) => c.oracle);
    const rows = result.clean.traversals.map((t) => [
        t.id,
        String(t.actions),
        ...oracles.map((o) => {
            const list = t.findings.filter((f) => f.oracle === o);
            return `${list.length} (${list.filter((f) => f.runs_present === f.of_runs).length} in ${result.repeat}/${result.repeat})`;
        }),
        identity(t.byte_identical_across_repeats, t.identical_ignoring_count_across_repeats),
    ]);
    lines.push(
        `Cells: distinct findings (of which present in all ${result.repeat} repeats). Each traversal ran ${result.repeat} times.`,
        '',
        table(['traversal', 'actions', ...oracles, 'identical repeats'], rows),
        '',
    );
    lines.push('### Every clean-build finding', '');
    const all = result.clean.traversals.flatMap((t) =>
        t.findings.map((f) => [
            t.id,
            f.oracle,
            f.class,
            `\`${f.path}\``,
            f.evidence.replace(/\|/g, '\\|'),
            `${f.runs_present}/${f.of_runs}`,
            f.counts.join('/'),
            f.benign_candidate ?? 'REVIEW',
        ]),
    );
    lines.push(
        all.length === 0
            ? '_None._'
            : table(
                  [
                      'traversal',
                      'oracle',
                      'class',
                      'path',
                      'evidence',
                      'repeats',
                      'counts per run',
                      'benign candidate?',
                  ],
                  all,
              ),
        '',
    );
    lines.push('### Extra live probe (outside the five-traversal table)', '');
    lines.push(
        'The modal oracle on the real Create-channel dialog: Enter is pressed in the empty name field while the Create channel button is disabled. Nothing is typed, so the typing-dependent half of O-MODAL is not exercised on the live stack.',
        '',
    );
    const extra = result.clean.extra_probes.flatMap((t) =>
        t.findings.map((f) => [
            t.id,
            f.oracle,
            f.class,
            `\`${f.path}\``,
            f.evidence.replace(/\|/g, '\\|'),
            `${f.runs_present}/${f.of_runs}`,
            f.benign_candidate ?? 'REVIEW',
        ]),
    );
    lines.push(
        extra.length === 0
            ? '_No findings._'
            : table(['probe', 'oracle', 'class', 'path', 'evidence', 'repeats', 'benign candidate?'], extra),
        '',
        `Repeats byte-identical: ${result.clean.extra_probes.every((t) => t.byte_identical_across_repeats) ? 'yes' : 'NO'}.`,
        '',
    );
    lines.push(
        'Nothing is allowlisted: `allowlist.json` is empty. "benign candidate" is a hint from `benign-hints.json` for the lead, not a suppression.',
        '',
    );
    lines.push(
        '### Checks evaluated during the clean runs',
        '',
        '```json',
        JSON.stringify(result.clean.stats.check_results, null, 2),
        '```',
        '',
    );
    lines.push(
        `- Oracle-internal errors: ${result.clean.stats.oracle_errors}; runs with guard-blocked requests: ${result.clean.stats.runs_with_guard_blocked_requests}; app WebSocket connected and received frames in every run: ${result.clean.stats.websocket_opened_in_every_run}.`,
        '',
    );
    if (result.no_lna_workaround) {
        lines.push('## Harness artefact: the guard without the browser flag', '');
        lines.push(
            `Every traversal once with the flag removed (\`ORACLE_LNA_WORKAROUND=0\`), listing only findings that the flagged clean runs did not have. App WebSocket usable: ${result.no_lna_workaround.websocket_usable}.`,
            '',
            result.no_lna_workaround.findings.length === 0
                ? '_None._'
                : table(
                      ['oracle', 'class', 'evidence', 'total count', 'traversals'],
                      result.no_lna_workaround.findings.map((f) => [
                          f.oracle,
                          f.class,
                          f.evidence.replace(/\|/g, '\\|'),
                          String(f.count),
                          String(f.traversals),
                      ]),
                  ),
            '',
        );
    }
    lines.push('## Injected-fault detection (SYNTHETIC)', '');
    lines.push(
        table(
            [
                'fault',
                'mechanism',
                'expected oracle / class',
                'result',
                'first detection (action)',
                'time-to-detect (actions after trigger)',
                'activations',
                'scripted path broken by the fault',
                'identical on rerun',
            ],
            result.faults.map((f) => [
                `${f.id}: ${f.title}`,
                f.mechanism,
                f.expected_oracle,
                f.detected ? 'DETECTED' : 'MISSED',
                f.first_detection_action === null ? 'n/a' : String(f.first_detection_action),
                f.time_to_detect_actions === null
                    ? 'n/a'
                    : `${f.time_to_detect_actions} (trigger at action ${f.trigger_action})`,
                f.fault_activations === null ? 'n/a (page/fixture)' : JSON.stringify(f.fault_activations),
                f.traversal_error_under_fault ? `yes: ${f.traversal_error_under_fault.replace(/\|/g, '\\|')}` : 'no',
                identity(f.byte_identical_across_two_runs, f.identical_ignoring_count_across_two_runs),
            ]),
        ),
        '',
    );
    for (const f of result.faults) {
        if (f.collateral_new_findings.length > 0 || !f.detected) {
            lines.push(`### ${f.id}: other new findings versus its control`, '');
            lines.push(
                f.collateral_new_findings.length === 0
                    ? '_None; the expected finding did not appear._'
                    : table(
                          ['oracle', 'class', 'path', 'evidence', 'count', 'first action'],
                          f.collateral_new_findings.map((x) => [
                              x.oracle,
                              x.class,
                              `\`${x.path}\``,
                              x.evidence.replace(/\|/g, '\\|'),
                              String(x.count),
                              String(x.first_action),
                          ]),
                      ),
                '',
            );
        }
    }
    lines.push('## Determinism', '');
    lines.push(
        table(
            ['set', 'result'],
            [
                [
                    `clean traversals and the extra probe, ${result.repeat} repeats each: strict bytes`,
                    result.determinism.clean_all_identical
                        ? 'byte-identical for every one'
                        : `NOT byte-identical: ${result.determinism.clean_not_identical.join(', ')}`,
                ],
                [
                    'clean: ignoring `count`',
                    result.determinism.clean_all_identical_ignoring_count ? 'identical for every one' : 'NOT identical',
                ],
                [
                    'each injected fault, two runs: strict bytes',
                    result.determinism.faults_all_identical
                        ? 'byte-identical for every fault'
                        : `NOT byte-identical: ${result.determinism.faults_not_identical.join(', ')}`,
                ],
                [
                    'faults: ignoring `count`',
                    result.determinism.faults_all_identical_ignoring_count
                        ? 'identical for every fault'
                        : `NOT identical: ${result.determinism.faults_not_identical_ignoring_count.join(', ')}`,
                ],
            ],
        ),
        '',
    );
    lines.push('## Oracle catalog', '');
    lines.push(
        table(
            ['oracle', 'classes', 'needs typing', 'needs Enter'],
            CATALOG.map((c) => [
                c.oracle,
                c.classes.join(', '),
                c.needs_typing ? 'yes' : 'no',
                c.needs_enter ? 'yes' : 'no',
            ]),
        ),
        '',
    );
    return `${lines.join('\n')}\n`;
}

/* ---------- main ---------- */

async function renderOnly() {
    const result = JSON.parse(fs.readFileSync(path.join(OUT, 'measurement.json'), 'utf8'));
    const report = renderReport(result);
    scrubber.assertClean(report);
    fs.writeFileSync(path.join(OUT, 'measurement.md'), report);
    say('measurement.md re-rendered from measurement.json');
    return 0;
}

async function main() {
    if (process.argv.includes('--render-only')) {
        return renderOnly();
    }
    say('Oracle measurement (traversals are measurement scripts, not discovery; faults are SYNTHETIC)');
    if (!probe('ready')) {
        say('stack not ready: run explorer-proto/v2/oracles/stack.sh up first');
        return 1;
    }
    const licensed = probe('license');
    say(`IsLicensed === 'true': ${licensed ? 'PASS' : 'FAIL'}`);
    if (!licensed) {
        return 1;
    }
    fs.rmSync(OUT, {recursive: true, force: true});
    fs.mkdirSync(OUT, {recursive: true});
    fs.rmSync(RUN_ROOT, {recursive: true, force: true});

    say(`phase A: clean build, ${TRAVERSALS.length} traversals x ${REPEAT} runs`);
    const cleanDir = path.join(OUT, 'clean');
    const cleanSpawn = await cleanPhase(cleanDir, 'clean');
    const clean = {
        traversals: summarizeClean(cleanDir, REPEAT, TRAVERSALS),
        extra_probes: summarizeClean(cleanDir, REPEAT, EXTRA_TRAVERSALS),
        stats: runStats(cleanDir),
        spawn_ok: cleanSpawn.ok,
    };

    say('phase A2: guard without the browser flag (every traversal once)');
    const noLnaDir = path.join(OUT, 'clean-without-browser-flag');
    await cleanPhase(noLnaDir, 'no-flag', {ORACLE_LNA_WORKAROUND: '0', ORACLE_REPEAT: '1'});
    const cleanKeys = new Set(
        [...TRAVERSALS, ...EXTRA_TRAVERSALS].flatMap((t) =>
            readJsonl(path.join(cleanDir, 'findings', `${t.id}.run1.jsonl`)).map(keyOf),
        ),
    );
    const noLnaAll = [...TRAVERSALS, ...EXTRA_TRAVERSALS].flatMap((t) =>
        readJsonl(path.join(noLnaDir, 'findings', `${t.id}.run1.jsonl`)),
    );
    const noLnaFindings = [
        ...noLnaAll
            .filter((f) => !cleanKeys.has(keyOf(f)))
            .reduce((acc, f) => {
                const key = JSON.stringify([f.oracle, f.class, f.evidence]);
                const entry = acc.get(key) ?? {
                    oracle: f.oracle,
                    class: f.class,
                    evidence: f.evidence,
                    count: 0,
                    traversals: 0,
                };
                entry.count += f.count;
                entry.traversals += 1;
                return acc.set(key, entry);
            }, new Map())
            .values(),
    ].sort((a, b) => compare(a.oracle, b.oracle) || compare(a.class, b.class) || compare(a.evidence, b.evidence));
    const noLnaRuns = fs.existsSync(path.join(noLnaDir, 'runs'))
        ? fs.readdirSync(path.join(noLnaDir, 'runs')).map((f) => readJson(path.join(noLnaDir, 'runs', f)))
        : [];
    const noLna = {
        findings: noLnaFindings,
        websocket_usable: noLnaRuns.length > 0 && noLnaRuns.every((r) => r.websocket.frames_received > 0),
    };

    say('phase B: injected faults');
    const faults = [];
    for (const scenario of SCENARIOS.filter((s) => !s.session)) {
        faults.push(await scenarioPhase(scenario, path.join(OUT, 'faults')));
    }

    if (!SKIP_BOOKMARKS) {
        say('phase C: bookmarks session seed (non-vacuous bookmark check) and F8');
        const seed = spawnSync('node', [path.join(INFRA_SCRIPTS, 'seed.mjs'), '--session=bookmarks'], {
            env: {...process.env, PW_BASE_URL: baseUrl},
            stdio: 'ignore',
        });
        if (seed.status !== 0) {
            say('bookmarks seed failed (is the server licensed?)');
            return 1;
        }
        for (const scenario of SCENARIOS.filter((s) => s.session === 'bookmarks')) {
            faults.push(await scenarioPhase(scenario, path.join(OUT, 'faults')));
        }
    }

    const head = spawnSync('git', ['rev-parse', 'HEAD'], {cwd: REPO, encoding: 'utf8'}).stdout.trim();
    const everyClean = [...clean.traversals, ...clean.extra_probes];
    const notIdentical = everyClean.filter((t) => !t.byte_identical_across_repeats).map((t) => t.id);
    const notIdenticalIgnoringCount = everyClean
        .filter((t) => !t.identical_ignoring_count_across_repeats)
        .map((t) => t.id);
    const faultsNotIdentical = faults.filter((f) => !f.byte_identical_across_two_runs).map((f) => f.id);
    const faultsNotIdenticalIgnoringCount = faults
        .filter((f) => !f.identical_ignoring_count_across_two_runs)
        .map((f) => f.id);
    const result = {
        schema: 'explorer-oracle-measurement/v1',
        image: process.env.ORACLE_MM_IMAGE || MM_IMAGE_DEFAULT,
        commit: head,
        is_licensed: 'PASS',
        browser_flag_lna_workaround: process.env.ORACLE_LNA_WORKAROUND === '0' ? 'off' : 'on',
        repeat: REPEAT,
        labels: {traversals: 'MEASUREMENT SCRIPTS, NOT DISCOVERY', faults: 'SYNTHETIC / INJECTED'},
        clean,
        no_lna_workaround: noLna,
        faults,
        determinism: {
            clean_all_identical: notIdentical.length === 0,
            clean_not_identical: notIdentical,
            clean_all_identical_ignoring_count: notIdenticalIgnoringCount.length === 0,
            faults_all_identical: faultsNotIdentical.length === 0,
            faults_not_identical: faultsNotIdentical,
            faults_all_identical_ignoring_count: faultsNotIdenticalIgnoringCount.length === 0,
            faults_not_identical_ignoring_count: faultsNotIdenticalIgnoringCount,
        },
    };
    const json = `${JSON.stringify(result, null, 2)}\n`;
    const report = renderReport(result);
    scrubber.assertClean(json);
    scrubber.assertClean(report);
    fs.writeFileSync(path.join(OUT, 'measurement.json'), json);
    fs.writeFileSync(path.join(OUT, 'measurement.md'), report);

    const scan = spawnSync('node', [path.join(INFRA_SCRIPTS, 'leak_scan.mjs'), OUT], {encoding: 'utf8'});
    say(`leak scan of results: ${scan.stdout.trim()}`);
    const faultMisses = faults.filter((f) => !f.detected).map((f) => f.id);
    say(
        `clean byte-identical: ${result.determinism.clean_all_identical} (ignoring count: ${result.determinism.clean_all_identical_ignoring_count}); faults byte-identical: ${result.determinism.faults_all_identical} (ignoring count: ${result.determinism.faults_all_identical_ignoring_count})`,
    );
    say(
        `faults detected: ${faults.filter((f) => f.detected).length}/${faults.length}${faultMisses.length ? ` (missed: ${faultMisses.join(', ')})` : ''}`,
    );
    return scan.status === 0 ? 0 : 1;
}

process.exit(await main());
