// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Api, expect, settle, test} from '@mattermost/playwright-lib';

import {openAdminConsole} from './support';

/**
 * @objective Verify the public link salt can be regenerated.
 */
test('MM-T1762 regenerates the public link salt', {tag: '@authentication'}, async ({pw}) => {
    const {adminUser} = await pw.initSetup();
    const {app} = await pw.testBrowser.login(adminUser);

    await openAdminConsole(app, '/site_config/public_links');
    const salt = app.admin.setting('FileSettings.PublicLinkSalt');

    // * Verify the salt is masked
    await expect(salt.generatedText).toBeVisible();
    await expect(salt.generatedText).toHaveText('********************************');

    // # Regenerate the salt
    await salt.regenerateButton.click();

    // * Verify a new, unmasked salt is shown
    await expect(salt.generatedText).not.toHaveText('********************************');
    await expect(salt.generatedText).toBeVisible();
    await expect(salt.generatedText).toHaveText(/^[A-Za-z0-9_-]{32}$/);
});

/**
 * @objective Verify an invalid Maximum Login Attempts value falls back to the default.
 */
test(
    'MM-T1775 resets Maximum Login Attempts to the default after an invalid value',
    {tag: '@authentication'},
    async ({pw}) => {
        const {adminUser, adminClient} = await pw.initSetup();
        const {app} = await pw.testBrowser.login(adminUser);

        await openAdminConsole(app, '/authentication/password');
        const attempts = app.admin.setting('maximumLoginAttempts').valueTextbox;

        // # Save a non-numeric value
        await attempts.fill('ten');
        const config = await settle(app.admin.saveButton, {wait: Api.PatchConfig}).click();

        // * Verify the save completes and the value falls back to the default
        await expect(app.admin.saveButton).toBeSaved();
        expect(config.ServiceSettings.MaximumLoginAttempts).toBe(10);
        await expect.poll(async () => (await adminClient.getConfig()).ServiceSettings.MaximumLoginAttempts).toBe(10);
        await expect(attempts).toHaveValue('10');
    },
);

/**
 * @objective Verify a valid Maximum Login Attempts change is saved.
 */
test('MM-T1776 saves a valid Maximum Login Attempts change', {tag: '@authentication'}, async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();
    const {app} = await pw.testBrowser.login(adminUser);

    await openAdminConsole(app, '/authentication/password');
    const attempts = app.admin.setting('maximumLoginAttempts').valueTextbox;

    // # Save a valid value
    await attempts.fill('2');
    const config = await settle(app.admin.saveButton, {wait: Api.PatchConfig}).click();

    // * Verify the value is saved
    await expect(app.admin.saveButton).toBeSaved();
    expect(config.ServiceSettings.MaximumLoginAttempts).toBe(2);
    await expect.poll(async () => (await adminClient.getConfig()).ServiceSettings.MaximumLoginAttempts).toBe(2);
    await expect(attempts).toHaveValue('2');
});
