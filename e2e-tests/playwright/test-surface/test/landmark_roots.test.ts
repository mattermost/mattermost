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

test('a bare-word testid on a landmark (role banner) is its scope\'s container, and holds what it renders', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-landmark-roots-'));
    try {
        installFixtureCompiler(root);
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['source.tsx', path.join(FIXTURES, '_lib')]}));
        fs.writeFileSync(path.join(root, 'test-surface.config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], output: {report: 'surface.json'}}));
        fs.writeFileSync(path.join(root, 'source.tsx'), [
            "import React from 'react';",
            "function Markdown({text}: {text: string}) {return <span data-testid='markdown.link--link'>{text}</span>;}",
            'export function Header({text}: {text: string}) {',
            "    return <div data-testid='header' role='banner' aria-label='header'><div data-testid='header.description'><Markdown text={text}/></div></div>;",
            '}',
            "export function Toolbar() {return <div data-testid='toolbar' role='button'><Markdown text='x'/></div>;}",
        ].join('\n'));
        const scanned = scanProject(loadConfig(path.join(root, 'test-surface.config.json')));
        const family = scanned.report.families[scanned.report.scopes.header.family];
        assert.deepEqual(family.container, {role: null}, JSON.stringify(family));
        assert.deepEqual(family.renders, ['markdown'], JSON.stringify(family));
        const unscoped = scanned.diagnostics.filter((diagnostic) => diagnostic.rule === 'unscoped').map((diagnostic) => diagnostic.message);
        assert.deepEqual(unscoped, ['"toolbar" has no declared parts or children.'], 'a plain container can be operated; only its missing members are listed');
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});
