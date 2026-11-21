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

test('generic component keys use each JSX mount type argument, including local configured identities', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-generic-keys-'));
    try {
        installFixtureCompiler(root);
        fs.mkdirSync(path.join(root, 'types'));
        fs.writeFileSync(path.join(root, 'types/entities.ts'), 'export interface User {id: string; username: string} export interface Team {id: string; display_name: string}');
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['source.tsx', 'types', path.join(FIXTURES, '_lib')]}));
        fs.writeFileSync(path.join(root, 'test-surface.config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], entityTypeDirs: ['types'], checks: {keyFields: {allow: [{entity: 'OptionValue', module: './source', field: 'id', value: 'option', reason: 'The local option id identifies an available option.'}]}}, output: {report: 'surface.json'}}));
        fs.writeFileSync(path.join(root, 'source.tsx'), [
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
        ].join('\n'));
        const scanned = scanProject(loadConfig(path.join(root, 'test-surface.config.json')));
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
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});

test('a generic helper\'s element type is the one of the call the value flows through, not of every call of the helper', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-generic-keys-'));
    try {
        installFixtureCompiler(root);
        fs.mkdirSync(path.join(root, 'types'));
        fs.writeFileSync(path.join(root, 'types/entities.ts'), 'export interface Team {id: string; display_name: string} export interface TeamMembership extends Team {team_id: string}');
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['source.tsx', 'types', path.join(FIXTURES, '_lib')]}));
        fs.writeFileSync(path.join(root, 'test-surface.config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], entityTypeDirs: ['types'], checks: {}, output: {report: 'surface.json'}}));
        fs.writeFileSync(path.join(root, 'source.tsx'), [
            "import React from 'react'; import type {Team, TeamMembership} from './types/entities';",
            'function sortTeams<T extends Team>(teams: T[]): T[] {const custom = teams.filter((team) => team.id !== ""); const other = teams.filter((team) => team.id === ""); return [...custom, ...other];}',
            // eslint-disable-next-line no-template-curly-in-string -- fixture source
            'function TeamButton({teamId}: {teamId?: string}) {return <div data-testid={teamId ? `sidebar.team:${teamId}` : undefined}/>;}',
            'declare const myTeams: Team[]; declare const memberships: TeamMembership[];',
            'export const sortedMemberships = sortTeams(memberships);',
            "export function Sidebar() {const teams = sortTeams(myTeams); return <div data-testid='sidebar'>{teams.map((team: Team) => <TeamButton teamId={team.id}/>)}</div>;}",
        ].join('\n'));
        const scanned = scanProject(loadConfig(path.join(root, 'test-surface.config.json')));
        const errors = scanned.diagnostics.filter((diagnostic) => diagnostic.severity === 'error').map((diagnostic) => diagnostic.message);
        assert.deepEqual(errors, []);
        const parts = scanned.report.families[scanned.report.scopes.sidebar.family].parts ?? {};
        assert.deepEqual(parts.team?.key, {kind: 'id', entity: 'Team', field: 'id', from: '@mattermost/types/entities'}, JSON.stringify(parts.team));
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});
