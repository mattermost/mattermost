#!/usr/bin/env node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Extracts the numbers that exist in the committed v1 artifacts, read from git objects at the frozen v1 commit
// (not the working tree, which carries later journey-mode work).
//   node baseline_v1.mjs [--commit <sha>] [--json]
// Timing, cost and replay-stability results were never recorded as numbers, so they are reported as "not recorded".
import {execFileSync} from 'node:child_process';

import {canonicalJson, isMain, parseArgs, readJson, REPO_ROOT, RULES_FILE} from './common.mjs';

const NOT_RECORDED = 'not recorded';

function git(args) {
    return execFileSync('git', ['-C', REPO_ROOT, ...args], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
}

function lsTree(commit) {
    return git(['ls-tree', '-r', '--name-only', commit, '--', 'explorer-proto']).split('\n').filter(Boolean);
}

function show(commit, file) {
    return git(['show', `${commit}:${file}`]);
}

function countMatches(text, re) {
    return text.match(re)?.length ?? 0;
}

function specInfo(commit, file) {
    const text = show(commit, file);
    return {
        file,
        tests: countMatches(text, /^\s*test\(/gm),
        expect_calls: countMatches(text, /\bexpect(?:\.soft)?\(/g),
        soft_expect_calls: countMatches(text, /\bexpect\.soft\(/g),
    };
}

function traceInfo(commit, file) {
    const t = JSON.parse(show(commit, file));
    const limits = t.budget.limits;
    const used = t.budget.used;
    return {
        file,
        schema: t.schema,
        budget_limits: limits,
        budget_used: used,
        states: t.states.length,
        transitions: t.transitions.length,
        budget_skips: t.budgetSkips.length,
        guard_blocked_total: t.guard.blockedTotal,
        guard_violations: t.guard.violations.length,
        emission: (t.emission.map ? t.emission : [t.emission]).map((e) => ({
            scenario: e.scenario ?? e.file,
            status: e.status,
        })),
    };
}

export function extractBaseline(commit) {
    const files = lsTree(commit);
    const specFiles = files.filter((f) => f.endsWith('.spec.ts'));
    const traceFiles = files.filter((f) => /(^|\/)generated\/trace\.json$/.test(f));
    const charterFiles = files.filter((f) => /^explorer-proto\/sessions\/[^/]+\/charter\.json$/.test(f));

    const scenarios = JSON.parse(show(commit, 'explorer-proto/scenarios.json')).scenarios;
    const runPilot = show(commit, 'explorer-proto/run-pilot.sh');
    const pilotControls = [...runPilot.matchAll(/^\s+control\s+([a-z][a-z-]*)\s+"/gm)].map((m) => m[1]);
    const charterControls = charterFiles.flatMap((f) =>
        (JSON.parse(show(commit, f)).negative_controls ?? []).map((c) => ({session: f.split('/')[2], id: c.id})),
    );

    return {
        version: 'v1 frozen',
        commit,
        specs: {count: specFiles.length, files: specFiles.map((f) => specInfo(commit, f))},
        controls: {
            declared_in_scenarios_json: scenarios.filter((s) => s.negative_control).length,
            declared_in_session_charters: charterControls,
            implemented_in_run_pilot_verify: pilotControls,
        },
        discovery_counters: traceFiles.map((f) => traceInfo(commit, f)),
        charters_present: charterFiles,
        timing: {elapsed_seconds: NOT_RECORDED},
        cost: {agent_calls: NOT_RECORDED, fix_rounds: NOT_RECORDED, human_review_minutes: NOT_RECORDED},
        stability: {
            replays_passed: NOT_RECORDED,
            note: 'README repeat counts are configuration, and determinism claims are not stored as results',
        },
        control_sensitivity_results: NOT_RECORDED,
    };
}

function printText(b) {
    const out = (line = '') => process.stdout.write(`${line}\n`);
    out(`v1 baseline at ${b.commit} (read from git objects)`);
    out(`specs: ${b.specs.count}`);
    for (const s of b.specs.files) {
        out(`  ${s.file}: tests=${s.tests} expect_calls=${s.expect_calls} (soft ${s.soft_expect_calls})`);
    }
    out(`controls declared in scenarios.json: ${b.controls.declared_in_scenarios_json}`);
    out(
        `controls declared in session charters: ${b.controls.declared_in_session_charters.map((c) => `${c.session}/${c.id}`).join(', ') || 'none'}`,
    );
    out(`controls implemented in run-pilot.sh verify: ${b.controls.implemented_in_run_pilot_verify.join(', ')}`);
    for (const t of b.discovery_counters) {
        const u = t.budget_used;
        out(
            `discovery counters ${t.file}: states=${t.states} transitions=${t.transitions} used=${JSON.stringify(u)} limits=${JSON.stringify(t.budget_limits)} budget_skips=${t.budget_skips} guard_blocked=${t.guard_blocked_total}`,
        );
    }
    out(`charters present: ${b.charters_present.join(', ')}`);
    out(`elapsed_seconds: ${b.timing.elapsed_seconds}`);
    out(`agent_calls, fix_rounds, human_review_minutes: ${NOT_RECORDED}`);
    out(`stability (replays passed): ${b.stability.replays_passed}`);
    out(`control sensitivity results: ${b.control_sensitivity_results}`);
}

if (isMain(import.meta.url)) {
    const {flags} = parseArgs(process.argv.slice(2), {booleans: ['json']});
    try {
        const commit = flags.commit ?? readJson(RULES_FILE).version_a.commit;
        const baseline = extractBaseline(commit);
        if (flags.json) {
            process.stdout.write(canonicalJson(baseline));
        } else {
            printText(baseline);
        }
    } catch (e) {
        process.stderr.write(`${e.message}\n`);
        process.exitCode = 2;
    }
}
