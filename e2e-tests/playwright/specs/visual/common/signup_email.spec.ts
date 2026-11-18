// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {App, expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Capture visual snapshots of the signup email page in normal and error states
 */
test(
    'signup page visual check',
    {tag: ['@visual', '@signup_email_page', '@snapshots']},
    async ({pw, page, browserName, viewport}, testInfo) => {
        const app = new App(page);
        // # Set up the page not to redirect to the landing page
        await pw.hasSeenLandingPage();

        // # Navigate to login page
        const {adminClient} = await pw.getAdminClient();
        await app.loginPage.goto();
        await expect(app.login.loginId.container).toBeVisible();
        await expect(app.login.password.container).toBeVisible();

        // # Click on create account link
        await app.login.alternate.actionLink.click();

        // * Verify redirection to signup page
        await expect(app.signup.card.titleText).toBeVisible();
        await expect(app.signup.card.email.container).toBeVisible();

        // # Remove focus from email input by clicking elsewhere (a title has no click verb, so the scoped locator is clicked)
        await app.signup.card.titleText.click();
        await expect(app.signup.card.email.container).not.toBeFocused();

        // # Get license information to determine snapshot suffix
        const license = await adminClient.getClientLicenseOld();
        const editionSuffix = license.IsLicensed === 'true' ? '' : 'team edition';
        const testArgs = {page, browserName, viewport};

        // * Verify visual appearance of signup page
        await pw.matchSnapshot({...testInfo, title: `${testInfo.title} ${editionSuffix}`}, testArgs);

        // # Attempt to create account with invalid credentials
        const invalidUser = {email: 'invalid', username: 'a', password: 'b'};
        await app.signup.card.email.container.fill(invalidUser.email);
        await app.signup.card.username.container.fill(invalidUser.username);
        await app.signup.card.password.container.fill(invalidUser.password);
        await app.signup.card.termsCheckbox.check();
        await expect(app.signup.card.termsCheckbox).toBeChecked();
        await app.signup.card.createAccountButton.click();

        // * Verify error messages appear for each field
        await expect(app.signup.card.email.validationAlert).toBeVisible();
        await expect(app.signup.card.username.validationAlert).toBeVisible();
        await expect(app.signup.card.password.validationAlert).toBeVisible();
        await pw.waitForAnimationEnd(app.signup.card.container.locator);

        // * Verify visual appearance of signup page with errors
        await pw.matchSnapshot({...testInfo, title: `${testInfo.title} error ${editionSuffix}`}, testArgs);
    },
);
