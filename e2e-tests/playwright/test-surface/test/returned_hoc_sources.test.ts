// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';

import {LIB, withProject} from './helpers.ts';

import {scanProject} from '../src/cli.ts';
import {loadConfig} from '../src/config.ts';

test('test ids on a returned HOC class retain the outer JSX mount props', () => {
    withProject(['*.tsx', LIB], (root) => {
        fs.writeFileSync(path.join(root, 'source.tsx'), [
            'import React from "react";',
            'function wrap(Component:any){class Item extends React.PureComponent<{slotTestId?:string}>{render(){const {slotTestId,...props}=this.props;return <li role="menuitem" data-testid={slotTestId}><Component {...props}/></li>;}} return Item;}',
            'function Body({bodyScope}:{bodyScope:string}){return <span data-testid={bodyScope}/>;} const Item=wrap(Body);',
            'export function App(){return <><Item slotTestId="menu.first--menuitem" bodyScope="menu.first.label--text"/><Item slotTestId="menu.second--menuitem" bodyScope="menu.second.label--text"/></>;}',
        ].join('\n'));
        const file = path.join(root, 'config.json');
        const out = scanProject(loadConfig(file));
        for (const expected of ['menu.first--menuitem', 'menu.second--menuitem', 'menu.first.label--text', 'menu.second.label--text']) {
            assert.ok(out.manifest.elements.some((element) => element.template === expected), JSON.stringify(out.diagnostics));
        }
        assert.equal(out.diagnostics.some((diagnostic) => diagnostic.rule === 'unscoped' || diagnostic.rule === 'unresolved'), false, JSON.stringify(out.diagnostics));
    });
});

test('a connector created from a state-map factory still mounts its component argument', () => {
    withProject(['*.tsx', LIB], (root) => {
        fs.writeFileSync(path.join(root, 'source.tsx'), [
            'import React from "react"; declare function connect(map:any):(component:any)=>any;',
            'function makeMap(){return function mapState(){return {};};} const connector=connect(makeMap);',
            'function Body({testIdScope}:{testIdScope:string}){return <div data-testid={testIdScope+"--region"}/>;} const Item=connector(Body);',
            'export function App(){return <Item testIdScope="post.spillage_report"/>;}',
        ].join('\n'));
        const file = path.join(root, 'config.json');
        const out = scanProject(loadConfig(file));
        assert.ok(out.manifest.elements.some((element) => element.template === 'post.spillage_report--region'), JSON.stringify(out.diagnostics));
        assert.equal(out.diagnostics.some((diagnostic) => diagnostic.rule === 'unscoped'), false, JSON.stringify(out.diagnostics));
    });
});
