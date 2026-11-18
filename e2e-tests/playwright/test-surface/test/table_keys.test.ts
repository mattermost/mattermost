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

test('table row keys retain entity fields assigned through mapped row objects at each mount', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-table-keys-'));
    try {
        installFixtureCompiler(root);
        fs.mkdirSync(path.join(root, 'types'));
        fs.writeFileSync(path.join(root, 'types/entities.ts'), 'export interface Policy {id: string} export interface Channel {id: string}');
        fs.mkdirSync(path.join(root, 'node_modules/@tanstack/react-table'), {recursive: true});
        fs.writeFileSync(path.join(root, 'node_modules/@tanstack/react-table/index.d.ts'), 'export type Row<T> = {original: T}; export interface Table<T> {getRowModel(): {rows: Row<T>[]}} export function useReactTable<T>(options: {data: T[]}): Table<T>;');
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['source.tsx', 'types', path.join(FIXTURES, '_lib')]}));
        fs.writeFileSync(path.join(root, 'test-surface.config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], entityTypeDirs: ['types'], checks: {}, output: {report: 'surface.json'}}));
        fs.writeFileSync(path.join(root, 'barrel.ts'), "export {WrappedTable as AdminConsoleListTable} from './source';");
        fs.writeFileSync(path.join(root, 'source.tsx'), [
            "import type {Policy, Channel} from './types/entities';",
            "import {useReactTable, type Row as TableRow, type Table} from '@tanstack/react-table';",
            "import {AdminConsoleListTable} from './barrel';",
            'type Row = {testKey: string; cells: string[]};',
            // eslint-disable-next-line no-template-curly-in-string -- fixture source
            'function DataGridRow({row, testId}: {row: Row; testId: string}) {const {testKey} = row; return <div data-testid={`${testId}.row:${testKey}--row`}/>;}',
            'function DataGrid({rows, testId}: {rows: Row[]; testId: string}) {return <div data-testid={testId}>{rows.map((row) => <DataGridRow row={row} testId={testId}/>)}</div>;}',
            // eslint-disable-next-line no-template-curly-in-string -- fixture source
            'function ListTable<T extends {id: string}>({data, testId}: {data: T[]; testId: string}) {const table = useReactTable({data}); return <div data-testid={testId}>{table.getRowModel().rows.map((row) => <div data-testid={`${testId}.row:${row.original.id}--row`}/>)}</div>;}',
            // eslint-disable-next-line no-template-curly-in-string -- fixture source
            'function DraggableRow<T extends {id: string}>({row, testId}: {row: TableRow<T>; testId: string}) {return <div data-testid={`${testId}.row:${row.original.id}--row`}/>;}',
            'export function WrappedTable<T extends {id: string}>(props: {table: Table<T>; testId: string}) {return <div data-testid={props.testId}>{props.table.getRowModel().rows.map((row) => <DraggableRow row={row} testId={props.testId}/>)}</div>;}',
            'export function WrappedMounts() {const policiesTable = useReactTable({data: policies}); const channelsTable = useReactTable({data: channels}); return <><AdminConsoleListTable<Policy> table={policiesTable} testId="tables.wrapped_policies"/><AdminConsoleListTable table={channelsTable} testId="tables.wrapped_channels"/></>;}',
            'declare const policies: Policy[]; declare const channels: Channel[]; declare const plain: string[];',
            'export function App() {return <><DataGrid testId="tables.policies" rows={policies.map((policy) => ({testKey: policy.id, cells: []}))}/><DataGrid testId="tables.channels" rows={channels.map((channel) => ({testKey: channel.id, cells: []}))}/><DataGrid testId="tables.bad" rows={plain.map((label) => ({testKey: label, cells: []}))}/><ListTable<Policy> testId="tables.list_policies" data={policies}/><ListTable<Channel> testId="tables.list_channels" data={channels}/><ListTable testId="tables.list_inferred" data={policies}/></>;}',
        ].join('\n'));
        const scanned = scanProject(loadConfig(path.join(root, 'test-surface.config.json')));
        for (const [scope, entity] of [['tables.policies', 'Policy'], ['tables.channels', 'Channel'], ['tables.list_policies', 'Policy'], ['tables.list_channels', 'Channel'], ['tables.list_inferred', 'Policy'], ['tables.wrapped_policies', 'Policy'], ['tables.wrapped_channels', 'Channel']]) {
            const key = scanned.manifest.elements.find((element) => element.template === `${scope}.row:{key}--row`)?.key;
            assert.equal(key?.kind, 'entity', `${scope}: ${JSON.stringify(key)}`);
            assert.equal(key?.entity, entity, scope);
        }
        assert.deepEqual([...new Set(scanned.diagnostics.filter((diagnostic) => diagnostic.rule === 'key-origin' && diagnostic.severity === 'error').map((diagnostic) => diagnostic.template))], ['tables.bad.row:{key}--row']);
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});

/* eslint-disable no-template-curly-in-string -- fixture source */

const TABLE = [
    "declare module '@tanstack/react-table' {",
    '    export interface Row<T> {id: string; original: T}',
    '    export interface Table<T> {getRowModel(): {rows: Array<Row<T>>}}',
    '    export function useReactTable<T>(options: {data: T[]}): Table<T>;',
    '}',
].join('\n');

test('a generic table\'s row id is keyed by the keyFields entry of the row type each mount passes, a local or intersection type too', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-table-keys-'));
    try {
        installFixtureCompiler(root);
        fs.mkdirSync(path.join(root, 'types'));
        fs.writeFileSync(path.join(root, 'types/entities.ts'), 'export interface PropertyField {id: string; name: string}');
        fs.writeFileSync(path.join(root, 'table.d.ts'), TABLE);
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['*.tsx', '*.ts', 'types', path.join(FIXTURES, '_lib')]}));
        const allow = [
            {entity: 'ListingTableRow', module: './screens', field: 'id', value: 'attribute', freeForm: true, reason: 'A listed attribute is identified by its id.'},
            {entity: 'ClassificationLevel', module: './screens', field: 'id', value: 'level', freeForm: true, reason: 'A classification level is identified by its id.'},
        ];
        fs.writeFileSync(path.join(root, 'test-surface.config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], exclude: ['/table\\.d\\.ts$'], entityTypeDirs: ['types'], checks: {keyFields: {allow}}, output: {report: 'surface.json'}}));
        fs.writeFileSync(path.join(root, 'list_table.tsx'), [
            "import React from 'react'; import type {Row, Table} from '@tanstack/react-table';",
            'interface Mandatory {id: string}',
            'function DraggableRow<T extends Mandatory>({row, testIdScope}: {row: Row<T>; testIdScope?: string}) {return <tr data-testid={testIdScope ? `${testIdScope}.row:${row.original.id}` : undefined}/>;}',
            'export function ListTable<T extends Mandatory>(props: {table: Table<T>; testIdScope?: string}) {return <table data-testid={props.testIdScope}>{props.table.getRowModel().rows.map((row) => <DraggableRow key={row.id} row={row} testIdScope={props.testIdScope}/>)}</table>;}',
        ].join('\n'));
        fs.writeFileSync(path.join(root, 'screens.tsx'), [
            "import React from 'react'; import {useReactTable} from '@tanstack/react-table'; import {ListTable} from './list_table'; import type {PropertyField} from './types/entities';",
            'type GlobalAttributeListingRow = {name: string; type: string};',
            'type ListingTableRow = GlobalAttributeListingRow & {id: string};',
            'type ClassificationLevel = {id: string; name: string; color: string};',
            'declare const fields: PropertyField[]; declare const rows: ListingTableRow[]; declare const levels: ClassificationLevel[];',
            "export function Fields() {const table = useReactTable<PropertyField>({data: fields}); return <ListTable table={table} testIdScope='admin.fields'/>;}",
            "export function Attributes() {const table = useReactTable<ListingTableRow>({data: rows}); return <ListTable table={table} testIdScope='admin.attributes'/>;}",
            "export function Levels() {const table = useReactTable({data: levels}); return <ListTable table={table} testIdScope='admin.levels'/>;}",
        ].join('\n'));
        const scanned = scanProject(loadConfig(path.join(root, 'test-surface.config.json')));
        const errors = scanned.diagnostics.filter((diagnostic) => diagnostic.rule === 'key-origin' && diagnostic.severity === 'error').map((diagnostic) => diagnostic.message);
        assert.deepEqual(errors, []);
        const key = (scope: string) => {
            const mount = scanned.report.scopes[scope];
            const bind = mount?.bind?.row;
            return bind && bind.key;
        };
        assert.deepEqual(key('admin.fields'), {kind: 'id', entity: 'PropertyField', field: 'id', from: '@mattermost/types/entities'});
        assert.deepEqual(key('admin.attributes'), {kind: 'id', value: 'attribute'});
        assert.deepEqual(key('admin.levels'), {kind: 'id', value: 'level'});
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});
