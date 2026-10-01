// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {isUpgradePathProjectSelected, test as setup} from '@mattermost/playwright-lib';

setup('ensure plugins are loaded', async ({pw}) => {
    // Ensure all products as plugin are installed and active.
    await pw.ensurePluginsLoaded();
});

setup('ensure server deployment', async ({pw}) => {
    // Ensure server is on expected deployment type.
    await pw.ensureServerDeployment();
});

setup('ensure demo plugin', async ({pw}) => {
    // Upgrade-path runs install and version-pin the demo plugin themselves (see
    // upgrade-specs/upgrade_fixtures.ts) to exercise it across the upgrade boundary —
    // skip the generic setup here so it doesn't fight that.
    if (isUpgradePathProjectSelected()) {
        return;
    }

    // Installed and configured once for the entire run, but left inactive — activation is
    // a cheap, idempotent enablePlugin call, so individual specs call pw.ensureDemoPlugin()
    // themselves to activate it rather than inheriting already-on state from setup.
    await pw.ensureDemoPlugin({activate: false});
});

setup('ensure ABAC is configured', async ({pw}) => {
    // Upgrade-path runs do not exercise ABAC; patching AccessControlSettings on older
    // from-images also logs unrecognized sysconsole permission tags and attachment-sanitization noise.
    if (isUpgradePathProjectSelected()) {
        return;
    }

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
