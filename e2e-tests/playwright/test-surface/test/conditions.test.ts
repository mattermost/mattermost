// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';

import {withSource, scanSource} from './helpers.ts';

import {concat, isTruncated, lit, isTruthy} from '../src/values/algebra.ts';

test('object and DOM sites keep enclosing guards through casts without hiding unsafe or mutated reads', () => {
    withSource({
    }, {include: ['source.tsx']}, ({root, scan}) => {
        const cases = [
            ['object', 'return <Popover slotProps={{paper:scope ? {"data-testid":scope+".paper"} : undefined}}/>;', false],
            ['as', 'return <Popover slotProps={{paper:scope ? ({"data-testid":scope+".paper"} as Record<string,string>) : undefined}}/>;', false],
            ['satisfies', 'return <Popover slotProps={{paper:scope ? (({"data-testid":scope+".paper"} satisfies Record<string,string>)!) : undefined}}/>;', false],
            ['unguarded_as', 'return <Popover slotProps={{paper:({"data-testid":scope+".paper"} as Record<string,string>)}}/>;', true],
            ['statement', 'let name; if(flag) {name=scope;} if(name) {return <span data-testid={name+".error--text"}/>;} return null;', false],
            ['expression', 'let name; if(flag) {name=scope;} return <span data-testid={name ? name+".error--text" : undefined}/>;', false],
            ['unguarded', 'let name; if(flag) {name=scope;} return <span data-testid={name+".error--text"}/>;', true],
            ['unrelated_guard', 'let name; if(flag) {name=scope;} if(flag) {return <span data-testid={name+".error--text"}/>;} return null;', true],
            ['write_between', 'let name=scope; if(name) {name=undefined; return <span data-testid={name+".error--text"}/>;} return null;', true],
            ['destructured_write', 'let name=scope; if(name) {({name}={name:undefined}); return <span data-testid={name+".error--text"}/>;} return null;', true],
            ['writer_closure', 'let name=scope; function clear(){name=undefined;} if(name) {clear(); return <span data-testid={name+".error--text"}/>;} return null;', true],
            ['deferred_read', 'let name=scope; let Deferred; if(name) {Deferred=()=> <span data-testid={name+".error--text"}/>;} name=undefined; return Deferred ? <Deferred/> : null;', true],
            ['loop_write_after', 'let name=scope; const out=[]; if(name) {for(const i of [1,2]) {out.push(<span data-testid={name+".error--text"}/>); name=undefined;}} return <>{out}</>;', true],
            ['while_write_after', 'let name=scope; const out=[]; if(name) {while(flag) {out.push(<span data-testid={name+".error--text"}/>); name=undefined;}} return <>{out}</>;', true],
            ['idle_callback', 'const props={scope}; return <Popover onClose={()=>console.log("x")} slotProps={{paper:props.scope ? {"data-testid":props.scope+".paper"} : undefined}}/>;', false],
            ['write_after', 'let name=scope; if(name) {const result=<span data-testid={name+".error--text"}/>; name=undefined; return result;} return null;', false],
            ['unrelated_write', 'let name; if(flag) {name=scope;} if(name) {let other; other=undefined; return <span data-testid={name+".error--text"}/>;} return null;', false],
        ] as const;
        for (const [label, body, unsafe] of cases) {
            fs.writeFileSync(path.join(root, 'source.tsx'), [
                'import React from "react"; declare const flag:boolean; declare function Popover(props:any):any;',
                `function Panel({scope}:{scope?:string}) {${body}}`,
                'export function App(){return <><Panel scope="one"/><Panel/></>;}',
            ].join('\n'));
            const out = scan();
            assert.equal(out.diagnostics.some((diagnostic) => diagnostic.rule === 'undefined'), unsafe, `${label}: ${JSON.stringify(out.diagnostics)}`);
            if (!unsafe) {
                assert.ok(out.manifest.elements.some((element) => element.template === 'one.paper' || element.template === 'one.error--text'), `${label}: a valid mount still emits`);
            }
        }
    });
});

test('optional scopes remain absent in guarded helper objects and select-part closures', () => {
    withSource({
        'source.tsx': [
            'import React from "react";',
            'function paperProps(menuTestId?: string): Record<string, string> {return menuTestId ? {"data-testid": menuTestId + ".paper"} : {};}',
            'function parts(testId?: string) {const Control = () => <button {...{"data-testid": testId ? testId + ".control--button" : undefined}}/>; return <Control/>;}',
            'function Panel({testIdScope}: {testIdScope?: string}) {return <section data-testid={testIdScope}><div {...paperProps(testIdScope)}/>{parts(testIdScope)}</section>;}',
            'export function App() {return <><Panel testIdScope="one"/><Panel/></>;}',
        ].join('\n'),
    }, {include: ['source.tsx']}, ({root, scan}) => {
        const out = scan();
        assert.ok(out.manifest.elements.some((element) => element.template === 'one.paper'));
        assert.ok(out.manifest.elements.some((element) => element.template === 'one.control--button'));
        assert.deepEqual(out.diagnostics.filter((diagnostic) => diagnostic.rule === 'undefined'), []);
        assert.ok(!out.manifest.elements.some((element) => element.template.includes('undefined')));
        fs.appendFileSync(path.join(root, 'source.tsx'), '\nfunction unsafe(scope?: string) {return <span data-testid={scope + ".unsafe--text"}/>;} export const missing = unsafe(undefined);');
        const unguarded = scan();
        const warnings = unguarded.diagnostics.filter((diagnostic) => diagnostic.rule === 'undefined');
        assert.equal(warnings.length, 1, 'an absent helper argument still fails when it is actually interpolated');
        assert.ok(warnings[0].at.startsWith('source.tsx:6:'));
    });
});

test('guarded input message metadata omits absent scopes before interpolating', () => {
    withSource({
    }, {include: ['*.tsx']}, ({root, scan}) => {
        for (const mode of ['inline', 'statement', 'unguarded']) {
            const guarded = mode !== 'unguarded';
            // eslint-disable-next-line no-template-curly-in-string -- The fixture keeps the input metadata expression.
            const message = guarded ? 'testId ? `${testId}.${messageKind}` : undefined' : '`${testId}.${messageKind}`';
            fs.writeFileSync(path.join(root, 'source.tsx'), [
                'import React from "react"; declare const flag:boolean;',
                // eslint-disable-next-line no-template-curly-in-string -- Keep the guarded assignment in the fixture.
                `function Input({testId,error,warning}:{testId?:string;error?:boolean;warning?:boolean}){const messageKind=error||warning ? "validation--alert" : "message--text";${mode === 'statement' ? 'let messageTestId; if(testId){messageTestId=error||warning ? `${testId}.validation--alert` : `${testId}.message--text`;}' : 'const messageTestId=' + message + ';'}return <div role={error||warning ? "alert" : undefined} data-testid={messageTestId}/>;}`,
                'function Forward({testId}:{testId?:string}){return <Input testId={testId} error={flag}/>;} function Spread({label,...otherProps}:{label?:string;testId?:string}){return <Input {...otherProps} error={flag}/>;}',
                `export function App(){return <>${Array.from({length: 140}, (_, i) => '<Input testId="field_' + i + '.input" error={flag}/>').join('')}<Input error={flag}/><Forward/><Spread/></>;}`,
            ].join('\n'));
            const out = scan();
            assert.equal(out.diagnostics.some((diagnostic) => diagnostic.rule === 'undefined' || diagnostic.rule === 'unresolved' || diagnostic.rule === 'truncated'), !guarded, JSON.stringify(out.diagnostics.map(({rule}) => rule)));
            for (const scope of Array.from({length: 140}, (_, i) => 'field_' + i + '.input')) {
                assert.ok(out.manifest.elements.some((element) => element.template === scope + '.validation--alert'));
                assert.ok(out.manifest.elements.some((element) => element.template === scope + '.message--text'));
            }
        }
    });
});

test('template budgets distinguish independent mounts from a genuine per-mount product', () => {
    const separate = Array.from({length: 300}, (_, index) => lit('scope_' + index, ['mount_' + index]));
    assert.equal(concat(separate, [lit('.message'), lit('.validation')]).some(isTruncated), false);
    const many = Array.from({length: 8193}, (_, index) => lit('scope_' + index, ['mount_' + index]));
    assert.equal(concat(many, [lit('.message')]).some(isTruncated), true);
    const left = Array.from({length: 17}, (_, index) => lit('left_' + index, ['one_mount']));
    const right = Array.from({length: 17}, (_, index) => lit('.right_' + index, ['one_mount']));
    assert.equal(concat(left, right).some(isTruncated), true);
});

test('a const guard derived from a prop comparison excludes only that mount', () => {
    const out = scanSource({
        'constants.ts': 'export const Locations={MODAL:"modal",CENTER:"center"} as const;',
        'source.tsx': [
            'import React from "react"; import {Locations} from "./constants";',
            'function Menu({scope}:{scope:string}){return <button role="menuitem" data-testid={scope+".item--menuitem"}/>;}',
            'function Post({location,scope}:{location:string;scope:string}){const isModal=location===Locations.MODAL;console.log("unrelated render work");return !isModal && <Menu scope={scope}/>;}',
            'export function App(){return <><Post location="modal" scope="modal"/><Post location="center" scope="feed"/></>;}',
        ].join('\n'),
    }, {include: ['source.tsx', 'constants.ts']});
    assert.ok(out.manifest.elements.some((element) => element.template === 'feed.item--menuitem'));
    assert.ok(!out.manifest.elements.some((element) => element.template === 'modal.item--menuitem'));
});

test('primitive kinds survive aliases, logical operators and guarded component mounts', () => {
    const cases = [
        ['string_false', '"false"', true, 'false'], ['string_zero', '"0"', true, '0'],
        ['string_null', '"null"', true, 'null'], ['string_undefined', '"undefined"', true, 'undefined'],
        ['empty', '""', false, ''], ['boolean_false', 'false', false, 'false'], ['boolean_true', 'true', true, 'true'],
        ['zero', '0', false, '0'], ['negative_zero', '-0', false, '0'], ['number', '2', true, '2'],
        ['null_value', 'null', false, 'fallback'], ['undefined_value', 'undefined', false, 'fallback'],
    ] as const;
    const source = [
        'import React from "react";',
        'function Guard({testId,value}:{testId:string;value:unknown}) {return value ? <button data-testid={testId+".on--button"}/> : <button data-testid={testId+".off--button"}/>;}',
        ...cases.map(([name, expression]) => `export function Case_${name}() {const input = ${expression}; const alias = input; return <section data-testid="${name}"><span data-testid={"${name}.ternary_" + (alias ? "yes" : "no") + "--text"}/><span data-testid={"${name}.and_" + ((alias && "yes") || "no") + "--text"}/><span data-testid={"${name}.or_" + (alias || "fallback") + "--text"}/><span data-testid={"${name}.nullish_" + (alias ?? "fallback") + "--text"}/><Guard testId="${name}.guard" value={alias}/></section>;}`),
        'declare const runtime: boolean; export function Unknown() {return <span data-testid={runtime ? "unknown.yes--text" : "unknown.no--text"}/>;}',
        'export function Arithmetic() {const zero=0+0; const nonzero=1+1; const text="0"+0; return <><span data-testid={zero ? "math.zero_yes--text" : "math.zero_no--text"}/><span data-testid={nonzero ? "math.nonzero_yes--text" : "math.nonzero_no--text"}/><span data-testid={text ? "math.text_yes--text" : "math.text_no--text"}/></>;}',
        'export function Mixed() {const value=runtime?0:""; const sum=value+0; return <span data-testid={sum ? "math.mixed_yes--text" : "math.mixed_no--text"}/>;}',
    ].join('\n');
    const out = scanSource({
        'source.tsx': source,
    }, {include: ['source.tsx']});
    const templates = new Set(out.manifest.elements.map((element) => element.template));
    for (const [name, , truthy, rendered] of cases) {
        const key = rendered;
        for (const template of [
            `${name}.ternary_${truthy ? 'yes' : 'no'}--text`,
            `${name}.and_${truthy ? 'yes' : 'no'}--text`,
            `${name}.or_${truthy ? key : 'fallback'}--text`,
            `${name}.nullish_${key}--text`,
            `${name}.guard.${truthy ? 'on' : 'off'}--button`,
        ]) {
            assert.ok(templates.has(template), `missing ${template}: ${[...templates].join(', ')}`);
        }
        assert.ok(!templates.has(`${name}.ternary_${truthy ? 'no' : 'yes'}--text`));
        assert.ok(!templates.has(`${name}.guard.${truthy ? 'off' : 'on'}--button`));
    }
    assert.ok(templates.has('unknown.yes--text'));
    assert.ok(templates.has('unknown.no--text'));
    for (const template of ['math.zero_no--text', 'math.nonzero_yes--text', 'math.text_yes--text', 'math.mixed_yes--text', 'math.mixed_no--text']) {
        assert.ok(templates.has(template), template);
    }
    for (const template of ['math.zero_yes--text', 'math.nonzero_no--text', 'math.text_no--text']) {
        assert.ok(!templates.has(template), template);
    }
});

test('strict null guards retain undefined and strict undefined guards retain null', () => {
    withSource({
    }, {include: ['source.tsx'], config: {checks: {strictPaths: ['source.tsx']}}, configFile: 'config.json'}, ({root, scan}) => {
        for (const [guard, prop, missing] of [
            ['value !== null', '', true], ['value !== undefined', 'value={null}', true],
            ['value !== null', 'value={null}', false], ['value !== undefined', '', false],
            ['value != null', '', false], ['value != null', 'value={null}', false],
            ['value !== undefined', 'value="present"', false],
        ] as const) {
            fs.writeFileSync(path.join(root, 'source.tsx'), [
                'import React from "react";',
                `function Field({value}:{value?:string|null}) {return <span data-testid={${guard} ? \`view.entry:\${value}--text\` : undefined}/>;}`,
                `export function App() {return <Field ${prop}/>;}`,
            ].join('\n'));
            const out = scan();
            assert.equal(out.diagnostics.some((diagnostic) => diagnostic.rule === 'undefined'), missing, `${guard}, ${prop}: ${JSON.stringify(out.diagnostics)}`);
        }
    });
});

test('unreadable gap types prove no truthiness while nonempty text remains truthy', () => {
    for (const type of ['?', '', ' ', 'unknown', 'any', 'boolean']) {
        const gap = {gap: {kind: 'string' as const, type, expr: 'value'}};
        assert.equal(isTruthy({k: 'pat', parts: [gap]}), false, type);
        assert.equal(isTruthy({k: 'pat', parts: ['prefix', gap]}), true, type);
    }
    assert.equal(isTruthy({k: 'pat', parts: [{gap: {kind: 'string', type: '{active: boolean}', expr: 'object'}}]}), false, 'a conservative type summary may leave object truthiness unproven');
});

test('unknown tuple state keeps loading and ready parts; known objects still prune the impossible branch', () => {
    const out = scanSource({
        'source.tsx': [
            'import React,{useState} from "react";',
            'class List extends React.Component<{testId:string;loading:unknown;custom:unknown}> {render(){let result;if(this.props.loading){result=<span data-testid={this.props.testId+".loading--text"}/>;}else{result=<div data-testid={this.props.testId}><span data-testid={this.props.testId+".selection--text"}/>{this.props.custom ? null : <span data-testid={this.props.testId+".no_results--text"}/>}</div>;}return <div data-testid={this.props.testId+".live_region"}>{result}</div>;}}',
            'declare const feature:boolean; declare function readObject():{active:boolean};',
            'export function App(){const [loading,setLoading]=useState(true); const object=readObject(); return <><List testId="tuple.results" loading={loading} custom={feature ? <div/> : null}/><List testId="object.results" loading={object} custom={null}/><List testId="false.results" loading={false} custom={null}/></>;}',
        ].join('\n'),
    }, {include: ['source.tsx']});
    const templates = new Set(out.manifest.elements.map((element) => element.template));
    for (const template of ['tuple.results', 'tuple.results.selection--text', 'tuple.results.no_results--text', 'tuple.results.loading--text', 'tuple.results.live_region', 'object.results.loading--text', 'object.results.live_region', 'false.results.selection--text']) {
        assert.ok(templates.has(template), `missing ${template}: ${[...templates].join(', ')}`);
    }
    for (const template of ['object.results', 'object.results.selection--text', 'object.results.no_results--text', 'false.results.loading--text']) {
        assert.ok(!templates.has(template), template);
    }
});

test('conditional intrinsic tags retain per-arm roles, handlers and per-mount defaults', () => {
    withSource({
    }, {include: ['source.tsx']}, ({root, scan}) => {
        const cases = [
            ['honest', 'const Tag=onClick ? "button" : "span"; return <Tag onClick={onClick} data-testid={testId}/>;', 'return <Panel testId="tags.item"/>;', false],
            ['both_honest', 'const Tag=onClick ? "button" : "span"; return <Tag onClick={onClick} data-testid={onClick?testId+"--button":testId+"--text"}/>;', 'return <Panel testId="tags.item" onClick={flag?()=>{}:undefined}/>;', false],
            ['conditional_role', 'const Tag=onClick ? "button" : "span"; return <Tag role={onClick?"button":undefined} onClick={onClick} data-testid={onClick?testId+"--button":testId+"--text"}/>;', 'return <Panel testId="tags.item" onClick={flag?()=>{}:undefined}/>;', false],
            ['wrong', 'const Tag=onClick ? "div" : "span"; return <Tag onClick={onClick} data-testid={testId}/>;', 'return <Panel testId="tags.item" onClick={()=>{}}/>;', false],
            ['default_override', 'const Tag=as ?? "span"; return <Tag data-testid={testId}/>;', 'return <Panel as="button" testId="tags.item--button"/>;', false],
            ['default', 'const Tag=as ?? "span"; return <Tag data-testid={testId}/>;', 'return <Panel testId="tags.item--text"/>;', false],
            ['unreachable', 'return text ? <div onClick={()=>{}} data-testid={testId}/> : <img data-testid={testId}/>;', 'return <Panel testId="tags.item--img"/>;', false],
            ['reachable', 'return text ? <div onClick={()=>{}} data-testid={testId}/> : <img data-testid={testId}/>;', 'return <Panel testId="tags.item--img" text="yes"/>;', false],
            ['changed_handler', 'const Tag=onClick ? "button" : "span"; onClick=()=>{}; return <Tag onClick={onClick} data-testid={testId}/>;', 'return <Panel testId="tags.item--text"/>;', false],
            ['wrong_state', 'const Tag=as ?? "span"; return <Tag data-testid={testId}/>;', 'return <Panel as="button" testId="tags.item--checkbox"/>;', true],
            ['unknown_state', 'const Tag=unknownTag; return <Tag data-testid={testId}/>;', 'return <Panel testId="tags.item--checkbox"/>;', true],
            ['unknown', 'const Tag=unknownTag; return <Tag data-testid={testId}/>;', 'return <Panel testId="tags.item--button"/>;', false],
        ] as const;
        for (const [label, body, app, bad] of cases) {
            fs.writeFileSync(path.join(root, 'source.tsx'), [
                'import React from "react"; declare const unknownTag:any; declare const flag:boolean;',
                `function Panel({testId,onClick,as,text}:{testId:string;onClick?:()=>void;as?:"button"|"span";text?:string}){${body}}`,
                `export function App(){${app}}`,
            ].join('\n'));
            const out = scan();
            const issues = out.diagnostics.filter((d) => d.rule === 'role-fit');
            assert.equal(issues.length > 0, bad, `${label}: ${JSON.stringify(issues)}`);
            if (label === 'default_override') {
                assert.equal(out.manifest.elements.find((e) => e.template === 'tags.item--button')?.aria.role, 'button');
            }
        }
    });
});

test('destructured for-of metadata retains literal option ids and opaque callers', () => {
    withSource({
    }, {include: ['*.tsx']}, ({root, scan}) => {
        for (const opaque of [false, true]) {
            fs.writeFileSync(path.join(root, 'source.tsx'), [
                'import React from "react"; type Option={testId?:string}; declare const unknownOptions:Option[];',
                'function Options({values}:{values:Option[]}){const items=[];for(const {testId:optionTestId} of values){items.push(<div data-testid={optionTestId}/>);}return <>{items}</>;}',
                `export function App(){return <><Options values={[{testId:"invite.member"},{testId:"invite.guest"}]}/>${opaque ? '<Options values={unknownOptions}/>' : ''}</>;}`,
            ].join('\n'));
            const out = scan();
            for (const expected of ['invite.member', 'invite.guest']) {
                assert.ok(out.manifest.elements.some((element) => element.template === expected), JSON.stringify(out.diagnostics));
            }
            assert.equal(out.diagnostics.some((diagnostic) => diagnostic.rule === 'unscoped' || diagnostic.rule === 'unresolved'), opaque, JSON.stringify(out.diagnostics));
        }
        fs.writeFileSync(path.join(root, 'source.tsx'), [
            'import React from "react"; declare const unknownId:string;',
            'export function App(){const items=[];for(let {testId} of [{testId:"invite.member"}]){testId=unknownId;items.push(<div data-testid={testId}/>);}return <>{items}</>;}',
        ].join('\n'));
        const mutable = scan();
        assert.ok(mutable.diagnostics.some((diagnostic) => diagnostic.rule === 'unscoped' || diagnostic.rule === 'unresolved'), JSON.stringify(mutable.diagnostics));
    });
});
