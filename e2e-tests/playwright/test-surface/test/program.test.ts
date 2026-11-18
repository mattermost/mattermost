// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import os from 'node:os';
import path from 'node:path';
import {test} from 'node:test';

import {installFixtureCompiler} from './helpers.ts';

import {resolveConfig} from '../src/config.ts';
import {compilerSetup, loadProgram, WatchedProgram} from '../src/program.ts';
import {typescript} from '../src/typescript.ts';

function project(): {root: string; config: ReturnType<typeof resolveConfig>} {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'test-surface-compiler-'));
    installFixtureCompiler(root);
    fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({compilerOptions: {noEmit: true, types: []}, include: ['source.ts']}));
    fs.writeFileSync(path.join(root, 'source.ts'), 'export const value = 1;\n');
    return {root, config: resolveConfig({root: '.', tsconfig: 'tsconfig.json', include: ['.'], output: {report: 'surface.json'}}, root)};
}

test('program: resolves the compiler from the scanned project', () => {
    const {root, config} = project();
    fs.unlinkSync(path.join(root, 'node_modules', 'typescript'));
    fs.mkdirSync(path.join(root, 'node_modules', 'typescript'));
    const compiler = createRequire(import.meta.url).resolve('typescript');
    fs.writeFileSync(path.join(root, 'node_modules', 'typescript', 'index.js'), `module.exports = {...require(${JSON.stringify(compiler)}), version: 'project-compiler'};\n`);
    loadProgram(config);
    assert.equal(typescript.version, 'project-compiler');
});

test('program: config parsing and compiler option errors fail instead of producing a partial scan', () => {
    const {root, config} = project();
    for (const value of ['{"compilerOptions":', '{"extends":"./missing.json"}', '{"compilerOptions":{"notAnOption":true}}', '{"include":["absent/**/*.ts"]}']) {
        fs.writeFileSync(path.join(root, 'tsconfig.json'), value);
        assert.throws(() => compilerSetup(config));
    }
    fs.writeFileSync(path.join(root, 'tsconfig.json'), '{"compilerOptions":{"module":"node16","moduleResolution":"bundler"}}');
    assert.throws(() => loadProgram(config), /bundler|moduleResolution/i);
});

test('program: syntax errors fail cold and watched scans', () => {
    const {root, config} = project();
    fs.writeFileSync(path.join(root, 'source.ts'), 'export const value = ;\n');
    assert.throws(() => loadProgram(config), /Expression expected/);
    assert.throws(() => new WatchedProgram(config).current(), /Expression expected/);
});

test('program: a missing project compiler is actionable', () => {
    const {root, config} = project();
    fs.unlinkSync(path.join(root, 'node_modules', 'typescript'));
    assert.throws(() => loadProgram(config), /Cannot load TypeScript.*Install the scanned project's dependencies/);
});

test('program: paths and type references resolve from the project when invoked elsewhere', () => {
    const {root, config} = project();
    fs.mkdirSync(path.join(root, 'node_modules/@types/fixture'), {recursive: true});
    fs.writeFileSync(path.join(root, 'node_modules/@types/fixture/index.d.ts'), 'declare const fixture: number;');
    fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({compilerOptions: {types: ['fixture']}, include: ['source.ts']}));
    config.pathOverrides = {'fixture-source': ['./source.ts']};
    const loaded = loadProgram(config);
    assert.equal(loaded.options.baseUrl, undefined);
    assert.equal(loaded.program.getOptionsDiagnostics().length, 0);
    assert.equal(new WatchedProgram(config).current().program.getOptionsDiagnostics().length, 0);
});
