// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {App, expect, test} from '@mattermost/playwright-lib';

test('/login accessibility quick check', async ({pw, page, axe}) => {
    const app = new App(page);
    // Set up the page not to redirect to the landing page
    await pw.hasSeenLandingPage();

    // # Go to login page
    await app.loginPage.goto();
    await expect(app.login.loginId.container).toBeVisible();
    await expect(app.login.password.container).toBeVisible();

    // # Analyze the page
    const accessibilityScanResults = await axe.builder(page).analyze();

    // * Should have no violation
    expect(accessibilityScanResults.violations).toHaveLength(0);
});

test('/login accessibility tab support', async ({pw, page}) => {
    const app = new App(page);
    // Set up the page not to redirect to the landing page
    await pw.hasSeenLandingPage();

    // # Go to login page
    await app.loginPage.goto();
    await expect(app.login.loginId.container).toBeVisible();
    await expect(app.login.password.container).toBeVisible();

    // * Should have focused at login input on page load
    await expect(app.login.loginId.container).toBeFocused();

    // * Should move focus to password input after tab
    await app.login.loginId.container.press('Tab');
    await expect(app.login.password.container).toBeFocused();

    // * Should move focus to password toggle button after tab
    await app.login.password.container.press('Tab');
    await expect(app.login.password.toggleButton).toBeFocused();

    // * Should move focus to forgot password link after tab
    await app.login.password.toggleButton.press('Tab');
    await expect(app.login.forgotPasswordLink).toBeFocused();

    // * Should move focus to forgot password link after tab
    await app.login.forgotPasswordLink.press('Tab');
    await expect(app.login.card.logInButton).toBeFocused();

    // * Should move focus to about link after tab
    await app.login.card.logInButton.press('Tab');
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

    // # Move focus to login input
    await app.login.loginId.container.focus();
    await expect(app.login.loginId.container).toBeFocused();

    // * Should move focus to login body after shift+tab
    await app.login.loginId.container.press('Shift+Tab');
    await expect(app.login.alternate.actionLink).toBeFocused();

    // * Should move focus to login body after tab
    await app.login.alternate.actionLink.press('Shift+Tab');
    await expect(app.public.header.titleLink).toBeFocused();
});
