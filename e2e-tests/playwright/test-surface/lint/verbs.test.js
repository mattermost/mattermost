// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import {test} from 'node:test';

import * as verbs from './verbs.js';

const declared = fs.readFileSync(new URL('./verbs.d.ts', import.meta.url), 'utf8');

/** The literal tuple `verbs.d.ts` declares for a name. */
function tuple(name) {
    const match = new RegExp(`export declare const ${name}: readonly \\[([^\\]]*)\\];`).exec(declared);
    assert.ok(match, `${name} is declared`);
    return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

test('the declarations name exactly the values, in order', () => {
    for (const name of ['VERBS', 'PREPARING_VERBS', 'OBSERVING_VERBS', 'RETRYING_MATCHERS']) {
        assert.deepEqual(tuple(name), [...verbs[name]], name);
    }
});

test('the preparing and observing verbs are verbs, and no verb is both', () => {
    for (const verb of [...verbs.PREPARING_VERBS, ...verbs.OBSERVING_VERBS]) {
        assert.ok(verbs.VERBS.includes(verb), verb);
    }
    assert.deepEqual(verbs.PREPARING_VERBS.filter((verb) => verbs.OBSERVING_VERBS.includes(verb)), []);
    assert.equal(new Set(verbs.VERBS).size, verbs.VERBS.length);
});
