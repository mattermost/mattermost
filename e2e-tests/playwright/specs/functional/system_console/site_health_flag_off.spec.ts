// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';
import type {PlaywrightExtended} from '@mattermost/playwright-lib';

async function skipUnlessSelfManagedProfessional(pw: PlaywrightExtended) {
    const {adminClient} = await pw.getAdminClient();
    const license = await adminClient.getClientLicenseOld();

    test.skip(
        !['professional', 'enterprise', 'advanced', 'entry'].includes(license.SkuShortName) || license.Cloud === 'true',
        'Skipping test - server has no Professional or higher license, or is a Cloud license that hides Workspace Optimization',
    );
}

/**
 * @objective Verify the Site health page is not listed, and Workspace Optimization is, when the HealthDashboard
 * feature flag is off.
 *
 * @precondition
 * Full (Testcontainers) mode, so the server can be restarted with the HealthDashboard feature flag off.
 */
test('hides Site health when the feature flag is off', {tag: '@system_console'}, async ({pw}) => {
    await skipUnlessSelfManagedProfessional(pw);
    await pw.ensureFeatureFlag('HealthDashboard', false);

    const {adminUser} = await pw.initSetup();
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Open the System Console
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // * Verify Workspace Optimization is listed but Site health is not
    await expect(systemConsolePage.sidebar.reporting.workspaceOptimization.link).toBeVisible();
    await expect(systemConsolePage.sidebar.reporting.siteHealth.link).not.toBeVisible();
});
