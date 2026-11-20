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

test('keys read under a type guard retain the narrowed entity behind a selector union', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-narrowed-keys-'));
    try {
        installFixtureCompiler(root);
        fs.mkdirSync(path.join(root, 'types'));
        fs.writeFileSync(path.join(root, 'types/entities.ts'), 'export interface PluginManifest {id: string} export interface AppManifest {app_id: string} export interface MarketplacePlugin {manifest: PluginManifest} export interface MarketplaceApp {manifest: AppManifest}');
        fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({extends: path.join(FIXTURES, '_lib/tsconfig.base.json'), include: ['source.tsx', 'types', path.join(FIXTURES, '_lib')]}));
        fs.writeFileSync(path.join(root, 'test-surface.config.json'), JSON.stringify({root: '.', tsconfig: 'tsconfig.json', include: ['.'], entityTypeDirs: ['types'], checks: {}, output: {report: 'surface.json'}}));
        fs.writeFileSync(path.join(root, 'source.tsx'), [
            "import {useMemo} from 'react'; import {useSelector} from 'react-redux'; import type {MarketplacePlugin, MarketplaceApp} from './types/entities';",
            'declare function getListing(state: unknown): Array<MarketplacePlugin | MarketplaceApp>; declare function isPlugin(item: MarketplacePlugin | MarketplaceApp): item is MarketplacePlugin;',
            // eslint-disable-next-line no-template-curly-in-string -- fixture source
            'function Item({testId, id}: {testId: string; id: string}) {return <div role="region" data-testid={`${testId}.entry:${id}--region`}/>;}',
            'export function App() {const listing = useSelector(getListing); const items = useMemo(() => [...listing].slice(0, 15).map((item) => isPlugin(item) ? <Item testId="marketplace.plugins" id={item.manifest.id}/> : <Item testId="marketplace.apps" id={item.manifest.app_id}/>), [listing]); return <div>{items}</div>;}',
        ].join('\n'));
        const scanned = scanProject(loadConfig(path.join(root, 'test-surface.config.json')));
        assert.deepEqual(scanned.diagnostics.filter((diagnostic) => diagnostic.rule === 'key-origin'), []);
        for (const [scope, entity, field] of [['marketplace.plugins', 'PluginManifest', 'id'], ['marketplace.apps', 'AppManifest', 'app_id']]) {
            const key = scanned.manifest.elements.find((element) => element.template === `${scope}.entry:{key}--region`)?.key;
            assert.equal(key?.kind, 'entity');
            assert.equal(key?.entity, entity);
            assert.equal(key?.field, field);
        }
        const sourcePath = path.join(root, 'source.tsx');
        fs.writeFileSync(sourcePath, fs.readFileSync(sourcePath, 'utf8').replaceAll('marketplace.plugins', 'marketplace').replaceAll('marketplace.apps', 'marketplace'));
        assert.ok(scanProject(loadConfig(path.join(root, 'test-surface.config.json'))).diagnostics.some((diagnostic) => diagnostic.rule === 'key-origin' && diagnostic.template === 'marketplace.entry:{key}--region'), 'two distinct entity identities cannot be guessed into one key type');
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});
