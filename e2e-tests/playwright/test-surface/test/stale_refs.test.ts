// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {test} from 'node:test';

import {loadConfig} from '../src/config.ts';
import type {Manifest} from '../src/manifest_types.ts';
import {staleReferences} from '../src/stale_refs.ts';

/** A config whose stale-reference roots are `roots` under a fresh directory, and a manifest rendering `templates`. */
function setup(files: Record<string, string>, templates: string[], roots = ['tests']) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stale-refs-'));
    for (const [name, text] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(dir, name)), {recursive: true});
        fs.writeFileSync(path.join(dir, name), text);
    }
    fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], output: {report: 'report.json'}, staleReferences: {roots}}));
    const config = loadConfig(path.join(dir, 'config.json'));
    const manifest = {elements: templates.map((template) => ({template}))} as unknown as Manifest;
    return {dir, run: () => staleReferences(manifest, config).map((d) => [d.severity, d.at, d.message.split(' ')[0]])};
}

test('stale references: test files in every module and JSX flavour are read, declaration files are not', () => {
    const lookup = "screen.getByTestId('gone.thing');\n";
    const {dir, run} = setup({'tests/a.test.tsx': lookup, 'tests/b.jsx': lookup, 'tests/c.mjs': lookup, 'tests/d.cjs': lookup, 'tests/e.d.ts': lookup}, ['live.thing']);
    try {
        assert.deepEqual(run(), ['a.test.tsx', 'b.jsx', 'c.mjs', 'd.cjs'].map((f) => ['error', `tests/${f}:1`, '"gone.thing"']));
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});

test('stale references: a lookup written in full matches a short keyed template exactly; a partial one keeps the floor', () => {
    const {dir, run} = setup({'tests/a.spec.ts': "page.getByTestId('ab:42');\npage.getByTestId('ab:');\npage.getByTestId('abc:1');\n"}, ['ab:{key}']);
    try {
        assert.deepEqual(run(), [['error', 'tests/a.spec.ts:2', '"ab:"'], ['error', 'tests/a.spec.ts:3', '"abc:1"']]);
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});

test('stale references: a configured root is relative to the config, and one that is missing is an error', () => {
    const {dir, run} = setup({'tests/a.spec.ts': "page.getByTestId('live.thing');\n"}, ['live.thing'], ['tests', 'missing']);
    try {
        const cwd = process.cwd();
        process.chdir(os.tmpdir());
        try {
            assert.deepEqual(run(), [['error', 'config.json', 'staleReferences']]);
        } finally {
            process.chdir(cwd);
        }
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});
