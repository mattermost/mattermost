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

test('plugin field spelling grants no identity; declared plugin keys require a role and satisfy host slots', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-plugin-key-'));
    try {
        installFixtureCompiler(root);
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['source.tsx', path.join(FIXTURES, '_lib')]}));
        const file = path.join(root, 'config.json');
        const raw = {root: '.', tsconfig: 'tsconfig.json', include: ['.'], checks: {strictPaths: ['source.tsx']}, output: {report: 'surface.json'}};
        fs.writeFileSync(file, JSON.stringify(raw));
        const source = 'import React from "react"; type Slot = {pluginId: string}; declare const data: Slot; export function App() {return <span data-testid={"view.entry:" + data.pluginId}/>;}';
        fs.writeFileSync(path.join(root, 'source.tsx'), source);
        const unknown = scanProject(loadConfig(file));
        assert.ok(unknown.diagnostics.some((diagnostic) => diagnostic.rule === 'key-origin' && diagnostic.severity === 'error'));
        const config = {...raw, checks: {...raw.checks, keyFields: {allow: [{entity: 'Slot', module: './source', field: 'pluginId', value: 'plugin', freeForm: true, reason: 'A registered slot is identified by its raw plugin id.'}]}}};
        fs.writeFileSync(file, JSON.stringify(config));
        const roleless = scanProject(loadConfig(file));
        assert.ok(roleless.diagnostics.some((diagnostic) => diagnostic.rule === 'key-origin' && diagnostic.severity === 'error'));
        fs.writeFileSync(path.join(root, 'source.tsx'), source.replace('data.pluginId}', 'data.pluginId + "--text"}'));
        fs.writeFileSync(file, JSON.stringify({...config, pluginSlots: {example: {template: 'view.entry:{key}--text'}}}));
        const declared = scanProject(loadConfig(file));
        assert.deepEqual(declared.diagnostics.filter((diagnostic) => diagnostic.severity === 'error'), []);
        assert.equal(declared.manifest.elements.find((element) => element.name === 'entry')?.key?.value, 'plugin');
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});
