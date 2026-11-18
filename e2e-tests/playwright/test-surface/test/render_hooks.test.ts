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
import {MAX_HELD_JSX_HOPS} from '../src/limits.ts';

/**
 * A composer whose priority picker is built in a hook and rendered by a child through a prop, the hook's memo written
 * as `hookMemo` (with `hookImport`), the editor's as `editorMemo` (with `editorImport`), and `collect` the editor's
 * lines between the hook call and its render (they leave the controls in `additionalControls`).
 */
function scanComposer(opts: {hookImport?: string; hookMemo?: string; editorImport?: string; editorMemo?: string; collect?: string[]} = {}) {
    const hookImport = opts.hookImport ?? "import {useMemo} from 'react';";
    const hookMemo = opts.hookMemo ?? 'useMemo';
    const editorImport = opts.editorImport ?? "import {useMemo} from 'react';";
    const editorMemo = opts.editorMemo ?? 'useMemo';
    const collect = opts.collect ?? [`    const additionalControls = ${editorMemo}(() => [priorityAdditionalControl].filter(Boolean), [priorityAdditionalControl]);`];
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-render-hooks-'));
    try {
        installFixtureCompiler(root);
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['*.tsx', path.join(FIXTURES, '_lib')]}));
        fs.writeFileSync(path.join(root, 'test-surface.config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], output: {report: 'surface.json'}}));
        fs.writeFileSync(path.join(root, 'picker.tsx'), [
            "import React from 'react';",
            "export function PriorityPicker({disabled}: {disabled?: boolean}) {return <div><button data-testid='priority_picker.open--button' disabled={disabled}/></div>;}",
        ].join('\n'));
        fs.writeFileSync(path.join(root, 'use_priority.tsx'), [
            "import React from 'react'; import {PriorityPicker} from './picker';",
            hookImport,
            'export function usePriority(enabled: boolean) {',
            `    const additionalControl = ${hookMemo}(() => enabled && <PriorityPicker key="picker"/>, [enabled]);`,
            `    const labels = ${hookMemo}(() => null, []);`,
            '    return {labels, additionalControl};',
            '}',
        ].join('\n'));
        fs.writeFileSync(path.join(root, 'editor.tsx'), [
            "import React from 'react'; import {usePriority} from './use_priority';",
            editorImport,
            'function FormattingBar({additionalControls}: {additionalControls?: readonly React.ReactNode[]}) {',
            '    return <div>{Array.isArray(additionalControls) && additionalControls.length > 0 && <span>{additionalControls}</span>}</div>;',
            '}',
            'export function Editor({enabled}: {enabled: boolean}) {',
            '    const {additionalControl: priorityAdditionalControl} = usePriority(enabled);',
            ...collect,
            "    return <div data-testid='composer'><FormattingBar additionalControls={additionalControls}/><button data-testid='composer.send--button'/></div>;",
            '}',
            "export function ThreadEditor() {return <div data-testid='thread_composer'><FormattingBar additionalControls={[]}/><button data-testid='thread_composer.send--button'/></div>;}",
        ].join('\n'));
        const scanned = scanProject(loadConfig(path.join(root, 'test-surface.config.json')));
        const renders = (scope: string) => scanned.report.families[scanned.report.scopes[scope].family].renders;
        return {renders, diagnostics: scanned.diagnostics};
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
}

test('a scope rendered by JSX a hook returns, passed down as a prop and rendered by a child, is in the container\'s renders', () => {
    const {renders} = scanComposer();
    assert.deepEqual(renders('composer'), ['priority_picker']);
    assert.equal(renders('thread_composer'), undefined, 'a mount that passes no picker renders none');
});

test('an element passed as a prop through a forwarding component renders only at the mount that passes it', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-render-hooks-'));
    try {
        installFixtureCompiler(root);
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['*.tsx', path.join(FIXTURES, '_lib')]}));
        fs.writeFileSync(path.join(root, 'test-surface.config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], output: {report: 'surface.json'}}));
        fs.writeFileSync(path.join(root, 'source.tsx'), [
            "import React from 'react';",
            "function Picker() {return <button data-testid='picker.open--button'/>;}",
            'function Slot({control}: {control: React.ReactNode}) {return <span>{control}</span>;}',
            'function Frame({control}: {control: React.ReactNode}) {return <div><Slot control={control}/></div>;}',
            "export function Left() {return <div data-testid='left'><Frame control={<Picker/>}/><button data-testid='left.send--button'/></div>;}",
            "export function Right() {return <div data-testid='right'><Frame control={null}/><button data-testid='right.send--button'/></div>;}",
        ].join('\n'));
        const scanned = scanProject(loadConfig(path.join(root, 'test-surface.config.json')));
        const renders = (scope: string) => scanned.report.families[scanned.report.scopes[scope].family].renders;
        assert.deepEqual(renders('left'), ['picker']);
        assert.equal(renders('right'), undefined, 'the mount passing null renders no picker');
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});

test('a shared modal shell exposes only the children rendered at each mount', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-modal-mounts-'));
    try {
        installFixtureCompiler(root);
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['*.tsx', path.join(FIXTURES, '_lib')]}));
        fs.writeFileSync(path.join(root, 'test-surface.config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], output: {report: 'surface.json'}}));
        fs.writeFileSync(path.join(root, 'source.tsx'), [
            "import React from 'react';",
            // eslint-disable-next-line no-template-curly-in-string -- fixture source
            'function Shell({testId, children}: {testId: string; children: React.ReactNode}) {return <div data-testid={testId}><span data-testid={`${testId}.title--text`}/>{children}</div>;}',
            "function Alpha() {return <section data-testid='alpha'><span data-testid='alpha.label--text'/></section>;}",
            "function Beta() {return <section data-testid='beta'><span data-testid='beta.label--text'/></section>;}",
            "export function First() {return <Shell testId='first_modal'><Alpha/></Shell>;}",
            "export function Second() {return <Shell testId='second_modal'><Beta/></Shell>;}",
            "export function Third() {return <Shell testId='third_modal'>{null}</Shell>;}",
            "export function Fourth() {return <Shell testId='fourth_modal' children={<Alpha/>}/>;}",
        ].join('\n'));
        const scanned = scanProject(loadConfig(path.join(root, 'test-surface.config.json')));
        const renders = (scope: string) => scanned.report.families[scanned.report.scopes[scope].family].renders;
        assert.deepEqual(renders('first_modal'), ['alpha']);
        assert.deepEqual(renders('second_modal'), ['beta']);
        assert.equal(renders('third_modal'), undefined);
        assert.deepEqual(renders('fourth_modal'), ['alpha']);
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});

test('React\'s useMemo is recognised by what it resolves to: an import alias and a namespace import', () => {
    const aliased = scanComposer({hookImport: "import {useMemo as memo} from 'react';", hookMemo: 'memo', editorImport: "import {useMemo as memo} from 'react';", editorMemo: 'memo'});
    assert.deepEqual(aliased.renders('composer'), ['priority_picker'], 'an alias');
    const namespaced = scanComposer({hookImport: "import * as R from 'react';", hookMemo: 'R.useMemo', editorImport: "import * as R from 'react';", editorMemo: 'R.useMemo'});
    assert.deepEqual(namespaced.renders('composer'), ['priority_picker'], 'a namespace import');
});

test('a local function named useMemo that ignores its factory is not React\'s, and renders nothing it is given', () => {
    const shadow = 'function useMemo<T>(_factory: () => T, _deps: unknown[]): null {return null;}';
    const {renders} = scanComposer({hookImport: shadow, editorImport: shadow});
    assert.equal(renders('composer'), undefined);
});

test('held JSX is followed through a long chain of names, and past its budget the cut is reported', () => {
    const chain = (length: number) => [
        '    const chain0 = useMemo(() => [priorityAdditionalControl].filter(Boolean), [priorityAdditionalControl]);',
        ...Array.from({length}, (_, index) => `    const chain${index + 1} = chain${index};`),
        `    const additionalControls = chain${length};`,
    ];
    const long = scanComposer({collect: chain(50)});
    assert.deepEqual(long.renders('composer'), ['priority_picker']);
    assert.deepEqual(long.diagnostics.filter((diagnostic) => diagnostic.severity === 'error'), []);
    const cut = scanComposer({collect: chain(MAX_HELD_JSX_HOPS + 10)});
    assert.equal(cut.renders('composer'), undefined);
    assert.ok(cut.diagnostics.some((diagnostic) => diagnostic.rule === 'input' && diagnostic.severity === 'error' && diagnostic.message.includes(`more than ${MAX_HELD_JSX_HOPS} names`)), JSON.stringify(cut.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')));
});
