// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @stylistic/wrap-regex, no-await-in-loop, @stylistic/dot-location -- Prettier owns formatting and the repo relaxes these rules for .ts/.js only; awaits in loops run in order by design */

// Self-test of cmd-wrapper.mjs against a real pending task from the orchestrator dry run. No vendor tool: the agent
// is fake-agent.mjs. No network, no Docker.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {globToRegExp, loadRoleIndex, readJsonFile, REPO_ROOT} from '../lib/common.mjs';
import {loadTask, sha256File} from '../lib/result_check.mjs';
import {assert, makePendingRun, pilot, removeDir, runNode, tempDir} from '../lib/testing.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WRAPPER = path.join(HERE, 'cmd-wrapper.mjs');
const FAKE = path.join(HERE, 'fake-agent.mjs');

const REFUSALS = [
    {mode: 'route-field', expect: 'forbidden field name'},
    {mode: 'approver', expect: 'forbidden field (approval'},
    {mode: 'origin', expect: 'unsafe text'},
    {mode: 'licence', expect: 'licence-like text'},
    {mode: 'wrong-task-id', expect: 'does not match the task'},
];

function wrap(run, extra, env = {}) {
    return runNode([WRAPPER, '--task', run.taskFile, '--result', run.resultFile, ...extra], {env});
}

function variantTask(run, name, mutate) {
    const task = JSON.parse(fs.readFileSync(run.taskFile, 'utf8'));
    mutate(task);
    task.output.result_file = `4-select/agent-result.${name}.json`;
    const dir = path.dirname(run.taskFile);
    const file = path.join(dir, `agent-task.${name}.json`);
    fs.writeFileSync(file, JSON.stringify(task));
    return {file, result: path.join(dir, `agent-result.${name}.json`), dir};
}

function viaFake(run, mode) {
    return wrap(run, ['--', process.execPath, FAKE], {FAKE_AGENT_MODE: mode});
}

export function selftestChecks() {
    const scratch = [];
    let pendingRun;
    const pending = async () => {
        if (!pendingRun) {
            pendingRun = await makePendingRun();
            scratch.push(path.dirname(pendingRun.out));
        }
        fs.rmSync(pendingRun.resultFile, {force: true});
        return pendingRun;
    };

    return {
        cleanup: () => scratch.forEach(removeDir),
        checks: [
            {
                id: 'c1',
                name: 'stub mode writes a result the orchestrator accepts on resume',
                run: async () => {
                    const run = await pending();
                    const wrote = await wrap(run, ['--stub']);
                    assert(wrote.code === 0, `--stub should exit 0, got ${wrote.code}: ${wrote.stderr}`);
                    const task = loadTask(run.taskFile);
                    const result = readJsonFile(run.resultFile);
                    assert(result.task_id === task.task_id, 'the stub result must echo the task_id');
                    const resumed = await pilot(['run', '--resume', '--out', run.out]);
                    assert(
                        resumed.code === 20 && /duplicate-reviewer/.test(resumed.stdout),
                        `resume should accept the result and stop at the next task (exit 20), got ${resumed.code}`,
                    );
                    assert(!fs.existsSync(path.join(run.out, '4-select', 'agent-result.rejected.json')), 'rejected');
                },
            },
            {
                id: 'c2',
                name: 'a command printing a valid result (plain or fenced) is validated and written',
                run: async () => {
                    for (const mode of ['ok', 'fenced']) {
                        const run = await pending();
                        const done = await viaFake(run, mode);
                        assert(done.code === 0, `mode ${mode} should exit 0, got ${done.code}: ${done.stderr}`);
                        assert(fs.existsSync(run.resultFile), `mode ${mode} should write the result`);
                    }
                },
            },
            {
                id: 'c3',
                name: 'results with a forbidden field, unsafe text, licence-like text or a wrong task_id are refused',
                run: async () => {
                    for (const {mode, expect} of REFUSALS) {
                        const run = await pending();
                        const refused = await viaFake(run, mode);
                        assert(refused.code === 1, `mode ${mode} should exit 1, got ${refused.code}`);
                        assert(!fs.existsSync(run.resultFile), `mode ${mode} must not write a result file`);
                        assert(refused.stderr.includes(expect), `mode ${mode}: stderr should say "${expect}"`);
                        assert(
                            !/example\.invalid|eyJ[a-z]/.test(refused.stderr),
                            `mode ${mode}: the refusal must not echo the offending value`,
                        );
                    }
                },
            },
            {
                id: 'c4',
                name: 'a failing command or one that prints no JSON exits 3 and leaves no result',
                run: async () => {
                    for (const mode of ['fail', 'garbage']) {
                        const run = await pending();
                        const done = await viaFake(run, mode);
                        assert(done.code === 3, `mode ${mode} should exit 3, got ${done.code}`);
                        assert(!fs.existsSync(run.resultFile), `mode ${mode} must not write a result file`);
                    }
                },
            },
            {
                id: 'c5',
                name: 'usage errors, a foreign result path and a stale task are refused',
                run: async () => {
                    const run = await pending();
                    const noCommand = await wrap(run, []);
                    assert(noCommand.code === 2, `no command should exit 2, got ${noCommand.code}`);
                    const elsewhere = path.join(path.dirname(run.out), 'elsewhere.json');
                    const foreign = await runNode([WRAPPER, '--task', run.taskFile, '--result', elsewhere, '--stub']);
                    assert(foreign.code === 1 && !fs.existsSync(elsewhere), 'a foreign result path must be refused');
                    const stale = variantTask(run, 'stale', (task) => {
                        task.inputs[0].sha256 = '0'.repeat(64);
                    });
                    const staleRun = await runNode([WRAPPER, '--task', stale.file, '--result', stale.result, '--stub']);
                    assert(staleRun.code === 1 && /stale/.test(staleRun.stderr), 'a stale task must be refused');
                },
            },
            {
                id: 'c6',
                name: 'inputs a role must not see are refused before any command runs',
                run: async () => {
                    const run = await pending();
                    const denied = 'explorer-proto/sessions/auto-follow/QA-NOTES.md';
                    const variant = variantTask(run, 'denied', (task) => {
                        task.inputs.push({
                            base: 'repo',
                            path: denied,
                            sha256: sha256File(path.join(REPO_ROOT, denied)),
                        });
                    });
                    const marker = path.join(variant.dir, 'ran.txt');
                    const refused = await runNode([
                        WRAPPER,
                        '--task',
                        variant.file,
                        '--result',
                        variant.result,
                        '--',
                        process.execPath,
                        '-e',
                        `require('fs').writeFileSync(${JSON.stringify(marker)}, 'x')`,
                    ]);
                    assert(
                        refused.code === 1 && /must not see/.test(refused.stderr),
                        'the denied input must be refused',
                    );
                    assert(!fs.existsSync(marker), 'the command must not run when an input is denied');
                },
            },
            {
                id: 'c7',
                name: 'prompts build for every orchestrator role and name the role file',
                run: async () => {
                    const out = path.join(tempDir('pilot-agents-stub'), 'out');
                    scratch.push(path.dirname(out));
                    const full = await pilot([
                        'run',
                        '--target',
                        'main',
                        '--feature',
                        'channels.favorites',
                        '--dry-run',
                        '--agents=stub',
                        '--out',
                        out,
                    ]);
                    assert(full.code === 0, `the stub dry run should exit 0, got ${full.code}`);
                    const tasks = [];
                    for (const dir of fs.readdirSync(out).filter((d) => /^\d+-/.test(d))) {
                        for (const f of fs
                            .readdirSync(path.join(out, dir))
                            .filter((n) => /^agent-task.*\.json$/.test(n))) {
                            tasks.push(path.join(out, dir, f));
                        }
                    }
                    const roles = new Set();
                    for (const file of tasks) {
                        const task = readJsonFile(file);
                        const result = file.replace(/agent-task/, 'agent-result');
                        const printed = await runNode([WRAPPER, '--task', file, '--result', result, '--print-prompt']);
                        assert(printed.code === 0, `print-prompt failed for ${task.role}: ${printed.stderr}`);
                        const entry = loadRoleIndex().roles.find((r) => r.task_roles.includes(task.role));
                        assert(printed.stdout.includes(`## Role: ${entry.id}`), `${task.role}: role section missing`);
                        assert(printed.stdout.includes(task.task_id), `${task.role}: task id missing`);
                        roles.add(task.role);
                    }
                    assert(roles.size >= 4, `expected tasks for 4 roles, got ${[...roles].join(', ')}`);
                },
            },
            {
                id: 'c8',
                name: 'the full dry pipeline runs through the cmd: provider with the wrapper (template shape)',
                run: async () => {
                    const out = path.join(tempDir('pilot-agents-cmd'), 'out');
                    scratch.push(path.dirname(out));
                    const template = `cmd:node ${WRAPPER} --task {task} --result {result} -- node ${FAKE}`;
                    const args = ['run', '--target', 'main', '--feature', 'channels.favorites', '--dry-run'];
                    const full = await pilot([...args, `--agents=${template}`, '--out', out]);
                    assert(full.code === 0, `the cmd: dry run should exit 0, got ${full.code}: ${full.stdout}`);
                    const calls = fs
                        .readFileSync(path.join(out, 'agent-calls.jsonl'), 'utf8')
                        .trim()
                        .split('\n')
                        .map((l) => JSON.parse(l));
                    assert(
                        calls.length >= 4 && calls.every((c) => c.provider === 'cmd' && c.outcome === 'ok'),
                        'calls',
                    );

                    const bad = path.join(tempDir('pilot-agents-bad'), 'out');
                    scratch.push(path.dirname(bad));
                    const badTemplate = `cmd:node ${WRAPPER} --task {task} --result {result} -- node ${FAKE}`;
                    const refused = await pilot([...args, `--agents=${badTemplate}`, '--out', bad], {
                        env: {FAKE_AGENT_MODE: 'route-field'},
                    });
                    assert(
                        refused.code === 22,
                        `a tool that always produces a refused result should end in exit 22, got ${refused.code}`,
                    );
                    assert(
                        !fs.existsSync(path.join(bad, '4-select', 'agent-result.json')),
                        'no refused result may be left in the run directory',
                    );
                },
            },
            {
                id: 'c9',
                name: 'the {prompt_file} placeholder hands the prompt over as a temporary file',
                run: async () => {
                    const run = await pending();
                    const done = await wrap(run, ['--', process.execPath, FAKE, '{prompt_file}']);
                    assert(done.code === 0, `{prompt_file} form should exit 0, got ${done.code}: ${done.stderr}`);
                    assert(fs.existsSync(run.resultFile), 'the {prompt_file} form should write the result');
                },
            },
            {
                id: 'c10',
                name: 'role deny globs match what they should and nothing else',
                run: async () => {
                    const hits = (glob, p) => globToRegExp(glob).test(p);
                    assert(hits('**/QA-NOTES*', 'explorer-proto/sessions/x/QA-NOTES.md'), 'QA-NOTES at depth');
                    assert(hits('**/QA-NOTES*', 'QA-NOTES.md'), 'QA-NOTES at the root');
                    assert(hits('explorer-proto/sessions/**', 'explorer-proto/sessions/a/b.json'), 'sessions subtree');
                    assert(!hits('explorer-proto/sessions/**', 'explorer-proto/v2/sessions.json'), 'sessions only');
                    assert(!hits('**/.env', 'x/.environment'), '.env is exact');
                    assert(hits('**/*.png', 'a/b/c.png') && !hits('**/*.png', 'a/b/c.png.txt'), 'extension');
                },
            },
        ],
    };
}
