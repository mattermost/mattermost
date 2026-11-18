// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';

test('scan and check fail on a stale lookup under the configured roots, and scan still writes the report', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reference-check-'));
    try {
        const fixture = fileURLToPath(new URL('fixtures/reach/', import.meta.url));
        const config = path.join(dir, 'config.json');
        const report = path.join(dir, 'report.json');
        fs.mkdirSync(path.join(dir, 'tests'));
        const spec = path.join(dir, 'tests', 'sample.spec.tsx');
        fs.writeFileSync(spec, 'page.getByTestId("live.row");\n');
        fs.writeFileSync(config, JSON.stringify({
            root: fixture,
            tsconfig: path.join(fixture, 'tsconfig.json'),
            include: [path.join(fixture, 'src')],
            output: {report},
            entries: [path.join(fixture, 'src/main.tsx')],
            staleReferences: {roots: ['tests']},
        }));
        const run = (cmd: string) => spawnSync(process.execPath, [fileURLToPath(new URL('../bin/test-surface.mjs', import.meta.url)), cmd, '--config', config], {encoding: 'utf8'});
        assert.equal(run('scan').status, 0);
        const written = fs.readFileSync(report, 'utf8');
        assert.equal(run('check').status, 0, 'an up-to-date report and no stale lookup');

        fs.appendFileSync(spec, 'page.getByTestId("live.renamed_row");\n');
        const checked = run('check');
        assert.equal(checked.status, 1);
        assert.match(checked.stdout, /stale-reference.*live\.renamed_row|live\.renamed_row.*matches no testid/);
        fs.rmSync(report);
        assert.equal(run('scan').status, 1);
        assert.equal(fs.readFileSync(report, 'utf8'), written, 'the report depends on the app only, so scan still writes it');
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});
