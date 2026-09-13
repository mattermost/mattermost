// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, extractEmailLink, getRecentEmail, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify a user created while verification was off must verify after it is turned on.
 */
test(
    'requires email verification after it is enabled for an existing account',
    {tag: '@authentication'},
    async ({pw}) => {
        const {adminClient, user} = await pw.initSetup();

        try {
            await adminClient.patchConfig({EmailSettings: {RequireEmailVerification: false}});
            await adminClient.patchConfig({EmailSettings: {RequireEmailVerification: true}});
            await adminClient.revokeAllSessionsForUser(user.id);

            const started = new Date();
            await pw.hasSeenLandingPage();
            await pw.loginPage.goto();
            await pw.loginPage.toBeVisible();

            // # Log in after verification is required
            await pw.loginPage.submitCredentials(user.username, user.password);
            await pw.shouldVerifyEmailPage.toBeVisible();

            // # Resend the verification email
            await pw.shouldVerifyEmailPage.resendButton.click();
            await expect(pw.shouldVerifyEmailPage.sentConfirmation).toBeVisible();

            const mail = await getRecentEmail(user.email, {receivedAfter: started});
            const permalink = extractEmailLink(mail, '/do_verify_email');

            // # Open the verification link and log in
            await pw.loginPage.goto(permalink);
            await pw.loginPage.toBeVisible();
            await pw.loginPage.submitCredentials(user.username, user.password);

            // * Verify the user can proceed after verifying
            await pw.channelsPage.toBeVisible();
        } finally {
            await adminClient.patchConfig({EmailSettings: {RequireEmailVerification: false}});
        }
    },
);
