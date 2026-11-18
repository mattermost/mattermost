// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, Msg} from '@mattermost/playwright-lib';

import {openAdminConsole, openSignup} from './support';

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

    const {app} = await pw.testBrowser.login(adminUser);

    // # Open Password settings
    await openAdminConsole(app, '/authentication/password');

    // * Verify the default minimum length and unchecked requirements
    const password = app.admin.password;
    await expect(app.admin.setting('passwordMinimumLength').valueTextbox).toHaveValue(
        String(config.PasswordSettings.MinimumLength),
    );
    await expect(password.lowercaseCheckbox).not.toBeChecked();
    await expect(password.uppercaseCheckbox).not.toBeChecked();
    await expect(password.numberCheckbox).not.toBeChecked();
    await expect(password.symbolCheckbox).not.toBeChecked();
    await expect(app.admin.setting('maximumLoginAttempts').valueTextbox).toHaveValue('10');
});

/**
 * @objective Verify signup username validation rejects invalid usernames.
 */
test('MM-T1783 rejects invalid usernames on signup', {tag: '@authentication'}, async ({pw, page}) => {
    const app = await openSignup(pw, page);
    const card = app.signup.card;
    const email = `test-${pw.random.id()}@example.com`;
    await card.email.container.fill(email);
    await expect(card.email.container).toHaveValue(email);
    const password = pw.newTestPassword();
    await card.password.container.fill(password);
    await expect(card.password.container).toHaveValue(password);
    await card.termsCheckbox.set(true);
    await expect(card.termsCheckbox).toBeChecked();

    for (const username of ['1user', 'te', 'user#1', 'user!1']) {
        // # Submit an invalid username
        await card.username.container.fill(username);
        await expect(card.username.container).toHaveValue(username);
        // Editing clears the previous submit error; observe that reset so each iteration tests its own submission.
        await expect(card.username.validationAlert).toHaveCount(0);
        await card.createAccountButton.click();

        // * Verify the username validation error is shown
        await expect(card.username.validationAlert).toBeVisible();
        await expect(card.username.validationAlert).toHaveMessage(Msg.bots.manage.add.invalid_username);
    }
});
