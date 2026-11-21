#!/usr/bin/env node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @stylistic/wrap-regex, @stylistic/dot-location, @stylistic/multiline-ternary, @stylistic/operator-linebreak, no-await-in-loop -- Prettier owns formatting and the repo relaxes these rules for .ts/.js only; awaits in loops run in order by design */

// Self-test of the portability layer. No network, no Docker, no vendor tool. Exit 0 only if every check passes.
//   node explorer-proto/v2/agents/selftest.mjs [--only a,b,c]
// a  every role file has the required sections          d  MCP server over pipes
// b  lessons.json validates and the guard passes        e  no licence-like string, no vendor-specific flag
// c  cmd-wrapper round trip and refusals                f  documents: every cited repo path exists
import fs from 'node:fs';
import path from 'node:path';

import {AGENTS_DIR, loadRoleIndex, ORCH_DIR, readJsonFile, REPO_ROOT, ROLES_DIR} from './lib/common.mjs';
import {licenceLikeRules} from './lib/result_check.mjs';
import {assert, CheckFailure, runNode, tempDir} from './lib/testing.mjs';
import {selftestChecks as mcpChecks} from './mcp/server.selftest.mjs';
import {selftestChecks as wrapperChecks} from './providers/cmd-wrapper.selftest.mjs';

import {createValidators} from '../schemas/validator.mjs';

const GUARD = path.join(REPO_ROOT, 'explorer-proto/v2/gates/lessons_guard.mjs');
const EXPECTED_ROLES = [
    'coverage-reviewer',
    'engine-owner',
    'independent-verifier',
    'infra-owner',
    'journey-selector',
    'lessons-proposer',
    'qa-lead',
    'triage',
];

// Vendor flags and bare vendor invocations that must not appear anywhere in this directory. Built from parts so this
// file does not match its own scan; the categories are permission modes, tool allow-lists, output and input formats,
// sandbox and approval modes, model selection, auto-approval and print or exec style invocations.
const part = (...pieces) => pieces.join('');
const DASH = '--';
const VENDOR_FLAG_PARTS = [
    'dangerously-[a-z-]+',
    'allowed-?[tT]ools',
    'disallowed-?[tT]ools',
    'permission-mode',
    'output-format',
    'input-format',
    'full-auto',
    'yolo',
    'approval-mode',
    'ask-for-approval',
    'sandbox',
    'print',
    'model',
    'trust',
    'auto-approve',
    'max-turns',
    'mcp-config',
    'append-system-prompt',
];
const VENDOR_FLAGS = new RegExp(`${DASH}(?:${VENDOR_FLAG_PARTS.join('|')})(?![A-Za-z-])`);
const VENDOR_BINARIES = new RegExp(
    `\\b(?:${[part('clau', 'de'), part('co', 'dex'), part('cursor-', 'agent')].join('|')})\\s+(?:-|exec\\b|run\\b|chat\\b)`,
);
const SESSION_MATERIAL = new RegExp(
    `${[part('MMAUTH', 'TOKEN'), part('MMC', 'SRF')].join('|')}|\\b${part('Bear', 'er')}\\s+\\S`,
);
const FLAG_AFTER_CLI_PLACEHOLDER = /<[A-Z_]+_CLI>\s+-/;
const ALLOWED_PROVIDER_FLAGS = new Set([
    '--agents',
    '--dry-run',
    '--feature',
    '--inline-limit',
    '--out',
    '--print-prompt',
    '--resume',
    '--result',
    '--stub',
    '--target',
    '--task',
    '--timeout-seconds',
]);

// Paths that documents may name before they exist (written later by their owners, or run output).
const PENDING_PATHS = new Set([
    'explorer-proto/v2/bakeoff/inputs/',
    'explorer-proto/v2/bakeoff/FREEZE.json',
    'explorer-proto/v2/bakeoff/rules.json',
    'explorer-proto/infra/.run/',
    'explorer-proto/v2/orchestrator/.runs',
]);

function filesUnder(dir) {
    return fs.readdirSync(dir, {withFileTypes: true}).flatMap((e) => {
        const full = path.join(dir, e.name);
        return e.isDirectory() ? filesUnder(full) : [full];
    });
}

function section(text, title) {
    const m = new RegExp(`^## ${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm').exec(text);
    if (!m) {
        return null;
    }
    const rest = text.slice(m.index + m[0].length);
    const next = /^## /m.exec(rest);
    return (next ? rest.slice(0, next.index) : rest).trim();
}

function bullets(body) {
    return body.split('\n').filter((l) => /^- /.test(l));
}

function repoPathsIn(text) {
    const found = new Set();
    for (const m of text.matchAll(/`([^`\s]+)`/g)) {
        const token = m[1].replace(/:[0-9]+(?:-[0-9]+)?$/, '').replace(/[,.;]+$/, '');
        if (/^(?:explorer-proto|e2e-tests)\/[A-Za-z0-9_.@+/-]+$/.test(token) && !token.includes('*')) {
            found.add(token);
        }
    }
    return [...found];
}

function checkRoles() {
    const index = loadRoleIndex();
    const ids = index.roles.map((r) => r.id).sort();
    assert(JSON.stringify(ids) === JSON.stringify(EXPECTED_ROLES), `roles in the index: ${ids.join(', ')}`);
    const onDisk = fs
        .readdirSync(ROLES_DIR)
        .filter((f) => f.endsWith('.md'))
        .sort();
    assert(
        JSON.stringify(onDisk) === JSON.stringify(index.roles.map((r) => r.file).sort()),
        'every roles/*.md is in the index and every indexed file exists',
    );
    for (const role of index.roles) {
        const text = fs.readFileSync(path.join(ROLES_DIR, role.file), 'utf8');
        assert(text.startsWith(`# Role: ${role.id}\n`), `${role.id}: the title must be "# Role: ${role.id}"`);
        const order = index.sections.map((s) => text.indexOf(`\n## ${s}\n`));
        assert(
            order.every((i) => i >= 0),
            `${role.id}: a required section is missing`,
        );
        assert(
            order.every((v, i) => i === 0 || v > order[i - 1]),
            `${role.id}: sections out of order`,
        );
        for (const s of index.sections) {
            assert((section(text, s) ?? '').length > 40, `${role.id}: section "${s}" is empty`);
        }
        const checklist = (section(text, 'Checklist').match(/^- \[ \] /gm) ?? []).length;
        assert(checklist >= 8, `${role.id}: the checklist has ${checklist} items, expected at least 8`);
        const failures = bullets(section(text, 'Failure modes seen in earlier pilots'));
        assert(failures.length >= 4, `${role.id}: needs at least 4 failure modes, has ${failures.length}`);
        assert(
            failures.every((b) => repoPathsIn(b).length > 0),
            `${role.id}: every failure mode must cite a repository path`,
        );
        assert(bullets(section(text, 'What you must NOT see')).length >= 2, `${role.id}: NOT-see list too short`);
        assert(bullets(section(text, 'Forbidden actions')).length >= 4, `${role.id}: forbidden actions too short`);
        assert(
            role.deny_input_globs.length > 0 || role.id === 'infra-owner',
            `${role.id}: the machine-readable deny list is empty`,
        );
    }
    const sealed = index.roles.filter((r) => r.holds_sealed_route).map((r) => r.id);
    assert(JSON.stringify(sealed) === '["independent-verifier"]', 'only the independent verifier holds a sealed route');
    const covered = new Set(index.roles.flatMap((r) => r.task_roles));
    const used = new Set();
    for (const f of filesUnder(path.join(ORCH_DIR, 'lib', 'stages'))) {
        for (const m of fs.readFileSync(f, 'utf8').matchAll(/role: '([a-z-]+)'/g)) {
            used.add(m[1]);
        }
    }
    assert(used.size >= 5, `expected 5 orchestrator roles, found ${[...used].join(', ')}`);
    for (const r of used) {
        assert(covered.has(r), `the orchestrator role "${r}" has no role file`);
    }
}

async function checkLessons() {
    const lessons = readJsonFile(path.join(AGENTS_DIR, 'lessons', 'lessons.json'));
    assert(Array.isArray(lessons) && lessons.length >= 12, 'lessons.json must be an array of at least 12 lessons');
    const validate = createValidators().get('lesson');
    const doc = fs.readFileSync(path.join(AGENTS_DIR, 'lessons', 'LESSONS.md'), 'utf8');
    const seen = new Set();
    const dir = tempDir('pilot-agents-lessons');
    try {
        const files = [];
        for (const lesson of lessons) {
            assert(validate(lesson), `${lesson.id}: schema invalid: ${JSON.stringify(validate.errors?.[0]?.message)}`);
            assert(lesson.status === 'proposed' && lesson.applied === false, `${lesson.id}: must be proposed`);
            assert(!('approver' in lesson), `${lesson.id}: approver must be empty`);
            assert(!seen.has(lesson.id), `${lesson.id}: duplicate id`);
            seen.add(lesson.id);
            assert(doc.includes(`\`${lesson.id}\``), `${lesson.id}: not described in LESSONS.md`);
            for (const e of lesson.evidence) {
                const file = e.ref.replace(/[#:].*$/, '');
                assert(fs.existsSync(path.join(REPO_ROOT, file)), `${lesson.id}: evidence ${file} does not exist`);
            }
            const target = lesson.proposed_check.target_file;
            assert(!target || fs.existsSync(path.join(REPO_ROOT, target)), `${lesson.id}: target ${target} missing`);
            const file = path.join(dir, `${lesson.id}.json`);
            fs.writeFileSync(file, JSON.stringify(lesson));
            files.push(file);
        }
        const guard = await runNode([GUARD, ...files]);
        assert(
            guard.code === 0,
            `lessons_guard refused the lessons (exit ${guard.code}): ${guard.stdout.slice(0, 300)}`,
        );
        assert(JSON.parse(guard.stdout).status === 'pass', 'lessons_guard status is not pass');

        const protectedCopy = {...lessons[0], proposed_check: {...lessons[0].proposed_check, kind: 'lint_rule'}};
        const protectedFile = path.join(dir, 'protected.json');
        fs.writeFileSync(protectedFile, JSON.stringify(protectedCopy));
        const refused = await runNode([GUARD, protectedFile]);
        assert(refused.code === 1, 'the guard must refuse a proposed lint_rule lesson (it needs a human approver)');
        const withApprover = path.join(dir, 'approver.json');
        fs.writeFileSync(withApprover, JSON.stringify({...lessons[0], approver: 'someone'}));
        assert((await runNode([GUARD, withApprover])).code === 1, 'a proposed lesson with an approver is invalid');
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
}

function checkForbiddenStrings() {
    const files = filesUnder(AGENTS_DIR);
    assert(files.length >= 25, `expected at least 25 files, found ${files.length}`);
    for (const file of files) {
        const rel = path.relative(AGENTS_DIR, file);
        const text = fs.readFileSync(file, 'utf8');
        const licence = licenceLikeRules(text);
        assert(licence.length === 0, `${rel}: licence-like text (${licence.join(', ')})`);
        assert(!SESSION_MATERIAL.test(text), `${rel}: session material`);
        assert(!VENDOR_FLAGS.test(text), `${rel}: a vendor-specific flag`);
        assert(!VENDOR_BINARIES.test(text), `${rel}: a bare vendor invocation`);
        assert(!FLAG_AFTER_CLI_PLACEHOLDER.test(text), `${rel}: a flag written after a CLI placeholder`);
        if (rel.startsWith('providers') && rel.endsWith('.md')) {
            for (const m of text.matchAll(/(?<![A-Za-z0-9-])(--[a-z][a-z-]*)/g)) {
                assert(ALLOWED_PROVIDER_FLAGS.has(m[1]), `${rel}: flag ${m[1]} is not one of the documented ones`);
            }
        }
    }
    const providerDocs = ['claude-code.md', 'codex.md', 'cursor.md'].map((f) =>
        fs.readFileSync(path.join(AGENTS_DIR, 'providers', f), 'utf8'),
    );
    for (const doc of providerDocs) {
        assert(doc.includes('<NON_INTERACTIVE_FLAGS>'), 'a provider page lacks the <NON_INTERACTIVE_FLAGS> slot');
        assert(/Check the current CLI documentation/i.test(doc), 'a provider page lacks the documentation note');
    }
}

function checkDocuments() {
    const contract = fs.readFileSync(path.join(AGENTS_DIR, 'CONTRACT.md'), 'utf8');
    const topics = [
        'MM_LICENSE',
        'docker compose config',
        'docker exec ... env',
        'Stop conditions',
        'Human approval points',
        'exact digest',
        'advisory',
        'blocked',
        'screenshots',
        'Never complete a path the runner could not discover',
    ];
    for (const topic of topics) {
        assert(contract.toLowerCase().includes(topic.toLowerCase()), `CONTRACT.md lacks "${topic}"`);
    }
    assert(contract.split('\n').length <= 90, 'CONTRACT.md must stay about one page (at most 90 lines)');
    const docs = filesUnder(AGENTS_DIR).filter((f) => f.endsWith('.md'));
    for (const file of docs) {
        for (const p of repoPathsIn(fs.readFileSync(file, 'utf8'))) {
            if (PENDING_PATHS.has(p) || PENDING_PATHS.has(`${p}/`)) {
                continue;
            }
            assert(fs.existsSync(path.join(REPO_ROOT, p)), `${path.relative(AGENTS_DIR, file)}: ${p} does not exist`);
        }
    }
}

async function main() {
    const only = process.argv.includes('--only')
        ? new Set(process.argv[process.argv.indexOf('--only') + 1].split(','))
        : null;
    const wrapper = wrapperChecks();
    const mcp = mcpChecks();
    const groups = [
        {id: 'a', name: 'every role file has the required sections', checks: [{id: 'a', run: checkRoles}]},
        {id: 'b', name: 'lessons.json validates and lessons_guard passes', checks: [{id: 'b', run: checkLessons}]},
        {id: 'c', name: 'cmd-wrapper round trip and refusals', checks: wrapper.checks},
        {id: 'd', name: 'MCP server over pipes', checks: mcp.checks},
        {
            id: 'e',
            name: 'no licence-like string, no vendor-specific flag',
            checks: [{id: 'e', run: checkForbiddenStrings}],
        },
        {id: 'f', name: 'contract topics and cited paths exist', checks: [{id: 'f', run: checkDocuments}]},
    ];
    let failed = 0;
    let total = 0;
    const groupResult = [];
    for (const group of groups) {
        if (only && !only.has(group.id)) {
            continue;
        }
        let groupFailed = 0;
        for (const check of group.checks) {
            total++;
            const label = check.name ? `${check.id} ${check.name}` : `${group.id} ${group.name}`;
            try {
                await check.run();
                process.stdout.write(`PASS ${label}\n`);
            } catch (e) {
                failed++;
                groupFailed++;
                const detail = e instanceof CheckFailure ? e.message : `${e.constructor.name}: ${e.message}`;
                process.stdout.write(`FAIL ${label}\n     ${detail}\n`);
            }
        }
        groupResult.push(`${group.id}:${groupFailed === 0 ? 'PASS' : 'FAIL'}`);
    }
    wrapper.cleanup();
    await mcp.cleanup();
    process.stdout.write(`\ngroups ${groupResult.join(' ')}\n`);
    process.stdout.write(
        failed === 0 ? `SELFTEST: PASS (${total} checks)\n` : `SELFTEST: FAIL (${failed} of ${total})\n`,
    );
    return failed === 0 ? 0 : 1;
}

main().then(
    (code) => {
        process.exitCode = code;
    },
    (e) => {
        process.stderr.write(`selftest crashed: ${e.stack}\n`);
        process.exitCode = 1;
    },
);
