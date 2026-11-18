// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {test} from 'node:test';

import {FIXTURES, installFixtureCompiler} from './helpers.ts';

import {scanProject} from '../src/cli.ts';
import {loadConfig} from '../src/config.ts';

test('a relative identity module resolves from the tsconfig context, never another file importing the same text', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-relative-keys-'));
    try {
        installFixtureCompiler(root);
        fs.mkdirSync(path.join(root, 'other'));
        const compiler = {extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['source.tsx', 'types.ts', 'other', path.join(FIXTURES, '_lib')]};
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify(compiler));
        fs.writeFileSync(path.join(root, 'other/types.ts'), 'export type Thing = {id: string};');
        fs.writeFileSync(path.join(root, 'other/data.ts'), 'import type {Thing} from "./types"; export declare const data: Thing;');
        const config = path.join(root, 'config.json');
        const raw = {root: '.', tsconfig: 'tsconfig.json', include: ['.'], checks: {keyFields: {allow: [{entity: 'Thing', module: './types', field: 'id', value: 'thing', reason: 'The external lookup identifies entries by their id.'}]}}, output: {report: 'surface.json'}};
        fs.writeFileSync(config, JSON.stringify(raw));
        const source = 'import React from "react"; import {data} from "./other/data"; export function App() {return <span data-testid={"view.foreign:" + data.id + "--text"}/>;}';
        fs.writeFileSync(path.join(root, 'source.tsx'), source);
        const missing = scanProject(loadConfig(config));
        assert.ok(missing.diagnostics.some((diagnostic) => diagnostic.rule === 'allow' && diagnostic.message.includes('unique Thing.id')), 'another file’s ./types cannot supply a missing config module');
        assert.ok(missing.diagnostics.some((diagnostic) => diagnostic.rule === 'key-origin' && diagnostic.template === 'view.foreign:{key}--text'));
        fs.writeFileSync(path.join(root, 'types.ts'), 'export type Thing = {id: string};');
        fs.appendFileSync(path.join(root, 'source.tsx'), '\nimport type {Thing} from "./types"; declare const local: Thing; export function Local() {return <span data-testid={"view.local:" + local.id + "--text"}/>;}');
        const resolved = scanProject(loadConfig(config));
        assert.deepEqual(resolved.diagnostics.filter((diagnostic) => diagnostic.rule === 'allow'), []);
        assert.equal(resolved.manifest.elements.find((element) => element.name === 'local')?.key?.value, 'thing');
        assert.ok(resolved.diagnostics.some((diagnostic) => diagnostic.rule === 'key-origin' && diagnostic.template === 'view.foreign:{key}--text'));
        fs.mkdirSync(path.join(root, 'app'));
        fs.writeFileSync(path.join(root, 'app/tsconfig.json'), JSON.stringify({...compiler, include: ['../source.tsx', '../types.ts', '../other', path.join(FIXTURES, '_lib')]}));
        fs.writeFileSync(config, JSON.stringify({...raw, tsconfig: 'app/tsconfig.json'}));
        assert.ok(scanProject(loadConfig(config)).diagnostics.some((diagnostic) => diagnostic.rule === 'allow' && diagnostic.message.includes('unique Thing.id')), 'root-relative fallback cannot replace the documented tsconfig context');
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});
