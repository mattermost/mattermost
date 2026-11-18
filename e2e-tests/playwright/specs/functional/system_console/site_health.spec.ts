// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';
import type {PlaywrightExtended} from '@mattermost/playwright-lib';

// TODO: Add a full e2e test of the health dashboard with real findings once an admin can trigger a health check run.

async function skipUnlessProfessional(pw: PlaywrightExtended) {
    const {adminClient} = await pw.getAdminClient();
    const license = await adminClient.getClientLicenseOld();

    test.skip(
        !['professional', 'enterprise', 'advanced', 'entry'].includes(license.SkuShortName),
        'Skipping test - server has no Professional or higher license',
    );
}

/**
 * @objective Verify a system admin can open the Site health page and it loads findings without an error,
 * with the HealthDashboard feature flag at its default (on).
 */
test('shows the Site health page to a system admin', {tag: '@system_console'}, async ({pw}) => {
    await skipUnlessProfessional(pw);

    const {adminUser} = await pw.initSetup();
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Open Reporting > Site health
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // * Verify Site health replaces Workspace Optimization in the sidebar
    await expect(systemConsolePage.sidebar.reporting.siteHealth.link).toBeVisible();
    await expect(systemConsolePage.sidebar.reporting.workspaceOptimization.link).not.toBeVisible();

    await systemConsolePage.sidebar.reporting.siteHealth.click();

    // * Verify the page loaded from the findings API without an error
    await expect(systemConsolePage.page.getByTestId('admin-console-header')).toHaveText('Site health');
    await expect(systemConsolePage.page.getByText(/^(Not evaluated yet|Last evaluated)/)).toBeVisible();
    await expect(systemConsolePage.page.getByText('Health findings could not be loaded')).not.toBeVisible();
});
