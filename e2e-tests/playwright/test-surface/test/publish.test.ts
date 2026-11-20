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
import {generate} from '../src/generate/index.ts';
import {serialize} from '../src/report_types.ts';

test('report: lines added above every element change neither the report nor the generated page objects', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'test-surface-publish-'));
    installFixtureCompiler(root);
    fs.cpSync(path.join(FIXTURES, '_lib'), path.join(root, '_lib'), {recursive: true});
    fs.cpSync(path.join(FIXTURES, 'ui'), path.join(root, 'ui'), {recursive: true});
    const run = async (name: string) => {
        const config = loadConfig(path.join(root, 'ui', 'test-surface.config.json'));
        config.output.generated = path.join(root, name);
        config.i18n = null;
        const {report} = scanProject(config);
        generate(report, config);
        const files = Object.fromEntries(fs.readdirSync(config.output.generated).map((f) => [f, fs.readFileSync(path.join(config.output.generated!, f), 'utf8')]));
        return {report: serialize(report), files};
    };
    const before = await run('before');
    for (const f of fs.readdirSync(path.join(root, 'ui', 'src'))) {
        const file = path.join(root, 'ui', 'src', f);
        fs.writeFileSync(file, '// a comment\n\n' + fs.readFileSync(file, 'utf8').replace(/\n(export )/g, '\n// another\n$1'));
    }
    const after = await run('after');
    assert.equal(after.report, before.report);
    assert.deepEqual(after.files, before.files);
    assert.doesNotMatch(before.report, /\.tsx?:\d/);
});
