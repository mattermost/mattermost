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

test('library field contracts resolve exported aliases and merged declarations in the importing program', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-library-keys-'));
    try {
        installFixtureCompiler(root);
        const pkg = (name: string, files: Record<string, string>) => {
            const dir = path.join(root, 'node_modules', name);
            fs.mkdirSync(dir, {recursive: true});
            fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({name, version: '1.0.0', types: 'index.d.ts'}));
            for (const [file, content] of Object.entries(files)) {
                fs.writeFileSync(path.join(dir, file), content);
            }
        };
        pkg('@table/core', {
            'index.d.ts': 'export {CoreColumn as Column} from "./column"; export type {Header} from "./headers";',
            'column.d.ts': 'export interface CoreColumn<T> {id: string; value: T} export interface CoreColumn<T> {extra?: string}',
            'headers.d.ts': 'export interface CoreHeader<T> {id: string; value: T} export type Header<T> = CoreHeader<T> & {parent?: Header<T>};',
            'esm.d.ts': 'export interface Column<T> {id: string; value: T} export interface Header<T> {id: string; value: T}',
        });
        pkg('@table/react-table', {'index.d.ts': 'export * from "@table/core";'});
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['source.tsx', path.join(FIXTURES, '_lib')]}));
        const config = path.join(root, 'config.json');
        const raw = {root: '.',
            tsconfig: 'tsconfig.json',
            include: ['.'],
            checks: {keyFields: {allow: [
                {entity: 'Column', module: '@table/react-table', field: 'id', value: 'column', reason: 'The library column id identifies a table column.'},
                {entity: 'Header', module: '@table/react-table', field: 'id', value: 'header', reason: 'The library header id identifies a table header.'},
            ]}},
            output: {report: 'surface.json'}};
        fs.writeFileSync(config, JSON.stringify(raw));
        fs.writeFileSync(path.join(root, 'source.tsx'), [
            'import React from "react"; import type {Column, Header} from "@table/react-table"; import type {Column as OtherColumn} from "@table/core/esm";',
            'declare const data: {column: Column<string>; header: Header<string>; other: OtherColumn<string>};',
            'export function App() {return <><span data-testid={"view.column:" + data.column.id + "--text"}/><span data-testid={"view.header:" + data.header.id + "--text"}/><span data-testid={"view.other:" + data.other.id + "--text"}/></>;}',
        ].join('\n'));
        const out = scanProject(loadConfig(config));
        assert.deepEqual(out.diagnostics.filter((diagnostic) => diagnostic.rule === 'allow'), []);
        for (const name of ['column', 'header']) {
            const key = out.manifest.elements.find((element) => element.name === name)?.key;
            assert.equal(key?.kind, 'id', name);
            assert.equal(key?.value, name);
        }
        assert.deepEqual([...new Set(out.diagnostics.filter((diagnostic) => diagnostic.rule === 'key-origin').map((diagnostic) => diagnostic.template))], ['view.other:{key}--text'], 'a same-named type from another module does not match');
        raw.checks.keyFields.allow[0].module = '@table/core/esm';
        fs.writeFileSync(config, JSON.stringify(raw));
        const other = scanProject(loadConfig(config));
        assert.ok(other.diagnostics.some((diagnostic) => diagnostic.rule === 'key-origin' && diagnostic.template === 'view.column:{key}--text'));
        assert.equal(other.manifest.elements.find((element) => element.name === 'other')?.key?.value, 'column');
        raw.checks.keyFields.allow[0].module = '';
        fs.writeFileSync(config, JSON.stringify(raw));
        assert.ok(scanProject(loadConfig(config)).diagnostics.some((diagnostic) => diagnostic.rule === 'allow' && diagnostic.severity === 'error'));
        raw.checks.keyFields.allow[0].module = '@table/react-table';
        fs.writeFileSync(config, JSON.stringify(raw));
        const duplicate = path.join(root, 'other/node_modules/@table/react-table');
        fs.mkdirSync(duplicate, {recursive: true});
        fs.writeFileSync(path.join(duplicate, 'package.json'), JSON.stringify({name: '@table/react-table', version: '2.0.0', types: 'index.d.ts'}));
        fs.writeFileSync(path.join(duplicate, 'index.d.ts'), 'export interface Column<T> {id: string; value: T} export interface Header<T> {id: string; value: T}');
        fs.writeFileSync(path.join(root, 'other/source.ts'), 'import type {Column} from "@table/react-table"; export type Other = Column<string>;');
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['source.tsx', 'other/source.ts', path.join(FIXTURES, '_lib')]}));
        const ambiguous = scanProject(loadConfig(config));
        assert.ok(ambiguous.diagnostics.some((diagnostic) => diagnostic.rule === 'allow' && diagnostic.message.includes('unique Column.id')), 'different package symbols remain ambiguous');
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});
