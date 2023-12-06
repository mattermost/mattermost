// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@e2e-support/test_fixture';

test('/signup_email', async ({pw, pages, page, browserName, viewport}, testInfo) => {
    // Go to login page
    const {adminClient} = await pw.getAdminClient();
    const adminConfig = await adminClient.getConfig();
    const loginPage = new pages.LoginPage(page, adminConfig);
    await loginPage.goto();
    await loginPage.toBeVisible();

    // Create an account
    await loginPage.createAccountLink.click();

    // Should have redirected to signup page
    const signupPage = new pw.pages.SignupPage(page);
    await signupPage.toBeVisible();

    // Click to other element to remove focus from email input
    await signupPage.title.click();

    // Match snapshot of signup_email page
    const testArgs = {page, browserName, viewport};
    await pw.matchSnapshot(testInfo, testArgs);

    // Click sign in button without entering user credential
    const invalidUser = {email: 'invalid', username: 'a', password: 'b'};
    await signupPage.create(invalidUser, false);
    await signupPage.emailError.waitFor();
    await signupPage.usernameError.waitFor();
    await signupPage.passwordError.waitFor();
    await pw.waitForAnimationEnd(signupPage.bodyCard);

    // Match snapshot of signup_email page
    await pw.matchSnapshot({...testInfo, title: `${testInfo.title} error`}, testArgs);
});
