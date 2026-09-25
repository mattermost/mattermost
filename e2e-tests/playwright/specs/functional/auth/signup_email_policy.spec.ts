// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, getRecentEmail, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify signup without email verification lands on the team-join page.
 */
test(
    'MM-T1763 signup without email verification lands on the team-join page',
    {tag: '@authentication'},
    async ({pw}) => {
        const {adminClient} = await pw.initSetup();

        try {
            await adminClient.patchConfig({EmailSettings: {RequireEmailVerification: false}});

            const username = `Test${pw.random.id()}`;
            const email = `${username.toLowerCase()}@example.com`;
            const started = new Date();

            await pw.hasSeenLandingPage();
            await pw.signupPage.goto();
            await pw.signupPage.toBeVisible();

            // # Create an account while verification is not required
            await pw.signupPage.create({email, username, password: pw.newTestPassword()});

            // * Verify the team-join page is shown
            await pw.selectTeamPage.toBeVisible();

            // * Verify a join email was still sent
            const mail = await getRecentEmail(email, {receivedAfter: started});
            expect(mail.subject).toContain('You joined');
        } finally {
            await adminClient.patchConfig({EmailSettings: {RequireEmailVerification: false}});
        }
    },
);

/**
 * @objective Verify email signup fields are hidden when email account creation is disabled.
 */
test('MM-T1765 hides email signup when email account creation is disabled', {tag: '@authentication'}, async ({pw}) => {
    const {adminClient, team} = await pw.initSetup();

    try {
        await adminClient.patchConfig({
            EmailSettings: {EnableSignUpWithEmail: false},
            GitLabSettings: {Enable: true},
        });

        await pw.hasSeenLandingPage();
        await pw.signupPage.goto(`/signup_user_complete/?id=${team.invite_id}`);

        // # Open signup while email account creation is disabled
        // * Verify GitLab is offered and email signup fields are hidden
        await expect(pw.signupPage.createAccountWithFollowing).toBeVisible();
        await expect(pw.signupPage.gitlabButton).toBeVisible();
        await expect(pw.signupPage.emailAddressLabel).toBeHidden();
        await expect(pw.signupPage.choosePasswordPlaceholder).toBeHidden();
    } finally {
        await adminClient.patchConfig({
            EmailSettings: {EnableSignUpWithEmail: true},
            GitLabSettings: {Enable: false},
        });
    }
});

/**
 * @objective Verify account creation succeeds when EnableUserCreation is true.
 */
test('MM-T1752 creates an account when user creation is enabled', {tag: '@authentication'}, async ({pw}) => {
    const {adminClient} = await pw.initSetup();

    try {
        await adminClient.patchConfig({TeamSettings: {EnableUserCreation: true}});

        const username = `Test${pw.random.id()}`;
        await pw.hasSeenLandingPage();
        await pw.signupPage.goto();
        await pw.signupPage.toBeVisible();

        // # Create an account
        await pw.signupPage.create({
            email: `${username.toLowerCase()}@example.com`,
            username,
            password: pw.newTestPassword(),
        });

        // * Verify the team-join page is shown
        await pw.selectTeamPage.toBeVisible();
    } finally {
        await adminClient.patchConfig({TeamSettings: {EnableUserCreation: true}});
    }
});
