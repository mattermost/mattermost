// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import {dirname, join, resolve} from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';

import {diffHostContracts, extractHostContract, readHostVersion} from '../dist/host_contract.js';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, '../../../..');

test('extractHostContract builds compact 3-layer contract from real Mattermost sources', () => {
    const contract = extractHostContract({
        version: readHostVersion(repoRoot),
        slotsPath: resolve(testDir, '../plugin-slots.json'),
        apiSourceDir: join(repoRoot, 'api/v4/source'),
        registryPath: join(repoRoot, 'webapp/channels/src/plugins/registry.ts'),
        pluginTypesPath: join(repoRoot, 'webapp/platform/types/src/plugins.ts'),
    });

    assert.equal(Object.keys(contract.slots).length, 13);
    assert.ok(Object.keys(contract.api).length >= 450);
    assert.ok('registerRightHandSidebarComponent' in contract.registry.methods);
    assert.ok('registerDesktopNotificationHook' in contract.registry.methods);
    assert.ok(contract.registry.pluginTypes.includes('PluginManifest'));
});

test('diffHostContracts detects breaking changes across slots, api, and registry while allowing additions', () => {
    const base = extractHostContract({
        version: '12.0.0',
        slotsPath: resolve(testDir, '../plugin-slots.json'),
        apiSourceDir: join(repoRoot, 'api/v4/source'),
        registryPath: join(repoRoot, 'webapp/channels/src/plugins/registry.ts'),
        pluginTypesPath: join(repoRoot, 'webapp/platform/types/src/plugins.ts'),
    });

    const compatible = structuredClone(base);
    compatible.slots.new_slot = {template: 'new_slot.plugin:{key}--button', registry: [], verified: true};
    assert.deepEqual(diffHostContracts(base, compatible).breaking, []);
    assert.deepEqual(diffHostContracts(base, compatible).added, ['slots.new_slot']);

    const broken = structuredClone(base);
    delete broken.slots.rhs_panel;
    broken.api.CreatePost.path = '/api/v5/posts';
    delete broken.registry.methods.registerRightHandSidebarComponent;

    const diff = diffHostContracts(base, broken);
    assert.deepEqual(
        diff.breaking.map((b) => `${b.layer}:${b.symbol}`),
        ['slots:rhs_panel', 'api:CreatePost', 'registry:registerRightHandSidebarComponent'],
    );
});
