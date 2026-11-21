// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';

import {LIB, withProject} from './helpers.ts';

import {scanProject} from '../src/cli.ts';
import {loadConfig} from '../src/config.ts';

test('conditional intrinsic tags retain per-arm roles, handlers and per-mount defaults', () => {
    withProject(['source.tsx', LIB], (root) => {
        const config = path.join(root, 'config.json');
        const cases = [
            ['honest', 'const Tag=onClick ? "button" : "span"; return <Tag onClick={onClick} data-testid={testId}/>;', 'return <Panel testId="tags.item"/>;', false],
            ['both_honest', 'const Tag=onClick ? "button" : "span"; return <Tag onClick={onClick} data-testid={onClick?testId+"--button":testId+"--text"}/>;', 'return <Panel testId="tags.item" onClick={flag?()=>{}:undefined}/>;', false],
            ['conditional_role', 'const Tag=onClick ? "button" : "span"; return <Tag role={onClick?"button":undefined} onClick={onClick} data-testid={onClick?testId+"--button":testId+"--text"}/>;', 'return <Panel testId="tags.item" onClick={flag?()=>{}:undefined}/>;', false],
            ['wrong', 'const Tag=onClick ? "div" : "span"; return <Tag onClick={onClick} data-testid={testId}/>;', 'return <Panel testId="tags.item" onClick={()=>{}}/>;', false],
            ['default_override', 'const Tag=as ?? "span"; return <Tag data-testid={testId}/>;', 'return <Panel as="button" testId="tags.item--button"/>;', false],
            ['default', 'const Tag=as ?? "span"; return <Tag data-testid={testId}/>;', 'return <Panel testId="tags.item--text"/>;', false],
            ['unreachable', 'return text ? <div onClick={()=>{}} data-testid={testId}/> : <img data-testid={testId}/>;', 'return <Panel testId="tags.item--img"/>;', false],
            ['reachable', 'return text ? <div onClick={()=>{}} data-testid={testId}/> : <img data-testid={testId}/>;', 'return <Panel testId="tags.item--img" text="yes"/>;', false],
            ['changed_handler', 'const Tag=onClick ? "button" : "span"; onClick=()=>{}; return <Tag onClick={onClick} data-testid={testId}/>;', 'return <Panel testId="tags.item--text"/>;', false],
            ['wrong_state', 'const Tag=as ?? "span"; return <Tag data-testid={testId}/>;', 'return <Panel as="button" testId="tags.item--checkbox"/>;', true],
            ['unknown_state', 'const Tag=unknownTag; return <Tag data-testid={testId}/>;', 'return <Panel testId="tags.item--checkbox"/>;', true],
            ['unknown', 'const Tag=unknownTag; return <Tag data-testid={testId}/>;', 'return <Panel testId="tags.item--button"/>;', false],
        ] as const;
        for (const [label, body, app, bad] of cases) {
            fs.writeFileSync(path.join(root, 'source.tsx'), [
                'import React from "react"; declare const unknownTag:any; declare const flag:boolean;',
                `function Panel({testId,onClick,as,text}:{testId:string;onClick?:()=>void;as?:"button"|"span";text?:string}){${body}}`,
                `export function App(){${app}}`,
            ].join('\n'));
            const out = scanProject(loadConfig(config));
            const issues = out.diagnostics.filter((d) => d.rule === 'role-fit');
            assert.equal(issues.length > 0, bad, `${label}: ${JSON.stringify(issues)}`);
            if (label === 'default_override') {
                assert.equal(out.manifest.elements.find((e) => e.template === 'tags.item--button')?.aria.role, 'button');
            }
        }
    });
});
