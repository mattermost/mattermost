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

test('a row rendering each component of an array prop renders the components its mount passes', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-component-arrays-'));
    try {
        installFixtureCompiler(root);
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['*.tsx', '*.ts', path.join(FIXTURES, '_lib')]}));
        fs.writeFileSync(path.join(root, 'test-surface.config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], output: {report: 'surface.json'}}));
        fs.writeFileSync(path.join(root, 'dropdown.tsx'), [
            "import React from 'react';",
            'type Props = {user: {id: string}; testIdScope?: string};',
            'class Dropdown extends React.Component<Props> {',
            '    render() {',
            '        return <div><button data-testid={this.props.testIdScope ? `${this.props.testIdScope}.role--button` : undefined}/><span data-testid={this.props.testIdScope ? `${this.props.testIdScope}.error--text` : undefined}/></div>;',
            '    }',
            '}',
            'export default Dropdown;',
        ].join('\n'));
        fs.writeFileSync(path.join(root, 'index.ts'), [
            "import Dropdown from './dropdown';",
            'declare function connect(map: unknown): <C>(component: C) => C;',
            'export default connect(() => ({}))(Dropdown);',
        ].join('\n'));
        fs.writeFileSync(path.join(root, 'list.tsx'), [
            "import React from 'react'; import Dropdown from './index';",
            'type User = {id: string};',
            'type RowProps = {user: User; actions?: Array<React.ComponentType<any>>; actionProps?: {mfaEnabled: boolean; doReset: (user: User) => void}; actionUserProps?: {[userId: string]: {teamMember: {id: string}}}; testIdScope?: string};',
            'const Row = ({user, actions = [], actionProps, actionUserProps = {}, testIdScope}: RowProps) => {',
            '    let buttons = null;',
            '    if (actions) {',
            '        buttons = actions.map((Action, index) => <Action key={index.toString()} user={user} testIdScope={testIdScope ? `${testIdScope}.action` : undefined} {...actionProps} {...actionUserProps}/>);',
            '    }',
            '    return <div data-testid={testIdScope ? `${testIdScope}:${user.id}` : undefined}><span data-testid={testIdScope ? `${testIdScope}.name--text` : undefined}/>{buttons}</div>;',
            '};',
            'type ListProps = {users: User[]; actions?: Array<React.ComponentType<any>>; rowComponentType?: React.ComponentType<any>; testIdScope?: string};',
            'const UserList = ({users, actions = [], rowComponentType = Row, testIdScope}: ListProps) => {',
            '    const RowComponentType = rowComponentType;',
            '    return <div>{users.map((user) => <RowComponentType key={user.id} user={user} actions={actions} testIdScope={testIdScope ? `${testIdScope}.user` : undefined}/>)}</div>;',
            '};',
            'class Searchable extends React.PureComponent<ListProps> {',
            '    static defaultProps: Partial<ListProps> = {users: [], actions: []};',
            '    render() {',
            '        return <div data-testid={this.props.testIdScope}><UserList users={this.props.users} actions={this.props.actions} rowComponentType={this.props.rowComponentType} testIdScope={this.props.testIdScope}/></div>;',
            '    }',
            '}',
            'declare function useState<T>(value: T): [T, (value: T) => void];',
            'function List(props: ListProps) {const [page] = useState(0); return <Searchable {...props} key={page}/>;}',
            'declare const users: User[];',
            'export class Members extends React.Component<{canManage: boolean}> {',
            '    render() {',
            '        let dropdown;',
            '        if (this.props.canManage) {',
            '            dropdown = [Dropdown];',
            '        }',
            "        return <List users={users} actions={dropdown} testIdScope='members'/>;",
            '    }',
            '}',
            "export function Plain() {return <List users={users} testIdScope='plain'/>;}",
        ].join('\n'));
        const scanned = scanProject(loadConfig(path.join(root, 'test-surface.config.json')));
        const templates = scanned.manifest.elements.map((element) => element.template);
        assert.ok(templates.includes('members.user.action.role--button'), JSON.stringify(templates));
        assert.ok(templates.includes('members.user.action.error--text'), JSON.stringify(templates));
        assert.equal(templates.some((template) => template.startsWith('plain.user.action')), false, `a mount passing no actions renders none: ${JSON.stringify(templates)}`);
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});

function scanSource(source: string[]) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-component-arrays-'));
    try {
        installFixtureCompiler(root);
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['source.tsx', path.join(FIXTURES, '_lib')]}));
        fs.writeFileSync(path.join(root, 'test-surface.config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], output: {report: 'surface.json'}}));
        fs.writeFileSync(path.join(root, 'source.tsx'), ["import React from 'react';", 'type C = React.ComponentType<any>;', ...source].join('\n'));
        return scanProject(loadConfig(path.join(root, 'test-surface.config.json')));
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
}

test('components passed down a chain of dynamic tags deeper than a few levels, innermost written first, all render', () => {
    // each level renders the component its mount passes and hands it the next one, so level k is known only once
    // level k - 1's usage is: one level per pass, in the worst (reversed) source order
    const scanned = scanSource([
        'function L6({testIdScope}: {testIdScope: string}) {return <button data-testid={`${testIdScope}.leaf--button`}/>;}',
        'function L5({comp, testIdScope}: {comp: C; testIdScope: string}) {const Comp = comp; return <Comp testIdScope={`${testIdScope}.l6`}/>;}',
        'function L4({comp, testIdScope}: {comp: C; testIdScope: string}) {const Comp = comp; return <Comp comp={L6} testIdScope={`${testIdScope}.l5`}/>;}',
        'function L3({comp, testIdScope}: {comp: C; testIdScope: string}) {const Comp = comp; return <Comp comp={L5} testIdScope={`${testIdScope}.l4`}/>;}',
        'function L2({comp, testIdScope}: {comp: C; testIdScope: string}) {const Comp = comp; return <Comp comp={L4} testIdScope={`${testIdScope}.l3`}/>;}',
        'function L1({comp, testIdScope}: {comp: C; testIdScope: string}) {const Comp = comp; return <div data-testid={testIdScope}><Comp comp={L3} testIdScope={`${testIdScope}.l2`}/></div>;}',
        "export function App() {return <L1 comp={L2} testIdScope='deep'/>;}",
    ]);
    const templates = scanned.manifest.elements.map((element) => element.template);
    assert.ok(templates.includes('deep.l2.l3.l4.l5.l6.leaf--button'), JSON.stringify(templates));
    assert.deepEqual(scanned.diagnostics.filter((diagnostic) => diagnostic.severity === 'error').map((diagnostic) => diagnostic.message), []);
});

test('a dynamic usage found again through a later mount takes that mount too, even in a pass that adds no usage', () => {
    // mount a reaches Row and its Action first; mount b goes through two more dynamic levels (Shell renders Page, Page
    // renders List), so a later pass only adds b's paths to usages that already exist, and the pass after must still run
    const scanned = scanSource([
        'function Action({testIdScope}: {testIdScope: string}) {return <button data-testid={`${testIdScope}.role--button`}/>;}',
        'function Row({actions = [], testIdScope}: {actions?: C[]; testIdScope: string}) {return <div>{actions.map((Item) => <Item testIdScope={`${testIdScope}.action`}/>)}</div>;}',
        'function List({actions, rowType = Row, testIdScope}: {actions?: C[]; rowType?: C; testIdScope: string}) {const RowType = rowType; return <div data-testid={testIdScope}><RowType actions={actions} testIdScope={`${testIdScope}.user`}/></div>;}',
        'function Page({listType, testIdScope}: {listType: C; testIdScope: string}) {const ListType = listType; return <ListType actions={[Action]} testIdScope={testIdScope}/>;}',
        'function Shell({pageType}: {pageType: C}) {const PageType = pageType; return <PageType listType={List} testIdScope="b"/>;}',
        "export function App() {return <div><List actions={[Action]} testIdScope='a'/><Shell pageType={Page}/></div>;}",
    ]);
    const templates = scanned.manifest.elements.map((element) => element.template);
    assert.ok(templates.includes('a.user.action.role--button'), JSON.stringify(templates));
    assert.ok(templates.includes('b.user.action.role--button'), JSON.stringify(templates));
});
