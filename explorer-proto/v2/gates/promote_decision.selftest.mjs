// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Self-test for promote_decision.mjs, promotion_policy.json and policy_hash.mjs.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {GATES_DIR, sha256, worstStatus} from './common.mjs';
import {checkApproval, diffPins, hashGates} from './policy_hash.mjs';
import {REQUIRED_GATE_IDS, decide, loadPolicy} from './promote_decision.mjs';

const {policy} = loadPolicy();
const VERDICT_GATE = Object.fromEntries(policy.required_gates.map((g) => [g.id, g.verdict_gate]));
const evidence = (id) => [{kind: 'report', ref: `reports/${id}.json`}];

export function verdictOf(results = {}, {counts, extraGates = [], subject = 'spec', outcome} = {}) {
    const all = Object.fromEntries(REQUIRED_GATE_IDS.map((id) => [id, results[id] ?? 'pass']));
    const gates = REQUIRED_GATE_IDS.map((id) => ({
        gate: VERDICT_GATE[id],
        result: all[id],
        evidence: evidence(id),
        ...(all[id] === 'blocked'
            ? {blocked_reason: id === 'mutation_control' ? 'control_not_applicable' : 'environment'}
            : {}),
        ...(id === 'stability_20' ? {counts: counts ?? {passed: all[id] === 'pass' ? 20 : 19, total: 20}} : {}),
    }));
    gates.push(...extraGates);
    const overall = worstStatus(...gates.map((g) => g.result));
    return {
        schema: 'explorer-verdict/v2',
        verdict_id: 'vrd-900',
        subject: {kind: subject, id: 'example-spec'},
        outcome: outcome ?? {pass: 'emitted_passing', fail: 'failed', blocked: 'blocked'}[overall],
        overall,
        gates,
    };
}

const run = (verdict, options = {}) => decide({verdict, policy, ...options});

function cliChecks() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'promote-'));
    try {
        const write = (name, value) => {
            const file = path.join(dir, name);
            fs.writeFileSync(file, JSON.stringify(value));
            return file;
        };
        const cli = (args) =>
            spawnSync(process.execPath, [path.join(GATES_DIR, 'promote_decision.mjs'), ...args], {encoding: 'utf8'});
        const pass = cli([write('pass.json', verdictOf())]);
        const reject = cli([write('reject.json', verdictOf({static_spec: 'fail'}))]);
        const quarantineNoOwner = cli([write('q.json', verdictOf({mutation_control: 'blocked'}))]);
        const quarantine = cli(['--owner', 'qa-owner', write('q2.json', verdictOf({mutation_control: 'blocked'}))]);
        const json = cli(['--json', write('p2.json', verdictOf())]);
        const parsed = JSON.parse(json.stdout);
        return [
            {
                name: 'promote_decision CLI: all gates pass exits 0 and prints the decision and why',
                ok: pass.status === 0 && /decision: promote_pr/.test(pass.stdout) && /why:/.test(pass.stdout),
                detail: '',
            },
            {
                name: 'promote_decision CLI: a failed gate exits 1',
                ok:
                    reject.status === 1 &&
                    /decision: reject/.test(reject.stdout) &&
                    /gate_failed \[static_spec\]/.test(reject.stdout),
                detail: '',
            },
            {
                name: 'promote_decision CLI: quarantine without an owner exits 2',
                ok: quarantineNoOwner.status === 2,
                detail: `exit ${quarantineNoOwner.status}`,
            },
            {
                name: 'promote_decision CLI: quarantine with an owner exits 3 and states tag, owner and schedule',
                ok:
                    quarantine.status === 3 &&
                    /@quarantine, owner qa-owner, rerun cadence daily/.test(quarantine.stdout),
                detail: quarantine.stdout,
            },
            {
                name: 'promote_decision CLI: --json is deterministic and carries the policy hash',
                ok:
                    json.status === 0 &&
                    parsed.policy_sha256 === sha256(fs.readFileSync(path.join(GATES_DIR, 'promotion_policy.json'))),
                detail: '',
            },
        ];
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
}

export function selftestChecks() {
    const checks = [];
    const check = (name, ok, detail = '') => checks.push({name: `promote_decision: ${name}`, ok, detail});
    const codes = (d) => d.reasons.map((r) => r.code);

    check(
        'policy lists exactly the eight required gates',
        JSON.stringify(policy.required_gates.map((g) => g.id)) === JSON.stringify(REQUIRED_GATE_IDS),
    );
    check(
        'policy states that agent verdicts cannot override gate failures',
        policy.agent_verdict_override.allowed === false &&
            /cannot override a gate failure/.test(policy.agent_verdict_override.statement),
    );
    check(
        'policy holds the un-quarantine rule as values only (20 clean runs, 3 days)',
        policy.quarantine.unquarantine_rule.consecutive_clean_runs === 20 &&
            policy.quarantine.unquarantine_rule.distinct_days === 3,
    );

    let d = run(verdictOf());
    check('all eight gates pass = promote_pr', d.decision === 'promote_pr', JSON.stringify(d.reasons));
    for (const id of REQUIRED_GATE_IDS) {
        d = run(verdictOf({[id]: 'fail'}, id === 'stability_20' ? {counts: {passed: 10, total: 20}} : {}));
        check(`${id} fail = reject`, d.decision === 'reject', `got ${d.decision}`);
    }
    for (const id of REQUIRED_GATE_IDS.filter((g) => g !== 'mutation_control')) {
        d = run(verdictOf({[id]: 'blocked'}));
        check(
            `${id} blocked = reject (retryable)`,
            d.decision === 'reject' && codes(d).includes('gate_blocked'),
            `got ${d.decision}`,
        );
    }

    d = run(verdictOf({mutation_control: 'blocked'}), {owner: 'qa-owner'});
    check(
        'control blocked, everything else passes = quarantine',
        d.decision === 'quarantine' && d.quarantine.tag === '@quarantine' && d.quarantine.owner === 'qa-owner',
    );
    check(
        'quarantine record carries owner, rerun_schedule and the un-quarantine rule',
        d.quarantine.rerun_schedule.cadence === 'daily' && d.quarantine.unquarantine_rule.distinct_days === 3,
    );
    d = run(verdictOf({mutation_control: 'blocked'}));
    check(
        'quarantine without an owner is flagged incomplete (owner null, owner_required true)',
        d.quarantine.owner === null && d.quarantine.owner_required === true,
    );

    d = run(verdictOf({stability_20: 'fail'}, {counts: {passed: 19, total: 20}}));
    check(
        '19/20 stability (one flake), control passes = quarantine',
        d.decision === 'quarantine' && codes(d).includes('stability_flake_within_budget'),
        `got ${d.decision}`,
    );
    d = run(verdictOf({stability_20: 'fail', mutation_control: 'blocked'}, {counts: {passed: 19, total: 20}}));
    check('19/20 stability and control blocked = quarantine', d.decision === 'quarantine');
    d = run(verdictOf({stability_20: 'fail'}, {counts: {passed: 18, total: 20}}));
    check('18/20 stability exceeds the flake budget = reject', d.decision === 'reject');
    d = run(verdictOf({stability_20: 'fail', mutation_control: 'fail'}, {counts: {passed: 19, total: 20}}));
    check('flake plus a failed control = reject', d.decision === 'reject');
    d = run(verdictOf({stability_20: 'fail', static_spec: 'fail'}, {counts: {passed: 19, total: 20}}));
    check('flake plus a static failure = reject', d.decision === 'reject');
    d = run(verdictOf({stability_20: 'fail'}, {counts: {passed: 19, total: 20}}), {
        gateResults: {stability_20: {status: 'fail', evidence: [{rule: 'log_test_timeout', count: 1}]}},
    });
    check('a flake with a Test timeout signature is never quarantined = reject', d.decision === 'reject');
    d = run(verdictOf({stability_20: 'fail'}, {counts: {passed: 19, total: 20}}), {
        gateResults: {stability_20: {status: 'fail', evidence: [{rule: 'status_mismatch', count: 1}]}},
    });
    check('a plain flake with a clean signature stays quarantine', d.decision === 'quarantine');
    d = run(verdictOf({stability_20: 'fail'}, {counts: {passed: 9, total: 10}}));
    check('a 9/10 window is not a 20-replay window = reject', d.decision === 'reject');

    d = run(verdictOf(), {gateResults: {static_spec: {status: 'fail', evidence: [{rule: 'x'}]}}});
    check(
        'verdict says pass but the gate module returned fail = reject (agent cannot override)',
        d.decision === 'reject' && codes(d).includes('verdict_contradicts_gate'),
    );
    d = run(verdictOf(), {gateResults: {containment_evidence: {status: 'blocked', evidence: []}}});
    check('verdict says pass but the gate returned blocked = reject', d.decision === 'reject');
    d = run(verdictOf({mutation_control: 'blocked'}), {
        gateResults: {mutation_control: {status: 'pass', evidence: []}},
        owner: 'qa-owner',
    });
    check(
        'the worse of verdict and gate result counts (verdict blocked, gate pass = quarantine)',
        d.decision === 'quarantine',
    );
    d = run(verdictOf(), {gateResults: {static_spec: {status: 'pass', evidence: []}}});
    check('agreeing gate results leave a promotion intact', d.decision === 'promote_pr');
    d = run(verdictOf({}, {counts: {passed: 10, total: 10}}));
    check(
        'a stability pass claimed over only 10 replays = reject',
        d.decision === 'reject' && codes(d).includes('stability_counts_below_policy'),
    );

    const broken = verdictOf();
    broken.gates[0].result = 'fail';
    broken.overall = 'pass';
    d = run(broken);
    check(
        'a verdict whose overall disagrees with its gates is schema-invalid = reject',
        d.decision === 'reject' && codes(d).includes('verdict_schema_invalid'),
    );
    d = run(verdictOf({}, {subject: 'charter'}));
    check(
        'a verdict about a charter is not promotable',
        d.decision === 'reject' && codes(d).includes('subject_not_spec'),
    );
    const duplicate = verdictOf({duplicate_gate: 'fail'}, {outcome: 'rejected_duplicate'});
    duplicate.duplicate_of = {suite: 'playwright', file: 'e2e-tests/playwright/specs/example.spec.ts', line: 10};
    d = run(duplicate);
    check(
        'a duplicate rejection outcome is never promoted',
        d.decision === 'reject' && codes(d).includes('outcome_rejected'),
    );
    const missing = verdictOf();
    missing.gates = missing.gates.filter((g) => g.gate !== 'secret_scan');
    d = run(missing);
    check(
        'a missing required gate = reject (gate_missing)',
        d.decision === 'reject' && codes(d).includes('gate_missing'),
    );
    const licenceFail = {gate: 'licence', result: 'fail', evidence: evidence('licence')};
    d = run(verdictOf({}, {extraGates: [licenceFail]}));
    check(
        'a failed gate outside the required set = reject',
        d.decision === 'reject' && codes(d).includes('gate_failed'),
    );
    const discoveryBlocked = {
        gate: 'discovery',
        result: 'blocked',
        blocked_reason: 'budget',
        evidence: evidence('discovery'),
    };
    d = run(verdictOf({}, {extraGates: [discoveryBlocked]}));
    check('a blocked gate outside the required set = reject', d.decision === 'reject');

    let threw = false;
    const tampered = path.join(os.tmpdir(), `policy-${process.pid}.json`);
    try {
        const weak = structuredClone(policy);
        weak.required_gates = weak.required_gates.filter((g) => g.id !== 'static_spec');
        fs.writeFileSync(tampered, JSON.stringify(weak));
        loadPolicy(tampered);
    } catch {
        threw = true;
    } finally {
        fs.rmSync(tampered, {force: true});
    }
    check('a policy with a required gate removed is refused', threw);
    threw = false;
    try {
        const weak = structuredClone(policy);
        weak.agent_verdict_override.allowed = true;
        fs.writeFileSync(tampered, JSON.stringify(weak));
        loadPolicy(tampered);
    } catch {
        threw = true;
    } finally {
        fs.rmSync(tampered, {force: true});
    }
    check('a policy that lets agent verdicts override gates is refused', threw);

    const pin = hashGates();
    check(
        'policy_hash lists every gate module and the policy',
        [
            'static_spec_check.mjs',
            'replay_judge.mjs',
            'stability_gate.mjs',
            'mutation_control.mjs',
            'promote_decision.mjs',
            'promotion_policy.json',
            'lessons_guard.mjs',
            'containment_evidence.mjs',
            'POLICY-CHANGE.md',
        ].every((f) => f in pin.files),
    );
    check('policy_hash is stable across two runs', hashGates().combined === pin.combined);
    check(
        'policy_hash excludes approvals.json and README.md',
        !('approvals.json' in pin.files) && !('README.md' in pin.files),
    );
    const edited = structuredClone(pin);
    edited.files['promotion_policy.json'] = '0'.repeat(64);
    edited.combined = '1'.repeat(64);
    const diff = diffPins(pin, edited);
    check(
        'a changed gate file is detected after a freeze',
        !diff.identical && diff.changed.join() === 'promotion_policy.json',
    );
    const added = structuredClone(pin);
    added.files['extra_gate.mjs'] = '2'.repeat(64);
    check('an added gate file is detected', diffPins(pin, added).added.join() === 'extra_gate.mjs');
    const removed = structuredClone(pin);
    delete removed.files['replay_judge.mjs'];
    check('a removed gate file is detected', diffPins(pin, removed).removed.join() === 'replay_judge.mjs');
    check(
        'approval requires a matching combined hash and a human approver',
        checkApproval({approvals: [{combined_sha256: pin.combined, approved_by: 'qa-lead'}]}, pin.combined).approved,
    );
    check(
        'approval by an agent handle is not accepted',
        !checkApproval({approvals: [{combined_sha256: pin.combined, approved_by: 'cursor-agent'}]}, pin.combined)
            .approved,
    );
    check(
        'approval of an older hash is not accepted',
        !checkApproval({approvals: [{combined_sha256: '3'.repeat(64), approved_by: 'qa-lead'}]}, pin.combined).approved,
    );
    return [...checks, ...cliChecks()];
}
