// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {scanProject, type ScanOutput} from '../src/cli.ts';
import {loadConfig} from '../src/config.ts';

export const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

const cache = new Map<string, ScanOutput>();

/** Scans a fixture project (test/fixtures/<name>) once per test run. */
export function scanFixture(name: string): ScanOutput {
    const hit = cache.get(name);
    if (hit) {
        return hit;
    }
    const out = scanProject(loadConfig(path.join(FIXTURES, name, 'test-surface.config.json')));
    cache.set(name, out);
    return out;
}

/** Element lookup by template, in the scan's own manifest: exact locations (`file:line:column`), not `file#Component`. */
export function exact(out: ScanOutput, template: string) {
    const el = out.result.manifest.elements.find((e) => e.template === template);
    assert.ok(el, `no element ${template}`);
    return el;
}

/** Element lookup by template. */
export function element(out: ScanOutput, template: string) {
    const el = out.manifest.elements.find((e) => e.template === template);
    assert.ok(el, `no element ${template}; have:\n  ${out.manifest.elements.map((e) => e.template).join('\n  ')}`);
    return el;
}

/** Installs the compiler dependency for a temporary fixture project. */
export function installFixtureCompiler(root: string): void {
    const compiler = path.dirname(createRequire(import.meta.url).resolve('typescript/package.json'));
    fs.mkdirSync(path.join(root, 'node_modules'), {recursive: true});
    fs.symlinkSync(compiler, path.join(root, 'node_modules', 'typescript'), 'dir');
}

/** The shared tsconfig the fixture projects extend. */
export const LIB = path.join(FIXTURES, '_lib');

/**
 * Runs `run` in a throwaway project directory that has the compiler installed, a tsconfig that includes `include`, and the
 * default scan config (`config.json`, root `.`, the whole directory). The test writes its own source files into `root`.
 */
export function withProject(include: string[], run: (root: string) => void): void {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-test-'));
    try {
        installFixtureCompiler(root);
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include}));
        fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], output: {report: 'surface.json'}}));
        run(root);
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
}
