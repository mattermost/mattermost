// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {test} from 'node:test';

import {FIXTURES, installFixtureCompiler, LIB, withProject} from './helpers.ts';

import {scanProject} from '../src/cli.ts';
import {loadConfig} from '../src/config.ts';

test('primitive kinds survive aliases, logical operators and guarded component mounts', () => {
    withProject(['source.tsx', LIB], (root) => {
        const config = path.join(root, 'config.json');
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
        fs.writeFileSync(path.join(root, 'source.tsx'), source);
        const out = scanProject(loadConfig(config));
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
});

test('strict null guards retain undefined and strict undefined guards retain null', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-nullish-guards-'));
    try {
        installFixtureCompiler(root);
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['source.tsx', path.join(FIXTURES, '_lib')]}));
        const config = path.join(root, 'config.json');
        fs.writeFileSync(config, JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], checks: {strictPaths: ['source.tsx']}, output: {report: 'surface.json'}}));
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
            const out = scanProject(loadConfig(config));
            assert.equal(out.diagnostics.some((diagnostic) => diagnostic.rule === 'undefined'), missing, `${guard}, ${prop}: ${JSON.stringify(out.diagnostics)}`);
        }
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});
