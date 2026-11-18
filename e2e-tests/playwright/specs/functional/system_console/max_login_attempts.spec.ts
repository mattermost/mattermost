// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expectLoginHeading, expectSignedIn, App, expect, logIn, test} from '@mattermost/playwright-lib';

test('should lock account after exceeding max login attempts and unlock via admin API', async ({pw, page}) => {
    // 1. Setup — create a test user and get admin client
    const {adminClient, user} = await pw.initSetup();

    // 2. Lower MaximumLoginAttempts to 3 via API so the test runs quickly
    await adminClient.patchConfig({
        ServiceSettings: {MaximumLoginAttempts: 3},
    });

    // 3. Navigate to the login page — set localStorage first to skip the native app landing page
    await pw.hasSeenLandingPage();
    const app = new App(page);
    await app.loginPage.goto();
    await expect(app.login.loginId.container).toBeVisible();

    await expectLoginHeading(app);
    await expect(app.login.password.container).toBeVisible();

    // 4. Attempt login with wrong password 3 times
    for (let i = 0; i < 3; i++) {
        await logIn(app, user.username, 'WrongPassword!', {status: 401});
        await expect(app.login.banner).toBeVisible();
        await expect(app.login.banner).toContainText(
            /The email\/username or password is invalid\.|Enter a valid email or username and\/or password/,
        );
    }

    // 5. Correct password should now be rejected — account is locked
    await logIn(app, user.username, user.password, {status: 401});
    await expect(app.login.banner).toBeVisible();
    await expect(app.login.banner).toContainText(
        /Your account is locked because of too many failed password attempts\./,
    );
    await expect(page).toHavePath(app.loginPage.pathFor());

    // 6. Admin unlocks the account via API
    await adminClient.resetFailedAttempts(user.id);

    // 7. User can now log in with correct password
    await logIn(app, user.username, user.password);
    await expectSignedIn(page);
});
