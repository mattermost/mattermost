// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';

import {scanSource, withSource, scanFixture} from './helpers.ts';

/* eslint-disable no-template-curly-in-string -- cases quote template-literal syntax */

/** The diagnostics of a one-file app. */
function scan(lines: string[]) {
    return scanSource({
        'source.tsx': ["import React from 'react';", ...lines].join('\n'),
    }, {include: ['*.tsx']}).diagnostics;
}

/** The duplicate diagnostics of a one-file app. */
const duplicates = (lines: string[]) => scan(lines).filter((d) => d.rule === 'duplicates').map((d) => d.message);

test('duplicates: an earlier if makes a later element exclusive when its element is returned or its arm always leaves', () => {
    assert.deepEqual(duplicates([
        'export function Panel({a}: {a: boolean}) {',
        "    if (a) {return <section data-testid='panel'><i data-testid='panel.mark--text'/></section>;}",
        "    return <section data-testid='panel'><i data-testid='panel.mark--text'/></section>;",
        '}',
    ]).filter((m) => m.includes('panel.mark')), [], 'the arm always returns');
    assert.deepEqual(duplicates([
        'export function Panel({a, b}: {a: boolean; b: boolean}) {',
        "    if (a) {if (b) {return <section data-testid='panel'><i data-testid='panel.mark--text'/></section>;}}",
        "    return <section data-testid='panel'><i data-testid='panel.mark--text'/></section>;",
        '}',
    ]).filter((m) => m.includes('panel.mark')), [], 'the earlier element renders only by returning');
    const callback = duplicates([
        'export function Panel({a}: {a: boolean}) {',
        '    let make = (): React.ReactNode => null;',
        "    if (a) {make = () => {return <i data-testid='panel.mark--text'/>;};}",
        "    return <section data-testid='panel'>{make()}<i data-testid='panel.mark--text'/></section>;",
        '}',
    ]);
    assert.ok(callback.some((m) => m.includes('panel.mark--text')), `a return inside a callback leaves the callback, not the render: ${callback.join('\n')}`);
    const nested = duplicates([
        'export function Panel({a, b}: {a: boolean; b: boolean}) {',
        '    const marks: React.ReactNode[] = [];',
        "    if (a) {marks.push(<i data-testid='panel.mark--text'/>); if (b) {return null;}}",
        "    return <section data-testid='panel'>{marks}<i data-testid='panel.mark--text'/></section>;",
        '}',
    ]);
    assert.ok(nested.some((m) => m.includes('panel.mark--text')), `a return that does not always run leaves both: ${nested.join('\n')}`);
});

test('duplicates: a keyed template filled at run time is compared across sites of one file that render together', () => {
    const together = duplicates([
        'export function Lists({pinned, recent}: {pinned: Array<{id: string}>; recent: Array<{id: string}>}) {',
        "    return <section data-testid='lists'>{pinned.map((c) => <a key={c.id} data-testid={`lists.channel:${c.id}--link`}/>)}{recent.map((c) => <a key={c.id} data-testid={`lists.channel:${c.id}--link`}/>)}</section>;",
        '}',
    ]);
    assert.ok(together.some((m) => m.includes('lists.channel:{key}--link')), `two lists in one scope can render the same key: ${together.join('\n')}`);
    assert.deepEqual(duplicates([
        'export function Lists({mode, items}: {mode: boolean; items: Array<{id: string}>}) {',
        "    return <section data-testid='lists'>{mode ? items.map((c) => <a key={c.id} data-testid={`lists.channel:${c.id}--link`}/>) : items.map((c) => <a key={c.id} data-testid={`lists.channel:${c.id}--link`}/>)}</section>;",
        '}',
    ]), [], 'exclusive arms');
    assert.deepEqual(duplicates([
        'export function Lists({items}: {items: Array<{id: string}>}) {',
        "    return <section data-testid='lists'>{items.map((c) => <a key={c.id} data-testid={`lists.channel:${c.id}--link`}/>)}</section>;",
        '}',
    ]), [], 'one site');
});

test('duplicates: switch clauses are exclusive only when the earlier clause cannot fall through', () => {
    const clauses = (first: string) => duplicates([
        'export function Panel({k}: {k: string}) {',
        '    const items: React.ReactNode[] = [];',
        '    switch (k) {',
        `    case 'a': items.push(<span data-testid='demo.sw.dup--text'/>); ${first}`,
        "    case 'b': items.push(<span data-testid='demo.sw.dup--text'/>); break;",
        '    }',
        "    return <section data-testid='demo.sw'>{items}</section>;",
        '}',
    ]).filter((m) => m.includes('demo.sw.dup'));
    assert.equal(clauses('/* falls through */').length > 0, true, 'a clause that falls through runs together with the next');
    assert.deepEqual(clauses('break;'), []);
});

test('duplicates: an underscore is part of a word, so "undefined" inside one is not the text "undefined"', () => {
    const undef = (name: string) => scan([
        'export function Panel() {',
        `    return <section data-testid='demo.panel'><i data-testid='demo.panel.${name}--text'/></section>;`,
        '}',
    ]).filter((d) => d.rule === 'undefined').length;
    assert.equal(undef('undefined_users'), 0);
    assert.equal(undef('allow_undefined'), 0);
    assert.equal(undef('a.undefined'), 1);
});

test('exclusive outer mounts remain visible past same-file component declarations', () => {
    withSource({
    }, {include: ['*.tsx']}, ({root, scan}) => {
        const cases = [
            ['exclusive', 'function Section(){if(active){return <Max/>;}return <Item active={false} max={null}/>;}', false],
            ['concurrent', 'function Section(){return <><Max/><Item active={false} max={null}/></>;}', true],
            ['forward_ref', 'const Collapsed=React.forwardRef((props:any,ref:any)=><Min/>); function Expanded(){return <Max/>;} function Section(){if(active){return <Expanded/>;}return <Collapsed/>;}', false],
            ['class_helpers', 'class Section extends React.PureComponent{min=()=> <Min/>;max=()=> <Max/>;render(){if(active){return this.max();}return this.min();}}', false],
        ] as const;
        for (const [label, body, concurrent] of cases) {
            fs.writeFileSync(path.join(root, 'source.tsx'), [
                'import React from "react"; declare const active:boolean;',
                'function Min(){return <div data-testid="settings.value--region"/>;} function Max(){return <div data-testid="settings.value--region"/>;}',
                body.includes('<Item') ? 'function Item({active,max}:{active:boolean;max:any}){if(active){return <>{max}</>;}return <Min/>;}' : '',
                body,
                'export function App(){return <Section/>;}',
            ].join('\n'));
            const out = scan();
            assert.equal(out.diagnostics.some((diagnostic) => diagnostic.rule === 'duplicates'), concurrent, label + JSON.stringify(out.diagnostics));
        }
    });
});

test('JSX-valued props are exclusive only at their receiver render positions', () => {
    withSource({
    }, {include: ['source.tsx']}, ({root, scan}) => {
        const cases = [
            ['exclusive', 'if(active){return <>{max}</>;} return <Min testId={testId}/>;', 'return <Item testId="settings.value" max={<Max testId="settings.value"/>}/>;', false],
            ['concurrent', 'return <>{max}<Min testId={testId}/></>;', 'return <Item testId="settings.value" max={<Max testId="settings.value"/>}/>;', true],
            ['two_instances', 'if(active){return <>{max}</>;} return <Min testId={testId}/>;', 'return <><Item testId="settings.value" max={<Max testId="settings.value"/>}/><Item testId="settings.value" max={<Max testId="settings.value"/>}/></>;', true],
            ['also_direct', 'if(active){return <>{max}</>;} return <Min testId={testId}/>;', 'const content=<Max testId="settings.value"/>; return <>{content}<Item testId="settings.value" max={content}/></>;', true],
            ['literal_wrapped', 'if(active){return <>{max}</>;} return <Min testId={testId}/>;', 'return <Item testId="settings.value" max={<Manage/>}/>;', false],
            ['mixed_wrapped', 'if(active){return <>{max}</>;} return <Min testId={testId}/>;', 'return <Item testId="settings.value" max={<Manage/>}/>;', false],
            ['mixed_two_receivers', 'if(active){return <>{max}</>;} return <Min testId={testId}/>;', 'return <><Item testId="settings.value" max={<Manage/>}/><Item testId="settings.value" max={<Manage/>}/></>;', true],
            ['literal_escaped', 'if(active){return <>{max}</>;} return <Min testId={testId}/>;', 'const routes=[{component:Manage}]; renderInner(routes); return <Item testId="settings.value" max={<Manage/>}/>;', true],
            ['literal_shorthand_escape', 'if(active){return <>{max}</>;} return <Min testId={testId}/>;', 'const routes={Manage}; renderInner(routes); return <Item testId="settings.value" max={<Manage/>}/>;', true],
            ['literal_named_escape', 'if(active){return <>{max}</>;} return <Min testId={testId}/>;', 'const routes={component:Manage}; renderInner(routes); return <Item testId="settings.value" max={<Manage/>}/>;', true],
            ['literal_publishing_helper', 'if(active){return <>{max}</>;} return <Min testId={testId}/>;', 'function publish<T>(Component:T):T{renderInner(Component);return Component;} const Alias=publish(Manage); return <Item testId="settings.value" max={<Manage/>}/>;', true],
            ['literal_shorthand_helper', 'if(active){return <>{max}</>;} return <Min testId={testId}/>;', 'function publish<T>(Component:T):T{renderInner({Component});return Component;} const Alias=publish(Manage); return <Item testId="settings.value" max={<Manage/>}/>;', true],
            ['literal_arguments_helper', 'if(active){return <>{max}</>;} return <Min testId={testId}/>;', 'function publish(Component:any){renderInner(arguments[0]);return Component;} const Alias=publish(Manage); return <Item testId="settings.value" max={<Manage/>}/>;', true],
            ['literal_alias_helper', 'if(active){return <>{max}</>;} return <Min testId={testId}/>;', 'function publish(Component:any){const C=Component;renderInner(C);return Component;} const Alias=publish(Manage); return <Item testId="settings.value" max={<Manage/>}/>;', true],
            ['literal_produced_helper', 'if(active){return <>{max}</>;} return <Min testId={testId}/>;', 'function identity(Component:any){return Component;} declare function produce(x:any):any; const publish=produce(identity); const Alias=publish(Manage); return <Item testId="settings.value" max={<Manage/>}/>;', true],
            ['literal_wrapped_let', 'if(active){return <>{max}</>;} return <Min testId={testId}/>;', 'let content=null; if(active){content=<Manage/>;} return <Item testId="settings.value" max={content}/>;', false],
            ['literal_also_direct', 'if(active){return <>{max}</>;} return <Min testId={testId}/>;', 'return <><Manage/><Item testId="settings.value" max={<Manage/>}/></>;', true],
            ['literal_two_receivers', 'if(active){return <>{max}</>;} return <Min testId={testId}/>;', 'return <><Item testId="settings.value" max={<Manage/>}/><Item testId="settings.value" max={<Manage/>}/></>;', true],
            ['wrapped_component', 'if(active){return <>{max}</>;} return <Min testId={testId}/>;', 'return <Item testId="settings.value" max={<Manage/>}/>;', false],
            ['wrapped_also_direct', 'if(active){return <>{max}</>;} return <Min testId={testId}/>;', 'return <><Manage/><Item testId="settings.value" max={<Manage/>}/></>;', true],
            ['wrapped_two_receivers', 'if(active){return <>{max}</>;} return <Min testId={testId}/>;', 'return <><Item testId="settings.value" max={<Manage/>}/><Item testId="settings.value" max={<Manage/>}/></>;', true],
            ['conditional_let', 'if(active){return <>{max}</>;} return <Min testId={testId}/>;', 'let content=null; if(active){content=<Max testId="settings.value"/>;} return <Item testId="settings.value" max={content}/>;', false],
            ['let_also_direct', 'if(active){return <>{max}</>;} return <Min testId={testId}/>;', 'let content=null; if(active){content=<Max testId="settings.value"/>;} return <>{content}<Item testId="settings.value" max={content}/></>;', true],
            ['constant', 'if(active){return <>{max}</>;} return <Min testId={testId}/>;', 'const content=<Max testId="settings.value"/>; return <Item testId="settings.value" max={content}/>;', false],
            ['deferred', 'const render=()=> <>{max}</>; return <>{render()}<Min testId={testId}/></>;', 'return <Item testId="settings.value" max={<Max testId="settings.value"/>}/>;', true],
            ['props_spread', 'PROPS:if(active){return <>{props.max}</>;} return <><Min testId={props.testId}/><Other {...props}/></>;', 'return <Item testId="settings.value" max={<Max testId="settings.value"/>}/>;', true],
            ['rest_spread', 'REST:if(active){return <>{rest.max}</>;} return <><Min testId={testId}/><Other {...rest}/></>;', 'return <Item testId="settings.value" max={<Max testId="settings.value"/>}/>;', true],
            ['computed_read', 'PROPS:if(active){return <>{props.max}</>;} return <><Min testId={props.testId}/>{props[dynamicKey]}</>;', 'return <Item testId="settings.value" max={<Max testId="settings.value"/>}/>;', true],
            ['props_helper', 'PROPS:if(active){return <>{props.max}</>;} return <><Min testId={props.testId}/>{renderInner(props)}</>;', 'return <Item testId="settings.value" max={<Max testId="settings.value"/>}/>;', true],
            ['spread_forward', 'const props={max,testId}; if(active){return <>{max}</>;} return <><Min testId={testId}/><Other {...props}/></>;', 'return <Item testId="settings.value" max={<Max testId="settings.value"/>}/>;', true],
            ['forwarded', 'return <><Other content={max}/><Min testId={testId}/></>;', 'return <Item testId="settings.value" max={<Max testId="settings.value"/>}/>;', true],
        ] as const;
        for (const [label, body, app, duplicate] of cases) {
            let parameter = '{max,testId}';
            if (body.startsWith('PROPS:')) {
                parameter = 'props';
            } else if (body.startsWith('REST:')) {
                parameter = '{testId,...rest}';
            }
            let manage = '';
            if (app.includes('<Manage')) {
                manage = label === 'literal_named_escape' ? 'const Manage=function Inner(){return <Max testId="settings.value"/>;};' : 'function Manage(){return <Max testId="settings.value"/>;}';
            }
            const value = label.startsWith('literal_') ? '"settings.value--region"' : 'testId+"--region"';
            fs.writeFileSync(path.join(root, 'source.tsx'), [
                'import React from "react"; declare const active:boolean; declare const dynamicKey:string; declare function Other(props:any):any; declare function renderInner(props:any):any;',
                `function Max({testId}:{testId:string}){return <section role="region" data-testid={${value}}/>;} function Min({testId}:{testId:string}){return <section role="region" data-testid={${label.startsWith('mixed_') ? '"settings.value--region"' : value}}/>;}`,
                manage,
                `function Item(${parameter}:{max:any;testId:string}){${body.replace(/^(PROPS|REST):/, '')}}`,
                `export function App(){${app}}`,
            ].join('\n'));
            const out = scan();
            assert.equal(out.diagnostics.some((d) => d.rule === 'duplicates'), duplicate, `${label}: ${JSON.stringify(out.diagnostics)}`);
        }
    });
});

test('connected component bindings retain unique mount proofs only while their result does not escape', () => {
    withSource({
        'redux.d.ts': 'declare module "react-redux" {export function connect(a:any,b:any):(c:any)=>any;}',
        'manage.tsx': [
            'import React from "react"; import {connect} from "react-redux";',
            'function Max(){return <div data-testid="settings.value--region"/>;} function Manage(){return <Max/>;}',
            'export default connect(null, {})(Manage);',
        ].join('\n'),
    }, {include: ['*.ts', '*.tsx']}, ({root, scan}) => {
        for (const escaped of [false, true]) {
            fs.writeFileSync(path.join(root, 'source.tsx'), [
                'import React from "react"; import Manage from "./manage"; declare const active:boolean; declare function consume(x:any):void;',
                'function Min(){return <div data-testid="settings.value--region"/>;} function Item({max}:{max:any}){if(active){return <>{max}</>;}return <Min/>;}',
                `export function App(){${escaped ? 'consume([{component:Manage}]);' : ''}return <Item max={<Manage/>}/>;}`,
            ].join('\n'));
            const out = scan();
            assert.equal(out.diagnostics.some((diagnostic) => diagnostic.rule === 'duplicates'), escaped, JSON.stringify(out.diagnostics));
        }
    });
});

test('the second parameter of a named array callback stays a numeric child key', () => {
    const scanned = scanSource({
        'source.tsx': [
            // eslint-disable-next-line no-template-curly-in-string -- fixture source
            'function Chip({testId, testKey}: {testId?: string; testKey?: string | number}) {let chipTestId = "attributeChip"; if (testId) {chipTestId = testKey === undefined ? testId : `${testId}:${testKey}`;} return <span data-testid={chipTestId}><span data-testid={`${testId}.value--text`}/></span>;}',
            'export function Labels({ids}: {ids: string[]}) {const renderChip = (id: string, index: number) => <Chip testId="labels.chip" testKey={index}/>; return <div data-testid="labels">{ids.map(renderChip)}</div>;}',
        ].join('\n'),
    }, {include: ['source.tsx'], config: {checks: {}}});
    const chip = scanned.manifest.elements.find((element) => element.template === 'labels.chip:{key}');
    assert.equal(chip?.key?.kind, 'number');
    assert.deepEqual(scanned.report.families[scanned.report.scopes.labels.family].children?.chip.key, {kind: 'index'});
});

const out = () => scanFixture('callbacks');
const templates = () => out().manifest.elements.map((e) => e.template);

test('callbacks: a render function passed to map by name takes its parameter from the list', () => {
    for (const t of ['callbacks.fixed:{key}--button', 'callbacks.computed:{key}--button']) {
        assert.ok(templates().includes(t), `${t} in\\n${templates().join('\\n')}`);
    }
    assert.deepEqual(out().diagnostics.filter((d) => d.rule === 'unresolved'), []);
});
