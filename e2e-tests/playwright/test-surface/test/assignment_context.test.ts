// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {test} from 'node:test';

import {FIXTURES, installFixtureCompiler, LIB, withProject} from './helpers.ts';

import {scanProject} from '../src/cli.ts';
import {loadConfig} from '../src/config.ts';
import {concat, distribute, lit, perInstance, TOO_MANY_VALUES} from '../src/values.ts';

test('a truncated guard keeps proven mount values and marks the remainder without a global literal', () => {
    const values = distribute([lit('panel.save--button')], {vals: [lit('true', ['matching'], 'boolean'), lit('false', ['other'], 'boolean'), {k: 'unres', why: TOO_MANY_VALUES, at: 'guard'}], negate: false}, true);
    assert.deepEqual(values.filter((value) => value.k === 'lit'), [lit('panel.save--button', ['matching'])]);
    assert.ok(values.some((value) => value.k === 'unres' && value.why === TOO_MANY_VALUES));
});

test('a context-free unknown does not erase the known usage of a guarded value', () => {
    const values = perInstance([lit('panel.')], {vals: [lit('true', ['known']), {k: 'unres', why: 'runtime-value', at: 'unknown'}]});
    assert.deepEqual(values.filter((value) => value.k === 'lit'), [lit('panel.', ['known'])]);
    assert.ok(!concat(values, [lit('save--button', ['other'])]).some((value) => value.k === 'lit'));
});

test('usage variants of one template do not consume the distinct-template budget', () => {
    const prefixes = Array.from({length: 300}, (_, index) => lit('panel.', [`mount:${index}`]));
    const names = Array.from({length: 300}, (_, index) => lit('save--button', [`mount:${index}`]));
    const values = concat(prefixes, names);
    assert.equal(values.length, 300);
    assert.ok(values.every((value) => value.k === 'lit' && value.s === 'panel.save--button'));
    assert.ok(!values.some((value) => value.k === 'unres' && value.why === TOO_MANY_VALUES));
});

test('guarded scope assignments retain only the mounts matching literal equality and disjunction', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-assignment-context-'));
    try {
        installFixtureCompiler(root);
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['source.tsx']}));
        fs.writeFileSync(path.join(root, 'test-surface.config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], output: {report: 'surface.json'}}));
        fs.writeFileSync(path.join(root, 'source.tsx'), [
            'const Locations = {CENTER: "CENTER", RHS: "RHS", COMMENT: "COMMENT", MODAL: "MODAL"} as const;',
            'type Location = typeof Locations[keyof typeof Locations]; function Post(props: {location: Location}) {let scope: string | undefined; if (props.location === Locations.CENTER) {scope = "center.post";} else if (props.location === Locations.RHS || props.location === Locations.COMMENT) {scope = "rhs.post";}',
            // eslint-disable-next-line no-template-curly-in-string -- fixture source
            'return <span data-testid={scope ? `${scope}.body--text` : undefined}/>;}',
            'export function Center() {return <Post location={Locations.CENTER}/>;} export function Thread() {return <Post location={Locations.RHS}/>;} export function Modal() {return <Post location={Locations.MODAL}/>;}',
            'export function External(props: {location: Location}) {return <Post location={props.location}/>;}',
        ].join('\n'));
        const scanned = scanProject(loadConfig(path.join(root, 'test-surface.config.json')));
        const source = fs.readFileSync(path.join(root, 'source.tsx'), 'utf8');
        const mountAt = (name: string) => {
            const prefix = source.slice(0, source.indexOf('<Post', source.indexOf(`function ${name}(`)));
            const lines = prefix.split('\n');
            return `source.tsx:${lines.length}:${lines[lines.length - 1].length + 1}`;
        };
        const center = scanned.manifest.elements.find((element) => element.template === 'center.post.body--text');
        const rhs = scanned.manifest.elements.find((element) => element.template === 'rhs.post.body--text');
        assert.ok(center && rhs);
        assert.ok(center?.instances.some((instance) => instance.via.some((loc) => loc === mountAt('Center'))), JSON.stringify(center));
        assert.ok(rhs?.instances.some((instance) => instance.via.some((loc) => loc === mountAt('Thread'))), JSON.stringify(rhs));
        assert.equal(center.instances.some((instance) => instance.via.some((loc) => loc === mountAt('Modal'))), false, JSON.stringify(center));
        assert.equal(rhs.instances.some((instance) => instance.via.some((loc) => loc === mountAt('Modal'))), false, JSON.stringify(rhs));
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});

test('local-state guards keep their arms paired and helper assignments use each invocation environment', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-guard-environment-'));
    try {
        installFixtureCompiler(root);
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['source.tsx']}));
        fs.writeFileSync(path.join(root, 'test-surface.config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], output: {report: 'surface.json'}}));
        fs.writeFileSync(path.join(root, 'source.tsx'), [
            'declare function readState(): boolean;',
            'function makeId(prefix: string, value: string) {let base = prefix; let scope; let name; if (readState()) {scope = base; name = value;} else {scope = "fallback"; name = "cancel";} return scope + "." + name + "--button";}',
            'export function App() {return <div><button data-testid={makeId("first", "save")}/><button data-testid={makeId("second", "close")}/></div>;}',
        ].join('\n'));
        const scanned = scanProject(loadConfig(path.join(root, 'test-surface.config.json')));
        const first = scanned.result.emissions.filter((emission) => emission.site.expr?.getText() === 'makeId("first", "save")').map((emission) => emission.template);
        const second = scanned.result.emissions.filter((emission) => emission.site.expr?.getText() === 'makeId("second", "close")').map((emission) => emission.template);
        assert.deepEqual([...new Set(first)].sort(), ['fallback.cancel--button', 'first.save--button']);
        assert.deepEqual([...new Set(second)].sort(), ['fallback.cancel--button', 'second.close--button']);
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});

test('exclusive derivations of the same testid at one landing produce one emission', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-emission-identity-'));
    try {
        installFixtureCompiler(root);
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['source.tsx']}));
        fs.writeFileSync(path.join(root, 'test-surface.config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], output: {report: 'surface.json'}}));
        fs.writeFileSync(path.join(root, 'source.tsx'), 'function Button({flag}: {flag: boolean}) {let scope; if (flag) {scope = "panel";} else {scope = "panel";} return <button data-testid={scope + ".save--button"}/>;} declare const flag: boolean; export function App() {return <Button flag={flag}/>;}');
        const scanned = scanProject(loadConfig(path.join(root, 'test-surface.config.json')));
        assert.equal(scanned.result.emissions.filter((emission) => emission.template === 'panel.save--button').length, 1);
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});

test('only straight-line let assignments remove initial absence', () => {
    withProject(['source.tsx', LIB], (root) => {
        const config = path.join(root, 'config.json');
        const compound = 'if (this.props.message && !this.props.searchTerm) {custom = this.props.message;}';
        const cases = [
            ['let custom;', compound, true, true],
            ['let custom = undefined;', compound, true, true],
            ['let custom;', 'if (flag) {custom = this.props.message;}', true, true],
            ['let custom;', 'custom = this.props.message;', false, true],
            ['let custom = undefined;', 'custom = this.props.message;', false, true],
            ['let custom;', 'if (true) {custom = this.props.message;}', true, true],
            ['let custom;', 'if (false) {custom = this.props.message;}', true, false],
            ['let custom;', 'if (flag) {custom = this.props.message;} else {custom = this.props.message;}', true, true],
            ['let custom;', 'if (this.props.message) {if (flag) {custom = this.props.message;}}', true, true],
            ['let custom;', 'flag && (custom = this.props.message);', true, true],
            ['let custom;', 'flag || (custom = this.props.message);', true, true],
            ['let custom;', 'flag ? (custom = this.props.message) : null;', true, true],
            ['let custom;', 'while (flag) {custom = this.props.message; break;}', true, true],
            ['let custom;', 'const callback = () => {custom = this.props.message;};', true, true],
            ['let custom;', 'switch (flag) {case true: custom = this.props.message;}', true, true],
            ['let custom;', 'try {custom = this.props.message;} catch {}', true, true],
            ['let custom;', 'existing ?? (custom = this.props.message);', true, true],
            ['let custom;', '"present" ?? (custom = this.props.message);', true, false],
            ['let custom;', 'undefined ?? (custom = this.props.message);', true, true],
        ] as const;
        for (const [declaration, assignment, missing, assigned] of cases) {
            fs.writeFileSync(path.join(root, 'source.tsx'), [
                'import React from "react"; declare const flag:boolean; declare const term:string; declare const message:{node:true}; declare const existing:unknown;',
                'class List extends React.Component<{custom:unknown}> {render(){if(this.props.custom){return <div data-testid="picker.custom--text"/>;}return <div data-testid="picker.no_results--text"/>;}}',
                `class Selector extends React.Component<{message:{node:true};searchTerm:string}> {render(){${declaration} ${assignment} return <List custom={custom}/>;}}`,
                'export function App(){return <Selector message={message} searchTerm={term}/>;}',
            ].join('\n'));
            const out = scanProject(loadConfig(config));
            const templates = new Set(out.manifest.elements.map((element) => element.template));
            const label = `${declaration} ${assignment}: ${[...templates].join(', ')}`;
            assert.equal(templates.has('picker.no_results--text'), missing, label);
            assert.equal(templates.has('picker.custom--text'), assigned, label);
        }
        fs.writeFileSync(path.join(root, 'source.tsx'), [
            'import React from "react"; declare const message:{node:true};',
            'class List extends React.Component<{custom:unknown}> {render(){if(this.props.custom){return <div data-testid="picker.custom--text"/>;}return <div data-testid="picker.no_results--text"/>;}}',
            'export function App(){let custom; const earlier=read(); custom=message; function read(){return custom;} return <List custom={earlier}/>;}',
        ].join('\n'));
        const earlierRead = scanProject(loadConfig(config));
        assert.ok(earlierRead.manifest.elements.some((element) => element.template === 'picker.no_results--text'), 'a hoisted helper can execute before a lexically preceding write');
    });
});
