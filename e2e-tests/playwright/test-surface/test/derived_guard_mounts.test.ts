// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';

import {LIB, withProject} from './helpers.ts';

import {scanProject} from '../src/cli.ts';
import {loadConfig} from '../src/config.ts';

test('a const guard derived from a prop comparison excludes only that mount', () => {
    withProject(['source.tsx', 'constants.ts', LIB], (root) => {
        fs.writeFileSync(path.join(root, 'constants.ts'), 'export const Locations={MODAL:"modal",CENTER:"center"} as const;');
        fs.writeFileSync(path.join(root, 'source.tsx'), [
            'import React from "react"; import {Locations} from "./constants";',
            'function Menu({scope}:{scope:string}){return <button role="menuitem" data-testid={scope+".item--menuitem"}/>;}',
            'function Post({location,scope}:{location:string;scope:string}){const isModal=location===Locations.MODAL;console.log("unrelated render work");return !isModal && <Menu scope={scope}/>;}',
            'export function App(){return <><Post location="modal" scope="modal"/><Post location="center" scope="feed"/></>;}',
        ].join('\n'));
        const config = path.join(root, 'config.json');
        const out = scanProject(loadConfig(config));
        assert.ok(out.manifest.elements.some((element) => element.template === 'feed.item--menuitem'));
        assert.ok(!out.manifest.elements.some((element) => element.template === 'modal.item--menuitem'));
    });
});
