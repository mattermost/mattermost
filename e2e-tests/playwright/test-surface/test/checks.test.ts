// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import {test} from 'node:test';

import {element, scanFixture} from './helpers.ts';

import {roleSuffixFor, runChecks, slotMatches} from '../src/checks.ts';
import type {AllowEntry} from '../src/config.ts';
import type {Diagnostic} from '../src/manifest_types.ts';
import {formatDiagnostic} from '../src/report.ts';

const out = () => scanFixture('checks');
const diags = (rule: string) => out().diagnostics.filter((d) => d.rule === rule).map((d) => `${d.severity} ${d.at} ${d.message}`);

test('checks: the fixture raises exactly these diagnostics', () => {
    // [rule, severity, where, template]: a new or missing diagnostic must be a decision, not a side effect
    assert.deepEqual(out().diagnostics.map((d) => [d.rule, d.severity, d.at, d.template ?? '']), [
        ['duplicates', 'error', 'src/a.tsx:11:19', 'checks.panel.twice--text'],
        ['duplicates', 'error', 'src/a.tsx:13:19', 'checks.shared.label--text'],
        ['role-fit', 'error', 'src/a.tsx:15:18', 'checks.panel.state--checkbox'],
        ['grammar', 'error', 'src/a.tsx:25:19', 'checks.panel.item_{key}--text'],
        ['undefined', 'error', 'src/a.tsx:25:19', 'checks.panel.item_{key}--text'],
        ['undefined', 'error', 'src/a.tsx:25:19', 'checks.panel.item_{key}--text'],
        ['unscoped', 'error', 'src/a.tsx:26:19', ''],
        ['grammar', 'error', 'src/a.tsx:27:19', 'LegacyName'],
        ['duplicates', 'error', 'src/a.tsx:81:18', 'checks.pair.item--text'],
        ['unscoped', 'warning', 'src/a.tsx:169:17', 'checks_popup'],
        ['unscoped', 'warning', 'src/a.tsx:171:21', 'checks_control'],
        ['key-origin', 'error', 'src/cap.tsx:13:21', 'checks.cap.cell:{key}--text'],
        ['truncated', 'error', 'src/cap.tsx:13:21', 'checks.cap.cell:r01_c01--text'],
        ['key-origin', 'error', 'src/format.ts:13:12', 'checks.markup.mention:{key}--link'],
        ['key-origin', 'error', 'src/format.ts:13:12', 'checks.markup.mention:{key}--link'],
        ['key-origin', 'error', 'src/plugin_slots.tsx:17:29', 'checks.plugins.by_name:{key}--button'],
        ['plugin-slots', 'error', 'src/plugin_slots.tsx:17:29', 'checks.plugins.by_name:{key}--button'],
        ['plugin-slots', 'error', 'src/plugin_slots.tsx:18:29', 'checks.plugins.extra:{key}--button'],
        ['plugin-slots', 'error', 'test-surface.config.json#pluginSlots.gone', 'checks.plugins.removed:{key}--button'],
    ]);
});

test('checks: duplicates compare state/input drivers; concurrent and cross-file are errors', () => {
    const d = diags('duplicates');
    assert.ok(!d.some((x) => x.includes('checks.panel.go--button')), 'the button arm cannot run after the earlier return for mode');
    assert.ok(d.some((x) => x.includes('checks.panel.twice--text') && x.includes('both can render together')), d.join('\n'));
    assert.ok(d.some((x) => x.includes('checks.shared.label--text') && x.includes('src/b.tsx')), d.join('\n'));
    assert.ok(!d.some((x) => x.includes('checks.panel.ok--button')), 'click-only suffixes work on either element');
    assert.ok(d.every((x) => x.startsWith('error')));
    assert.ok(!d.some((x) => x.includes('checks.thumb.icon--text')), 'guards that contradict (`!compact`, `archived && compact`) are exclusive');
    assert.ok(!d.some((x) => x.includes('"checks.intro"')), 'render helpers called from different arms of a return chain are exclusive');
    assert.ok(d.some((x) => x.includes('checks.pair.item--text') && x.includes('both can render together')), 'render helpers that both run are not');
});

test('checks: role fit', () => {
    const d = diags('role-fit');
    assert.ok(!d.some((x) => x.includes('checks.panel.plain')), 'plain containers work on controls too');
    assert.ok(!d.some((x) => x.includes('checks.panel.ok--button')), 'button only supplies click semantics');
    assert.ok(d.some((x) => x.includes('checks.panel.state--checkbox')), 'checkbox needs readable checked state');
    assert.ok(!d.some((x) => x.includes('checks.panel.content')), 'a landmark is a container: no suffix');
    assert.ok(!d.some((x) => x.includes('checks.editor')), 'an editor is a textbox; a contentEditable={false} part of it is not');
});

test('checks: a testid spread in only when its scope is set is not "undefined"', () => {
    assert.ok(!diags('undefined').some((x) => x.includes('guarded')), diags('undefined').join('\n'));
});

test('checks: a testid forwarded to a component the scan can\'t see into is one element, not a duplicate', () => {
    assert.ok(!diags('duplicates').some((x) => x.includes('checks.icon_row.')), diags('duplicates').join('\n'));
});

test('checks: interactive element without a role', () => {
    assert.deepEqual(diags('aria'), []);
    assert.ok(!diags('role-fit').some((x) => x.includes('checks.panel.clickable')));
});

test('checks: undefined, unscoped, grammar', () => {
    assert.ok(diags('undefined').some((x) => x.includes('checks.panel.item_{key}--text') && x.includes('missing interpolation')));
    assert.ok(out().diagnostics.some((diagnostic) => diagnostic.rule === 'undefined' && diagnostic.severity === 'error'));
    assert.ok(diags('unscoped').length >= 1);
    const g = out().diagnostics.find((x) => x.message.includes('LegacyName'));
    assert.equal(g?.rule, 'grammar');
    assert.match(g?.fix ?? '', /legacy_name/);
});

test('checks: a bare word can name a plain container on any element', () => {
    const d = diags('unscoped');
    assert.ok(d.some((x) => x.includes('"checks_popup" has no declared parts')), d.join('\n'));
    assert.ok(d.some((x) => x.includes('"checks_control"')), d.join('\n'));
});

test('checks: a scope with two or more value fields is a form', () => {
    assert.deepEqual(element(out(), 'checks.form.name--textbox').form, {scope: 'checks.form', field: 'name', valueType: 'string'});
    assert.deepEqual(element(out(), 'checks.form.agree--checkbox').form, {scope: 'checks.form', field: 'agree', valueType: 'boolean'});
    assert.deepEqual(element(out(), 'checks.form.notify--switch').form, {scope: 'checks.form', field: 'notify', valueType: 'boolean'});
});

test('checks: the plugin slot contract and the rendered slots agree both ways', () => {
    assert.deepEqual(out().report.pluginSlots, {
        gone: 'checks.plugins.removed:{key}--button',
        header_button: 'checks.plugins.action:{key}--button',
        unkeyed: 'checks.plugins.by_name:{key}--button',
    });
    const d = diags('plugin-slots');
    assert.equal(d.length, 3, d.join('\n'));
    assert.ok(d.some((x) => x.includes('"gone"') && x.includes('no longer renders')), d.join('\n'));
    assert.ok(d.some((x) => x.includes('"unkeyed"') && x.includes('must be keyed by the raw plugin id')), d.join('\n'));
    assert.ok(d.some((x) => x.includes('checks.plugins.extra:{key}--button') && x.includes("isn't in the published plugin slot contract")), d.join('\n'));
    assert.ok(d.every((x) => x.startsWith('error')));
    assert.deepEqual(out().manifest.elements.find((e) => e.template === 'checks.plugins.action:{key}--button')?.key, {kind: 'entity', entity: 'PluginManifest', field: 'id', module: '@mattermost/types/plugins', type: "Pick<PluginManifest, 'id'>"});
});

test('checks: declared plugin slots accept the canonical pluginId origin but not an arbitrary id', () => {
    const original = out().result;
    const slot = original.manifest.elements.find((e) => e.template === 'checks.plugins.action:{key}--button')!;
    const config = {strictScopes: [], strictPaths: [], configAt: 'config.json', pluginSlots: {header: {template: slot.template}}};
    const check = (value: string) => runChecks({...original, manifest: {...original.manifest, elements: [{...slot, key: {kind: 'id', value, type: 'string'}}]}}, config).filter((d) => d.rule === 'plugin-slots');
    assert.deepEqual(check('plugin'), []);
    assert.ok(check('user').some((d) => d.severity === 'error'));
});

test('checks: a allowed allow entry turns that error into a warning with its reason; a stale entry is reported', () => {
    const base = {strictScopes: [], strictPaths: ['src/'], configAt: 'test-surface.config.json'};
    const ds = runChecks(out().result, {...base, allow: [{rule: 'role-fit', template: 'checks.panel.state--checkbox', reason: 'allowed'}, {rule: 'role-fit', template: 'checks.gone', reason: 'old'}]});
    const d = ds.find((x) => x.rule === 'role-fit' && x.template === 'checks.panel.state--checkbox');
    assert.equal(d?.severity, 'warning');
    assert.deepEqual(d?.waived, {by: 'allow', reason: 'allowed'});
    assert.match(formatDiagnostic(d!), /no readable state\/input role\. Allowed: allowed\n/);
    assert.ok(ds.some((x) => x.rule === 'allow' && x.message.includes('"checks.gone"')));
});

test('checks: a strict exception keeps its path at warnings with the reason; an entry with nothing to report is reported', () => {
    const base = {strictScopes: [], strictPaths: ['src/'], configAt: 'test-surface.config.json'};
    const strict = runChecks(out().result, base).filter((d) => d.severity === 'error' && d.at.startsWith('src/'));
    assert.ok(strict.length, 'the fixture has strict errors');
    const file = strict[0].at.replace(/(:\d+)+$/, '');
    const ds = runChecks(out().result, {...base, strictExceptions: [{path: file, reason: 'allowed'}, {path: 'src/gone.tsx', reason: 'old'}]});

    // a duplicate stays an error while its other site is strict
    const here = ds.filter((d) => d.at.startsWith(file) && d.rule !== 'duplicates');
    assert.ok(here.length && here.every((d) => d.severity === 'warning' && d.waived?.reason === 'allowed'), here.map((d) => d.message).join('\n'));
    assert.equal(ds.filter((d) => d.severity === 'error' && !d.at.startsWith(file)).length, strict.filter((d) => !d.at.startsWith(file)).length);
    assert.ok(ds.some((d) => d.rule === 'strict-exceptions' && d.message.includes('"src/gone.tsx"')));
    assert.ok(!ds.some((d) => d.rule === 'strict-exceptions' && d.message.includes(`"${file}"`)));
});

test('checks: a strict exception also covers what a testid value brings from it into another file', () => {
    const base = {strictScopes: [], strictPaths: ['src/'], configAt: 'test-surface.config.json'};
    const viaB = (ds: ReturnType<typeof runChecks>) => ds.filter((d) => !d.at.startsWith('src/b.tsx') && d.message.includes('(via src/b.tsx'));
    assert.ok(viaB(runChecks(out().result, base)).some((d) => d.severity === 'error'), 'the fixture has errors in a.tsx from values that come through b.tsx');
    const excepted = viaB(runChecks(out().result, {...base, strictExceptions: [{path: 'src/b.tsx', reason: 'allowed'}]}));
    assert.ok(excepted.length && excepted.every((d) => d.severity === 'warning' && d.waived?.reason === 'allowed'), excepted.map((d) => d.message).join('\n'));
});

test('checks: excepted warnings have a ceiling independent of the number of exception entries', () => {
    const opts = {strictScopes: [], strictPaths: ['src/'], strictExceptions: [{path: 'src/', reason: 'Legacy testids.'}], configAt: 'config.json'};
    const result = out().result;
    const baseline = runChecks(result, opts).filter((d) => d.waived?.by === 'strict-exception').length;
    assert.ok(baseline > 1);
    assert.ok(!runChecks(result, {...opts, strictExceptionWarningCeiling: baseline}).some((d) => d.rule === 'strict-exceptions' && d.severity === 'error'));
    assert.ok(runChecks(result, {...opts, strictExceptionWarningCeiling: baseline - 1}).some((d) => d.rule === 'strict-exceptions' && d.severity === 'error'));
    assert.ok(runChecks(result, {...opts, strictExceptionWarningCeiling: -1}).some((d) => d.rule === 'input' && d.severity === 'error'));
});

const checked = (diagnostics: Diagnostic[], allow: AllowEntry[]) => {
    const r = out().result;
    const result = {...r, sites: [], emissions: [], diagnostics, manifest: {...r.manifest, elements: [], pluginSlots: []}};
    return runChecks(result, {strictScopes: [], strictPaths: [], configAt: 'test-surface.config.json', allow});
};

test('checks: an allow entry for a keyed template covers its per-value diagnostics', () => {
    const keyed: Diagnostic = {rule: 'duplicates', severity: 'error', at: 'src/x.tsx:1', message: '"checks.section:{key}=email" is also used by src/y.tsx:2.', template: 'checks.section:{key}', key: 'email'};
    const ds = checked([keyed], [{rule: 'duplicates', template: 'checks.section:{key}', reason: 'exclusive'}]);
    assert.equal(ds.find((d) => d.rule === 'duplicates')?.severity, 'warning');
    assert.ok(!ds.some((d) => d.rule === 'allow'), JSON.stringify(ds));
});

test('checks: an allow entry starting with `*.` covers the template under any scope', () => {
    const at = (template: string): Diagnostic => ({rule: 'role-fit', severity: 'error', at: 'src/x.tsx:1', message: `<a> with testid "${template}" handles input but has no ARIA role.`, template});
    const ds = checked([at('center.post_create.file_previews.file.remove--button'), at('rhs.post_create.file_previews.file.remove--button'), at('x.file.remove--buttons')], [{rule: 'role-fit', template: '*.file_previews.file.remove--button', reason: 'allowed'}]);
    assert.deepEqual(ds.filter((d) => d.rule === 'role-fit').map((d) => d.severity), ['warning', 'warning', 'error']);
});

test('checks: an allow entry matches the diagnostic\'s rule and template, whatever its message says', () => {
    const reworded: Diagnostic = {rule: 'role-fit', severity: 'error', at: 'src/x.tsx:1', message: 'This clickable element needs a role.', template: 'checks.panel.clickable'};
    const elsewhere: Diagnostic = {rule: 'role-fit', severity: 'error', at: 'src/x.tsx:2', message: 'Unlike "checks.panel.clickable", this one needs a role.', template: 'checks.panel.other'};
    const ds = checked([reworded, elsewhere], [{rule: 'role-fit', template: 'checks.panel.clickable', reason: 'allowed'}]);
    assert.deepEqual(ds.filter((d) => d.rule === 'role-fit').map((d) => `${d.template} ${d.severity}`), ['checks.panel.clickable warning', 'checks.panel.other error']);
});

test('checks: diagnostics about a testid carry its template, key and usage chain as fields', () => {
    const d = out().diagnostics.find((x) => x.rule === 'duplicates' && x.template === 'checks.panel.twice--text');
    assert.equal(d?.template, 'checks.panel.twice--text');
    assert.ok(out().diagnostics.filter((x) => x.rule !== 'allow' && x.rule !== 'plugin-slots').every((x) => x.template !== undefined || x.rule === 'unresolved' || x.rule === 'unscoped' || x.rule === 'pages' || x.rule === 'input'));
});

test('checks: a testid written in markup text is a site; one in a selector string is not', () => {
    const el = element(out(), 'checks.markup.highlight--text');
    assert.equal(el.aria.role, null);
    assert.equal(el.component.at, 'src/format.ts:3:12');
    assert.ok(!out().manifest.elements.some((e) => e.template.includes('not_a_site')));
    const keyed = element(out(), 'checks.markup.mention:{key}--link');
    assert.equal(keyed.aria.role, 'link', 'a keyed testid in a template with substitutions');
    assert.ok(out().diagnostics.some((d) => d.at.startsWith('src/format.ts') && d.severity === 'error' && d.rule === 'key-origin'), 'markup with an untyped string key fails strict keys too');
});

test('checks: a sibling testid that renders nothing at a usage does not swallow the usage\'s own testid', () => {
    const el = element(out(), 'checks.form.search--textbox');
    assert.equal(el.aria.role, 'textbox');
});

test('checks: a plugin slot template starting with `*.` matches it under any scope', () => {
    assert.ok(slotMatches('*.file_card.menu.plugin:{key}--button', 'center.post_list.post.attachments.file_card.menu.plugin:{key}--button'));
    assert.ok(!slotMatches('*.file_card.menu.plugin:{key}--button', 'center.file_card.menu.public_link--button'));
    assert.ok(slotMatches('lhs.team_menu.plugin:{key}--menuitem', 'lhs.team_menu.plugin:{key}--menuitem'));
});

test('checks: a template past the value cap is reported (an error under strict paths), not silently cut', () => {
    const d = diags('truncated');
    assert.equal(d.length, 1, d.join('\n'));
    assert.match(d[0], /^error src\/cap\.tsx:\d+:\d+ "checks\.cap\.cell:r01_c01--text" can take more than 256 values/);
    assert.equal(out().result.stats.truncatedTestIdSites, 1);
});

test('checks: the suffix a role-fit fix suggests is a testid role, --text for read-only content, or none', () => {
    assert.equal(roleSuffixFor('switch'), 'switch');
    assert.equal(roleSuffixFor('heading'), 'text');
    assert.equal(roleSuffixFor('treeitem'), null);
    assert.equal(roleSuffixFor(null), null);
});
