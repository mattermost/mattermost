// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';

import ts from 'typescript';

import {loadConfig, type Config} from '../src/config.ts';
import {emitAll, generate} from '../src/generate/index.ts';
import type {Diagnostic} from '../src/manifest_types.ts';
import type {SurfaceReport} from '../src/report_types.ts';

// the generator reads only the report, so its tests load nothing of the scanner
const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const DIR = path.join(FIXTURES, 'generate');
const E2E = path.resolve(FIXTURES, '..', '..', '..');
const WEBAPP_TYPES = path.resolve(E2E, '..', '..', 'webapp', 'platform', 'types', 'src');

const report = (name: string): SurfaceReport => JSON.parse(fs.readFileSync(path.join(DIR, `${name}.surface.json`), 'utf8'));

/** A copy of the fixture's runtime stand-in, with the page objects generated beside it. */
function workspace(name: string, r: SurfaceReport = report(name)): {root: string; config: Config; result: ReturnType<typeof generate>; read: (f: string) => string} {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), `test-surface-gen-${name}-`));
    fs.cpSync(path.join(DIR, 'runtime'), path.join(root, 'runtime'), {recursive: true});
    const config = loadConfig(path.join(DIR, 'test-surface.config.json'));
    config.output.generated = path.join(root, 'generated');
    config.output.runtime = path.join(root, 'runtime');
    config.i18n = null;
    const result = generate(r, config);
    return {root, config, result, read: (f) => fs.readFileSync(path.join(root, 'generated', f), 'utf8')};
}

/** Compiles the generated code and a spec against the runtime's declarations, strictly. */
function compile(root: string, spec?: string): string[] {
    if (spec) {
        fs.copyFileSync(path.join(DIR, spec), path.join(root, 'spec.ts'));
    }
    const files = [...fs.readdirSync(path.join(root, 'generated')).map((f) => path.join(root, 'generated', f)), ...(spec ? [path.join(root, 'spec.ts')] : [])].filter((f) => f.endsWith('.ts'));
    const program = ts.createProgram(files, {
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        target: ts.ScriptTarget.ES2022,
        lib: ['lib.esnext.d.ts', 'lib.dom.d.ts'],
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        types: [],
        paths: {'@playwright/test': [path.join(E2E, 'node_modules', '@playwright', 'test')], '@mattermost/types/*': [path.join(WEBAPP_TYPES, '*')]},
    });
    return ts.getPreEmitDiagnostics(program).map((d) => {
        const at = d.file ? `${path.relative(root, d.file.fileName)}:${d.file.getLineAndCharacterOfPosition(d.start ?? 0).line + 1}` : '';
        return `${at} ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`;
    });
}

const errors = (ds: Diagnostic[]) => ds.filter((d) => d.severity === 'error').map((d) => d.message);

test('generate: one file per top-level scope word, shared.ts for families mounted under several, and the fixed files', () => {
    const {root, result} = workspace('app');
    assert.deepEqual(errors(result.diagnostics), []);
    assert.deepEqual(fs.readdirSync(path.join(root, 'generated')).sort(), ['admin.ts', 'api.ts', 'app.ts', 'audit.ts', 'channel_settings.ts', 'index.ts', 'markdown.ts', 'pages.ts', 'post_list.ts', 'recaps.ts', 'sets.ts', 'shared.ts']);
});

test('generate: the output compiles strictly against the runtime, and the spec rules hold (each @ts-expect-error still fails)', () => {
    for (const name of ['app', 'plugin']) {
        const {root, result} = workspace(name);
        assert.deepEqual(errors(result.diagnostics), [], name);
        assert.deepEqual(compile(root, `${name}.spec.ts`), [], name);
    }
});

test('generate: one class per family, generic over its binding, with one binding type and constant per mount', () => {
    const {read} = workspace('app');
    const shared = read('shared.ts');
    assert.match(shared, /export class DataGrid<in out B extends DataGridBinding> extends Scope<B> \{/);
    assert.equal(shared.match(/export class /g)!.length, 3, 'ConfirmModal, DataGrid, DataGridRow');
    const recaps = read('recaps.ts');
    assert.match(recaps, /export type RecapsRecapDeleteModalMount = \{\n {4}\$container: \{\};\n {4}cancel: \{\};\n {4}checkbox: false;\n {4}confirm: \{\};\n\};/);

    // a binding holds keys and false only: nothing about what an action sends or opens
    for (const file of ['shared.ts', 'recaps.ts', 'admin.ts', 'channel_settings.ts', 'audit.ts']) {
        assert.doesNotMatch(read(file), /EventBinding|requests|opens|Always|Maybe|byKey/, file);
    }

    // a part never rendered at a mount is NotRendered through `Part`, never `never`
    assert.match(shared, /get checkboxCheckbox\(\): Part<DriverFor<'checkbox'>, B\['checkbox'\]> \{\n {8}return this\.part<'checkbox', B\['checkbox'\]>\('checkbox', 'checkbox', this\.bind\.checkbox\);/);
    for (const file of ['shared.ts', 'recaps.ts', 'admin.ts', 'channel_settings.ts']) {
        assert.ok(!read(file).includes('never;'), file);
    }
});

test('generate: no per-element wrappers, no structural sharing, no prettier', () => {
    const {root} = workspace('app');
    for (const f of fs.readdirSync(path.join(root, 'generated'))) {
        const text = fs.readFileSync(path.join(root, 'generated', f), 'utf8');
        assert.doesNotMatch(text, /async (click|set|fill|commit|submit)[A-Z]\w*\(/, f);
        assert.doesNotMatch(text, /prettier|eslint-disable/, f);
    }
});

test('generate: keyed parts and children, by a set, an entity id, an index or what each mount lists', () => {
    const {read} = workspace('app');
    const recaps = read('recaps.ts');
    assert.match(recaps, /action<K extends RecapAction>\(key: K\): Part<DriverFor<'menuitem'>, B\['action'\]>/);
    assert.match(recaps, /get actionList\(\): Part<KeyedList<RecapAction, /);
    assert.match(recaps, /recap\(key: Pick<Recap, 'id'> \| string\): RecapsRecap<B\['recap'\]> \{\n {8}const item = this\.item\('recap', null, keyOf\(key, 'id'\)\);\n {8}return new RecapsRecap\(this\.page, `\$\{this\.scope\}\.recap`, this\.bind\.recap, item, item\);/);
    assert.match(read('shared.ts'), /row\(key: KeyOf<B\['row'\]>\): DataGridRow<B\['row'\]>/);
    assert.match(recaps, /row: Keyed<RecapAction, RecapsGridRowMount>;/);
    assert.match(read('markdown.ts'), /link\(key: number\)/);
});

test('generate: failures name the component that renders a member when it isn\'t the class name; position-keyed lists say so', () => {
    const {read} = workspace('app');
    const recaps = read('recaps.ts');
    assert.match(recaps, /return this\.own<null, B\['\$container'\]>\(null, this\.bind\.\$container, \{source: 'RecapItem'\}\);/);
    assert.match(recaps, /this\.keyed<'menuitem', B\['action'\], K>\('action', 'menuitem', key, this\.bind\.action, \{source: 'RecapMenu'\}\);/);
    assert.match(recaps, /this\.part<'button', B\['delete'\]>\('delete', 'button', this\.bind\.delete, \{source: 'RecapItem'\}\);/);
    assert.match(recaps, /this\.list<string, RecapsRecap<B\['recap'\]>>\('recap', null, \(key: string\) => this\.recap\(key\), \{source: 'RecapItem'\}\);/);
    assert.doesNotMatch(read('shared.ts'), /source:/, 'ConfirmModal renders its own members');
    assert.match(read('markdown.ts'), /\(key: number\) => this\.link\(key\), \{index: true\}\);/);

    // a key the mount supplies is a position at some mounts: the mount's binding says so, and the shared list reads it
    const audit = read('audit.ts');
    assert.match(audit, /row: Keyed<number, AuditGridRowMount>;/);
    assert.match(audit, /row: \{\.\.\.auditGridRowMount, index: true\},/);
    assert.match(audit, /tab: \{index: true\},/);
    assert.match(audit, /export const auditFiltersMount: AuditFiltersMount = \{\n {4}tab: \{\},\n\};/);
    const shared = read('shared.ts');
    assert.match(shared, /\(key: KeyOf<B\['row'\]>\) => this\.row\(key\), \{index: this\.bind\.row\.index\}\);/);
    assert.match(audit, /\{index: this\.bind\.tab === false \? undefined : this\.bind\.tab\.index\}\);/);
});

test('generate: every family class is invariant in its binding, so two mounts of one family are different types', () => {
    const {read} = workspace('app');
    for (const file of ['shared.ts', 'recaps.ts', 'admin.ts', 'channel_settings.ts', 'audit.ts', 'post_list.ts', 'markdown.ts']) {
        const text = read(file);
        const classes = text.match(/^export class \w+</gm) ?? [];
        assert.equal((text.match(/^export class \w+<in out B extends \w+Binding> extends Scope<B> \{/gm) ?? []).length, classes.length, file);
    }
});

test('generate: a portal mount is a plain Scope class whatever its role; the class takes its binding only', () => {
    const {read} = workspace('app');
    assert.match(read('shared.ts'), /export class ConfirmModal<in out B extends ConfirmModalBinding> extends Scope<B> \{/);
    assert.match(read('recaps.ts'), /get deleteModal\(\): ConfirmModal<B\['delete_modal'\]> \{/);
    assert.match(read('app.ts'), /get channelSettings\(\): ChannelSettings<ChannelSettingsMount> \{/);
    for (const file of ['shared.ts', 'recaps.ts', 'admin.ts', 'channel_settings.ts', 'app.ts', 'pages.ts']) {
        assert.doesNotMatch(read(file), /OverlayScope|extends string = never/, file);
    }
});

test('generate: a native file input is a part with FileInputDriver, never a form field', () => {
    const {read} = workspace('app');
    assert.match(read('recaps.ts'), /\/\*\* `<scope>\.import_file` \(Recaps\): a native file input\. \*\/\n {4}get importFile\(\): Part<FileInputDriver, B\['import_file'\]> \{\n {8}return this\.fileInput<B\['import_file'\]>\('import_file', this\.bind\.import_file\);/);

    // one in each repeated item: the item's class has it, with the file input driver
    const r = report('app');
    r.families.RecapsRecap.parts = {...r.families.RecapsRecap.parts, attachment: {native: 'file', role: null}};
    const w = workspace('app', r);
    assert.deepEqual(errors(w.result.diagnostics), []);
    assert.match(w.read('recaps.ts'), /get attachment\(\): Part<FileInputDriver, B\['attachment'\]> \{\n {8}return this\.fileInput<B\['attachment'\]>\('attachment', this\.bind\.attachment, \{source: 'RecapItem'\}\);/);
    assert.deepEqual(compile(w.root), []);
});

test('generate: a repeated native file input, or a scope whose own element is one, is an error, never a wrong driver', () => {
    assert.deepEqual(errors(variant((r) => {
        r.families.Recaps.parts = {...r.families.Recaps.parts, upload: {key: {kind: 'index'}, native: 'file', role: null}};
    })), ['Recaps\'s "upload" is a repeated native file input, which the runtime has no driver for.']);
    assert.deepEqual(errors(variant((r) => {
        r.families.Markdown.container = {native: 'file', role: null};
    })), ['Markdown\'s own element is a native file input, which has nothing under it to be a scope of.']);
});

test('generate: a constant comes after the constants it refers to, and nothing refers to another file\'s value at load time', () => {
    const {root} = workspace('app');
    for (const f of fs.readdirSync(path.join(root, 'generated'))) {
        const text = fs.readFileSync(path.join(root, 'generated', f), 'utf8');
        const declared: string[] = [];
        for (const m of text.matchAll(/^export const (\w+)(?:: \w+)? = ([^]*?)^\};?$/gm)) {
            for (const ref of m[2].matchAll(/\b(\w+Mount)\b(?!>)/g)) {
                if (!(/^[A-Z]/).test(ref[1]) && !m[2].includes('=> new')) {
                    assert.ok(declared.includes(ref[1]), `${f}: ${m[1]} refers to ${ref[1]} before it is declared`);
                }
            }
            declared.push(m[1]);
        }
        for (const imp of text.matchAll(/^import \{([^}]*)\} from '\.\/(\w+)';$/gm)) {
            const values = imp[1].split(',').map((s) => s.trim()).filter((s) => s && !s.startsWith('type '));
            for (const v of values.filter((x) => (/Mount$/).test(x))) {
                const uses = [...text.matchAll(new RegExp(`\\b${v}\\b`, 'g'))].length;
                const lazy = [...text.matchAll(new RegExp(`(=> new \\w+\\([^)]*\\b${v}\\b|return new \\w+\\([^)]*\\b${v}\\b|registerPluginSurface\\([^)]*\\b${v}\\b)`, 'g'))].length;
                assert.equal(uses - 1, lazy, `${f}: ${v} from ${imp[2]}.ts is used at load time`);
            }
        }
    }
});

test('generate: forms fill and read their fields; repeated items read their text; rendered scopes are rooted at the element', () => {
    const {read} = workspace('app');
    const settings = read('channel_settings.ts');
    assert.match(settings, /export type ChannelSettingsFormValues<B extends ChannelSettingsBinding> = \{\n {4}name\?: B\['name'\] extends false \? never : string;\n {4}private\?: B\['private'\] extends false \? never : boolean;/);
    assert.match(settings, /async fill\(values: ChannelSettingsFormValues<B>\): Promise<void>/);
    assert.match(settings, /async read\(\): Promise<ChannelSettingsFormRead<B>>/);
    const posts = read('post_list.ts');
    assert.match(posts, /async read\(\): Promise<PostListPostTexts>/);
    assert.match(posts, /get markdown\(\): Markdown<MarkdownMount> \{\n {8}return new Markdown\(this\.page, 'markdown', markdownMount, this\.locator\);/);
});

test('generate: a numeric spinbutton form field fills through its textbox driver as a string', () => {
    const r = report('app');
    r.families.ChannelSettings.parts = {...r.families.ChannelSettings.parts, count: {role: 'spinbutton'}};
    const {root, result, read} = workspace('app', r);
    assert.deepEqual(errors(result.diagnostics), []);
    const settings = read('channel_settings.ts');
    assert.match(settings, /count\?: B\['count'\] extends false \? never : number;/);
    assert.match(settings, /\.fill\(String\(values\.count\)\)/);
    assert.deepEqual(compile(root), []);
});

test('generate: pages have typed params and goto waits for the ready testids; App has a getter per top-level scope and page', () => {
    const {read} = workspace('app');
    const pages = read('pages.ts');
    assert.match(pages, /export type ChannelPageParams = \{\n {4}\/\*\* a Team or its name \*\/\n {4}team: Pick<Team, 'name'> \| string;\n {4}\/\*\* default `channels` \*\/\n {4}path\?: 'channels' \| 'messages';/);
    assert.match(pages, /return buildPath\(ChannelPage\.route, \{team: keyOf\(params\.team, 'name'\), path: params\.path \?\? 'channels', identifier: keyOf\(params\.channel, 'name'\)\}\);/);
    assert.match(pages, /export class ChannelPage extends SurfacePage<ChannelPageParams, true> \{/);
    assert.match(pages, /pathFor\(params: ChannelPageParams\): string \{\n {8}return ChannelPage\.path\(params\);/);
    assert.match(pages, /get ready\(\): readonly \[Locator, Locator\] \{\n {8}return \[this\.page\.getByTestId\('post_list'\), this\.page\.getByTestId\('channel_settings--dialog'\)\];/);
    assert.match(pages, /export class AdminPluginsPage extends SurfacePage<void, false> \{[^]*?pathFor\(\): string \{[^]*?get ready\(\): readonly \[\] \{\n {8}return \[\];/);
    assert.doesNotMatch(pages, /async goto|constructor\(/, 'goto and the constructor are SurfacePage\'s');
    const app = read('app.ts');
    for (const m of ['adminPlugin', 'audit', 'channelSettings', 'markdown', 'postList', 'recaps', 'channelPage', 'recapsPage', 'plugins']) {
        assert.match(app, new RegExp(`get ${m}\\(\\)`), m);
    }
    assert.doesNotMatch(app, /get recapsRecap\(/, 'a child scope is not top-level');
});

test('generate: the runtime is a package by name, or its source by a path relative to the output', () => {
    const {read} = workspace('app');
    assert.match(read('recaps.ts'), /from '\.\.\/runtime';/);
    const config = loadConfig(path.join(DIR, 'test-surface.config.json'));
    const out = new Map(emitAll(report('app'), {header: '', runtime: '@mattermost/playwright-lib'}, config, []));
    assert.match(out.get('api.ts')!, /import \{apiOp, defineApi\} from '@mattermost\/playwright-lib';\n[^]*export const Api = defineApi\(\{\n {4}DeleteChannel: apiOp<StatusOK>\(\)\(\{op: 'DeleteChannel', method: 'DELETE', path: '\/api\/v4\/channels\/\{channel_id\}'\}\),/);
    assert.doesNotMatch(out.get('api.ts')!, /export type ApiOp/);
    assert.match(out.get('index.ts')!, /import type \{RuntimeApiCheck\} from '@mattermost\/playwright-lib';\n\n\/\*\* The runtime API[^]*export const GENERATOR_API = 3;/);
});

test('generate: a plugin package registers its scope\'s class with app.plugins, without the host\'s App or pages', () => {
    const {root, read, result} = workspace('plugin');
    assert.deepEqual(errors(result.diagnostics), []);
    assert.deepEqual(fs.readdirSync(path.join(root, 'generated')).sort(), ['api.ts', 'index.ts', 'plugins.ts']);
    const index = read('index.ts');
    assert.match(index, /registerPluginSurface\('pluginsCalls', \(page\) => new PluginsCalls\(page, 'plugins\.calls', pluginsCallsMount\)\);/);
    assert.match(index, /interface Plugins \{\n {8}pluginsCalls: PluginsCalls<PluginsCallsMount>;/);
    assert.match(read('api.ts'), /StartCall: apiOp<unknown>\(\)/);
});

/** Every object's keys reversed, at every depth: the report's meaning without its order. */
function reversed(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(reversed);
    }
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).reverse().map(([k, v]) => [k, reversed(v)]));
    }
    return value;
}

test('generate: the output is a function of the report: byte-identical across runs and whatever the key order', () => {
    const emit = (r: SurfaceReport) => [...emitAll(r, {header: '', runtime: 'rt'}, {i18n: null}, [])];
    const once = emit(report('app'));
    assert.deepEqual(emit(report('app')), once);
    assert.deepEqual(emit(reversed(report('app')) as SurfaceReport), once);
});

test('generate: only what changed is rewritten, and a file an earlier run generated that this one doesn\'t is removed', () => {
    const {root, config} = workspace('app');
    const out = path.join(root, 'generated');
    fs.writeFileSync(path.join(out, 'old_scope.ts'), '// GENERATED by @mattermost/test-surface from x. Do not edit.\n');
    fs.writeFileSync(path.join(out, 'notes.ts'), '// not generated\n');
    const again = generate(report('app'), config);
    assert.equal(again.changed, 1);
    assert.ok(!fs.existsSync(path.join(out, 'old_scope.ts')));
    assert.ok(fs.existsSync(path.join(out, 'notes.ts')));
});

/** The app report with a change applied. */
function variant(change: (r: SurfaceReport) => void): Diagnostic[] {
    const r = report('app');
    change(r);
    const diagnostics: Diagnostic[] = [];
    emitAll(r, {header: '', runtime: 'rt'}, {i18n: null}, diagnostics);
    return diagnostics;
}

test('generate: a key passed by value is named for its word, or <word>Key when the word is reserved, and compiles', () => {
    const r = report('app');
    r.families.Recaps.parts!.delete = {role: 'button', key: {kind: 'id', value: 'delete'}} as never;
    const {root, result, read} = workspace('app', r);
    assert.deepEqual(errors(result.diagnostics), []);
    assert.match(read('recaps.ts'), /delete\(deleteKey: string\): Part<DriverFor<'button'>, B\['delete'\]>/);
    assert.deepEqual(compile(root), []);
});

test('generate: same-named types from two modules, or one clashing with a runtime name, import under aliases and compile', () => {
    const r = report('app');
    r.families.Recaps.children!.recap.key = {kind: 'id', entity: 'Record', field: 'id', from: '../types_a'} as never;
    r.families.RecapsRecap.parts!.action.key = {kind: 'id', entity: 'Record', field: 'id', from: '../types_b'} as never;
    r.families.PostList.children!.post.key = {kind: 'id', entity: 'Part', field: 'id', from: '../types_c'} as never;
    r.operations.GetChannel = {...r.operations.GetChannel, body: 'Record', imports: {Record: '../types_a'}};
    r.operations.GetRecap = {...r.operations.GetRecap, body: 'Record[]', imports: {Record: '../types_b'}};
    r.operations.MarkRecapRead = {...r.operations.MarkRecapRead, body: "{kind: 'Record'; 'Record': Record; value: Record}", imports: {Record: '../types_b'}};
    r.families.RecapsRecap.parts!.mark = {role: 'button', key: {kind: 'id', entity: 'B', field: 'id', from: '../types_d'}} as never;
    const {root, result, read} = workspace('app', r);
    const types: Record<string, string> = {types_a: 'Record', types_b: 'Record', types_c: 'Part', types_d: 'B'};
    for (const [name, type] of Object.entries(types)) {
        fs.writeFileSync(path.join(root, `${name}.ts`), `export type ${type} = {id: string; from: '${name}'};\n`);
    }
    assert.deepEqual(errors(result.diagnostics), []);
    const recaps = read('recaps.ts');
    assert.match(recaps, /import type \{Record\} from '\.\.\/types_a';/);
    assert.match(recaps, /import type \{Record as Record_TypesB\} from '\.\.\/types_b';/);
    assert.match(recaps, /Pick<Record_TypesB, 'id'>/);
    const postList = read(fs.readdirSync(path.join(root, 'generated')).find((f) => read(f).includes("'../types_c'"))!);
    assert.match(postList, /import type \{Part as Part_TypesC\} from '\.\.\/types_c';/, 'the runtime\'s Part keeps its name');
    assert.match(read('api.ts'), /apiOp<Record>\(\)\(\{op: 'GetChannel'/);
    assert.match(read('api.ts'), /apiOp<Record_TypesB\[\]>\(\)\(\{op: 'GetRecap'/);
    assert.match(read('api.ts'), /apiOp<\{kind: 'Record'; 'Record': Record_TypesB; value: Record_TypesB\}>/, 'only type references are renamed, not literals or property names');
    assert.match(recaps, /import type \{B as B_TypesD\} from '\.\.\/types_d';/, 'a family\'s type parameter B is not shadowed');
    assert.match(recaps, /Pick<B_TypesD, 'id'>/);
    assert.ok(!recaps.includes('\u0000') && !read('api.ts').includes('\u0000'), 'no placeholder is left');
    assert.deepEqual(compile(root), []);

    // the same report with every key order reversed generates the same files
    const reverse = (o: unknown): unknown => {
        if (Array.isArray(o)) {
            return o.map(reverse);
        }
        if (o && typeof o === 'object') {
            return Object.fromEntries(Object.entries(o).reverse().map(([k, v]) => [k, reverse(v)]));
        }
        return o;
    };
    const reordered = workspace('app', reverse(r) as typeof r);
    for (const file of fs.readdirSync(path.join(root, 'generated'))) {
        assert.equal(reordered.read(file), read(file), file);
    }
});

test('generate: a member name the runtime reserves, or one two members would share, is an error and never renamed', () => {
    assert.deepEqual(errors(variant((r) => {
        r.families.Recaps.parts!.page = {role: null};
    })), ['Recaps\'s "page" would be generated as "page", a name the runtime\'s Scope reserves.']);
    assert.deepEqual(errors(variant((r) => {
        r.families.RecapsRecap.parts!.action_list = {role: null};
    })), ['RecapsRecap\'s "action_list" and "action" would both be generated as "actionList".']);
});

test('generate: names two generated files would both export are errors', () => {
    assert.deepEqual(errors(variant((r) => {
        r.sets.Recaps = ['a'];
    })), ['"Recaps" would be exported by both sets.ts and recaps.ts (family Recaps).']);
});

test('generate: a mount must give a mount-keyed child its key, have its children\'s scopes, and never mark a child unrendered', () => {
    assert.deepEqual(errors(variant((r) => {
        delete r.scopes['recaps.grid'].bind;
    })), ['"recaps.grid.row" is keyed by its mount, but the mount says nothing about the key.']);
    assert.deepEqual(errors(variant((r) => {
        delete r.scopes['recaps.recap.delete_modal'];
    })), ['"recaps.recap.delete_modal" is a child of RecapsRecap, but the report has no scope for it.']);
    assert.deepEqual(errors(variant((r) => {
        r.scopes.recaps.bind = {grid: false};
    })), ['Scope "recaps" marks the child "grid" as never rendered: only parts can be; a mount without that child is a family of its own.']);
});

test('generate: raw keys, routes and ready testids in doc comments cannot end the comment or break the source', () => {
    const r = report('app');
    const hostile = ['*/ end', "it's", 'back\\slash', '"quoted"'];
    r.sets.AAHostileKey = hostile;
    r.pages.ChannelPage.path = '/:team/*/:path(channels|messages)/:identifier';
    r.pages.ChannelPage.params![1].values = ['*/', 'messages'];
    r.pages.ChannelPage.ready = ['post_list', 'x.item:a*/b--button'];
    const diagnostics: Diagnostic[] = [];
    const out = emitAll(r, {header: '', runtime: 'rt'}, {i18n: null}, diagnostics);
    for (const [file, text] of out) {
        const source = ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
        const parsed = (source as unknown as {parseDiagnostics: ts.Diagnostic[]}).parseDiagnostics;
        assert.deepEqual(parsed.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n')), [], file);
    }
    assert.match(out.get('sets.ts')!, /export const AAHostileKey = \['\*\/ end', 'it\\'s', 'back\\\\slash', '"quoted"'\] as const;/);
    assert.match(out.get('pages.ts')!, /static readonly route = '\/:team\/\*\/:path\(channels\|messages\)\/:identifier';/);
});

test('generate: a set is its members as written, with no names invented for them, so members that differ only in case are fine', () => {
    const r = report('app');
    r.sets.AdminSettingKey = ['Enable', 'ServiceSettings.SiteURL', 'enable'];
    const diagnostics: Diagnostic[] = [];
    const sets = emitAll(r, {header: '', runtime: 'rt'}, {i18n: null}, diagnostics).get('sets.ts')!;
    assert.deepEqual(errors(diagnostics), []);
    assert.match(sets, /export const AdminSettingKey = \['Enable', 'ServiceSettings\.SiteURL', 'enable'\] as const;\nexport type AdminSettingKey = \(typeof AdminSettingKey\)\[number\];/);
    assert.match(sets, /export const RecapAction = \['mark_read', 'regenerate'\] as const;/);
    assert.doesNotMatch(sets, /MarkRead|\{$/m);
});

test('generate: a repeated item\'s text type never takes the name of its child family, so a keyed item with a `row` child generates', () => {
    const r = report('app');
    r.families.PostListPost.children = {row: {family: 'PostListPostRow'}};
    r.families.PostListPostRow = {container: {role: 'row'}, parts: {label: {role: 'text'}}};
    r.scopes['post_list.post.row'] = {family: 'PostListPostRow'};
    const {root, result, read} = workspace('app', r);
    assert.deepEqual(errors(result.diagnostics), []);
    const posts = read('post_list.ts');
    assert.match(posts, /export class PostListPostRow</);
    assert.match(posts, /export type PostListPostTexts = \{/);
    assert.deepEqual(compile(root), []);
});
