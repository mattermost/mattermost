// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

test('should lock account after exceeding max login attempts and unlock via admin API', async ({pw}) => {
    // 1. Setup — create a test user and get admin client
    const {adminClient, user} = await pw.initSetup();

    // 2. Lower MaximumLoginAttempts to 3 via API so the test runs quickly
    const originalConfig = await adminClient.getConfig();
    const originalMax = originalConfig.ServiceSettings.MaximumLoginAttempts;

    await adminClient.patchConfig({
        ServiceSettings: {MaximumLoginAttempts: 3},
    });

    try {
        // 3. Navigate to the login page — set localStorage first to skip the native app landing page
        await pw.hasSeenLandingPage();
        await pw.loginPage.goto();
        await pw.loginPage.toBeVisible();

        // 4. Attempt login with wrong password 3 times
        for (let i = 0; i < 3; i++) {
            await pw.loginPage.loginInput.fill(user.username);
            await pw.loginPage.passwordInput.fill('WrongPassword!');
            await pw.loginPage.signInButton.click();
            await expect(
                pw.loginPage.page.getByText('The email/username or password is invalid.', {exact: true}),
            ).toBeVisible();
        }

        // 5. Correct password should now be rejected — account is locked
        await pw.loginPage.loginInput.fill(user.username);
        await pw.loginPage.passwordInput.fill(user.password);
        await pw.loginPage.signInButton.click();
        await expect(
            pw.loginPage.page.getByText(
                'Your account is locked because of too many failed password attempts. Please reset your password.',
                {exact: true},
            ),
        ).toBeVisible();
        await expect(pw.loginPage.page).toHaveURL(/\/login/);

        // 6. Admin unlocks the account via API
        await adminClient.resetFailedAttempts(user.id);

        // 7. User can now log in with correct password
        await pw.loginPage.loginInput.fill(user.username);
        await pw.loginPage.passwordInput.fill(user.password);
        await pw.loginPage.signInButton.click();
        await expect(pw.loginPage.page).not.toHaveURL(/\/login/);
    } finally {
        // 8. Restore original MaximumLoginAttempts regardless of test outcome
        await adminClient.patchConfig({
            ServiceSettings: {MaximumLoginAttempts: originalMax},
        });
    }
});
