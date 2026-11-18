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

/* eslint-disable no-template-curly-in-string -- fixture source */

test('keyFields entries name the type a field is declared on, through unions, intersections and Omit', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-key-owners-'));
    try {
        installFixtureCompiler(root);
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['source.tsx', path.join(FIXTURES, '_lib')]}));
        const allow = [
            {entity: 'SettingBase', module: './source', field: 'key', value: 'setting', reason: 'A setting is identified by its config key.'},
            {entity: 'SchemaSection', module: './source', field: 'id', value: 'screen', reason: 'A screen is identified by its schema id.'},
            {entity: 'Unrelated', module: './source', field: 'name', value: 'thing', reason: 'Names an unrelated type, so it must not apply.'},
        ];
        fs.writeFileSync(path.join(root, 'test-surface.config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], checks: {keyFields: {allow}}, output: {report: 'surface.json'}}));
        fs.writeFileSync(path.join(root, 'source.tsx'), [
            "import React from 'react';",
            'type SettingBase = {key?: string; label: string};',
            "type SettingInput = SettingBase & {type: 'text'};",
            "type SettingGenerated = Omit<SettingBase, 'label'> & {type: 'generated'};",
            'type Setting = SettingInput | SettingGenerated;',
            'type SchemaBase = {id: string; name: string};',
            "type SchemaSection = Omit<SchemaBase, 'name'> & {settings: Setting[]};",
            'type Unrelated = {name: string};',
            'type Other = {name: string};',
            'type Unreviewed = {key: string};',
            'type Mixed = SettingBase | Unreviewed;',
            'type Box<T> = {key: string; value: T};',
            'function Row({setting}: {setting: Setting}) {return <div data-testid={`owners.setting:${setting.key}--region`}/>;}',
            'function Generated({setting}: {setting: SettingGenerated}) {return <button data-testid={`owners.generated:${setting.key}--button`}/>;}',
            'function Screen({schema}: {schema: SchemaSection}) {return <div data-testid={`owners.screen:${schema.id}--region`}/>;}',
            'function Loose({other}: {other: Other}) {return <div data-testid={`owners.loose:${other.name}--region`}/>;}',
            'function Partly({item}: {item: Mixed}) {return <div data-testid={`owners.partly:${item.key}--region`}/>;}',
            'function Boxed({box}: {box: Box<SettingBase>}) {return <div data-testid={`owners.boxed:${box.key}--region`}/>;}',
            'declare const setting: Setting; declare const generated: SettingGenerated; declare const schema: SchemaSection; declare const other: Other; declare const mixed: Mixed; declare const box: Box<SettingBase>;',
            'export function App() {return <div data-testid="owners"><Row setting={setting}/><Generated setting={generated}/><Screen schema={schema}/><Loose other={other}/><Partly item={mixed}/><Boxed box={box}/></div>;}',
        ].join('\n'));
        const scanned = scanProject(loadConfig(path.join(root, 'test-surface.config.json')));
        const parts = scanned.report.families[scanned.report.scopes.owners.family].parts ?? {};
        assert.deepEqual(parts.setting?.key, {kind: 'id', value: 'setting'}, 'declared on SettingBase, read through a union of intersections');
        assert.deepEqual(parts.generated?.key, {kind: 'id', value: 'setting'}, 'declared on SettingBase, read through Omit');
        assert.deepEqual(parts.screen?.key, {kind: 'id', value: 'screen'}, 'declared through Omit, named by the alias that reads it');
        const errors = scanned.diagnostics.filter((diagnostic) => diagnostic.rule === 'key-origin' && diagnostic.severity === 'error');
        assert.deepEqual([...new Set(errors.map((error) => error.template))].sort(), ['owners.boxed:{key}--region', 'owners.loose:{key}--region', 'owners.partly:{key}--region'], 'an entry for another type does not apply, nor one that covers only some members of a union, nor a generic wrapper\'s payload');
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});
