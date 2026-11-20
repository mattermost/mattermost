// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';

import {LIB, withProject} from './helpers.ts';

import {scanProject} from '../src/cli.ts';
import {loadConfig} from '../src/config.ts';

test('destructured for-of metadata retains literal option ids and opaque callers', () => {
    withProject(['*.tsx', LIB], (root) => {
        const file = path.join(root, 'config.json');
        for (const opaque of [false, true]) {
            fs.writeFileSync(path.join(root, 'source.tsx'), [
                'import React from "react"; type Option={testId?:string}; declare const unknownOptions:Option[];',
                'function Options({values}:{values:Option[]}){const items=[];for(const {testId:optionTestId} of values){items.push(<div data-testid={optionTestId}/>);}return <>{items}</>;}',
                `export function App(){return <><Options values={[{testId:"invite.member"},{testId:"invite.guest"}]}/>${opaque ? '<Options values={unknownOptions}/>' : ''}</>;}`,
            ].join('\n'));
            const out = scanProject(loadConfig(file));
            for (const expected of ['invite.member', 'invite.guest']) {
                assert.ok(out.manifest.elements.some((element) => element.template === expected), JSON.stringify(out.diagnostics));
            }
            assert.equal(out.diagnostics.some((diagnostic) => diagnostic.rule === 'unscoped' || diagnostic.rule === 'unresolved'), opaque, JSON.stringify(out.diagnostics));
        }
        fs.writeFileSync(path.join(root, 'source.tsx'), [
            'import React from "react"; declare const unknownId:string;',
            'export function App(){const items=[];for(let {testId} of [{testId:"invite.member"}]){testId=unknownId;items.push(<div data-testid={testId}/>);}return <>{items}</>;}',
        ].join('\n'));
        const mutable = scanProject(loadConfig(file));
        assert.ok(mutable.diagnostics.some((diagnostic) => diagnostic.rule === 'unscoped' || diagnostic.rule === 'unresolved'), JSON.stringify(mutable.diagnostics));
    });
});
