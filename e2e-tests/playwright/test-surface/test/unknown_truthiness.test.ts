// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';

import {LIB, withProject} from './helpers.ts';

import {scanProject} from '../src/cli.ts';
import {loadConfig} from '../src/config.ts';
import {isTruthy} from '../src/values/algebra.ts';

test('unreadable gap types prove no truthiness while nonempty text remains truthy', () => {
    for (const type of ['?', '', ' ', 'unknown', 'any', 'boolean']) {
        const gap = {gap: {kind: 'string' as const, type, expr: 'value'}};
        assert.equal(isTruthy({k: 'pat', parts: [gap]}), false, type);
        assert.equal(isTruthy({k: 'pat', parts: ['prefix', gap]}), true, type);
    }
    assert.equal(isTruthy({k: 'pat', parts: [{gap: {kind: 'string', type: '{active: boolean}', expr: 'object'}}]}), false, 'a conservative type summary may leave object truthiness unproven');
});

test('unknown tuple state keeps loading and ready parts; known objects still prune the impossible branch', () => {
    withProject(['source.tsx', LIB], (root) => {
        const config = path.join(root, 'config.json');
        fs.writeFileSync(path.join(root, 'source.tsx'), [
            'import React,{useState} from "react";',
            'class List extends React.Component<{testId:string;loading:unknown;custom:unknown}> {render(){let result;if(this.props.loading){result=<span data-testid={this.props.testId+".loading--text"}/>;}else{result=<div data-testid={this.props.testId}><span data-testid={this.props.testId+".selection--text"}/>{this.props.custom ? null : <span data-testid={this.props.testId+".no_results--text"}/>}</div>;}return <div data-testid={this.props.testId+".live_region"}>{result}</div>;}}',
            'declare const feature:boolean; declare function readObject():{active:boolean};',
            'export function App(){const [loading,setLoading]=useState(true); const object=readObject(); return <><List testId="tuple.results" loading={loading} custom={feature ? <div/> : null}/><List testId="object.results" loading={object} custom={null}/><List testId="false.results" loading={false} custom={null}/></>;}',
        ].join('\n'));
        const out = scanProject(loadConfig(config));
        const templates = new Set(out.manifest.elements.map((element) => element.template));
        for (const template of ['tuple.results', 'tuple.results.selection--text', 'tuple.results.no_results--text', 'tuple.results.loading--text', 'tuple.results.live_region', 'object.results.loading--text', 'object.results.live_region', 'false.results.selection--text']) {
            assert.ok(templates.has(template), `missing ${template}: ${[...templates].join(', ')}`);
        }
        for (const template of ['object.results', 'object.results.selection--text', 'object.results.no_results--text', 'false.results.loading--text']) {
            assert.ok(!templates.has(template), template);
        }
    });
});
