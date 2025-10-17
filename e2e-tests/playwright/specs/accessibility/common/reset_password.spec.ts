// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

test('/reset_password accessibility quick check', async ({pw, axe}) => {
    // Set up the page not to redirect to the landing page
    await pw.hasSeenLandingPage();

    // # Go to reset password page
    await pw.resetPasswordPage.goto();
    await pw.resetPasswordPage.toBeVisible();

    // # Analyze the page
    const accessibilityScanResults = await axe
        .builder(pw.resetPasswordPage.page, {disableColorContrast: true})
        .analyze();

    // * Should have no violation
    expect(accessibilityScanResults.violations).toHaveLength(0);
});

test('/reset_password accessibility tab support', async ({pw}) => {
    // Set up the page not to redirect to the landing page
    await pw.hasSeenLandingPage();

    // # Go to reset password page
    await pw.resetPasswordPage.goto();
    await pw.resetPasswordPage.toBeVisible();

    // * Should have focused at email input on page load
    expect(await pw.resetPasswordPage.emailInput).toBeFocused();

    // * Should move focus to reset button after tab
    await pw.resetPasswordPage.emailInput.press('Tab');
    expect(await pw.resetPasswordPage.resetButton).toBeFocused();

    // * Should move focus to about link after tab
    await pw.resetPasswordPage.resetButton.press('Tab');
    expect(await pw.resetPasswordPage.footer.aboutLink).toBeFocused();

    // * Should move focus to privacy policy link after tab
    await pw.resetPasswordPage.footer.aboutLink.press('Tab');
    expect(await pw.resetPasswordPage.footer.privacyPolicyLink).toBeFocused();

    // * Should move focus to terms link after tab
    await pw.resetPasswordPage.footer.privacyPolicyLink.press('Tab');
    expect(await pw.resetPasswordPage.footer.termsLink).toBeFocused();

    // * Should move focus to help link after tab
    await pw.resetPasswordPage.footer.termsLink.press('Tab');
    expect(await pw.resetPasswordPage.footer.helpLink).toBeFocused();

    // # Move focus to email input
    await pw.resetPasswordPage.emailInput.focus();
    expect(await pw.resetPasswordPage.emailInput).toBeFocused();

    // * Should move focus to back button after shift+tab
    await pw.resetPasswordPage.emailInput.press('Shift+Tab');
    expect(await pw.resetPasswordPage.header.backButton).toBeFocused();
});
