// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-template-curly-in-string -- cases quote template-literal syntax */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {test} from 'node:test';

import {FIXTURES, installFixtureCompiler} from './helpers.ts';

import {scanProject} from '../src/cli.ts';
import {loadConfig} from '../src/config.ts';

/** The duplicate diagnostics of a one-file app. */
function duplicates(lines: string[]): string[] {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-duplicates-'));
    try {
        installFixtureCompiler(root);
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['*.tsx', path.join(FIXTURES, '_lib')]}));
        fs.writeFileSync(path.join(root, 'test-surface.config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], output: {report: 'surface.json'}}));
        fs.writeFileSync(path.join(root, 'source.tsx'), ["import React from 'react';", ...lines].join('\n'));
        return scanProject(loadConfig(path.join(root, 'test-surface.config.json'))).diagnostics.filter((d) => d.rule === 'duplicates').map((d) => d.message);
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
}

test('duplicates: an earlier if makes a later element exclusive when its element is returned or its arm always leaves', () => {
    assert.deepEqual(duplicates([
        'export function Panel({a}: {a: boolean}) {',
        "    if (a) {return <section data-testid='panel'><i data-testid='panel.mark--text'/></section>;}",
        "    return <section data-testid='panel'><i data-testid='panel.mark--text'/></section>;",
        '}',
    ]).filter((m) => m.includes('panel.mark')), [], 'the arm always returns');
    assert.deepEqual(duplicates([
        'export function Panel({a, b}: {a: boolean; b: boolean}) {',
        "    if (a) {if (b) {return <section data-testid='panel'><i data-testid='panel.mark--text'/></section>;}}",
        "    return <section data-testid='panel'><i data-testid='panel.mark--text'/></section>;",
        '}',
    ]).filter((m) => m.includes('panel.mark')), [], 'the earlier element renders only by returning');
    const callback = duplicates([
        'export function Panel({a}: {a: boolean}) {',
        '    let make = (): React.ReactNode => null;',
        "    if (a) {make = () => {return <i data-testid='panel.mark--text'/>;};}",
        "    return <section data-testid='panel'>{make()}<i data-testid='panel.mark--text'/></section>;",
        '}',
    ]);
    assert.ok(callback.some((m) => m.includes('panel.mark--text')), `a return inside a callback leaves the callback, not the render: ${callback.join('\n')}`);
    const nested = duplicates([
        'export function Panel({a, b}: {a: boolean; b: boolean}) {',
        '    const marks: React.ReactNode[] = [];',
        "    if (a) {marks.push(<i data-testid='panel.mark--text'/>); if (b) {return null;}}",
        "    return <section data-testid='panel'>{marks}<i data-testid='panel.mark--text'/></section>;",
        '}',
    ]);
    assert.ok(nested.some((m) => m.includes('panel.mark--text')), `a return that does not always run leaves both: ${nested.join('\n')}`);
});

test('duplicates: a keyed template filled at run time is compared across sites of one file that render together', () => {
    const together = duplicates([
        'export function Lists({pinned, recent}: {pinned: Array<{id: string}>; recent: Array<{id: string}>}) {',
        "    return <section data-testid='lists'>{pinned.map((c) => <a key={c.id} data-testid={`lists.channel:${c.id}--link`}/>)}{recent.map((c) => <a key={c.id} data-testid={`lists.channel:${c.id}--link`}/>)}</section>;",
        '}',
    ]);
    assert.ok(together.some((m) => m.includes('lists.channel:{key}--link')), `two lists in one scope can render the same key: ${together.join('\n')}`);
    assert.deepEqual(duplicates([
        'export function Lists({mode, items}: {mode: boolean; items: Array<{id: string}>}) {',
        "    return <section data-testid='lists'>{mode ? items.map((c) => <a key={c.id} data-testid={`lists.channel:${c.id}--link`}/>) : items.map((c) => <a key={c.id} data-testid={`lists.channel:${c.id}--link`}/>)}</section>;",
        '}',
    ]), [], 'exclusive arms');
    assert.deepEqual(duplicates([
        'export function Lists({items}: {items: Array<{id: string}>}) {',
        "    return <section data-testid='lists'>{items.map((c) => <a key={c.id} data-testid={`lists.channel:${c.id}--link`}/>)}</section>;",
        '}',
    ]), [], 'one site');
});
