// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {execFileSync, spawnSync} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const PW_ROOT = resolve(HERE, '../..');
export const LEAN_ROOT = resolve(HERE, '..');
export const PETER_DIR = process.env.PETER_DIR ?? '/home/ubuntu/work/peter/e2e-tests/playwright';

/** Import a package by name as resolved from `baseDir` (each workspace ships its own eslint). */
async function importFrom(baseDir, pkg) {
    const require = createRequire(join(baseDir, 'noop.js'));
    return import(pathToFileURL(require.resolve(pkg)).href);
}

/** Median of an array of numbers. */
export function median(nums) {
    const sorted = [...nums].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Run a command under /usr/bin/time -v, returning {seconds, maxRssKb} plus stdout. */
export function timed(cmd, args, cwd) {
    const res = spawnSync('/usr/bin/time', ['-v', cmd, ...args], {cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
    const err = res.stderr ?? '';
    const wall = /Elapsed \(wall clock\) time.*?: (?:(\d+):)?(\d+):([\d.]+)/.exec(err);
    let seconds = 0;
    if (wall) {
        seconds = (wall[1] ? Number(wall[1]) * 3600 : 0) + Number(wall[2]) * 60 + Number(wall[3]);
    }
    const rss = /Maximum resident set size \(kbytes\): (\d+)/.exec(err);
    return {seconds, maxRssKb: rss ? Number(rss[1]) : 0, stdout: res.stdout ?? '', stderr: err, status: res.status};
}

/**
 * Lint sample spec files with a tool's real repo ESLint flat config. Writes each sample into `specs/__bench__/` under
 * the workspace, runs ESLint once (so the type service starts once), then removes the directory. Returns a Map of
 * sample id -> {messages: [{ruleId, message}], ms}.
 */
export async function lintSpecs(workspaceDir, pluginPrefix, samples) {
    const benchDir = join(workspaceDir, 'specs', '__bench__');
    rmSync(benchDir, {recursive: true, force: true});
    mkdirSync(benchDir, {recursive: true});
    const header = '// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.\n// See LICENSE.txt for license information.\n\nimport {expect, test} from \'@playwright/test\';\n\n';
    for (const s of samples) {
        writeFileSync(join(benchDir, `${s.id}.spec.ts`), header + s.code + '\n');
    }
    const {ESLint} = await importFrom(workspaceDir, 'eslint');
    const eslint = new ESLint({cwd: workspaceDir, errorOnUnmatchedPattern: false});
    const started = performance.now();
    const results = await eslint.lintFiles([join(benchDir, '*.spec.ts')]);
    const totalMs = performance.now() - started;
    const byId = new Map();
    for (const r of results) {
        const id = r.filePath.split('/').pop().replace('.spec.ts', '');
        const messages = (r.messages ?? [])
            .filter((m) => m.ruleId && m.ruleId.startsWith(pluginPrefix))
            .map((m) => ({ruleId: m.ruleId, message: m.message}));
        byId.set(id, {messages, ms: totalMs / Math.max(results.length, 1)});
    }
    rmSync(benchDir, {recursive: true, force: true});
    return byId;
}

/** Lint sample webapp .tsx files with a tool's webapp ESLint config (webapp/channels). */
export async function lintWebapp(webappChannelsDir, pluginPrefix, samples) {
    const benchDir = join(webappChannelsDir, 'src', '__bench__');
    rmSync(benchDir, {recursive: true, force: true});
    mkdirSync(benchDir, {recursive: true});
    const header = '// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.\n// See LICENSE.txt for license information.\n\nimport React from \'react\';\n\n';
    for (const s of samples) {
        writeFileSync(join(benchDir, `${s.id}.tsx`), header + s.code + '\n');
    }
    let byId = new Map();
    try {
        const {ESLint} = await importFrom(webappChannelsDir, 'eslint');
        const eslint = new ESLint({cwd: webappChannelsDir, errorOnUnmatchedPattern: false});
        const results = await eslint.lintFiles([join(benchDir, '*.tsx')]);
        for (const r of results) {
            const id = r.filePath.split('/').pop().replace('.tsx', '');
            const messages = (r.messages ?? [])
                .filter((m) => m.ruleId && m.ruleId.startsWith(pluginPrefix))
                .map((m) => ({ruleId: m.ruleId, message: m.message}));
            byId.set(id, {messages});
        }
    } catch (e) {
        byId = new Map();
        byId.set('__error__', {messages: [{ruleId: 'error', message: String(e.message ?? e)}]});
    }
    rmSync(benchDir, {recursive: true, force: true});
    return byId;
}

/**
 * Run the lean `check` over a temp dir holding one sample. This exercises the full webapp-side battery (scanner
 * diagnostics plus the testid ratchet) exactly as CI would, using the committed baseline and role map. Returns parsed
 * diagnostics [{rule, message}].
 */
export function leanCheck(sample) {
    const ext = sample.level === 'spec' ? 'spec.ts' : 'tsx';
    const dir = mkdtempSync(join(tmpdir(), 'leanscan-'));
    try {
        writeFileSync(join(dir, `${sample.id}.${ext}`), sample.code + '\n');
        const res = spawnSync(
            'node',
            [join(LEAN_ROOT, 'bin/ui-surface.mjs'), 'check', '--root', dir, '--specs', dir],
            {cwd: PW_ROOT, encoding: 'utf8'},
        );
        const diags = [];
        for (const line of (res.stderr ?? '').split('\n')) {
            const m = /\[([a-z-]+)\]\s+(.*)$/.exec(line);
            if (m) {
                diags.push({rule: m[1], message: m[2]});
            }
        }
        return diags;
    } finally {
        rmSync(dir, {recursive: true, force: true});
    }
}

export function loadJson(path) {
    return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : undefined;
}
