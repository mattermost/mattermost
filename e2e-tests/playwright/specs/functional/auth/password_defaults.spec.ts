// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify default password settings in the System Console.
 */
test('MM-T1770 shows default password length and requirement checkboxes', {tag: '@authentication'}, async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    const config = await adminClient.getConfig();
    expect([8, 14]).toContain(config.PasswordSettings.MinimumLength);
    expect(config.PasswordSettings.Lowercase).toBe(false);
    expect(config.PasswordSettings.Number).toBe(false);
    expect(config.PasswordSettings.Uppercase).toBe(false);
    expect(config.PasswordSettings.Symbol).toBe(false);

    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Open Password settings
    await systemConsolePage.gotoPasswordSettings();

    // * Verify the default minimum length and unchecked requirements
    await expect(systemConsolePage.passwordSettings.minimumLength).toHaveValue(
        String(config.PasswordSettings.MinimumLength),
    );
    await expect(systemConsolePage.passwordSettings.lowercase).not.toBeChecked();
    await expect(systemConsolePage.passwordSettings.uppercase).not.toBeChecked();
    await expect(systemConsolePage.passwordSettings.number).not.toBeChecked();
    await expect(systemConsolePage.passwordSettings.symbol).not.toBeChecked();
    await expect(systemConsolePage.passwordSettings.maximumLoginAttempts).toHaveValue('10');
});

/**
 * @objective Verify signup username validation rejects invalid usernames.
 */
test('MM-T1783 rejects invalid usernames on signup', {tag: '@authentication'}, async ({pw}) => {
    await pw.hasSeenLandingPage();
    await pw.signupPage.goto();
    await pw.signupPage.toBeVisible();

    await pw.signupPage.emailInput.fill(`test-${pw.random.id()}@example.com`);
    await pw.signupPage.passwordInput.fill(pw.newTestPassword());
    await pw.signupPage.termsAndPrivacyCheckBox.check();

    for (const username of ['1user', 'te', 'user#1', 'user!1']) {
        // # Submit an invalid username
        await pw.signupPage.usernameInput.fill(username);
        await pw.signupPage.createAccountButton.click();

        // * Verify the username validation error is shown
        await expect(pw.signupPage.usernameError).toBeVisible();
    }
});
