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

function scan(source: string[], allow: unknown[] = []) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-collection-keys-'));
    try {
        installFixtureCompiler(root);
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['source.tsx', path.join(FIXTURES, '_lib')]}));
        fs.writeFileSync(path.join(root, 'test-surface.config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], checks: {keyFields: {allow}}, output: {report: 'surface.json'}}));
        fs.writeFileSync(path.join(root, 'source.tsx'), ["import React from 'react';", ...source].join('\n'));
        const scanned = scanProject(loadConfig(path.join(root, 'test-surface.config.json')));
        const errors = scanned.diagnostics.filter((diagnostic) => diagnostic.severity === 'error').map((diagnostic) => diagnostic.message);
        return {report: scanned.report, errors};
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
}

test('built-in statistics stay a set; the plugin statistics, under their own name, are keyed by a declared record field', () => {
    const {report, errors} = scan([
        'type Props = {title: string; id?: string; testId?: string};',
        "const StatisticCount = ({title, id, testId = 'stats.stat'}: Props) => <div data-testid={id ? `${testId}:${id}--region` : undefined}>{title}</div>;",
        'type Stat = {name: string; value: number};',
        'type State = {pluginSiteStats: Record<string, Stat>};',
        'export class Analytics extends React.PureComponent<{show: boolean}, State> {',
        '    declare readonly state: Readonly<State>;',
        '    render() {',
        '        let postCount;',
        "        if (this.props.show) { postCount = (<StatisticCount id='totalPosts' title='Posts'/>); }",
        '        const pluginCounts = [];',
        "        for (const [key, stat] of Object.entries(this.state.pluginSiteStats)) { pluginCounts.push(<StatisticCount testId='stats.plugin_stat' id={key} title={stat.name}/>); }",
        "        return <div data-testid='stats'>{postCount}<StatisticCount id='totalUsers' title='Users'/><StatisticCount id='totalTeams' title='Teams'/>{pluginCounts}</div>;",
        '    }',
        '}',
    ], [{entity: 'State', module: './source', field: 'pluginSiteStats', keys: true, value: 'plugin_stat', reason: 'A plugin statistic is identified by the key the plugin reports it under.'}]);
    assert.deepEqual(errors, []);
    const parts = report.families[report.scopes.stats.family].parts ?? {};
    const stat = parts.stat?.key;
    assert.ok(stat && stat.kind === 'set', JSON.stringify(parts.stat));
    assert.deepEqual(report.sets[stat.set], ['totalPosts', 'totalTeams', 'totalUsers']);
    assert.deepEqual(parts.plugin_stat?.key, {kind: 'id', value: 'plugin_stat'});
});

test('a record field of a component\'s state, set by an unannotated class field, takes the state type\'s keys entry', () => {
    const {report, errors} = scan([
        'const StatisticCount = ({title, id, testId}: {title: string; id: string; testId: string}) => <div data-testid={`${testId}:${id}--region`}>{title}</div>;',
        'type Stat = {name: string; value: number};',
        'type State = {pluginSiteStats: Record<string, Stat>; loaded: boolean};',
        'export class Analytics extends React.Component<{show: boolean}, State> {',
        '    state = {pluginSiteStats: {} as Record<string, Stat>, loaded: false};',
        '    render() {',
        '        const pluginCounts = [];',
        "        for (const [key, stat] of Object.entries(this.state.pluginSiteStats)) { pluginCounts.push(<StatisticCount testId='stats.plugin_stat' id={key} title={stat.name}/>); }",
        "        return <div data-testid='stats'>{pluginCounts}</div>;",
        '    }',
        '}',
    ], [{entity: 'State', module: './source', field: 'pluginSiteStats', keys: true, value: 'plugin_stat', reason: 'A plugin statistic is identified by the key the plugin reports it under.'}]);
    assert.deepEqual(errors, []);
    assert.deepEqual(report.families[report.scopes.stats.family].parts?.plugin_stat?.key, {kind: 'id', value: 'plugin_stat'});
});

test('the keys of a record a helper takes are those of the record field every call passes it', () => {
    const {report, errors} = scan([
        'type Section = {title: string};',
        'type Props = {adminDefinition: {[key: string]: Section}; other: {[key: string]: Section}};',
        'export class Sidebar extends React.Component<Props> {',
        '    renderRootMenu = (definition: {[key: string]: Section}) => {',
        '        const items: unknown[] = [];',
        '        Object.entries(definition).forEach(([key, section]) => { items.push(<li data-testid={`sidebar.category:${key}`}>{section.title}</li>); });',
        '        return items;',
        '    };',
        '    renderOther = (definition: {[key: string]: Section}) => Object.keys(definition).map((key) => <li data-testid={`sidebar.other:${key}`}/>);',
        "    render() {return <ul data-testid='sidebar'>{this.renderRootMenu(this.props.adminDefinition)}{this.renderOther(this.props.adminDefinition)}{this.renderOther(this.props.other)}</ul>;}",
        '}',
    ], [{entity: 'Props', module: './source', field: 'adminDefinition', keys: true, value: 'admin_section', reason: 'An admin console section is identified by its key in the admin definition.'}]);
    const parts = report.families[report.scopes.sidebar.family].parts ?? {};
    assert.deepEqual(parts.category?.key, {kind: 'id', value: 'admin_section'}, JSON.stringify(parts.category));
    assert.deepEqual(errors.filter((error) => error.includes('sidebar.category')), []);
    assert.ok(errors.some((error) => error.includes('"sidebar.other:{key}"')), `a helper called with two different records takes neither entry: ${JSON.stringify(errors)}`);
});

test('the keys of a record grouped by a field are that field\'s values, through the helpers that build and order it', () => {
    const {report, errors} = scan([
        'type Finding = {id: string; area: string; title: string};',
        'function groupByArea(findings: Finding[]) {',
        '    const byArea: Record<string, Finding[]> = {};',
        '    for (const finding of findings) {',
        '        if (!byArea[finding.area]) {',
        '            byArea[finding.area] = [];',
        '        }',
        '        byArea[finding.area].push(finding);',
        '    }',
        '    return byArea;',
        '}',
        'function orderAreas(findingsByArea: Record<string, Finding[]>): string[] {return Object.keys(findingsByArea).sort((a, b) => a.localeCompare(b));}',
        'function Area({area, findings}: {area: string; findings: Finding[]}) {return <section data-testid={`health.area:${area}`}>{findings.length}</section>;}',
        'export function Groups({findings}: {findings: Finding[]}) {',
        '    const byArea = groupByArea(findings);',
        "    return <div data-testid='health'>{orderAreas(byArea).map((area) => <Area area={area} findings={byArea[area]}/>)}</div>;",
        '}',
        'export function ByTitle({findings}: {findings: Finding[]}) {',
        '    const byTitle: Record<string, Finding[]> = {};',
        '    for (const finding of findings) { byTitle[finding.title] = [finding]; }',
        "    return <div data-testid='titles'>{Object.keys(byTitle).map((title) => <i data-testid={`titles.title:${title}`}/>)}</div>;",
        '}',
    ], [{entity: 'Finding', module: './source', field: 'area', value: 'health_area', freeForm: true, reason: 'A health area is identified by the area its findings report.'}]);
    assert.deepEqual(report.families[report.scopes.health.family].parts?.area?.key, {kind: 'id', value: 'health_area'});
    assert.deepEqual(errors.filter((error) => error.includes('health.area')), []);
    assert.ok(errors.some((error) => error.includes('"titles.title:{key}"')), `a record grouped by a field with no entry stays open: ${JSON.stringify(errors)}`);
});

test('a grouped record that an alias or a call can also fill proves no key', () => {
    const {report, errors} = scan([
        'type Base = {key: string}; type Other = {free: string};',
        'declare const items: Base[]; declare const other: Other;',
        'declare function fill(record: Record<string, unknown[]>): void;',
        'function aliased(list: Base[], extra: Other) {const result: Record<string, unknown[]> = {}; const alias = result; for (const item of list) {result[item.key] = [];} alias[extra.free] = []; return result;}',
        'function passed(list: Base[]) {const result: Record<string, unknown[]> = {}; for (const item of list) {result[item.key] = [];} fill(result); return result;}',
        'function clean(list: Base[]) {const result: Record<string, unknown[]> = {}; for (const item of list) {result[item.key] = [];} return result;}',
        'export function App() {',
        '    const extended = clean(items);',
        '    extended[other.free] = [];',
        "    return <div data-testid='owners'>{Object.keys(aliased(items, other)).map((key) => <i data-testid={`owners.aliased:${key}`}/>)}{Object.keys(passed(items)).map((key) => <i data-testid={`owners.passed:${key}`}/>)}{Object.keys(extended).map((key) => <i data-testid={`owners.extended:${key}`}/>)}{Object.keys(clean(items)).map((key) => <i data-testid={`owners.clean:${key}`}/>)}</div>;",
        '}',
    ], [{entity: 'Base', module: './source', field: 'key', value: 'base_key', freeForm: true, reason: 'A base is identified by its key.'}]);
    const parts = report.families[report.scopes.owners.family].parts ?? {};
    for (const name of ['aliased', 'passed', 'extended']) {
        assert.equal(parts[name], undefined, `${name} has no valid strict key`);
        assert.ok(errors.some((error) => error.includes(`"owners.${name}:{key}"`)), `${name}: ${JSON.stringify(errors)}`);
    }
    assert.deepEqual(parts.clean?.key, {kind: 'id', value: 'base_key'}, 'the same builder read directly is proven');
});

test('a grouped record every call shares (a module cache, a factory closure) proves no key', () => {
    const {report, errors} = scan([
        'type Base = {key: string}; type Other = {free: string};',
        'declare const items: Base[]; declare const other: Other;',
        'const shared: Record<string, unknown[]> = {};',
        'function group(list: Base[]) {for (const item of list) {shared[item.key] = [];} return shared;}',
        'function makeGrouper() {const cache: Record<string, unknown[]> = {}; return {group(list: Base[]) {for (const item of list) {cache[item.key] = [];} return cache;}};}',
        'const grouper = makeGrouper();',
        'export function App() {',
        '    const readable = group(items);',
        '    const escaped = group(items);',
        '    escaped[other.free] = [];',
        "    return <div data-testid='owners'>{Object.keys(readable).map((key) => <i data-testid={`owners.shared:${key}`}/>)}{Object.keys(grouper.group(items)).map((key) => <i data-testid={`owners.closure:${key}`}/>)}</div>;",
        '}',
    ], [{entity: 'Base', module: './source', field: 'key', value: 'base_key', freeForm: true, reason: 'A base is identified by its key.'}]);
    const parts = report.scopes.owners ? report.families[report.scopes.owners.family].parts ?? {} : {};
    for (const name of ['shared', 'closure']) {
        assert.equal(parts[name], undefined, `${name} has no valid strict key`);
        assert.ok(errors.some((error) => error.includes(`"owners.${name}:{key}"`)), `${name}: ${JSON.stringify(errors)}`);
    }
});

test('the keys of a fixed-key object, directly or through a local, are a set, in for-of and in iteration callbacks', () => {
    const {report, errors} = scan([
        'type Definition = {about: {title: string}; reporting: {title: string}; user_management: {title: string}};',
        'declare const definition: Definition;',
        'const findingsByArea = {security: 1, performance: 2};',
        'export function Sidebar() {',
        '    const items = [];',
        '    for (const [key, section] of Object.entries(definition)) { items.push(<li data-testid={`sidebar.category:${key}--listitem`}>{section.title}</li>); }',
        '    const local = findingsByArea;',
        '    return <ul data-testid="sidebar">{items}{Object.keys(local).map((area) => <li data-testid={`sidebar.area:${area}--listitem`}/>)}</ul>;',
        '}',
    ]);
    assert.deepEqual(errors, []);
    const parts = report.families[report.scopes.sidebar.family].parts ?? {};
    for (const [name, values] of Object.entries({category: ['about', 'reporting', 'user_management'], area: ['performance', 'security']})) {
        const key = parts[name]?.key;
        assert.ok(key && key.kind === 'set', `${name}: ${JSON.stringify(parts[name])}`);
        assert.deepEqual(report.sets[key.set], values, name);
    }
});

test('the keys of a record with no entry stay an open string, named by the record they come from', () => {
    const {errors} = scan([
        'type Props = {extra: Record<string, number>};',
        'export function Extra({extra}: Props) {',
        '    return <ul data-testid="extra">{Object.entries(extra).map(([name, count]) => <li data-testid={`extra.item:${name}--listitem`}>{count}</li>)}</ul>;',
        '}',
    ]);
    assert.ok(errors.some((message) => message.includes('Object.entries(extra)[].key')), errors.join('\n'));
});

test('literals at some mounts and a declared id-by-value at another are one identity: the name takes that id', () => {
    const {report, errors} = scan([
        'type Props = {title: string; id?: string};',
        'const StatisticCount = ({title, id}: Props) => <div data-testid={id ? `stats.stat:${id}--region` : undefined}>{title}</div>;',
        'type Stat = {name: string};',
        'type State = {pluginSiteStats: Record<string, Stat>};',
        'export class Analytics extends React.PureComponent<{show: boolean}, State> {',
        '    declare readonly state: Readonly<State>;',
        '    render() {',
        '        const pluginCounts = [];',
        '        for (const [key, stat] of Object.entries(this.state.pluginSiteStats)) { pluginCounts.push(<StatisticCount id={key} title={stat.name}/>); }',
        "        return <div data-testid='stats'><StatisticCount id='totalUsers' title='Users'/>{pluginCounts}</div>;",
        '    }',
        '}',
    ], [{entity: 'State', module: './source', field: 'pluginSiteStats', keys: true, value: 'plugin_stat', reason: 'A plugin statistic is identified by the key the plugin reports it under.'}]);
    assert.deepEqual(errors, []);
    assert.deepEqual(report.families[report.scopes.stats.family].parts?.stat?.key, {kind: 'id', value: 'plugin_stat'});
});

test('an entity id at some mounts and literals at another are two identities: a collision that asks for a second name', () => {
    const {errors} = scan([
        'type Team = {id: string; name: string};',
        'const TeamOption = ({teamId}: {teamId?: string}) => <li data-testid={teamId ? `filters.team_option:${teamId}--option` : undefined}/>;',
        'declare const teams: Team[];',
        "export function Filters() {return <ul data-testid='filters'><TeamOption teamId='all'/>{teams.map((team) => <TeamOption teamId={team.id}/>)}</ul>;}",
    ], [{entity: 'Team', module: './source', field: 'id', value: 'team', reason: 'A team is identified by its id.'}]);
    assert.deepEqual(errors.filter((message) => message.includes('two key kinds')), []);
    const {errors: entityErrors} = scanEntity();
    assert.deepEqual(entityErrors, ['"filters.team_option:{key}--option" is keyed two ways at its mounts (Team.id, set): one name, two key kinds: give the second its own name.']);
});

/** The same component with Team declared as an entity, so its id is an entity id rather than an id-by-value. */
function scanEntity() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-collection-keys-'));
    try {
        installFixtureCompiler(root);
        fs.mkdirSync(path.join(root, 'types'));
        fs.writeFileSync(path.join(root, 'types/entities.ts'), 'export interface Team {id: string; display_name: string}');
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['source.tsx', 'types', path.join(FIXTURES, '_lib')]}));
        fs.writeFileSync(path.join(root, 'test-surface.config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], entityTypeDirs: ['types'], checks: {}, output: {report: 'surface.json'}}));
        fs.writeFileSync(path.join(root, 'source.tsx'), [
            "import React from 'react'; import type {Team} from './types/entities';",
            'const TeamOption = ({teamId}: {teamId?: string}) => <li data-testid={teamId ? `filters.team_option:${teamId}--option` : undefined}/>;',
            'declare const teams: Team[];',
            "export function Filters() {return <ul data-testid='filters'><TeamOption teamId='all'/>{teams.map((team) => <TeamOption teamId={team.id}/>)}</ul>;}",
        ].join('\n'));
        const scanned = scanProject(loadConfig(path.join(root, 'test-surface.config.json')));
        return {errors: scanned.diagnostics.filter((diagnostic) => diagnostic.severity === 'error').map((diagnostic) => diagnostic.message)};
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
}

test('only the standard Object gets the keys model: a local Object of the same name is read as its own code', () => {
    const {report} = scan([
        "const Object = {keys(value: unknown) {return ['fake'] as const;}};",
        'type State = {stats: Record<string, number>};',
        'declare const state: State;',
        "export function Stats() {return <ul data-testid='stats'>{Object.keys(state.stats).map((name) => <li data-testid={`stats.item:${name}--listitem`}/>)}</ul>;}",
    ], [{entity: 'State', module: './source', field: 'stats', keys: true, value: 'stat', reason: 'A statistic is identified by its key.'}]);
    const key = report.families[report.scopes.stats.family].parts?.item?.key;
    assert.notDeepEqual(key, {kind: 'id', value: 'stat'}, `the local Object's keys are not the record's: ${JSON.stringify(key)}`);
});
