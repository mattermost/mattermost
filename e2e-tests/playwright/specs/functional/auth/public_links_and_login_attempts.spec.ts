// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify the public link salt is masked and regenerating it unmasks a new value.
 */
test('regenerates the public link salt', {tag: '@authentication'}, async ({pw}) => {
    const {adminUser} = await pw.initSetup();
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Open Public Links settings
    await systemConsolePage.gotoPublicLinks();

    // * Verify the salt is masked
    await expect(systemConsolePage.publicLinks.maskedSalt).toBeVisible();

    // # Regenerate the salt
    await systemConsolePage.publicLinks.regenerateButton.click();

    // * Verify the salt is no longer fully masked
    await expect(systemConsolePage.publicLinks.maskedSalt).toBeHidden();
});

/**
 * @objective Verify Maximum Login Attempts resets to the default when a non-numeric value is saved.
 */
test('resets Maximum Login Attempts to the default after an invalid value', {tag: '@authentication'}, async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    try {
        // # Save a non-numeric Maximum Login Attempts value
        await systemConsolePage.gotoPasswordSettings();
        await systemConsolePage.passwordSettings.maximumLoginAttempts.fill('ten');
        await systemConsolePage.passwordSettings.save();

        // * Verify the field and config reset to the default
        await expect(systemConsolePage.passwordSettings.maximumLoginAttempts).toHaveValue('10');
        const config = await adminClient.getConfig();
        expect(config.ServiceSettings.MaximumLoginAttempts).toBe(10);
    } finally {
        await adminClient.patchConfig({ServiceSettings: {MaximumLoginAttempts: 10}});
    }
});

/**
 * @objective Verify a valid Maximum Login Attempts change is saved.
 */
test('saves a valid Maximum Login Attempts change', {tag: '@authentication'}, async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    try {
        // # Save a valid Maximum Login Attempts value
        await systemConsolePage.gotoPasswordSettings();
        await systemConsolePage.passwordSettings.maximumLoginAttempts.fill('2');
        await systemConsolePage.passwordSettings.save();

        // * Verify the field and config persist the new value
        await expect(systemConsolePage.passwordSettings.maximumLoginAttempts).toHaveValue('2');
        const config = await adminClient.getConfig();
        expect(config.ServiceSettings.MaximumLoginAttempts).toBe(2);
    } finally {
        await adminClient.patchConfig({ServiceSettings: {MaximumLoginAttempts: 10}});
    }
});
