// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';

import {LIB, withProject} from './helpers.ts';

import {scanProject} from '../src/cli.ts';
import {loadConfig} from '../src/config.ts';

test('object and DOM sites keep enclosing guards through casts without hiding unsafe or mutated reads', () => {
    withProject(['source.tsx', LIB], (root) => {
        const config = path.join(root, 'config.json');
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
            const out = scanProject(loadConfig(config));
            assert.equal(out.diagnostics.some((diagnostic) => diagnostic.rule === 'undefined'), unsafe, `${label}: ${JSON.stringify(out.diagnostics)}`);
            if (!unsafe) {
                assert.ok(out.manifest.elements.some((element) => element.template === 'one.paper' || element.template === 'one.error--text'), `${label}: a valid mount still emits`);
            }
        }
    });
});
