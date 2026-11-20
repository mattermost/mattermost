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

function scan(files: Record<string, string[]>, allow: unknown[]) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-test-key-props-'));
    try {
        installFixtureCompiler(root);
        fs.mkdirSync(path.join(root, 'types'));
        fs.mkdirSync(path.join(root, 'menu'));
        fs.writeFileSync(path.join(root, 'types/entities.ts'), 'export interface Team {id: string; display_name: string}');
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['*.tsx', 'menu', 'types', path.join(FIXTURES, '_lib')]}));
        fs.writeFileSync(path.join(root, 'test-surface.config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], entityTypeDirs: ['types'], checks: {keyFields: {allow}}, output: {report: 'surface.json'}}));
        for (const [file, lines] of Object.entries(files)) {
            fs.writeFileSync(path.join(root, file), lines.join('\n'));
        }
        const scanned = scanProject(loadConfig(path.join(root, 'test-surface.config.json')));
        const errors = scanned.diagnostics.filter((diagnostic) => diagnostic.severity === 'error').map((diagnostic) => diagnostic.message);
        return {report: scanned.report, errors};
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
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
