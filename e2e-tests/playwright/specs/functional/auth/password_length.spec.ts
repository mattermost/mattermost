// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Api, expect, settle, test} from '@mattermost/playwright-lib';

import {expectOnSelectTeam, openAdminConsole, openSignup} from './support';

const LENGTH_ERROR =
    /Minimum password length must be a whole number greater than or equal to (5|14) and less than or equal to 72\./;

/**
 * @objective Verify an out-of-range minimum password length is rejected.
 */
test('MM-T1771 rejects a minimum password length outside the allowed range', {tag: '@authentication'}, async ({pw}) => {
    const {adminUser} = await pw.initSetup();
    const {app} = await pw.testBrowser.login(adminUser);

    await openAdminConsole(app, '/authentication/password');
    const minimumLength = app.admin.setting('passwordMinimumLength').valueTextbox;

    // # Save a minimum length above the maximum
    await minimumLength.fill('88');
    await expect(minimumLength).toHaveValue('88');
    await settle(app.admin.saveButton, {wait: Api.PatchConfig, status: 400}).click();

    // * Verify the length error is shown
    await expect(app.admin.saveError).toBeVisible();
    await expect(app.admin.saveError).toHaveText(LENGTH_ERROR);

    // # Save a minimum length below the minimum
    await minimumLength.fill('3');
    await expect(minimumLength).toHaveValue('3');
    await settle(app.admin.saveButton, {wait: Api.PatchConfig, status: 400}).click();

    // * Verify the length error is shown
    await expect(app.admin.saveError).toBeVisible();
    await expect(app.admin.saveError).toHaveText(LENGTH_ERROR);
});

/**
 * @objective Verify a new minimum password length is applied on signup.
 */
test('MM-T1772 applies a new minimum password length on signup', {tag: '@authentication'}, async ({pw, page}) => {
    const {adminUser} = await pw.initSetup();
    const {app} = await pw.testBrowser.login(adminUser);

    // # Set the minimum password length to 15
    await openAdminConsole(app, '/authentication/password');
    await app.admin.setting('passwordMinimumLength').valueTextbox.fill('15');
    await expect(app.admin.setting('passwordMinimumLength').valueTextbox).toHaveValue('15');
    await settle(app.admin.saveButton, {wait: Api.PatchConfig}).click();

    // * Verify the preview reflects the new length
    await expect(app.admin.password.previewText).toHaveText('Your password must be 15-72 characters long.');

    // # Try to sign up with a short password, in the test's own browser (not logged in)
    const signup = await openSignup(pw, page);
    const card = signup.signup.card;
    const email = `test-${pw.random.id()}@example.com`;
    await card.email.container.fill(email);
    await expect(card.email.container).toHaveValue(email);
    const username = `user${pw.random.id()}`;
    await card.username.container.fill(username);
    await expect(card.username.container).toHaveValue(username);
    await card.termsCheckbox.set(true);
    await expect(card.termsCheckbox).toBeChecked();
    await card.password.container.fill('less');
    await expect(card.password.container).toHaveValue('less');
    await card.createAccountButton.click();

    // * Verify the length error is shown
    await expect(card.password.validationAlert).toBeVisible();
    await expect(card.password.validationAlert).toHaveText(/Your password must be \d+-72 characters long\.$/);

    // # Sign up with a long enough password
    await card.password.container.fill('GreaterThan15Chr!');
    await expect(card.password.container).toHaveValue('GreaterThan15Chr!');
    await expect(card.password.validationAlert).toHaveCount(0);
    await card.termsCheckbox.set(true);
    await expect(card.termsCheckbox).toBeChecked();
    await settle(card.createAccountButton, {wait: Api.CreateUser}).click();

    // * Verify the account is created
    await expectOnSelectTeam(page);
});

/**
 * @objective Verify clearing the minimum password length resets it to the default.
 */
test(
    'MM-T1773 resets Minimum password length to the default after clearing it',
    {tag: '@authentication'},
    async ({pw}) => {
        const {adminUser, adminClient} = await pw.initSetup();
        const originalMinimumLength = (await adminClient.getConfig()).PasswordSettings.MinimumLength;
        const isFips = (await adminClient.getClientConfig()).IsFipsEnabled === 'true';
        const customLength = originalMinimumLength === 20 ? 21 : 20;

        const {app} = await pw.testBrowser.login(adminUser);
        await openAdminConsole(app, '/authentication/password');
        const minimumLength = app.admin.setting('passwordMinimumLength').valueTextbox;

        // # Save a custom minimum length and reload
        await minimumLength.fill(String(customLength));
        await expect(minimumLength).toHaveValue(String(customLength));
        const saved = await settle(app.admin.saveButton, {wait: Api.PatchConfig}).click();
        expect(saved.PasswordSettings.MinimumLength).toBe(customLength);
        await app.page.reload();
        await expect(minimumLength).toHaveValue(String(customLength));

        // # Clear the minimum length and save
        await minimumLength.clear();
        await expect(minimumLength).toHaveValue('');

        if (isFips) {
            // * Verify FIPS rejects the empty value and keeps the custom length
            await settle(app.admin.saveButton, {wait: Api.PatchConfig, status: 400}).click();
            await expect(app.admin.saveError).toBeVisible();
            await expect(app.admin.saveError).toHaveText(LENGTH_ERROR);
            expect((await adminClient.getConfig()).PasswordSettings.MinimumLength).toBe(customLength);
        } else {
            // * Verify the length resets to the default
            const reset = await settle(app.admin.saveButton, {wait: Api.PatchConfig}).click();
            expect(reset.PasswordSettings.MinimumLength).toBe(5);
            await app.page.reload();
            await expect(minimumLength).toHaveValue('5');
        }
    },
);
