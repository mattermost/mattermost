// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import path from 'node:path';
import {test} from 'node:test';

import {element, exact, FIXTURES, scanFixture} from './helpers.ts';

import {runChecks} from '../src/checks.ts';
import {scanProject} from '../src/cli.ts';
import {loadConfig} from '../src/config.ts';
import type {Diagnostic} from '../src/manifest_types.ts';

const out = () => scanFixture('values');

test('values: the fixture yields exactly these elements', () => {
    assert.deepEqual(out().manifest.elements.map((e) => e.template).sort(), [
        'values.builder.a--text',
        'values.builder.b--text',
        'values.chain.a.b.c.d.e.leaf--text',
        'values.channel.{key}',
        'values.channels.channel.draft--text',
        'values.channels.channel.unread_count--text',
        'values.channels.channel:{key}--link',
        'values.choices.choice:{key}--radio',
        'values.clear.option:{key}--button',
        'values.colliding.save--button',
        'values.colliding.save_button.hint--text',
        'values.connected_a.plain',
        'values.connected_b.with_extra',
        'values.deep.main--text',
        'values.defaults.mute--checkbox',
        'values.defined.panel:{key}--text',
        'values.dynamic.created--text',
        'values.dynamic.editor.plain--textbox',
        'values.dynamic.editor.rich--textbox',
        'values.dynamic.slot--text',
        'values.fallback.from_id--text',
        'values.fallback.given--text',
        'values.fixed_grid.row:{key}',
        'values.found.channel:{key}--link',
        'values.helper.go--button',
        'values.key_fields.label:{key}--text',
        'values.keyed.item:{key}',
        'values.keyed.plain',
        'values.leaf.default--button',
        'values.leaf.given--button',
        'values.let.first--text',
        'values.let.second--text',
        'values.memo.item--text',
        'values.message.quote.post.text--text',
        'values.message.text--text',
        'values.mixed.channel:{key}--link',
        'values.narrow.plugin:{key}--button',
        'values.narrow.section:{key}',
        'values.overloaded.message--text',
        'values.paired.a_y--text',
        'values.paired.b_x--text',
        'values.paired.draft:{key}--link',
        'values.paired.scheduled:{key}--link',
        'values.panel.close--button',
        'values.panel.save--button',
        'values.picker.option:{key}',
        'values.picker.selected',
        'values.previews.file:{key}',
        'values.pushed_grid.row:{key}',
        'values.rows.row:{key}--text',
        'values.sections.option:{key}--radio',
        'values.setting.value--textbox',
        'values.setting:{key}--region',
        'values.spread.local--button',
        'values.spread_after.area:{key}',
        'values.tabs.tab:{key}--link',
        'values.tree.action:{key}--button',
        'values.wrapper.inner--button',
    ]);
});

test('values: props path with destructuring default, at each usage', () => {
    assert.deepEqual(exact(out(), 'values.leaf.given--button').instances.map((i) => i.via), [['src/app.tsx:21:13']]);
    assert.deepEqual(element(out(), 'values.leaf.given--button').instances.map((i) => i.via), [['src/app.tsx:21:13']]);
    element(out(), 'values.leaf.default--button');
});

test('values: spreads of local objects and rest props', () => {
    assert.deepEqual(exact(out(), 'values.spread.local--button').instances[0].via, ['src/app.tsx:23:13']);
    assert.deepEqual(exact(out(), 'values.wrapper.inner--button').instances[0].via, ['src/leaf.tsx:15:12', 'src/app.tsx:24:13']);
    assert.deepEqual(element(out(), 'values.wrapper.inner--button').instances[0].via, ['src/leaf.tsx:15:12', 'src/app.tsx:24:13']);
});

test('values: props.a.b through an object literal, this.props in an arrow class property', () => {
    element(out(), 'values.deep.main--text');
    element(out(), 'values.panel.close--button');
});

test('values: useMemo, let reassignment, namespace constants, helper returns, method params', () => {
    for (const t of ['values.memo.item--text', 'values.let.first--text', 'values.let.second--text', 'values.panel.save--button', 'values.helper.go--button', 'values.builder.a--text', 'values.builder.b--text']) {
        element(out(), t);
    }
});

test('values: keys from a fixed list, an entity field and a number', () => {
    const tab = element(out(), 'values.tabs.tab:{key}--link');
    assert.equal(tab.key?.kind, 'set');
    assert.deepEqual(tab.key?.values, ['info', 'members']);
    assert.equal(tab.key?.set, 'Tabs');
    const ch = element(out(), 'values.channels.channel:{key}--link');
    assert.deepEqual({kind: ch.key?.kind, entity: ch.key?.entity, field: ch.key?.field, type: ch.key?.type}, {kind: 'entity', entity: 'Channel', field: 'name', type: "Pick<Channel, 'name'>"});
    assert.equal(element(out(), 'values.rows.row:{key}--text').key?.kind, 'number');
    const file = element(out(), 'values.previews.file:{key}');
    assert.deepEqual({kind: file.key?.kind, entity: file.key?.entity, module: file.key?.module, type: file.key?.type}, {kind: 'entity', entity: 'FileInfo', module: '@mattermost/types/files', type: "Pick<FileInfo, 'id'>"});
    const mixed = element(out(), 'values.mixed.channel:{key}--link');
    assert.deepEqual({kind: mixed.key?.kind, entity: mixed.key?.entity}, {kind: 'entity', entity: 'Channel'});
    assert.ok(mixed.instances.every((i) => i.via.length), 'keeps the usage chain');
});

test('values: runtime data outside the key is a grammar diagnostic', () => {
    const d = out().diagnostics.find((x) => x.message.includes('values.channel.{key}'));
    assert.equal(d?.rule, 'grammar');
});

test('values: `a ?? b` takes the fallback only for instances where `a` is missing', () => {
    element(out(), 'values.fallback.given--text');
    element(out(), 'values.fallback.from_id--text');
    assert.ok(!out().manifest.elements.some((e) => e.template === 'legacy_id'));
});

test('values: React.createElement, tags held in variables, and components passed as props', () => {
    const t = out().manifest.elements.map((e) => e.template);
    assert.ok(t.includes('values.dynamic.created--text'), t.join('\n'));
    assert.ok(t.includes('values.dynamic.editor.plain--textbox'), t.join('\n'));
    assert.ok(t.includes('values.dynamic.editor.rich--textbox'), t.join('\n'));
    assert.ok(t.includes('values.dynamic.slot--text'), t.join('\n'));
});

test('values: a component set on a typed definition and rendered through a lookup table gets its prop defaults', () => {
    const panel = element(out(), 'values.defined.panel:{key}--text');
    assert.deepEqual(exact(out(), 'values.defined.panel:{key}--text').instances.map((i) => i.via), [['src/dynamic.tsx:241:16']]);
    assert.deepEqual(panel.instances.map((i) => i.via), [['src/dynamic.tsx:241:16']]);
    assert.deepEqual(panel.key?.values, ['only']);
});

test('values: a prop connect() visibly does not supply is missing where the usage omits it', () => {
    const t = out().manifest.elements.map((e) => e.template);
    assert.ok(t.includes('values.connected_a.plain'), t.join('\n'));
    assert.ok(!t.includes('values.connected_a.with_extra'), t.join('\n'));
    assert.ok(t.includes('values.connected_b.with_extra'), t.join('\n'));
});

test('values: a key read from an entity found in a list keeps the entity type', () => {
    assert.equal(element(out(), 'values.found.channel:{key}--link').key?.type, "Pick<Channel, 'name'>");
});

test('values: a condition narrows its reference in the branch it guards (no "undefined" testid)', () => {
    const t = out().manifest.elements.map((e) => e.template);
    assert.ok(t.includes('values.narrow.plugin:{key}--button'), t.join('\n'));
    assert.ok(!t.some((x) => x.startsWith('undefined')), t.filter((x) => x.startsWith('undefined')).join('\n'));
    assert.ok(t.includes('values.narrow.section:{key}'), t.join('\n'));
    assert.ok(!t.some((x) => x.startsWith('values.narrow.section:undefined')), t.join('\n'));
});

test('values: ternaries on one condition combine arm by arm (`!c` is the other arm)', () => {
    const t = out().manifest.elements.map((e) => e.template).filter((x) => x.startsWith('values.paired.'));
    assert.deepEqual(t.sort(), ['values.paired.a_y--text', 'values.paired.b_x--text', 'values.paired.draft:{key}--link', 'values.paired.scheduled:{key}--link']);
    assert.deepEqual(element(out(), 'values.paired.scheduled:{key}--link').key?.values, ['sched']);
    assert.deepEqual(element(out(), 'values.paired.draft:{key}--link').key?.values, ['drft']);
});

test('values: a scope threaded through six components resolves (no depth cut-off gap)', () => {
    element(out(), 'values.chain.a.b.c.d.e.leaf--text');
    assert.ok(!out().manifest.elements.some((e) => e.template.endsWith('.leaf--text') && e.template.startsWith('{key}')));
});

test('values: a path into a helper\'s parameter reads each call\'s argument', () => {
    const e = element(out(), 'values.sections.option:{key}--radio');
    assert.deepEqual({kind: e.key?.kind, values: e.key?.values}, {kind: 'set', values: ['auto', 'compact', 'full', 'off', 'on']});
});

test('values: a field destructured from a fixed list\'s items in map() is that set', () => {
    const e = element(out(), 'values.choices.choice:{key}--radio');
    assert.deepEqual({kind: e.key?.kind, values: e.key?.values}, {kind: 'set', values: ['no', 'yes']});
});

test('values: `a && b ? t : f` takes t only where both sides can hold', () => {
    const t = out().manifest.elements.map((e) => e.template).filter((x) => x.startsWith('values.keyed.'));
    assert.deepEqual(t.sort(), ['values.keyed.item:{key}', 'values.keyed.plain']);
});

test('values: a constant reached through a default-exported object of constants', () => {
    element(out(), 'values.defaults.mute--checkbox');
});

test('values: a flag spread through from a component with no static usage can be off (a gap is not truthy)', () => {
    // `<OptionView {...data}/>` in a react-select Option: isSingleValue is unknown there, so both arms render
    assert.deepEqual(exact(out(), 'values.picker.option:{key}').instances.map((i) => i.via), [['src/option_view.tsx:20:9']]);
    assert.deepEqual(exact(out(), 'values.picker.selected').instances.map((i) => i.via), [['src/option_view.tsx:20:9'], ['src/option_view.tsx:30:9']]);

    // scan provenance retains the exact usage locations; the committed report omits them
    assert.deepEqual(element(out(), 'values.picker.selected').instances.map((i) => i.via), [['src/option_view.tsx:20:9'], ['src/option_view.tsx:30:9']]);
});

test('values: `a || fallback` keys: the empty member of a set takes the fallback', () => {
    const e = element(out(), 'values.clear.option:{key}--button');
    assert.deepEqual({kind: e.key?.kind, values: e.key?.values}, {kind: 'set', values: ['day', 'hour', 'none']});
});

test('values: settings preserve their raw config path keys through a shared row', () => {
    assert.deepEqual(element(out(), 'values.setting:{key}--region').key?.values, ['GitLabSettings.Url', 'LdapSettings.TestConnection', 'ServiceSettings.SiteURL', 'bannerEnabled', 'openidType']);
});

test('values: rows pushed into an empty list are rows too, when another usage passes a literal list', () => {
    assert.ok(out().manifest.elements.some((e) => e.template === 'values.pushed_grid.row:{key}'));
    assert.ok(out().manifest.elements.some((e) => e.template === 'values.fixed_grid.row:{key}'));
});

test('values: a recursive component handing its own scope back to itself adds no unscoped template', () => {
    element(out(), 'values.tree.action:{key}--button');
    assert.deepEqual(out().manifest.elements.map((e) => e.template).filter((t) => t.startsWith('{key}')), []);
});

test('values: a component that renders itself through another one unrolls once to the concrete inner scope', () => {
    element(out(), 'values.message.text--text');
    element(out(), 'values.message.quote.post.text--text');
});

test('values: a rest spread after an attribute overrides it only when its type can carry the prop', () => {
    const e = element(out(), 'values.spread_after.area:{key}');
    assert.deepEqual({kind: e.key?.kind, values: e.key?.values}, {kind: 'string', values: undefined});
});

test('values: only id-like entity fields key a testid without an exception; an allowed one passes, a stale exception is reported', () => {
    const keyOrigin = (ds: Diagnostic[]) => ds.filter((d) => d.rule === 'key-origin' && d.template === 'values.key_fields.label:{key}--text').map((d) => d.message);
    assert.deepEqual(keyOrigin(out().diagnostics), ['key of "values.key_fields.label:{key}--text" is Channel.display_name (c.display_name), which isn\'t an id-like field: it may not tell items apart, or may change with the language.']);
    const config = loadConfig(path.join(FIXTURES, 'values', 'test-surface.config.json'));
    const allow = [{entity: 'Channel', field: 'display_name', reason: 'allowed'}, {entity: 'Team', field: 'display_name', reason: 'gone'}];
    const ds = runChecks(out().result, {...config.checks, keyFields: {...config.checks.keyFields, allow}, configAt: 'test-surface.config.json'});
    assert.deepEqual(keyOrigin(ds), []);
    assert.deepEqual(ds.filter((d) => d.rule === 'allow').map((d) => d.message), ['checks.keyFields.allow entry for Team.display_name no longer matches any key.']);
});

test('values: an overloaded helper is read through the declaration that has a body', () => {
    element(out(), 'values.overloaded.message--text');
    assert.ok(!out().diagnostics.some((d) => d.at.startsWith('src/overload.tsx') && d.rule === 'unresolved'));
});

test('entity key imports use the configured public module for their entity directory', () => {
    const config = loadConfig(path.join(FIXTURES, 'values/test-surface.config.json'));
    config.entityTypeModules = {[config.entityTypeDirs[0]]: '@acme/entities'};
    const {manifest} = scanProject(config);
    const keys = manifest.elements.flatMap((element) => (element.key?.kind === 'entity' ? [element.key] : []));
    assert.ok(keys.length > 0);
    assert.ok(keys.every((key) => key.module?.startsWith('@acme/entities/')));
});
