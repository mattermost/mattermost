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
import {FamilyParts, packageOf} from '../src/parts.ts';
import {loadProgram} from '../src/program.ts';
import {ProgramIndex} from '../src/program_index.ts';
import {Roles} from '../src/roles.ts';
import {Resolver} from '../src/values.ts';

test('only a declared unreadable role produces a state-driver warning; untyped prop getters keep the native role', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-spread-type-'));
    try {
        installFixtureCompiler(root);
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['source.tsx', path.join(FIXTURES, '_lib')]}));
        fs.writeFileSync(path.join(root, 'source.tsx'), [
            'import React from "react";',
            'declare function getReferenceProps():Record<string,unknown>; declare function typedProps():{role?:string};',
            'declare const flag:boolean; declare const unknownRole:string;',
            'export function App(){return <>',
            '<div role={flag ? "button" : unknownRole} data-testid="spread.mixed--checkbox"/>',
            '<div role={flag ? "checkbox" : unknownRole} data-testid="spread.valid_mixed--checkbox"/>',
            '<input data-testid="spread.native--textbox" {...getReferenceProps()}/>',
            '<input data-testid="spread.unknown--textbox" {...typedProps()}/>',
            '<button data-testid="spread.click--button" {...typedProps()}/>',
            '<input role="textbox" data-testid="spread.cleared--textbox" {...{role:undefined}}/>',
            '</>;}',
        ].join('\n'));
        const file = path.join(root, 'config.json');
        fs.writeFileSync(file, JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], checks: {strictPaths: ['.']}, output: {report: 'surface.json'}}));
        const out = scanProject(loadConfig(file));
        assert.deepEqual([...new Set(out.diagnostics.filter((diagnostic) => diagnostic.rule === 'role-fit').map((diagnostic) => diagnostic.template))], ['spread.mixed--checkbox']);
        const unresolved = out.diagnostics.filter((diagnostic) => diagnostic.rule === 'unresolved');
        assert.deepEqual([...new Set(unresolved.map((diagnostic) => diagnostic.template))].sort(), ['spread.mixed--checkbox', 'spread.unknown--textbox', 'spread.valid_mixed--checkbox']);
        assert.equal(unresolved.filter((diagnostic) => diagnostic.template === 'spread.unknown--textbox').length, 1, JSON.stringify(out.diagnostics));
        assert.ok(unresolved.every((diagnostic) => diagnostic.severity === 'warning'));
        assert.equal(unresolved[0].severity, 'warning');
        assert.equal(out.manifest.elements.find((element) => element.template === 'spread.native--textbox')?.aria.role, 'textbox');
        assert.equal(out.manifest.elements.find((element) => element.template === 'spread.cleared--textbox')?.aria.role, 'textbox');
        fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({name: 'unreadable-role-parts', version: '1.0.0'}));
        // eslint-disable-next-line no-template-curly-in-string -- The library fixture declares a runtime testid.
        fs.writeFileSync(path.join(root, 'library.tsx'), 'import React from "react"; declare function typedProps():{role?:string}; export function Field({testId}:{testId?:string}){return <input {...typedProps()} data-testid={testId ? `${testId}--textbox` : undefined}/>;}');
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['*.tsx', path.join(FIXTURES, '_lib')]}));
        fs.writeFileSync(file, JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], library: {entry: 'library.tsx'}, output: {report: 'surface.json'}}));
        const config = loadConfig(file);
        const ix = new ProgramIndex(loadProgram(config), config);
        const R = new Resolver(ix);
        const parts = new FamilyParts(ix, R, new Roles(ix, R), config.library!);
        parts.build(config.library!.entry, packageOf(config));
        assert.equal(parts.diagnostics.length, 1);
        assert.equal(parts.diagnostics[0].rule, 'unresolved');
        assert.equal(parts.diagnostics[0].severity, 'warning');
        // eslint-disable-next-line no-template-curly-in-string -- The library fixture declares a runtime testid.
        fs.writeFileSync(path.join(root, 'library.tsx'), 'import React from "react"; declare const flag:boolean; declare const unknownRole:string; export function Field({testId}:{testId?:string}){return <div role={flag ? "button" : unknownRole} data-testid={testId ? `${testId}--checkbox` : undefined}/>;}');
        const mixedIndex = new ProgramIndex(loadProgram(config), config);
        const mixedResolver = new Resolver(mixedIndex);
        const mixedParts = new FamilyParts(mixedIndex, mixedResolver, new Roles(mixedIndex, mixedResolver), config.library!);
        mixedParts.build(config.library!.entry, packageOf(config));
        assert.ok(mixedParts.diagnostics.some((diagnostic) => diagnostic.rule === 'parts' && diagnostic.severity === 'error'));
        assert.ok(mixedParts.diagnostics.some((diagnostic) => diagnostic.rule === 'unresolved' && diagnostic.severity === 'warning'));
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});
