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

test('text setting input types are narrowed by the suffix arm of the same stable value', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-text-setting-types-'));
    try {
        installFixtureCompiler(root);
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['*.tsx', path.join(FIXTURES, '_lib')]}));
        const file = path.join(root, 'config.json');
        fs.writeFileSync(file, JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], checks: {strictPaths: ['.']}, output: {report: 'surface.json'}}));
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
            const out = scanProject(loadConfig(file));
            const failures = out.diagnostics.filter((diagnostic) => diagnostic.rule === 'role-fit' || diagnostic.rule === 'duplicates');
            assert.equal(failures.length > 0, bad, JSON.stringify(out.diagnostics));
            if (!bad) {
                assert.ok(out.manifest.elements.some((element) => element.template === 'area.number.number--spinbutton'));
                assert.ok(out.manifest.elements.some((element) => element.template === 'area.text.value--textbox'));
            }
        }
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});
