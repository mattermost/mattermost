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

test('candidate dialog props apply function and class defaults only to missing or undefined values', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-candidate-default-'));
    try {
        installFixtureCompiler(root);
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['source.tsx', path.join(FIXTURES, '_lib')]}));
        const config = path.join(root, 'config.json');
        fs.writeFileSync(config, JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], checks: {strictPaths: ['source.tsx']}, output: {report: 'surface.json'}}));
        const declarations = [
            'import React from "react";',
            'function Dialog({testId="my_dialog"}: {testId?: string | null}) {return <button data-testid={testId + ".close--button"}/>;}',
            'class ClassDialog extends React.Component<{testId?: string}> {static defaultProps={testId:"class_dialog"}; render() {return <button data-testid={this.props.testId + ".close--button"}/>;}}',
        ];
        const scan = (mounts: string[]) => {
            fs.writeFileSync(path.join(root, 'source.tsx'), [...declarations, ...mounts].join('\n'));
            return scanProject(loadConfig(config));
        };
        const candidates = scan([
            'export const first={dialogType:Dialog};',
            'export const second={dialogType:Dialog,dialogProps:{testId:undefined}};',
            'export const third={dialogType:Dialog,dialogProps:{testId:"explicit_dialog"}};',
            'export const fourth={dialogType:ClassDialog};',
        ]);
        assert.deepEqual(candidates.diagnostics.filter((diagnostic) => diagnostic.severity === 'error'), []);
        for (const scope of ['my_dialog', 'explicit_dialog', 'class_dialog']) {
            assert.ok(candidates.report.scopes[scope], scope);
        }
        const jsx = scan(['export function App() {return <><Dialog/><Dialog testId={undefined}/><Dialog testId="explicit_dialog"/><ClassDialog/></>;}']);
        assert.deepEqual(jsx.diagnostics.filter((diagnostic) => diagnostic.severity === 'error'), []);
        for (const scope of ['my_dialog', 'explicit_dialog', 'class_dialog']) {
            const fromCandidate = candidates.report.families[candidates.report.scopes[scope].family];
            const fromJsx = jsx.report.families[jsx.report.scopes[scope].family];
            assert.deepEqual(fromCandidate.parts, fromJsx.parts, `${scope} has the same defaulted members`);
        }
        const nullValue = scan(['export const descriptor={dialogType:Dialog,dialogProps:{testId:null}};']);
        assert.ok(nullValue.diagnostics.some((diagnostic) => diagnostic.rule === 'undefined' && diagnostic.severity === 'error'));
        assert.equal(nullValue.report.scopes.my_dialog, undefined, 'explicit null does not select a default');
        const unknown = scan(['declare const props: {testId: unknown}; export const descriptor={dialogType:Dialog,dialogProps:props};']);
        assert.equal(unknown.report.scopes.my_dialog, undefined, 'an unreadable supplied value does not select a default');
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});
