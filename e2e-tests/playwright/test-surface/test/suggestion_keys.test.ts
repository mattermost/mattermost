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

test('suggestion terms retain their configured key origin through renderItem arguments', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-suggestion-keys-'));
    try {
        installFixtureCompiler(root);
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['*.tsx', path.join(FIXTURES, '_lib')]}));
        fs.writeFileSync(path.join(root, 'test-surface.config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], checks: {keyFields: {allow: [{entity: 'Results', module: './source', field: 'terms', value: 'term', reason: 'Terms identify suggestions across reordering.'}]}}, output: {report: 'surface.json'}}));
        fs.writeFileSync(path.join(root, 'source.tsx'), [
            'type Results = {items: unknown[]; terms: string[]; groups: Results[]};',
            // eslint-disable-next-line no-template-curly-in-string -- fixture source
            'export function Suggestions({results}: {results: Results}) {function renderItem(item: unknown, term: string) {return <li role="option" data-testid={`suggestions.suggestion:${term}--option`}/>;} const contents = []; for (let i = 0; i < results.items.length; i++) {contents.push(renderItem(results.items[i], results.terms[i]));} for (const group of results.groups) {contents.push(group.items.map((item, i) => renderItem(item, group.terms[i])));} return <ul>{contents}</ul>;}',
            // eslint-disable-next-line no-template-curly-in-string -- fixture source
            'export function ArrayProperty({results}: {results: Results}) {return <li role="option" data-testid={`suggestions.length:${results.terms["length"]}--option`}/>;}',
        ].join('\n'));
        const config = loadConfig(path.join(root, 'test-surface.config.json'));
        const scanned = scanProject(config);
        assert.deepEqual(scanned.diagnostics.filter((diagnostic) => diagnostic.rule === 'key-origin' || diagnostic.rule === 'allow'), []);
        const key = scanned.manifest.elements.find((element) => element.template === 'suggestions.suggestion:{key}--option')?.key;
        assert.equal(key?.kind, 'id');
        assert.equal(key?.value, 'term');
        assert.equal(scanned.manifest.elements.find((element) => element.template === 'suggestions.length:{key}--option')?.key?.kind, 'number');
        config.checks.keyFields.allow = [];
        assert.ok(scanProject(config).diagnostics.some((diagnostic) => diagnostic.rule === 'key-origin' && diagnostic.template === 'suggestions.suggestion:{key}--option'));
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});
