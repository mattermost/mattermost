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

test('entry drivers fit native typing capability rather than a combobox ARIA role', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-entry-capability-'));
    try {
        installFixtureCompiler(root);
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['*.tsx', path.join(FIXTURES, '_lib')]}));
        fs.writeFileSync(path.join(root, 'source.tsx'), [
            'import React from "react"; declare const dynamicType:string; declare const finiteType:"text"|"number"; declare const wrongFiniteType:"text"|"checkbox"; declare const flag:boolean; export function App(){return <>',
            '<input role="combobox" data-testid="entry.input--textbox"/>',
            '<input type="number" data-testid="entry.numeric_text--textbox"/>',
            '<input type={finiteType} data-testid="entry.finite_text--textbox"/>',
            '<input type={wrongFiniteType} data-testid="entry.bad_finite--textbox"/>',
            '{flag ? <textarea data-testid="entry.numeric_choice--textbox"/> : <input type="number" data-testid="entry.numeric_choice--textbox"/>}',
            '<input type="date" role="combobox" data-testid="entry.date--textbox"/>',
            '<input type="time" role="combobox" data-testid="entry.time--searchbox"/>',
            '<input type="datetime-local" data-testid="entry.datetime--textbox"/>',
            '<input type="month" data-testid="entry.month--textbox"/>',
            '<input type="week" data-testid="entry.week--textbox"/>',
            '<input type="range" role="combobox" data-testid="entry.bad_range--textbox"/>',
            '<input type="color" role="combobox" data-testid="entry.bad_color--textbox"/>',
            '<textarea role="combobox" data-testid="entry.area--textbox"/>',
            '<input type="search" role="combobox" data-testid="entry.search--searchbox"/>',
            '<div contentEditable role="combobox" data-testid="entry.editable--textbox"/>',
            '<input type="number" role="combobox" data-testid="entry.number--spinbutton"/>',
            '<div role="combobox" data-testid="entry.bad_div--textbox"/>',
            '<button role="combobox" data-testid="entry.bad_button--textbox"/>',
            '<input type="checkbox" role="combobox" data-testid="entry.bad_checkbox--textbox"/>',
            '<input type={dynamicType} role="combobox" data-testid="entry.bad_dynamic--textbox"/>',
            '{flag ? <input role="combobox" data-testid="entry.choice--textbox"/> : <input role="textbox" data-testid="entry.choice--textbox"/>}',
            '<div contentEditable={false} role="textbox" data-testid="entry.bad_readonly--textbox"/>',
            '</>;}'].join('\n'));
        const file = path.join(root, 'config.json');
        fs.writeFileSync(file, JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], checks: {strictPaths: ['.']}, output: {report: 'surface.json'}}));
        const out = scanProject(loadConfig(file));
        assert.equal(out.diagnostics.some((diagnostic) => diagnostic.rule === 'duplicates'), false, JSON.stringify(out.diagnostics));
        const bad = out.diagnostics.filter((diagnostic) => diagnostic.rule === 'role-fit').map((diagnostic) => diagnostic.template).sort();
        assert.deepEqual(bad, ['entry.bad_button--textbox', 'entry.bad_checkbox--textbox', 'entry.bad_color--textbox', 'entry.bad_div--textbox', 'entry.bad_dynamic--textbox', 'entry.bad_finite--textbox', 'entry.bad_range--textbox', 'entry.bad_readonly--textbox']);
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});
