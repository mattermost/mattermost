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

test('the second parameter of a named array callback stays a numeric child key', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-callback-index-'));
    try {
        installFixtureCompiler(root);
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['source.tsx', path.join(FIXTURES, '_lib')]}));
        fs.writeFileSync(path.join(root, 'test-surface.config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], checks: {}, output: {report: 'surface.json'}}));
        fs.writeFileSync(path.join(root, 'source.tsx'), [
            // eslint-disable-next-line no-template-curly-in-string -- fixture source
            'function Chip({testId, testKey}: {testId?: string; testKey?: string | number}) {let chipTestId = "attributeChip"; if (testId) {chipTestId = testKey === undefined ? testId : `${testId}:${testKey}`;} return <span data-testid={chipTestId}><span data-testid={`${testId}.value--text`}/></span>;}',
            'export function Labels({ids}: {ids: string[]}) {const renderChip = (id: string, index: number) => <Chip testId="labels.chip" testKey={index}/>; return <div data-testid="labels">{ids.map(renderChip)}</div>;}',
        ].join('\n'));
        const scanned = scanProject(loadConfig(path.join(root, 'test-surface.config.json')));
        const chip = scanned.manifest.elements.find((element) => element.template === 'labels.chip:{key}');
        assert.equal(chip?.key?.kind, 'number');
        assert.deepEqual(scanned.report.families[scanned.report.scopes.labels.family].children?.chip.key, {kind: 'index'});
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});
