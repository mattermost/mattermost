// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify Minimum password length rejects values outside 5-72 (or 14-72 on FIPS).
 */
test('rejects a minimum password length outside the allowed range', {tag: '@authentication'}, async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();
    const originalMinimumLength = (await adminClient.getConfig()).PasswordSettings.MinimumLength;
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    try {
        await systemConsolePage.gotoPasswordSettings();

        // # Save a length above the maximum
        await systemConsolePage.passwordSettings.minimumLength.fill('88');
        await systemConsolePage.passwordSettings.save();

        // * Verify the range error is shown
        await expect(systemConsolePage.passwordSettings.lengthError).toBeVisible();

        // # Save a length below the minimum
        await systemConsolePage.passwordSettings.minimumLength.fill('3');
        await systemConsolePage.passwordSettings.save();

        // * Verify the range error is shown
        await expect(systemConsolePage.passwordSettings.lengthError).toBeVisible();
    } finally {
        await adminClient.patchConfig({PasswordSettings: {MinimumLength: originalMinimumLength}});
    }
});

/**
 * @objective Verify changing minimum password length updates signup help text and validation.
 */
test('applies a new minimum password length on signup', {tag: '@authentication'}, async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();
    const originalMinimumLength = (await adminClient.getConfig()).PasswordSettings.MinimumLength;
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    try {
        await systemConsolePage.gotoPasswordSettings();

        // # Set the minimum length to 15
        await systemConsolePage.passwordSettings.minimumLength.fill('15');
        await systemConsolePage.passwordSettings.save();
        await expect(systemConsolePage.passwordSettings.sampleHelpText).toHaveText(
            'Your password must be 15-72 characters long.',
        );

        await pw.hasSeenLandingPage();
        await pw.signupPage.goto();
        await pw.signupPage.toBeVisible();
        await pw.signupPage.emailInput.fill(`test-${pw.random.id()}@example.com`);
        await pw.signupPage.usernameInput.fill(`user${pw.random.id()}`);
        await pw.signupPage.termsAndPrivacyCheckBox.check();

        // # Submit a password that is too short
        await pw.signupPage.passwordInput.fill('less');
        await pw.signupPage.createAccountButton.click();
        await expect(pw.signupPage.passwordLengthError).toBeVisible();

        // # Submit a password that meets the new minimum
        await pw.signupPage.passwordInput.fill('GreaterThan15Chr!');
        await pw.signupPage.termsAndPrivacyCheckBox.check();
        await pw.signupPage.createAccountButton.click();

        // * Verify signup succeeds
        await pw.selectTeamPage.toBeVisible();
    } finally {
        await adminClient.patchConfig({PasswordSettings: {MinimumLength: originalMinimumLength}});
    }
});

/**
 * @objective Verify clearing Minimum password length resets it to the server default.
 */
test('resets Minimum password length to the default after clearing it', {tag: '@authentication'}, async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();
    const originalMinimumLength = (await adminClient.getConfig()).PasswordSettings.MinimumLength;
    const customLength = originalMinimumLength === 20 ? 21 : 20;
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    try {
        await systemConsolePage.gotoPasswordSettings();

        // # Save a custom minimum length
        await systemConsolePage.passwordSettings.minimumLength.fill(String(customLength));
        await systemConsolePage.passwordSettings.save();
        await systemConsolePage.passwordSettings.reload();
        await expect(systemConsolePage.passwordSettings.minimumLength).toHaveValue(String(customLength));

        // # Clear the field and save
        await systemConsolePage.passwordSettings.minimumLength.clear();
        await systemConsolePage.passwordSettings.save();
        await systemConsolePage.passwordSettings.reload();

        // * Verify the saved value is no longer the custom length
        const resetLength = (await adminClient.getConfig()).PasswordSettings.MinimumLength;
        expect(resetLength).not.toBe(customLength);
        await expect(systemConsolePage.passwordSettings.minimumLength).toHaveValue(String(resetLength));
    } finally {
        await adminClient.patchConfig({PasswordSettings: {MinimumLength: originalMinimumLength}});
    }
});
