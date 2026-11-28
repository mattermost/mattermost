// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';

import {scanFixture, scanSource, withSource} from './helpers.ts';

import {keyOf, keyOfTestId, keyedPattern} from '../lint/grammar.js';
import {incompatibleKinds, keyInfo, keyKinds} from '../src/scan/keys.ts';
import {type Gap} from '../src/values/index.ts';

/* eslint-disable no-template-curly-in-string -- fixture source */

const diagnostics = () => scanFixture('keys').diagnostics.filter((item) => item.rule === 'key-origin');

test('keys: known prefix and suffix preserve every character of a raw id', () => {
    for (const value of ['com.mattermost.calls', 'ServiceSettings.SiteURL', 'a:b--c', 'a--button', 'a\nb', '["x"]']) {
        const testId = `x.item:${value}--text`;
        assert.equal(keyOf(testId, 'x.item:', '--text'), value);
        assert.equal(keyOfTestId(testId), value);
        assert.ok(keyedPattern('x.item:', '--text').test(testId));
    }
    assert.equal(keyOf('other.item:x--text', 'x.item:', '--text'), null);
    assert.equal(keyOf('x.item:--text', 'x.item:', '--text'), null);
});

test('keys: strict origins reject names and untyped strings but retain entity ids', () => {
    const errors = diagnostics();
    for (const name of ['name', 'raw', 'typed_raw']) {
        assert.ok(errors.some((item) => item.template?.startsWith(`keys.${name}:`)), name);
    }
    for (const name of ['id', 'plugin']) {
        assert.ok(!errors.some((item) => item.template?.startsWith(`keys.${name}:`)), name);
    }
});

test('keys: free-form origins and ambiguous sets need role suffixes', () => {
    for (const name of ['raw', 'bare_plugin', 'ambiguous']) {
        assert.ok(diagnostics().some((item) => item.template?.startsWith(`keys.${name}:`) && item.message.includes('role suffix')), name);
    }
});

test('keys: composite keys and keyed scopes are explicit errors', () => {
    assert.ok(diagnostics().some((item) => item.template?.startsWith('keys.composite:') && item.message.includes('multiple pieces')));
    assert.ok(diagnostics().some((item) => item.message.includes('component scope cannot contain a key')));
});

test('an element taken by iterating an array field takes that field\'s keyFields entry, in for-of and in callbacks', () => {
    const allow = [{entity: 'Group', module: './source', field: 'permissions', value: 'permission', reason: 'A permission is identified by its name.'}];
    const scanned = scanSource({
        'source.tsx': [
            "import React from 'react';",
            'type Group = {id: string; permissions: string[]; extras: string[]};',
            'export function Group({group}: {group: Group}) {',
            '    const rows = [];',
            '    for (const permission of group.permissions) { rows.push(<li data-testid={`perm.row:${permission}--listitem`}/>); }',
            '    return (',
            "        <ul data-testid='perm'>",
            '            {rows}',
            '            {group.permissions.map((name) => <li data-testid={`perm.check:${name}--checkbox`}/>)}',
            '            {group.extras.map((extra) => <li data-testid={`perm.extra:${extra}--listitem`}/>)}',
            '        </ul>',
            '    );',
            '}',
        ].join('\n'),
    }, {include: ['source.tsx'], config: {checks: {keyFields: {allow}}}});
    const errors = scanned.diagnostics.filter((diagnostic) => diagnostic.rule === 'key-origin' && diagnostic.severity === 'error');
    assert.deepEqual([...new Set(errors.map((error) => error.template))], ['perm.extra:{key}--listitem'], 'a field with no entry stays open');
    const parts = scanned.report.families[scanned.report.scopes.perm.family].parts ?? {};
    assert.deepEqual(parts.row?.key, {kind: 'id', value: 'permission'}, JSON.stringify(parts.row));
    assert.deepEqual(parts.check?.key, {kind: 'id', value: 'permission'}, JSON.stringify(parts.check));
});

test('a literal-plus-spread array keeps its literal for its own arm and keys the spread elements by their field\'s entry', () => {
    const allow = [{entity: 'Props', module: './source', field: 'nodes', value: 'node', reason: 'A cluster node is identified by its name.'}];
    const scanned = scanSource({
        'source.tsx': [
            "import React from 'react';",
            'type Props = {nodes: string[]; selectedNode: string};',
            'export function NodeMenu({nodes, selectedNode}: Props) {',
            "    return <ul data-testid='logs'>{['', ...nodes].map((node) => <li data-testid={node ? `logs.node:${node}--menuitemradio` : 'logs.all_nodes--menuitemradio'} aria-checked={selectedNode === node}/>)}</ul>;",
            '}',
            'type Log = {node: string; message: string};',
            'declare function useState<T>(value: T): [T, (value: T) => void];',
            'export function Logs({logs}: {logs: Log[]}) {',
            "    const [selectedNode] = useState('');",
            '    const seen = new Map<string, number>();',
            '    for (const log of logs) { seen.set(log.node, (seen.get(log.node) ?? 0) + 1); }',
            '    const nodes = [...seen.keys(), ...(selectedNode ? [selectedNode] : [])];',
            '    return <NodeMenu nodes={nodes} selectedNode={selectedNode}/>;',
            '}',
        ].join('\n'),
    }, {include: ['source.tsx'], config: {checks: {keyFields: {allow}}}});
    const errors = scanned.diagnostics.filter((diagnostic) => diagnostic.severity === 'error').map((diagnostic) => diagnostic.message);
    assert.deepEqual(errors, []);
    const parts = scanned.report.families[scanned.report.scopes.logs.family].parts ?? {};
    assert.deepEqual(parts.node?.key, {kind: 'id', value: 'node'}, JSON.stringify(parts.node));
    assert.equal(parts.all_nodes?.role, 'menuitemradio', JSON.stringify(parts));
});

test('a key read from a field a keyFields entry names stops at that field, whatever object literal a mount builds it from', () => {
    const allow = [{entity: 'Group', module: './source', field: 'id', value: 'permission', freeForm: true, reason: 'A permission group is identified by its id.'}];
    const scanned = scanSource({
        'source.tsx': [
            "import React from 'react';",
            'type Group = {id: string; permissions: Array<string | Group>};',
            'type Props = {id: string; permissions: Array<string | Group>};',
            'class PermissionGroup extends React.Component<Props> {',
            '    render() {',
            '        const {id, permissions} = this.props;',
            "        return <div data-testid={`perms.group:${id}--region`}>{permissions.map((p) => (typeof p === 'string' ? null : <PermissionGroup id={p.id} permissions={p.permissions}/>))}</div>;",
            '    }',
            '}',
            'declare function useMemo<T>(factory: () => T, deps: unknown[]): T;',
            'export function GuestTree({permissions}: {permissions: string[]}) {',
            '    const groups = useMemo(() => permissions.map((permission) => ({id: `guest_${permission}`, permissions: [permission]})), [permissions]);',
            "    return <div data-testid='perms'><PermissionGroup id='guest_reactions' permissions={groups}/></div>;",
            '}',
        ].join('\n'),
    }, {include: ['source.tsx'], config: {checks: {keyFields: {allow}}}});
    const errors = scanned.diagnostics.filter((diagnostic) => diagnostic.severity === 'error').map((diagnostic) => diagnostic.message);
    assert.deepEqual(errors, []);
    assert.deepEqual(scanned.report.families[scanned.report.scopes.perms.family].parts?.group?.key, {kind: 'id', value: 'permission'});
});

test('a list element narrowed to a literal still takes the broader items that can hold it', () => {
    const scanned = scanSource({
        'source.tsx': [
            "import React from 'react';",
            'declare const items: string[];',
            'function Row({value}: {value: string}) {return <div data-testid={`owners.mixed:${value}--region`}/>;}',
            "export function Owners() {return <div data-testid='owners'>{items.map((value) => (value === 'known' ? <Row value={value}/> : null))}</div>;}",
        ].join('\n'),
    }, {include: ['source.tsx'], config: {checks: {}}});
    const templates = scanned.manifest.elements.map((element) => element.template);
    assert.ok(templates.includes('owners.mixed:{key}--region'), `the row is kept: ${JSON.stringify(templates)}`);
    assert.ok(scanned.diagnostics.some((diagnostic) => diagnostic.rule === 'key-origin' && diagnostic.severity === 'error'), 'its open string key is still reported');
});

test('a list element narrowed by typeof before it reaches a helper keys only by the elements that fit there', () => {
    const allow = [
        {entity: 'Group', module: './source', field: 'permissions', value: 'permission', freeForm: true, reason: 'A permission is identified by its name.'},
        {entity: 'Group', module: './source', field: 'id', value: 'permission', freeForm: true, reason: 'A permission group is identified by its id.'},
    ];
    const scanned = scanSource({
        'source.tsx': [
            "import React from 'react';",
            'type Group = {id: string; permissions: Array<string | Group>};',
            'type Props = {id: string; permissions: Array<string | Group>};',
            'class PermissionGroup extends React.Component<Props> {',
            '    renderPermission = (permission: string) => <div data-testid={`perms.row:${permission}`}/>;',
            '    render() {',
            '        const {id, permissions} = this.props;',
            "        const rows = permissions.map((group) => (typeof group === 'string' ? this.renderPermission(group) : <PermissionGroup id={group.id} permissions={group.permissions}/>));",
            '        return <div data-testid={`perms.group:${id}--region`}>{rows}</div>;',
            '    }',
            '}',
            'export class Tree extends React.Component<{}> {',
            "    groups: Group[] = [{id: 'teams', permissions: ['create_team', {id: 'team_roles', permissions: ['manage_team_roles']}]}];",
            "    render() {return <div data-testid='perms'><PermissionGroup id='all' permissions={this.groups}/></div>;}",
            '}',
        ].join('\n'),
    }, {include: ['source.tsx'], config: {checks: {keyFields: {allow}}}});
    const errors = scanned.diagnostics.filter((diagnostic) => diagnostic.severity === 'error').map((diagnostic) => diagnostic.message);
    assert.deepEqual(errors, []);
    assert.deepEqual(scanned.report.families[scanned.report.scopes.perms.family].parts?.row?.key, {kind: 'id', value: 'permission'});
});

test('keys read under a type guard retain the narrowed entity behind a selector union', () => {
    withSource({
        'types/entities.ts': 'export interface PluginManifest {id: string} export interface AppManifest {app_id: string} export interface MarketplacePlugin {manifest: PluginManifest} export interface MarketplaceApp {manifest: AppManifest}',
        'source.tsx': [
            "import {useMemo} from 'react'; import {useSelector} from 'react-redux'; import type {MarketplacePlugin, MarketplaceApp} from './types/entities';",
            'declare function getListing(state: unknown): Array<MarketplacePlugin | MarketplaceApp>; declare function isPlugin(item: MarketplacePlugin | MarketplaceApp): item is MarketplacePlugin;',
            // eslint-disable-next-line no-template-curly-in-string -- fixture source
            'function Item({testId, id}: {testId: string; id: string}) {return <div role="region" data-testid={`${testId}.entry:${id}--region`}/>;}',
            'export function App() {const listing = useSelector(getListing); const items = useMemo(() => [...listing].slice(0, 15).map((item) => isPlugin(item) ? <Item testId="marketplace.plugins" id={item.manifest.id}/> : <Item testId="marketplace.apps" id={item.manifest.app_id}/>), [listing]); return <div>{items}</div>;}',
        ].join('\n'),
    }, {include: ['source.tsx', 'types'], config: {entityTypeDirs: ['types'], checks: {}}}, ({root, scan}) => {
        const scanned = scan();
        assert.deepEqual(scanned.diagnostics.filter((diagnostic) => diagnostic.rule === 'key-origin'), []);
        for (const [scope, entity, field] of [['marketplace.plugins', 'PluginManifest', 'id'], ['marketplace.apps', 'AppManifest', 'app_id']]) {
            const key = scanned.manifest.elements.find((element) => element.template === `${scope}.entry:{key}--region`)?.key;
            assert.equal(key?.kind, 'entity');
            assert.equal(key?.entity, entity);
            assert.equal(key?.field, field);
        }
        const sourcePath = path.join(root, 'source.tsx');
        fs.writeFileSync(sourcePath, fs.readFileSync(sourcePath, 'utf8').replaceAll('marketplace.plugins', 'marketplace').replaceAll('marketplace.apps', 'marketplace'));
        assert.ok(scan().diagnostics.some((diagnostic) => diagnostic.rule === 'key-origin' && diagnostic.template === 'marketplace.entry:{key}--region'), 'two distinct entity identities cannot be guessed into one key type');
    });
});

test('options built by an optional-chained map take the keyFields entry of the field their value comes from', () => {
    const allow = [{entity: 'AppSelectOption', field: 'value', value: 'option', freeForm: true, reason: 'An app form option is identified by its value.'}];
    const scanned = scanSource({
        'types/apps.ts': 'export type AppSelectOption = {label: string; value: string}; export type AppField = {name: string; options?: AppSelectOption[]};',
        'source.tsx': [
            "import React from 'react'; import type {AppField} from './types/apps';",
            'type Option = {text: string; value: string};',
            'function RadioSetting({options = [], testId}: {options?: Option[]; testId?: string}) {',
            '    return <div data-testid={testId}>{options.map(({value: option, text}) => <input key={option} type="radio" aria-label={text} data-testid={testId ? `${testId}.option:${option}--radio` : undefined}/>)}</div>;',
            '}',
            "export function AppsFormField({field}: {field: AppField}) {return <RadioSetting testId='apps_form.field' options={field.options?.map((o) => ({text: o.label, value: o.value}))}/>;}",
        ].join('\n'),
    }, {include: ['*.tsx', 'types'], config: {entityTypeDirs: ['types'], checks: {keyFields: {allow}}}});
    const errors = scanned.diagnostics.filter((diagnostic) => diagnostic.rule === 'key-origin' && diagnostic.severity === 'error').map((diagnostic) => diagnostic.message);
    assert.deepEqual(errors, []);
    const mount = scanned.report.scopes['apps_form.field'];
    const part = scanned.report.families[mount.family].parts?.option;
    assert.deepEqual(part?.key, {kind: 'id', entity: 'AppSelectOption', field: 'value', from: '@mattermost/types/apps'}, JSON.stringify(part));
});

test('typed entity and numeric keys retain missing alternatives unless their use is guarded', () => {
    const source = [
        'import React from "react"; import type {User} from "./types/user";',
        'function helper(id: User["id"] | undefined, position?: number) {return <><button data-testid={"view.arg_entity:" + id + "--button"}/><button data-testid={"view.arg_position:" + position + "--button"}/></>;}',
        'function Item({user, position}: {user?: User; position?: number}) {return <section>',
        '<button data-testid={"view.entity:" + user?.id + "--button"}/>',
        '<button data-testid={"view.position:" + position + "--button"}/>',
        '<button data-testid={user ? "view.guarded:" + user.id + "--button" : undefined}/>',
        '<button data-testid={position !== undefined ? "view.guarded_position:" + position + "--button" : undefined}/>',
        '{helper(user?.id, position)}',
        '</section>;}',
        'export function App() {return <><Item user={{id: "abc"}} position={0}/><Item/></>;}',
    ].join('\n');
    const out = scanSource({
        'types/user.ts': 'export type User = {id: string};',
        'source.tsx': source,
    }, {include: ['source.tsx', 'types'], config: {entityTypeDirs: ['types'], checks: {strictPaths: ['source.tsx']}}, configFile: 'config.json'});
    const missing = out.diagnostics.filter((diagnostic) => diagnostic.rule === 'undefined');
    assert.equal(missing.length, 4, JSON.stringify(missing));
    assert.equal(missing.filter((diagnostic) => diagnostic.at.startsWith('source.tsx:2:')).length, 2, 'helper arguments keep the missing alternatives');
    assert.ok(missing.every((diagnostic) => diagnostic.severity === 'error'));
    assert.ok(missing.some((diagnostic) => diagnostic.at.startsWith('source.tsx:4:')), 'the entity access reports its missing alternative');
    assert.ok(missing.some((diagnostic) => diagnostic.at.startsWith('source.tsx:5:')), 'the numeric access reports its missing alternative');
    assert.ok(!missing.some((diagnostic) => diagnostic.at.startsWith('source.tsx:6:') || diagnostic.at.startsWith('source.tsx:7:')));
    const entity = out.manifest.elements.find((element) => element.template === 'view.entity:{key}--button');
    assert.equal(entity?.key?.entity, 'User');
    assert.equal(entity?.key?.field, 'id');
    assert.equal(entity?.key?.module, '@mattermost/types/user');
});

test('suggestion terms retain their configured key origin through renderItem arguments', () => {
    withSource({
        'source.tsx': [
            'type Results = {items: unknown[]; terms: string[]; groups: Results[]};',
            // eslint-disable-next-line no-template-curly-in-string -- fixture source
            'export function Suggestions({results}: {results: Results}) {function renderItem(item: unknown, term: string) {return <li role="option" data-testid={`suggestions.suggestion:${term}--option`}/>;} const contents = []; for (let i = 0; i < results.items.length; i++) {contents.push(renderItem(results.items[i], results.terms[i]));} for (const group of results.groups) {contents.push(group.items.map((item, i) => renderItem(item, group.terms[i])));} return <ul>{contents}</ul>;}',
            // eslint-disable-next-line no-template-curly-in-string -- fixture source
            'export function ArrayProperty({results}: {results: Results}) {return <li role="option" data-testid={`suggestions.length:${results.terms["length"]}--option`}/>;}',
        ].join('\n'),
    }, {include: ['*.tsx'], config: {checks: {keyFields: {allow: [{entity: 'Results', module: './source', field: 'terms', value: 'term', reason: 'Terms identify suggestions across reordering.'}]}}}}, ({scan, readConfig}) => {
        const config = readConfig();
        const scanned = scan(config);
        assert.deepEqual(scanned.diagnostics.filter((diagnostic) => diagnostic.rule === 'key-origin' || diagnostic.rule === 'allow'), []);
        const key = scanned.manifest.elements.find((element) => element.template === 'suggestions.suggestion:{key}--option')?.key;
        assert.equal(key?.kind, 'id');
        assert.equal(key?.value, 'term');
        assert.equal(scanned.manifest.elements.find((element) => element.template === 'suggestions.length:{key}--option')?.key?.kind, 'number');
        config.checks.keyFields.allow = [];
        assert.ok(scan(config).diagnostics.some((diagnostic) => diagnostic.rule === 'key-origin' && diagnostic.template === 'suggestions.suggestion:{key}--option'));
    });
});

test('table row keys retain entity fields assigned through mapped row objects at each mount', () => {
    const scanned = scanSource({
        'types/entities.ts': 'export interface Policy {id: string} export interface Channel {id: string}',
        'node_modules/@tanstack/react-table/index.d.ts': 'export type Row<T> = {original: T}; export interface Table<T> {getRowModel(): {rows: Row<T>[]}} export function useReactTable<T>(options: {data: T[]}): Table<T>;',
        'barrel.ts': "export {WrappedTable as AdminConsoleListTable} from './source';",
        'source.tsx': [
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
        ].join('\n'),
    }, {include: ['source.tsx', 'types'], config: {entityTypeDirs: ['types'], checks: {}}});
    for (const [scope, entity] of [['tables.policies', 'Policy'], ['tables.channels', 'Channel'], ['tables.list_policies', 'Policy'], ['tables.list_channels', 'Channel'], ['tables.list_inferred', 'Policy'], ['tables.wrapped_policies', 'Policy'], ['tables.wrapped_channels', 'Channel']]) {
        const key = scanned.manifest.elements.find((element) => element.template === `${scope}.row:{key}--row`)?.key;
        assert.equal(key?.kind, 'entity', `${scope}: ${JSON.stringify(key)}`);
        assert.equal(key?.entity, entity, scope);
    }
    assert.deepEqual([...new Set(scanned.diagnostics.filter((diagnostic) => diagnostic.rule === 'key-origin' && diagnostic.severity === 'error').map((diagnostic) => diagnostic.template))], ['tables.bad.row:{key}--row']);
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
    const allow = [
        {entity: 'ListingTableRow', module: './screens', field: 'id', value: 'attribute', freeForm: true, reason: 'A listed attribute is identified by its id.'},
        {entity: 'ClassificationLevel', module: './screens', field: 'id', value: 'level', freeForm: true, reason: 'A classification level is identified by its id.'},
    ];
    const scanned = scanSource({
        'types/entities.ts': 'export interface PropertyField {id: string; name: string}',
        'table.d.ts': TABLE,
        'list_table.tsx': [
            "import React from 'react'; import type {Row, Table} from '@tanstack/react-table';",
            'interface Mandatory {id: string}',
            'function DraggableRow<T extends Mandatory>({row, testIdScope}: {row: Row<T>; testIdScope?: string}) {return <tr data-testid={testIdScope ? `${testIdScope}.row:${row.original.id}` : undefined}/>;}',
            'export function ListTable<T extends Mandatory>(props: {table: Table<T>; testIdScope?: string}) {return <table data-testid={props.testIdScope}>{props.table.getRowModel().rows.map((row) => <DraggableRow key={row.id} row={row} testIdScope={props.testIdScope}/>)}</table>;}',
        ].join('\n'),
        'screens.tsx': [
            "import React from 'react'; import {useReactTable} from '@tanstack/react-table'; import {ListTable} from './list_table'; import type {PropertyField} from './types/entities';",
            'type GlobalAttributeListingRow = {name: string; type: string};',
            'type ListingTableRow = GlobalAttributeListingRow & {id: string};',
            'type ClassificationLevel = {id: string; name: string; color: string};',
            'declare const fields: PropertyField[]; declare const rows: ListingTableRow[]; declare const levels: ClassificationLevel[];',
            "export function Fields() {const table = useReactTable<PropertyField>({data: fields}); return <ListTable table={table} testIdScope='admin.fields'/>;}",
            "export function Attributes() {const table = useReactTable<ListingTableRow>({data: rows}); return <ListTable table={table} testIdScope='admin.attributes'/>;}",
            "export function Levels() {const table = useReactTable({data: levels}); return <ListTable table={table} testIdScope='admin.levels'/>;}",
        ].join('\n'),
    }, {include: ['*.tsx', '*.ts', 'types'], config: {exclude: ['/table\\.d\\.ts$'], entityTypeDirs: ['types'], checks: {keyFields: {allow}}}});
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
});

function scan(files: Record<string, string[]>, allow: unknown[]) {
    const scanned = scanSource({
        'types/entities.ts': 'export interface Team {id: string; display_name: string}',
        ...Object.fromEntries(Object.entries(files).map(([file, lines]) => [file, lines.join('\n')])),
    }, {include: ['*.tsx', 'menu', 'types'], config: {entityTypeDirs: ['types'], checks: {keyFields: {allow}}}});
    const errors = scanned.diagnostics.filter((diagnostic) => diagnostic.severity === 'error').map((diagnostic) => diagnostic.message);
    return {report: scanned.report, errors};
}

test('a key a component writes from its own testKey prop is read from each mount, also through a namespace object', () => {
    const {report, errors} = scan({'source.tsx': [
        "import React from 'react'; import type {Team} from './types/entities';",
        'type Section = {key: string; title: string};',
        'type TitleProps = {testId?: string; testKey: string; text: string};',
        'function MenuTitle({testId, testKey, text}: TitleProps) {return <h3 data-testid={testId ? `${testId}:${testKey}--text` : undefined}>{text}</h3>;}',
        'export const Menu = {Title: MenuTitle};',
        'declare const sections: Section[]; declare const teams: Team[];',
        "export function Page() {return <div data-testid='page'>{sections.map((section) => <MenuTitle testId='page.section' testKey={section.key} text={section.title}/>)}{teams.map((team) => <Menu.Title testId='page.team' testKey={team.id} text={team.display_name}/>)}<Menu.Title testId='page.fixed' testKey='about' text='About'/></div>;}",
    ]}, [{entity: 'Section', module: './source', field: 'key', value: 'section', reason: 'A section is identified by its key.'}]);
    assert.deepEqual(errors, []);
    const parts = report.families[report.scopes.page.family].parts ?? {};
    assert.deepEqual(parts.section?.key, {kind: 'id', value: 'section'}, JSON.stringify(parts.section));
    assert.deepEqual(parts.team?.key, {kind: 'id', entity: 'Team', field: 'id', from: '@mattermost/types/entities'}, JSON.stringify(parts.team));
    const fixed = parts.fixed?.key;
    assert.ok(fixed && fixed.kind === 'set', JSON.stringify(parts.fixed));
    assert.deepEqual(report.sets[fixed.set], ['about']);
});

test('the menu title shape: props read from the props object, an assigned testid, an optional key, a namespace import, a loop over a memo', () => {
    const {report, errors} = scan({
        'menu/menu_title.tsx': [
            "import React from 'react';",
            'export interface Props {children: React.ReactNode; role?: string; separatorTestId?: string; testId?: string; testKey?: string}',
            'export function MenuTitle(props: Props) {',
            '    const {children, role, separatorTestId, testId, testKey} = props;',
            '    let titleTestId;',
            '    if (separatorTestId) {',
            '        titleTestId = `${separatorTestId}--separator`;',
            '    } else if (testId) {',
            "        titleTestId = `${testId}${testKey ? `:${testKey}` : ''}--text`;",
            '    }',
            '    return <h4 role={role} data-testid={titleTestId}>{children}</h4>;',
            '}',
        ],
        'menu/index.ts': ["export {MenuTitle as Title} from './menu_title';"],
        'source.tsx': [
            "import React, {useMemo} from 'react'; import * as Menu from './menu';",
            'type MenuSection = {key: string; title: string; entries: string[]};',
            'declare const all: MenuSection[];',
            'export function OperatorMenu({testId}: {testId?: string}) {',
            '    const sections = useMemo((): MenuSection[] => all.filter((section) => section.entries.length > 0), []);',
            '    const menuItems: React.ReactNode[] = [];',
            '    for (const section of sections) {',
            '        if (section.title) {',
            "            menuItems.push(<Menu.Title key={`${section.key}-title`} role='presentation' testId={testId ? `${testId}.operator_menu.group` : undefined} testKey={section.key}>{section.title}</Menu.Title>);",
            '        }',
            '    }',
            '    return <div data-testid={testId}>{menuItems}</div>;',
            '}',
            "export function Page() {return <OperatorMenu testId='rules'/>;}",
        ],
    }, [{entity: 'MenuSection', module: './source', field: 'key', value: 'operator_group', reason: 'An operator group is identified by its key.'}]);
    assert.deepEqual(errors, []);
    const scope = Object.entries(report.scopes).find(([name]) => name === 'rules.operator_menu');
    assert.ok(scope, Object.keys(report.scopes).join(', '));
    const parts = report.families[scope[1].family].parts ?? {};
    assert.deepEqual(parts.group?.key, {kind: 'id', value: 'operator_group'}, JSON.stringify(parts));
});

test('entity aggregation distinguishes public modules even without declaration metadata', () => {
    const gaps: Gap[] = ['@types/a', '@types/b'].map((module) => ({kind: 'entity', entity: 'Record', field: 'id', module, type: 'string', expr: 'record.id'}));
    assert.ok(incompatibleKinds(keyKinds(new Set(), gaps)!));
    assert.equal(keyInfo(new Set(), gaps)?.kind, 'string');
});

test('entity aggregation preserves declaration identity while accepting aliases of the same declaration', () => {
    withSource({
        'a/record.ts': 'export type Record = {id: string};',
        'b/record.ts': 'export type Record = {id: string};',
        'a/index.ts': 'export type {Record as Alias} from "./record";',
    }, {include: ['source.tsx', 'a', 'b'], configFile: 'config.json'}, ({root, configPath, scan}) => {
        const writeConfig = (sameModule: boolean) => fs.writeFileSync(configPath, JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], entityTypeDirs: ['a', 'b'], entityTypeModules: {a: '@types/a', b: sameModule ? '@types/a' : '@types/b'}, output: {report: 'surface.json'}}));
        const source = (target: string, name: string) => [
            'import React from "react"; import type {Record} from "./a/record";',
            `import type {${name} as Other} from "${target}";`,
            'declare const first: Record; declare const second: Other;',
            'export function App() {return <section data-testid="view"><button data-testid={"view.entry:" + first.id + "--button"}/><button data-testid={"view.entry:" + second.id + "--button"}/></section>;}',
        ].join('\n');
        fs.writeFileSync(path.join(root, 'source.tsx'), source('./b/record', 'Record'));
        for (const sameModule of [false, true]) {
            writeConfig(sameModule);
            const out = scan();
            assert.ok(out.diagnostics.some((diagnostic) => diagnostic.rule === 'collisions' && diagnostic.message.includes('key')), JSON.stringify(out.diagnostics));
            assert.equal(out.manifest.elements.find((element) => element.name === 'entry')?.key?.kind, 'string');
        }
        fs.writeFileSync(path.join(root, 'source.tsx'), source('./a/index', 'Alias'));
        writeConfig(false);
        const out = scan();
        assert.ok(!out.diagnostics.some((diagnostic) => diagnostic.rule === 'collisions'), JSON.stringify(out.diagnostics));
        const key = out.manifest.elements.find((element) => element.name === 'entry')?.key;
        assert.equal(key?.kind, 'entity');
        assert.equal(key?.module, '@types/a/record');
    });
});

test('render helper arguments keep built-in and plugin tab names paired with their own key origins', () => {
    const scanned = scanSource({
        'source.tsx': [
            'type SidebarTab = {name: string}; type Registration = {id: string}; declare const registrations: Registration[];',
            'const builtIns = [{name: "info"}, {name: "members"}] as const;',
            'function getPluginTabName(id: string) {return "plugin_" + id;} const pluginTabs: SidebarTab[] = registrations.map((registration) => ({name: getPluginTabName(registration.id)}));',
            // eslint-disable-next-line no-template-curly-in-string -- fixture source
            'function renderTab(tab: SidebarTab, name: "tab" | "plugin") {return <button role="tab" data-testid={`sidebar.tabs.${name}:${tab.name}--tab`}/>;}',
            'export function Sidebar() {return <div>{builtIns.map((tab) => renderTab(tab, "tab"))}{pluginTabs.map((tab) => renderTab(tab, "plugin"))}</div>;}',
        ].join('\n'),
    }, {include: ['*.tsx'], config: {checks: {keyFields: {allow: [{entity: 'SidebarTab', module: './source', field: 'name', value: 'plugin_tab', reason: 'The plugin tab is identified by the name the modal gives it.'}]}}}});
    assert.deepEqual(scanned.diagnostics.filter((diagnostic) => diagnostic.rule === 'key-origin'), []);
    const tab = scanned.manifest.elements.find((element) => element.template === 'sidebar.tabs.tab:{key}--tab');
    const plugin = scanned.manifest.elements.find((element) => element.template === 'sidebar.tabs.plugin:{key}--tab');
    assert.equal(tab?.key?.kind, 'set', JSON.stringify(scanned.manifest.elements));
    assert.deepEqual(tab?.key?.values, ['info', 'members']);
    assert.equal(plugin?.key?.kind, 'id');
    assert.equal(plugin?.key?.value, 'plugin_tab');
});

test('defaulted method flags pair each tab key with its own array callback call site', () => {
    const scanned = scanSource({
        'source.tsx': [
            "import React from 'react';",
            'type SidebarTab = {name: string}; declare const plugins: SidebarTab[]; const builtIns = [{name: "info"}, {name: "members"}] as const;',
            'class Sidebar extends React.Component<{testIdScope: string; tabs: SidebarTab[]; pluginTabs: SidebarTab[]}> {',
            'renderTab(tab: SidebarTab, isPluginTab = false) {',
            // eslint-disable-next-line no-template-curly-in-string -- fixture source
            'let testId = `${tab.name}-tab-button`; if (this.props.testIdScope) {testId = isPluginTab ? `${this.props.testIdScope}.tabs.plugin:${tab.name}--tab` : `${this.props.testIdScope}.tabs.tab:${tab.name}--tab`;} return <button role="tab" data-testid={testId}/>;}',
            'render() {return <div>{this.props.tabs.map((tab) => this.renderTab(tab))}{this.props.pluginTabs.map((tab) => this.renderTab(tab, true))}</div>;}}',
            'export function App() {return <Sidebar testIdScope="sidebar" tabs={builtIns} pluginTabs={plugins}/>;}',
        ].join('\n'),
    }, {include: ['*.tsx'], config: {checks: {keyFields: {allow: [{entity: 'SidebarTab', module: './source', field: 'name', value: 'plugin_tab', reason: 'Plugin registration tab name.'}]}}}});
    assert.deepEqual(scanned.diagnostics.filter((diagnostic) => diagnostic.rule === 'key-origin'), []);
    const tab = scanned.manifest.elements.find((element) => element.template === 'sidebar.tabs.tab:{key}--tab');
    const plugin = scanned.manifest.elements.find((element) => element.template === 'sidebar.tabs.plugin:{key}--tab');
    assert.equal(tab?.key?.kind, 'set', JSON.stringify(scanned.manifest.elements));
    assert.deepEqual(tab?.key?.values, ['info', 'members']);
    assert.equal(plugin?.key?.kind, 'id');
    assert.equal(plugin?.key?.value, 'plugin_tab');
});

test('generic component keys use each JSX mount type argument, including local configured identities', () => {
    const scanned = scanSource({
        'types/entities.ts': 'export interface User {id: string; username: string} export interface Team {id: string; display_name: string}',
        'source.tsx': [
            "import React from 'react'; import type {User, Team} from './types/entities';",
            'type Value = {id: string}; interface OptionValue {id: string; label: string} interface Unreviewed {id: string; label: string}',
            'declare function Host(props: {value: unknown; row: unknown}): unknown;',
            'type Props<T extends Value> = {testId: string; value: T[]};',
            // eslint-disable-next-line no-template-curly-in-string -- fixture source
            'class GenericList<T extends Value> extends React.Component<Props<T>> {private Row = (props: {data: T}) => <button data-testid={`${this.props.testId}.remove:${props.data.id}--button`}/>; render() {return <div data-testid={this.props.testId}><Host value={this.props.value} row={this.Row}/></div>;}}',
            // eslint-disable-next-line no-template-curly-in-string -- fixture source
            'function GenericFn<T extends Value>(props: Props<T>) {const Row = ({data}: {data: T}) => <button data-testid={`${props.testId}.remove:${data.id}--button`}/>; return <div data-testid={props.testId}><Host value={props.value} row={Row}/></div>;}',
            'function Wrapper<U extends Value>(props: Props<U>) {return <GenericList<U> testId={props.testId} value={props.value}/>;}',
            // eslint-disable-next-line no-template-curly-in-string -- fixture source
            'function Radios<V extends string>(props: {testId: string; inputFieldData: {options: ReadonlyArray<{value: V}>}}) {return <fieldset data-testid={props.testId}>{props.inputFieldData.options.map((option) => <input type="radio" data-testid={`${props.testId}.option:${option.value}--radio`}/>)}</fieldset>;}',
            'const notificationOptions = [{value: "all"}, {value: "mention"}] as const; const otherOptions = [{value: "always"}, {value: "never"}] as const;',
            'declare const users: User[]; declare const teams: Team[]; declare const options: OptionValue[]; declare const unreviewed: Unreviewed[];',
            'export function App() {return <div><GenericList<User> testId="generic.users" value={users}/><GenericList<Team> testId="generic.teams" value={teams}/><GenericList<OptionValue> testId="generic.options" value={options}/><GenericList testId="generic.inferred" value={users}/><GenericFn<User> testId="generic.function_users" value={users}/><GenericFn<Team> testId="generic.function_teams" value={teams}/><Wrapper<User> testId="generic.wrapped_users" value={users}/><Wrapper<Team> testId="generic.wrapped_teams" value={teams}/><GenericList<Unreviewed> testId="generic.unknown" value={unreviewed}/><Radios<"all" | "mention"> testId="generic.radio_explicit" inputFieldData={{options: notificationOptions}}/><Radios testId="generic.radio_inferred" inputFieldData={{options: otherOptions}}/></div>;}',
        ].join('\n'),
    }, {include: ['source.tsx', 'types'], config: {entityTypeDirs: ['types'], checks: {keyFields: {allow: [{entity: 'OptionValue', module: './source', field: 'id', value: 'option', reason: 'The local option id identifies an available option.'}]}}}});
    const {report} = scanned;
    const expected = {users: {kind: 'id', entity: 'User', field: 'id', from: '@mattermost/types/entities'}, teams: {kind: 'id', entity: 'Team', field: 'id', from: '@mattermost/types/entities'}, options: {kind: 'id', value: 'option'}, inferred: {kind: 'id', entity: 'User', field: 'id', from: '@mattermost/types/entities'}};
    Object.assign(expected, {function_users: expected.users, function_teams: expected.teams, wrapped_users: expected.users, wrapped_teams: expected.teams});
    assert.equal(report.scopes['generic.unknown'], undefined, 'an unreviewed identity is a source error, never an unrestricted string key');
    for (const [mount, key] of Object.entries(expected)) {
        const scope = report.scopes[`generic.${mount}`];
        assert.ok(scope, mount);
        assert.deepEqual(report.families[scope.family].parts?.remove.key, {kind: 'mount'}, mount);
        assert.deepEqual(scope.bind?.remove && scope.bind.remove.key, key, mount);
    }
    for (const [scope, values] of Object.entries({'generic.radio_explicit': ['all', 'mention'], 'generic.radio_inferred': ['always', 'never']})) {
        const mount = report.scopes[scope];
        const key = mount.bind?.option && mount.bind.option.key;
        assert.deepEqual(report.families[mount.family].parts?.option.key, {kind: 'mount'}, scope);
        assert.ok(key && key.kind === 'set', scope);
        assert.deepEqual(report.sets[key.set], values, scope);
    }
    const errors = scanned.diagnostics.filter((diagnostic) => diagnostic.rule === 'key-origin' && diagnostic.severity === 'error');
    assert.deepEqual([...new Set(errors.map((error) => error.template))], ['generic.unknown.remove:{key}--button']);
});

test('a generic helper\'s element type is the one of the call the value flows through, not of every call of the helper', () => {
    const scanned = scanSource({
        'types/entities.ts': 'export interface Team {id: string; display_name: string} export interface TeamMembership extends Team {team_id: string}',
        'source.tsx': [
            "import React from 'react'; import type {Team, TeamMembership} from './types/entities';",
            'function sortTeams<T extends Team>(teams: T[]): T[] {const custom = teams.filter((team) => team.id !== ""); const other = teams.filter((team) => team.id === ""); return [...custom, ...other];}',
            // eslint-disable-next-line no-template-curly-in-string -- fixture source
            'function TeamButton({teamId}: {teamId?: string}) {return <div data-testid={teamId ? `sidebar.team:${teamId}` : undefined}/>;}',
            'declare const myTeams: Team[]; declare const memberships: TeamMembership[];',
            'export const sortedMemberships = sortTeams(memberships);',
            "export function Sidebar() {const teams = sortTeams(myTeams); return <div data-testid='sidebar'>{teams.map((team: Team) => <TeamButton teamId={team.id}/>)}</div>;}",
        ].join('\n'),
    }, {include: ['source.tsx', 'types'], config: {entityTypeDirs: ['types'], checks: {}}});
    const errors = scanned.diagnostics.filter((diagnostic) => diagnostic.severity === 'error').map((diagnostic) => diagnostic.message);
    assert.deepEqual(errors, []);
    const parts = scanned.report.families[scanned.report.scopes.sidebar.family].parts ?? {};
    assert.deepEqual(parts.team?.key, {kind: 'id', entity: 'Team', field: 'id', from: '@mattermost/types/entities'}, JSON.stringify(parts.team));
});

test('entity field annotations resolve symbols without trusting wrappers, casts or mixed identities', () => {
    withSource({
        'entities/user.ts': 'export type User = {id: string; name: string}; export type Team = {id: string; name: string};',
        'source.tsx': [
            'import React from "react"; import type {User, User as Member, Team} from "./entities/user";',
            'type UserId = User["id"]; type Fake = {id: string};',
            'type Props = {readonly id: User["id"]; alias: Member["id"]; optional?: User["id"] | null; name: User["name"]; other: Team["name"]; mixed: User["id"] | Team["id"]; wrapped: UserId; fake: Fake["id"]};',
            'type NamedRow = {value: User["name"]}; declare const rows: NamedRow[]; function Generic<T extends {value: string}>({items}: {items: T[]}) {return <>{items.map((row) => <span data-testid={"view.generic:" + row.value + "--text"}/>)}</>;}',
            'function Item(props: Props) {return <section>',
            '<button data-testid={"view.user:" + props.id + "--button"}/>',
            '<button data-testid={"view.alias:" + props.alias + "--button"}/>',
            '<button data-testid={props.optional ? "view.optional:" + props.optional + "--button" : undefined}/>',
            '<button data-testid={"view.name:" + props.name + "--button"}/>',
            '<button data-testid={"view.other:" + props.other + "--button"}/>',
            '<button data-testid={"view.mixed:" + props.mixed + "--button"}/>',
            '<button data-testid={"view.wrapped:" + props.wrapped + "--button"}/>',
            '<button data-testid={"view.fake:" + props.fake + "--button"}/>',
            '<button data-testid={"view.cast:" + (html.id as User["id"]) + "--button"}/>',
            '</section>;}',
            'declare const html: any; export function App() {return <><Item id={html.id} alias={html.id} optional={null} name={html.name} other={html.name} mixed={html.id} wrapped={html.id} fake={html.id}/><Generic items={rows}/></>;}',
        ].join('\n'),
    }, {include: ['source.tsx', 'entities'], config: {entityTypeDirs: ['entities'], checks: {strictPaths: ['source.tsx'], keyFields: {allow: [{entity: 'User', module: './entities/user', field: 'name', value: 'user_name', freeForm: true, reason: 'The external lookup identifies users by their canonical account name.'}]}}}, configFile: 'config.json'}, ({root, scan}) => {
        const out = scan();
        for (const name of ['user', 'alias']) {
            const key = out.manifest.elements.find((element) => element.name === name)?.key;
            assert.equal(key?.kind, 'entity', name);
            assert.equal(key?.entity, 'User', name);
            assert.equal(key?.field, 'id', name);
            assert.equal(key?.module, '@mattermost/types/user', name);
        }
        const named = out.manifest.elements.find((element) => element.name === 'name')?.key;
        assert.equal(named?.entity, 'User');
        assert.equal(named?.field, 'name');
        const generic = out.manifest.elements.find((element) => element.name === 'generic')?.key;
        assert.equal(generic?.entity, 'User');
        assert.equal(generic?.field, 'name');
        assert.ok(!out.diagnostics.some((diagnostic) => diagnostic.rule === 'undefined'));
        for (const name of ['other', 'mixed', 'wrapped', 'fake', 'cast']) {
            assert.ok(out.diagnostics.some((diagnostic) => diagnostic.rule === 'key-origin' && diagnostic.template?.startsWith(`view.${name}:`)), name);
        }
        assert.ok(!out.diagnostics.some((diagnostic) => diagnostic.rule === 'allow'));
        fs.appendFileSync(path.join(root, 'source.tsx'), '\nfunction Missing(props: {id: User["id"]}) {return <span data-testid={"view.missing:" + props.id + "--text"}/>;} export function Bad() {return <Missing id={undefined}/>;}');
        const missing = scan();
        assert.ok(missing.diagnostics.some((diagnostic) => diagnostic.rule === 'undefined' && diagnostic.severity === 'error'), 'an annotation supplies identity, never an invented value');
    });
});
