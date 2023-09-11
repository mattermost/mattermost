// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@e2e-support/test_fixture';

test('/login accessibility quick check', async ({pw, pages, page, axe}) => {
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

test('/login accessibility tab support', async ({pw, pages, page}) => {
    // # Go to login page
    const {adminClient} = await pw.getAdminClient();
    const adminConfig = await adminClient.getConfig();
    const loginPage = new pages.LoginPage(page, adminConfig);
    await loginPage.goto();
    await loginPage.toBeVisible();

    // * Should have focused at login input on page load
    expect(await loginPage.loginInput).toBeFocused();

    // * Should move focus to password input after tab
    await loginPage.loginInput.press('Tab');
    expect(await loginPage.passwordInput).toBeFocused();

    // * Should move focus to password toggle button after tab
    await loginPage.passwordInput.press('Tab');
    expect(await loginPage.passwordToggleButton).toBeFocused();

    // * Should move focus to forgot password link after tab
    await loginPage.passwordToggleButton.press('Tab');
    expect(await loginPage.forgotPasswordLink).toBeFocused();

    // * Should move focus to forgot password link after tab
    await loginPage.forgotPasswordLink.press('Tab');
    expect(await loginPage.signInButton).toBeFocused();

    // * Should move focus to about link after tab
    await loginPage.signInButton.press('Tab');
    expect(await loginPage.footer.aboutLink).toBeFocused();

    // * Should move focus to privacy policy link after tab
    await loginPage.footer.aboutLink.press('Tab');
    expect(await loginPage.footer.privacyPolicyLink).toBeFocused();

    // * Should move focus to terms link after tab
    await loginPage.footer.privacyPolicyLink.press('Tab');
    expect(await loginPage.footer.termsLink).toBeFocused();

    // * Should move focus to help link after tab
    await loginPage.footer.termsLink.press('Tab');
    expect(await loginPage.footer.helpLink).toBeFocused();

    // * Should move focus to header logo after tab
    await loginPage.footer.helpLink.press('Tab');
    expect(await loginPage.header.logo).toBeFocused();

    // * Should move focus to create account link after tab
    await loginPage.header.logo.press('Tab');
    expect(await loginPage.createAccountLink).toBeFocused();

    // * Should move focus to create account link after tab
    await loginPage.createAccountLink.press('Tab');
    expect(await loginPage.bodyCard).toBeFocused();

    // * Then, should move focus to login body after tab
    await loginPage.bodyCard.press('Tab');
    expect(await loginPage.loginInput).toBeFocused();
});
