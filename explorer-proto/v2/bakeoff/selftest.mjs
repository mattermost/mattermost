#!/usr/bin/env node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Self-test for the v2 schemas and the bakeoff harness. Prints PASS or FAIL per check; exit 1 on any FAIL.
//   node explorer-proto/v2/bakeoff/selftest.mjs
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
    FORBIDDEN_KEY_WORDS,
    forbiddenKeyPattern,
    GATE_NAMES,
    ORACLE_CLASSES,
    OUTCOMES,
    UNSAFE_TEXT_PATTERN,
} from '../schemas/shared.mjs';
import {createValidators, describeErrors, readSchema, SCHEMA_DIR, schemaNames} from '../schemas/validator.mjs';

import {
    BAKEOFF_DIR,
    canonicalJson,
    FREEZE_FILE,
    PREREGISTRATION_FILE,
    readJson,
    REPO_ROOT,
    RULES_FILE,
} from './common.mjs';
import {buildDenyList} from './build_deny_list.mjs';
import {extractBaseline} from './baseline_v1.mjs';
import {checkCharter, EXEMPTABLE, loadDenyList} from './leakage_check.mjs';
import {clauseTitles} from './metrics_lib.mjs';
import {scoreRecall} from './recall.mjs';
import {shuffleGoal} from './shuffle_goal.mjs';

const SESSIONS = path.join(REPO_ROOT, 'explorer-proto/sessions');
const EXAMPLES = path.join(SCHEMA_DIR, 'examples');
const SHA = '0123456789abcdef0123456789abcdef01234567';
const SHA_B = 'fedcba9876543210fedcba9876543210fedcba98';
const DIGEST = `sha256:${'ab'.repeat(32)}`;

const results = [];
function check(name, fn) {
    try {
        fn();
        results.push({name, ok: true});
        process.stdout.write(`PASS ${name}\n`);
    } catch (e) {
        results.push({name, ok: false});
        process.stdout.write(`FAIL ${name}: ${e.message}\n`);
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function same(actual, expected, what) {
    assert(
        JSON.stringify(actual) === JSON.stringify(expected),
        `${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
}

function runNode(script, args, options = {}) {
    const r = spawnSync(process.execPath, [path.join(BAKEOFF_DIR, script), ...args], {encoding: 'utf8', ...options});
    return {code: r.status, out: r.stdout, err: r.stderr};
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'explorer-v2-selftest-'));
const validators = createValidators();
const denyList = loadDenyList(path.join(BAKEOFF_DIR, 'deny_labels.json'));
const rules = readJson(RULES_FILE);
const clone = (o) => JSON.parse(JSON.stringify(o));
const writeTmp = (name, data) => {
    const file = path.join(tmp, name);
    fs.writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data));
    return file;
};

// ---- schemas

check('schemas: every schema file compiles under Ajv strict mode', () => {
    same(validators.names, schemaNames(), 'schema names');
    for (const name of [
        'target',
        'coverage-index',
        'finding',
        'charter',
        'trace',
        'verdict',
        'lesson',
        'bakeoff-result',
        'repro-set',
        'bakeoff-rules',
    ]) {
        assert(validators.names.includes(name), `missing schema ${name}`);
    }
});

check('schemas: draft-07 declared and every required name is defined somewhere in its file', () => {
    for (const name of validators.names) {
        const schema = readSchema(name);
        assert(schema.$schema === 'http://json-schema.org/draft-07/schema#', `${name} is not draft-07`);
        const defined = new Set();
        const patterns = [];
        const required = new Set();
        const visit = (node) => {
            if (Array.isArray(node)) {
                node.forEach(visit);
            } else if (node && typeof node === 'object') {
                for (const [k, v] of Object.entries(node)) {
                    if (k === 'properties') {
                        Object.keys(v).forEach((p) => defined.add(p));
                    }
                    if (k === 'patternProperties') {
                        patterns.push(...Object.keys(v).map((p) => new RegExp(p)));
                    }
                    if (k === 'required' && Array.isArray(v)) {
                        v.forEach((r) => required.add(r));
                    }
                    visit(v);
                }
            }
        };
        visit(schema);
        for (const r of required) {
            assert(
                defined.has(r) || patterns.some((re) => re.test(r)),
                `${name}: required property "${r}" is never defined`,
            );
        }
    }
});

check('schemas: shared constants match the schema files', () => {
    const common = readSchema('common').definitions;
    same(common.oracleClass.enum, ORACLE_CLASSES, 'oracle classes');
    same(common.outcome.enum, OUTCOMES, 'outcomes');
    same(common.gateName.enum, GATE_NAMES, 'gate names');
    same(common.evidenceText.not.pattern, UNSAFE_TEXT_PATTERN, 'unsafe text pattern');
    const charter = readSchema('charter');
    same(
        charter.definitions.fixtureValue.anyOf[2].propertyNames.not.pattern,
        forbiddenKeyPattern(),
        'forbidden key pattern',
    );
    same(charter.properties.leakage.properties.exempt_paths.items.enum, EXEMPTABLE, 'exemptable paths');
    assert(FORBIDDEN_KEY_WORDS.includes('step') && FORBIDDEN_KEY_WORDS.includes('route'), 'forbidden words lost');
});

check('schemas: the charter schema defines no field that can hold ordered steps', () => {
    const charter = readSchema('charter');
    const forbidden = new RegExp(forbiddenKeyPattern());
    const names = [];
    const visit = (node) => {
        if (Array.isArray(node)) {
            node.forEach(visit);
        } else if (node && typeof node === 'object') {
            for (const [k, v] of Object.entries(node)) {
                if (k === 'properties') {
                    names.push(...Object.keys(v));
                }
                visit(v);
            }
        }
    };
    visit(charter);
    const bad = names.filter((n) => forbidden.test(n));
    same(bad, [], 'property names matching the forbidden pattern');
});

check('schemas: example manifest valid examples pass and broken examples fail for the stated reason', () => {
    const manifest = readJson(path.join(EXAMPLES, 'manifest.json'));
    assert(manifest.length >= 40, 'too few examples');
    const covered = new Set(manifest.map((m) => m.schema));
    for (const name of validators.names.filter((n) => n !== 'common')) {
        assert(covered.has(name) || name === 'bakeoff-rules', `no example for ${name}`);
        if (name !== 'bakeoff-rules') {
            assert(
                manifest.some((m) => m.schema === name && m.valid),
                `${name} has no valid example`,
            );
            assert(
                manifest.some((m) => m.schema === name && !m.valid),
                `${name} has no broken example`,
            );
        }
    }
    const files = new Set(fs.readdirSync(EXAMPLES).filter((f) => f !== 'manifest.json'));
    same([...files].sort(), manifest.map((m) => m.file).sort(), 'example files vs manifest');
    for (const entry of manifest) {
        const validate = validators.get(entry.schema);
        const ok = validate(readJson(path.join(EXAMPLES, entry.file)));
        if (entry.valid) {
            assert(ok, `${entry.file} should be valid: ${describeErrors(validate.errors).join(' | ')}`);
        } else {
            assert(!ok, `${entry.file} should be invalid`);
            const text = describeErrors(validate.errors, 50).join(' | ');
            assert(
                text.includes(entry.error_contains),
                `${entry.file}: errors lack "${entry.error_contains}": ${text}`,
            );
        }
    }
});

check('schemas: rules.json matches the bakeoff-rules schema', () => {
    const validate = validators.get('bakeoff-rules');
    assert(validate(rules), describeErrors(validate.errors).join(' | '));
});

check('validate.mjs: exit codes and output never echo data values', () => {
    const run = (schema, file) =>
        spawnSync(process.execPath, [path.join(SCHEMA_DIR, 'validate.mjs'), schema, path.join(EXAMPLES, file)], {
            encoding: 'utf8',
        });
    const good = run('target', 'target.valid-release.json');
    assert(good.status === 0 && good.stdout.startsWith('OK '), 'valid example should exit 0');
    const bad = run('finding', 'finding.invalid-evidence-with-loopback.json');
    assert(bad.status === 1 && bad.stdout.startsWith('FAIL '), 'invalid example should exit 1');
    assert(!bad.stdout.includes('127.0.0.1'), 'error output must not repeat the offending value');
    assert(run('no-such-schema', 'target.valid-release.json').status === 2, 'unknown schema should exit 2');
});

// ---- charters and leakage

const bookmarks = readJson(path.join(SESSIONS, 'bookmarks/charter.json'));
const autoFollow = readJson(path.join(SESSIONS, 'auto-follow/charter.json'));
const v2Charter = readJson(path.join(EXAMPLES, 'charter.valid-v2.json'));
const leak = (charter, charterPath = null) => checkCharter(charter, {denyList, validators, charterPath});

check('charter schema: the existing session charter validates as a legacy section set', () => {
    const validate = validators.get('charter');
    assert(validate(bookmarks), describeErrors(validate.errors).join(' | '));
});

check('charter schema: the existing journey charter is rejected only for its ordered event request list', () => {
    const validate = validators.get('charter');
    assert(!validate(autoFollow), 'auto-follow should not validate');
    const errors = describeErrors(validate.errors, 50);
    same(
        errors.map((e) => e.split(':')[0]),
        ['/events/0', '/events/0'],
        'error locations',
    );
    assert(
        errors.join(' ').includes('(ordering)') && errors.join(' ').includes('(requests)'),
        'expected ordering and requests',
    );
});

check('leakage: flags a planted "click X then Y" goal', () => {
    const planted = clone(v2Charter);
    planted.goal = 'I want to click Add channel then Create so that a channel exists.';
    const r = leak(planted);
    assert(!r.pass && r.violations.some((v) => v.path === 'goal' && v.rule === 'L1'), 'expected L1 on goal');
});

check("leakage: flags numbered steps, arrow chains, other sessions' labels, forbidden keys and unknown keys", () => {
    const cases = [
        ['L2', 'consequence', {consequence: '1. Open the sidebar 2. Pick a channel'}],
        ['L1', 'known_risks[0]', {known_risks: ['Sidebar -> Channel -> Menu']}],
        ['L3', 'constraints[0]', {constraints: ['Use View Info to read the panel.']}],
        ['L5', 'fixture.x.clickPath', {fixture: {x: {clickPath: 1}}}],
        ['L4', 'steps', {steps: ['a']}],
    ];
    for (const [rule, at, patch] of cases) {
        const r = leak({...clone(v2Charter), ...patch});
        assert(
            r.violations.some((v) => v.rule === rule && v.path === at),
            `expected ${rule} at ${at}, got ${JSON.stringify(r.violations)}`,
        );
    }
});

check('leakage: passes the existing bookmarks charter and the clean v2 example', () => {
    const r = leak(bookmarks, path.join(SESSIONS, 'bookmarks/charter.json'));
    assert(r.pass, `bookmarks failed: ${JSON.stringify(r.violations)}`);
    assert(r.namedControls === 3, 'bookmarks names 3 controls (information only)');
    assert(leak(v2Charter).pass, 'clean v2 example should pass');
});

check('leakage: the auto-follow charter fails only on the two undefined event keys', () => {
    const r = leak(autoFollow, path.join(SESSIONS, 'auto-follow/charter.json'));
    same(
        r.violations.map((v) => `${v.rule} ${v.path}`),
        ['L4 events[0].ordering', 'L4 events[0].requests'],
        'violations',
    );
});

check('leakage: a charter must keep every mandatory rule kind', () => {
    const planted = clone(v2Charter);
    planted.leakage.rules = planted.leakage.rules.filter((r) => r.kind !== 'numbered_steps');
    const r = leak(planted);
    assert(
        r.violations.some((v) => v.rule === 'rule_set'),
        'expected a rule_set violation',
    );
});

check('leakage: a charter cannot point its deny_labels rule at another list', () => {
    const planted = clone(v2Charter);
    planted.leakage.rules.find((r) => r.kind === 'deny_labels').deny_list =
        'explorer-proto/v2/bakeoff/inputs/empty.json';
    assert(
        leak(planted).violations.some((v) => v.rule === 'rule_set'),
        'expected a rule_set violation',
    );
});

check('leakage_check.mjs: PASS and FAIL lines and exit codes on the three charters', () => {
    const ok = runNode('leakage_check.mjs', [path.join(SESSIONS, 'bookmarks/charter.json')]);
    assert(ok.code === 0 && ok.out.startsWith('PASS '), 'bookmarks should exit 0');
    const planted = clone(v2Charter);
    planted.goal = 'Click Add channel then Create.';
    const bad = runNode('leakage_check.mjs', [writeTmp('planted.json', planted)]);
    assert(
        bad.code === 1 && bad.out.startsWith('FAIL ') && bad.out.includes('goal'),
        'planted should exit 1 and name the path',
    );
    const both = runNode('leakage_check.mjs', [
        path.join(SESSIONS, 'auto-follow/charter.json'),
        path.join(SESSIONS, 'bookmarks/charter.json'),
    ]);
    assert(both.code === 1 && both.out.includes('FAIL ') && both.out.includes('PASS '), 'mixed set should exit 1');
    assert(runNode('leakage_check.mjs', []).code === 2, 'no arguments should exit 2');
});

check('build_deny_list: committed deny_labels.json equals a fresh derivation', () => {
    assert(
        canonicalJson(buildDenyList()) === fs.readFileSync(path.join(BAKEOFF_DIR, 'deny_labels.json'), 'utf8'),
        'deny_labels.json is stale',
    );
});

// ---- report

const evidence = [{kind: 'verdict', ref: 'verdicts/example.json'}];
const feature = (id, outcome, extra = {}) => ({
    feature_id: id,
    outcome,
    gates_all_passed: outcome === 'emitted_passing',
    reviewer_equivalence: outcome === 'emitted_passing' ? 'non_equivalent' : 'not_reviewed',
    evidence,
    ...extra,
});
const stage = (name, seconds, calls) => ({
    stage: name,
    category: 'pipeline',
    command_name: 'node',
    arg_count: 2,
    exit_code: 0,
    elapsed_seconds: seconds,
    agent_calls: calls,
});
const controlSet = (n, result = 'pass') =>
    Array.from({length: n}, (_, i) => ({
        spec: `spec-${i}`,
        control_id: `ctl-${i}`,
        result,
        failed_at: {file: 'specs/example.spec.ts', line: 30 + i},
        evidence,
    }));
const stabilitySpecs = (passedList) =>
    passedList.map((passed, i) => ({spec: `spec-${i}`, feature_id: `F${i + 1}`, replays: 20, passed}));
const manual = (minutes, rounds, fixes) => [
    {kind: 'human_review_minutes', value: minutes, reviewer: 'reviewer-one'},
    {kind: 'agent_rounds', value: rounds, reviewer: 'reviewer-one'},
    {kind: 'fix_rounds', value: fixes, reviewer: 'reviewer-one'},
];
const discoveryRuns = (successes) =>
    ['original', 'paraphrased', 'shuffled'].flatMap((variant) =>
        ['F1', 'F2', 'F3'].map((f, i) => ({
            feature_id: f,
            variant,
            success: i < successes,
            actions_used: 10,
            wall_clock_seconds_used: 5,
        })),
    );

function baseA() {
    return {
        schema: 'explorer-bakeoff-result/v2',
        version: {label: 'A', name: 'v1 frozen', commit: rules.version_a.commit},
        target: {kind: 'main', sha: SHA, image_digest: DIGEST},
        features: [
            feature('F1', 'failed'),
            feature('F2', 'emitted_passing'),
            feature('F3', 'failed'),
            feature('F4', 'rejected_duplicate'),
        ],
        stability: {retries: 0, specs: stabilitySpecs([20])},
        control_sensitivity: {controls: controlSet(1)},
        discovery: {runs: discoveryRuns(1)},
        route_leakage: {charters_checked: 4, violations: 2, named_controls: 3},
        cost: {stages: [stage('explore', 60, 6), stage('emit', 40, 0)], manual: manual(30, 4, 2)},
    };
}

function baseB() {
    return {
        schema: 'explorer-bakeoff-result/v2',
        version: {label: 'B', name: 'v2', commit: SHA_B},
        target: {kind: 'main', sha: SHA, image_digest: DIGEST},
        features: [
            feature('F1', 'emitted_passing'),
            feature('F2', 'emitted_passing'),
            feature('F3', 'rejected_unreachable', {unreachable_reason: 'licence_insufficient'}),
            feature('F4', 'rejected_duplicate'),
        ],
        stability: {retries: 0, specs: stabilitySpecs([20, 20])},
        control_sensitivity: {controls: controlSet(2)},
        discovery: {runs: discoveryRuns(3)},
        route_leakage: {charters_checked: 4, violations: 0, named_controls: 0},
        cost: {stages: [stage('explore', 70, 8), stage('emit', 50, 0)], manual: manual(40, 4, 2)},
    };
}

function runReport(a, b, extraArgs = ['--allow-unfrozen']) {
    const r = runNode('report.mjs', ['--a', writeTmp('a.json', a), '--b', writeTmp('b.json', b), ...extraArgs]);
    return {...r, clauses: Object.fromEntries([...r.out.matchAll(/^(C[1-5]) (PASS|FAIL)/gm)].map((m) => [m[1], m[2]]))};
}

const ALL_PASS = {C1: 'PASS', C2: 'PASS', C3: 'PASS', C4: 'PASS', C5: 'PASS'};

check('report: case 1, v2 better, all clauses PASS', () => {
    const r = runReport(baseA(), baseB());
    same(r.clauses, ALL_PASS, 'clauses');
    assert(r.code === 0 && r.out.includes('DECISION: v2 BETTER'), `exit ${r.code}\n${r.out}${r.err}`);
});

check('report: case 2, v2 worse on stability, C1 FAIL and the decision FAIL', () => {
    const b = baseB();
    b.stability.specs = stabilitySpecs([20, 19]);
    const r = runReport(baseA(), b);
    same(r.clauses, {...ALL_PASS, C1: 'FAIL'}, 'clauses');
    assert(r.code === 1 && r.out.includes('v2 NOT SHOWN BETTER (FAIL: C1)'), 'expected the NOT SHOWN BETTER verdict');
});

check('report: case 3, v2 over cost without a measured gain, C5 FAIL only', () => {
    const b = baseB();
    b.cost.stages = [stage('explore', 300, 8), stage('emit', 50, 0)];
    const r = runReport(baseA(), b);
    same(r.clauses, {...ALL_PASS, C5: 'FAIL'}, 'clauses');
    assert(r.code === 1 && r.out.includes('no measured gain tied'), 'expected the unjustified excess to be named');
});

check('report: an excess tied to a real gain passes C5, one tied to a non-gain fails', () => {
    const over = baseB();
    over.cost.stages = [stage('explore', 300, 8), stage('emit', 50, 0)];
    const justified = clone(over);
    justified.cost.justifications = [{component: 'elapsed_seconds', gain_metric: 'features_handled'}];
    same(runReport(baseA(), justified).clauses, ALL_PASS, 'justified by features_handled (4 > 2)');
    const unjustified = clone(over);
    unjustified.cost.justifications = [{component: 'elapsed_seconds', gain_metric: 'stability_rate'}];
    same(runReport(baseA(), unjustified).clauses.C5, 'FAIL', 'stability is equal, so it is not a gain');
});

check('report: not-recorded inputs fail their clause, blocked controls never count as pass', () => {
    const noLeak = baseB();
    delete noLeak.route_leakage;
    const r = runReport(baseA(), noLeak);
    assert(r.clauses.C4 === 'FAIL' && r.out.includes('not recorded: B.route_leakage'), 'missing leakage must fail C4');
    const blocked = baseB();
    blocked.control_sensitivity.controls = controlSet(2, 'blocked').map((c) => ({
        spec: c.spec,
        control_id: c.control_id,
        result: c.result,
        evidence: c.evidence,
    }));
    const rb = runReport(baseA(), blocked);
    assert(
        rb.clauses.C2 === 'FAIL' && rb.out.includes('blocked=2'),
        'blocked controls must lower the rate and be shown',
    );
});

check('report: F4 must be rejected by v2, fewer handled than v1 fails C3', () => {
    const b = baseB();
    b.features[3] = feature('F4', 'emitted_passing');
    assert(runReport(baseA(), b).clauses.C3 === 'FAIL', 'emitting the planted duplicate must fail C3');
    const fewer = baseB();
    fewer.features[0] = feature('F1', 'failed');
    fewer.features[1] = feature('F2', 'failed');
    assert(runReport(baseA(), fewer).clauses.C3 === 'FAIL', 'handling fewer than 3 must fail C3');
});

check('report: refuses an unfrozen protocol without --allow-unfrozen, mismatched targets and bad labels', () => {
    if (!fs.existsSync(FREEZE_FILE)) {
        assert(runReport(baseA(), baseB(), []).code === 2, 'absent FREEZE.json must exit 2 by default');
    }
    const b = baseB();
    b.target.sha = SHA_B;
    assert(runReport(baseA(), b).code === 2, 'different targets must exit 2');
    assert(runReport(baseB(), baseA()).code === 2, 'swapped labels must exit 2');
});

check('report: prints the decision clause titles that the protocol states', () => {
    const text = fs.readFileSync(PREREGISTRATION_FILE, 'utf8');
    for (const {id, title} of clauseTitles(rules)) {
        assert(text.includes(`- ${id} ${title}`), `PREREGISTRATION.md lacks "${id} ${title}"`);
    }
    for (const needle of [
        rules.version_a.commit,
        'MM-T5611',
        'bookmark_display_navigation.spec.ts:38',
        'MM-71783',
        'MM-71788',
        'MM-71781',
        'indicative',
    ]) {
        assert(text.includes(needle), `PREREGISTRATION.md lacks "${needle}"`);
    }
    same(
        [rules.decision.min_features_handled, rules.decision.cost_ratio_max, rules.replays_per_spec],
        [3, 1.5, 20],
        'frozen constants',
    );
});

// ---- collectors and helpers

check('metrics.mjs: records exit code, elapsed time and agent calls, and keeps arguments out of the record', () => {
    const resultFile = path.join(tmp, 'metrics-result.json');
    const base = baseB();
    base.cost = {stages: []};
    fs.writeFileSync(resultFile, JSON.stringify(base));
    const calls = path.join(tmp, 'agent-calls.jsonl');
    fs.writeFileSync(calls, '{"agent":"prior"}\n');
    const script = `require('fs').appendFileSync(${JSON.stringify(calls)}, '{"agent":"a"}\\n{"agent":"b"}\\nnot json\\n'); process.exit(3)`;
    const r = runNode('metrics.mjs', [
        '--result',
        resultFile,
        '--stage',
        'explore',
        '--agent-calls',
        calls,
        '--',
        process.execPath,
        '-e',
        script,
    ]);
    assert(r.code === 3, `child exit code must propagate, got ${r.code} ${r.err}`);
    const stageRecord = readJson(resultFile).cost.stages[0];
    same(
        [
            stageRecord.stage,
            stageRecord.exit_code,
            stageRecord.agent_calls,
            stageRecord.agent_calls_malformed_lines,
            stageRecord.arg_count,
        ],
        ['explore', 3, 2, 1, 2],
        'record',
    );
    assert(!JSON.stringify(stageRecord).includes('appendFileSync'), 'arguments must not be recorded');
    assert(stageRecord.elapsed_seconds >= 0 && /T/.test(stageRecord.volatile.started_at), 'timing recorded');
});

check('result_set.mjs and record_cost.mjs: init refuses overwrite, set validates, cost entries append', () => {
    const target = writeTmp('target.json', readJson(path.join(EXAMPLES, 'target.valid-main.json')));
    const out = path.join(tmp, 'init-result.json');
    assert(
        runNode('result_set.mjs', ['init', '--label', 'B', '--target', target, '--out', out, '--commit', SHA_B])
            .code === 0,
        'init should succeed',
    );
    assert(
        runNode('result_set.mjs', ['init', '--label', 'B', '--target', target, '--out', out, '--commit', SHA_B])
            .code === 2,
        'init must not overwrite',
    );
    const fragment = writeTmp('route.json', {charters_checked: 4, violations: 1, named_controls: 0});
    assert(runNode('result_set.mjs', ['set', out, 'route_leakage', fragment]).code === 0, 'set should succeed');
    assert(runNode('result_set.mjs', ['set', out, 'cost', fragment]).code === 2, 'cost must not be settable');
    assert(
        runNode('result_set.mjs', ['set', out, 'route_leakage', writeTmp('bad.json', {violations: -1})]).code === 2,
        'invalid fragment must be refused',
    );
    const rc = runNode('record_cost.mjs', [
        out,
        '--reviewer',
        'reviewer-one',
        '--human-review-minutes',
        '25',
        '--fix-rounds',
        '0',
        '--justify',
        'agent_calls=features_handled',
    ]);
    assert(rc.code === 0, `record_cost failed: ${rc.err}`);
    const cost = readJson(out).cost;
    same([cost.manual.length, cost.manual[1].value, cost.justifications.length], [2, 0, 1], 'manual entries');
    assert(
        runNode('record_cost.mjs', [out, '--reviewer', 'reviewer-one', '--human-review-minutes', '-4']).code === 2,
        'negative minutes must be refused',
    );
    assert(
        runNode('result_set.mjs', [
            'init',
            '--label',
            'B',
            '--target',
            writeTmp('t2.json', {...readJson(path.join(EXAMPLES, 'target.valid-main.json')), licence_check: 'FAIL'}),
            '--out',
            path.join(tmp, 'x.json'),
            '--commit',
            SHA_B,
        ]).code === 2,
        'licence FAIL must be a setup failure',
    );
});

check('recall.mjs: flags bugs by confirmed finding, oracle class and state path', () => {
    const repro = readJson(path.join(EXAMPLES, 'repro-set.valid.json'));
    const finding = readJson(path.join(EXAMPLES, 'finding.valid-confirmed.json'));
    const hit = {...finding, id: 'fnd-hit', oracle: 'typed_input_ignored', state_path: '/<team>/channels/<channel>'};
    const wrongPath = {...hit, id: 'fnd-path', state_path: '/<team>/other'};
    const candidate = {...hit, id: 'fnd-cand', status: 'candidate', reproduction_count: {attempts: 1, reproduced: 1}};
    same(scoreRecall(repro, [wrongPath, candidate]).flagged, 0, 'wrong path and unconfirmed finding');
    const scored = scoreRecall(repro, [hit]);
    same(
        [scored.reproducing_total, scored.flagged, scored.per_bug[0].finding_id],
        [1, 1, 'fnd-hit'],
        'confirmed hit (EX-2 does not reproduce)',
    );
});

check('shuffle_goal: deterministic permutation of the goal words', () => {
    const goal = 'I want to see which channels I have muted at a glance';
    const once = shuffleGoal('F2', goal);
    same(shuffleGoal('F2', goal), once, 'second call');
    same(once.split(' ').sort(), goal.split(' ').sort(), 'same multiset of words');
    assert(once !== goal, 'shuffle should change the order');
});

check('baseline_v1: extracts counts from the frozen commit and reports "not recorded" for timing and cost', () => {
    const commit = rules.version_a.commit;
    const exists = spawnSync('git', ['-C', REPO_ROOT, 'cat-file', '-e', `${commit}^{commit}`]).status === 0;
    if (!exists) {
        process.stdout.write('     (v1 commit not available locally, extraction skipped)\n');
        return;
    }
    const b = extractBaseline(commit);
    same(
        [b.specs.count, b.controls.implemented_in_run_pilot_verify.length, b.discovery_counters.length],
        [3, 3, 2],
        'counts',
    );
    same(
        [b.timing.elapsed_seconds, b.cost.agent_calls, b.cost.human_review_minutes, b.stability.replays_passed],
        ['not recorded', 'not recorded', 'not recorded', 'not recorded'],
        'unrecorded fields',
    );
    assert(b.charters_present.length === 1, 'only the bookmarks charter exists at the frozen commit');
});

check('freeze.mjs --dry-run: prints a record with no timestamps and writes nothing', () => {
    const before = fs.existsSync(FREEZE_FILE);
    const r = runNode('freeze.mjs', ['--dry-run']);
    assert(r.code === 0, `dry run failed: ${r.err}`);
    const record = JSON.parse(r.out);
    assert(/^[0-9a-f]{40}$/.test(record.version_b.frozen_sha), 'frozen sha recorded');
    for (const f of [
        'explorer-proto/v2/bakeoff/rules.json',
        'explorer-proto/v2/bakeoff/PREREGISTRATION.md',
        'explorer-proto/v2/schemas/charter.schema.json',
    ]) {
        assert(/^[0-9a-f]{64}$/.test(record.files[f] ?? ''), `${f} not hashed`);
    }
    assert(!/[0-9]{4}-[0-9]{2}-[0-9]{2}T/.test(r.out), 'no timestamps in the record');
    assert(fs.existsSync(FREEZE_FILE) === before, 'dry run must not write FREEZE.json');
});

fs.rmSync(tmp, {recursive: true, force: true});
const failed = results.filter((r) => !r.ok).length;
process.stdout.write(
    `\n${results.length - failed}/${results.length} checks passed${failed ? `, ${failed} FAILED` : ''}\n`,
);
process.exitCode = failed ? 1 : 0;
