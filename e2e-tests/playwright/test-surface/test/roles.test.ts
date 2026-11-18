// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';

import {scanSource, element, scanFixture, withSource, FIXTURES} from './helpers.ts';

import type {JsxTag} from '../src/ast.ts';
import {parseTestId} from '../src/grammar.ts';
import {FamilyParts, packageOf} from '../src/parts.ts';
import {loadProgram} from '../src/program.ts';
import {ProgramIndex} from '../src/program_index.ts';
import {writeReports} from '../src/report.ts';
import {roleRow} from '../src/role_table.ts';
import {Roles} from '../src/roles.ts';
import {DomEmissions} from '../src/scan/emitter.ts';
import {typescript} from '../src/typescript.ts';
import {Resolver} from '../src/values/index.ts';

test('group suffix describes a non-interactive named group and rejects a mismatched role', () => {
    const parsed = parseTestId('settings.section--group');
    assert.ok('role' in parsed);
    assert.equal(parsed.role, 'group');
    assert.deepEqual(roleRow('group'), {driver: 'text', word: 'Group'});
    const out = scanSource({
        'source.tsx': 'import React from \'react\'; export function Panel(){return <><div role="group" aria-label="Settings" data-testid="settings.section--group"/><button data-testid="settings.wrong--group"/></>;}',
    }, {include: ['source.tsx']});
    assert.equal(out.manifest.elements.find((e) => e.template === 'settings.section--group')?.aria.role, 'group');
    const fit = out.diagnostics.filter((d) => d.rule === 'role-fit');
    assert.deepEqual(fit, [], 'group is a text driver on either element');
    assert.equal(out.diagnostics.filter((d) => String(d.rule) === 'aria' && d.message.includes('settings.section')).length, 0);
});

const out = () => scanFixture('library_roles');

test('library roles: styled(LibraryComponent) keeps the component\'s role from the built-in table', () => {
    assert.equal(element(out(), 'roles.panel.save--button').aria.role, 'button');
});

test('library roles: a container whose handlers belong to its built-in controls is not itself a control', () => {
    assert.equal(element(out(), 'roles.panel').aria.role, 'region');
    const errors = out().diagnostics.filter((d) => d.severity === 'error');
    assert.deepEqual(errors.map((d) => `${d.rule}: ${d.message}`), []);
});

test('library roles use canonical exports through swapped aliases, namespaces, const aliases and styled wrappers', () => {
    const out = scanSource({
        'node_modules/@mattermost/compass-ui/package.json': JSON.stringify({name: '@mattermost/compass-ui', version: '1.0.0', types: 'index.d.ts'}),
        'node_modules/@mattermost/compass-ui/index.d.ts': 'declare const InternalButton: (props:any)=>any; export {InternalButton as Button}; export declare const MenuItem: (props:any)=>any;',
        'node_modules/@mattermost/compass-ui/default.d.ts': 'export {Button as default} from "./index";',
        'node_modules/@mattermost/compass-ui/actual.d.ts': 'export declare function Button(props:any): any;',
        'node_modules/@mattermost/compass-ui/named-default.d.ts': 'export {Button as default} from "./actual";',
        'node_modules/@mattermost/compass-ui/actual-private.d.ts': 'export declare function InternalButton(props:any): any;',
        'node_modules/@mattermost/compass-ui/middle-private.d.ts': 'export {InternalButton} from "./actual-private";',
        'node_modules/@mattermost/compass-ui/public.d.ts': 'export {InternalButton as Button} from "./middle-private";',
        'barrel.ts': 'export {MenuItem as Button, Button as MenuItem} from "@mattermost/compass-ui";',
        'source.tsx': [
            'import React from "react"; import {MenuItem as Button, Button as MenuItem} from "@mattermost/compass-ui"; import * as UI from "@mattermost/compass-ui";',
            'import {Button as BarrelItem, MenuItem as BarrelButton} from "./barrel"; import * as Barrel from "./barrel";',
            'import DefaultButton from "@mattermost/compass-ui/default"; import NamedDefault from "@mattermost/compass-ui/named-default";',
            'import {Button as DeepButton} from "@mattermost/compass-ui/public"; import * as Deep from "@mattermost/compass-ui/public";',
            'export function Defaults() {return <><DefaultButton data-testid="view.default--button"/><NamedDefault data-testid="view.named_default--button"/></>;}',
            'const styled = (_component:any) => (_css: TemplateStringsArray) => (_props:any) => null;',
            'const StyledItem = styled(Button)``; const StyledButton = styled(MenuItem)``; const Alias = MenuItem;',
            'const StyledBarrelItem = styled(BarrelItem)``; const BarrelAlias = BarrelButton;',
            'const DeepStyled = styled(DeepButton)``; const DeepAlias = DeepButton; export function DeepButtons() {return <><DeepButton data-testid="view.deep--button"/><Deep.Button data-testid="view.deep_namespace--button"/><DeepStyled data-testid="view.deep_styled--button"/><DeepAlias data-testid="view.deep_alias--button"/></>;}',
            'export function Barrels() {return <><BarrelItem data-testid="view.barrel_item--button"/><BarrelButton data-testid="view.barrel_button--button"/><Barrel.Button data-testid="view.barrel_ns_item--button"/><Barrel.MenuItem data-testid="view.barrel_ns_button--button"/><StyledBarrelItem data-testid="view.barrel_styled--button"/><BarrelAlias data-testid="view.barrel_alias--button"/></>;}',
            'declare const UnknownButton: (props:any)=>any;',
            'export function App() {return <section data-testid="view"><Button data-testid="view.item--button"/><MenuItem data-testid="view.real--button"/><UI.Button data-testid="view.namespace--button"/><StyledItem data-testid="view.styled_item--button"/><StyledButton data-testid="view.styled_button--button"/><Alias data-testid="view.alias--button"/><UnknownButton data-testid="view.unknown--button"/></section>;}',
        ].join('\n'),
    }, {include: ['source.tsx']});
    const role = (name: string) => out.manifest.elements.find((element) => element.name === name)?.aria.role;
    assert.equal(role('item'), null, 'a local Button spelling cannot turn MenuItem into a button');
    for (const name of ['real', 'namespace', 'styled_button', 'alias', 'barrel_button', 'barrel_ns_button', 'barrel_alias', 'default', 'named_default', 'deep', 'deep_namespace', 'deep_styled', 'deep_alias']) {
        assert.equal(role(name), 'button', name);
    }
    assert.equal(role('styled_item'), null);
    assert.equal(role('unknown'), null, 'an unresolved local component gains no role from its name');
    for (const name of ['barrel_item', 'barrel_ns_item', 'barrel_styled']) {
        assert.equal(role(name), null, name);
    }
});

test('input type and conditional testid suffix follow the same row-selection arm', () => {
    withSource({
    }, {include: ['*.tsx'], config: {checks: {strictPaths: ['.']}}, configFile: 'config.json'}, ({root, scan}) => {
        for (const mode of ['correct', 'wrong_suffix', 'negated', 'mutated', 'other_condition']) {
            const wrong = ['wrong_suffix', 'mutated', 'other_condition'].includes(mode);
            let type = 'type={rowSelection==="single"?"radio":"checkbox"}';
            if (mode === 'negated') {
                type = 'type={rowSelection!=="single"?"checkbox":"radio"}';
            } else if (mode === 'other_condition') {
                type = 'type={otherSelection==="single"?"radio":"checkbox"}';
            }
            fs.writeFileSync(path.join(root, 'source.tsx'), [
                'import React from "react"; declare const selection:"single"|"multiple"; declare const otherSelection:"single"|"multiple";',
                // eslint-disable-next-line no-template-curly-in-string -- The fixture preserves the matrix setting template.
                'function Matrix({testIdScope,rowSelection}:{testIdScope?:string;rowSelection:"single"|"multiple"}){return <>{["one"].map(value=>{let cellTestId;if(testIdScope){cellTestId=rowSelection==="single" ? `${testIdScope}.radio_cell:${value}--RADIO` : `${testIdScope}.cell:${value}--checkbox`;}return <input type={rowSelection==="single"?"radio":"checkbox"} data-testid={cellTestId}/>;})}</>;}'.replace('--RADIO', mode === 'wrong_suffix' ? '--checkbox' : '--radio').replace('return <input', mode === 'mutated' ? 'rowSelection="single";return <input' : 'return <input').replace('type={rowSelection==="single"?"radio":"checkbox"}', type),
                'export function App(){return <Matrix testIdScope="app.field" rowSelection={selection}/>;}',
            ].join('\n'));
            const out = scan();
            const failures = out.diagnostics.filter((diagnostic) => diagnostic.rule === 'role-fit');
            assert.equal(failures.length > 0, wrong, mode + JSON.stringify(out.diagnostics));
            assert.ok(out.manifest.elements.some((element) => element.template.endsWith('--checkbox')));
            if (!wrong) {
                assert.ok(out.manifest.elements.some((element) => element.template.endsWith('--radio')));
            }
        }
        for (const same of [true, false]) {
            for (const truthy of [true, false]) {
                fs.writeFileSync(path.join(root, 'source.tsx'), [
                    'import React from "react"; type Mode={kind:"single"|"multiple";enabled:boolean};',
                    `function Field(props:{a:Mode;b:Mode}){return <input type={${truthy ? 'props.a.enabled' : 'props.a.kind==="single"'}?"radio":"checkbox"} data-testid={${truthy ? 'props.' + (same ? 'a' : 'b') + '.enabled' : 'props.' + (same ? 'a' : 'b') + '.kind==="single"'}?"entry.radio--radio":"entry.checkbox--checkbox"}/>;}`,
                    'export function App(){return <Field a={{kind:"single",enabled:true}} b={{kind:"multiple",enabled:false}}/>;}',
                ].join('\n'));
                const out = scan();
                assert.equal(out.diagnostics.some(({rule}) => rule === 'role-fit'), !same);
            }
        }
    });
});

test('text setting input types are narrowed by the suffix arm of the same stable value', () => {
    withSource({
    }, {include: ['*.tsx'], config: {checks: {strictPaths: ['.']}}, configFile: 'config.json'}, ({root, scan}) => {
        for (const mode of ['correct', 'bad_set', 'overridden']) {
            const bad = mode !== 'correct';
            let app = 'export function App(){return <><TextSetting testIdScope="area.text"/><TextSetting testIdScope="area.number" type="number"/><TextSetting testIdScope="area.area" type="textarea"/></>;}';
            if (mode === 'overridden') {
                app = 'export function App(){return <TextSetting testIdScope="area.number" type="number"/>;}';
            } else if (mode === 'bad_set') {
                app = 'export function App(){return <><TextSetting testIdScope="area.bad" type="checkbox"/><TextSetting testIdScope="area.text"/></>;}';
            }
            fs.writeFileSync(path.join(root, 'source.tsx'), [
                'import React from "react";',
                `const INPUT_TYPES = ${mode === 'bad_set' ? '["text","checkbox"]' : '["text","textarea","number","email","tel","url","password"]'} as const;`,
                'type Props={testIdScope?:string;type?:typeof INPUT_TYPES[number]};',
                // eslint-disable-next-line no-template-curly-in-string -- The fixture preserves the text setting template.
                'function TextSetting(props:Props){const {type="text"}=props;let input=null;if(type==="textarea"){input=<textarea data-testid={props.testIdScope ? `${props.testIdScope}.value--textbox` : undefined}/>;}else{const inputType=INPUT_TYPES.includes(type)?type:"text";let testId;if(props.testIdScope){testId=inputType==="number" ? `${props.testIdScope}.number--spinbutton` : `${props.testIdScope}.value--textbox`;}input=<input type={inputType} data-testid={testId}/>;}return input;}'.replace('<input type={inputType}', mode === 'overridden' ? '<input type={inputType} {...{type:"checkbox"}}' : '<input type={inputType}').replace(' : `${props.testIdScope}.value--textbox`;', mode === 'overridden' ? ' : undefined;' : ' : `${props.testIdScope}.value--textbox`;'),
                app,
            ].join('\n'));
            const out = scan();
            const failures = out.diagnostics.filter((diagnostic) => diagnostic.rule === 'role-fit' || diagnostic.rule === 'duplicates');
            assert.equal(failures.length > 0, bad, JSON.stringify(out.diagnostics));
            if (!bad) {
                assert.ok(out.manifest.elements.some((element) => element.template === 'area.number.number--spinbutton'));
                assert.ok(out.manifest.elements.some((element) => element.template === 'area.text.value--textbox'));
            }
        }
    });
});

test('conditional JSX spreads keep role and handlers in the testid arm', () => {
    const cases = [
        ['honest', 'isFailed ? {} : {onClick, onKeyDown:onClick, role:"checkbox",tabIndex:0,"aria-expanded":true}', 'isFailed?undefined:"recaps.header--checkbox"', false],
        ['wrong_arm', 'isFailed ? {} : {onClick, role:"checkbox"}', 'isFailed?"recaps.header--checkbox":undefined', true],
        ['handler_without_role', 'isFailed ? {} : {onClick}', 'isFailed?undefined:"recaps.header"', false],
        ['undefined_role_override', '{role:undefined}', '"recaps.header--checkbox"', true, 'role="checkbox"'],
        ['null_role_override', '{role:null}', '"recaps.header--checkbox"', true, 'role="checkbox"'],
        ['undefined_handler_override', '{onClick:undefined}', '"recaps.header"', false, 'onClick={onClick}'],
        ['omitted_role', '{}', '"recaps.header--checkbox"', false, 'role="checkbox"'],
        ['conditional_present_unconditional_id', 'isFailed?{role:undefined}:{}', '"recaps.header--checkbox"', true, 'role="checkbox" onClick={onClick}'],
        ['conditional_missing', 'isFailed?{}:{role:undefined}', 'isFailed?"recaps.header--checkbox":undefined', false, 'role="checkbox"'],
        ['conditional_undefined', 'isFailed?{}:{role:undefined}', 'isFailed?undefined:"recaps.header--checkbox"', true, 'role="checkbox"'],
        ['undefined_object_spread', 'isFailed?undefined:{count:1}', '"recaps.header--checkbox"', false, 'role="checkbox"'],
        ['empty_arm', 'isFailed ? {} : {onClick, role:"checkbox"}', 'isFailed?undefined:"recaps.header--checkbox"', false],
    ] as const;
    withSource({
    }, {include: ['source.tsx']}, ({root, scan, readConfig}) => {
        for (const [label, spread, id, bad, before = ''] of cases) {
            fs.writeFileSync(path.join(root, 'source.tsx'), `import React from "react"; declare const isFailed:boolean; const onClick=()=>{}; export function App(){const headerProps=${spread};return <div ${before} data-testid={${id}} {...headerProps}/>;}`);
            const out = scan();
            const issues = out.diagnostics.filter((d) => d.rule === 'role-fit');
            assert.equal(issues.length > 0, bad, `${label}: ${JSON.stringify(issues)}`);
        }

        // An incomplete role summary must retain the testid for ordinary checks instead of erasing the site.
        fs.writeFileSync(path.join(root, 'source.tsx'), 'import React from "react"; export function App(){return <div data-testid="recaps.header--checkbox"/>;}');
        const loaded = readConfig();
        const ix = new ProgramIndex(loadProgram(loaded), loaded);
        const R = new Resolver(ix);
        const resolveAttributes = R.attributeValues.bind(R);
        R.attributeValues = (tag, name) => (name === 'role' ? [] : resolveAttributes(tag, name));
        let tag: JsxTag | undefined;
        const visit = (node: import('typescript').Node) => {
            if (typescript.isJsxSelfClosingElement(node)) {
                tag = node;
            }
            typescript.forEachChild(node, visit);
        };
        visit(ix.program.getSourceFile(path.join(root, 'source.tsx'))!);
        assert.ok(tag);
        const emitter = new DomEmissions({ix, R, roles: new Roles(ix, R), usageByLoc: new Map(), diag: () => {}});
        const emissions = emitter.emissions([{kind: 'dom', node: tag, at: ix.where(tag), tag, expr: undefined, owner: null, ownerName: 'App', values: [{k: 'lit', s: 'recaps.header--checkbox'}]}]);
        assert.equal(emissions.length, 1);
        assert.equal(emissions[0].template, 'recaps.header--checkbox');
        assert.equal(emissions[0].landing.aria.role, null);
    });
});

test('only a declared unreadable role produces a state-driver warning; untyped prop getters keep the native role', () => {
    withSource({
        'source.tsx': [
            'import React from "react";',
            'declare function getReferenceProps():Record<string,unknown>; declare function typedProps():{role?:string};',
            'declare const flag:boolean; declare const unknownRole:string;',
            'export function App(){return <>',
            '<div role={flag ? "button" : unknownRole} data-testid="spread.mixed--checkbox"/>',
            '<div role={flag ? "checkbox" : unknownRole} data-testid="spread.valid_mixed--checkbox"/>',
            '<input data-testid="spread.native--textbox" {...getReferenceProps()}/>',
            '<input data-testid="spread.unknown--textbox" {...typedProps()}/>',
            '<button data-testid="spread.click--button" {...typedProps()}/>',
            '<input role="textbox" data-testid="spread.cleared--textbox" {...{role:undefined}}/>',
            '</>;}',
        ].join('\n'),
    }, {include: ['source.tsx'], config: {checks: {strictPaths: ['.']}}, configFile: 'config.json'}, ({root, configPath, scan, readConfig}) => {
        const out = scan();
        assert.deepEqual([...new Set(out.diagnostics.filter((diagnostic) => diagnostic.rule === 'role-fit').map((diagnostic) => diagnostic.template))], ['spread.mixed--checkbox']);
        const unresolved = out.diagnostics.filter((diagnostic) => diagnostic.rule === 'unresolved');
        assert.deepEqual([...new Set(unresolved.map((diagnostic) => diagnostic.template))].sort(), ['spread.mixed--checkbox', 'spread.unknown--textbox', 'spread.valid_mixed--checkbox']);
        assert.equal(unresolved.filter((diagnostic) => diagnostic.template === 'spread.unknown--textbox').length, 1, JSON.stringify(out.diagnostics));
        assert.ok(unresolved.every((diagnostic) => diagnostic.severity === 'warning'));
        assert.equal(unresolved[0].severity, 'warning');
        assert.equal(out.manifest.elements.find((element) => element.template === 'spread.native--textbox')?.aria.role, 'textbox');
        assert.equal(out.manifest.elements.find((element) => element.template === 'spread.cleared--textbox')?.aria.role, 'textbox');
        fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({name: 'unreadable-role-parts', version: '1.0.0'}));
        // eslint-disable-next-line no-template-curly-in-string -- The library fixture declares a runtime testid.
        fs.writeFileSync(path.join(root, 'library.tsx'), 'import React from "react"; declare function typedProps():{role?:string}; export function Field({testId}:{testId?:string}){return <input {...typedProps()} data-testid={testId ? `${testId}--textbox` : undefined}/>;}');
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['*.tsx', path.join(FIXTURES, '_lib')]}));
        fs.writeFileSync(configPath, JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], library: {entry: 'library.tsx'}, output: {report: 'surface.json'}}));
        const config = readConfig();
        const ix = new ProgramIndex(loadProgram(config), config);
        const R = new Resolver(ix);
        const parts = new FamilyParts(ix, R, new Roles(ix, R), config.library!);
        parts.build(config.library!.entry, packageOf(config));
        assert.equal(parts.diagnostics.length, 1);
        assert.equal(parts.diagnostics[0].rule, 'unresolved');
        assert.equal(parts.diagnostics[0].severity, 'warning');
        // eslint-disable-next-line no-template-curly-in-string -- The library fixture declares a runtime testid.
        fs.writeFileSync(path.join(root, 'library.tsx'), 'import React from "react"; declare const flag:boolean; declare const unknownRole:string; export function Field({testId}:{testId?:string}){return <div role={flag ? "button" : unknownRole} data-testid={testId ? `${testId}--checkbox` : undefined}/>;}');
        const mixedIndex = new ProgramIndex(loadProgram(config), config);
        const mixedResolver = new Resolver(mixedIndex);
        const mixedParts = new FamilyParts(mixedIndex, mixedResolver, new Roles(mixedIndex, mixedResolver), config.library!);
        mixedParts.build(config.library!.entry, packageOf(config));
        assert.ok(mixedParts.diagnostics.some((diagnostic) => diagnostic.rule === 'parts' && diagnostic.severity === 'error'));
        assert.ok(mixedParts.diagnostics.some((diagnostic) => diagnostic.rule === 'unresolved' && diagnostic.severity === 'warning'));
    });
});

test('entry drivers fit native typing capability rather than a combobox ARIA role', () => {
    const out = scanSource({
        'source.tsx': [
            'import React from "react"; declare const dynamicType:string; declare const finiteType:"text"|"number"; declare const wrongFiniteType:"text"|"checkbox"; declare const flag:boolean; export function App(){return <>',
            '<input role="combobox" data-testid="entry.input--textbox"/>',
            '<input type="number" data-testid="entry.numeric_text--textbox"/>',
            '<input type={finiteType} data-testid="entry.finite_text--textbox"/>',
            '<input type={wrongFiniteType} data-testid="entry.bad_finite--textbox"/>',
            '{flag ? <textarea data-testid="entry.numeric_choice--textbox"/> : <input type="number" data-testid="entry.numeric_choice--textbox"/>}',
            '<input type="date" role="combobox" data-testid="entry.date--textbox"/>',
            '<input type="time" role="combobox" data-testid="entry.time--searchbox"/>',
            '<input type="datetime-local" data-testid="entry.datetime--textbox"/>',
            '<input type="month" data-testid="entry.month--textbox"/>',
            '<input type="week" data-testid="entry.week--textbox"/>',
            '<input type="range" role="combobox" data-testid="entry.bad_range--textbox"/>',
            '<input type="color" role="combobox" data-testid="entry.bad_color--textbox"/>',
            '<textarea role="combobox" data-testid="entry.area--textbox"/>',
            '<input type="search" role="combobox" data-testid="entry.search--searchbox"/>',
            '<div contentEditable role="combobox" data-testid="entry.editable--textbox"/>',
            '<input type="number" role="combobox" data-testid="entry.number--spinbutton"/>',
            '<div role="combobox" data-testid="entry.bad_div--textbox"/>',
            '<button role="combobox" data-testid="entry.bad_button--textbox"/>',
            '<input type="checkbox" role="combobox" data-testid="entry.bad_checkbox--textbox"/>',
            '<input type={dynamicType} role="combobox" data-testid="entry.bad_dynamic--textbox"/>',
            '{flag ? <input role="combobox" data-testid="entry.choice--textbox"/> : <input role="textbox" data-testid="entry.choice--textbox"/>}',
            '<div contentEditable={false} role="textbox" data-testid="entry.bad_readonly--textbox"/>',
            '</>;}'].join('\n'),
    }, {include: ['*.tsx'], config: {checks: {strictPaths: ['.']}}, configFile: 'config.json'});
    assert.equal(out.diagnostics.some((diagnostic) => diagnostic.rule === 'duplicates'), false, JSON.stringify(out.diagnostics));
    const bad = out.diagnostics.filter((diagnostic) => diagnostic.rule === 'role-fit').map((diagnostic) => diagnostic.template).sort();
    assert.deepEqual(bad, ['entry.bad_button--textbox', 'entry.bad_checkbox--textbox', 'entry.bad_color--textbox', 'entry.bad_div--textbox', 'entry.bad_dynamic--textbox', 'entry.bad_finite--textbox', 'entry.bad_range--textbox', 'entry.bad_readonly--textbox']);
});

test('a bare-word testid on a landmark (role banner) is its scope\'s container, and holds what it renders', () => {
    const scanned = scanSource({
        'source.tsx': [
            "import React from 'react';",
            "function Markdown({text}: {text: string}) {return <span data-testid='markdown.link--link'>{text}</span>;}",
            'export function Header({text}: {text: string}) {',
            "    return <div data-testid='header' role='banner' aria-label='header'><div data-testid='header.description'><Markdown text={text}/></div></div>;",
            '}',
            "export function Toolbar() {return <div data-testid='toolbar' role='button'><Markdown text='x'/></div>;}",
        ].join('\n'),
    }, {include: ['source.tsx']});
    const family = scanned.report.families[scanned.report.scopes.header.family];
    assert.deepEqual(family.container, {role: null}, JSON.stringify(family));
    assert.deepEqual(family.renders, ['markdown'], JSON.stringify(family));
    const unscoped = scanned.diagnostics.filter((diagnostic) => diagnostic.rule === 'unscoped').map((diagnostic) => diagnostic.message);
    assert.deepEqual(unscoped, ['"toolbar" has no declared parts or children.'], 'a plain container can be operated; only its missing members are listed');
});

const stateKinds = ['checkbox', 'switch', 'radio', 'togglebutton', 'menuitemcheckbox', 'menuitemradio', 'tab', 'option', 'combobox', 'listbox', 'radiogroup', 'textbox', 'searchbox', 'spinbutton'];
const plainKinds = ['button', 'link', 'menuitem', 'text', 'region', 'group', 'row', 'dialog', 'alertdialog', 'menu', 'tooltip', 'alert', 'status', 'img', 'list', 'listitem', 'grid', 'gridcell', 'tablist', 'tabpanel', 'separator', 'slider'];

test('strict driver checks require only readable state/input roles and omit unreachable source checks', () => {
    withSource({
        'package.json': JSON.stringify({name: 'driver-fixture', version: '1.0.0'}),
        'source.tsx': [
            'import React from "react"; export function App(){return <>',
            ...stateKinds.map((kind) => `<div data-testid="driver.bad_${kind}--${kind}"/><div ${['textbox', 'searchbox', 'spinbutton'].includes(kind) ? 'contentEditable' : ''} role="${kind}" data-testid="driver.good_${kind}--${kind}"/>`),
            ...plainKinds.map((kind) => `<span role="unknown_role" onClick={()=>{}} data-testid="driver.plain_${kind}--${kind}"/>`),
            '<button data-testid="plain_container"><span data-testid="plain_container.child--text"/></button></>;}',
        ].join('\n'),
        'orphan.tsx': 'import React from "react"; declare const missing:string|undefined; export function Orphan(){return <><div data-testid="Wrong-ID"/><input data-testid={missing+".value--checkbox"}/></>;}',
    }, {include: ['*.tsx'], config: {entries: ['source.tsx'], checks: {strictPaths: ['.']}}, configFile: 'config.json'}, ({root, configPath, scan, readConfig}) => {
        const out = scan();
        const failures = out.diagnostics.filter((diagnostic) => diagnostic.rule === 'role-fit');
        assert.equal(failures.length, stateKinds.length, JSON.stringify(out.diagnostics));
        assert.ok(failures.every((diagnostic) => diagnostic.template?.startsWith('driver.bad_')));
        assert.ok(!out.diagnostics.some((diagnostic) => String(diagnostic.rule) === 'aria'));
        assert.ok(!out.diagnostics.some((diagnostic) => diagnostic.at.startsWith('orphan.tsx')));
        assert.deepEqual(out.result.notReachableFiles, ['orphan.tsx']);
        writeReports(path.join(root, 'reports'), out.result, out.diagnostics);
        const excluded = fs.readFileSync(path.join(root, 'reports/not_reachable.txt'), 'utf8');
        assert.equal(excluded.split('orphan.tsx').length - 1, 1);
        assert.match(excluded, /not reachable from the configured entries/);

        // eslint-disable-next-line no-template-curly-in-string -- The fixture declares runtime template expressions.
        fs.writeFileSync(path.join(root, 'library.tsx'), 'import React from "react"; export function Click({testId}:{testId?:string}){return <div data-testid={testId?`${testId}--button`:undefined}/>;} export function BadState({testId}:{testId?:string}){return <div data-testid={testId?`${testId}--checkbox`:undefined}/>;} export function GoodState({testId}:{testId?:string}){return <input type="checkbox" data-testid={testId?`${testId}--checkbox`:undefined}/>;}');
        fs.writeFileSync(configPath, JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], library: {entry: 'library.tsx'}, output: {report: 'surface.json'}}));
        const config = readConfig();
        const ix = new ProgramIndex(loadProgram(config), config);
        const R = new Resolver(ix);
        const parts = new FamilyParts(ix, R, new Roles(ix, R), config.library!);
        parts.build(config.library!.entry, packageOf(config));
        assert.equal(parts.diagnostics.length, 1, JSON.stringify(parts.diagnostics));
        assert.match(parts.diagnostics[0].message, /checkbox/);
    });
});
