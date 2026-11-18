// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';

import {LIB, withProject} from './helpers.ts';

import {scanProject} from '../src/cli.ts';
import {loadConfig} from '../src/config.ts';

test('connected component bindings retain unique mount proofs only while their result does not escape', () => {
    withProject(['*.ts', '*.tsx', LIB], (root) => {
        fs.writeFileSync(path.join(root, 'redux.d.ts'), 'declare module "react-redux" {export function connect(a:any,b:any):(c:any)=>any;}');
        fs.writeFileSync(path.join(root, 'manage.tsx'), [
            'import React from "react"; import {connect} from "react-redux";',
            'function Max(){return <div data-testid="settings.value--region"/>;} function Manage(){return <Max/>;}',
            'export default connect(null, {})(Manage);',
        ].join('\n'));
        const file = path.join(root, 'config.json');
        for (const escaped of [false, true]) {
            fs.writeFileSync(path.join(root, 'source.tsx'), [
                'import React from "react"; import Manage from "./manage"; declare const active:boolean; declare function consume(x:any):void;',
                'function Min(){return <div data-testid="settings.value--region"/>;} function Item({max}:{max:any}){if(active){return <>{max}</>;}return <Min/>;}',
                `export function App(){${escaped ? 'consume([{component:Manage}]);' : ''}return <Item max={<Manage/>}/>;}`,
            ].join('\n'));
            const out = scanProject(loadConfig(file));
            assert.equal(out.diagnostics.some((diagnostic) => diagnostic.rule === 'duplicates'), escaped, JSON.stringify(out.diagnostics));
        }
    });
});
