// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach, beforeEach, describe, test} from 'node:test';
import {fileURLToPath} from 'node:url';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fill_empty_descriptions.mjs');
const json = (body) => JSON.stringify(body, null, 2) + '\n';

describe('fill_empty_descriptions.mjs', () => {
    let root;
    const webapp = () => path.join(root, 'webapp/channels/src/i18n/en.json');
    const server = () => path.join(root, 'server/i18n/en.json');
    const fillWith = (body) => {
        fs.mkdirSync(path.join(root, 'run'), {recursive: true});
        fs.writeFileSync(path.join(root, 'run/descriptions.json'), JSON.stringify(body));
        return spawnSync(process.execPath, [script, 'run'], {cwd: root, encoding: 'utf8'});
    };

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'fill-descriptions-'));
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

    test('refuses anything but filling an empty description, and then writes nothing', () => {
        const before = [fs.readFileSync(webapp(), 'utf8'), fs.readFileSync(server(), 'utf8')];
        const r = fillWith({
            webapp: {'app.plain': 'Button that closes the dialog', 'app.title': 'Other', 'app.none': 'x'},
            server: {'api.error': 'Something failed', 'api.retry': 'Try again later'},
            other: {},
        });
        assert.equal(r.status, 1);
        for (const expected of [
            /webapp:app\.title: already described/,
            /webapp:app\.none: not in/,
            /server:api\.error: already described/,
            /server:api\.retry: restates the English/,
            /unknown top-level field "other"/,
        ]) {
            assert.match(r.stderr, expected);
        }
        assert.deepEqual([fs.readFileSync(webapp(), 'utf8'), fs.readFileSync(server(), 'utf8')], before);
    });

    test('fills an empty description in place', () => {
        const before = fs.readFileSync(webapp(), 'utf8');
        const r = fillWith({
            webapp: {'app.plain': 'Button that closes the dialog'},
            server: {'api.retry': 'Error shown when the server is too busy to take the request'},
        });
        assert.equal(r.status, 0, r.stderr);
        const after = fs.readFileSync(webapp(), 'utf8');
        assert.equal(JSON.parse(after)['app.plain'].description, 'Button that closes the dialog');
        assert.deepEqual(Object.keys(JSON.parse(after)), Object.keys(JSON.parse(before)));
        assert.equal(after.split('\n').length, before.split('\n').length);
        assert.equal(JSON.parse(fs.readFileSync(server(), 'utf8'))[1].description, 'Error shown when the server is too busy to take the request');
    });
});
