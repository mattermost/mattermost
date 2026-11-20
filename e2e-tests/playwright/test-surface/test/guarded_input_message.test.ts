// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';

import {LIB, withProject} from './helpers.ts';

import {scanProject} from '../src/cli.ts';
import {loadConfig} from '../src/config.ts';
import {concat, isTruncated, lit} from '../src/values/algebra.ts';

test('guarded input message metadata omits absent scopes before interpolating', () => {
    withProject(['*.tsx', LIB], (root) => {
        const file = path.join(root, 'config.json');
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
            const out = scanProject(loadConfig(file));
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
