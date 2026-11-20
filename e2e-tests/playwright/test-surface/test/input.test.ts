// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {test} from 'node:test';

import {FIXTURES} from './helpers.ts';

import {loadConfig, resolveConfig} from '../src/config.ts';
import {readVersioned} from '../src/input.ts';
import type {Diagnostic} from '../src/manifest_types.ts';
import {loadPublishedParts} from '../src/parts.ts';

test('input: a config file resolves its paths and checks', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-surface-config-'));
    const file = path.join(dir, 'config.json');
    const base = {root: '.', tsconfig: 'tsconfig.json', include: ['src'], output: {report: 'surface.json'}};
    try {
        fs.writeFileSync(file, JSON.stringify({...base, checks: {strictPaths: ['src/']}}));
        assert.deepEqual(loadConfig(file).checks.strictPaths, ['src/']);
        assert.equal(resolveConfig(base, dir).output.report, path.join(dir, 'surface.json'));
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});

test('input: a missing, corrupt or differently versioned file is an error, never an empty result', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-surface-input-'));
    const file = (name: string, text: string) => {
        fs.writeFileSync(path.join(dir, name), text);
        return path.join(dir, name);
    };
    const read = (f: string) => readVersioned<{version: number; x?: number}>(f, 2, 'The thing', 'thing.json');
    const message = (r: ReturnType<typeof read>) => ('diagnostic' in r ? `${r.diagnostic.rule} ${r.diagnostic.severity} ${r.diagnostic.message}` : 'ok');
    assert.match(message(read(path.join(dir, 'none.json'))), /^input error The thing is missing/);
    assert.match(message(read(file('bad.json', '{"version": 2,'))), /^input error The thing isn't valid JSON/);
    assert.match(message(read(file('old.json', '{"version": 1}'))), /^input error The thing was written by test-surface format v1; this version reads v2\./);
    assert.deepEqual(read(file('ok.json', '{"version": 2, "x": 3}')), {value: {version: 2, x: 3}});
});

test('input: a configured library that isn\'t installed is an error; one installed without test-parts.json a warning', () => {
    const dir = path.join(FIXTURES, 'library_roles');
    const problems = (libraries: string[]) => {
        const out: Diagnostic[] = [];
        loadPublishedParts(resolveConfig({root: '.', tsconfig: 'tsconfig.json', include: ['src'], output: {report: 'test-surface.json'}, libraries}, dir), out);
        return out.map((d) => `${d.rule} ${d.severity} ${d.message}`);
    };
    assert.match(problems(['@mattermost/not-installed']).join('\n'), /^input error Library @mattermost\/not-installed \(config `libraries`\) isn't installed\.$/);
    assert.match(problems(['@mattermost/compass-ui']).join('\n'), /^input warning Library @mattermost\/compass-ui@0\.1\.0-alpha\.25 publishes no test-parts\.json/);
});
