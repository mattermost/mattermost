// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@e2e-support/test_fixture';

test('/login', async ({pw, page, browserName, viewport}, testInfo) => {
    // Set up the page not to redirect to the landing page
    await pw.hasSeenLandingPage();

    // Go to login page
    const {adminClient} = await pw.getAdminClient();
    await pw.loginPage.goto();
    await pw.loginPage.toBeVisible();

    // Click to other element to remove focus from email input
    await pw.loginPage.title.click();

    // Match snapshot of login page
    const testArgs = {page, browserName, viewport};
    const license = await adminClient.getClientLicenseOld();
    const editionSuffix = license.IsLicensed === 'true' ? '' : 'free edition';
    await pw.matchSnapshot({...testInfo, title: `${testInfo.title} ${editionSuffix}`}, testArgs);

    // Click sign in button without entering user credential
    await pw.loginPage.signInButton.click();
    await pw.loginPage.userErrorLabel.waitFor();
    await pw.waitForAnimationEnd(pw.loginPage.bodyCard);

    // Match snapshot of login page with error
    await pw.matchSnapshot({...testInfo, title: `${testInfo.title} error ${editionSuffix}`}, testArgs);
});
