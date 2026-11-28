// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {App, expect, test} from '@mattermost/playwright-lib';

test('/reset_password accessibility quick check', async ({pw, page, axe}) => {
    const app = new App(page);
    // Set up the page not to redirect to the landing page
    await pw.hasSeenLandingPage();

    // # Go to reset password page
    await app.passwordResetSendLinkPage.goto();
    await expect(app.passwordReset.email.container).toBeVisible();
    await expect(app.passwordReset.sendButton).toBeVisible();

    // # Analyze the page
    const accessibilityScanResults = await axe.builder(page, {disableColorContrast: true}).analyze();

    // * Should have no violation
    expect(accessibilityScanResults.violations).toHaveLength(0);
});

test('/reset_password accessibility tab support', async ({pw, page}) => {
    const app = new App(page);
    // Set up the page not to redirect to the landing page
    await pw.hasSeenLandingPage();

    // # Go to reset password page
    await app.passwordResetSendLinkPage.goto();
    await expect(app.passwordReset.email.container).toBeVisible();
    await expect(app.passwordReset.sendButton).toBeVisible();

    // * Should have focused at email input on page load
    await expect(app.passwordReset.email.container).toBeFocused();

    // * Should move focus to reset button after tab
    await app.passwordReset.email.container.press('Tab');
    await expect(app.passwordReset.sendButton).toBeFocused();

    // * Should move focus to about link after tab
    await app.passwordReset.sendButton.press('Tab');
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
    await app.passwordReset.email.container.focus();
    await expect(app.passwordReset.email.container).toBeFocused();

    // * Should move focus to back button after shift+tab
    await app.passwordReset.email.container.press('Shift+Tab');
    await expect(app.public.header.backLink).toBeFocused();
});
