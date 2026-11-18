// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {test} from 'node:test';

import {FIXTURES, installFixtureCompiler} from './helpers.ts';

import {scanProject} from '../src/cli.ts';
import {loadConfig} from '../src/config.ts';

test('typed entity and numeric keys retain missing alternatives unless their use is guarded', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-optional-typed-'));
    try {
        installFixtureCompiler(root);
        fs.mkdirSync(path.join(root, 'types'));
        fs.writeFileSync(path.join(root, 'types/user.ts'), 'export type User = {id: string};');
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['source.tsx', 'types', path.join(FIXTURES, '_lib')]}));
        fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], entityTypeDirs: ['types'], checks: {strictPaths: ['source.tsx']}, output: {report: 'surface.json'}}));
        const source = [
            'import React from "react"; import type {User} from "./types/user";',
            'function helper(id: User["id"] | undefined, position?: number) {return <><button data-testid={"view.arg_entity:" + id + "--button"}/><button data-testid={"view.arg_position:" + position + "--button"}/></>;}',
            'function Item({user, position}: {user?: User; position?: number}) {return <section>',
            '<button data-testid={"view.entity:" + user?.id + "--button"}/>',
            '<button data-testid={"view.position:" + position + "--button"}/>',
            '<button data-testid={user ? "view.guarded:" + user.id + "--button" : undefined}/>',
            '<button data-testid={position !== undefined ? "view.guarded_position:" + position + "--button" : undefined}/>',
            '{helper(user?.id, position)}',
            '</section>;}',
            'export function App() {return <><Item user={{id: "abc"}} position={0}/><Item/></>;}',
        ].join('\n');
        fs.writeFileSync(path.join(root, 'source.tsx'), source);
        const out = scanProject(loadConfig(path.join(root, 'config.json')));
        const missing = out.diagnostics.filter((diagnostic) => diagnostic.rule === 'undefined');
        assert.equal(missing.length, 4, JSON.stringify(missing));
        assert.equal(missing.filter((diagnostic) => diagnostic.at.startsWith('source.tsx:2:')).length, 2, 'helper arguments keep the missing alternatives');
        assert.ok(missing.every((diagnostic) => diagnostic.severity === 'error'));
        assert.ok(missing.some((diagnostic) => diagnostic.at.startsWith('source.tsx:5:')));
        assert.ok(missing.some((diagnostic) => diagnostic.at.startsWith('source.tsx:5:')));
        assert.ok(!missing.some((diagnostic) => diagnostic.at.startsWith('source.tsx:6:') || diagnostic.at.startsWith('source.tsx:7:')));
        const entity = out.manifest.elements.find((element) => element.template === 'view.entity:{key}--button');
        assert.equal(entity?.key?.entity, 'User');
        assert.equal(entity?.key?.field, 'id');
        assert.equal(entity?.key?.module, '@mattermost/types/user');
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});
