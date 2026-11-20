// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, openSystemConsoleSection, test} from '@mattermost/playwright-lib';
import type {PlaywrightExtended} from '@mattermost/playwright-lib';

async function skipUnlessProfessional(pw: PlaywrightExtended) {
    const {adminClient} = await pw.getAdminClient();
    const license = await adminClient.getClientLicenseOld();

    test.skip(
        !['professional', 'enterprise', 'advanced', 'entry'].includes(license.SkuShortName),
        'Skipping test - server has no Professional or higher license',
    );

    return license.Cloud === 'true';
}

/**
 * @objective Verify the Site health page is not listed, and on self-managed licenses Workspace Optimization is,
 * when the HealthDashboard feature flag is off. Cloud licenses never list Workspace Optimization.
 *
 * @precondition
 * Full (Testcontainers) mode, so the server can be restarted with the HealthDashboard feature flag off.
 */
test('hides Site health when the feature flag is off', {tag: '@system_console'}, async ({pw}) => {
    const isCloud = await skipUnlessProfessional(pw);
    await pw.ensureFeatureFlag('HealthDashboard', false);

    const {adminUser} = await pw.initSetup();
    const {app} = await pw.testBrowser.login(adminUser);

    // # Open the System Console
    await openSystemConsoleSection(app);

    // * Verify Site health is not listed, and Workspace Optimization is listed unless the license is Cloud
    const reporting = app.admin.sidebar.category('reporting');
    if (!isCloud) {
        await expect(reporting.section('workspace_optimization').titleLink).toBeVisible();
    }
    await expect(reporting.section('site_health')).toHaveCount(0);
});
