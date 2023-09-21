// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@e2e-support/test_fixture';

test('/reset_password accessibility quick check', async ({pages, page, axe}) => {
    // # Go to reset password page
    const resetPasswordPage = new pages.ResetPasswordPage(page);
    await resetPasswordPage.goto();
    await resetPasswordPage.toBeVisible();

    // # Analyze the page
    const accessibilityScanResults = await axe.builder(resetPasswordPage.page, {disableColorContrast: true}).analyze();

    // * Should have no violation
    expect(accessibilityScanResults.violations).toHaveLength(0);
});

test('/reset_password accessibility tab support', async ({pages, page}) => {
    // # Go to reset password page
    const resetPasswordPage = new pages.ResetPasswordPage(page);
    await resetPasswordPage.goto();
    await resetPasswordPage.toBeVisible();

    // * Should have focused at email input on page load
    expect(await resetPasswordPage.emailInput).toBeFocused();

    // * Should move focus to reset button after tab
    await resetPasswordPage.emailInput.press('Tab');
    expect(await resetPasswordPage.resetButton).toBeFocused();

    // * Should move focus to about link after tab
    await resetPasswordPage.resetButton.press('Tab');
    expect(await resetPasswordPage.footer.aboutLink).toBeFocused();

    // * Should move focus to privacy policy link after tab
    await resetPasswordPage.footer.aboutLink.press('Tab');
    expect(await resetPasswordPage.footer.privacyPolicyLink).toBeFocused();

    // * Should move focus to terms link after tab
    await resetPasswordPage.footer.privacyPolicyLink.press('Tab');
    expect(await resetPasswordPage.footer.termsLink).toBeFocused();

    // * Should move focus to help link after tab
    await resetPasswordPage.footer.termsLink.press('Tab');
    expect(await resetPasswordPage.footer.helpLink).toBeFocused();

    // * Should move focus to header logo after tab
    await resetPasswordPage.footer.helpLink.press('Tab');
    expect(await resetPasswordPage.header.backButton).toBeFocused();

    // * Then, should move focus to email input after tab
    await resetPasswordPage.header.backButton.press('Tab');
    expect(await resetPasswordPage.emailInput).toBeFocused();
});
