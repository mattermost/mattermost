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

test('configured field identities survive typed array elements passed through keyed child props', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-key-fields-'));
    try {
        installFixtureCompiler(root);
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['source.tsx', path.join(FIXTURES, '_lib')]}));
        fs.writeFileSync(path.join(root, 'test-surface.config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], checks: {keyFields: {allow: [{entity: 'ThemeElement', module: './source', field: 'id', value: 'theme_element', reason: 'The theme element id names its color setting.'}]}}, output: {report: 'surface.json'}}));
        fs.writeFileSync(path.join(root, 'source.tsx'), [
            'type ThemeElement = {id: string}; type OtherElement = {id: string}; declare const Constants: {THEME_ELEMENTS: ThemeElement[]; OTHER_ELEMENTS: OtherElement[]};',
            // eslint-disable-next-line no-template-curly-in-string -- fixture source
            'function ColorInput({testId, testKey}: {testId: string; testKey: string}) {return <button data-testid={`${testId}.element:${testKey}--button`}/>;}',
            'function ColorChooser({testId, id}: {testId: string; id: string}) {return <ColorInput testId={testId} testKey={id}/>;}',
            'export function App() {const rows = []; Constants.THEME_ELEMENTS.forEach((element) => rows.push(<ColorChooser testId="theme" id={element.id}/>)); Constants.OTHER_ELEMENTS.forEach((element) => rows.push(<ColorChooser testId="other" id={element.id}/>)); return <div>{rows}</div>;}',
        ].join('\n'));
        const config = loadConfig(path.join(root, 'test-surface.config.json'));
        const scanned = scanProject(config);
        const key = scanned.manifest.elements.find((element) => element.template === 'theme.element:{key}--button')?.key;
        assert.equal(key?.kind, 'id');
        assert.equal(key?.value, 'theme_element');
        assert.deepEqual([...new Set(scanned.diagnostics.filter((diagnostic) => diagnostic.rule === 'key-origin' && diagnostic.severity === 'error').map((diagnostic) => diagnostic.template))], ['other.element:{key}--button']);
        config.checks.keyFields.allow = [];
        assert.ok(scanProject(config).diagnostics.some((diagnostic) => diagnostic.rule === 'key-origin' && diagnostic.template === 'theme.element:{key}--button'));
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});
