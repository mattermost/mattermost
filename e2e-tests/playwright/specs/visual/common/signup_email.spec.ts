// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

/**
 * @objective Verify the appearance of the signup email page in normal and error states
 */
test(
    'signup_email visual verification',
    {tag: '@visual_signup'},
    async ({pw, page, browserName, viewport}, testInfo) => {
        // # Set up the page not to redirect to the landing page
        await pw.hasSeenLandingPage();

        // # Navigate to login page
        const {adminClient} = await pw.getAdminClient();
        await pw.loginPage.goto();
        await pw.loginPage.toBeVisible();

        // # Click on create account link
        await pw.loginPage.createAccountLink.click();

        // * Verify redirection to signup page
        await pw.signupPage.toBeVisible();

        // # Remove focus from email input by clicking elsewhere
        await pw.signupPage.title.click();

        // # Get license information to determine snapshot suffix
        const license = await adminClient.getClientLicenseOld();
        const editionSuffix = license.IsLicensed === 'true' ? '' : 'free edition';
        const testArgs = {page, browserName, viewport};

        // * Verify visual appearance of signup page
        await pw.matchSnapshot({...testInfo, title: `${testInfo.title} ${editionSuffix}`}, testArgs);

        // # Attempt to create account with invalid credentials
        const invalidUser = {email: 'invalid', username: 'a', password: 'b'};
        await pw.signupPage.create(invalidUser, false);

        // * Verify error messages appear for each field
        await pw.signupPage.emailError.waitFor();
        await pw.signupPage.usernameError.waitFor();
        await pw.signupPage.passwordError.waitFor();
        await pw.waitForAnimationEnd(pw.signupPage.bodyCard);

        // * Verify visual appearance of signup page with errors
        await pw.matchSnapshot({...testInfo, title: `${testInfo.title} error ${editionSuffix}`}, testArgs);
    },
);
