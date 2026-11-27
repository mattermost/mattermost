// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {describe, test} from 'node:test';

import {cut, readSlices, writeSlices} from './slices.mjs';

// Items of one size each, so a budget is a number of items.
const item = {kind: 'new', english: 'x'};
const size = 'admin.logs.a'.length + JSON.stringify(item).length;
const keys = (slices) => slices.map((s) => Object.entries(s).flatMap(([surface, items]) => Object.keys(items).map((k) => `${surface}:${k}`)));
const of = (...names) => Object.fromEntries(names.map((k) => [k, item]));

describe('cut', () => {
    test('a worklist within the budget is one slice', () => {
        const slices = cut({webapp: of('admin.logs.a', 'admin.logs.b'), server: of('api.post.a')});
        assert.deepEqual(keys(slices), [['webapp:admin.logs.a', 'webapp:admin.logs.b', 'server:api.post.a']]);
    });

    test('a feature is never split between slices while it fits in one', () => {
        // Three items to a slice: admin.logs (2) and admin.user (2) cannot
        // share one, so admin.user starts the next rather than being split.
        const slices = cut({webapp: of('admin.logs.a', 'admin.logs.b', 'admin.user.a', 'admin.user.b', 'admin.user.c')}, size * 3);
        assert.deepEqual(keys(slices), [
            ['webapp:admin.logs.a', 'webapp:admin.logs.b'],
            ['webapp:admin.user.a', 'webapp:admin.user.b', 'webapp:admin.user.c'],
        ]);
    });

    test('a feature too big for one slice is split, and shares a slice with no other', () => {
        const slices = cut({webapp: of('admin.ai.a', 'admin.logs.a', 'admin.logs.b', 'admin.logs.c', 'admin.logs.d', 'admin.zz.a')}, size * 3);
        assert.deepEqual(keys(slices), [
            ['webapp:admin.ai.a'],
            ['webapp:admin.logs.a', 'webapp:admin.logs.b', 'webapp:admin.logs.c'],
            ['webapp:admin.logs.d'],
            ['webapp:admin.zz.a'],
        ]);
    });

    test('a feature whose keys are apart is still one feature', () => {
        const slices = cut({webapp: of('admin.logs.a', 'admin.user.a', 'admin.user.b', 'admin.logs.b')}, size * 2);
        assert.deepEqual(keys(slices), [['webapp:admin.logs.a', 'webapp:admin.logs.b'], ['webapp:admin.user.a', 'webapp:admin.user.b']]);
    });

    test('the same prefix on two surfaces is two features', () => {
        const slices = cut({webapp: of('app.post.a', 'app.post.b'), server: of('app.post.a', 'app.post.b')}, size * 3);
        assert.deepEqual(keys(slices), [['webapp:app.post.a', 'webapp:app.post.b'], ['server:app.post.a', 'server:app.post.b']]);
    });
});

describe('writeSlices and readSlices', () => {
    test('write complete worklists naming their answer files, and read back what they hold', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-slices-'));
        try {
            fs.writeFileSync(path.join(dir, 'stale.json'), '{}');
            const header = {locale: 'de', base: 'abc', language: {direction: 'ltr'}};
            const items = {webapp: of('admin.logs.a', 'admin.user.a')};
            const n = writeSlices(dir, header, items, (name) => `translations/de/${name}.json`);
            assert.equal(n, 1);
            assert.deepEqual(fs.readdirSync(dir), ['01.json']);
            const slice = JSON.parse(fs.readFileSync(path.join(dir, '01.json'), 'utf8'));
            assert.deepEqual(slice, {...header, slice: '1 of 1', answers: 'translations/de/01.json', ...items});
            assert.deepEqual(readSlices(dir), {header, items: {...items, server: {}}});
            assert.equal(readSlices(path.join(dir, 'none')), null);
        } finally {
            fs.rmSync(dir, {recursive: true, force: true});
        }
    });
});
