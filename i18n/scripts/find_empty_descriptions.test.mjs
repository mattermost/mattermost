// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach, beforeEach, describe, test} from 'node:test';
import {fileURLToPath} from 'node:url';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'find_empty_descriptions.mjs');
const json = (body) => JSON.stringify(body, null, 2) + '\n';

describe('find_empty_descriptions.mjs', () => {
    let root;
    const webapp = () => path.join(root, 'webapp/channels/src/i18n/en.json');
    const server = () => path.join(root, 'server/i18n/en.json');
    const find = () => spawnSync(process.execPath, [script, 'run'], {cwd: root, encoding: 'utf8'});
    const found = () => JSON.parse(fs.readFileSync(path.join(root, 'run/undescribed.json'), 'utf8'));

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'find-descriptions-'));
        fs.mkdirSync(path.dirname(webapp()), {recursive: true});
        fs.mkdirSync(path.dirname(server()), {recursive: true});
        fs.writeFileSync(webapp(), json({
            'app.plain': {defaultMessage: 'OK', description: ''},
            'app.title': {defaultMessage: 'Channel settings', description: 'Title of the channel settings modal'},
        }));
        fs.writeFileSync(server(), json([
            {id: 'api.error', translation: 'Something failed', description: 'Generic error'},
            {id: 'api.retry', translation: 'Try again later', description: ''},
        ]));
    });
    afterEach(() => fs.rmSync(root, {recursive: true, force: true}));

    test('lists every key with no description, and an empty list when there is none', () => {
        fs.mkdirSync(path.join(root, 'run'));
        fs.writeFileSync(path.join(root, 'run/descriptions.json'), '{"webapp": {"app.gone": "From an earlier run"}}');
        const r = find();
        assert.equal(fs.existsSync(path.join(root, 'run/descriptions.json')), false);
        assert.equal(r.status, 0, r.stderr);
        assert.deepEqual(found(), {
            webapp: {'app.plain': {english: 'OK'}},
            server: {'api.retry': {english: 'Try again later'}},
        });

        fs.writeFileSync(webapp(), json({'app.plain': {defaultMessage: 'OK', description: 'Button that closes the dialog'}}));
        fs.writeFileSync(server(), json([{id: 'api.retry', translation: 'Try again later', description: 'Error shown when the server is busy'}]));
        assert.equal(find().status, 0);
        assert.deepEqual(found(), {webapp: {}, server: {}});
    });

    test('suggests the description of a key with the same English that en.json dropped since the baseline', () => {
        const git = (...args) => execFileSync('git', args, {cwd: root, encoding: 'utf8'}).trim();
        git('init', '-q');
        fs.writeFileSync(webapp(), json({
            'app.old': {defaultMessage: 'Remove member', description: 'Button that removes a member from the channel'},
            'app.title': {defaultMessage: 'Channel settings', description: 'Title of the channel settings modal'},
        }));
        git('add', '-A');
        git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '-m', 'A');
        const A = git('rev-parse', 'HEAD');
        fs.mkdirSync(path.join(root, 'i18n'));
        fs.writeFileSync(path.join(root, 'i18n/baseline.json'), json({webapp: {de: A}, server: {de: A}}));
        fs.writeFileSync(webapp(), json({
            'app.remove_member': {defaultMessage: 'Remove member', description: ''},
            'app.title': {defaultMessage: 'Channel settings', description: 'Title of the channel settings modal'},
        }));

        const r = find();
        assert.equal(r.status, 0, r.stderr);
        assert.deepEqual(found().webapp, {
            'app.remove_member': {english: 'Remove member', suggested: {description: 'Button that removes a member from the channel', from: 'app.old'}},
        });
    });
});
