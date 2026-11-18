// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';

import {LIB, withProject} from './helpers.ts';

import {scanProject} from '../src/cli.ts';
import {loadConfig} from '../src/config.ts';

test('optional scopes remain absent in guarded helper objects and select-part closures', () => {
    withProject(['source.tsx', LIB], (root) => {
        fs.writeFileSync(path.join(root, 'source.tsx'), [
            'import React from "react";',
            'function paperProps(menuTestId?: string): Record<string, string> {return menuTestId ? {"data-testid": menuTestId + ".paper"} : {};}',
            'function parts(testId?: string) {const Control = () => <button {...{"data-testid": testId ? testId + ".control--button" : undefined}}/>; return <Control/>;}',
            'function Panel({testIdScope}: {testIdScope?: string}) {return <section data-testid={testIdScope}><div {...paperProps(testIdScope)}/>{parts(testIdScope)}</section>;}',
            'export function App() {return <><Panel testIdScope="one"/><Panel/></>;}',
        ].join('\n'));
        const out = scanProject(loadConfig(path.join(root, 'config.json')));
        assert.ok(out.manifest.elements.some((element) => element.template === 'one.paper'));
        assert.ok(out.manifest.elements.some((element) => element.template === 'one.control--button'));
        assert.deepEqual(out.diagnostics.filter((diagnostic) => diagnostic.rule === 'undefined'), []);
        assert.ok(!out.manifest.elements.some((element) => element.template.includes('undefined')));
        fs.appendFileSync(path.join(root, 'source.tsx'), '\nfunction unsafe(scope?: string) {return <span data-testid={scope + ".unsafe--text"}/>;} export const missing = unsafe(undefined);');
        const unguarded = scanProject(loadConfig(path.join(root, 'config.json')));
        const warnings = unguarded.diagnostics.filter((diagnostic) => diagnostic.rule === 'undefined');
        assert.equal(warnings.length, 1, 'an absent helper argument still fails when it is actually interpolated');
        assert.ok(warnings[0].at.startsWith('source.tsx:6:'));
    });
});
