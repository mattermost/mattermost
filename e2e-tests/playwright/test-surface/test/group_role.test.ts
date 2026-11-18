// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';

import {LIB, withProject} from './helpers.ts';

import {scanProject} from '../src/cli.ts';
import {loadConfig} from '../src/config.ts';
import {parseTestId} from '../src/grammar.ts';
import {roleRow} from '../src/role_table.ts';

test('group suffix describes a non-interactive named group and rejects a mismatched role', () => {
    const parsed = parseTestId('settings.section--group');
    assert.ok('role' in parsed);
    assert.equal(parsed.role, 'group');
    assert.deepEqual(roleRow('group'), {driver: 'text', word: 'Group'});
    withProject(['source.tsx', LIB], (root) => {
        fs.writeFileSync(path.join(root, 'source.tsx'), 'import React from \'react\'; export function Panel(){return <><div role="group" aria-label="Settings" data-testid="settings.section--group"/><button data-testid="settings.wrong--group"/></>;}');
        const config = path.join(root, 'config.json');
        const out = scanProject(loadConfig(config));
        assert.equal(out.manifest.elements.find((e) => e.template === 'settings.section--group')?.aria.role, 'group');
        const fit = out.diagnostics.filter((d) => d.rule === 'role-fit');
        assert.deepEqual(fit, [], 'group is a text driver on either element');
        assert.equal(out.diagnostics.filter((d) => String(d.rule) === 'aria' && d.message.includes('settings.section')).length, 0);
    });
});
