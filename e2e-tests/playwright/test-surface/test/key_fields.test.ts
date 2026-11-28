// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';

import {withSource, scanSource, FIXTURES} from './helpers.ts';

import {type KeyFieldAllow} from '../src/config.ts';

/* eslint-disable no-template-curly-in-string -- fixture source */

test('configured field identities survive typed array elements passed through keyed child props', () => {
    withSource({
        'source.tsx': [
            'type ThemeElement = {id: string}; type OtherElement = {id: string}; declare const Constants: {THEME_ELEMENTS: ThemeElement[]; OTHER_ELEMENTS: OtherElement[]};',
            // eslint-disable-next-line no-template-curly-in-string -- fixture source
            'function ColorInput({testId, testKey}: {testId: string; testKey: string}) {return <button data-testid={`${testId}.element:${testKey}--button`}/>;}',
            'function ColorChooser({testId, id}: {testId: string; id: string}) {return <ColorInput testId={testId} testKey={id}/>;}',
            'export function App() {const rows = []; Constants.THEME_ELEMENTS.forEach((element) => rows.push(<ColorChooser testId="theme" id={element.id}/>)); Constants.OTHER_ELEMENTS.forEach((element) => rows.push(<ColorChooser testId="other" id={element.id}/>)); return <div>{rows}</div>;}',
        ].join('\n'),
    }, {include: ['source.tsx'], config: {checks: {keyFields: {allow: [{entity: 'ThemeElement', module: './source', field: 'id', value: 'theme_element', reason: 'The theme element id names its color setting.'}]}}}}, ({scan, readConfig}) => {
        const config = readConfig();
        const scanned = scan(config);
        const key = scanned.manifest.elements.find((element) => element.template === 'theme.element:{key}--button')?.key;
        assert.equal(key?.kind, 'id');
        assert.equal(key?.value, 'theme_element');
        assert.deepEqual([...new Set(scanned.diagnostics.filter((diagnostic) => diagnostic.rule === 'key-origin' && diagnostic.severity === 'error').map((diagnostic) => diagnostic.template))], ['other.element:{key}--button']);
        config.checks.keyFields.allow = [];
        assert.ok(scan(config).diagnostics.some((diagnostic) => diagnostic.rule === 'key-origin' && diagnostic.template === 'theme.element:{key}--button'));
    });
});

test('keyFields entries name the type a field is declared on, through unions, intersections and Omit', () => {
    const allow = [
        {entity: 'SettingBase', module: './source', field: 'key', value: 'setting', reason: 'A setting is identified by its config key.'},
        {entity: 'SchemaSection', module: './source', field: 'id', value: 'screen', reason: 'A screen is identified by its schema id.'},
        {entity: 'Unrelated', module: './source', field: 'name', value: 'thing', reason: 'Names an unrelated type, so it must not apply.'},
    ];
    const scanned = scanSource({
        'source.tsx': [
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
        ].join('\n'),
    }, {include: ['source.tsx'], config: {checks: {keyFields: {allow}}}});
    const parts = scanned.report.families[scanned.report.scopes.owners.family].parts ?? {};
    assert.deepEqual(parts.setting?.key, {kind: 'id', value: 'setting'}, 'declared on SettingBase, read through a union of intersections');
    assert.deepEqual(parts.generated?.key, {kind: 'id', value: 'setting'}, 'declared on SettingBase, read through Omit');
    assert.deepEqual(parts.screen?.key, {kind: 'id', value: 'screen'}, 'declared through Omit, named by the alias that reads it');
    const errors = scanned.diagnostics.filter((diagnostic) => diagnostic.rule === 'key-origin' && diagnostic.severity === 'error');
    assert.deepEqual([...new Set(errors.map((error) => error.template))].sort(), ['owners.boxed:{key}--region', 'owners.loose:{key}--region', 'owners.partly:{key}--region'], 'an entry for another type does not apply, nor one that covers only some members of a union, nor a generic wrapper\'s payload');
});

test('canonical key helpers require their configured symbol and reject unused or unresolved contracts', () => {
    withSource({
        'helpers.ts': 'export declare function timeKey(value: unknown): string; export declare function dayKey(value: unknown): string;',
        'barrel.ts': 'export {timeKey as canonicalTime} from "./helpers";',
        'source.tsx': [
            'import React from "react"; import {timeKey as canonical} from "./helpers"; import * as Helpers from "./helpers"; import {canonicalTime} from "./barrel";',
            'declare const input: unknown; declare const runtime: string; const alias = canonical;',
            'function timeKey(value: unknown): string {return runtime;}',
            // eslint-disable-next-line no-template-curly-in-string
            'export function App() {return <section data-testid="view"><span data-testid={`view.direct:${canonical(input)}--text`}/><span data-testid={`view.namespace:${Helpers.timeKey(input)}--text`}/><span data-testid={`view.alias:${alias(input)}--text`}/><span data-testid={`view.barrel:${canonicalTime(input)}--text`}/><span data-testid={`view.shadow:${timeKey(input)}--text`}/></section>;}',
        ].join('\n'),
    }, {include: ['*.tsx', '*.ts'], configFile: 'config.json'}, ({root, configPath, scan, readConfig}) => {
        const writeConfig = (keyValues: unknown) => fs.writeFileSync(configPath, JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], keyValues, output: {report: 'surface.json'}}));
        const entry = {function: 'timeKey', module: './helpers'};
        writeConfig([entry]);
        const out = scan();
        for (const name of ['direct', 'namespace', 'alias', 'barrel']) {
            const key = out.manifest.elements.find((element) => element.name === name)?.key;
            assert.equal(key?.kind, 'id', name);
            assert.equal(key?.value, 'time', name);
        }
        assert.ok(out.diagnostics.some((diagnostic) => diagnostic.rule === 'key-origin' && diagnostic.template?.startsWith('view.shadow:')));
        assert.ok(!out.diagnostics.some((diagnostic) => diagnostic.rule === 'allow'), JSON.stringify(out.diagnostics));
        writeConfig([entry, {function: 'dayKey', module: './helpers'}]);
        assert.ok(scan().diagnostics.some((diagnostic) => diagnostic.rule === 'allow' && diagnostic.message.includes('dayKey') && diagnostic.message.includes('no longer matches')));
        writeConfig([{function: 'timeKey', module: './missing'}]);
        assert.ok(scan().diagnostics.some((diagnostic) => diagnostic.rule === 'allow' && diagnostic.message.includes('Cannot resolve')));
        writeConfig(['timeKey']);
        assert.throws(() => readConfig(), /keyValues requires/);

        // A private function in the configured app file needs no new export to declare its contract.
        writeConfig([{function: 'timeKey', module: './source'}]);
        const privateOut = scan();
        assert.equal(privateOut.manifest.elements.find((element) => element.name === 'shadow')?.key?.kind, 'id');
        assert.ok(!privateOut.diagnostics.some((diagnostic) => diagnostic.rule === 'allow'), JSON.stringify(privateOut.diagnostics));
        const file = path.join(root, 'source.tsx');
        fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('function timeKey(value: unknown): string {return runtime;}', 'const timeKey = (value: unknown): string => runtime;'));
        const privateConst = scan();
        assert.equal(privateConst.manifest.elements.find((element) => element.name === 'shadow')?.key?.kind, 'id');
        assert.ok(!privateConst.diagnostics.some((diagnostic) => diagnostic.rule === 'allow'), JSON.stringify(privateConst.diagnostics));
    });
});

test('library field contracts resolve exported aliases and merged declarations in the importing program', () => {
    const pkg = (name: string, files: Record<string, string>) => ({
        [`node_modules/${name}/package.json`]: JSON.stringify({name, version: '1.0.0', types: 'index.d.ts'}),
        ...Object.fromEntries(Object.entries(files).map(([file, content]) => [`node_modules/${name}/${file}`, content])),
    });
    const raw = {root: '.',
        tsconfig: 'tsconfig.json',
        include: ['.'],
        checks: {keyFields: {allow: [
            {entity: 'Column', module: '@table/react-table', field: 'id', value: 'column', reason: 'The library column id identifies a table column.'},
            {entity: 'Header', module: '@table/react-table', field: 'id', value: 'header', reason: 'The library header id identifies a table header.'},
        ]}},
        output: {report: 'surface.json'}};
    withSource({
        ...pkg('@table/core', {
            'index.d.ts': 'export {CoreColumn as Column} from "./column"; export type {Header} from "./headers";',
            'column.d.ts': 'export interface CoreColumn<T> {id: string; value: T} export interface CoreColumn<T> {extra?: string}',
            'headers.d.ts': 'export interface CoreHeader<T> {id: string; value: T} export type Header<T> = CoreHeader<T> & {parent?: Header<T>};',
            'esm.d.ts': 'export interface Column<T> {id: string; value: T} export interface Header<T> {id: string; value: T}',
        }),
        ...pkg('@table/react-table', {'index.d.ts': 'export * from "@table/core";'}),
        'source.tsx': [
            'import React from "react"; import type {Column, Header} from "@table/react-table"; import type {Column as OtherColumn} from "@table/core/esm";',
            'declare const data: {column: Column<string>; header: Header<string>; other: OtherColumn<string>};',
            'export function App() {return <><span data-testid={"view.column:" + data.column.id + "--text"}/><span data-testid={"view.header:" + data.header.id + "--text"}/><span data-testid={"view.other:" + data.other.id + "--text"}/></>;}',
        ].join('\n'),
    }, {include: ['source.tsx'], config: raw, configFile: 'config.json'}, ({root, configPath, scan}) => {
        const out = scan();
        assert.deepEqual(out.diagnostics.filter((diagnostic) => diagnostic.rule === 'allow'), []);
        for (const name of ['column', 'header']) {
            const key = out.manifest.elements.find((element) => element.name === name)?.key;
            assert.equal(key?.kind, 'id', name);
            assert.equal(key?.value, name);
        }
        assert.deepEqual([...new Set(out.diagnostics.filter((diagnostic) => diagnostic.rule === 'key-origin').map((diagnostic) => diagnostic.template))], ['view.other:{key}--text'], 'a same-named type from another module does not match');
        raw.checks.keyFields.allow[0].module = '@table/core/esm';
        fs.writeFileSync(configPath, JSON.stringify(raw));
        const other = scan();
        assert.ok(other.diagnostics.some((diagnostic) => diagnostic.rule === 'key-origin' && diagnostic.template === 'view.column:{key}--text'));
        assert.equal(other.manifest.elements.find((element) => element.name === 'other')?.key?.value, 'column');
        raw.checks.keyFields.allow[0].module = '';
        fs.writeFileSync(configPath, JSON.stringify(raw));
        assert.ok(scan().diagnostics.some((diagnostic) => diagnostic.rule === 'allow' && diagnostic.severity === 'error'));
        raw.checks.keyFields.allow[0].module = '@table/react-table';
        fs.writeFileSync(configPath, JSON.stringify(raw));
        const duplicate = path.join(root, 'other/node_modules/@table/react-table');
        fs.mkdirSync(duplicate, {recursive: true});
        fs.writeFileSync(path.join(duplicate, 'package.json'), JSON.stringify({name: '@table/react-table', version: '2.0.0', types: 'index.d.ts'}));
        fs.writeFileSync(path.join(duplicate, 'index.d.ts'), 'export interface Column<T> {id: string; value: T} export interface Header<T> {id: string; value: T}');
        fs.writeFileSync(path.join(root, 'other/source.ts'), 'import type {Column} from "@table/react-table"; export type Other = Column<string>;');
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['source.tsx', 'other/source.ts', path.join(FIXTURES, '_lib')]}));
        const ambiguous = scan();
        assert.ok(ambiguous.diagnostics.some((diagnostic) => diagnostic.rule === 'allow' && diagnostic.message.includes('unique Column.id')), 'different package symbols remain ambiguous');
    });
});

test('qualified prop identities stop at their declaration and do not match another module Props', () => {
    withSource({
        // eslint-disable-next-line no-template-curly-in-string -- fixture source
        'emoji.tsx': 'type Props={name:string; unused?:string}; export function Emoji({name}:Props){return <span data-testid={`markdown.emoji:${name}--text`}/>;}',
        // eslint-disable-next-line no-template-curly-in-string -- fixture source
        'other.tsx': 'type Props={name:string}; export function Other({name}:Props){return <span data-testid={`other.emoji:${name}--text`}/>;}',
        'source.tsx': 'import {Emoji} from "./emoji"; import {Other} from "./other"; declare const node:any; export function App(){return <><Emoji name={node.attribs["data-emoticon"]}/><Other name={node.attribs["data-emoticon"]}/></>;}',
    }, {include: ['*.tsx'], configFile: 'config.json'}, ({root, configPath, scan: scanConfigured}) => {
        const entry: KeyFieldAllow = {entity: 'Props', module: './emoji', field: 'name', value: 'emoji', reason: 'Markdown emoji names are canonical identifiers read from parsed HTML.'};
        const scan = (entries: KeyFieldAllow[]) => {
            fs.writeFileSync(configPath, JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], output: {report: 'surface.json'}, checks: {keyFields: {allow: entries}}}));
            return scanConfigured();
        };
        const out = scan([entry]);
        assert.deepEqual(out.manifest.elements.find((e) => e.template === 'markdown.emoji:{key}--text')?.key, {kind: 'id', value: 'emoji', type: 'string'});
        assert.ok(!out.diagnostics.some((d) => d.severity === 'error' && (d.template === 'markdown.emoji:{key}--text' || d.rule === 'allow')));
        assert.ok(out.diagnostics.some((d) => d.rule === 'key-origin' && d.template === 'other.emoji:{key}--text'));
        assert.ok(scan([{...entry, module: undefined}]).diagnostics.some((d) => d.severity === 'error' && d.message.includes('needs module')));
        assert.ok(scan([{...entry, module: './missing'}]).diagnostics.some((d) => d.severity === 'error' && d.message.includes('Cannot resolve')));
        assert.ok(scan([{...entry, field: 'missing'}]).diagnostics.some((d) => d.severity === 'error' && d.message.includes('Cannot resolve')));
        assert.ok(scan([{...entry, field: 'unused'}]).diagnostics.some((d) => d.severity === 'error' && d.message.includes('no longer matches any key')));
        // eslint-disable-next-line no-template-curly-in-string -- fixture source
        fs.writeFileSync(path.join(root, 'emoji.tsx'), 'type Props={name?:string}; export function Emoji({name}:Props){return <span data-testid={`markdown.emoji:${name}--text`}/>;}');
        assert.ok(scan([entry]).diagnostics.some((d) => d.rule === 'undefined' && d.template === 'markdown.emoji:{key}--text'));
        // eslint-disable-next-line no-template-curly-in-string -- fixture source
        fs.writeFileSync(path.join(root, 'emoji.tsx'), 'type Props={name?:string}; export function Emoji({name}:Props){return <span data-testid={name ? `markdown.emoji:${name}--text` : undefined}/>;}');
        assert.ok(!scan([entry]).diagnostics.some((d) => d.rule === 'undefined' && d.template?.startsWith('markdown.emoji')));
    });
});

test('a relative identity module resolves from the tsconfig context, never another file importing the same text', () => {
    const compiler = {extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['source.tsx', 'types.ts', 'other', path.join(FIXTURES, '_lib')]};
    const raw = {root: '.', tsconfig: 'tsconfig.json', include: ['.'], checks: {keyFields: {allow: [{entity: 'Thing', module: './types', field: 'id', value: 'thing', reason: 'The external lookup identifies entries by their id.'}]}}, output: {report: 'surface.json'}};
    const source = 'import React from "react"; import {data} from "./other/data"; export function App() {return <span data-testid={"view.foreign:" + data.id + "--text"}/>;}';
    withSource({
        'other/types.ts': 'export type Thing = {id: string};',
        'other/data.ts': 'import type {Thing} from "./types"; export declare const data: Thing;',
        'source.tsx': source,
    }, {tsconfig: compiler, config: {checks: raw.checks}, configFile: 'config.json'}, ({root, configPath, scan}) => {
        const missing = scan();
        assert.ok(missing.diagnostics.some((diagnostic) => diagnostic.rule === 'allow' && diagnostic.message.includes('unique Thing.id')), 'another file’s ./types cannot supply a missing config module');
        assert.ok(missing.diagnostics.some((diagnostic) => diagnostic.rule === 'key-origin' && diagnostic.template === 'view.foreign:{key}--text'));
        fs.writeFileSync(path.join(root, 'types.ts'), 'export type Thing = {id: string};');
        fs.appendFileSync(path.join(root, 'source.tsx'), '\nimport type {Thing} from "./types"; declare const local: Thing; export function Local() {return <span data-testid={"view.local:" + local.id + "--text"}/>;}');
        const resolved = scan();
        assert.deepEqual(resolved.diagnostics.filter((diagnostic) => diagnostic.rule === 'allow'), []);
        assert.equal(resolved.manifest.elements.find((element) => element.name === 'local')?.key?.value, 'thing');
        assert.ok(resolved.diagnostics.some((diagnostic) => diagnostic.rule === 'key-origin' && diagnostic.template === 'view.foreign:{key}--text'));
        fs.mkdirSync(path.join(root, 'app'));
        fs.writeFileSync(path.join(root, 'app/tsconfig.json'), JSON.stringify({...compiler, include: ['../source.tsx', '../types.ts', '../other', path.join(FIXTURES, '_lib')]}));
        fs.writeFileSync(configPath, JSON.stringify({...raw, tsconfig: 'app/tsconfig.json'}));
        assert.ok(scan().diagnostics.some((diagnostic) => diagnostic.rule === 'allow' && diagnostic.message.includes('unique Thing.id')), 'root-relative fallback cannot replace the documented tsconfig context');
    });
});

test('prop scopes retain only their own plain keys before a role suffix', () => {
    withSource({
        // eslint-disable-next-line no-template-curly-in-string -- The fixture derives keyed ids from caller props.
        'keyed.tsx': 'import React from "react"; function Min({testId,testKey}:{testId:string;testKey:string}){return <div role="group" data-testid={`${testId}:${testKey}--group`}/>;} export function Keyed({testIdScope,section,k=section}:{testIdScope:string;section:string;k?:string}){return <Min testId={testIdScope} testKey={k}/>;}',
        'general.tsx': 'import React from "react"; import {Keyed} from "./keyed"; export function General(){return <><Keyed testIdScope="settings.general.section" section="email"/><Keyed testIdScope="settings.general.section" section="shared"/></>;}',
        'display.tsx': 'import React from "react"; import {Keyed} from "./keyed"; export function Display(){return <><Keyed testIdScope="settings.display.section" section="clock"/><Keyed testIdScope="settings.display.section" section="shared"/></>;}',
        'source.tsx': 'import React from "react"; import {General} from "./general"; import {Display} from "./display"; export function App(){return <><General/><Display/></>;}',
    }, {include: ['*.tsx']}, ({root, scan}) => {
        for (const explicitUndefined of [false, true]) {
            if (explicitUndefined) {
                for (const name of ['general.tsx', 'display.tsx']) {
                    const caller = path.join(root, name);
                    fs.writeFileSync(caller, fs.readFileSync(caller, 'utf8').replaceAll('<Keyed ', '<Keyed k={undefined} '));
                }
            }
            const out = scan();
            assert.deepEqual(out.report.sets.SettingsGeneralSectionKey, ['email', 'shared'], JSON.stringify(out.report.sets));
            assert.deepEqual(out.report.sets.SettingsDisplaySectionKey, ['clock', 'shared'], JSON.stringify(out.report.sets));
        }
        const component = path.join(root, 'keyed.tsx');
        fs.writeFileSync(component, fs.readFileSync(component, 'utf8').replace('k=section}', 'k=section+".value"}'));
        const compound = scan();
        assert.deepEqual(compound.report.sets.SettingsGeneralSectionKey, ['email.value', 'shared.value'], JSON.stringify(compound.report.sets));
        assert.deepEqual(compound.report.sets.SettingsDisplaySectionKey, ['clock.value', 'shared.value'], JSON.stringify(compound.report.sets));
    });
});

test('plugin field spelling grants no identity; declared plugin keys require a role and satisfy host slots', () => {
    const raw = {root: '.', tsconfig: 'tsconfig.json', include: ['.'], checks: {strictPaths: ['source.tsx']}, output: {report: 'surface.json'}};
    const source = 'import React from "react"; type Slot = {pluginId: string}; declare const data: Slot; export function App() {return <span data-testid={"view.entry:" + data.pluginId}/>;}';
    withSource({
        'source.tsx': source,
    }, {include: ['source.tsx'], config: {checks: raw.checks}, configFile: 'config.json'}, ({root, configPath, scan}) => {
        const unknown = scan();
        assert.ok(unknown.diagnostics.some((diagnostic) => diagnostic.rule === 'key-origin' && diagnostic.severity === 'error'));
        const config = {...raw, checks: {...raw.checks, keyFields: {allow: [{entity: 'Slot', module: './source', field: 'pluginId', value: 'plugin', freeForm: true, reason: 'A registered slot is identified by its raw plugin id.'}]}}};
        fs.writeFileSync(configPath, JSON.stringify(config));
        const roleless = scan();
        assert.ok(roleless.diagnostics.some((diagnostic) => diagnostic.rule === 'key-origin' && diagnostic.severity === 'error'));
        fs.writeFileSync(path.join(root, 'source.tsx'), source.replace('data.pluginId}', 'data.pluginId + "--text"}'));
        fs.writeFileSync(configPath, JSON.stringify({...config, pluginSlots: {example: {template: 'view.entry:{key}--text'}}}));
        const declared = scan();
        assert.deepEqual(declared.diagnostics.filter((diagnostic) => diagnostic.severity === 'error'), []);
        assert.equal(declared.manifest.elements.find((element) => element.name === 'entry')?.key?.value, 'plugin');
    });
});
