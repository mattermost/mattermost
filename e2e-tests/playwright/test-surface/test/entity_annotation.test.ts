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

test('entity field annotations resolve symbols without trusting wrappers, casts or mixed identities', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-entity-annotation-'));
    try {
        installFixtureCompiler(root);
        fs.mkdirSync(path.join(root, 'entities'));
        fs.writeFileSync(path.join(root, 'entities/user.ts'), 'export type User = {id: string; name: string}; export type Team = {id: string; name: string};');
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['source.tsx', 'entities', path.join(FIXTURES, '_lib')]}));
        const config = path.join(root, 'config.json');
        fs.writeFileSync(config, JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], entityTypeDirs: ['entities'], checks: {strictPaths: ['source.tsx'], keyFields: {allow: [{entity: 'User', module: './entities/user', field: 'name', value: 'user_name', freeForm: true, reason: 'The external lookup identifies users by their canonical account name.'}]}}, output: {report: 'surface.json'}}));
        fs.writeFileSync(path.join(root, 'source.tsx'), [
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
        ].join('\n'));
        const out = scanProject(loadConfig(config));
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
        const missing = scanProject(loadConfig(config));
        assert.ok(missing.diagnostics.some((diagnostic) => diagnostic.rule === 'undefined' && diagnostic.severity === 'error'), 'an annotation supplies identity, never an invented value');
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});
