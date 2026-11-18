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

/* eslint-disable no-template-curly-in-string -- fixture source */

test('a literal prop passed at every mount keys the testid by the set of those literals', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-literal-props-'));
    try {
        installFixtureCompiler(root);
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['source.tsx', path.join(FIXTURES, '_lib')]}));
        fs.writeFileSync(path.join(root, 'test-surface.config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], checks: {}, output: {report: 'surface.json'}}));
        fs.writeFileSync(path.join(root, 'source.tsx'), [
            "import React from 'react';",
            'type Props = {title: string; id?: string; count?: number};',
            'const StatisticCount = ({title, id, count}: Props) => <div data-testid={id ? `stats.stat:${id}--region` : undefined}>{title}{count}</div>;',
            'class LineChart extends React.PureComponent<{id: string; title: string}> {render() {return <div data-testid={`stats.chart:${this.props.id}--region`}>{this.props.title}</div>;}}',
            'export class Analytics extends React.PureComponent<{show: boolean}> {',
            '    render() {',
            '        let postCount;',
            '        if (this.props.show) {',
            "            postCount = (<StatisticCount id='totalPosts' title='Posts' count={1}/>);",
            '        }',
            "        const userCount = (<StatisticCount id='totalUsers' title='Users'/>);",
            "        const teamCount = (<StatisticCount id='totalTeams' title='Teams'/>);",
            "        const channelCount = (<StatisticCount id='totalChannels' title='Channels'/>);",
            "        const fileCount = (<StatisticCount id='totalFiles' title='Files'/>);",
            "        return <div data-testid='stats'>{postCount}{userCount}{teamCount}{channelCount}{fileCount}<LineChart id='totalPostsChart' title='Posts'/><LineChart id='activeUsersChart' title='Users'/><LineChart id='botPostsChart' title='Bots'/><LineChart id='sessionsChart' title='Sessions'/></div>;",
            '    }',
            '}',
        ].join('\n'));
        const scanned = scanProject(loadConfig(path.join(root, 'test-surface.config.json')));
        const errors = scanned.diagnostics.filter((diagnostic) => diagnostic.rule === 'key-origin' && diagnostic.severity === 'error');
        assert.deepEqual(errors.map((error) => error.message), []);
        const parts = scanned.report.families[scanned.report.scopes.stats.family].parts ?? {};
        for (const [name, values] of Object.entries({stat: ['totalChannels', 'totalFiles', 'totalPosts', 'totalTeams', 'totalUsers'], chart: ['activeUsersChart', 'botPostsChart', 'sessionsChart', 'totalPostsChart']})) {
            const key = parts[name]?.key;
            assert.ok(key && key.kind === 'set', `${name}: ${JSON.stringify(parts[name])}`);
            assert.deepEqual(scanned.report.sets[key.set], values, name);
        }
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});

test('a mount whose value cannot be read is named in the key-origin message, not only the prop it was passed to', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-literal-props-'));
    try {
        installFixtureCompiler(root);
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['source.tsx', path.join(FIXTURES, '_lib')]}));
        fs.writeFileSync(path.join(root, 'test-surface.config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], checks: {}, output: {report: 'surface.json'}}));
        fs.writeFileSync(path.join(root, 'source.tsx'), [
            "import React from 'react';",
            'const StatisticCount = ({id}: {id?: string}) => <div data-testid={id ? `stats.stat:${id}--region` : undefined}/>;',
            'declare function statId(name: string): string;',
            "export function Analytics() {return <div data-testid='stats'><StatisticCount id='totalUsers'/><StatisticCount id={statId('plugin')}/></div>;}",
        ].join('\n'));
        const scanned = scanProject(loadConfig(path.join(root, 'test-surface.config.json')));
        const open = scanned.diagnostics.filter((diagnostic) => diagnostic.rule === 'key-origin' && diagnostic.message.includes('open string'));
        assert.equal(open.length, 1, open.map((diagnostic) => diagnostic.message).join('\n'));
        assert.match(open[0].message, /\(id: string, from source\.tsx:4:\d+\)/);
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});
