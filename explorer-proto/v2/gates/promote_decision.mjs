#!/usr/bin/env node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Promotion decision: promote_pr | quarantine | reject, computed only from gate results and promotion_policy.json.
// The verdict is the carrier of the gate results. Supplied gate-result files (the raw output of each gate module)
// are authoritative: the worse of verdict and gate result counts, and a verdict that claims better is rejected.
//
// Interface: decide({verdict, policy, gateResults?, owner?}) -> decision object (see README.md).
// CLI: promote_decision.mjs [--policy f] [--owner handle] [--gate-result <policy gate id>=<file>]... [--json] <verdict.json>
//      exit 0 promote_pr, 1 reject, 3 quarantine, 2 usage error (including a quarantine without --owner)
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {createValidators, describeErrors} from '../schemas/validator.mjs';

import {GATES_DIR, UsageError, parseArgs, printJson, readJsonFile, runCli, sha256, splitOnce} from './common.mjs';

export const POLICY_FILE = path.join(GATES_DIR, 'promotion_policy.json');
export const REQUIRED_GATE_IDS = [
    'schema',
    'leakage',
    'duplicate_gate',
    'static_spec',
    'stability_20',
    'mutation_control',
    'secrets_scan',
    'containment_evidence',
];
const RANK = {pass: 0, blocked: 1, fail: 2};
const OWNER_PATTERN = /^[a-z0-9][a-z0-9_-]{0,38}$/;

const worse = (a, b) => (RANK[a] >= RANK[b] ? a : b);

export function loadPolicy(file = POLICY_FILE) {
    const text = fs.readFileSync(file);
    const policy = JSON.parse(text);
    const ids = (policy.required_gates ?? []).map((g) => g.id);
    const missing = REQUIRED_GATE_IDS.filter((id) => !ids.includes(id));
    if (policy.schema !== 'explorer-promotion-policy/v1' || missing.length > 0) {
        throw new UsageError(`policy is not a valid promotion policy (missing gates: ${missing.join(', ') || 'none'})`);
    }
    if (policy.agent_verdict_override?.allowed !== false) {
        throw new UsageError('policy must state that agent verdicts cannot override gate failures');
    }
    if (!(policy.stability?.replays >= 20)) {
        throw new UsageError('policy stability.replays must be at least 20');
    }
    return {policy, sha256: sha256(text)};
}

let validators;
function validateVerdict(verdict) {
    validators ??= createValidators();
    const validate = validators.get('verdict');
    return validate(verdict) ? [] : describeErrors(validate.errors, 3);
}

function resultsByVerdictGate(verdict) {
    const map = new Map();
    for (const g of verdict.gates) {
        const known = map.get(g.gate);
        map.set(g.gate, {result: known ? worse(known.result, g.result) : g.result, counts: g.counts ?? known?.counts});
    }
    return map;
}

export function decide({verdict, policy, gateResults = {}, owner}) {
    const reasons = [];
    const why = (code, gate, detail) => reasons.push({code, ...(gate ? {gate} : {}), ...(detail ? {detail} : {})});
    const effective = {};

    const decision = (name, extra = {}) => ({
        decision: name,
        reasons,
        gates: effective,
        agent_verdict_override_allowed: false,
        ...extra,
    });

    const schemaErrors = validateVerdict(verdict);
    if (schemaErrors.length > 0) {
        why('verdict_schema_invalid', undefined, schemaErrors.join('; '));
        return decision('reject');
    }
    if (verdict.subject.kind !== 'spec') {
        why('subject_not_spec', undefined, `subject kind ${verdict.subject.kind}`);
        return decision('reject');
    }
    if (verdict.outcome === 'rejected_duplicate' || verdict.outcome === 'rejected_unreachable') {
        why('outcome_rejected', undefined, `verdict outcome ${verdict.outcome}`);
        return decision('reject');
    }

    const byGate = resultsByVerdictGate(verdict);
    const requiredVerdictGates = new Set(policy.required_gates.map((g) => g.verdict_gate));
    for (const {id, verdict_gate: verdictGate} of policy.required_gates) {
        const claimed = byGate.get(verdictGate);
        let result = claimed?.result ?? 'blocked';
        if (!claimed) {
            why('gate_missing', id, 'the verdict has no result for this required gate');
        }
        const supplied = gateResults[id];
        if (supplied !== undefined) {
            if (!(supplied.status in RANK)) {
                throw new UsageError(`gate result for ${id} has no valid status`);
            }
            if (claimed && RANK[claimed.result] < RANK[supplied.status]) {
                why(
                    'verdict_contradicts_gate',
                    id,
                    `verdict says ${claimed.result}, the gate returned ${supplied.status}`,
                );
            }
            result = worse(result, supplied.status);
        }
        if (id === 'stability_20' && result === 'pass') {
            const total = claimed?.counts?.total ?? gateResults[id]?.counts?.replays_given;
            if (total === undefined || total < policy.stability.replays) {
                why(
                    'stability_counts_below_policy',
                    id,
                    `counts show ${total ?? 'no'} replays, policy needs ${policy.stability.replays}`,
                );
                result = 'fail';
            }
        }
        effective[id] = result;
    }
    for (const [name, {result}] of byGate) {
        if (!requiredVerdictGates.has(name) && result !== 'pass') {
            why(
                result === 'fail' ? 'gate_failed' : 'gate_blocked',
                name,
                'a gate outside the required set did not pass',
            );
            effective[name] = result;
        }
    }

    for (const [id, result] of Object.entries(effective)) {
        if (result === 'fail' && id !== 'stability_20') {
            why('gate_failed', id);
        }
    }

    const controlBlocked = effective.mutation_control === 'blocked';
    if (controlBlocked) {
        why('control_blocked', 'mutation_control', 'a blocked control is never a pass');
    }
    const otherBlocked = Object.entries(effective).filter(([id, r]) => r === 'blocked' && id !== 'mutation_control');
    for (const [id] of otherBlocked) {
        if (!reasons.some((r) => r.gate === id && r.code === 'gate_missing')) {
            why('gate_blocked', id, 'retryable: remove the blocker and re-run the gate');
        }
    }

    let flaky = false;
    if (effective.stability_20 === 'fail') {
        const stability = byGate.get('stability');
        const total = stability?.counts?.total ?? 0;
        const passed = stability?.counts?.passed ?? 0;
        const withinBudget =
            total >= policy.stability.replays &&
            total - passed >= 1 &&
            total - passed <= policy.flake_budget.max_flaky_replays_for_quarantine;
        const signature = (gateResults.stability_20?.evidence ?? [])
            .map((e) => e.rule)
            .filter((rule) => policy.flake_budget.non_quarantinable_stability_rules.includes(rule));
        if (
            withinBudget &&
            signature.length === 0 &&
            !reasons.some((r) => r.code === 'stability_counts_below_policy')
        ) {
            flaky = true;
            why('stability_flake_within_budget', 'stability_20', `${passed}/${total} replays passed`);
        } else {
            why(
                'gate_failed',
                'stability_20',
                signature.length > 0
                    ? `non-quarantinable failure: ${signature.join(',')}`
                    : `${passed}/${total} replays passed, over the flake budget`,
            );
        }
    }

    const hardStop = reasons.some((r) =>
        [
            'gate_failed',
            'gate_missing',
            'gate_blocked',
            'verdict_contradicts_gate',
            'stability_counts_below_policy',
        ].includes(r.code),
    );
    if (hardStop) {
        return decision('reject');
    }
    if (controlBlocked || flaky) {
        const q = policy.quarantine;
        const record = {
            tag: q.tag,
            owner: owner ?? null,
            owner_required: q.owner_required,
            [q.rerun_schedule.field]: {cadence: q.rerun_schedule.cadence},
            unquarantine_rule: {
                consecutive_clean_runs: q.unquarantine_rule.consecutive_clean_runs,
                distinct_days: q.unquarantine_rule.distinct_days,
            },
        };
        return decision('quarantine', {quarantine: record});
    }
    why('all_required_gates_passed');
    return decision('promote_pr');
}

function parseGateResults(specs) {
    const out = {};
    for (const spec of specs ?? []) {
        const [id, file] = splitOnce(spec, '=');
        if (!REQUIRED_GATE_IDS.includes(id) || !file) {
            throw new UsageError('--gate-result needs <policy gate id>=<file>');
        }
        out[id] = readJsonFile(file);
    }
    return out;
}

async function main() {
    const {positional, values} = parseArgs(process.argv.slice(2), {
        flags: ['json'],
        options: ['policy', 'owner'],
        multi: ['gate-result'],
    });
    if (positional.length !== 1) {
        throw new UsageError(
            'usage: promote_decision.mjs [--policy f] [--owner handle] [--gate-result id=file]... [--json] <verdict.json>',
        );
    }
    if (values.owner !== undefined && !OWNER_PATTERN.test(values.owner)) {
        throw new UsageError('--owner must be a lowercase handle');
    }
    const {policy, sha256: policyHash} = loadPolicy(values.policy);
    const result = decide({
        verdict: readJsonFile(positional[0]),
        policy,
        gateResults: parseGateResults(values['gate-result']),
        owner: values.owner,
    });
    const out = {...result, policy_sha256: policyHash};
    if (values.json) {
        printJson(out);
    } else {
        process.stdout.write(`decision: ${out.decision}\nwhy:\n`);
        for (const r of out.reasons) {
            process.stdout.write(`  - ${r.code}${r.gate ? ` [${r.gate}]` : ''}${r.detail ? `: ${r.detail}` : ''}\n`);
        }
        process.stdout.write(
            `gates: ${Object.entries(out.gates)
                .map(([k, v]) => `${k}=${v}`)
                .join(' ')}\n`,
        );
        if (out.quarantine) {
            process.stdout.write(
                `quarantine: tag ${out.quarantine.tag}, owner ${out.quarantine.owner ?? '(missing)'}, rerun cadence ${out.quarantine.rerun_schedule.cadence}\n`,
            );
        }
        process.stdout.write('agent verdicts cannot override gate failures\n');
    }
    if (out.decision === 'quarantine') {
        if (!values.owner) {
            throw new UsageError('quarantine needs --owner <handle>: a quarantined spec must have an owner');
        }
        return 3;
    }
    return out.decision === 'promote_pr' ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    runCli(main);
}
