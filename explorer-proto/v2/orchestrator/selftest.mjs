#!/usr/bin/env node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @stylistic/dot-location, @stylistic/multiline-ternary, @stylistic/operator-linebreak, @stylistic/wrap-regex, no-process-env -- Prettier owns formatting and the repo config relaxes these rules for .ts/.js only */

// Self-test of the orchestrator: no Docker, no network, stub agents only. Run from anywhere:
//   node explorer-proto/v2/orchestrator/selftest.mjs [--keep]
// Prints PASS or FAIL per check; exit 0 only if every check passes.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {validateOutDir} from './lib/artifacts.mjs';
import {EXIT, hashFiles, listFiles, ORCH_DIR, readJson, REPO_ROOT, sha256Json} from './lib/common.mjs';
import {assessLesson, isProtectedPath} from './lib/lessons_gate.mjs';
import {validate} from './lib/schemas.mjs';
import {stubResult} from './lib/stub_agent.mjs';
import {buildVerdict, overallOf} from './lib/verdicts.mjs';
import {unitChecks} from './selftest_units.mjs';

const PILOT = path.join(ORCH_DIR, 'pilot.mjs');
const KEEP = process.argv.includes('--keep');
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), 'pilot-selftest-'));
const FEATURE = 'channels.favorites';

const results = [];
let counter = 0;

function newDir(label) {
    return path.join(WORK, `${label}-${++counter}`);
}

function envWithoutLicence(extra = {}) {
    const env = {...process.env, ...extra};
    delete env.MM_LICENSE;
    return env;
}

function pilot(args, {env = envWithoutLicence()} = {}) {
    const r = spawnSync('node', [PILOT, ...args], {cwd: REPO_ROOT, encoding: 'utf8', env, maxBuffer: 64 * 1024 * 1024});
    return {status: r.status, stdout: r.stdout, stderr: r.stderr};
}

function run(out, extra = [], opts) {
    return pilot(['run', '--target', 'main', '--feature', FEATURE, '--dry-run', '--out', out, ...extra], opts);
}

function clone(from) {
    const dir = newDir('run');
    fs.cpSync(from, dir, {recursive: true});
    return dir;
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

async function check(name, fn) {
    try {
        await fn();
        results.push({name, ok: true});
        process.stdout.write(`PASS ${name}\n`);
    } catch (e) {
        results.push({name, ok: false, why: e.message});
        process.stdout.write(`FAIL ${name}\n     ${String(e.message).split('\n').join('\n     ')}\n`);
    }
}

function readStage(out, dir, file) {
    return readJson(path.join(out, dir, file));
}

function stageRecord(out, dir) {
    return readStage(out, dir, 'stage-record.json');
}

async function answer(out, stage, name, scenario, patch = (r) => r) {
    const suffix = name ? `.${name}` : '';
    const task = readStage(out, stage, `agent-task${suffix}.json`);
    const result = patch(await stubResult(task, {out, flags: {feature: FEATURE, live: false}}, scenario));
    fs.writeFileSync(path.join(out, stage, `agent-result${suffix}.json`), JSON.stringify(result, null, 2));
}

function normalizedTree(out) {
    const files = listFiles(out, {skip: (rel) => rel.startsWith('.state') || rel.endsWith('stage-record.json')});
    const records = listFiles(out).filter((f) => f.endsWith('stage-record.json'));
    const normal = records.map((f) => {
        const r = readJson(path.join(out, f));
        delete r.metrics.volatile;
        delete r.metrics.elapsed_seconds;
        delete r.metrics.arg_count;
        return [f, r];
    });
    return sha256Json({files: hashFiles(out, files), records: normal});
}

function exactTree(out) {
    return sha256Json(hashFiles(out, listFiles(out)));
}

const BASE = newDir('base');

async function main() {
    await check('setup: stages 0 and 1 (target, coverage index) run once and are reused by later checks', () => {
        const r = run(BASE, ['--agents=stub', '--to', '1']);
        assert(r.status === 0, `exit ${r.status}: ${r.stderr}`);
    });

    await check('(1) dry run with stub agents completes all 10 stages with valid artifacts', () => {
        const out = clone(BASE);
        const r = run(out, ['--agents=stub']);
        assert(r.status === 0, `exit ${r.status}\n${r.stdout}\n${r.stderr}`);
        for (const dir of [
            '0-target',
            '1-index',
            '2-explore',
            '3-triage',
            '4-select',
            '5-discover',
            '6-emit',
            '7-verify',
            '8-promote',
            '9-lessons',
        ]) {
            const record = stageRecord(out, dir);
            assert(['pass', 'skipped'].includes(record.result), `${dir} result ${record.result}`);
            assert(record.budget_outcome === 'within', `${dir} budget ${record.budget_outcome}`);
            assert(
                Number.isInteger(record.metrics.exit_code) && typeof record.metrics.elapsed_seconds === 'number',
                `${dir} metrics`,
            );
            assert(Number.isInteger(record.metrics.agent_calls), `${dir} agent_calls`);
        }
        const {checked, failures} = validateOutDir(out);
        assert(
            failures.length === 0 && checked > 25,
            `artifact validation: ${checked} checked, failures ${JSON.stringify(failures.slice(0, 2))}`,
        );
        assert(stageRecord(out, '2-explore').reason === 'skipped: not live', 'explore must record "skipped: not live"');
        const verdict = readJson(
            path.join(out, '7-verify/verdicts', fs.readdirSync(path.join(out, '7-verify/verdicts'))[0]),
        );
        assert(
            verdict.overall === 'blocked' && verdict.outcome === 'blocked',
            'dry verdict must be blocked, never pass',
        );
        const promote = readStage(out, '8-promote', 'promote.json');
        assert(
            promote.dry_run && !promote.pushed && !promote.pr_opened && !promote.promotable,
            'promote must be a dry proposal',
        );
        const calls = fs.readFileSync(path.join(out, 'agent-calls.jsonl'), 'utf8').trim().split('\n');
        assert(calls.length === 4, `expected 4 agent calls, found ${calls.length}`);

        const before = exactTree(out);
        const again = run(out, ['--agents=stub']);
        assert(
            again.status === 0 && (again.stdout.match(/up to date/g) ?? []).length === 10,
            `second run was not a no-op:\n${again.stdout}`,
        );
        assert(exactTree(out) === before, 'second run changed bytes');

        const other = newDir('run');
        const second = run(other, ['--agents=stub']);
        assert(second.status === 0, `independent run exit ${second.status}`);
        assert(
            normalizedTree(out) === normalizedTree(other),
            'two independent runs differ (artifacts or stage records without timing)',
        );
        const forced = run(out, ['--agents=stub', '--force', '--from', '8', '--to', '8']);
        assert(forced.status === 0 && !forced.stdout.includes('up to date'), '--force must rerun the stage');
    });

    await check('(1b) release target runs the same pipeline; image pins match infra lib.sh', () => {
        const out = newDir('release');
        const r = pilot([
            'run',
            '--target',
            'release',
            '--feature',
            'channels.create-and-modals',
            '--dry-run',
            '--agents=stub',
            '--out',
            out,
            '--to',
            '0',
        ]);
        assert(r.status === 0, `exit ${r.status}\n${r.stdout}${r.stderr}`);
        const checkFile = readStage(out, '0-target', 'target-check.json');
        const pin = checkFile.checks.find((c) => c.id === 'image_pin_matches_lib_sh');
        assert(pin?.result === 'pass', 'release image pin check');
        assert(validate('target', readStage(out, '0-target', 'target.json')).ok, 'target.json valid');
    });

    await check(
        '(2) manual mode stops with exit 20, resumes with a valid result, and rejects an invalid result (exit 21)',
        async () => {
            const out = clone(BASE);
            const first = run(out, ['--agents=manual', '--to', '4']);
            assert(first.status === EXIT.AWAITING_AGENT, `expected exit 20, got ${first.status}\n${first.stdout}`);
            assert(
                first.stdout.includes(path.join(out, '4-select', 'agent-task.json')),
                'the task path must be printed',
            );
            assert(
                validate('orch#agent-task', readStage(out, '4-select', 'agent-task.json')).ok,
                'agent-task.json schema',
            );
            assert(stageRecord(out, '4-select').result === 'awaiting_agent', 'record must say awaiting_agent');

            await answer(out, '4-select', '', 'invalid');
            const bad = pilot(['run', '--resume', '--out', out, '--to', '4']);
            assert(
                bad.status === EXIT.AGENT_INVALID,
                `expected exit 21 for an invalid result, got ${bad.status}\n${bad.stdout}`,
            );
            assert(
                fs.existsSync(path.join(out, '4-select/agent-result.rejected.json')),
                'invalid result must be set aside',
            );
            assert(
                !fs.existsSync(path.join(out, '4-select/agent-result.json')),
                'invalid result must not remain in place',
            );

            await answer(out, '4-select', '', 'default', (r) => ({
                ...r,
                task_id: 'select-charter-proposer-0000000000',
            }));
            const stale = pilot(['run', '--resume', '--out', out, '--to', '4']);
            assert(
                stale.status === EXIT.AGENT_INVALID,
                `a result for another task must be rejected, got ${stale.status}`,
            );

            await answer(out, '4-select', '', 'default');
            const second = pilot(['run', '--resume', '--out', out, '--to', '4']);
            assert(
                second.status === EXIT.AWAITING_AGENT,
                `expected the review task next (exit 20), got ${second.status}\n${second.stdout}`,
            );
            assert(fs.existsSync(path.join(out, '4-select/agent-task.review.json')), 'review task file');
            await answer(out, '4-select', 'review', 'default');
            const done = pilot(['run', '--resume', '--out', out, '--to', '4']);
            assert(done.status === 0, `resume with valid results must finish, got ${done.status}\n${done.stdout}`);
            const selection = readStage(out, '4-select', 'selection.json');
            assert(
                selection.decisions[0].decision === 'accepted' && selection.decisions[0].reviewed === true,
                'accepted after review',
            );
            const manual = fs
                .readFileSync(path.join(out, 'agent-calls.jsonl'), 'utf8')
                .trim()
                .split('\n')
                .map((l) => JSON.parse(l));
            assert(
                manual.every((c) => c.provider === 'manual') && manual.some((c) => c.outcome === 'invalid'),
                'manual calls are counted, invalid ones included',
            );
        },
    );

    await check('(2b) a reviewer that cites a file outside the coverage report is rejected', async () => {
        const out = clone(BASE);
        run(out, ['--agents=manual', '--to', '4']);
        await answer(out, '4-select', '', 'duplicate-bookmark');
        const next = pilot(['run', '--resume', '--out', out, '--to', '4']);
        assert(next.status === EXIT.AWAITING_AGENT, `expected the review task, got ${next.status}`);
        await answer(out, '4-select', 'review', 'duplicate-bookmark', (r) => {
            r.reviews[0].axes.transitions.citations = [
                {file: 'e2e-tests/playwright/specs/not_in_the_report.spec.ts', line: 3},
            ];
            return r;
        });
        const bad = pilot(['run', '--resume', '--out', out, '--to', '4']);
        assert(bad.status === EXIT.AGENT_INVALID, `expected exit 21, got ${bad.status}`);
        assert(
            readStage(out, '4-select', 'agent-result.review.errors.json')
                .errors.join(' ')
                .includes('not in the coverage report'),
            'error must name the citation',
        );
        assert(
            !validate('agent#review', {
                schema: 'explorer-review-result/v1',
                task_id: 'x-1',
                reviews: [
                    {
                        charter_id: 'a-1',
                        judgement: 'equivalent',
                        compared_test: {suite: 'playwright', file: 'a/b.ts', line: 1},
                        axes: {
                            actors_setup: {citations: [], rationale: 'r'},
                            transitions: {citations: [], rationale: 'r'},
                            final_assertions: {citations: [], rationale: 'r'},
                        },
                    },
                ],
            }).ok,
            'a review without citations must fail the schema',
        );
    });

    await check('(3) a planted "click X then Y" charter is rejected at select by the leakage check', () => {
        const out = clone(BASE);
        const r = run(out, ['--agents=stub:leaky', '--to', '9']);
        const selection = readStage(out, '4-select', 'selection.json');
        const d = selection.decisions[0];
        assert(d.decision === 'rejected_leakage' && d.leakage === 'fail', `decision ${d.decision}`);
        assert(
            d.violations.some((v) => v.rule === 'L1' && v.path === 'goal'),
            'the ordered-phrase rule must fire on the goal',
        );
        assert(
            !fs.existsSync(path.join(out, '4-select/charters')) ||
                fs.readdirSync(path.join(out, '4-select/charters')).length === 0,
            'nothing may be accepted',
        );
        const verdict = readJson(path.join(out, d.verdict_file));
        assert(
            verdict.outcome === 'failed' && verdict.gates.some((g) => g.gate === 'leakage' && g.result === 'fail'),
            'verdict must record the failed leakage gate',
        );
        assert(validate('verdict', verdict).ok, 'verdict schema');
        assert(
            stageRecord(out, '5-discover').reason === 'skipped: no accepted charter',
            'discover must not run for a rejected charter',
        );
        assert(r.status === EXIT.FAIL, `the run must report the failure (exit 1), got ${r.status}\n${r.stdout}`);
    });

    await check(
        '(4) planted duplicates (bookmark-open flow, save/pin flow) are rejected or reviewed, never promoted',
        () => {
            const bookmark = clone(BASE);
            const r = run(bookmark, ['--agents=stub:duplicate-bookmark', '--to', '8']);
            const d = readStage(bookmark, '4-select', 'selection.json').decisions[0];
            assert(
                d.coverage_verdict === 'needs_review' && d.reviewed === true,
                `bookmark candidate must be routed to review (${d.coverage_verdict}, reviewed ${d.reviewed})`,
            );
            assert(d.decision === 'rejected_duplicate' && d.duplicate_of?.file, `decision ${d.decision}`);
            assert(d.evidence.length >= 2, 'rejection must carry evidence');
            assert(r.status === 0, `a duplicate rejection is a normal outcome (exit ${r.status})\n${r.stdout}`);
            const promote = readStage(bookmark, '8-promote', 'promote.json');
            assert(
                promote.promotable === false && promote.would_add.length === 0,
                'a rejected duplicate must never be promoted',
            );
            const verdict = readJson(path.join(bookmark, d.verdict_file));
            assert(
                verdict.outcome === 'rejected_duplicate' && verdict.duplicate_of && validate('verdict', verdict).ok,
                'verdict must name the covering test',
            );

            const likely = clone(BASE);
            run(likely, ['--agents=stub:duplicate-likely', '--to', '4']);
            const l = readStage(likely, '4-select', 'selection.json').decisions[0];
            assert(
                l.coverage_verdict === 'likely_duplicate' &&
                    l.decision === 'rejected_duplicate' &&
                    l.reviewed === false,
                `likely_duplicate must be rejected without review (${l.decision})`,
            );
            assert(
                !fs.existsSync(path.join(likely, '4-select/agent-task.review.json')),
                'no reviewer task for a likely duplicate',
            );
        },
    );

    await check(
        '(5) a verdict "pass" with a failing or blocked deterministic gate is rejected by the schema',
        async () => {
            const example = path.join(
                REPO_ROOT,
                'explorer-proto/v2/schemas/examples/verdict.invalid-pass-with-failed-gate.json',
            );
            assert(
                !validate('verdict', readJson(example)).ok,
                'the verdict schema must reject overall pass with a failed gate',
            );
            const evidence = [{kind: 'report', ref: 'x/y.json'}];
            for (const result of ['fail', 'blocked']) {
                const gate =
                    result === 'blocked'
                        ? {gate: 'lint', result, evidence, blocked_reason: 'environment'}
                        : {gate: 'lint', result, evidence};
                const forged = {
                    ...buildVerdict({subjectId: 'a-1', outcome: 'failed', gates: [gate]}),
                    overall: 'pass',
                    outcome: 'emitted_passing',
                };
                assert(!validate('verdict', forged).ok, `forged pass over a ${result} gate must be invalid`);
            }
            assert(
                overallOf([{result: 'pass'}, {result: 'blocked'}]) === 'blocked' &&
                    overallOf([{result: 'blocked'}, {result: 'fail'}]) === 'fail',
                'overall combination',
            );

            const out = clone(BASE);
            run(out, ['--agents=manual', '--to', '7']);
            await answer(out, '4-select', '', 'default');
            pilot(['run', '--resume', '--out', out, '--to', '7']);
            await answer(out, '4-select', 'review', 'default');
            const atVerify = pilot(['run', '--resume', '--out', out, '--to', '7']);
            assert(
                atVerify.status === EXIT.AWAITING_AGENT,
                `expected the verify task, got ${atVerify.status}\n${atVerify.stdout}`,
            );
            await answer(out, '7-verify', '', 'verdict-pass-with-failing-gate');
            const bad = pilot(['run', '--resume', '--out', out, '--to', '7']);
            assert(
                bad.status === EXIT.AGENT_INVALID,
                `a pass proposal over blocked gates must be rejected, got ${bad.status}\n${bad.stdout}`,
            );
            assert(
                readStage(out, '7-verify', 'agent-result.errors.json').errors.join(' ').includes('proposed_overall'),
                'error must name proposed_overall',
            );
            assert(
                !fs.existsSync(path.join(out, '7-verify/verdicts')) ||
                    fs.readdirSync(path.join(out, '7-verify/verdicts')).length === 0,
                'no verdict may be written from a rejected result',
            );
        },
    );

    await check('(6) a lesson that touches a gate file is refused without a recorded human approval', () => {
        const out = clone(BASE);
        const r = run(out, ['--agents=stub:lesson-touches-gate']);
        assert(r.status === 0, `exit ${r.status}\n${r.stdout}`);
        const plan = readStage(out, '9-lessons', 'application-plan.json');
        assert(
            plan.lessons.length === 1 &&
                plan.lessons[0].decision === 'refused_needs_human_approval' &&
                plan.lessons[0].protected_target,
            'plan must refuse',
        );
        const lessonFile = path.join(out, plan.lessons[0].file);
        const lesson = readJson(lessonFile);
        assert(lesson.status === 'proposed' && lesson.applied === false, 'lessons are stored as proposals');
        const refused = pilot(['lesson', 'apply', lessonFile]);
        assert(
            refused.status === EXIT.FAIL && refused.stdout.startsWith('REFUSED'),
            `apply must be refused: ${refused.stdout}`,
        );
        const approvedFile = path.join(WORK, 'approved-lesson.json');
        fs.writeFileSync(approvedFile, JSON.stringify({...lesson, status: 'approved', approver: 'reviewer-one'}));
        const ok = pilot(['lesson', 'apply', approvedFile]);
        assert(ok.status === 0 && ok.stdout.startsWith('ELIGIBLE'), `an approved lesson is eligible: ${ok.stdout}`);
        const botApproved = {...lesson, status: 'approved', approver: 'cursor-agent'};
        assert(
            assessLesson(botApproved).decision === 'refused_needs_human_approval',
            'an automation handle is not a human approver',
        );
        const fake = {...lesson, status: 'approved'};
        assert(!validate('lesson', fake).ok, 'approved without an approver is invalid');
        assert(
            !validate('agent#lessons', {
                schema: 'explorer-lessons-result/v1',
                task_id: 'a-1',
                lessons: [{...lesson, status: 'approved', approver: 'agent-x'}],
            }).ok,
            'an agent cannot approve its own lesson',
        );
        for (const target of [
            'explorer-proto/v2/orchestrator/gates/spec_static.mjs',
            'explorer-proto/v2/orchestrator/gates/../gates/index.mjs',
            'explorer-proto/v2/bakeoff/rules.json',
            'explorer-proto/v2/oracles/allowlist.json',
            'explorer-proto/v2/schemas/charter.schema.json',
        ]) {
            assert(isProtectedPath(target), `${target} must be protected`);
        }
        assert(!isProtectedPath('explorer-proto/v2/orchestrator/prompts/select.md'), 'prompts are not protected');
        const ruleKind = {...lesson, proposed_check: {kind: 'gate_threshold', description: 'Raise a threshold.'}};
        assert(
            assessLesson(ruleKind).decision === 'refused_needs_human_approval',
            'a threshold lesson is protected whatever file it names',
        );
    });

    await check('(7) budgets: time, agent-call and retry overruns are reported failures, never passes', () => {
        const slow = clone(BASE);
        const t = run(slow, ['--agents=stub:sleep', '--budget', 'select.time=1', '--to', '4']);
        const record = stageRecord(slow, '4-select');
        assert(
            t.status === EXIT.FAIL && record.result === 'fail' && record.budget_outcome === 'time_exceeded',
            `time: exit ${t.status}, ${record.result}/${record.budget_outcome}\n${t.stdout}`,
        );
        assert(
            !fs.existsSync(path.join(slow, '4-select/selection.json')),
            'a stage that exceeded its budget must not leave a selection',
        );

        const calls = clone(BASE);
        const c = run(calls, ['--agents=stub', '--budget', 'select.agent_calls=1', '--to', '4']);
        const cr = stageRecord(calls, '4-select');
        assert(
            c.status === EXIT.FAIL && cr.result === 'fail' && cr.budget_outcome === 'agent_calls_exceeded',
            `calls: exit ${c.status}, ${cr.result}/${cr.budget_outcome}`,
        );

        const retries = clone(BASE);
        const q = run(retries, ['--agents=stub:invalid', '--to', '4']);
        const rr = stageRecord(retries, '4-select');
        assert(
            q.status === EXIT.FAIL && rr.result === 'fail' && rr.budget_outcome === 'retries_exceeded',
            `retries: exit ${q.status}, ${rr.result}/${rr.budget_outcome}`,
        );

        const rerun = run(slow, ['--agents=stub', '--to', '4']);
        assert(rerun.status === 0, `a failed stage must rerun on the next invocation (exit ${rerun.status})`);
    });

    await check('agent command provider: a cmd template runs, and a failing command is exit 22', async () => {
        const script = path.join(WORK, 'agent.mjs');
        fs.writeFileSync(
            script,
            [
                "import fs from 'node:fs';",
                `import {stubResult} from ${JSON.stringify(path.join(ORCH_DIR, 'lib/stub_agent.mjs'))};`,
                'const [task, result] = process.argv.slice(2);',
                "const t = JSON.parse(fs.readFileSync(task, 'utf8'));",
                'const out = process.env.PILOT_OUT;',
                `fs.writeFileSync(result, JSON.stringify(await stubResult(t, {out, flags: {feature: ${JSON.stringify(FEATURE)}, live: false}}, 'default')));`,
            ].join('\n'),
        );
        const out = clone(BASE);
        const ok = run(out, [`--agents=cmd:node "${script}" {task} {result}`, '--to', '4'], {
            env: envWithoutLicence({PILOT_OUT: out}),
        });
        assert(ok.status === 0, `cmd provider exit ${ok.status}\n${ok.stdout}${ok.stderr}`);
        const calls = fs
            .readFileSync(path.join(out, 'agent-calls.jsonl'), 'utf8')
            .trim()
            .split('\n')
            .map((l) => JSON.parse(l));
        assert(calls.length === 2 && calls.every((c) => c.provider === 'cmd'), 'two cmd calls counted');
        const failing = clone(BASE);
        const bad = run(failing, ['--agents=cmd:node -e process.exit(3)', '--to', '4']);
        assert(bad.status === EXIT.AGENT_FAILED, `expected exit 22, got ${bad.status}\n${bad.stdout}`);
    });

    await check(
        'triage: adopted oracle runs give reproduction counts; the agent cannot confirm what reproduced once',
        () => {
            const real = newDir('explore');
            const r = pilot([
                'run',
                '--target',
                'main',
                '--feature',
                FEATURE,
                '--dry-run',
                '--mode',
                'explore',
                '--agents=stub',
                '--out',
                real,
                '--oracle-results',
                path.join(REPO_ROOT, 'explorer-proto/v2/oracles/results'),
            ]);
            assert(r.status === 0, `exit ${r.status}\n${r.stdout}${r.stderr}`);
            const summary = readStage(real, '3-triage', 'triage-summary.json');
            assert(
                summary.findings.length > 0 && summary.findings.every((f) => f.attempts === 3),
                'findings with 3 attempts each',
            );
            assert(
                summary.findings.every((f) => f.status === (f.reproduced >= 2 ? 'confirmed' : 'candidate')),
                'confirmed only with 2 or more reproductions',
            );
            const plan = readStage(real, '2-explore', 'feature-plan.json');
            assert(
                plan.run_files.every((f) => !/faults|without-browser-flag/.test(f)),
                'fault-injection and flag-variant runs are never adopted',
            );
            assert(validateOutDir(real).failures.length === 0, 'artifacts valid');

            const synthetic = newDir('oracle-results');
            fs.mkdirSync(synthetic);
            const line = {
                oracle: 'O-CONSOLE',
                class: 'console-error',
                path: '/<team>/channels/town-square',
                evidence: 'console.error: sample',
                count: 1,
                first_action: 2,
            };
            fs.writeFileSync(path.join(synthetic, 'T1.run1.jsonl'), `${JSON.stringify(line)}\n`);
            fs.writeFileSync(path.join(synthetic, 'T1.run2.jsonl'), '');
            const out = newDir('explore');
            const over = pilot([
                'run',
                '--target',
                'main',
                '--feature',
                FEATURE,
                '--dry-run',
                '--mode',
                'explore',
                '--agents=stub:triage-overconfirm',
                '--out',
                out,
                '--oracle-results',
                synthetic,
                '--to',
                '3',
            ]);
            const group = readStage(out, '3-triage', 'repro.json').groups[0];
            assert(group.attempts === 2 && group.reproduced === 1, `repro counts ${JSON.stringify(group)}`);
            assert(
                over.status === EXIT.FAIL &&
                    readStage(out, '3-triage', 'agent-result.errors.json')
                        .errors.join(' ')
                        .includes('confirmed needs 2'),
                `over-confirmation must be rejected (exit ${over.status})`,
            );
        },
    );

    await check('promote is a dry run: no git, no push, no PR; --open-pr is not implemented', () => {
        const source = fs.readFileSync(path.join(ORCH_DIR, 'lib/stages/stage8_promote.mjs'), 'utf8');
        assert(
            !/child_process|spawn|exec\(|execSync|['"]git['"]|gh pr|origin\//i.test(source.replace(/^\/\/.*$/gm, '')),
            'stage 8 must not run commands',
        );
        const r = pilot(['run', '--target', 'main', '--feature', FEATURE, '--dry-run', '--open-pr']);
        assert(r.status === EXIT.USAGE, `--open-pr must be rejected, got ${r.status}`);
        const live = pilot([
            'run',
            '--target',
            'main',
            '--feature',
            FEATURE,
            '--live',
            '--agents=stub',
            '--out',
            newDir('live'),
        ]);
        assert(live.status === EXIT.USAGE, `the stub agent must be refused in a live run, got ${live.status}`);
    });

    await check('stage records append to a bakeoff result set through the metrics.mjs shape', () => {
        const out = newDir('metrics');
        const resultFile = path.join(WORK, 'result-B.json');
        const head = spawnSync('git', ['rev-parse', 'HEAD'], {cwd: REPO_ROOT, encoding: 'utf8'}).stdout.trim();
        const init = spawnSync(
            'node',
            [
                path.join(REPO_ROOT, 'explorer-proto/v2/bakeoff/result_set.mjs'),
                'init',
                '--label',
                'B',
                '--target',
                path.join(REPO_ROOT, 'explorer-proto/v2/targets/main.json'),
                '--out',
                resultFile,
                '--commit',
                head,
            ],
            {encoding: 'utf8'},
        );
        assert(init.status === 0, `result_set init failed: ${init.stderr}`);
        const r = run(out, ['--agents=stub', '--to', '0', '--result', resultFile]);
        assert(r.status === 0, `exit ${r.status}\n${r.stderr}`);
        const set = readJson(resultFile);
        assert(set.cost.stages.length === 1 && set.cost.stages[0].stage === '0-target', 'one cost stage record');
        assert(validate('bakeoff-result', set).ok, 'result set still valid');
    });

    await unitChecks({check, assert, WORK, newDir, envWithoutLicence, FEATURE});
}

await main();
const failed = results.filter((r) => !r.ok);
process.stdout.write(
    `\n${results.length - failed.length}/${results.length} checks passed${failed.length ? `, FAILED: ${failed.map((f) => f.name).join('; ')}` : ''}\n`,
);
if (KEEP) {
    process.stdout.write(`kept ${WORK}\n`);
} else {
    fs.rmSync(WORK, {recursive: true, force: true});
}
process.exitCode = failed.length ? 1 : 0;
