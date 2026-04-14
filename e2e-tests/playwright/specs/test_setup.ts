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
    const {adminClient} = await pw.initSetup();

    try {
        const config = await adminClient.getConfig();
        (config as any).AccessControlSettings = {
            ...((config as any).AccessControlSettings || {}),
            EnableAttributeBasedAccessControl: true,
            EnableUserManagedAttributes: true,
        };
        await adminClient.updateConfig(config);
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
