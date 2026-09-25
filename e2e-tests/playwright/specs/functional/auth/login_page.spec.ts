// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify empty login fields show validation errors instead of submitting.
 */
test('shows validation errors for empty login fields', {tag: '@authentication'}, async ({pw}) => {
    await pw.hasSeenLandingPage();
    await pw.loginPage.goto();
    await pw.loginPage.toBeVisible();

    // # Submit the login form with both fields empty
    await pw.loginPage.signInButton.click();

    // * Verify empty-field errors are shown and the user stays on login
    await expect(pw.loginPage.errorBanner).toBeVisible();
    await pw.loginPage.expectOnLoginPage();
});

/**
 * @objective Verify the create-account link is hidden when open server is disabled.
 */
test('MM-T1760 hides the create-account link when open server is disabled', {tag: '@authentication'}, async ({pw}) => {
    const {adminClient} = await pw.getAdminClient();

    try {
        // # Disable open server
        await adminClient.patchConfig({TeamSettings: {EnableOpenServer: false}});

        await pw.hasSeenLandingPage();
        await pw.loginPage.goto();
        await pw.loginPage.toBeVisible();

        // * Verify the create-account link is hidden
        await expect(pw.loginPage.createAccountLink).toBeHidden();
    } finally {
        await adminClient.patchConfig({TeamSettings: {EnableOpenServer: true}});
    }
});
