// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@e2e-support/test_fixture';

test('/signup_user_complete accessibility quick check', async ({pw, axe}) => {
    // Set up the page not to redirect to the landing page
    await pw.hasSeenLandingPage();

    // # Go to reset password page
    await pw.signupPage.goto();
    await pw.signupPage.toBeVisible();

    // # Analyze the page
    const accessibilityScanResults = await axe
        .builder(pw.signupPage.page, {disableColorContrast: true, disableLinkInTextBlock: true})
        .analyze();

    // * Should have no violation
    expect(accessibilityScanResults.violations).toHaveLength(0);
});

test('/signup_user_complete accessibility tab support', async ({pw}, testInfo) => {
    // Set up the page not to redirect to the landing page
    await pw.hasSeenLandingPage();

    // # Go to reset password page
    await pw.signupPage.goto();
    await pw.signupPage.toBeVisible();

    // * Should have focused at email input on page load
    expect(await pw.signupPage.emailInput).toBeFocused();

    // * Should move focus to username input after tab
    await pw.signupPage.emailInput.press('Tab');
    expect(await pw.signupPage.usernameInput).toBeFocused();

    // * Should move focus to password input after tab
    await pw.signupPage.usernameInput.press('Tab');
    expect(await pw.signupPage.passwordInput).toBeFocused();

    // * Should move focus to password toggle button after tab
    await pw.signupPage.passwordInput.press('Tab');
    expect(await pw.signupPage.passwordToggleButton).toBeFocused();

    // * Should move focus to newsletter checkbox after tab
    await pw.signupPage.passwordToggleButton.press('Tab');
    expect(await pw.signupPage.newsLetterCheckBox).toBeFocused();

    // * Should move focus to newsletter privacy policy link after tab
    await pw.signupPage.newsLetterCheckBox.press('Tab');
    expect(await pw.signupPage.newsLetterPrivacyPolicyLink).toBeFocused();

    // * Should move focus to newsletter unsubscribe link after tab
    await pw.signupPage.newsLetterPrivacyPolicyLink.press('Tab');
    expect(await pw.signupPage.newsLetterUnsubscribeLink).toBeFocused();

    // * Should move focus to agreement terms of use link after tab
    await pw.signupPage.newsLetterUnsubscribeLink.press('Tab');
    expect(await pw.signupPage.agreementTermsOfUseLink).toBeFocused();

    // * Should move focus to agreement privacy policy link after tab
    await pw.signupPage.agreementTermsOfUseLink.press('Tab');
    expect(await pw.signupPage.agreementPrivacyPolicyLink).toBeFocused();

    // * Should move focus to privacy policy link after tab
    await pw.signupPage.footer.aboutLink.press('Tab');
    expect(await pw.signupPage.footer.privacyPolicyLink).toBeFocused();

    // * Should move focus to terms link after tab
    await pw.signupPage.footer.privacyPolicyLink.press('Tab');
    expect(await pw.signupPage.footer.termsLink).toBeFocused();

    // * Should move focus to help link after tab
    await pw.signupPage.footer.termsLink.press('Tab');
    expect(await pw.signupPage.footer.helpLink).toBeFocused();

    // # Move focus to email input
    await pw.signupPage.emailInput.focus();
    expect(await pw.signupPage.emailInput).toBeFocused();

    // * Should move focus to sign up body after shift+tab
    await pw.signupPage.emailInput.press('Shift+Tab');
    expect(await pw.signupPage.bodyCard).toBeFocused();

    // * Should move focus to sign up body after shift+tab
    await pw.signupPage.emailInput.press('Shift+Tab');
    expect(await pw.signupPage.bodyCard).toBeFocused();

    if (testInfo.project.name === 'ipad') {
        // * Should move focus to header back button after shift+tab
        await pw.signupPage.bodyCard.press('Shift+Tab');
        expect(await pw.signupPage.header.backButton).toBeFocused();

        // * Should move focus to log in link after shift+tab
        await pw.signupPage.header.backButton.press('Shift+Tab');
        expect(await pw.signupPage.loginLink).toBeFocused();

        // * Should move focus to header logo after shift+tab
        await pw.signupPage.loginLink.press('Shift+Tab');
        expect(await pw.signupPage.header.logo).toBeFocused();
    } else {
        // * Should move focus to log in link after shift+tab
        await pw.signupPage.bodyCard.press('Shift+Tab');
        expect(await pw.signupPage.loginLink).toBeFocused();

        // * Should move focus to header back button after shift+tab
        await pw.signupPage.loginLink.press('Shift+Tab');
        expect(await pw.signupPage.header.backButton).toBeFocused();

        // * Should move focus to header logo after shift+tab
        await pw.signupPage.header.backButton.press('Shift+Tab');
        expect(await pw.signupPage.header.logo).toBeFocused();
    }
});
