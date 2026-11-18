// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';

import {LIB, withProject} from './helpers.ts';

import {scanProject} from '../src/cli.ts';
import {loadConfig} from '../src/config.ts';

test('option ids from an object-returning helper retain each call context and opaque callers', () => {
    withProject(['*.ts', '*.tsx', LIB], (root) => {
        fs.writeFileSync(path.join(root, 'fields.ts'), [
            'export type Fields={options:Array<{dataTestId?:string;value:string}>};',
            // eslint-disable-next-line no-template-curly-in-string -- The fixture is a runtime helper returning option metadata.
            'export const make=(scope:string):Fields=>({options:[{dataTestId:`${scope}.all--radio`,value:"all"},{dataTestId:`${scope}.none--radio`,value:"none"}]});',
        ].join('\n'));
        const file = path.join(root, 'config.json');
        const body = 'function Fields({data}:{data:utils.Fields}){return <>{data.options.map(option=><input type="radio" data-testid={option.dataTestId}/>)}</>;}';
        for (const opaque of [false, true]) {
            fs.writeFileSync(path.join(root, 'source.tsx'), [
                'import React from "react"; import * as utils from "./fields";',
                'declare function opaqueFields():utils.Fields;',
                body,
                `export function App(){return <><Fields data={utils.make("notify.desktop")}/><Fields data={utils.make("notify.mobile")}/>${opaque ? '<Fields data={opaqueFields()}/>' : ''}</>;}`,
            ].join('\n'));
            const out = scanProject(loadConfig(file));
            const ids = out.manifest.elements.map((element) => element.template);
            for (const expected of ['notify.desktop.all--radio', 'notify.desktop.none--radio', 'notify.mobile.all--radio', 'notify.mobile.none--radio']) {
                assert.ok(ids.includes(expected), `${expected}: ${JSON.stringify(out.diagnostics)}`);
            }
            assert.equal(out.diagnostics.some((diagnostic) => diagnostic.rule === 'unscoped' || diagnostic.rule === 'unresolved'), opaque, JSON.stringify(out.diagnostics));
        }
    });
});
