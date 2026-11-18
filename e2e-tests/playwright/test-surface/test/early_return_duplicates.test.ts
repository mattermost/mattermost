// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';

import {LIB, withProject} from './helpers.ts';

import {scanProject} from '../src/cli.ts';
import {loadConfig} from '../src/config.ts';

test('exclusive outer mounts remain visible past same-file component declarations', () => {
    withProject(['*.tsx', LIB], (root) => {
        const file = path.join(root, 'config.json');
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
            const out = scanProject(loadConfig(file));
            assert.equal(out.diagnostics.some((diagnostic) => diagnostic.rule === 'duplicates'), concurrent, label + JSON.stringify(out.diagnostics));
        }
    });
});
