// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import path from 'node:path';
import {test} from 'node:test';

import {FIXTURES} from './helpers.ts';

import {loadConfig} from '../src/config.ts';
import {FamilyParts, packageOf} from '../src/parts.ts';
import {loadProgram} from '../src/program.ts';
import {ProgramIndex} from '../src/program_index.ts';
import {Roles} from '../src/roles.ts';
import {Resolver} from '../src/values.ts';

function build() {
    const config = loadConfig(path.join(FIXTURES, 'parts_lib', 'test-surface.config.json'));
    const ix = new ProgramIndex(loadProgram(config), config);
    const R = new Resolver(ix);
    const lib = new FamilyParts(ix, R, new Roles(ix, R), config.library!);
    return {parts: lib.build(config.library!.entry, packageOf(config)), diagnostics: lib.diagnostics};
}

const summary = (c: {parts: Array<{suffix: string; role: string | null; when?: {prop: string; set: boolean}; key?: string}>}) =>
    c.parts.map((p) => [p.suffix, p.role, p.when ? `${p.when.set ? '' : '!'}${p.when.prop}` : '', p.key ?? ''].filter(Boolean).join(' '));

test('parts: package identity and only components are published', () => {
    const {parts} = build();
    assert.equal(parts.package, 'fixture-lib');
    assert.equal(parts.packageVersion, '1.2.3');
    assert.deepEqual(Object.keys(parts.components).sort(), ['IconButton', 'Modal', 'Plain', 'Tabs', 'Wrapper']);
});

test('parts: a conditional between part calls is gated on the prop it tests', () => {
    assert.deepEqual(summary(build().parts.components.IconButton), ['--button button !toggled', '--togglebutton togglebutton toggled']);
});

test('parts: testId forwarded to an internal child adds its structural parts', () => {
    assert.deepEqual(summary(build().parts.components.Modal), ['--dialog dialog', '.close--button button']);
});

test('parts: a whole-props spread forwards testId too', () => {
    assert.deepEqual(summary(build().parts.components.Wrapper), summary(build().parts.components.Modal));
});

test('parts: keyed parts carry the key type without callback data', () => {
    assert.deepEqual(summary(build().parts.components.Tabs), ['', '.tab:{key}--tab tab string']);
});

test('parts: the role data-testid lands on when passed through', () => {
    const {components} = build().parts;
    assert.equal(components.Plain.role, 'link');
    assert.deepEqual(components.Plain.parts, []);
    assert.equal(components.IconButton.role, 'button');
    assert.equal(components.Modal.role, 'dialog');
});

test('parts: no diagnostics', () => {
    assert.deepEqual(build().diagnostics, []);
});
