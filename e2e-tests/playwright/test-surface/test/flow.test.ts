// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import path from 'node:path';
import {test} from 'node:test';

import {FIXTURES, scanFixture} from './helpers.ts';

import {scanProject} from '../src/cli.ts';
import {loadConfig} from '../src/config.ts';

test('rendering: a skeleton early return excludes controls when its condition is true', () => {
    const out = scanFixture('flow');
    assert.ok(!out.report.scopes.availability);
    assert.ok(!out.result.emissions.some((emission) => emission.template === 'availability.save--button'));
});

test('rendering: helper invocation guards make its rendered parts conditional', () => {
    const report = scanFixture('flow').report;
    const family = report.families[report.scopes.helper_availability.family];
    assert.equal(family.parts?.label.conditional, true);
});

test('rendering: a condition in the testid expression makes its part conditional', () => {
    const report = scanFixture('flow').report;
    const family = report.families[report.scopes.testid_availability.family];
    assert.equal(family.parts?.label.conditional, true);
});

test('families: shared declarations retain absent parts and child-family differences split their parents', () => {
    const report = scanFixture('flow').report;
    assert.equal(report.scopes.family_one.family, 'Family');
    assert.equal(report.scopes.family_two.family, 'Family');
    assert.equal(report.scopes.family_two.bind?.extra, false);
    assert.equal(report.scopes['shell_one.footer'].family, 'FooterA');
    assert.equal(report.scopes['shell_two.footer'].family, 'FooterB');
    assert.equal(report.scopes.shell_one.family, 'ShellOne');
    assert.equal(report.scopes.shell_two.family, 'ShellTwo');
});

test('families: components without members become parts with mount-specific roles', () => {
    const report = scanFixture('flow').report;
    const family = report.families[report.scopes.leaf.family];
    assert.equal(report.scopes['leaf.bold'], undefined);
    assert.equal(report.scopes['leaf.italic'], undefined);
    assert.equal(report.families.LeafButton, undefined);
    assert.equal(family.parts?.bold.role, 'button');
    assert.equal(family.parts?.italic.role, 'togglebutton');
    assert.equal(family.parts?.bold.source ?? family.source, 'LeafButton');
    assert.equal(report.scopes.leaf.bind, undefined, 'callbacks contribute no behavior bindings');
});

test('families: differing roles of a member split the parent mounts', () => {
    const report = scanFixture('flow').report;
    assert.equal(report.scopes.parent_one.family, 'ParentOne');
    assert.equal(report.scopes.parent_two.family, 'ParentTwo');
    assert.equal(report.families.ParentOne.parts?.action.role, 'button');
    assert.equal(report.families.ParentTwo.parts?.action.role, 'togglebutton');
});

test('values: guarded assignments omit scoped ids at mounts without a scope', () => {
    const out = scanFixture('flow');
    assert.ok(!out.result.emissions.some((emission) => emission.template.startsWith('undefined.')));
    assert.ok(out.report.scopes['sidebar.tabs']);
    assert.ok(!out.report.scopes.undefined);
});

test('sets: named sources keep their name and path-derived names always end in Key', () => {
    const report = scanFixture('flow').report;
    assert.deepEqual(report.sets.SettingsTab, ['advanced', 'general']);
    assert.deepEqual(report.sets.SetPathsOptionKey, ['one']);
    assert.ok(report.families.SetPathsOption);
});

test('collisions: reserved roleless, keyed and child names fail during scanning', () => {
    const errors = scanFixture('flow').diagnostics.filter((diagnostic) => diagnostic.rule === 'collisions');
    for (const word of ['page', 'item', 'scope']) {
        assert.ok(errors.some((error) => error.template === `reserved.${word}` && error.message.includes('reserves')), word);
    }
});

test('sets: conflicting exported names require a setNames override', () => {
    const config = loadConfig(path.join(FIXTURES, 'flow/test-surface.config.json'));
    config.setNames.SetPathsOptionKey = 'SetPathsOption';
    const invalid = scanProject(config);
    assert.ok(invalid.diagnostics.some((diagnostic) => diagnostic.rule === 'collisions' && diagnostic.message.includes('SetPathsOption') && diagnostic.fix?.includes('setNames')));
    config.setNames.SetPathsOptionKey = 'OptionChoiceKey';
    assert.deepEqual(scanProject(config).report.sets.OptionChoiceKey, ['one']);
});

test('families: unchanged scope forwarding shares one family with absent parts and merged conditions', () => {
    const report = scanFixture('flow').report;
    for (const scope of ['wrapped.first', 'wrapped.second', 'wrapped.third']) {
        assert.equal(report.scopes[scope].family, 'WrappedDialog');
    }
    assert.equal(report.scopes['wrapped.second'].bind?.extra, false);
    assert.equal(report.families.WrappedDialog.container?.conditional, true);
    assert.equal(report.families.WrappedDialog.parts?.confirm.conditional, true);
});

test('families: a fixed entity-keyed child retains its entity argument', () => {
    const report = scanFixture('flow').report;
    const family = report.families[report.scopes.recaps.family];
    assert.deepEqual(family.children?.recap.key, {kind: 'id', entity: 'Channel', field: 'id', from: '@mattermost/types/channels'});
    assert.equal(report.scopes.recaps.bind?.recap, undefined);
});

test('keys: mounted collection types, optional index props and finite template types retain their kinds', () => {
    const report = scanFixture('flow').report;
    const sidebar = report.families[report.scopes.typed_sidebar.family].parts?.tab.key;
    assert.ok(sidebar?.kind === 'set');
    assert.deepEqual(report.sets[sidebar.set], ['first', 'second']);
    assert.deepEqual(report.families[report.scopes.indexed_row.family].parts?.node.key, {kind: 'index'});
    const template = report.families[report.scopes.template_key.family].parts?.node.key;
    assert.ok(template?.kind === 'set');
    assert.deepEqual(report.sets[template.set], ['allow_fail', 'allow_pass', 'deny_fail', 'deny_pass']);
});

test('keys: strict mode rejects all remaining string keys without needing strictPaths', () => {
    const config = loadConfig(path.join(FIXTURES, 'flow/test-surface.config.json'));
    const out = scanProject(config);
    for (const element of out.manifest.elements.filter((element) => element.key?.kind === 'string')) {
        assert.ok(out.diagnostics.some((diagnostic) => diagnostic.rule === 'key-origin' && diagnostic.severity === 'error' && diagnostic.template === element.template), element.template);
    }
});

test('keys: collection fallbacks preserve the static entity field origin', () => {
    const out = scanFixture('flow');
    const parts = out.report.families[out.report.scopes.fallback.family].parts;
    for (const name of ['conditional', 'or', 'memo']) {
        assert.deepEqual(parts?.[name].key, {kind: 'id', entity: 'Channel', field: 'id', from: '@mattermost/types/channels'}, name);
    }
    assert.ok(!parts?.empty?.key || parts.empty.key.kind === 'id');
    assert.ok(!out.diagnostics.some((diagnostic) => diagnostic.rule === 'key-origin' && diagnostic.template?.startsWith('fallback.')));
});
