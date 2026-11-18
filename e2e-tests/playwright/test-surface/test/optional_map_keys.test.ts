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

test('options built by an optional-chained map take the keyFields entry of the field their value comes from', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-optional-map-'));
    try {
        installFixtureCompiler(root);
        fs.mkdirSync(path.join(root, 'types'));
        fs.writeFileSync(path.join(root, 'types/apps.ts'), 'export type AppSelectOption = {label: string; value: string}; export type AppField = {name: string; options?: AppSelectOption[]};');
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['*.tsx', 'types', path.join(FIXTURES, '_lib')]}));
        const allow = [{entity: 'AppSelectOption', field: 'value', value: 'option', freeForm: true, reason: 'An app form option is identified by its value.'}];
        fs.writeFileSync(path.join(root, 'test-surface.config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], entityTypeDirs: ['types'], checks: {keyFields: {allow}}, output: {report: 'surface.json'}}));
        fs.writeFileSync(path.join(root, 'source.tsx'), [
            "import React from 'react'; import type {AppField} from './types/apps';",
            'type Option = {text: string; value: string};',
            'function RadioSetting({options = [], testId}: {options?: Option[]; testId?: string}) {',
            '    return <div data-testid={testId}>{options.map(({value: option, text}) => <input key={option} type="radio" aria-label={text} data-testid={testId ? `${testId}.option:${option}--radio` : undefined}/>)}</div>;',
            '}',
            "export function AppsFormField({field}: {field: AppField}) {return <RadioSetting testId='apps_form.field' options={field.options?.map((o) => ({text: o.label, value: o.value}))}/>;}",
        ].join('\n'));
        const scanned = scanProject(loadConfig(path.join(root, 'test-surface.config.json')));
        const errors = scanned.diagnostics.filter((diagnostic) => diagnostic.rule === 'key-origin' && diagnostic.severity === 'error').map((diagnostic) => diagnostic.message);
        assert.deepEqual(errors, []);
        const mount = scanned.report.scopes['apps_form.field'];
        const part = scanned.report.families[mount.family].parts?.option;
        assert.deepEqual(part?.key, {kind: 'id', entity: 'AppSelectOption', field: 'value', from: '@mattermost/types/apps'}, JSON.stringify(part));
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});
