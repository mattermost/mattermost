// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {test} from 'node:test';

import {FIXTURES, installFixtureCompiler} from './helpers.ts';

import {scanProject} from '../src/cli.ts';
import {loadConfig} from '../src/config.ts';

test('input type and conditional testid suffix follow the same row-selection arm', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-input-arm-'));
    try {
        installFixtureCompiler(root);
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['*.tsx', path.join(FIXTURES, '_lib')]}));
        const file = path.join(root, 'config.json');
        fs.writeFileSync(file, JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], checks: {strictPaths: ['.']}, output: {report: 'surface.json'}}));
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
            const out = scanProject(loadConfig(file));
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
                const out = scanProject(loadConfig(file));
                assert.equal(out.diagnostics.some(({rule}) => rule === 'role-fit'), !same);
            }
        }
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});
