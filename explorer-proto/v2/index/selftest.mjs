// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {renderText, runCheck} from './coverage-check.mjs';
import {resolveLead} from './evaluate.mjs';
import {extractRepo, loadIndex, writeIndex} from './extract.mjs';
import {fingerprintOf, stem, tokenize} from './fingerprint.mjs';
import {compareStr} from './lib/strings.mjs';
import {THRESHOLDS, WEIGHTS, verdictFor} from './similarity.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = path.join(HERE, 'fixtures/repo');
const GOLDEN_DIR = path.join(HERE, 'golden');
const UPDATE_GOLDEN = process.argv.includes('--update-golden');

const tests = [];
const test = (name, fn) => tests.push({name, fn});

const result = extractRepo({root: FIXTURE_ROOT, sha: 'fixture'});
const byTitle = (needle) => {
    const hits = result.tests.filter((t) => t.title.includes(needle));
    assert.equal(hits.length, 1, `expected exactly one test titled like "${needle}", got ${hits.length}`);
    return hits[0];
};

test('fixture index counts, suites and origins', () => {
    const c = result.meta.counts;
    assert.equal(c.tests, 14);
    assert.deepEqual(c.by_suite, {cypress: 6, playwright: 8});
    assert.deepEqual(c.by_origin, {emitted: 1, repo: 12, session: 1});
    assert.equal(c.skipped, 2);
    assert.equal(c.source_status.extracted + c.source_status.partial, 14);
});

test('cypress: title, MM-T ids, header tags, stage, line', () => {
    const t = byTitle('MM-T9001');
    assert.equal(t.suite, 'cypress');
    assert.deepEqual(t.mm_t_ids, ['MM-T9001']);
    assert.deepEqual(t.tags, ['@prod', '@widget_flow', '@widgets']);
    assert.equal(t.stage, '@prod');
    assert.equal(t.line, 32);
    assert.deepEqual(t.describe, ['Widget flow']);
    assert.equal(t.source_status, 'extracted');
});

test('cypress: locators, verbs and normalized labels', () => {
    const t = byTitle('MM-T9001');
    const labels = t.actions.map((a) => a.label);
    assert.ok(labels.includes('click role:button[name=Beta]'));
    assert.ok(labels.includes('click text:Gamma text'));
    assert.ok(labels.includes('click css:#widgetHeader'));
    assert.ok(labels.includes('call uiOpenWidgetMenu(Delta)'));
});

test('cypress: custom command resolved one level with parameter substitution and helper file:line', () => {
    const t = byTitle('MM-T9001');
    const click = t.actions.find((a) => a.label === 'click text:Delta');
    assert.ok(click, 'parameter "item" substituted by the call-site literal');
    assert.equal(click.at, 'e2e-tests/cypress/tests/support/ui/widget.js:4');
    assert.equal(click.via, 'e2e-tests/cypress/tests/integration/widgets/widget_flow_spec.js:34');
    const assertion = t.assertions.find((a) => a.target === 'css:#widgetMenu');
    assert.equal(assertion.at, 'e2e-tests/cypress/tests/support/ui/widget.js:6');
    assert.equal(assertion.via, 'e2e-tests/cypress/tests/integration/widgets/widget_flow_spec.js:34');
    assert.equal(assertion.matcher, 'be.visible');
});

test('cypress: helper imported through an alias and an export-star re-export', () => {
    const t = byTitle('MM-T9001');
    const a = t.assertions.find((x) => x.target === 'css:#bannerRoot');
    assert.equal(a.at, 'e2e-tests/cypress/tests/utils/banner.js:2');
    assert.deepEqual(a.expected, ['Welcome']);
});

test('cypress: hooks contribute setup and actors, flagged as hook phase', () => {
    const t = byTitle('MM-T9001');
    const hookSetup = t.setup.filter((s) => s.phase === 'hook').map((s) => s.name);
    assert.deepEqual(hookSetup, ['cy:apiInitSetup', 'cy:apiCreateUser']);
    assert.deepEqual(t.actors.keys, ['initSetup-user']);
    assert.equal(t.actions[0].phase, 'hook');
});

test('cypress: distinct actors (postMessageAs sender, apiLogin) and chained subject labels', () => {
    const t = byTitle('MM-T9002');
    assert.equal(t.actors.count, 3);
    assert.deepEqual(t.actors.keys, ['initSetup-user', 'other', 'owner']);
    assert.ok(t.assertions.some((a) => a.target === 'css:#widgetPanel > text:hello widget'));
    assert.ok(t.assertions.some((a) => a.target === 'css:#widgetPanel > css:.row' && a.matcher === 'contain'));
});

test('cypress: helper inside helper is depth limited, recorded and not marked partial', () => {
    const t = byTitle('MM-T9003');
    assert.ok(t.notes.includes('depth_limited:nestedPanelCheck'));
    const nested = t.actions.find((a) => a.label === 'call nestedPanelCheck()');
    assert.equal(nested.depth_limited, true);
    assert.equal(t.source_status, 'extracted');
});

test('cypress: skipped tests are flagged and template locators keep their static prefix', () => {
    assert.equal(byTitle('MM-T9004').skipped, true);
    const t = byTitle('MM-T9005');
    assert.ok(t.actions.some((a) => a.label === 'click css:#row_abc123'));
    assert.equal(t.source_status, 'extracted');
});

test('cypress: unknown command makes the test partial with a reason', () => {
    const t = byTitle('MM-T9006');
    assert.equal(t.source_status, 'partial');
    assert.deepEqual(t.partial_reasons, ['unresolved_cy_command:mysteryCommand']);
});

test('playwright: objective, tags (options, title, describe), line', () => {
    const t = byTitle('MM-T9101');
    assert.equal(t.objective, 'Verify the widget panel opens an item and shows the banner.');
    assert.deepEqual(t.tags, ['@channels', '@inline', '@widget_flow', '@widgets']);
    assert.equal(t.line, 14);
});

test('playwright: setup calls, config keys and hook setup', () => {
    const t = byTitle('MM-T9101');
    const names = t.setup.map((s) => s.name);
    for (const n of [
        'pw:ensureFeatureFlag',
        'pw:initSetup',
        'api:createPublicChannel',
        'api:patchConfig',
        'helper:createWidgetFixture',
        'api:createWidgetChannel',
    ]) {
        assert.ok(names.includes(n), `missing setup ${n}`);
    }
    assert.deepEqual(t.setup.find((s) => s.name === 'api:patchConfig').detail, ['config:WidgetSettings.EnableBanner']);
    assert.deepEqual(t.setup.find((s) => s.name === 'pw:ensureFeatureFlag').detail, ['flag:WidgetFlag']);
    assert.equal(t.setup.find((s) => s.name === 'pw:ensureFeatureFlag').phase, 'hook');
    const helperSetup = t.setup.find((s) => s.name === 'api:createWidgetChannel');
    assert.equal(helperSetup.at, 'e2e-tests/playwright/lib/src/util.ts:5');
});

test('playwright: page-object method resolved one level to locators with file:line', () => {
    const t = byTitle('MM-T9101');
    const click = t.actions.find((a) => a.label === 'click testid:widget-panel > role:link[name=Zeta]');
    assert.ok(click, 'getItem(name) resolved through parameter substitution and nested container locator');
    assert.equal(click.at, 'e2e-tests/playwright/lib/src/ui/components/widget_panel.ts:22');
    assert.equal(click.via, 'e2e-tests/playwright/specs/widgets/widget_flow.spec.ts:24');
    const a = t.assertions.find((x) => x.target === 'testid:widget-panel > text:Item opened');
    assert.equal(a.at, 'e2e-tests/playwright/lib/src/ui/components/widget_panel.ts:23');
    assert.ok(
        t.actions.some((x) => x.label === 'click role:button[name=Save widget]'),
        'page-object field locator',
    );
});

test('playwright: expect, negation, poll, test.step and helper assertions', () => {
    const t = byTitle('MM-T9101');
    const find = (target) => t.assertions.find((a) => a.target === target);
    assert.equal(find('text:Welcome banner').matcher, 'toBeVisible');
    assert.equal(find('testid:banner').at, 'e2e-tests/playwright/lib/src/util.ts:10');
    assert.equal(find('testid:widget-count').at, 'e2e-tests/playwright/specs/widgets/support.ts:5');
    const negated = t.assertions.find((a) => a.negated);
    assert.equal(negated.matcher, 'toHaveText');
    assert.deepEqual(negated.expected, ['Gone']);
    const poll = find('page.url()');
    assert.equal(poll.matcher, 'toContain');
});

test('playwright: two logins are two actors and a login-result page object resolves', () => {
    const t = byTitle('MM-T9102');
    assert.equal(t.actors.count, 2);
    assert.equal(t.actions.filter((a) => a.label === 'call ChannelsPage.goto(town-square)').length, 2);
});

test('playwright: computed locator, unresolved helper and loop-generated tests are partial', () => {
    const computed = byTitle('MM-T9103');
    assert.equal(computed.source_status, 'partial');
    assert.deepEqual(computed.partial_reasons, ['dynamic_locator:locator', 'unresolved_helper:missingHelper']);
    const loop = byTitle('generated');
    assert.deepEqual(loop.partial_reasons, ['loop_generated_test']);
    assert.equal(loop.title_dynamic, true);
});

test('upgrade-specs and explorer sessions are indexed with the right origin', () => {
    assert.equal(byTitle('upgrade keeps widgets').origin, 'repo');
    assert.equal(byTitle('PILOT-FX').origin, 'session');
    assert.equal(byTitle('emitted widget journey').origin, 'emitted');
});

test('output is deterministic and contains no absolute paths or timestamps', () => {
    const dirA = fs.mkdtempSync(path.join(os.tmpdir(), 'idx-a-'));
    const dirB = fs.mkdtempSync(path.join(os.tmpdir(), 'idx-b-'));
    writeIndex(dirA, extractRepo({root: FIXTURE_ROOT, sha: 'fixture'}));
    writeIndex(dirB, extractRepo({root: FIXTURE_ROOT, sha: 'fixture'}));
    for (const f of ['tests.jsonl', 'meta.json']) {
        const a = fs.readFileSync(path.join(dirA, f), 'utf8');
        assert.equal(a, fs.readFileSync(path.join(dirB, f), 'utf8'), `${f} differs between runs`);
        assert.ok(!a.includes(FIXTURE_ROOT) && !a.includes(os.tmpdir()), `${f} leaks an absolute path`);
        assert.ok(!/\d{4}-\d{2}-\d{2}T\d{2}:/.test(a), `${f} contains a timestamp`);
    }
    const ids = result.tests.map((t) => t.id);
    assert.deepEqual(
        ids,
        [...ids].sort((a, b) => {
            const [fa, la] = a.split(':');
            const [fb, lb] = b.split(':');
            return fa === fb ? Number(la) - Number(lb) : compareStr(fa, fb);
        }),
    );
});

test('golden sample of the fixture index is unchanged', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'idx-g-'));
    writeIndex(tmp, result);
    const meta = JSON.parse(fs.readFileSync(path.join(tmp, 'meta.json'), 'utf8'));
    const stable = {
        counts: meta.counts,
        partial_reason_categories: meta.partial_reason_categories,
        partial_reasons: meta.partial_reasons,
    };
    const goldenTests = path.join(GOLDEN_DIR, 'fixtures.tests.jsonl');
    const goldenMeta = path.join(GOLDEN_DIR, 'fixtures.meta.json');
    if (UPDATE_GOLDEN) {
        fs.mkdirSync(GOLDEN_DIR, {recursive: true});
        fs.copyFileSync(path.join(tmp, 'tests.jsonl'), goldenTests);
        fs.writeFileSync(goldenMeta, `${JSON.stringify(stable, null, 2)}\n`);
        return;
    }
    assert.equal(fs.readFileSync(path.join(tmp, 'tests.jsonl'), 'utf8'), fs.readFileSync(goldenTests, 'utf8'));
    assert.deepEqual(stable, JSON.parse(fs.readFileSync(goldenMeta, 'utf8')));
});

test('structural fingerprint ignores counters and ids, but not structure or order', () => {
    const rec = (labels, targets, actors = 1) => ({
        actions: labels.map((label) => ({label})),
        assertions: targets.map((target) => ({target, matcher: 'toBeVisible'})),
        actors: {count: actors},
    });
    const base = fingerprintOf(rec(['click css:#row_12', 'click text:Item 7'], ['text:Done 3']));
    assert.equal(
        base.fingerprint,
        fingerprintOf(rec(['click css:#row_98', 'click text:Item 1'], ['text:Done 4'])).fingerprint,
    );
    assert.equal(
        base.fingerprint,
        fingerprintOf(rec(['click css:#row_{x}', 'click text:Item {y}'], ['text:Done {z}'])).fingerprint,
    );
    assert.notEqual(base.fingerprint, fingerprintOf(rec(['click css:#row_12'], ['text:Done 3'])).fingerprint);
    assert.notEqual(
        base.fingerprint,
        fingerprintOf(rec(['click css:#row_12', 'click text:Item 7'], ['text:Done 3'], 2)).fingerprint,
    );
    const swapped = fingerprintOf(rec(['click text:Item 7', 'click css:#row_12'], ['text:Done 3']));
    assert.notEqual(base.fingerprint, swapped.fingerprint);
    assert.equal(base.fingerprint_loose, swapped.fingerprint_loose);
});

test('normalization: lowercase, counters, ids, placeholders and light stemming', () => {
    assert.deepEqual(tokenize('Channel Bookmarks 12'), tokenize('channel bookmark'));
    assert.deepEqual(tokenize('#sidebarItem_{channel.name}'), ['sidebar', 'item']);
    assert.deepEqual(tokenize('role:button[name=View Info]'), ['button', 'view', 'info']);
    assert.deepEqual(tokenize('abcdef0123456789 thing'), ['thing']);
    assert.equal(stem('archived'), stem('archive'));
    assert.equal(stem('favorites'), stem('favorite'));
    assert.equal(stem('switching'), 'switch');
});

const fx = loadFixtureIndex();
function loadFixtureIndex() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'idx-f-'));
    writeIndex(dir, result);
    return {dir, ...loadIndex(dir)};
}

const widgetCandidate = {
    title: 'Open a widget panel item and see the banner',
    actors: [{id: 'member', role: 'member'}],
    setup: ['create a public channel', 'enable the widget banner'],
    goal_terms: ['widget panel', 'open item', 'banner'],
    checkpoints: [
        {
            description: 'banner shown after opening Zeta',
            labels: ['Item opened', 'Welcome banner'],
            expected_text: ['Welcome'],
        },
    ],
    ui_labels: ['widget panel', 'Zeta', 'Save widget'],
};

test('similarity: the matching fixture ranks first and the total is the weighted mean of its components', () => {
    const report = runCheck({tests: fx.tests, candidate: widgetCandidate, k: 5});
    assert.equal(report.results[0].test.title.slice(0, 8), 'MM-T9101');
    const top = report.results[0];
    let num = 0;
    let den = 0;
    for (const [k, v] of Object.entries(top.components)) {
        num += WEIGHTS[k] * v;
        den += WEIGHTS[k];
    }
    assert.ok(Math.abs(top.score - num / den) < 0.002);
    assert.ok(Math.abs(Object.values(WEIGHTS).reduce((a, b) => a + b, 0) - 1) < 1e-9);
    assert.ok(top.components.ui > 0.5);
    for (let i = 1; i < report.results.length; i++) {
        assert.ok(report.results[i - 1].score >= report.results[i].score);
    }
});

test('similarity: ids and tags apply only when the candidate cites them', () => {
    const without = runCheck({tests: fx.tests, candidate: widgetCandidate, k: 1}).results[0];
    assert.equal(without.components.tags, undefined);
    const cited = runCheck({
        tests: fx.tests,
        candidate: {...widgetCandidate, goal_terms: [...widgetCandidate.goal_terms, 'MM-T9101', '@widgets']},
        k: 1,
    }).results[0];
    assert.equal(cited.components.tags, 1);
});

test('coverage-check: three axes and evidence are present with file:line', () => {
    const report = runCheck({tests: fx.tests, candidate: widgetCandidate, k: 1});
    const r = report.results[0];
    assert.deepEqual(Object.keys(r.axes), ['actor_setup', 'transitions', 'final_assertions']);
    assert.ok(r.axes.transitions.test.length > 0 && r.axes.final_assertions.test.length > 0);
    assert.ok(r.matched.assertions.every((m) => /:\d+$/.test(m.at)));
    assert.match(r.test.file, /widget_flow\.spec\.ts$/);
    const text = renderText(report);
    for (const needle of ['axis 1', 'axis 2', 'axis 3', 'never states that a test is equivalent']) {
        assert.ok(text.includes(needle), `text output lacks "${needle}"`);
    }
});

test('verdict thresholds at and around each boundary', () => {
    const R = THRESHOLDS.needs_review;
    const L = THRESHOLDS.likely_duplicate;
    const parts = (ui, assertion) => ({
        ui: {label_coverage: ui, mass: 1, strong: ui},
        assertion: {label_coverage: assertion, mass: 1, strong: assertion},
    });
    const verdict = (score, ui, assertion) => verdictFor([{score, parts: parts(ui, assertion)}]);
    assert.equal(verdict(R.score - 0.01, 1, 1), 'no_close_match');
    assert.equal(verdict(R.score, 1, 1), 'needs_review');
    assert.equal(verdict(R.score, 0.2, 0.2), 'no_close_match', 'score alone is not evidence: label coverage gate');
    assert.equal(verdict(R.score, R.label_coverage, R.label_coverage), 'needs_review');
    assert.equal(verdict(L.score - 0.01, 1, 1), 'needs_review');
    assert.equal(verdict(L.score, L.ui_label_coverage, L.assertion_label_coverage), 'likely_duplicate');
    assert.equal(verdict(L.score, L.ui_label_coverage - 0.01, 1), 'needs_review');
    assert.equal(verdict(L.score, 1, L.assertion_label_coverage - 0.01), 'needs_review');
    assert.equal(verdictFor([]), 'no_close_match');
    assert.equal(
        verdictFor([
            {score: 0.1, parts: parts(0, 0)},
            {score: 0.5, parts: parts(0.5, 0.5)},
        ]),
        'needs_review',
        'any top-k result may qualify',
    );
});

test('verdict vocabulary never includes "equivalent"', () => {
    const allowed = new Set(['needs_review', 'likely_duplicate', 'no_close_match']);
    const probes = [
        widgetCandidate,
        {title: 'Totally unrelated zebra migration', ui_labels: ['Zebra migration wizard'], goal_terms: ['zebra']},
    ];
    for (const candidate of probes) {
        const report = runCheck({tests: fx.tests, candidate, k: 3});
        assert.ok(allowed.has(report.verdict), report.verdict);
        assert.ok(!/verdict:\s*equivalent/i.test(renderText(report)));
    }
    assert.equal(runCheck({tests: fx.tests, candidate: probes[1], k: 3}).verdict, 'no_close_match');
});

test('origin filters: sessions default in, emitted default out; flags flip them', () => {
    const size = (opts) => runCheck({tests: fx.tests, candidate: widgetCandidate, k: 1, ...opts}).corpus.tests;
    assert.equal(size({}), 13);
    assert.equal(size({excludeSessions: true}), 12);
    assert.equal(size({includeEmitted: true}), 14);
    assert.equal(size({excludeSessions: true, includeEmitted: true}), 13);
    const emittedCandidate = {
        title: 'Emitted control journey',
        ui_labels: ['Emitted control'],
        checkpoints: [{labels: ['emitted-result'], expected_text: []}],
    };
    const top = (opts) => runCheck({tests: fx.tests, candidate: emittedCandidate, k: 1, ...opts}).results[0].test.title;
    assert.notEqual(top({}), 'emitted widget journey');
    assert.equal(top({includeEmitted: true}), 'emitted widget journey');
    const sessionCandidate = {
        title: 'Session control journey',
        ui_labels: ['Session control'],
        checkpoints: [{labels: ['session-result'], expected_text: []}],
    };
    assert.match(runCheck({tests: fx.tests, candidate: sessionCandidate, k: 1}).results[0].test.title, /PILOT-FX/);
    assert.doesNotMatch(
        runCheck({tests: fx.tests, candidate: sessionCandidate, k: 1, excludeSessions: true}).results[0].test.title,
        /PILOT-FX/,
    );
});

test('evaluate: lead resolution distinguishes exact, nearest and missing', () => {
    const exact = resolveLead(fx.tests, {file: 'widgets/widget_flow.spec.ts', line: 18});
    assert.equal(exact.status, 'exact');
    assert.match(exact.test.title, /MM-T9101/);
    assert.equal(resolveLead(fx.tests, {file: 'widgets/widget_flow.spec.ts', line: 3}).status, 'nearest');
    assert.equal(resolveLead(fx.tests, {file: 'widgets/nope.spec.ts', line: 3}).status, 'file_not_found');
});

test('CLIs: extract and coverage-check run end to end; invalid candidates exit 2', () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'idx-cli-'));
    const ex = spawnSync(
        process.execPath,
        [path.join(HERE, 'extract.mjs'), `--repo-root=${FIXTURE_ROOT}`, '--sha=fixture', `--out=${out}`],
        {encoding: 'utf8'},
    );
    assert.equal(ex.status, 0, ex.stderr);
    const cand = path.join(out, 'candidate.json');
    fs.writeFileSync(cand, JSON.stringify(widgetCandidate));
    const run = spawnSync(
        process.execPath,
        [
            path.join(HERE, 'coverage-check.mjs'),
            `--index=${out}`,
            `--candidate=${cand}`,
            '--k=2',
            '--json',
            '--exclude-sessions',
        ],
        {encoding: 'utf8'},
    );
    assert.equal(run.status, 0, run.stderr);
    const report = JSON.parse(run.stdout);
    assert.equal(report.results.length, 2);
    assert.equal(report.corpus.exclude_sessions, true);
    fs.writeFileSync(cand, JSON.stringify({goal_terms: []}));
    const bad = spawnSync(
        process.execPath,
        [path.join(HERE, 'coverage-check.mjs'), `--index=${out}`, `--candidate=${cand}`],
        {encoding: 'utf8'},
    );
    assert.equal(bad.status, 2);
});

let failed = 0;
for (const t of tests) {
    try {
        t.fn();
        process.stdout.write(`PASS ${t.name}\n`);
    } catch (err) {
        failed += 1;
        process.stdout.write(`FAIL ${t.name}\n  ${String(err.message).split('\n').join('\n  ')}\n`);
    }
}
process.stdout.write(`\n${tests.length - failed}/${tests.length} passed\n`);
process.exit(failed ? 1 : 0);
