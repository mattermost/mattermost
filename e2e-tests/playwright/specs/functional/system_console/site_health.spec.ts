// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';
import type {PlaywrightExtended} from '@mattermost/playwright-lib';

// TODO: Add a full e2e test of the health dashboard with real findings once an admin can trigger a health check run.

async function skipUnlessEnterprise(pw: PlaywrightExtended) {
    const {adminClient} = await pw.getAdminClient();
    const license = await adminClient.getClientLicenseOld();

    test.skip(
        !['enterprise', 'advanced'].includes(license.SkuShortName),
        'Skipping test - server has no enterprise or enterprise advanced license',
    );
}

/**
 * @objective Verify a system admin can open the Site health page and it loads findings without an error.
 *
 * @precondition
 * Full (Testcontainers) mode, so the server can be restarted with the HealthDashboard feature flag on.
 */
test('shows the Site health page to a system admin', {tag: '@system_console'}, async ({pw}) => {
    await skipUnlessEnterprise(pw);
    await pw.ensureFeatureFlag('HealthDashboard', true);

    const {adminUser} = await pw.initSetup();
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Open Reporting > Site health
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();
    await systemConsolePage.sidebar.reporting.siteHealth.click();

    // * Verify the page loaded from the findings API without an error
    await expect(systemConsolePage.page.getByTestId('admin-console-header')).toHaveText('Site health');
    await expect(systemConsolePage.page.getByText(/^(Not evaluated yet|Last evaluated)/)).toBeVisible();
    await expect(systemConsolePage.page.getByText('Health findings could not be loaded')).not.toBeVisible();
});

/**
 * @objective Verify the Site health page is not listed when the HealthDashboard feature flag is off.
 */
test('hides Site health when the feature flag is off', {tag: '@system_console'}, async ({pw}) => {
    await skipUnlessEnterprise(pw);
    await pw.ensureFeatureFlag('HealthDashboard', false);

    const {adminUser} = await pw.initSetup();
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Open the System Console
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // * Verify Reporting is listed but Site health is not
    await expect(systemConsolePage.sidebar.reporting.siteStatistics.link).toBeVisible();
    await expect(systemConsolePage.sidebar.reporting.siteHealth.link).not.toBeVisible();
});
