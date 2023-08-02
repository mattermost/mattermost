// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@e2e-support/test_fixture';

test('/login', async ({pw, pages, page, axe}) => {
    // # Go to login page
    const {adminClient} = await pw.getAdminClient();
    const adminConfig = await adminClient.getConfig();
    const loginPage = new pages.LoginPage(page, adminConfig);
    await loginPage.goto();
    await loginPage.toBeVisible();

    // # Analyze the page
    const accessibilityScanResults = await axe.builder(loginPage.page).analyze();

    // * Should have no violation
    expect(accessibilityScanResults.violations).toHaveLength(0);
});
