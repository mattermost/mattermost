#!/usr/bin/env node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Offline structural lint of .github/workflows/e2e-tests-exploratory.yml, parsed with the `yaml` package already in
// e2e-tests/playwright/node_modules (nothing is installed). Exit 0 pass, 1 findings, 3 parser unavailable.
//   lint_workflow.mjs [--secrets-map] [workflow file]
// Checks: trigger, inputs, permissions, concurrency, runner, timeout, no continue-on-error, every `uses:` pinned to a
// commit that other repo workflows also use, which secrets reach which step, no secret in a run line or an action
// input, no echo or trace of a credential, thin run steps, always() on the publishing steps, and the e2e-tests-*.yml
// glob assumptions of .github/scripts/test_e2e_status_workflows.py.
import fs from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';

import {EXIT, isMain, parseArgs, REPO_ROOT} from './lib.mjs';

const WORKFLOW = '.github/workflows/e2e-tests-exploratory.yml';
const SECRET_STEPS = {
    'ci/stack-gate': {secret: 'MM_E2E_TEST_LICENSE_ONPREM_ENT', env: 'MM_LICENSE'},
    'ci/coordinator': {secret: 'MM_E2E_TEST_LICENSE_ONPREM_ENT', env: 'MM_LICENSE'},
    'ci/leak-scan': {secret: 'MM_E2E_TEST_LICENSE_ONPREM_ENT', env: 'MM_LICENSE'},
};
const TOKEN_STEPS = {'ci/verify-target': {env: 'GITHUB_TOKEN'}};
const ALWAYS_STEPS = ['ci/teardown', 'ci/export', 'ci/leak-scan', 'ci/upload-export', 'ci/final-summary'];
const RUN_FORBIDDEN = [
    [/\bset\s+-[a-zA-Z]*x/, 'set -x'],
    [/\bbash\s+-[a-zA-Z]*x/, 'bash -x'],
    [/\b(echo|printf)\b[^\n]*(MM_LICENSE|secrets\.)/, 'echo of a secret'],
    [/\bprintenv\b/, 'printenv'],
    [/\benv\s*\|/, 'env piped'],
    [/docker\s+compose\s+config/, 'docker compose config'],
    [/docker\s+inspect/, 'docker inspect'],
    [/\$\{\{/, 'an expression inside a run line'],
];
const SCRIPT_FORBIDDEN = [
    [/(^|\n)\s*set\s+-[a-zA-Z]*x\b/, 'set -x'],
    [/\bbash\s+-[a-zA-Z]*x\b/, 'bash -x'],
    [/\bprintenv\b/, 'printenv'],
    [/docker\s+compose\s+config/, 'docker compose config'],
    [/(echo|printf|console\.log|stdout\.write|stderr\.write)[^\n]*MM_LICENSE/, 'printing MM_LICENSE'],
];

function loadYaml() {
    try {
        return createRequire(path.join(REPO_ROOT, 'e2e-tests/playwright/package.json'))('yaml');
    } catch {
        return null;
    }
}

function expressions(value) {
    return [...String(JSON.stringify(value ?? '')).matchAll(/\b(secrets\.[A-Za-z0-9_]+|github\.token)\b/g)].map(
        (m) => m[1],
    );
}

function otherWorkflowPins(root) {
    const pins = new Map();
    const files = [];
    for (const dir of ['.github/workflows', '.github/actions']) {
        const walk = (current) => {
            for (const entry of fs.readdirSync(current, {withFileTypes: true})) {
                const full = path.join(current, entry.name);
                if (entry.isDirectory()) {
                    walk(full);
                } else if (/\.ya?ml$/.test(entry.name) && !full.endsWith('e2e-tests-exploratory.yml')) {
                    files.push(full);
                }
            }
        };
        walk(path.join(root, dir));
    }
    for (const file of files) {
        for (const m of fs.readFileSync(file, 'utf8').matchAll(/uses:\s*([\w.-]+\/[\w./-]+)@([0-9a-f]{40})/g)) {
            pins.set(`${m[1]}@${m[2]}`, (pins.get(`${m[1]}@${m[2]}`) ?? 0) + 1);
        }
    }
    return pins;
}

export function lintWorkflow({text, root = REPO_ROOT, yamlLib}) {
    const errors = [];
    const secretsMap = [];
    const fail = (message) => errors.push(message);

    const doc = yamlLib.parseDocument(text, {uniqueKeys: true});
    for (const error of doc.errors) {
        fail(`YAML: ${error.message.split('\n')[0]}`);
    }
    if (doc.errors.length > 0) {
        return {errors, secretsMap};
    }
    const wf = doc.toJS();

    if (typeof wf.name !== 'string' || !wf.name.startsWith('E2E Tests (')) {
        fail('name must follow the "E2E Tests (...)" convention');
    }
    if (JSON.stringify(Object.keys(wf.on ?? {})) !== '["workflow_dispatch"]') {
        fail('the only trigger must be workflow_dispatch');
    }
    const inputs = wf.on?.workflow_dispatch?.inputs ?? {};
    const expectInput = (name, type, extra = {}) => {
        const input = inputs[name];
        if (!input || input.type !== type) {
            fail(`input ${name} must exist with type ${type}`);
            return;
        }
        for (const [key, value] of Object.entries(extra)) {
            if (JSON.stringify(input[key]) !== JSON.stringify(value)) {
                fail(`input ${name}.${key} must be ${JSON.stringify(value)}`);
            }
        }
    };
    expectInput('target_kind', 'choice', {required: true, options: ['main', 'release']});
    expectInput('image', 'string', {required: true});
    expectInput('commit_sha', 'string', {required: true});
    expectInput('test_source_ref', 'string', {required: false});
    expectInput('session', 'choice', {default: 'bookmarks', options: ['bookmarks']});
    expectInput('control', 'string', {default: 'release-bookmark-title-changed'});
    expectInput('verifier', 'choice', {default: 'process', options: ['process']});
    expectInput('time_budget_minutes', 'number', {default: 45});
    if (Object.keys(inputs).length !== 8) {
        fail('the workflow must have exactly the eight specified inputs');
    }

    if (JSON.stringify(wf.permissions) !== '{}') {
        fail('workflow permissions must be {}');
    }
    const group = String(wf.concurrency?.group ?? '');
    if (
        !group.includes('inputs.image') ||
        !group.includes('inputs.session') ||
        wf.concurrency?.['cancel-in-progress'] !== false
    ) {
        fail('concurrency must group by inputs.image and inputs.session with cancel-in-progress false');
    }
    if (wf.env && expressions(wf.env).length > 0) {
        fail('no secret may be mapped at workflow level');
    }

    const raw = text.split('\n');
    const pins = otherWorkflowPins(root);
    const allSteps = [];
    for (const [jobId, job] of Object.entries(wf.jobs ?? {})) {
        if (job['runs-on'] !== 'ubuntu-24.04') {
            fail(`${jobId}: runs-on must be ubuntu-24.04`);
        }
        if (!String(job['timeout-minutes'] ?? '').includes('inputs.time_budget_minutes')) {
            fail(`${jobId}: timeout-minutes must be the time budget input`);
        }
        if (JSON.stringify(job.permissions) !== '{"contents":"read"}') {
            fail(`${jobId}: permissions must be exactly contents: read`);
        }
        if ('continue-on-error' in job) {
            fail(`${jobId}: continue-on-error must not be used on the job`);
        }
        if (job.env && expressions(job.env).length > 0) {
            fail(`${jobId}: no secret may be mapped at job level`);
        }
        if (!Array.isArray(job.steps)) {
            fail(`${jobId}: the job needs steps (test_e2e_status_workflows.py reads them)`);
            continue;
        }
        allSteps.push(...job.steps);
    }

    const names = new Set();
    for (const step of allSteps) {
        const name = step.name ?? '(unnamed)';
        if (!/^ci\/[a-z0-9-]+$/.test(name) || names.has(name)) {
            fail(`step ${name}: names must be unique and look like ci/<name>`);
        }
        names.add(name);
        if ('continue-on-error' in step) {
            fail(`step ${name}: continue-on-error must not be used`);
        }

        if (step.uses) {
            if (step.uses.startsWith('./')) {
                if (!fs.existsSync(path.join(root, step.uses, 'action.yml'))) {
                    fail(`step ${name}: local action ${step.uses} does not exist`);
                }
            } else {
                const line = raw.find((l) => l.includes(`uses: ${step.uses}`)) ?? '';
                if (!/^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/.test(step.uses) || !/@[0-9a-f]{40}\s+#\s*v\d/.test(line)) {
                    fail(`step ${name}: ${step.uses} must be pinned to a full SHA with a version comment`);
                } else if (!pins.has(step.uses)) {
                    fail(`step ${name}: ${step.uses} is not a pin the repo's other workflows use`);
                }
            }
        }

        const refs = new Set([
            ...expressions(step.env),
            ...expressions(step.with),
            ...expressions(step.run),
            ...expressions(step.if),
        ]);
        const inRun = expressions(step.run);
        const inWith = expressions(step.with);
        if (inRun.length > 0 || inWith.length > 0) {
            fail(`step ${name}: a secret or token reaches a run line or an action input directly`);
        }
        for (const ref of refs) {
            const rule = ref === 'github.token' ? TOKEN_STEPS[name] : SECRET_STEPS[name];
            const matches = ref === 'github.token' || (rule && ref === `secrets.${rule.secret}`);
            const target = Object.entries(step.env ?? {}).find(([, value]) => String(value).includes(ref))?.[0] ?? null;
            if (!rule || !matches || target !== rule.env) {
                fail(`step ${name}: ${ref} is not allowed here (mapped to ${target ?? 'nothing'})`);
            }
        }
        if (refs.size > 0) {
            secretsMap.push({
                step: name,
                refs: [...refs],
                env: Object.fromEntries(
                    Object.entries(step.env ?? {})
                        .filter(([, v]) => /secrets\.|github\.token/.test(String(v)))
                        .map(([k, v]) => [k, String(v)]),
                ),
            });
        }

        if (step.run) {
            const body = String(step.run);
            const lines = body.split('\n').filter((l) => l.trim().length > 0);
            if (lines.length > 3 || !/explorer-proto\//.test(body)) {
                fail(`step ${name}: run steps must be thin calls to explorer-proto/ scripts`);
            }
            for (const [pattern, label] of RUN_FORBIDDEN) {
                if (pattern.test(body)) {
                    fail(`step ${name}: run line has ${label}`);
                }
            }
        }
    }
    for (const required of [...Object.keys(SECRET_STEPS), ...Object.keys(TOKEN_STEPS)]) {
        if (!names.has(required)) {
            fail(`step ${required} is missing`);
        }
    }
    for (const name of ALWAYS_STEPS) {
        const step = allSteps.find((s) => s.name === name);
        if (!step || !/\balways\(\)/.test(String(step.if ?? ''))) {
            fail(`step ${name} must run with always()`);
        }
    }
    const upload = allSteps.find((s) => s.name === 'ci/upload-export');
    if (
        upload &&
        (upload.with?.['retention-days'] !== 14 ||
            !/export$/.test(String(upload.with?.path ?? '')) ||
            /\*/.test(String(upload.with?.path ?? '')))
    ) {
        fail('ci/upload-export must upload only the export directory with retention-days 14');
    }
    for (const step of allSteps) {
        if (
            'triage-lanes' in (step.with ?? {}) ||
            'triage-status-context' in (step.with ?? {}) ||
            String(step.uses ?? '').includes('e2e-status-lanes')
        ) {
            fail('the workflow must not use the status-lane inputs that test_e2e_status_workflows.py audits');
        }
    }
    return {errors, secretsMap};
}

export function lintScripts(dir) {
    const errors = [];
    for (const file of fs.readdirSync(dir)) {
        if (!/\.(sh|mjs)$/.test(file) || ['selftest.mjs', 'lint_workflow.mjs'].includes(file)) {
            continue;
        }
        const text = fs.readFileSync(path.join(dir, file), 'utf8');
        for (const [pattern, label] of SCRIPT_FORBIDDEN) {
            if (pattern.test(text)) {
                errors.push(`${file}: ${label}`);
            }
        }
    }
    return errors;
}

function main() {
    const {flags, positional} = parseArgs(process.argv.slice(2));
    const yamlLib = loadYaml();
    if (!yamlLib) {
        process.stdout.write(
            'lint: BLOCKED (the yaml package is not installed in e2e-tests/playwright/node_modules)\n',
        );
        return EXIT.BLOCKED;
    }
    const file = path.resolve(positional[0] || path.join(REPO_ROOT, WORKFLOW));
    const {errors, secretsMap} = lintWorkflow({text: fs.readFileSync(file, 'utf8'), yamlLib});
    errors.push(...lintScripts(path.dirname(new URL(import.meta.url).pathname)));
    if (flags['secrets-map']) {
        process.stdout.write('step -> secrets it receives (environment variable)\n');
        for (const entry of secretsMap) {
            process.stdout.write(
                `  ${entry.step}: ${Object.entries(entry.env)
                    .map(([k, v]) => `${k} <- ${v.replace(/\$\{\{\s*|\s*\}\}/g, '')}`)
                    .join(', ')}\n`,
            );
        }
        process.stdout.write(
            `  every other step: none (${secretsMap.length} of the steps receive a secret or token)\n`,
        );
    }
    for (const error of errors) {
        process.stdout.write(`lint: ${error}\n`);
    }
    process.stdout.write(`lint: ${errors.length === 0 ? 'PASS' : `FAIL (${errors.length})`}\n`);
    return errors.length === 0 ? EXIT.OK : EXIT.FAIL;
}

if (isMain(import.meta.url)) {
    process.exit(main());
}
