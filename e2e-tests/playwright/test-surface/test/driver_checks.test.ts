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
import {FamilyParts, packageOf} from '../src/parts.ts';
import {loadProgram} from '../src/program.ts';
import {ProgramIndex} from '../src/program_index.ts';
import {writeReports} from '../src/report.ts';
import {Roles} from '../src/roles.ts';
import {Resolver} from '../src/values.ts';

const stateKinds = ['checkbox', 'switch', 'radio', 'togglebutton', 'menuitemcheckbox', 'menuitemradio', 'tab', 'option', 'combobox', 'listbox', 'radiogroup', 'textbox', 'searchbox', 'spinbutton'];
const plainKinds = ['button', 'link', 'menuitem', 'text', 'region', 'group', 'row', 'dialog', 'alertdialog', 'menu', 'tooltip', 'alert', 'status', 'img', 'list', 'listitem', 'grid', 'gridcell', 'tablist', 'tabpanel', 'separator', 'slider'];

test('strict driver checks require only readable state/input roles and omit unreachable source checks', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-driver-checks-'));
    try {
        installFixtureCompiler(root);
        fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({name: 'driver-fixture', version: '1.0.0'}));
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['*.tsx', path.join(FIXTURES, '_lib')]}));
        fs.writeFileSync(path.join(root, 'source.tsx'), [
            'import React from "react"; export function App(){return <>',
            ...stateKinds.map((kind) => `<div data-testid="driver.bad_${kind}--${kind}"/><div ${['textbox', 'searchbox', 'spinbutton'].includes(kind) ? 'contentEditable' : ''} role="${kind}" data-testid="driver.good_${kind}--${kind}"/>`),
            ...plainKinds.map((kind) => `<span role="unknown_role" onClick={()=>{}} data-testid="driver.plain_${kind}--${kind}"/>`),
            '<button data-testid="plain_container"><span data-testid="plain_container.child--text"/></button></>;}',
        ].join('\n'));
        fs.writeFileSync(path.join(root, 'orphan.tsx'), 'import React from "react"; declare const missing:string|undefined; export function Orphan(){return <><div data-testid="Wrong-ID"/><input data-testid={missing+".value--checkbox"}/></>;}');
        const file = path.join(root, 'config.json');
        fs.writeFileSync(file, JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], entries: ['source.tsx'], checks: {strictPaths: ['.']}, output: {report: 'surface.json'}}));
        const out = scanProject(loadConfig(file));
        const failures = out.diagnostics.filter((diagnostic) => diagnostic.rule === 'role-fit');
        assert.equal(failures.length, stateKinds.length, JSON.stringify(out.diagnostics));
        assert.ok(failures.every((diagnostic) => diagnostic.template?.startsWith('driver.bad_')));
        assert.ok(!out.diagnostics.some((diagnostic) => String(diagnostic.rule) === 'aria'));
        assert.ok(!out.diagnostics.some((diagnostic) => diagnostic.at.startsWith('orphan.tsx')));
        assert.deepEqual(out.result.notReachableFiles, ['orphan.tsx']);
        writeReports(path.join(root, 'reports'), out.result, out.diagnostics);
        const excluded = fs.readFileSync(path.join(root, 'reports/not_reachable.txt'), 'utf8');
        assert.equal(excluded.split('orphan.tsx').length - 1, 1);
        assert.match(excluded, /not reachable from the configured entries/);

        // eslint-disable-next-line no-template-curly-in-string -- The fixture declares runtime template expressions.
        fs.writeFileSync(path.join(root, 'library.tsx'), 'import React from "react"; export function Click({testId}:{testId?:string}){return <div data-testid={testId?`${testId}--button`:undefined}/>;} export function BadState({testId}:{testId?:string}){return <div data-testid={testId?`${testId}--checkbox`:undefined}/>;} export function GoodState({testId}:{testId?:string}){return <input type="checkbox" data-testid={testId?`${testId}--checkbox`:undefined}/>;}');
        fs.writeFileSync(file, JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], library: {entry: 'library.tsx'}, output: {report: 'surface.json'}}));
        const config = loadConfig(file);
        const ix = new ProgramIndex(loadProgram(config), config);
        const R = new Resolver(ix);
        const parts = new FamilyParts(ix, R, new Roles(ix, R), config.library!);
        parts.build(config.library!.entry, packageOf(config));
        assert.equal(parts.diagnostics.length, 1, JSON.stringify(parts.diagnostics));
        assert.match(parts.diagnostics[0].message, /checkbox/);
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});
