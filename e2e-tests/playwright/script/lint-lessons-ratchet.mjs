#!/usr/bin/env node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Enforces the lint-checkable "Lessons from master failures" (AGENTS.md) on the files a change
// touches, without a committed baseline. For every .ts file under e2e-tests/playwright that differs
// from the base (committed, staged, unstaged or untracked), it lints the file as it is now and as it
// was on the base, both with today's rules, and fails when any lesson rule fires more often now.
// Files nobody touches are never checked, so existing violations cost nothing until someone edits
// that file, and then the file may not get worse.
//
// Base: the merge base of HEAD and $LESSONS_BASE (default origin/master). CI sets LESSONS_BASE to
// the pull request's base commit.

import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {ESLint} from 'eslint';

import {LESSON_RULES, lessonsConfig} from '../eslint-rules/lessons.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE_REF = process.env.LESSONS_BASE || 'origin/master'; // eslint-disable-line no-process-env

function git(args) {
    return execFileSync('git', args, {
        cwd: ROOT,
        encoding: 'utf-8',
        maxBuffer: 64 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
    });
}

function resolveBase() {
    try {
        return git(['merge-base', BASE_REF, 'HEAD']).trim();
    } catch {
        throw new Error(
            `no merge base of ${BASE_REF} and HEAD. Run \`git fetch origin master\`, or set LESSONS_BASE to the commit to compare against.`,
        );
    }
}

// Files that differ from the base, with the path each had on the base (null when it is new).
function changedFiles(base) {
    const files = [];
    const diff = git(['diff', '--name-status', '-M', '--relative', base, '--', '.']);
    for (const line of diff.split('\n').filter(Boolean)) {
        const [status, first, second] = line.split('\t');
        if (status.startsWith('R')) {
            files.push({file: second, baseFile: first});
        } else if (!status.startsWith('D')) {
            files.push({file: first, baseFile: status.startsWith('A') ? null : first});
        }
    }
    const untracked = git(['ls-files', '--others', '--exclude-standard', '--', '.']);
    for (const file of untracked.split('\n').filter(Boolean)) {
        files.push({file, baseFile: null});
    }
    return files.filter(({file}) => file.endsWith('.ts'));
}

function countByRule(messages) {
    const counts = {};
    for (const {ruleId} of messages) {
        if (LESSON_RULES.includes(ruleId)) {
            counts[ruleId] = (counts[ruleId] || 0) + 1;
        }
    }
    return counts;
}

async function lintBase(eslint, base, {file, baseFile}) {
    if (!baseFile) {
        return {};
    }

    // Lint the base text as if it lived at today's path, so the same rules apply to both.
    const text = git(['show', `${base}:./${baseFile}`]);
    const [result] = await eslint.lintText(text, {filePath: path.join(ROOT, file)});
    return countByRule(result.messages);
}

function describeFailure(file, rule, before, now) {
    const hits = now.messages.filter(({ruleId}) => ruleId === rule);
    const lines = hits.map(({line, column, message}) => `    ${line}:${column}  ${message}`);
    return `${file}: ${rule} went from ${before} to ${hits.length}\n${lines.join('\n')}`;
}

async function main() {
    const base = resolveBase();
    const eslint = new ESLint({cwd: ROOT, overrideConfig: lessonsConfig});

    const candidates = changedFiles(base);
    const ignored = await Promise.all(candidates.map(({file}) => eslint.isPathIgnored(path.join(ROOT, file))));
    const files = candidates.filter((_, i) => !ignored[i]);

    const nowResults = files.length ? await eslint.lintFiles(files.map(({file}) => path.join(ROOT, file))) : [];
    const nowByPath = new Map(nowResults.map((result) => [result.filePath, result]));
    const baseCounts = await Promise.all(files.map((entry) => lintBase(eslint, base, entry)));

    const failures = [];
    let improved = 0;
    files.forEach((entry, i) => {
        const now = nowByPath.get(path.join(ROOT, entry.file));
        const nowCounts = countByRule(now.messages);
        for (const rule of LESSON_RULES) {
            const before = baseCounts[i][rule] || 0;
            const after = nowCounts[rule] || 0;
            if (after > before) {
                failures.push(describeFailure(entry.file, rule, before, now));
            } else if (after < before) {
                improved++;
            }
        }
    });

    const shortBase = base.slice(0, 7);
    if (failures.length) {
        process.stderr.write(
            `lint:lessons: these files break a lesson more often than on ${shortBase}. Each list shows every hit of ` +
                'that rule in the file; the new ones are among them. See "Lessons from master failures" in AGENTS.md.\n\n' +
                `${failures.join('\n\n')}\n`,
        );
        process.exitCode = 1;
        return;
    }
    const improvedNote = improved ? `, ${improved} rule count(s) went down` : '';
    process.stdout.write(
        `lint:lessons: ${files.length} changed file(s) checked against ${shortBase}; none got worse${improvedNote}.\n`,
    );
}

try {
    await main();
} catch (error) {
    process.stderr.write(`lint:lessons: ${error.message}\n`);
    process.exitCode = 2;
}
