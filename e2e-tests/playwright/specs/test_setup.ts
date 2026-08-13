// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test as setup} from '@mattermost/playwright-lib';

setup('ensure plugins are loaded', async ({pw}) => {
    // Ensure all products as plugin are installed and active.
    await pw.ensurePluginsLoaded();
});

setup('ensure server deployment', async ({pw}) => {
    // Ensure server is on expected deployment type.
    await pw.ensureServerDeployment();
});

setup('ensure ABAC is configured', async ({pw}) => {
    // Enable ABAC and the Department attribute once for the entire test run.
    // Individual tests call pw.skipIfNoLicense() and handle the unlicensed case themselves.
    // Use getAdminClient (not initSetup) to avoid calling updateConfig(defaultConfig)
    // which resets the entire server config and broadcasts via WebSocket to all open
    // browser sessions across the 13 parallel shards starting simultaneously.
    const {adminClient} = await pw.getAdminClient();

    try {
        await adminClient.patchConfig({
            AccessControlSettings: {
                EnableAttributeBasedAccessControl: true,
                EnableUserManagedAttributes: true,
            },
        } as any);
    } catch {
        // Server is not licensed for ABAC — individual tests will skip via pw.skipIfNoLicense()
    }

    try {
        const fields = await adminClient.getCustomProfileAttributeFields();
        if (!fields.some((f: any) => f.name === 'Department')) {
            await adminClient.createCustomProfileAttributeField({
                name: 'Department',
                type: 'text',
                attrs: {sort_order: 0},
            } as any);
        }
    } catch {
        // Attribute creation failed — ABAC tests will handle their own attribute setup
    }
});
