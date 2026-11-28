// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, duration} from '@mattermost/playwright-lib';

import {ensureUserAttributes} from '../support';
import {openPermissionPolicies} from '../surface';

/**
 * ABAC Basic Operations - Enable/Disable
 * The Permission Policies page is only reachable when the PermissionPolicies feature flag is on, so this check lives
 * in its own file with its own flag.
 */

test('Permission Policies page offers Add policy when ABAC is enabled', async ({pw}) => {
    test.setTimeout(duration.two_min);

    // # Skip test if no license for ABAC, and run the server with the PermissionPolicies feature flag
    await pw.skipIfNoLicense();
    await pw.ensureFeatureFlag('PermissionPolicies', true);

    const {adminUser, adminClient} = await pw.initSetup();
    await ensureUserAttributes(adminClient);

    // # Enable ABAC before logging in, so the console loads with it on
    await adminClient.patchConfig({AccessControlSettings: {EnableAttributeBasedAccessControl: true}});
    await pw.waitUntil(async () => {
        const cfg = await adminClient.getConfig();
        return cfg.AccessControlSettings?.EnableAttributeBasedAccessControl === true;
    });
    const {app} = await pw.testBrowser.login(adminUser);

    // * Verify Permission Policies page shows "Add policy" when ABAC is enabled
    const permissionPolicies = await openPermissionPolicies(app);
    await expect(permissionPolicies.addButton).toBeVisible();
});
