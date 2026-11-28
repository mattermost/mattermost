// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {test} from 'node:test';

import {FIXTURES, installFixtureCompiler} from './helpers.ts';

import {loadConfig} from '../src/config.ts';
import {compilerSetup, WatchedProgram} from '../src/program.ts';
import {watch} from '../src/watch.ts';

test('watch: a file added after the program started joins it once the root files are read again', () => {
    // a copy of a fixture (with the shared lib it extends), so the test can add a file
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'test-surface-watch-'));
    installFixtureCompiler(root);
    fs.cpSync(path.join(FIXTURES, '_lib'), path.join(root, '_lib'), {recursive: true});
    fs.cpSync(path.join(FIXTURES, 'checks'), path.join(root, 'checks'), {recursive: true});
    const config = loadConfig(path.join(root, 'checks', 'test-surface.config.json'));
    const program = new WatchedProgram(config);
    program.current();

    const added = path.join(root, 'checks', 'src', 'added.tsx');
    fs.writeFileSync(added, "export const Added = () => <span data-testid='checks.added--text'/>;\n");
    assert.equal(program.hasRoot(added), false);
    program.touch([added], compilerSetup(config).rootNames);
    assert.equal(program.hasRoot(added), true);
    assert.ok(program.current().program.getSourceFile(added), 'the added file is in the program');
});

test('watch: an error that blocks the report is shown when it is in a file other than the changed one', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'test-surface-watch-'));
    try {
        installFixtureCompiler(root);
        fs.cpSync(path.join(FIXTURES, '_lib'), path.join(root, '_lib'), {recursive: true});
        fs.cpSync(path.join(FIXTURES, 'checks'), path.join(root, 'checks'), {recursive: true});
        const config = loadConfig(path.join(root, 'checks', 'test-surface.config.json'));
        const touched = path.join(root, 'checks', 'src', 'touched.tsx');
        fs.writeFileSync(touched, "export const Touched = () => <span data-testid='checks.touched--text'/>;\n");
        const lines: string[] = [];
        await watch(config, (s) => lines.push(s), {once: [touched]});
        const second = lines.slice(lines.findIndex((l) => l.startsWith('initial scan')) + 1);
        assert.ok(second.some((l) => l.startsWith('✗ src/a.tsx')), second.join('\n'));
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});
