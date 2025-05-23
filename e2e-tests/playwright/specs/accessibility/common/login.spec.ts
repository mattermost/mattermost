// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

test('/login accessibility quick check', async ({pw, axe}) => {
    // Set up the page not to redirect to the landing page
    await pw.hasSeenLandingPage();

    // # Go to login page
    await pw.loginPage.goto();
    await pw.loginPage.toBeVisible();

    // # Analyze the page
    const accessibilityScanResults = await axe.builder(pw.loginPage.page).analyze();

    // * Should have no violation
    expect(accessibilityScanResults.violations).toHaveLength(0);
});

test('/login accessibility tab support', async ({pw}) => {
    // Set up the page not to redirect to the landing page
    await pw.hasSeenLandingPage();

    // # Go to login page
    await pw.loginPage.goto();
    await pw.loginPage.toBeVisible();

    // * Should have focused at login input on page load
    expect(await pw.loginPage.loginInput).toBeFocused();

    // * Should move focus to password input after tab
    await pw.loginPage.loginInput.press('Tab');
    expect(await pw.loginPage.passwordInput).toBeFocused();

    // * Should move focus to password toggle button after tab
    await pw.loginPage.passwordInput.press('Tab');
    expect(await pw.loginPage.passwordToggleButton).toBeFocused();

    // * Should move focus to forgot password link after tab
    await pw.loginPage.passwordToggleButton.press('Tab');
    expect(await pw.loginPage.forgotPasswordLink).toBeFocused();

    // * Should move focus to forgot password link after tab
    await pw.loginPage.forgotPasswordLink.press('Tab');
    expect(await pw.loginPage.signInButton).toBeFocused();

    // * Should move focus to about link after tab
    await pw.loginPage.signInButton.press('Tab');
    expect(await pw.loginPage.footer.aboutLink).toBeFocused();

    // * Should move focus to privacy policy link after tab
    await pw.loginPage.footer.aboutLink.press('Tab');
    expect(await pw.loginPage.footer.privacyPolicyLink).toBeFocused();

    // * Should move focus to terms link after tab
    await pw.loginPage.footer.privacyPolicyLink.press('Tab');
    expect(await pw.loginPage.footer.termsLink).toBeFocused();

    // * Should move focus to help link after tab
    await pw.loginPage.footer.termsLink.press('Tab');
    expect(await pw.loginPage.footer.helpLink).toBeFocused();

    // # Move focus to login input
    await pw.loginPage.loginInput.focus();
    expect(await pw.loginPage.loginInput).toBeFocused();

    // * Should move focus to login body after shift+tab
    await pw.loginPage.loginInput.press('Shift+Tab');
    expect(await pw.loginPage.createAccountLink).toBeFocused();

    // * Should move focus to login body after tab
    await pw.loginPage.createAccountLink.press('Shift+Tab');
    expect(await pw.loginPage.header.logo).toBeFocused();
});
