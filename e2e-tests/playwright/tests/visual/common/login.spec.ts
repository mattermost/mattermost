// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@e2e-support/test_fixture';

test('/login', async ({pw, pages, page, browserName, viewport}, testInfo) => {
    // Go to login page
    const {adminClient} = await pw.getAdminClient();
    const adminConfig = await adminClient.getConfig();
    const license = await adminClient.getClientLicenseOld();
    const loginPage = new pages.LoginPage(page, adminConfig);
    await loginPage.goto();
    await loginPage.toBeVisible();

    // Click to other element to remove focus from email input
    await loginPage.title.click();

    // Match snapshot of login page
    const testArgs = {page, browserName, viewport};
    const editionSuffix = license.IsLicensed === 'true' ? '' : 'free edition';
    await pw.matchSnapshot({...testInfo, title: `${testInfo.title} ${editionSuffix}`}, testArgs);

    // Click sign in button without entering user credential
    await loginPage.signInButton.click();
    await loginPage.userErrorLabel.waitFor();
    await pw.waitForAnimationEnd(loginPage.bodyCard);

    // Match snapshot of login page with error
    await pw.matchSnapshot({...testInfo, title: `${testInfo.title} error ${editionSuffix}`}, testArgs);
});
