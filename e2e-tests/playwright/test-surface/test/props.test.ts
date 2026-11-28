// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';

import {scanSource, withSource} from './helpers.ts';

/* eslint-disable no-template-curly-in-string -- fixture source */

test('a literal prop passed at every mount keys the testid by the set of those literals', () => {
    const scanned = scanSource({
        'source.tsx': [
            "import React from 'react';",
            'type Props = {title: string; id?: string; count?: number};',
            'const StatisticCount = ({title, id, count}: Props) => <div data-testid={id ? `stats.stat:${id}--region` : undefined}>{title}{count}</div>;',
            'class LineChart extends React.PureComponent<{id: string; title: string}> {render() {return <div data-testid={`stats.chart:${this.props.id}--region`}>{this.props.title}</div>;}}',
            'export class Analytics extends React.PureComponent<{show: boolean}> {',
            '    render() {',
            '        let postCount;',
            '        if (this.props.show) {',
            "            postCount = (<StatisticCount id='totalPosts' title='Posts' count={1}/>);",
            '        }',
            "        const userCount = (<StatisticCount id='totalUsers' title='Users'/>);",
            "        const teamCount = (<StatisticCount id='totalTeams' title='Teams'/>);",
            "        const channelCount = (<StatisticCount id='totalChannels' title='Channels'/>);",
            "        const fileCount = (<StatisticCount id='totalFiles' title='Files'/>);",
            "        return <div data-testid='stats'>{postCount}{userCount}{teamCount}{channelCount}{fileCount}<LineChart id='totalPostsChart' title='Posts'/><LineChart id='activeUsersChart' title='Users'/><LineChart id='botPostsChart' title='Bots'/><LineChart id='sessionsChart' title='Sessions'/></div>;",
            '    }',
            '}',
        ].join('\n'),
    }, {include: ['source.tsx'], config: {checks: {}}});
    const errors = scanned.diagnostics.filter((diagnostic) => diagnostic.rule === 'key-origin' && diagnostic.severity === 'error');
    assert.deepEqual(errors.map((error) => error.message), []);
    const parts = scanned.report.families[scanned.report.scopes.stats.family].parts ?? {};
    for (const [name, values] of Object.entries({stat: ['totalChannels', 'totalFiles', 'totalPosts', 'totalTeams', 'totalUsers'], chart: ['activeUsersChart', 'botPostsChart', 'sessionsChart', 'totalPostsChart']})) {
        const key = parts[name]?.key;
        assert.ok(key && key.kind === 'set', `${name}: ${JSON.stringify(parts[name])}`);
        assert.deepEqual(scanned.report.sets[key.set], values, name);
    }
});

test('a mount whose value cannot be read is named in the key-origin message, not only the prop it was passed to', () => {
    const scanned = scanSource({
        'source.tsx': [
            "import React from 'react';",
            'const StatisticCount = ({id}: {id?: string}) => <div data-testid={id ? `stats.stat:${id}--region` : undefined}/>;',
            'declare function statId(name: string): string;',
            "export function Analytics() {return <div data-testid='stats'><StatisticCount id='totalUsers'/><StatisticCount id={statId('plugin')}/></div>;}",
        ].join('\n'),
    }, {include: ['source.tsx'], config: {checks: {}}});
    const open = scanned.diagnostics.filter((diagnostic) => diagnostic.rule === 'key-origin' && diagnostic.message.includes('open string'));
    assert.equal(open.length, 1, open.map((diagnostic) => diagnostic.message).join('\n'));
    assert.match(open[0].message, /\(id: string, from source\.tsx:4:\d+\)/);
});

test('candidate dialog props apply function and class defaults only to missing or undefined values', () => {
    const declarations = [
        'import React from "react";',
        'function Dialog({testId="my_dialog"}: {testId?: string | null}) {return <button data-testid={testId + ".close--button"}/>;}',
        'class ClassDialog extends React.Component<{testId?: string}> {static defaultProps={testId:"class_dialog"}; render() {return <button data-testid={this.props.testId + ".close--button"}/>;}}',
    ];
    const scan = (mounts: string[]) => scanSource({
        'source.tsx': [...declarations, ...mounts].join('\n'),
    }, {include: ['source.tsx'], config: {checks: {strictPaths: ['source.tsx']}}});
    const candidates = scan([
        'export const first={dialogType:Dialog};',
        'export const second={dialogType:Dialog,dialogProps:{testId:undefined}};',
        'export const third={dialogType:Dialog,dialogProps:{testId:"explicit_dialog"}};',
        'export const fourth={dialogType:ClassDialog};',
    ]);
    assert.deepEqual(candidates.diagnostics.filter((diagnostic) => diagnostic.severity === 'error'), []);
    for (const scope of ['my_dialog', 'explicit_dialog', 'class_dialog']) {
        assert.ok(candidates.report.scopes[scope], scope);
    }
    const jsx = scan(['export function App() {return <><Dialog/><Dialog testId={undefined}/><Dialog testId="explicit_dialog"/><ClassDialog/></>;}']);
    assert.deepEqual(jsx.diagnostics.filter((diagnostic) => diagnostic.severity === 'error'), []);
    for (const scope of ['my_dialog', 'explicit_dialog', 'class_dialog']) {
        const fromCandidate = candidates.report.families[candidates.report.scopes[scope].family];
        const fromJsx = jsx.report.families[jsx.report.scopes[scope].family];
        assert.deepEqual(fromCandidate.parts, fromJsx.parts, `${scope} has the same defaulted members`);
    }
    const nullValue = scan(['export const descriptor={dialogType:Dialog,dialogProps:{testId:null}};']);
    assert.ok(nullValue.diagnostics.some((diagnostic) => diagnostic.rule === 'undefined' && diagnostic.severity === 'error'));
    assert.equal(nullValue.report.scopes.my_dialog, undefined, 'explicit null does not select a default');
    const unknown = scan(['declare const props: {testId: unknown}; export const descriptor={dialogType:Dialog,dialogProps:props};']);
    assert.equal(unknown.report.scopes.my_dialog, undefined, 'an unreadable supplied value does not select a default');
});

test('a testid given to a component that spreads its rest props onto the element it renders reaches that element', () => {
    const scanned = scanSource({
        'source.tsx': [
            "import React from 'react';",
            'type ItemProps = {id: string; labels: React.ReactNode; onClick?: () => void; [key: string]: unknown};',
            'declare function MuiMenuItem(props: {[key: string]: unknown}): JSX.Element;',
            'declare function styled<T>(component: T): T;',
            'const MenuItemStyled = styled(MuiMenuItem);',
            'const MenuItem = React.forwardRef((props: ItemProps, ref: unknown) => {',
            '    const {labels, ...otherProps} = props;',
            "    return <MenuItemStyled ref={ref} role='menuitem' {...otherProps}>{labels}</MenuItemStyled>;",
            '});',
            'type SubMenuProps = {id: string; menuId: string; labels: React.ReactNode; children: React.ReactNode; isMobile?: boolean; menuTestId?: string; [key: string]: unknown};',
            "function paperTestIdProps(menuTestId?: string): Record<string, string> {return menuTestId ? {'data-testid': `${menuTestId}.paper`} : {};}",
            'function SubMenu(props: SubMenuProps) {',
            '    const {id, menuId, labels, children, isMobile, menuTestId, ...rest} = props;',
            '    const trigger = {id, labels, onClick: () => undefined};',
            '    if (isMobile) {',
            '        return <MenuItem {...trigger}/>;',
            '    }',
            '    return <div><MenuItem {...rest} {...trigger}/><ul id={menuId} {...paperTestIdProps(menuTestId)}>{children}</ul></div>;',
            '}',
            'export const Menu = {SubMenu};',
            'export function AccountMenu() {',
            "    return <div data-testid='account_menu'><Menu.SubMenu id='dnd' data-testid='account_menu.dnd--menuitem' menuId='dnd_menu' labels='Do not disturb'><li data-testid='account_menu.dnd_menu.until--menuitem'/></Menu.SubMenu></div>;",
            '}',
        ].join('\n'),
    }, {include: ['source.tsx'], config: {checks: {}}});
    const templates = scanned.manifest.elements.map((element) => element.template);
    assert.ok(templates.includes('account_menu.dnd_menu.until--menuitem'), templates.join(', '));
    assert.ok(templates.includes('account_menu.dnd--menuitem'), templates.join(', '));
    const family = scanned.report.families[scanned.report.scopes.account_menu.family];
    assert.equal(family.parts?.dnd?.role, 'menuitem', JSON.stringify(family));
});

test('test ids on a returned HOC class retain the outer JSX mount props', () => {
    const out = scanSource({
        'source.tsx': [
            'import React from "react";',
            'function wrap(Component:any){class Item extends React.PureComponent<{slotTestId?:string}>{render(){const {slotTestId,...props}=this.props;return <li role="menuitem" data-testid={slotTestId}><Component {...props}/></li>;}} return Item;}',
            'function Body({bodyScope}:{bodyScope:string}){return <span data-testid={bodyScope}/>;} const Item=wrap(Body);',
            'export function App(){return <><Item slotTestId="menu.first--menuitem" bodyScope="menu.first.label--text"/><Item slotTestId="menu.second--menuitem" bodyScope="menu.second.label--text"/></>;}',
        ].join('\n'),
    }, {include: ['*.tsx']});
    for (const expected of ['menu.first--menuitem', 'menu.second--menuitem', 'menu.first.label--text', 'menu.second.label--text']) {
        assert.ok(out.manifest.elements.some((element) => element.template === expected), JSON.stringify(out.diagnostics));
    }
    assert.equal(out.diagnostics.some((diagnostic) => diagnostic.rule === 'unscoped' || diagnostic.rule === 'unresolved'), false, JSON.stringify(out.diagnostics));
});

test('a connector created from a state-map factory still mounts its component argument', () => {
    const out = scanSource({
        'source.tsx': [
            'import React from "react"; declare function connect(map:any):(component:any)=>any;',
            'function makeMap(){return function mapState(){return {};};} const connector=connect(makeMap);',
            'function Body({testIdScope}:{testIdScope:string}){return <div data-testid={testIdScope+"--region"}/>;} const Item=connector(Body);',
            'export function App(){return <Item testIdScope="post.spillage_report"/>;}',
        ].join('\n'),
    }, {include: ['*.tsx']});
    assert.ok(out.manifest.elements.some((element) => element.template === 'post.spillage_report--region'), JSON.stringify(out.diagnostics));
    assert.equal(out.diagnostics.some((diagnostic) => diagnostic.rule === 'unscoped'), false, JSON.stringify(out.diagnostics));
});

test('option ids from an object-returning helper retain each call context and opaque callers', () => {
    withSource({
        'fields.ts': [
            'export type Fields={options:Array<{dataTestId?:string;value:string}>};',
            // eslint-disable-next-line no-template-curly-in-string -- The fixture is a runtime helper returning option metadata.
            'export const make=(scope:string):Fields=>({options:[{dataTestId:`${scope}.all--radio`,value:"all"},{dataTestId:`${scope}.none--radio`,value:"none"}]});',
        ].join('\n'),
    }, {include: ['*.ts', '*.tsx']}, ({root, scan}) => {
        const body = 'function Fields({data}:{data:utils.Fields}){return <>{data.options.map(option=><input type="radio" data-testid={option.dataTestId}/>)}</>;}';
        for (const opaque of [false, true]) {
            fs.writeFileSync(path.join(root, 'source.tsx'), [
                'import React from "react"; import * as utils from "./fields";',
                'declare function opaqueFields():utils.Fields;',
                body,
                `export function App(){return <><Fields data={utils.make("notify.desktop")}/><Fields data={utils.make("notify.mobile")}/>${opaque ? '<Fields data={opaqueFields()}/>' : ''}</>;}`,
            ].join('\n'));
            const out = scan();
            const ids = out.manifest.elements.map((element) => element.template);
            for (const expected of ['notify.desktop.all--radio', 'notify.desktop.none--radio', 'notify.mobile.all--radio', 'notify.mobile.none--radio']) {
                assert.ok(ids.includes(expected), `${expected}: ${JSON.stringify(out.diagnostics)}`);
            }
            assert.equal(out.diagnostics.some((diagnostic) => diagnostic.rule === 'unscoped' || diagnostic.rule === 'unresolved'), opaque, JSON.stringify(out.diagnostics));
        }
    });
});

test('mutable imported values retain writes while immutable imports keep their initializer', () => {
    withSource({
        'store.ts': 'export const store:{name?:string}={name:"s"}; export function clear(){store.name=undefined;} export let current:string|undefined="c"; export function reset(){current=undefined;} export const stable="stable"; export const untouched={name:"untouched"}; export const Constants={Prefix:"area",Ids:{A:"a"}}; export const Frozen={Prefix:"area"} as const; export const partial:{readonly mode:string;name?:string}={mode:"readonly",name:"partial"}; export const methodStore:{name?:string;erase():void}={name:"method",erase(){this.name=undefined;}};',
    }, {}, ({root, scan}) => {
        const cases = [
            ['string_method', 'return <span data-testid={Constants.Prefix+".item--text"}/>;', false, 'Constants.Prefix.toUpperCase();'],
            ['object_keys', 'return <span data-testid={Constants.Ids.A+".item--text"}/>;', false, 'Object.keys(Constants.Ids);'],
            ['unknown_log', 'return <span data-testid={Constants.Prefix+".item--text"}/>;', false, 'declare function log(x:unknown):void; log(Constants);'],
            ['readonly_log', 'return <span data-testid={Frozen.Prefix+".item--text"}/>;', false, 'declare function log(x:unknown):void; log(Frozen);'],
            ['destructured_parameter', 'return <span data-testid={untouched.name+".item--text"}/>;', true, 'function mutate({name}:any){name.clear();} mutate(untouched);'],
            ['method_this', 'return <span data-testid={methodStore.name+".item--text"}/>;', true, 'methodStore.erase();'],
            ['unknown_callee', 'return <span data-testid={untouched.name+".item--text"}/>;', true, 'declare const unknown:any; unknown(untouched);'],
            ['partial_readonly', 'return <span data-testid={partial.name+".item--text"}/>;', true, 'declare const unknown:any; unknown(partial);'],
            ['alias_write', 'return <span data-testid={untouched.name+".item--text"}/>;', true, 'const alias=untouched; alias.name=undefined;'],
            ['guarded_object', 'if(store.name){clear(); return <span data-testid={store.name+".error--text"}/>;} return null;', true],
            ['object', 'clear(); return <span data-testid={store.name+".error--text"}/>;', true],
            ['guarded_let', 'if(current){reset(); return <span data-testid={current+".error--text"}/>;} return null;', true],
            ['let', 'reset(); return <span data-testid={current+".error--text"}/>;', true],
            ['primitive', 'return <span data-testid={stable+".value--text"}/>;', false],
            ['unchanged_object', 'return <span data-testid={untouched.name+".value--text"}/>;', false],
        ] as const;
        for (const [label, body, unsafe, other = ''] of cases) {
            fs.writeFileSync(path.join(root, 'other.ts'), `import {Constants,Frozen,untouched,methodStore,partial} from "./store"; ${other}`);
            fs.writeFileSync(path.join(root, 'source.tsx'), `import React from "react"; import {store,clear,current,reset,stable,untouched,Constants,Frozen,methodStore,partial} from "./store"; export function App(){${body}}`);
            const out = scan();
            assert.equal(out.diagnostics.some((d) => (d.rule === 'undefined' || d.rule === 'unresolved')), unsafe, `${label}: ${JSON.stringify(out.diagnostics)}`);
        }
    });
});

test('a row rendering each component of an array prop renders the components its mount passes', () => {
    const scanned = scanSource({
        'dropdown.tsx': [
            "import React from 'react';",
            'type Props = {user: {id: string}; testIdScope?: string};',
            'class Dropdown extends React.Component<Props> {',
            '    render() {',
            '        return <div><button data-testid={this.props.testIdScope ? `${this.props.testIdScope}.role--button` : undefined}/><span data-testid={this.props.testIdScope ? `${this.props.testIdScope}.error--text` : undefined}/></div>;',
            '    }',
            '}',
            'export default Dropdown;',
        ].join('\n'),
        'index.ts': [
            "import Dropdown from './dropdown';",
            'declare function connect(map: unknown): <C>(component: C) => C;',
            'export default connect(() => ({}))(Dropdown);',
        ].join('\n'),
        'list.tsx': [
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
        ].join('\n'),
    });
    const templates = scanned.manifest.elements.map((element) => element.template);
    assert.ok(templates.includes('members.user.action.role--button'), JSON.stringify(templates));
    assert.ok(templates.includes('members.user.action.error--text'), JSON.stringify(templates));
    assert.equal(templates.some((template) => template.startsWith('plain.user.action')), false, `a mount passing no actions renders none: ${JSON.stringify(templates)}`);
});

function scanApp(source: string[]) {
    return scanSource({
        'source.tsx': ["import React from 'react';", 'type C = React.ComponentType<any>;', ...source].join('\n'),
    }, {include: ['source.tsx']});
}

test('components passed down a chain of dynamic tags deeper than a few levels, innermost written first, all render', () => {
    // each level renders the component its mount passes and hands it the next one, so level k is known only once
    // level k - 1's usage is: one level per pass, in the worst (reversed) source order
    const scanned = scanApp([
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
    const scanned = scanApp([
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

// A dialogType forward declares nothing, but it may never hide a component choice: a default is a definition, and a
// registry or binding that code can write to after it is built is not finite.
const COMPONENTS = 'function One(){return <button data-testid="one.close--button"/>;} function Two(){return <button data-testid="two.close--button"/>;}';

/** Scans one source file; returns the components it mounts (candidates included) and whether a dialogType input error was reported. */
function scan(source: string, extra: Record<string, string> = {}): {mounted: string[]; error: boolean} {
    return withSource({
        'client.ts': 'export class Client4 {doFetch<T>(url: string, options: unknown): Promise<T> {throw new Error(url);} users = () => this.doFetch("/api/v4/users", {method: "GET"});}',
        'source.tsx': `${COMPONENTS} ${source}`,
    }, {config: {client: {file: 'client.ts', className: 'Client4', urlVersion: '/api/v4'}}, configFile: 'config.json'}, ({root, scan}) => {
        for (const [file, text] of Object.entries(extra)) {
            fs.writeFileSync(path.join(root, file), text);
        }
        const result = scan();
        return {
            mounted: result.manifest.components.map((component) => component.name).sort(),
            error: result.diagnostics.some((d) => d.severity === 'error' && d.rule === 'input' && d.message.includes('dialogType')),
        };
    });
}

test('a forward through a const binding declares nothing and is no error', () => {
    assert.deepEqual(scan('declare const data: {dialogType: unknown}; const {dialogType} = data; export const descriptor = {dialogType};'), {mounted: [], error: false});
    assert.deepEqual(scan('export function open({dialogType}: {dialogType: unknown}) { return {dialogType}; }'), {mounted: [], error: false});
});

test('the default of a forward\'s binding is a definition: a candidate when it resolves, an error when it does not', () => {
    assert.deepEqual(scan('declare const data: {dialogType?: unknown}; const {dialogType = One} = data; export const descriptor = {dialogType};'), {mounted: ['One'], error: false});
    assert.deepEqual(scan('export function open({dialogType = Two}: {dialogType?: unknown}) { return {dialogType}; }'), {mounted: ['Two'], error: false});
    assert.deepEqual(scan('declare const data: {dialogType?: unknown}; declare const unknown: unknown; const {dialogType = unknown} = data; export const descriptor = {dialogType};'), {mounted: [], error: true});
});

test('a registry is finite only when it is a const nothing writes to', () => {
    assert.deepEqual(scan('const registry = {one: One, two: Two}; declare const id: "one" | "two"; export const descriptor = {dialogType: registry[id]};'), {mounted: ['One', 'Two'], error: false});
    for (const write of [
        'registry.later = Two;',
        'registry["later"] = Two;',
        'Object.assign(registry, {later: Two});',
        'Object.defineProperty(registry, "later", {value: Two});',
        'delete registry.one;',
    ]) {
        assert.equal(scan(`const registry: Record<string, unknown> = {one: One}; ${write} declare const id: string; export const descriptor = {dialogType: registry[id]};`).error, true, write);
    }
    assert.equal(scan('let registry: Record<string, unknown> = {one: One}; declare const id: string; export const descriptor = {dialogType: registry[id]};').error, true, 'a let registry');

    // anything that can reach it other than a member read can add a choice
    for (const escape of [
        'const alias = registry; alias.later = Two;',
        'declare function mutate(r: object): void; mutate(registry);',
        'export {registry};',
        'export default registry;',
        'export function get() { return registry; }',
        'const copy = {...registry};',
    ]) {
        assert.equal(scan(`const registry: Record<string, unknown> = {one: One}; ${escape} declare const id: string; export const descriptor = {dialogType: registry[id]};`).error, true, escape);
    }
    assert.equal(scan('export const registry: Record<string, unknown> = {one: One}; declare const id: string; export const descriptor = {dialogType: registry[id]};').error, true, 'an exported registry');

    // only the standard library's Object reads without writing: a local one is any other helper
    assert.equal(scan('const Object = {keys(x: Record<string, unknown>) { x.later = Two; return []; }}; const registry: Record<string, unknown> = {one: One}; Object.keys(registry); declare const id: string; export const descriptor = {dialogType: registry[id]};').error, true, 'a local Object');
    assert.equal(scan('import {Object} from "./objects"; const registry: Record<string, unknown> = {one: One}; Object.keys(registry); declare const id: string; export const descriptor = {dialogType: registry[id]};', {'objects.ts': 'export const Object = {keys(x: Record<string, unknown>) { return [x]; }};'}).error, true, 'an imported Object');

    // a member read and a type query are not escapes
    assert.deepEqual(scan('const registry = {one: One, two: Two}; type Ids = keyof typeof registry; declare const id: Ids; const first = registry.one; const ids = new Set(Object.keys(registry)); export const descriptor = {dialogType: registry[id]}; export const used = [first, ids];'), {mounted: ['One', 'Two'], error: false});
});

test('a reassigned or let binding is not a forward: it is resolved, and fails when it cannot be', () => {
    for (const source of [
        'declare const data: {dialogType: unknown}; let {dialogType} = data; dialogType = Two; export const descriptor = {dialogType};',
        'declare const data: {dialogType: unknown}; declare const other: {dialogType: unknown}; let {dialogType} = data; ({dialogType} = other); export const descriptor = {dialogType};',
        'declare const data: {dialogType: unknown}; let {dialogType} = data; export const descriptor = {dialogType};',
    ]) {
        assert.equal(scan(source).error, true, source);
    }
});
