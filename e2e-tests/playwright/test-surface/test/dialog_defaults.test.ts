// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// A dialogType forward declares nothing, but it may never hide a component choice: a default is a definition, and a
// registry or binding that code can write to after it is built is not finite.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {test} from 'node:test';

import {FIXTURES, installFixtureCompiler} from './helpers.ts';

import {scanProject} from '../src/cli.ts';
import {loadConfig} from '../src/config.ts';

const COMPONENTS = 'function One(){return <button data-testid="one.close--button"/>;} function Two(){return <button data-testid="two.close--button"/>;}';

/** Scans one source file; returns the components it mounts (candidates included) and whether a dialogType input error was reported. */
function scan(source: string, extra: Record<string, string> = {}): {mounted: string[]; error: boolean} {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-dialog-defaults-'));
    try {
        installFixtureCompiler(root);
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['*.tsx', '*.ts', path.join(FIXTURES, '_lib')]}));
        fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], client: {file: 'client.ts', className: 'Client4', urlVersion: '/api/v4'}, output: {report: 'surface.json'}}));
        fs.writeFileSync(path.join(root, 'client.ts'), 'export class Client4 {doFetch<T>(url: string, options: unknown): Promise<T> {throw new Error(url);} users = () => this.doFetch("/api/v4/users", {method: "GET"});}');
        fs.writeFileSync(path.join(root, 'source.tsx'), `${COMPONENTS} ${source}`);
        for (const [file, text] of Object.entries(extra)) {
            fs.writeFileSync(path.join(root, file), text);
        }
        const result = scanProject(loadConfig(path.join(root, 'config.json')));
        return {
            mounted: result.manifest.components.map((component) => component.name).sort(),
            error: result.diagnostics.some((d) => d.severity === 'error' && d.rule === 'input' && d.message.includes('dialogType')),
        };
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
}

test('a forward through a const binding declares nothing and is no error', () => {
    assert.deepEqual(scan('declare const data: {dialogType: unknown}; const {dialogType} = data; export const descriptor = {dialogType};'), {mounted: [], error: false});
    assert.deepEqual(scan('export function open({dialogType}: {dialogType: unknown}) { return {dialogType}; }'), {mounted: [], error: false});
});

test('the default of a forward\'s binding is a definition: a candidate when it resolves, an error when it does not', () => {
    assert.deepEqual(scan('declare const data: {dialogType?: unknown}; const {dialogType = One} = data; export const descriptor = {dialogType};'), {mounted: ['One'], error: false});
    assert.deepEqual(scan('export function open({dialogType = Two}: {dialogType?: unknown}) { return {dialogType}; }'), {mounted: ['Two'], error: false});
    assert.deepEqual(scan('declare const data: {dialogType?: unknown}; declare const unknown: unknown; const {dialogType = unknown} = data; export const descriptor = {dialogType};'), {mounted: [], error: true});
});

test('a registry is finite only when it is a const nothing writes to', () => {
    assert.deepEqual(scan('const registry = {one: One, two: Two}; declare const id: "one" | "two"; export const descriptor = {dialogType: registry[id]};'), {mounted: ['One', 'Two'], error: false});
    for (const write of [
        'registry.later = Two;',
        'registry["later"] = Two;',
        'Object.assign(registry, {later: Two});',
        'Object.defineProperty(registry, "later", {value: Two});',
        'delete registry.one;',
    ]) {
        assert.equal(scan(`const registry: Record<string, unknown> = {one: One}; ${write} declare const id: string; export const descriptor = {dialogType: registry[id]};`).error, true, write);
    }
    assert.equal(scan('let registry: Record<string, unknown> = {one: One}; declare const id: string; export const descriptor = {dialogType: registry[id]};').error, true, 'a let registry');

    // anything that can reach it other than a member read can add a choice
    for (const escape of [
        'const alias = registry; alias.later = Two;',
        'declare function mutate(r: object): void; mutate(registry);',
        'export {registry};',
        'export default registry;',
        'export function get() { return registry; }',
        'const copy = {...registry};',
    ]) {
        assert.equal(scan(`const registry: Record<string, unknown> = {one: One}; ${escape} declare const id: string; export const descriptor = {dialogType: registry[id]};`).error, true, escape);
    }
    assert.equal(scan('export const registry: Record<string, unknown> = {one: One}; declare const id: string; export const descriptor = {dialogType: registry[id]};').error, true, 'an exported registry');

    // only the standard library's Object reads without writing: a local one is any other helper
    assert.equal(scan('const Object = {keys(x: Record<string, unknown>) { x.later = Two; return []; }}; const registry: Record<string, unknown> = {one: One}; Object.keys(registry); declare const id: string; export const descriptor = {dialogType: registry[id]};').error, true, 'a local Object');
    assert.equal(scan('import {Object} from "./objects"; const registry: Record<string, unknown> = {one: One}; Object.keys(registry); declare const id: string; export const descriptor = {dialogType: registry[id]};', {'objects.ts': 'export const Object = {keys(x: Record<string, unknown>) { return [x]; }};'}).error, true, 'an imported Object');

    // a member read and a type query are not escapes
    assert.deepEqual(scan('const registry = {one: One, two: Two}; type Ids = keyof typeof registry; declare const id: Ids; const first = registry.one; const ids = new Set(Object.keys(registry)); export const descriptor = {dialogType: registry[id]}; export const used = [first, ids];'), {mounted: ['One', 'Two'], error: false});
});

test('a reassigned or let binding is not a forward: it is resolved, and fails when it cannot be', () => {
    for (const source of [
        'declare const data: {dialogType: unknown}; let {dialogType} = data; dialogType = Two; export const descriptor = {dialogType};',
        'declare const data: {dialogType: unknown}; declare const other: {dialogType: unknown}; let {dialogType} = data; ({dialogType} = other); export const descriptor = {dialogType};',
        'declare const data: {dialogType: unknown}; let {dialogType} = data; export const descriptor = {dialogType};',
    ]) {
        assert.equal(scan(source).error, true, source);
    }
});
