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

test('canonical key helpers require their configured symbol and reject unused or unresolved contracts', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-key-values-'));
    try {
        installFixtureCompiler(root);
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['*.tsx', '*.ts', path.join(FIXTURES, '_lib')]}));
        const config = path.join(root, 'config.json');
        const writeConfig = (keyValues: unknown) => fs.writeFileSync(config, JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], keyValues, output: {report: 'surface.json'}}));
        fs.writeFileSync(path.join(root, 'helpers.ts'), 'export declare function timeKey(value: unknown): string; export declare function dayKey(value: unknown): string;');
        fs.writeFileSync(path.join(root, 'barrel.ts'), 'export {timeKey as canonicalTime} from "./helpers";');
        fs.writeFileSync(path.join(root, 'source.tsx'), [
            'import React from "react"; import {timeKey as canonical} from "./helpers"; import * as Helpers from "./helpers"; import {canonicalTime} from "./barrel";',
            'declare const input: unknown; declare const runtime: string; const alias = canonical;',
            'function timeKey(value: unknown): string {return runtime;}',
            // eslint-disable-next-line no-template-curly-in-string
            'export function App() {return <section data-testid="view"><span data-testid={`view.direct:${canonical(input)}--text`}/><span data-testid={`view.namespace:${Helpers.timeKey(input)}--text`}/><span data-testid={`view.alias:${alias(input)}--text`}/><span data-testid={`view.barrel:${canonicalTime(input)}--text`}/><span data-testid={`view.shadow:${timeKey(input)}--text`}/></section>;}',
        ].join('\n'));
        const entry = {function: 'timeKey', module: './helpers'};
        writeConfig([entry]);
        const out = scanProject(loadConfig(config));
        for (const name of ['direct', 'namespace', 'alias', 'barrel']) {
            const key = out.manifest.elements.find((element) => element.name === name)?.key;
            assert.equal(key?.kind, 'id', name);
            assert.equal(key?.value, 'time', name);
        }
        assert.ok(out.diagnostics.some((diagnostic) => diagnostic.rule === 'key-origin' && diagnostic.template?.startsWith('view.shadow:')));
        assert.ok(!out.diagnostics.some((diagnostic) => diagnostic.rule === 'allow'), JSON.stringify(out.diagnostics));
        writeConfig([entry, {function: 'dayKey', module: './helpers'}]);
        assert.ok(scanProject(loadConfig(config)).diagnostics.some((diagnostic) => diagnostic.rule === 'allow' && diagnostic.message.includes('dayKey') && diagnostic.message.includes('no longer matches')));
        writeConfig([{function: 'timeKey', module: './missing'}]);
        assert.ok(scanProject(loadConfig(config)).diagnostics.some((diagnostic) => diagnostic.rule === 'allow' && diagnostic.message.includes('Cannot resolve')));
        writeConfig(['timeKey']);
        assert.throws(() => loadConfig(config), /keyValues requires/);

        // A private function in the configured app file needs no new export to declare its contract.
        writeConfig([{function: 'timeKey', module: './source'}]);
        const privateOut = scanProject(loadConfig(config));
        assert.equal(privateOut.manifest.elements.find((element) => element.name === 'shadow')?.key?.kind, 'id');
        assert.ok(!privateOut.diagnostics.some((diagnostic) => diagnostic.rule === 'allow'), JSON.stringify(privateOut.diagnostics));
        const file = path.join(root, 'source.tsx');
        fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('function timeKey(value: unknown): string {return runtime;}', 'const timeKey = (value: unknown): string => runtime;'));
        const privateConst = scanProject(loadConfig(config));
        assert.equal(privateConst.manifest.elements.find((element) => element.name === 'shadow')?.key?.kind, 'id');
        assert.ok(!privateConst.diagnostics.some((diagnostic) => diagnostic.rule === 'allow'), JSON.stringify(privateConst.diagnostics));
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});
