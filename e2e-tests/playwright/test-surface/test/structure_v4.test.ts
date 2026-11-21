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
import {serialize} from '../src/report_types.ts';

function fixture(source: string, check: (root: string) => void) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-structure-v4-'));
    try {
        installFixtureCompiler(root);
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['*.tsx', '*.ts', path.join(FIXTURES, '_lib')]}));
        fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], client: {file: 'client.ts', className: 'Client4', urlVersion: '/api/v4'}, output: {report: 'surface.json'}}));
        fs.writeFileSync(path.join(root, 'client.ts'), 'export class Client4 {doFetch<T>(url: string, options: unknown): Promise<T> {throw new Error(url);} users = () => this.doFetch("/api/v4/users", {method: "GET"}); unused = () => this.doFetch("/api/v4/unused", {method: "POST"});}');
        fs.writeFileSync(path.join(root, 'source.tsx'), source);
        check(root);
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
}

test('v4 records the native file input itself and rejects a role suffix on it', () => {
    fixture('export function App(){return <section data-testid="picker"><button data-testid="picker.attach--button"/><input type="file" data-testid="picker.upload"/></section>;}', (root) => {
        const config = loadConfig(path.join(root, 'config.json'));
        const first = scanProject(config);
        const parts = first.report.families[first.report.scopes.picker.family].parts!;
        assert.deepEqual(parts.upload, {role: null, native: 'file'});
        assert.equal(parts.attach.native, undefined, 'no handler-to-opener file inference');
        assert.deepEqual(first.diagnostics.filter((diagnostic) => diagnostic.severity === 'error'), []);
        const source = path.join(root, 'source.tsx');
        fs.writeFileSync(source, fs.readFileSync(source, 'utf8').replace('picker.upload"', 'picker.upload--button"'));
        const invalid = scanProject(config);
        assert.ok(invalid.diagnostics.some((diagnostic) => diagnostic.severity === 'error' && diagnostic.rule === 'grammar' && diagnostic.message.includes('file input')));
    });
});

test('handlers contribute no report data and the Api catalog includes unused client operations', () => {
    fixture('declare const unknown:()=>void; export function App(){return <button data-testid="form.save--button" onClick={()=>unknown()}/>;}', (root) => {
        const config = loadConfig(path.join(root, 'config.json'));
        const first = scanProject(config);
        assert.equal(first.report.version, 4);
        assert.deepEqual(Object.keys(first.report.operations).sort(), ['Unused', 'Users']);
        assert.equal(first.report.scopes.form.bind, undefined);
        const source = path.join(root, 'source.tsx');
        fs.writeFileSync(source, fs.readFileSync(source, 'utf8').replace('()=>unknown()', '()=>{throw new Error("changed behavior");}'));
        assert.equal(serialize(scanProject(config).report), serialize(first.report));
        assert.ok(!Object.values(first.manifest.elements).some((element) => 'effects' in element || 'opens' in element));
    });
});

test('dialog descriptors discover finite candidate mounts without predicting an opener', () => {
    fixture('function One(){return <button data-testid="one.close--button"/>;} function Two(){return <button data-testid="two.close--button"/>;} declare const flag:boolean; const dialog = flag ? One : Two; export const descriptor={dialogType:dialog}; export function App(){return <button data-testid="app.open--button"/>;}', (root) => {
        const result = scanProject(loadConfig(path.join(root, 'config.json')));
        assert.ok(result.report.scopes.one);
        assert.ok(result.report.scopes.two);
        assert.deepEqual(result.manifest.components.map((component) => component.name).sort(), ['One', 'Two']);
        assert.equal(result.report.scopes.app.bind, undefined);
    });
});

test('unresolved dialog components are source errors, never silently missing candidate mounts', () => {
    fixture('declare const unknown: unknown; export const descriptor={dialogType:unknown}; export function App(){return <button data-testid="app.open--button"/>;}', (root) => {
        const result = scanProject(loadConfig(path.join(root, 'config.json')));
        assert.ok(result.diagnostics.some((diagnostic) => diagnostic.severity === 'error' && diagnostic.rule === 'input' && diagnostic.at.startsWith('source.tsx:') && diagnostic.message.includes('dialogType')));
    });
});

test('one known dialog alternative cannot hide another unresolved alternative', () => {
    fixture('function Known(){return <button data-testid="known.close--button"/>;} declare const unknown: unknown; declare const flag:boolean; export const descriptor={dialogType:flag?Known:unknown};', (root) => {
        const result = scanProject(loadConfig(path.join(root, 'config.json')));
        assert.ok(result.report.scopes.known);
        assert.ok(result.diagnostics.some((diagnostic) => diagnostic.severity === 'error' && diagnostic.rule === 'input' && diagnostic.message.includes('dialogType')));
    });
});

test('descriptor field forwards declare nothing and do not hide an unresolved definition', () => {
    fixture('declare const opaque:any; export const copied={dialogType:opaque.dialogType}; export const indexed={dialogType:opaque["dialogType"]}; const {dialogType:renamed}=opaque; export const renamedCopy={dialogType:renamed}; function copy({dialogType}:any){return {dialogType};} export function App(){return <button data-testid="app.open--button"/>;}', (root) => {
        const config = loadConfig(path.join(root, 'config.json'));
        const first = scanProject(config);
        assert.deepEqual(first.manifest.components, []);
        assert.ok(!first.diagnostics.some((diagnostic) => diagnostic.rule === 'input'));
        fs.appendFileSync(path.join(root, 'source.tsx'), 'declare function resolve():unknown; export const bad={dialogType:resolve()}; export const forwarded={dialogType:bad.dialogType};');
        const second = scanProject(config);
        assert.equal(second.diagnostics.filter((diagnostic) => diagnostic.rule === 'input' && diagnostic.message.includes('dialogType')).length, 1);
    });
});

test('positional component values resolve every call site and retain an unresolved call site as an error', () => {
    fixture('function One(){return <button data-testid="one.close--button"/>;} function Two(){return <button data-testid="two.close--button"/>;} function descriptor(dialogType:unknown){return {dialogType};} descriptor(One); descriptor(Two);', (root) => {
        const config = loadConfig(path.join(root, 'config.json'));
        const first = scanProject(config);
        assert.deepEqual(first.manifest.components.map((component) => component.name).sort(), ['One', 'Two']);
        assert.ok(!first.diagnostics.some((diagnostic) => diagnostic.rule === 'input'));
        fs.appendFileSync(path.join(root, 'source.tsx'), 'declare const opaque:unknown; descriptor(opaque);');
        const second = scanProject(config);
        assert.ok(second.diagnostics.some((diagnostic) => diagnostic.rule === 'input' && diagnostic.message.includes('dialogType')));
    });
});

test('awaited import aliases and finite registry lookups are structural candidate definitions', () => {
    fixture('function One(){return <button data-testid="one.close--button"/>;} function Two(){return <button data-testid="two.close--button"/>;} const registry={one:One,two:Two}; declare const key:"one"|"two"; export const descriptor={dialogType:registry[key]}; export async function load(){const {default:Imported}=await import("./imported");return {dialogType:Imported};}', (root) => {
        fs.writeFileSync(path.join(root, 'imported.tsx'), 'export default function Imported(){return <button data-testid="imported.close--button"/>;}');
        const result = scanProject(loadConfig(path.join(root, 'config.json')));
        assert.deepEqual(result.manifest.components.map((component) => component.name).sort(), ['Imported', 'One', 'Two']);
        assert.ok(!result.diagnostics.some((diagnostic) => diagnostic.rule === 'input'));
    });
});

test('Api operations cannot differ only in placeholder names', () => {
    fixture('export function App(){return <button data-testid="app.open--button"/>;}', (root) => {
        // eslint-disable-next-line no-template-curly-in-string -- source under analysis
        fs.writeFileSync(path.join(root, 'client.ts'), 'export class Client4 {doFetch<T>(url: string, options: unknown): Promise<T> {throw new Error(url);} first = (id:string) => this.doFetch(`/api/v4/users/${id}`, {method:"GET"}); second = (user_id:string) => this.doFetch(`/api/v4/users/${user_id}`, {method:"GET"});}');
        const result = scanProject(loadConfig(path.join(root, 'config.json')));
        assert.ok(result.diagnostics.some((diagnostic) => diagnostic.rule === 'collisions' && diagnostic.message.includes('placeholder names')));
    });
});

test('portal container lookup is recorded on its mount and stays separate from its inline parts', () => {
    // eslint-disable-next-line no-template-curly-in-string -- source under analysis
    fixture('import {createPortal} from "react-dom"; function Portal({children}:{children?:unknown}){return createPortal(children, document.body);} function Dialog({testId}:{testId:string}){return <Portal><section role="dialog" data-testid={testId}><button data-testid={`${testId}.close--button`}/></section></Portal>;} export function App(){return <><Dialog testId="first"/><Dialog testId="parent.second"/></>;}', (root) => {
        fs.writeFileSync(path.join(root, 'react-dom.d.ts'), 'declare module "react-dom" {export function createPortal(content:unknown, container:unknown):any;}');
        const result = scanProject(loadConfig(path.join(root, 'config.json')));
        for (const name of ['first', 'parent.second']) {
            const mount = result.report.scopes[name];
            assert.equal(mount.portal, true, name);
            const family = result.report.families[mount.family];
            assert.equal(family.container?.role, null, 'Part.role remains the testid suffix');
            assert.equal(family.container?.portal, undefined, 'container portal lookup is mount-specific');
            assert.equal(family.parts?.close.portal, undefined, 'the close button stays inside the dialog');
        }
    });
});

test('native file inputs cannot carry their own key or serve as a family container', () => {
    fixture('export function App(){return <><input type="file" data-testid="form.upload:one"/><input type="file" data-testid="root"/><span data-testid="root.label--text"/><section data-testid="form.entry:one"><input type="file" data-testid="form.entry.upload"/></section></>;}', (root) => {
        const result = scanProject(loadConfig(path.join(root, 'config.json')));
        assert.ok(result.diagnostics.some((d) => d.severity === 'error' && d.rule === 'key-origin' && d.message === 'A file input is addressed as a part of its item, not by its own key.'));
        assert.ok(result.diagnostics.some((d) => d.severity === 'error' && d.rule === 'collisions' && d.message.includes('file input cannot be a scope container')), JSON.stringify(result.diagnostics));
        const item = result.report.families[result.report.scopes['form.entry'].family];
        assert.deepEqual(item.parts?.upload, {role: null, native: 'file'});
    });
});

test('a menu testid passed in an object prop declares the library list container', () => {
    fixture('import MuiMenuList from "@mui/material/MenuList"; function MenuImpl(props:{menu:{testId?:string};children?:unknown}){return <MuiMenuList data-testid={props.menu.testId}>{props.children}</MuiMenuList>;} const Menu={Container:MenuImpl}; export function App(){return <><Menu.Container menu={{testId:"lhs.category_menu"}}><button data-testid="lhs.category_menu.rename--menuitem"/></Menu.Container><Menu.Container menu={{testId:"lhs.only_menu"}}/></>;}', (root) => {
        const dir = path.join(root, 'node_modules/@mui/material/MenuList');
        fs.mkdirSync(dir, {recursive: true});
        fs.writeFileSync(path.join(dir, 'index.d.ts'), 'export default function MenuList(props:any):any;');
        const result = scanProject(loadConfig(path.join(root, 'config.json')));
        const mount = result.report.scopes['lhs.category_menu'];
        assert.ok(mount);
        assert.deepEqual(result.report.families[mount.family].container, {role: null, source: 'MenuImpl'});
        assert.equal(result.report.scopes['lhs.only_menu'], undefined, 'a menu element with no declared members is a part');
        assert.equal(result.report.families[result.report.scopes.lhs.family].parts?.only_menu.role, null);
    });
});
