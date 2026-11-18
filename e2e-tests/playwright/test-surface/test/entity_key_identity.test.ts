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
import {incompatibleKinds, keyInfo, keyKinds} from '../src/scan/keys.ts';
import {type Gap} from '../src/values.ts';

test('entity aggregation distinguishes public modules even without declaration metadata', () => {
    const gaps: Gap[] = ['@types/a', '@types/b'].map((module) => ({kind: 'entity', entity: 'Record', field: 'id', module, type: 'string', expr: 'record.id'}));
    assert.ok(incompatibleKinds(keyKinds(new Set(), gaps)!));
    assert.equal(keyInfo(new Set(), gaps)?.kind, 'string');
});

test('entity aggregation preserves declaration identity while accepting aliases of the same declaration', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-entity-identity-'));
    try {
        installFixtureCompiler(root);
        for (const dir of ['a', 'b']) {
            fs.mkdirSync(path.join(root, dir));
            fs.writeFileSync(path.join(root, dir, 'record.ts'), 'export type Record = {id: string};');
        }
        fs.writeFileSync(path.join(root, 'a/index.ts'), 'export type {Record as Alias} from "./record";');
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['source.tsx', 'a', 'b', path.join(FIXTURES, '_lib')]}));
        const config = path.join(root, 'config.json');
        const writeConfig = (sameModule: boolean) => fs.writeFileSync(config, JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], entityTypeDirs: ['a', 'b'], entityTypeModules: {a: '@types/a', b: sameModule ? '@types/a' : '@types/b'}, output: {report: 'surface.json'}}));
        const source = (target: string, name: string) => [
            'import React from "react"; import type {Record} from "./a/record";',
            `import type {${name} as Other} from "${target}";`,
            'declare const first: Record; declare const second: Other;',
            'export function App() {return <section data-testid="view"><button data-testid={"view.entry:" + first.id + "--button"}/><button data-testid={"view.entry:" + second.id + "--button"}/></section>;}',
        ].join('\n');
        fs.writeFileSync(path.join(root, 'source.tsx'), source('./b/record', 'Record'));
        for (const sameModule of [false, true]) {
            writeConfig(sameModule);
            const out = scanProject(loadConfig(config));
            assert.ok(out.diagnostics.some((diagnostic) => diagnostic.rule === 'collisions' && diagnostic.message.includes('key')), JSON.stringify(out.diagnostics));
            assert.equal(out.manifest.elements.find((element) => element.name === 'entry')?.key?.kind, 'string');
        }
        fs.writeFileSync(path.join(root, 'source.tsx'), source('./a/index', 'Alias'));
        writeConfig(false);
        const out = scanProject(loadConfig(config));
        assert.ok(!out.diagnostics.some((diagnostic) => diagnostic.rule === 'collisions'), JSON.stringify(out.diagnostics));
        const key = out.manifest.elements.find((element) => element.name === 'entry')?.key;
        assert.equal(key?.kind, 'entity');
        assert.equal(key?.module, '@types/a/record');
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});
