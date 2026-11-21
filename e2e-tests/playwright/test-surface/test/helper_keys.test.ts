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

test('render helper arguments keep built-in and plugin tab names paired with their own key origins', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-helper-keys-'));
    try {
        installFixtureCompiler(root);
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['*.tsx', path.join(FIXTURES, '_lib')]}));
        fs.writeFileSync(path.join(root, 'test-surface.config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], checks: {keyFields: {allow: [{entity: 'SidebarTab', module: './source', field: 'name', value: 'plugin_tab', reason: 'The plugin tab is identified by the name the modal gives it.'}]}}, output: {report: 'surface.json'}}));
        fs.writeFileSync(path.join(root, 'source.tsx'), [
            'type SidebarTab = {name: string}; type Registration = {id: string}; declare const registrations: Registration[];',
            'const builtIns = [{name: "info"}, {name: "members"}] as const;',
            'function getPluginTabName(id: string) {return "plugin_" + id;} const pluginTabs: SidebarTab[] = registrations.map((registration) => ({name: getPluginTabName(registration.id)}));',
            // eslint-disable-next-line no-template-curly-in-string -- fixture source
            'function renderTab(tab: SidebarTab, name: "tab" | "plugin") {return <button role="tab" data-testid={`sidebar.tabs.${name}:${tab.name}--tab`}/>;}',
            'export function Sidebar() {return <div>{builtIns.map((tab) => renderTab(tab, "tab"))}{pluginTabs.map((tab) => renderTab(tab, "plugin"))}</div>;}',
        ].join('\n'));
        const scanned = scanProject(loadConfig(path.join(root, 'test-surface.config.json')));
        assert.deepEqual(scanned.diagnostics.filter((diagnostic) => diagnostic.rule === 'key-origin'), []);
        const tab = scanned.manifest.elements.find((element) => element.template === 'sidebar.tabs.tab:{key}--tab');
        const plugin = scanned.manifest.elements.find((element) => element.template === 'sidebar.tabs.plugin:{key}--tab');
        assert.equal(tab?.key?.kind, 'set', JSON.stringify(scanned.manifest.elements));
        assert.deepEqual(tab?.key?.values, ['info', 'members']);
        assert.equal(plugin?.key?.kind, 'id');
        assert.equal(plugin?.key?.value, 'plugin_tab');
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});

test('defaulted method flags pair each tab key with its own array callback call site', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-method-keys-'));
    try {
        installFixtureCompiler(root);
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['*.tsx', path.join(FIXTURES, '_lib')]}));
        fs.writeFileSync(path.join(root, 'test-surface.config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], checks: {keyFields: {allow: [{entity: 'SidebarTab', module: './source', field: 'name', value: 'plugin_tab', reason: 'Plugin registration tab name.'}]}}, output: {report: 'surface.json'}}));
        fs.writeFileSync(path.join(root, 'source.tsx'), [
            "import React from 'react';",
            'type SidebarTab = {name: string}; declare const plugins: SidebarTab[]; const builtIns = [{name: "info"}, {name: "members"}] as const;',
            'class Sidebar extends React.Component<{testIdScope: string; tabs: SidebarTab[]; pluginTabs: SidebarTab[]}> {',
            'renderTab(tab: SidebarTab, isPluginTab = false) {',
            // eslint-disable-next-line no-template-curly-in-string -- fixture source
            'let testId = `${tab.name}-tab-button`; if (this.props.testIdScope) {testId = isPluginTab ? `${this.props.testIdScope}.tabs.plugin:${tab.name}--tab` : `${this.props.testIdScope}.tabs.tab:${tab.name}--tab`;} return <button role="tab" data-testid={testId}/>;}',
            'render() {return <div>{this.props.tabs.map((tab) => this.renderTab(tab))}{this.props.pluginTabs.map((tab) => this.renderTab(tab, true))}</div>;}}',
            'export function App() {return <Sidebar testIdScope="sidebar" tabs={builtIns} pluginTabs={plugins}/>;}',
        ].join('\n'));
        const scanned = scanProject(loadConfig(path.join(root, 'test-surface.config.json')));
        assert.deepEqual(scanned.diagnostics.filter((diagnostic) => diagnostic.rule === 'key-origin'), []);
        const tab = scanned.manifest.elements.find((element) => element.template === 'sidebar.tabs.tab:{key}--tab');
        const plugin = scanned.manifest.elements.find((element) => element.template === 'sidebar.tabs.plugin:{key}--tab');
        assert.equal(tab?.key?.kind, 'set', JSON.stringify(scanned.manifest.elements));
        assert.deepEqual(tab?.key?.values, ['info', 'members']);
        assert.equal(plugin?.key?.kind, 'id');
        assert.equal(plugin?.key?.value, 'plugin_tab');
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});
