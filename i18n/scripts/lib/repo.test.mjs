// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {after, before, describe, test} from 'node:test';

import {commitTree} from './repo.mjs';

describe('commitTree', () => {
    let root;
    let rev;
    const git = (...args) => execFileSync('git', args, {cwd: root, encoding: 'utf8'}).trim();

    before(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-repo-'));
        git('init', '-q');
        fs.mkdirSync(path.join(root, 'i18n'));
        fs.writeFileSync(path.join(root, 'i18n/baseline.json'), '{}\n');
        fs.writeFileSync(path.join(root, 'i18n/lost.json'), '{"lost": true}\n');
        git('add', '-A');
        git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '-m', 'A');
        rev = git('rev-parse', 'HEAD');

        // A blob the clone cannot read, as a partial clone has when fetching it
        // fails.
        const blob = git('rev-parse', `${rev}:i18n/lost.json`);
        fs.rmSync(path.join(root, '.git/objects', blob.slice(0, 2), blob.slice(2)));
    });
    after(() => fs.rmSync(root, {recursive: true, force: true}));

    test('reads a file, and gives null for a path the commit does not have', () => {
        const tree = commitTree(root, rev);
        assert.equal(tree.read('i18n/baseline.json'), '{}\n');
        assert.equal(tree.read('i18n/missing.json'), null);
        assert.deepEqual(tree.list('i18n'), ['baseline.json', 'lost.json']);
        assert.deepEqual(tree.list('nowhere'), []);
    });

    test('throws, rather than call a file missing, when git cannot read it', () => {
        assert.throws(() => commitTree(root, rev).read('i18n/lost.json'), /git show .*lost\.json failed/);
    });
});
