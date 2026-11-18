// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import os from 'node:os';
import path from 'node:path';
import {test} from 'node:test';

import {FIXTURES} from './helpers.ts';

import {scanProject} from '../src/cli.ts';
import {loadConfig} from '../src/config.ts';
import {generate} from '../src/generate/index.ts';
import {serialize} from '../src/report_types.ts';

test('post items retain markdown rendered by an imported value helper without manufacturing an undefined scope', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-post-markdown-'));
    try {
        fs.mkdirSync(path.join(root, 'node_modules'));
        fs.symlinkSync(path.dirname(path.dirname(createRequire(import.meta.url).resolve('typescript'))), path.join(root, 'node_modules/typescript'), 'dir');
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['*.tsx', path.join(FIXTURES, '_lib')]}));
        fs.writeFileSync(path.join(root, 'test-surface.config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], output: {report: 'surface.json', generated: 'generated'}}));
        fs.writeFileSync(path.join(root, 'message_html_to_component.tsx'), 'export function messageHtmlToComponent(message: string) {const instructions = {render: () => <a data-testid="markdown.link--link">{message}</a>}; return instructions.render();}');
        fs.writeFileSync(path.join(root, 'markdown.tsx'), "import {messageHtmlToComponent} from './message_html_to_component'; export function Markdown({message}: {message: string}) {return messageHtmlToComponent(message);}");
        fs.writeFileSync(path.join(root, 'source.tsx'), [
            "import React from 'react'; import {Markdown} from './markdown';",
            'class PostMarkdown extends React.Component<{message: string}> {render() {return <Markdown message={this.props.message}/>;}}',
            'function PostMessageView({message}: {message: string}) {return <PostMarkdown message={message}/>;}',
            'function MessageWithAdditionalContent({message}: {message: string}) {return <div><Wrapper0 message={message}/></div>;}',
            ...Array.from({length: 30}, (_, index) => `function Wrapper${index}({message}: {message: string}) {return <${index === 29 ? 'PostMessageView' : `Wrapper${index + 1}`} message={message}/>;}`),
            // eslint-disable-next-line no-template-curly-in-string -- fixture source
            'function OptionalScope({testId}: {testId?: string}) {return <span data-testid={`${testId}.label--text`}/>;}',
            // eslint-disable-next-line no-template-curly-in-string -- fixture source
            'export function PostComponent({post}: {post: {id: "first" | "second"; message: string}}) {return <article role="region" data-testid={`center.post_list.post:${post.id}--region`}><div data-testid="center.post_list.post.body"><MessageWithAdditionalContent message={post.message}/></div><OptionalScope/></article>;}',
        ].join('\n'));
        const config = loadConfig(path.join(root, 'test-surface.config.json'));
        const scanned = scanProject(config);
        assert.ok(typeof scanned.result.stats.renderScopeStates === 'number' && scanned.result.stats.renderScopeStates > 0);
        assert.equal(scanned.result.stats.renderScopeEvaluated, scanned.result.stats.renderScopeStates);
        const parsed = JSON.parse(serialize(scanned.report));
        assert.equal(parsed.scopes.undefined, undefined);
        assert.deepEqual(parsed.families[parsed.scopes['center.post_list.post'].family].renders, ['markdown']);
        assert.deepEqual(generate(scanned.report, config).diagnostics, []);
        assert.match(fs.readFileSync(path.join(root, 'generated/center.ts'), 'utf8'), /get markdown\(\)/);
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});

test('deep shared renderers keep each mount scope isolated after irrelevant wrapper paths', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-render-context-'));
    try {
        fs.mkdirSync(path.join(root, 'node_modules'));
        fs.symlinkSync(path.dirname(path.dirname(createRequire(import.meta.url).resolve('typescript'))), path.join(root, 'node_modules/typescript'), 'dir');
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['source.tsx']}));
        fs.writeFileSync(path.join(root, 'test-surface.config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], output: {report: 'surface.json'}}));
        fs.writeFileSync(path.join(root, 'source.tsx'), [
            // eslint-disable-next-line no-template-curly-in-string -- fixture source
            'function Leaf({testId}: {testId: string}) {return <span data-testid={`${testId}.body--text`}/>;}',
            'type Tree = {children?: Tree[]}; function Shared({testId, node}: {testId: string; node: Tree}) {return <div><Leaf testId={testId}/>{node.children?.map((child) => <Shared testId={testId} node={child}/>)}</div>;}',
            ...['First', 'Second'].flatMap((name) => Array.from({length: 10}, (_, index) => `function ${name}${index}() {return ${index === 9 ? `<Shared testId="${name === 'First' ? 'markdown' : 'other'}" node={{}}/>` : `<${name}${index + 1}/>`};}`)),
            'export function First() {return <section data-testid="first"><span data-testid="first.title--text"/><First0/></section>;} export function Second() {return <section data-testid="second"><span data-testid="second.title--text"/><Second0/></section>;}',
        ].join('\n'));
        const {report} = scanProject(loadConfig(path.join(root, 'test-surface.config.json')));
        assert.deepEqual(report.families[report.scopes.first.family].renders, ['markdown']);
        assert.deepEqual(report.families[report.scopes.second.family].renders, ['other']);
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});

test('recursive components and render helpers close their scope unions independently of entry order', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-render-cycles-'));
    try {
        fs.mkdirSync(path.join(root, 'node_modules'));
        fs.symlinkSync(path.dirname(path.dirname(createRequire(import.meta.url).resolve('typescript'))), path.join(root, 'node_modules/typescript'), 'dir');
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['source.tsx']}));
        fs.writeFileSync(path.join(root, 'test-surface.config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], output: {report: 'surface.json'}}));
        const definitions = [
            'function A() {return <div data-testid="cycle_a"><span data-testid="cycle_a.value--text"/><B/><Tail/></div>;}',
            'function B() {return <div data-testid="cycle_b"><span data-testid="cycle_b.value--text"/><A/></div>;}',
            'function Tail() {return <div data-testid="cycle_tail"><span data-testid="cycle_tail.value--text"/></div>;}',
            'function Self() {return <div data-testid="self_scope"><span data-testid="self_scope.value--text"/><Self/></div>;}',
            'function helperA() {return [<span data-testid="helper_a.value--text"/>, helperB()];} function helperB() {return [<span data-testid="helper_b.value--text"/>, helperA()];}',
            'function helperSelf() {return [<span data-testid="helper_self.value--text"/>, helperSelf()];}',
            'function HelperHost() {return <div data-testid="helper_host"><span data-testid="helper_host.title--text"/>{helperA()}{helperSelf()}</div>;}',
        ];
        const run = (reverse: boolean) => {
            fs.writeFileSync(path.join(root, 'source.tsx'), [...(reverse ? [...definitions].reverse() : definitions), `export function App() {return <div>${reverse ? '<HelperHost/><Self/><B/><A/>' : '<A/><B/><Self/><HelperHost/>'}</div>;}`].join('\n'));
            return scanProject(loadConfig(path.join(root, 'test-surface.config.json')));
        };
        const first = run(false);
        const family = (scope: string) => first.report.families[first.report.scopes[scope].family];
        assert.deepEqual(family('cycle_a').renders, ['cycle_b', 'cycle_tail']);
        assert.deepEqual(family('cycle_b').renders, ['cycle_a', 'cycle_tail']);
        assert.equal(family('self_scope').parts?.value.role, 'text');
        assert.deepEqual(family('helper_host').renders, ['helper_a', 'helper_b', 'helper_self']);
        assert.equal(first.result.stats.renderScopeEvaluated, first.result.stats.renderScopeStates);
        assert.equal(serialize(run(true).report), serialize(first.report));
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});

test('rendered scope accessors follow inline paths and exclude portal paths per container', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-render-portals-'));
    try {
        fs.mkdirSync(path.join(root, 'node_modules'));
        fs.symlinkSync(path.dirname(path.dirname(createRequire(import.meta.url).resolve('typescript'))), path.join(root, 'node_modules/typescript'), 'dir');
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['source.tsx']}));
        fs.writeFileSync(path.join(root, 'test-surface.config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], output: {report: 'surface.json', generated: 'generated'}}));
        fs.writeFileSync(path.join(root, 'source.tsx'), [
            'import {createPortal as placePortal} from \'react-dom\'; function Portal({children}: {children?: unknown}) {return placePortal(children, document.body);}',
            'function Shared() {return <span data-testid="shared.value--text"/>;}',
            'function Mention() {return <><button data-testid="markdown.mention--button"/><Portal><span data-testid="profile_popover.name--text"/><span data-testid="portal_only.value--text"/></Portal></>;}',
            // eslint-disable-next-line no-template-curly-in-string -- fixture source
            'export function Post({index}: {index: number}) {return <article data-testid={`posts.post:${index}--region`}><span data-testid="posts.post.title--text"/><img data-testid="markdown.emoji--img"/><Mention/><Shared/></article>;}',
            'export function Other() {return <section data-testid="other"><span data-testid="other.title--text"/><Portal><Shared/></Portal></section>;}',
        ].join('\n'));
        const config = loadConfig(path.join(root, 'test-surface.config.json'));
        const {report} = scanProject(config);
        assert.deepEqual(report.families[report.scopes['posts.post'].family].renders, ['markdown', 'shared']);
        assert.deepEqual(report.families[report.scopes.other.family].renders ?? [], []);
        assert.deepEqual(generate(report, config).diagnostics, []);
        assert.match(fs.readFileSync(path.join(root, 'generated/posts.ts'), 'utf8'), /get markdown\(\)/);
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});

test('shared render diamonds expand each context state once', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-render-diamonds-'));
    try {
        fs.mkdirSync(path.join(root, 'node_modules'));
        fs.symlinkSync(path.dirname(path.dirname(createRequire(import.meta.url).resolve('typescript'))), path.join(root, 'node_modules/typescript'), 'dir');
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['source.tsx']}));
        fs.writeFileSync(path.join(root, 'test-surface.config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], output: {report: 'surface.json'}}));
        fs.writeFileSync(path.join(root, 'source.tsx'), [
            'function Leaf() {return <span data-testid="markdown.body--text"/>;}',
            ...Array.from({length: 30}, (_, index) => `function Mesh${index}() {return <div><${index < 29 ? `Mesh${index + 1}` : 'Leaf'}/><${index < 28 ? `Mesh${index + 2}` : 'Leaf'}/></div>;}`),
            'export function Host() {return <section data-testid="host"><span data-testid="host.title--text"/><Mesh0/></section>;}',
        ].join('\n'));
        const {report, result} = scanProject(loadConfig(path.join(root, 'test-surface.config.json')));
        assert.deepEqual(report.families[report.scopes.host.family].renders, ['markdown']);
        assert.ok(typeof result.stats.renderScopeStates === 'number' && result.stats.renderScopeStates > 0 && result.stats.renderScopeStates < 200);
        assert.equal(result.stats.renderScopeEvaluated, result.stats.renderScopeStates);
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});

test('portal boundaries are relative to root elements and shared families keep different lookup roots separate', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-portal-boundaries-'));
    try {
        fs.mkdirSync(path.join(root, 'node_modules'));
        fs.symlinkSync(path.dirname(path.dirname(createRequire(import.meta.url).resolve('typescript'))), path.join(root, 'node_modules/typescript'), 'dir');
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['source.tsx']}));
        fs.writeFileSync(path.join(root, 'test-surface.config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], output: {report: 'surface.json'}}));
        fs.writeFileSync(path.join(root, 'source.tsx'), [
            'function Modal(props: {children?: unknown; "data-testid"?: string}) {return <div {...props}/>;}',
            'import {createPortal as placePortal} from \'react-dom\'; function Portal({children}: {children?: unknown}) {return placePortal(children, document.body);}',
            'function Markdown() {return <span data-testid="markdown.body--text"/>;}',
            'export function RootModal() {return <Modal data-testid="root_modal"><span data-testid="root_modal.title--text"/><Markdown/></Modal>;}',
            // eslint-disable-next-line no-template-curly-in-string -- fixture source
            'function Row({scope, index}: {scope: string; index: number}) {return <article data-testid={`${scope}:${index}--region`}><button data-testid={`${scope}.menu.action--button`}/></article>;}',
            'export function RowsModal() {return <Portal><Row scope="rows.row" index={0}/></Portal>;}',
            // eslint-disable-next-line no-template-curly-in-string -- fixture source
            'function Panel({testId, portaled}: {testId: string; portaled: boolean}) {return <section data-testid={testId}>{portaled ? <Portal><span data-testid={`${testId}.value--text`}/></Portal> : <span data-testid={`${testId}.value--text`}/>}</section>;}',
            'export function App() {return <div><Panel testId="first" portaled={false}/><Panel testId="second" portaled={true}/></div>;}',
        ].join('\n'));
        const {report} = scanProject(loadConfig(path.join(root, 'test-surface.config.json')));
        assert.deepEqual(report.families[report.scopes.root_modal.family].renders, ['markdown']);
        assert.equal(report.families[report.scopes['rows.row.menu'].family].parts?.action.portal, undefined);
        assert.notEqual(report.scopes.first.family, report.scopes.second.family);
        assert.equal(report.families[report.scopes.first.family].parts?.value.portal, undefined);
        assert.equal(report.families[report.scopes.second.family].parts?.value.portal, true);
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});

test('parts distinguish portal landings and reject mixed inline and portal lookups', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-part-portals-'));
    try {
        fs.mkdirSync(path.join(root, 'node_modules'));
        fs.symlinkSync(path.dirname(path.dirname(createRequire(import.meta.url).resolve('typescript'))), path.join(root, 'node_modules/typescript'), 'dir');
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['source.tsx']}));
        fs.writeFileSync(path.join(root, 'test-surface.config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], output: {report: 'surface.json'}}));
        const source = 'import {createPortal as placePortal} from \'react-dom\'; function Portal({children}: {children?: unknown}) {return placePortal(children, document.body);} export function Panel() {return <section data-testid="panel"><span data-testid="panel.inline--text"/><Portal><span data-testid="panel.outside--text"/></Portal></section>;}';
        fs.writeFileSync(path.join(root, 'source.tsx'), source);
        const config = loadConfig(path.join(root, 'test-surface.config.json'));
        const scanned = scanProject(config);
        const parts = scanned.report.families[scanned.report.scopes.panel.family].parts!;
        assert.equal(parts.inline.portal, undefined);
        assert.equal(parts.outside.portal, true);
        fs.writeFileSync(path.join(root, 'source.tsx'), source.replace('panel.outside', 'panel.inline'));
        const mixed = scanProject(config);
        assert.ok(mixed.diagnostics.some((diagnostic) => diagnostic.rule === 'collisions' && diagnostic.severity === 'error' && diagnostic.message.includes('lands both inside its scope') && diagnostic.message.includes('source.tsx:')));
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});

test('surface report retains embedded top-level scopes on containers and keyed child families, excluding portals', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-renders-'));
    try {
        fs.mkdirSync(path.join(root, 'node_modules'));
        fs.symlinkSync(path.dirname(path.dirname(createRequire(import.meta.url).resolve('typescript'))), path.join(root, 'node_modules/typescript'), 'dir');
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['source.tsx']}));
        fs.writeFileSync(path.join(root, 'test-surface.config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], generateScopes: ['panel', 'posts', 'markdown', 'confirm_dialog'], output: {report: 'surface.json', generated: 'generated'}}));
        fs.writeFileSync(path.join(root, 'source.tsx'), [
            'function Markdown() {return <div data-testid="markdown"><span data-testid="markdown.body--text"/></div>;}',
            'import {createPortal as placePortal} from \'react-dom\'; function Portal({children}: {children?: unknown}) {return placePortal(children, document.body);}',
            'function Excluded() {return <div data-testid="unlisted"><span data-testid="unlisted.body--text"/></div>;}',
            'function Dialog() {return <Portal><div data-testid="confirm_dialog"><button data-testid="confirm_dialog.confirm--button"/></div></Portal>;}',
            'function openModal(value: unknown) {return value;}',
            'export function Panel() {return <section data-testid="panel"><Markdown/><Excluded/><button data-testid="panel.open--button" onClick={() => openModal({dialogType: Dialog})}/><Dialog/></section>;}',
            // eslint-disable-next-line no-template-curly-in-string -- source fixture
            'export function Posts({items}: {items: number[]}) {return <div data-testid="posts">{items.map((_, index) => <article role="region" data-testid={`posts.post:${index}--region`}><Markdown/><button data-testid="posts.post.open--button" onClick={() => openModal({dialogType: Dialog})}/></article>)}</div>;}',
        ].join('\n'));
        const config = loadConfig(path.join(root, 'test-surface.config.json'));
        const scanned = scanProject(config);
        const {report} = scanned;
        assert.ok(scanned.manifest.components.find((component) => component.name === 'Dialog')?.scopes.includes('confirm_dialog'), 'an opened component retains its own scopes inside its portal');
        assert.deepEqual(scanned.manifest.elements.find((element) => element.template === 'posts.post:{key}--region')?.renders, ['markdown']);
        assert.deepEqual(report.families[report.scopes.panel.family].renders, ['markdown']);
        assert.deepEqual(report.families[report.scopes['posts.post'].family].renders, ['markdown']);
        assert.ok(!Object.values(report.families).some((family) => family.renders?.includes('confirm_dialog')));
        assert.deepEqual(generate(report, config).diagnostics, []);
        const generated = fs.readFileSync(path.join(root, 'generated/posts.ts'), 'utf8');
        assert.match(generated, /get markdown\(\)/);
        assert.match(generated, /return new Markdown\(this\.page, 'markdown', markdownMount, this\.locator\);/);
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});

test('surface report preserves its contract through condition, source location, callback and translation changes', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-contract-'));
    try {
        fs.mkdirSync(path.join(root, 'src'));
        fs.mkdirSync(path.join(root, 'node_modules'));
        fs.symlinkSync(path.dirname(path.dirname(createRequire(import.meta.url).resolve('typescript'))), path.join(root, 'node_modules/typescript'), 'dir');
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['src']}));
        fs.writeFileSync(path.join(root, 'test-surface.config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['src'], i18n: 'en.json', client: {file: path.join(FIXTURES, 'effects/client/client4.ts'), className: 'Client4', urlVersion: '/api/v4'}, openapiDir: path.join(FIXTURES, 'effects/openapi'), output: {report: 'surface.json'}}));
        const source = (condition: string, handler: string, role = 'button') => `
import {Client4} from '${path.join(FIXTURES, 'effects/client/client4.ts')}';
export function Panel({visible, enabled}: {visible: boolean; enabled: boolean}) {
    ${handler}
    return <div data-testid="panel">{${condition} && <button data-testid="panel.save--${role}" onClick={save}/>}</div>;
}`;
        const file = path.join(root, 'src/panel.tsx');
        const report = () => {
            const scanned = scanProject(loadConfig(path.join(root, 'test-surface.config.json')));
            const collision = scanned.diagnostics.find((diagnostic) => diagnostic.rule === 'collisions' && diagnostic.severity === 'error');
            if (collision) {
                throw new Error(collision.message);
            }
            return serialize(scanned.report);
        };
        fs.writeFileSync(file, source('visible', 'const save = () => Client4.patchChannel({id: \'channel\'});'));
        fs.writeFileSync(path.join(root, 'en.json'), JSON.stringify({save: 'Save'}));
        const baseline = report();
        assert.equal(JSON.parse(baseline).scopes.panel.bind, undefined, 'handler requests are absent from the structural report');
        assert.equal(report(), baseline, 'repeated scans are deterministic');
        fs.writeFileSync(file, source('enabled', 'const save = () => Client4.patchChannel({id: \'channel\'});'));
        assert.equal(report(), baseline, 'condition text is provenance');
        fs.renameSync(file, path.join(root, 'src/moved.tsx'));
        assert.equal(report(), baseline, 'component paths are provenance');
        fs.writeFileSync(path.join(root, 'src/moved.tsx'), source('enabled', 'function save() {return Client4.patchChannel({id: \'channel\'});}'));
        assert.equal(report(), baseline, 'equivalent handler declarations preserve the API');
        fs.writeFileSync(path.join(root, 'en.json'), JSON.stringify({save: 'Save changes'}));
        assert.equal(report(), baseline, 'translations are read when generating');
        fs.writeFileSync(path.join(root, 'src/moved.tsx'), source('enabled', 'function save() {return Client4.patchChannel({id: \'channel\'});}', 'togglebutton'));
        assert.notEqual(report(), baseline, 'driver role changes alter the contract');
        fs.writeFileSync(path.join(root, 'src/moved.tsx'), `import {Client4} from '${path.join(FIXTURES, 'effects/client/client4.ts')}'; export function Panel() {return <div><div data-testid="foo_bar.part--text"/><div data-testid="foo.bar.part--text"/></div>;}`);
        assert.throws(report, /Family name "FooBar"/);
        const configFile = path.join(root, 'test-surface.config.json');
        const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
        config.familyNames = {'foo.bar': 'NestedBar'};
        fs.writeFileSync(configFile, JSON.stringify(config));
        assert.ok(report().includes('NestedBar'), 'literal families support explicit collision overrides');
        for (const file of ['first', 'second']) {
            // eslint-disable-next-line no-template-curly-in-string -- fixture source contains a template literal
            fs.writeFileSync(path.join(root, `src/${file}.tsx`), 'export function Twin({testId}: {testId?: string}) {return <span data-testid={testId ? `${testId}.label--text` : undefined}/>;}');
        }
        fs.writeFileSync(path.join(root, 'src/moved.tsx'), `import {Client4} from '${path.join(FIXTURES, 'effects/client/client4.ts')}';
import {Twin as First} from './first'; import {Twin as Second} from './second';
export function Panel() {return <div><First testId="first_mount"/><Second testId="second_mount"/></div>;}`);
        assert.throws(report, /Family name "Twin"/);
        config.familyNames.second_mount = 'SecondTwin';
        fs.writeFileSync(configFile, JSON.stringify(config));
        const renamed = JSON.parse(report());
        assert.equal(renamed.scopes.first_mount.family, 'Twin');
        assert.equal(renamed.scopes.second_mount.family, 'SecondTwin');
        fs.writeFileSync(path.join(root, 'src/moved.tsx'), `import {Client4} from '${path.join(FIXTURES, 'effects/client/client4.ts')}';
function RoleButton({testId, toggled}: {testId?: string; toggled: boolean}) {
 return <button data-testid={testId ? (toggled ? \`\${testId}--togglebutton\` : \`\${testId}--button\`) : undefined}>
 <span data-testid={testId ? \`\${testId}.label--text\` : undefined}/></button>;
}
export function Panel() {return <div><RoleButton testId="role.one" toggled={false}/><RoleButton testId="role.two" toggled={true}/></div>;}`);
        const splitRoles = JSON.parse(report());
        assert.equal(splitRoles.families.RoleOne.container.role, 'button');
        assert.equal(splitRoles.families.RoleTwo.container.role, 'togglebutton');
        config.familyNames['role.two'] = 'RoleToggle';
        fs.writeFileSync(configFile, JSON.stringify(config));
        const variants = JSON.parse(report());
        assert.equal(variants.families.RoleOne.container.role, 'button');
        assert.equal(variants.families.RoleToggle.container.role, 'togglebutton');
        const dynamic = fs.readFileSync(path.join(root, 'src/moved.tsx'), 'utf8').replace('export function Panel()', 'export function Panel({flag}: {flag: boolean})').replace('toggled={false}', 'toggled={flag}');
        fs.writeFileSync(path.join(root, 'src/moved.tsx'), dynamic);
        const invalidRoles = scanProject(loadConfig(configFile));
        assert.ok(invalidRoles.diagnostics.some((diagnostic) => diagnostic.severity === 'error' && (/testid (must not|does not) change with state/).test(diagnostic.message)));
        fs.writeFileSync(path.join(root, 'src/moved.tsx'), `import {Client4} from '${path.join(FIXTURES, 'effects/client/client4.ts')}';
function FooBar({testId}: {testId?: string}) {return <span data-testid={testId ? \`\${testId}.label--text\` : undefined}/>;}
export function Panel() {return <FooBar testId="foo_bar.item"/>;}`);
        assert.throws(report, (error: Error) => error.message.includes('{"familyNames":{"foo_bar":"FooBars"}}'));
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});

test('surface report imports a named array alias by the name used in the response body', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-body-'));
    try {
        fs.mkdirSync(path.join(root, 'node_modules'));
        fs.symlinkSync(path.dirname(path.dirname(createRequire(import.meta.url).resolve('typescript'))), path.join(root, 'node_modules/typescript'), 'dir');
        fs.mkdirSync(path.join(root, 'types'));
        fs.writeFileSync(path.join(root, 'types/rows.ts'), 'export type Row = {id: string}; export type Rows = Row[];');
        fs.writeFileSync(path.join(root, 'client.ts'), `import type {Rows} from './types/rows';
export class Client4 {
    getRows(): Promise<Rows> {return this.doFetch<Rows>('/api/v4/rows', {method: 'GET'});}
    doFetch<T>(url: string, options: unknown): Promise<T> {throw new Error(url);}
}`);
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({compilerOptions: {types: [], target: 'es2020'}, include: ['*.ts', 'types']}));
        fs.writeFileSync(path.join(root, 'test-surface.config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], entityTypeDirs: ['types'], client: {file: 'client.ts', className: 'Client4', urlVersion: '/api/v4'}, output: {report: 'surface.json'}}));
        const report = scanProject(loadConfig(path.join(root, 'test-surface.config.json'))).report;
        assert.equal(report.operations.GetRows.body, 'Rows');
        assert.deepEqual(report.operations.GetRows.imports, {Rows: '@mattermost/types/rows'});
        const configPath = path.join(root, 'test-surface.config.json');
        const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        fs.writeFileSync(configPath, JSON.stringify({...raw, entityTypeModules: {types: '@acme/entities/'}}));
        const custom = loadConfig(configPath);
        assert.deepEqual(scanProject(custom).report.operations.GetRows.imports, {Rows: '@acme/entities/rows'});
        fs.writeFileSync(configPath, JSON.stringify({...raw, entityTypeModules: {missing: '@acme/entities'}}));
        assert.throws(() => loadConfig(configPath), /entityTypeModules/);
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});

test('surface report retains finite route alternatives and marks dynamic methods unknown', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-routes-'));
    try {
        fs.mkdirSync(path.join(root, 'node_modules'));
        fs.symlinkSync(path.dirname(path.dirname(createRequire(import.meta.url).resolve('typescript'))), path.join(root, 'node_modules/typescript'), 'dir');
        fs.writeFileSync(path.join(root, 'client.ts'), `export class Client4 {
    static branch(flag: boolean) {return this.doFetch(flag ? '/api/v4/left' : '/api/v4/right', {method: 'POST'});}
    static verb(flag: boolean) {const method = flag ? 'GET' : 'PATCH'; return this.doFetch('/api/v4/item', {method});}
    static unknown(method: string) {return this.doFetch('/api/v4/unknown', {method});}
    static doFetch(url: string, options: unknown): Promise<string> {throw new Error(url);}
}`);
        fs.writeFileSync(path.join(root, 'app.tsx'), `import {Client4} from './client';
export function Routes({flag, method}: {flag: boolean; method: string}) {return <div>
<button data-testid="routes.branch--button" onClick={() => Client4.branch(flag)}/>
<button data-testid="routes.verb--button" onClick={() => Client4.verb(flag)}/>
<button data-testid="routes.unknown--button" onClick={() => Client4.unknown(method)}/>
</div>;}`);
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({compilerOptions: {types: [], target: 'es2020', jsx: 'preserve'}, include: ['*.ts', '*.tsx']}));
        fs.writeFileSync(path.join(root, 'test-surface.config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], client: {file: 'client.ts', className: 'Client4', urlVersion: '/api/v4'}, output: {report: 'surface.json'}}));
        const report = scanProject(loadConfig(path.join(root, 'test-surface.config.json'))).report;
        assert.equal(report.scopes.routes.bind, undefined, 'handlers contribute no binding data');
        assert.deepEqual(Object.values(report.operations).map((operation) => `${operation.method} ${operation.path}`).sort(), ['GET /api/v4/item', 'PATCH /api/v4/item', 'POST /api/v4/left', 'POST /api/v4/right']);
        assert.ok(!Object.values(report.operations).some((operation) => operation.path === '/api/v4/unknown'));
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});

test('JSX held in a local lands where the local is rendered: a control built before its keyed row stays inline in a modal', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-portal-local-'));
    try {
        fs.mkdirSync(path.join(root, 'node_modules'));
        fs.symlinkSync(path.dirname(path.dirname(createRequire(import.meta.url).resolve('typescript'))), path.join(root, 'node_modules/typescript'), 'dir');
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['source.tsx']}));
        fs.writeFileSync(path.join(root, 'test-surface.config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], output: {report: 'surface.json'}}));
        fs.writeFileSync(path.join(root, 'source.tsx'), [
            'function GenericModal(props: {children?: unknown; "data-testid"?: string}) {return <div {...props}/>;}',
            'import {createPortal as placePortal} from \'react-dom\'; function Portal({children}: {children?: unknown}) {return placePortal(children, document.body);}',
            // eslint-disable-next-line no-template-curly-in-string -- fixture source
            'function Picker({scope}: {scope: string}) {return <button data-testid={`${scope}.value_choice--button`}/>;}',
            // eslint-disable-next-line no-template-curly-in-string -- fixture source
            'function Hint({scope}: {scope: string}) {return <span data-testid={`${scope}.hint--text`}/>;}',
            // eslint-disable-next-line no-template-curly-in-string -- fixture source
            'function Tip({scope}: {scope: string}) {return <span data-testid={`${scope}.tip--text`}/>;}',
            'function List({components}: {components: {Row: () => unknown}}) {return <ul>{String(components)}</ul>;}',
            // eslint-disable-next-line no-template-curly-in-string -- fixture source
            'function Row({scope}: {scope: string}) {return <li data-testid={`${scope}.listed--listitem`}/>;}',
            'function Form({fields, testId}: {fields: Array<{id: string; open: boolean}>; testId: string}) {',
            '    return <div data-testid={testId}>{fields.map((field) => {',
            '        let control;',
            '        if (field.open) {',
            // eslint-disable-next-line no-template-curly-in-string -- fixture source
            '            control = <Picker scope={`${testId}.attribute`}/>;',
            '        }',
            // eslint-disable-next-line no-template-curly-in-string -- fixture source
            '        const hint = <Hint scope={`${testId}.attribute`}/>;',
            // eslint-disable-next-line no-template-curly-in-string -- fixture source
            '        const tip = <Tip scope={`${testId}.attribute`}/>;',
            // eslint-disable-next-line no-template-curly-in-string -- fixture source
            '        const components = {Row: () => <Row scope={`${testId}.attribute`}/>};',
            // eslint-disable-next-line no-template-curly-in-string -- fixture source
            '        return <div key={field.id} data-testid={`${testId}.attribute:${field.id}`}>{control}{field.open && hint}<Portal>{tip}</Portal><List components={components}/><i data-testid={`${testId}.attribute.error--alert`}/></div>;',
            '    })}</div>;',
            '}',
            'export function AttrsModal() {return <GenericModal data-testid="attrs_modal"><Form fields={[]} testId="attrs_modal.attributes"/></GenericModal>;}',
        ].join('\n'));
        const {report} = scanProject(loadConfig(path.join(root, 'test-surface.config.json')));
        const parts = report.families[report.scopes['attrs_modal.attributes.attribute'].family].parts ?? {};
        assert.equal(parts.error?.portal, undefined, 'written in the row');
        assert.equal(parts.value_choice?.portal, undefined, `assigned to a local rendered in the row: ${JSON.stringify(parts)}`);
        assert.equal(parts.hint?.portal, undefined, 'a const rendered conditionally in the row');
        assert.equal(parts.tip?.portal, true, 'a const rendered inside a portal in the row is still portaled');
        assert.equal(parts.listed?.portal, undefined, 'an inline host name does not turn a passed components object into a portal');
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});

test('a library component\'s portal is decided per channel: compass Combobox menu rows portal, its control and clear button stay inline', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-portal-channels-'));
    try {
        const pkg = path.join(root, 'node_modules/@mattermost/compass-ui');
        fs.mkdirSync(pkg, {recursive: true});
        fs.symlinkSync(path.dirname(path.dirname(createRequire(import.meta.url).resolve('typescript'))), path.join(root, 'node_modules/typescript'), 'dir');
        fs.writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({name: '@mattermost/compass-ui', types: 'index.d.ts'}));
        fs.writeFileSync(path.join(pkg, 'index.d.ts'), [
            'type ComboboxMenuItemProps = {"data-testid"?: string; "aria-label"?: string};',
            'export type ComboboxOption = {value: string; label: string; menuItemProps?: ComboboxMenuItemProps};',
            'export interface ComboboxProps {"data-testid"?: string; options: ComboboxOption[]; menuItemProps?: ComboboxMenuItemProps; clearButtonProps?: {"data-testid"?: string}}',
            'export declare function Combobox(props: ComboboxProps): unknown;',
        ].join('\n'));
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['source.tsx', path.join(FIXTURES, '_lib')]}));
        fs.writeFileSync(path.join(root, 'test-surface.config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], exclude: ['/node_modules/'], output: {report: 'surface.json'}}));
        fs.writeFileSync(path.join(root, 'source.tsx'), [
            "import React from 'react'; import {Combobox, type ComboboxOption} from '@mattermost/compass-ui';",
            'function toOptions(names: string[]): ComboboxOption[] {',
            '    return names.map((name) => {',
            '        const option: ComboboxOption = {value: name, label: name};',
            "        option.menuItemProps = {'data-testid': 'picker.row--option'};",
            '        return option;',
            '    });',
            '}',
            'export function Picker({names}: {names: string[]}) {',
            "    return <section data-testid='picker'><Combobox data-testid='picker.value--combobox' options={toOptions(names)} clearButtonProps={{'data-testid': 'picker.clear--button'}}/>",
            "        <Combobox data-testid='picker.other--combobox' options={[{value: 'a', label: 'a', menuItemProps: {'data-testid': 'picker.literal--option'}}]} menuItemProps={{'data-testid': 'picker.every--option'}}/></section>;",
            '}',
        ].join('\n'));
        const {report} = scanProject(loadConfig(path.join(root, 'test-surface.config.json')));
        const parts = report.families[report.scopes.picker.family].parts ?? {};
        assert.equal(parts.value?.portal, undefined, `the control renders in place: ${JSON.stringify(parts)}`);
        assert.equal(parts.clear?.portal, undefined, 'clearButtonProps render in the control');
        assert.equal(parts.row?.portal, true, 'a row\'s menuItemProps, assigned onto a ComboboxOption, render in the menu');
        assert.equal(parts.literal?.portal, true, 'the same written as an option literal');
        assert.equal(parts.every?.portal, true, 'the Combobox\'s own menuItemProps reach every row');
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});

test('a local rendered both in place and in a portal lands both ways, so the inline/portal collision fires', () => {
    const scan = (body: string) => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-portal-local-paths-'));
        try {
            fs.mkdirSync(path.join(root, 'node_modules'));
            fs.symlinkSync(path.dirname(path.dirname(createRequire(import.meta.url).resolve('typescript'))), path.join(root, 'node_modules/typescript'), 'dir');
            fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['source.tsx']}));
            fs.writeFileSync(path.join(root, 'test-surface.config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], output: {report: 'surface.json'}}));
            fs.writeFileSync(path.join(root, 'source.tsx'), [
                'import {createPortal as placePortal} from \'react-dom\'; function Portal({children}: {children?: unknown}) {return placePortal(children, document.body);}',
                `export function Panel({flag}: {flag: boolean}) {const item = <button data-testid="panel.value--button"/>; return <section data-testid="panel">${body}</section>;}`,
            ].join('\n'));
            const scanned = scanProject(loadConfig(path.join(root, 'test-surface.config.json')));
            return {part: scanned.report.families[scanned.report.scopes.panel.family]?.parts?.value, collision: scanned.diagnostics.find((diagnostic) => diagnostic.rule === 'collisions' && diagnostic.severity === 'error')};
        } finally {
            fs.rmSync(root, {recursive: true, force: true});
        }
    };
    const mixed = scan('{flag ? item : <Portal>{item}</Portal>}');
    assert.ok(mixed.collision?.message.includes('lands both inside its scope'), `the two landings are kept apart: ${JSON.stringify(mixed)}`);
    assert.equal(mixed.part?.portal, undefined, 'never certified portaled');
    const inline = scan('{flag ? item : <i>{item}</i>}');
    assert.equal(inline.collision, undefined, JSON.stringify(inline));
    assert.equal(inline.part?.portal, undefined);
    const portaled = scan('<Portal>{flag ? item : <i>{item}</i>}</Portal>');
    assert.equal(portaled.collision, undefined, JSON.stringify(portaled));
    assert.equal(portaled.part?.portal, true);
});

test('an option a map callback returns resolves its channel by the array it ends up in, so mapped and written rows agree', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-portal-mapped-'));
    try {
        const pkg = path.join(root, 'node_modules/@mattermost/compass-ui');
        fs.mkdirSync(pkg, {recursive: true});
        fs.symlinkSync(path.dirname(path.dirname(createRequire(import.meta.url).resolve('typescript'))), path.join(root, 'node_modules/typescript'), 'dir');
        fs.writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({name: '@mattermost/compass-ui', types: 'index.d.ts'}));
        fs.writeFileSync(path.join(pkg, 'index.d.ts'), [
            'type ComboboxMenuItemProps = {"data-testid"?: string};',
            'export type ComboboxOption = {value: string; label: string; menuItemProps?: ComboboxMenuItemProps};',
            'export interface ComboboxProps {"data-testid"?: string; options: ComboboxOption[]}',
            'export declare function Combobox(props: ComboboxProps): unknown;',
        ].join('\n'));
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['source.tsx', path.join(FIXTURES, '_lib')]}));
        fs.writeFileSync(path.join(root, 'test-surface.config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], exclude: ['/node_modules/'], output: {report: 'surface.json'}}));
        fs.writeFileSync(path.join(root, 'source.tsx'), [
            "import React, {useMemo} from 'react'; import {Combobox, type ComboboxOption} from '@mattermost/compass-ui';",
            'export function Picker({teams, channels}: {teams: Array<{id: "red" | "blue"}>; channels: Array<{id: "first" | "second"}>}) {',
            '    const teamOptions = useMemo<ComboboxOption[]>(() => [',
            // eslint-disable-next-line no-template-curly-in-string -- fixture source
            "        {value: 'all', label: 'all', menuItemProps: {'data-testid': `picker.team_option:${'all'}--option`}},",
            // eslint-disable-next-line no-template-curly-in-string -- fixture source
            "        ...teams.map((team) => ({value: team.id, label: team.id, menuItemProps: {'data-testid': `picker.team_option:${team.id}--option`}})),",
            '    ], [teams]);',
            // eslint-disable-next-line no-template-curly-in-string -- fixture source
            "    const channelOptions = useMemo<ComboboxOption[]>(() => channels.map((channel) => {return {value: channel.id, label: channel.id, menuItemProps: {'data-testid': `picker.channel_option:${channel.id}--option`}};}), [channels]);",
            "    return <section data-testid='picker'><Combobox data-testid='picker.team--combobox' options={teamOptions}/><Combobox data-testid='picker.channel--combobox' options={channelOptions}/></section>;",
            '}',
        ].join('\n'));
        const scanned = scanProject(loadConfig(path.join(root, 'test-surface.config.json')));
        assert.deepEqual(scanned.diagnostics.filter((diagnostic) => diagnostic.rule === 'collisions').map((diagnostic) => diagnostic.message), [], 'the written and the mapped row land the same way');
        const parts = scanned.report.families[scanned.report.scopes.picker.family].parts ?? {};
        assert.equal(parts.team_option?.portal, true, `a mapped row spread into the options renders in the menu: ${JSON.stringify(parts)}`);
        assert.equal(parts.channel_option?.portal, true, 'a row a block-bodied map callback returns too');
        assert.equal(parts.team?.portal, undefined, 'the control stays in place');
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});
