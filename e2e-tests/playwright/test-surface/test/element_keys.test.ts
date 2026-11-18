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

test('an element taken by iterating an array field takes that field\'s keyFields entry, in for-of and in callbacks', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-element-keys-'));
    try {
        installFixtureCompiler(root);
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['source.tsx', path.join(FIXTURES, '_lib')]}));
        const allow = [{entity: 'Group', module: './source', field: 'permissions', value: 'permission', reason: 'A permission is identified by its name.'}];
        fs.writeFileSync(path.join(root, 'test-surface.config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], checks: {keyFields: {allow}}, output: {report: 'surface.json'}}));
        fs.writeFileSync(path.join(root, 'source.tsx'), [
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
        ].join('\n'));
        const scanned = scanProject(loadConfig(path.join(root, 'test-surface.config.json')));
        const errors = scanned.diagnostics.filter((diagnostic) => diagnostic.rule === 'key-origin' && diagnostic.severity === 'error');
        assert.deepEqual([...new Set(errors.map((error) => error.template))], ['perm.extra:{key}--listitem'], 'a field with no entry stays open');
        const parts = scanned.report.families[scanned.report.scopes.perm.family].parts ?? {};
        assert.deepEqual(parts.row?.key, {kind: 'id', value: 'permission'}, JSON.stringify(parts.row));
        assert.deepEqual(parts.check?.key, {kind: 'id', value: 'permission'}, JSON.stringify(parts.check));
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});

test('a literal-plus-spread array keeps its literal for its own arm and keys the spread elements by their field\'s entry', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-element-keys-'));
    try {
        installFixtureCompiler(root);
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['source.tsx', path.join(FIXTURES, '_lib')]}));
        const allow = [{entity: 'Props', module: './source', field: 'nodes', value: 'node', reason: 'A cluster node is identified by its name.'}];
        fs.writeFileSync(path.join(root, 'test-surface.config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], checks: {keyFields: {allow}}, output: {report: 'surface.json'}}));
        fs.writeFileSync(path.join(root, 'source.tsx'), [
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
        ].join('\n'));
        const scanned = scanProject(loadConfig(path.join(root, 'test-surface.config.json')));
        const errors = scanned.diagnostics.filter((diagnostic) => diagnostic.severity === 'error').map((diagnostic) => diagnostic.message);
        assert.deepEqual(errors, []);
        const parts = scanned.report.families[scanned.report.scopes.logs.family].parts ?? {};
        assert.deepEqual(parts.node?.key, {kind: 'id', value: 'node'}, JSON.stringify(parts.node));
        assert.equal(parts.all_nodes?.role, 'menuitemradio', JSON.stringify(parts));
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});

test('a key read from a field a keyFields entry names stops at that field, whatever object literal a mount builds it from', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-element-keys-'));
    try {
        installFixtureCompiler(root);
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['source.tsx', path.join(FIXTURES, '_lib')]}));
        const allow = [{entity: 'Group', module: './source', field: 'id', value: 'permission', freeForm: true, reason: 'A permission group is identified by its id.'}];
        fs.writeFileSync(path.join(root, 'test-surface.config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], checks: {keyFields: {allow}}, output: {report: 'surface.json'}}));
        fs.writeFileSync(path.join(root, 'source.tsx'), [
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
        ].join('\n'));
        const scanned = scanProject(loadConfig(path.join(root, 'test-surface.config.json')));
        const errors = scanned.diagnostics.filter((diagnostic) => diagnostic.severity === 'error').map((diagnostic) => diagnostic.message);
        assert.deepEqual(errors, []);
        assert.deepEqual(scanned.report.families[scanned.report.scopes.perms.family].parts?.group?.key, {kind: 'id', value: 'permission'});
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});

test('a list element narrowed to a literal still takes the broader items that can hold it', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-element-keys-'));
    try {
        installFixtureCompiler(root);
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['source.tsx', path.join(FIXTURES, '_lib')]}));
        fs.writeFileSync(path.join(root, 'test-surface.config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], checks: {}, output: {report: 'surface.json'}}));
        fs.writeFileSync(path.join(root, 'source.tsx'), [
            "import React from 'react';",
            'declare const items: string[];',
            'function Row({value}: {value: string}) {return <div data-testid={`owners.mixed:${value}--region`}/>;}',
            "export function Owners() {return <div data-testid='owners'>{items.map((value) => (value === 'known' ? <Row value={value}/> : null))}</div>;}",
        ].join('\n'));
        const scanned = scanProject(loadConfig(path.join(root, 'test-surface.config.json')));
        const templates = scanned.manifest.elements.map((element) => element.template);
        assert.ok(templates.includes('owners.mixed:{key}--region'), `the row is kept: ${JSON.stringify(templates)}`);
        assert.ok(scanned.diagnostics.some((diagnostic) => diagnostic.rule === 'key-origin' && diagnostic.severity === 'error'), 'its open string key is still reported');
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});

test('a list element narrowed by typeof before it reaches a helper keys only by the elements that fit there', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-element-keys-'));
    try {
        installFixtureCompiler(root);
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['source.tsx', path.join(FIXTURES, '_lib')]}));
        const allow = [
            {entity: 'Group', module: './source', field: 'permissions', value: 'permission', freeForm: true, reason: 'A permission is identified by its name.'},
            {entity: 'Group', module: './source', field: 'id', value: 'permission', freeForm: true, reason: 'A permission group is identified by its id.'},
        ];
        fs.writeFileSync(path.join(root, 'test-surface.config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], checks: {keyFields: {allow}}, output: {report: 'surface.json'}}));
        fs.writeFileSync(path.join(root, 'source.tsx'), [
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
        ].join('\n'));
        const scanned = scanProject(loadConfig(path.join(root, 'test-surface.config.json')));
        const errors = scanned.diagnostics.filter((diagnostic) => diagnostic.severity === 'error').map((diagnostic) => diagnostic.message);
        assert.deepEqual(errors, []);
        assert.deepEqual(scanned.report.families[scanned.report.scopes.perms.family].parts?.row?.key, {kind: 'id', value: 'permission'});
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});
