// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';

import {LIB, withProject} from './helpers.ts';

import type {JsxTag} from '../src/ast.ts';
import {scanProject} from '../src/cli.ts';
import {loadConfig} from '../src/config.ts';
import {loadProgram} from '../src/program.ts';
import {ProgramIndex} from '../src/program_index.ts';
import {Roles} from '../src/roles.ts';
import {DomEmissions} from '../src/scan/emitter.ts';
import {typescript} from '../src/typescript.ts';
import {Resolver} from '../src/values.ts';

test('conditional JSX spreads keep role and handlers in the testid arm', () => {
    withProject(['source.tsx', LIB], (root) => {
        const config = path.join(root, 'config.json');
        const cases = [
            ['honest', 'isFailed ? {} : {onClick, onKeyDown:onClick, role:"checkbox",tabIndex:0,"aria-expanded":true}', 'isFailed?undefined:"recaps.header--checkbox"', false],
            ['wrong_arm', 'isFailed ? {} : {onClick, role:"checkbox"}', 'isFailed?"recaps.header--checkbox":undefined', true],
            ['handler_without_role', 'isFailed ? {} : {onClick}', 'isFailed?undefined:"recaps.header"', false],
            ['undefined_role_override', '{role:undefined}', '"recaps.header--checkbox"', true, 'role="checkbox"'],
            ['null_role_override', '{role:null}', '"recaps.header--checkbox"', true, 'role="checkbox"'],
            ['undefined_handler_override', '{onClick:undefined}', '"recaps.header"', false, 'onClick={onClick}'],
            ['omitted_role', '{}', '"recaps.header--checkbox"', false, 'role="checkbox"'],
            ['conditional_present_unconditional_id', 'isFailed?{role:undefined}:{}', '"recaps.header--checkbox"', true, 'role="checkbox" onClick={onClick}'],
            ['conditional_missing', 'isFailed?{}:{role:undefined}', 'isFailed?"recaps.header--checkbox":undefined', false, 'role="checkbox"'],
            ['conditional_undefined', 'isFailed?{}:{role:undefined}', 'isFailed?undefined:"recaps.header--checkbox"', true, 'role="checkbox"'],
            ['undefined_object_spread', 'isFailed?undefined:{count:1}', '"recaps.header--checkbox"', false, 'role="checkbox"'],
            ['empty_arm', 'isFailed ? {} : {onClick, role:"checkbox"}', 'isFailed?undefined:"recaps.header--checkbox"', false],
        ] as const;
        for (const [label, spread, id, bad, before = ''] of cases) {
            fs.writeFileSync(path.join(root, 'source.tsx'), `import React from "react"; declare const isFailed:boolean; const onClick=()=>{}; export function App(){const headerProps=${spread};return <div ${before} data-testid={${id}} {...headerProps}/>;}`);
            const out = scanProject(loadConfig(config));
            const issues = out.diagnostics.filter((d) => d.rule === 'role-fit');
            assert.equal(issues.length > 0, bad, `${label}: ${JSON.stringify(issues)}`);
        }

        // An incomplete role summary must retain the testid for ordinary checks instead of erasing the site.
        fs.writeFileSync(path.join(root, 'source.tsx'), 'import React from "react"; export function App(){return <div data-testid="recaps.header--checkbox"/>;}');
        const loaded = loadConfig(config);
        const ix = new ProgramIndex(loadProgram(loaded), loaded);
        const R = new Resolver(ix);
        const resolveAttributes = R.attributeValues.bind(R);
        R.attributeValues = (tag, name) => (name === 'role' ? [] : resolveAttributes(tag, name));
        let tag: JsxTag | undefined;
        const visit = (node: import('typescript').Node) => {
            if (typescript.isJsxSelfClosingElement(node)) {
                tag = node;
            }
            typescript.forEachChild(node, visit);
        };
        visit(ix.program.getSourceFile(path.join(root, 'source.tsx'))!);
        assert.ok(tag);
        const emitter = new DomEmissions({ix, R, roles: new Roles(ix, R), usageByLoc: new Map(), diag: () => {}});
        const emissions = emitter.emissions([{kind: 'dom', node: tag, at: ix.where(tag), tag, expr: undefined, owner: null, ownerName: 'App', values: [{k: 'lit', s: 'recaps.header--checkbox'}]}]);
        assert.equal(emissions.length, 1);
        assert.equal(emissions[0].template, 'recaps.header--checkbox');
        assert.equal(emissions[0].landing.aria.role, null);
    });
});
