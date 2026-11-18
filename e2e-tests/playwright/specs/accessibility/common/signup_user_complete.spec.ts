// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {App, expect, test} from '@mattermost/playwright-lib';

test('/signup_user_complete accessibility quick check', async ({pw, page, axe}) => {
    const app = new App(page);
    // Set up the page not to redirect to the landing page
    await pw.hasSeenLandingPage();

    // # Go to reset password page
    await app.signupPage.goto();
    await expect(app.signup.card.titleText).toBeVisible();
    await expect(app.signup.card.email.container).toBeVisible();

    // # Analyze the page
    const accessibilityScanResults = await axe
        .builder(page, {disableColorContrast: true, disableLinkInTextBlock: true})
        .analyze();

    // * Should have no violation
    expect(accessibilityScanResults.violations).toHaveLength(0);
});

test('/signup_user_complete accessibility tab support', async ({pw, page}, testInfo) => {
    const app = new App(page);
    // Set up the page not to redirect to the landing page
    await pw.hasSeenLandingPage();

    // # Go to reset password page
    await app.signupPage.goto();
    await expect(app.signup.card.titleText).toBeVisible();
    await expect(app.signup.card.email.container).toBeVisible();

    // * Should have focused at email input on page load
    await expect(app.signup.card.email.container).toBeFocused();

    // * Should move focus to username input after tab
    await app.signup.card.email.container.press('Tab');
    await expect(app.signup.card.username.container).toBeFocused();

    // * Should move focus to password input after tab
    await app.signup.card.username.container.press('Tab');
    await expect(app.signup.card.password.container).toBeFocused();

    // * Should move focus to password toggle button after tab
    await app.signup.card.password.container.press('Tab');
    await expect(app.signup.card.password.toggleButton).toBeFocused();

    // * Should move focus to terms and privacy checkbox after tab
    await app.signup.card.password.toggleButton.press('Tab');
    await expect(app.signup.card.termsCheckbox).toBeFocused();

    // * Should move focus to acceptable use policy link after tab
    await app.signup.card.termsCheckbox.press('Tab');
    await expect(app.signup.card.acceptableUsePolicyLink).toBeFocused();

    // * Should move focus to privacy policy link after tab
    await app.signup.card.acceptableUsePolicyLink.press('Tab');
    await expect(app.signup.card.privacyPolicyLink).toBeFocused();

    // * Should move focus to about link after tab (skips disabled create account button)
    await app.signup.card.privacyPolicyLink.press('Tab');
    await expect(app.public.footer.link('about')).toBeFocused();

    // * Should move focus to privacy policy link after tab
    await app.public.footer.link('about').press('Tab');
    await expect(app.public.footer.link('privacy')).toBeFocused();

    // * Should move focus to terms link after tab
    await app.public.footer.link('privacy').press('Tab');
    await expect(app.public.footer.link('terms')).toBeFocused();

    // * Should move focus to help link after tab
    await app.public.footer.link('terms').press('Tab');
    await expect(app.public.footer.link('help')).toBeFocused();

    // # Move focus to email input
    await app.signup.card.email.container.focus();
    await expect(app.signup.card.email.container).toBeFocused();

    if (testInfo.project.name === 'ipad') {
        // * Should move focus to header back button after shift+tab
        await app.signup.card.container.press('Shift+Tab');
        await expect(app.public.header.backLink).toBeFocused();

        // * Should move focus to log in link after shift+tab
        await app.public.header.backLink.press('Shift+Tab');
        await expect(app.signup.alternate.actionLink).toBeFocused();

        // * Should move focus to header logo after shift+tab
        await app.signup.alternate.actionLink.press('Shift+Tab');
        await expect(app.public.header.titleLink).toBeFocused();
    } else {
        // * Should move focus to log in link after shift+tab
        await app.signup.card.container.press('Shift+Tab');
        await expect(app.signup.alternate.actionLink).toBeFocused();

        // * Should move focus to header back button after shift+tab
        await app.signup.alternate.actionLink.press('Shift+Tab');
        await expect(app.public.header.backLink).toBeFocused();

        // * Should move focus to header logo after shift+tab
        await app.public.header.backLink.press('Shift+Tab');
        await expect(app.public.header.titleLink).toBeFocused();
    }
});
