// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';

import {LIB, withProject} from './helpers.ts';

import {scanProject} from '../src/cli.ts';
import {loadConfig} from '../src/config.ts';

test('mutable imported values retain writes while immutable imports keep their initializer', () => {
    withProject(['*.tsx', '*.ts', LIB], (root) => {
        const config = path.join(root, 'config.json');
        fs.writeFileSync(path.join(root, 'store.ts'), 'export const store:{name?:string}={name:"s"}; export function clear(){store.name=undefined;} export let current:string|undefined="c"; export function reset(){current=undefined;} export const stable="stable"; export const untouched={name:"untouched"}; export const Constants={Prefix:"area",Ids:{A:"a"}}; export const Frozen={Prefix:"area"} as const; export const partial:{readonly mode:string;name?:string}={mode:"readonly",name:"partial"}; export const methodStore:{name?:string;erase():void}={name:"method",erase(){this.name=undefined;}};');
        const cases = [
            ['string_method', 'return <span data-testid={Constants.Prefix+".item--text"}/>;', false, 'Constants.Prefix.toUpperCase();'],
            ['object_keys', 'return <span data-testid={Constants.Ids.A+".item--text"}/>;', false, 'Object.keys(Constants.Ids);'],
            ['unknown_log', 'return <span data-testid={Constants.Prefix+".item--text"}/>;', false, 'declare function log(x:unknown):void; log(Constants);'],
            ['readonly_log', 'return <span data-testid={Frozen.Prefix+".item--text"}/>;', false, 'declare function log(x:unknown):void; log(Frozen);'],
            ['destructured_parameter', 'return <span data-testid={untouched.name+".item--text"}/>;', true, 'function mutate({name}:any){name.clear();} mutate(untouched);'],
            ['method_this', 'return <span data-testid={methodStore.name+".item--text"}/>;', true, 'methodStore.erase();'],
            ['unknown_callee', 'return <span data-testid={untouched.name+".item--text"}/>;', true, 'declare const unknown:any; unknown(untouched);'],
            ['partial_readonly', 'return <span data-testid={partial.name+".item--text"}/>;', true, 'declare const unknown:any; unknown(partial);'],
            ['alias_write', 'return <span data-testid={untouched.name+".item--text"}/>;', true, 'const alias=untouched; alias.name=undefined;'],
            ['guarded_object', 'if(store.name){clear(); return <span data-testid={store.name+".error--text"}/>;} return null;', true],
            ['object', 'clear(); return <span data-testid={store.name+".error--text"}/>;', true],
            ['guarded_let', 'if(current){reset(); return <span data-testid={current+".error--text"}/>;} return null;', true],
            ['let', 'reset(); return <span data-testid={current+".error--text"}/>;', true],
            ['primitive', 'return <span data-testid={stable+".value--text"}/>;', false],
            ['unchanged_object', 'return <span data-testid={untouched.name+".value--text"}/>;', false],
        ] as const;
        for (const [label, body, unsafe, other = ''] of cases) {
            fs.writeFileSync(path.join(root, 'other.ts'), `import {Constants,Frozen,untouched,methodStore,partial} from "./store"; ${other}`);
            fs.writeFileSync(path.join(root, 'source.tsx'), `import React from "react"; import {store,clear,current,reset,stable,untouched,Constants,Frozen,methodStore,partial} from "./store"; export function App(){${body}}`);
            const out = scanProject(loadConfig(config));
            assert.equal(out.diagnostics.some((d) => (d.rule === 'undefined' || d.rule === 'unresolved')), unsafe, `${label}: ${JSON.stringify(out.diagnostics)}`);
        }
    });
});
