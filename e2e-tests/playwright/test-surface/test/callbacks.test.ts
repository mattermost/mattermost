// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import {test} from 'node:test';

import {scanFixture} from './helpers.ts';

const out = () => scanFixture('callbacks');
const templates = () => out().manifest.elements.map((e) => e.template);

test('callbacks: a render function passed to map by name takes its parameter from the list', () => {
    for (const t of ['callbacks.fixed:{key}--button', 'callbacks.computed:{key}--button']) {
        assert.ok(templates().includes(t), `${t} in\\n${templates().join('\\n')}`);
    }
    assert.deepEqual(out().diagnostics.filter((d) => d.rule === 'unresolved'), []);
});
