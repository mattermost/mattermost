// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {AdminConfig} from '@mattermost/types/config';

import {test, expect} from '@mattermost/playwright-lib';

test('should install and enable demo plugin from URL', async ({pw}) => {
    const {adminClient} = await pw.initSetup();

    // Enable public links before installing plugin
    await adminClient.updateConfig(
        pw.mergeWithOnPremServerConfig({
            FileSettings: {EnablePublicLink: true},
        } as Partial<AdminConfig>),
    );

    // Install and enable
    await pw.installAndEnablePlugin(
        adminClient,
        'https://github.com/mattermost/mattermost-plugin-demo/releases/download/v0.10.3/mattermost-plugin-demo-v0.10.3.tar.gz',
        'com.mattermost.demo-plugin',
    );

    // Verify it's active (API validation, no UI)
    const isActive = await pw.verifyPluginActive(adminClient, 'com.mattermost.demo-plugin');
    expect(isActive).toBe(true);

    // Optional: Get plugin details
    const plugins = await adminClient.getPlugins();
    const demoPlugin = plugins.active.find((p) => p.id === 'com.mattermost.demo-plugin');
    expect(demoPlugin).toBeDefined();
});
