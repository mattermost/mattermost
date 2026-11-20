// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';

import {LIB, withProject} from './helpers.ts';

import {scanProject} from '../src/cli.ts';
import {loadConfig} from '../src/config.ts';

test('prop scopes retain only their own plain keys before a role suffix', () => {
    withProject(['*.tsx', LIB], (root) => {
        // eslint-disable-next-line no-template-curly-in-string -- The fixture derives keyed ids from caller props.
        fs.writeFileSync(path.join(root, 'keyed.tsx'), 'import React from "react"; function Min({testId,testKey}:{testId:string;testKey:string}){return <div role="group" data-testid={`${testId}:${testKey}--group`}/>;} export function Keyed({testIdScope,section,k=section}:{testIdScope:string;section:string;k?:string}){return <Min testId={testIdScope} testKey={k}/>;}');
        fs.writeFileSync(path.join(root, 'general.tsx'), 'import React from "react"; import {Keyed} from "./keyed"; export function General(){return <><Keyed testIdScope="settings.general.section" section="email"/><Keyed testIdScope="settings.general.section" section="shared"/></>;}');
        fs.writeFileSync(path.join(root, 'display.tsx'), 'import React from "react"; import {Keyed} from "./keyed"; export function Display(){return <><Keyed testIdScope="settings.display.section" section="clock"/><Keyed testIdScope="settings.display.section" section="shared"/></>;}');
        fs.writeFileSync(path.join(root, 'source.tsx'), 'import React from "react"; import {General} from "./general"; import {Display} from "./display"; export function App(){return <><General/><Display/></>;}');
        const file = path.join(root, 'config.json');
        for (const explicitUndefined of [false, true]) {
            if (explicitUndefined) {
                for (const name of ['general.tsx', 'display.tsx']) {
                    const caller = path.join(root, name);
                    fs.writeFileSync(caller, fs.readFileSync(caller, 'utf8').replaceAll('<Keyed ', '<Keyed k={undefined} '));
                }
            }
            const out = scanProject(loadConfig(file));
            assert.deepEqual(out.report.sets.SettingsGeneralSectionKey, ['email', 'shared'], JSON.stringify(out.report.sets));
            assert.deepEqual(out.report.sets.SettingsDisplaySectionKey, ['clock', 'shared'], JSON.stringify(out.report.sets));
        }
        const component = path.join(root, 'keyed.tsx');
        fs.writeFileSync(component, fs.readFileSync(component, 'utf8').replace('k=section}', 'k=section+".value"}'));
        const compound = scanProject(loadConfig(file));
        assert.deepEqual(compound.report.sets.SettingsGeneralSectionKey, ['email.value', 'shared.value'], JSON.stringify(compound.report.sets));
        assert.deepEqual(compound.report.sets.SettingsDisplaySectionKey, ['clock.value', 'shared.value'], JSON.stringify(compound.report.sets));
    });
});
