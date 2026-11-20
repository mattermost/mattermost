// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';

import {LIB, withProject} from './helpers.ts';

import {scanProject} from '../src/cli.ts';
import {loadConfig} from '../src/config.ts';

test('library roles use canonical exports through swapped aliases, namespaces, const aliases and styled wrappers', () => {
    withProject(['source.tsx', LIB], (root) => {
        const pkg = path.join(root, 'node_modules/@mattermost/compass-ui');
        fs.mkdirSync(pkg, {recursive: true});
        fs.writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({name: '@mattermost/compass-ui', version: '1.0.0', types: 'index.d.ts'}));
        fs.writeFileSync(path.join(pkg, 'index.d.ts'), 'declare const InternalButton: (props:any)=>any; export {InternalButton as Button}; export declare const MenuItem: (props:any)=>any;');
        fs.writeFileSync(path.join(pkg, 'default.d.ts'), 'export {Button as default} from "./index";');
        fs.writeFileSync(path.join(pkg, 'actual.d.ts'), 'export declare function Button(props:any): any;');
        fs.writeFileSync(path.join(pkg, 'named-default.d.ts'), 'export {Button as default} from "./actual";');
        fs.writeFileSync(path.join(pkg, 'actual-private.d.ts'), 'export declare function InternalButton(props:any): any;');
        fs.writeFileSync(path.join(pkg, 'middle-private.d.ts'), 'export {InternalButton} from "./actual-private";');
        fs.writeFileSync(path.join(pkg, 'public.d.ts'), 'export {InternalButton as Button} from "./middle-private";');
        fs.writeFileSync(path.join(root, 'barrel.ts'), 'export {MenuItem as Button, Button as MenuItem} from "@mattermost/compass-ui";');
        const config = path.join(root, 'config.json');
        fs.writeFileSync(path.join(root, 'source.tsx'), [
            'import React from "react"; import {MenuItem as Button, Button as MenuItem} from "@mattermost/compass-ui"; import * as UI from "@mattermost/compass-ui";',
            'import {Button as BarrelItem, MenuItem as BarrelButton} from "./barrel"; import * as Barrel from "./barrel";',
            'import DefaultButton from "@mattermost/compass-ui/default"; import NamedDefault from "@mattermost/compass-ui/named-default";',
            'import {Button as DeepButton} from "@mattermost/compass-ui/public"; import * as Deep from "@mattermost/compass-ui/public";',
            'export function Defaults() {return <><DefaultButton data-testid="view.default--button"/><NamedDefault data-testid="view.named_default--button"/></>;}',
            'const styled = (_component:any) => (_css: TemplateStringsArray) => (_props:any) => null;',
            'const StyledItem = styled(Button)``; const StyledButton = styled(MenuItem)``; const Alias = MenuItem;',
            'const StyledBarrelItem = styled(BarrelItem)``; const BarrelAlias = BarrelButton;',
            'const DeepStyled = styled(DeepButton)``; const DeepAlias = DeepButton; export function DeepButtons() {return <><DeepButton data-testid="view.deep--button"/><Deep.Button data-testid="view.deep_namespace--button"/><DeepStyled data-testid="view.deep_styled--button"/><DeepAlias data-testid="view.deep_alias--button"/></>;}',
            'export function Barrels() {return <><BarrelItem data-testid="view.barrel_item--button"/><BarrelButton data-testid="view.barrel_button--button"/><Barrel.Button data-testid="view.barrel_ns_item--button"/><Barrel.MenuItem data-testid="view.barrel_ns_button--button"/><StyledBarrelItem data-testid="view.barrel_styled--button"/><BarrelAlias data-testid="view.barrel_alias--button"/></>;}',
            'declare const UnknownButton: (props:any)=>any;',
            'export function App() {return <section data-testid="view"><Button data-testid="view.item--button"/><MenuItem data-testid="view.real--button"/><UI.Button data-testid="view.namespace--button"/><StyledItem data-testid="view.styled_item--button"/><StyledButton data-testid="view.styled_button--button"/><Alias data-testid="view.alias--button"/><UnknownButton data-testid="view.unknown--button"/></section>;}',
        ].join('\n'));
        const out = scanProject(loadConfig(config));
        const role = (name: string) => out.manifest.elements.find((element) => element.name === name)?.aria.role;
        assert.equal(role('item'), null, 'a local Button spelling cannot turn MenuItem into a button');
        for (const name of ['real', 'namespace', 'styled_button', 'alias', 'barrel_button', 'barrel_ns_button', 'barrel_alias', 'default', 'named_default', 'deep', 'deep_namespace', 'deep_styled', 'deep_alias']) {
            assert.equal(role(name), 'button', name);
        }
        assert.equal(role('styled_item'), null);
        assert.equal(role('unknown'), null, 'an unresolved local component gains no role from its name');
        for (const name of ['barrel_item', 'barrel_ns_item', 'barrel_styled']) {
            assert.equal(role(name), null, name);
        }
    });
});
