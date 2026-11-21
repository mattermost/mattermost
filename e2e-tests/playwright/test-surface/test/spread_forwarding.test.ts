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

test('a testid given to a component that spreads its rest props onto the element it renders reaches that element', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-spread-forwarding-'));
    try {
        installFixtureCompiler(root);
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['source.tsx', path.join(FIXTURES, '_lib')]}));
        fs.writeFileSync(path.join(root, 'test-surface.config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], checks: {}, output: {report: 'surface.json'}}));
        fs.writeFileSync(path.join(root, 'source.tsx'), [
            "import React from 'react';",
            'type ItemProps = {id: string; labels: React.ReactNode; onClick?: () => void; [key: string]: unknown};',
            'declare function MuiMenuItem(props: {[key: string]: unknown}): JSX.Element;',
            'declare function styled<T>(component: T): T;',
            'const MenuItemStyled = styled(MuiMenuItem);',
            'const MenuItem = React.forwardRef((props: ItemProps, ref: unknown) => {',
            '    const {labels, ...otherProps} = props;',
            "    return <MenuItemStyled ref={ref} role='menuitem' {...otherProps}>{labels}</MenuItemStyled>;",
            '});',
            'type SubMenuProps = {id: string; menuId: string; labels: React.ReactNode; children: React.ReactNode; isMobile?: boolean; menuTestId?: string; [key: string]: unknown};',
            "function paperTestIdProps(menuTestId?: string): Record<string, string> {return menuTestId ? {'data-testid': `${menuTestId}.paper`} : {};}",
            'function SubMenu(props: SubMenuProps) {',
            '    const {id, menuId, labels, children, isMobile, menuTestId, ...rest} = props;',
            '    const trigger = {id, labels, onClick: () => undefined};',
            '    if (isMobile) {',
            '        return <MenuItem {...trigger}/>;',
            '    }',
            '    return <div><MenuItem {...rest} {...trigger}/><ul id={menuId} {...paperTestIdProps(menuTestId)}>{children}</ul></div>;',
            '}',
            'export const Menu = {SubMenu};',
            'export function AccountMenu() {',
            "    return <div data-testid='account_menu'><Menu.SubMenu id='dnd' data-testid='account_menu.dnd--menuitem' menuId='dnd_menu' labels='Do not disturb'><li data-testid='account_menu.dnd_menu.until--menuitem'/></Menu.SubMenu></div>;",
            '}',
        ].join('\n'));
        const scanned = scanProject(loadConfig(path.join(root, 'test-surface.config.json')));
        const templates = scanned.manifest.elements.map((element) => element.template);
        assert.ok(templates.includes('account_menu.dnd_menu.until--menuitem'), templates.join(', '));
        assert.ok(templates.includes('account_menu.dnd--menuitem'), templates.join(', '));
        const family = scanned.report.families[scanned.report.scopes.account_menu.family];
        assert.equal(family.parts?.dnd?.role, 'menuitem', JSON.stringify(family));
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});
