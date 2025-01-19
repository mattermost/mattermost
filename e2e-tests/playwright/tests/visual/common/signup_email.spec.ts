// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@e2e-support/test_fixture';

test('/signup_email', async ({pw, page, browserName, viewport}, testInfo) => {
    // Set up the page not to redirect to the landing page
    await pw.hasSeenLandingPage();

    // Go to login page
    const {adminClient} = await pw.getAdminClient();
    await pw.loginPage.goto();
    await pw.loginPage.toBeVisible();

    // Create an account
    await pw.loginPage.createAccountLink.click();

    // Should have redirected to signup page
    await pw.signupPage.toBeVisible();

    // Click to other element to remove focus from email input
    await pw.signupPage.title.click();

    // Match snapshot of signup_email page
    const testArgs = {page, browserName, viewport};
    const license = await adminClient.getClientLicenseOld();
    const editionSuffix = license.IsLicensed === 'true' ? '' : 'free edition';
    await pw.matchSnapshot({...testInfo, title: `${testInfo.title} ${editionSuffix}`}, testArgs);

    // Click sign in button without entering user credential
    const invalidUser = {email: 'invalid', username: 'a', password: 'b'};
    await pw.signupPage.create(invalidUser, false);
    await pw.signupPage.emailError.waitFor();
    await pw.signupPage.usernameError.waitFor();
    await pw.signupPage.passwordError.waitFor();
    await pw.waitForAnimationEnd(pw.signupPage.bodyCard);

    // Match snapshot of signup_email page
    await pw.matchSnapshot({...testInfo, title: `${testInfo.title} error ${editionSuffix}`}, testArgs);
});
