// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@e2e-support/test_fixture';

test('/signup_user_complete accessibility quick check', async ({pages, page, axe}) => {
    // # Go to reset password page
    const signupPage = new pages.SignupPage(page);
    await signupPage.goto();
    await signupPage.toBeVisible();

    // # Analyze the page
    const accessibilityScanResults = await axe
        .builder(signupPage.page, {disableColorContrast: true, disableLinkInTextBlock: true})
        .analyze();

    // * Should have no violation
    expect(accessibilityScanResults.violations).toHaveLength(0);
});

test('/signup_user_complete accessibility tab support', async ({pages, page}) => {
    // # Go to reset password page
    const signupPage = new pages.SignupPage(page);
    await signupPage.goto();
    await signupPage.toBeVisible();

    // * Should have focused at email input on page load
    expect(await signupPage.emailInput).toBeFocused();

    // * Should move focus to username input after tab
    await signupPage.emailInput.press('Tab');
    expect(await signupPage.usernameInput).toBeFocused();

    // * Should move focus to password input after tab
    await signupPage.usernameInput.press('Tab');
    expect(await signupPage.passwordInput).toBeFocused();

    // * Should move focus to password toggle button after tab
    await signupPage.passwordInput.press('Tab');
    expect(await signupPage.passwordToggleButton).toBeFocused();

    // * Should move focus to newsletter checkbox after tab
    await signupPage.passwordToggleButton.press('Tab');
    expect(await signupPage.newsLetterCheckBox).toBeFocused();

    // * Should move focus to newsletter privacy policy link after tab
    await signupPage.newsLetterCheckBox.press('Tab');
    expect(await signupPage.newsLetterPrivacyPolicyLink).toBeFocused();

    // * Should move focus to newsletter unsubscribe link after tab
    await signupPage.newsLetterPrivacyPolicyLink.press('Tab');
    expect(await signupPage.newsLetterUnsubscribeLink).toBeFocused();

    // * Should move focus to agreement terms of use link after tab
    await signupPage.newsLetterUnsubscribeLink.press('Tab');
    expect(await signupPage.agreementTermsOfUseLink).toBeFocused();

    // * Should move focus to agreement privacy policy link after tab
    await signupPage.agreementTermsOfUseLink.press('Tab');
    expect(await signupPage.agreementPrivacyPolicyLink).toBeFocused();

    // * Should move focus to privacy policy link after tab
    await signupPage.footer.aboutLink.press('Tab');
    expect(await signupPage.footer.privacyPolicyLink).toBeFocused();

    // * Should move focus to terms link after tab
    await signupPage.footer.privacyPolicyLink.press('Tab');
    expect(await signupPage.footer.termsLink).toBeFocused();

    // * Should move focus to help link after tab
    await signupPage.footer.termsLink.press('Tab');
    expect(await signupPage.footer.helpLink).toBeFocused();

    // * Should move focus to header logo after tab
    await signupPage.footer.helpLink.press('Tab');
    expect(await signupPage.header.logo).toBeFocused();

    // * Should move focus to header back button after tab
    await signupPage.header.logo.press('Tab');
    expect(await signupPage.header.backButton).toBeFocused();

    // * Should move focus to log in link after tab
    await signupPage.header.backButton.press('Tab');
    expect(await signupPage.loginLink).toBeFocused();

    // * Should move focus to sign up body after tab
    await signupPage.loginLink.press('Tab');
    expect(await signupPage.bodyCard).toBeFocused();

    // * Then, should move focus to email input after tab
    await signupPage.bodyCard.press('Tab');
    expect(await signupPage.emailInput).toBeFocused();
});
