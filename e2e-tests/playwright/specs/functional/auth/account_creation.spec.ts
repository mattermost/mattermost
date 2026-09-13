// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify the create-account link is hidden and signup is blocked when user creation is disabled.
 */
test('hides signup when user creation is disabled', {tag: '@authentication'}, async ({pw}) => {
    const {adminClient} = await pw.initSetup();
    const originalConfig = await adminClient.getConfig();

    try {
        await adminClient.patchConfig({
            TeamSettings: {EnableUserCreation: false},
            LdapSettings: {Enable: false},
        });

        await pw.hasSeenLandingPage();
        await pw.loginPage.goto();
        await pw.loginPage.toBeVisible();

        // * Verify the create-account link is hidden
        await expect(pw.loginPage.createAccountLink).toBeHidden();

        // # Visit the signup page directly
        await pw.signupPage.goto();

        // * Verify no sign-in methods are offered
        await expect(pw.signupPage.noSignInMethods).toBeVisible();
    } finally {
        await adminClient.patchConfig({
            TeamSettings: {EnableUserCreation: originalConfig.TeamSettings.EnableUserCreation},
            LdapSettings: {Enable: originalConfig.LdapSettings.Enable},
        });
    }
});

/**
 * @objective Verify signup from the login page is rejected for a disallowed domain.
 */
test('rejects login-page signup when the email domain is not allowed', {tag: '@authentication'}, async ({pw}) => {
    const {adminClient} = await pw.initSetup();
    const originalConfig = await adminClient.getConfig();

    try {
        await adminClient.patchConfig({
            EmailSettings: {RequireEmailVerification: false},
            TeamSettings: {RestrictCreationToDomains: 'test.com', EnableUserCreation: true},
        });

        const username = `Test${pw.random.id()}`;
        await pw.hasSeenLandingPage();
        await pw.loginPage.goto();
        await pw.loginPage.toBeVisible();
        await expect(pw.loginPage.createAccountLink).toBeVisible();

        // # Open signup from the login-page create-account link
        await pw.loginPage.createAccountLink.click();
        await pw.signupPage.toBeVisible();
        await pw.signupPage.create(
            {
                email: `${username.toLowerCase()}@example.com`,
                username,
                password: pw.newTestPassword(),
            },
            false,
        );

        // * Verify the domain restriction error is shown
        await expect(pw.signupPage.domainRestrictionError).toBeVisible();
    } finally {
        await adminClient.patchConfig({
            EmailSettings: {RequireEmailVerification: originalConfig.EmailSettings.RequireEmailVerification},
            TeamSettings: {
                RestrictCreationToDomains: originalConfig.TeamSettings.RestrictCreationToDomains,
                EnableUserCreation: originalConfig.TeamSettings.EnableUserCreation,
            },
        });
    }
});

/**
 * @objective Verify inviting an email outside the allowed domains is rejected.
 */
test('rejects an email invite outside the allowed domains', {tag: '@authentication'}, async ({pw}) => {
    const {adminClient, user, team} = await pw.initSetup();
    const originalConfig = await adminClient.getConfig();

    try {
        await adminClient.patchConfig({
            EmailSettings: {RequireEmailVerification: false},
            ServiceSettings: {EnableEmailInvitations: true},
            TeamSettings: {RestrictCreationToDomains: 'test.com', EnableUserCreation: true},
        });

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Invite an email that is not on the allow list
        await channelsPage.sidebarLeft.teamMenuButton.click();
        await channelsPage.teamMenu.clickInvitePeople();
        const inviteModal = await channelsPage.getInvitePeopleModal(team.display_name);
        await inviteModal.toBeVisible();
        await inviteModal.inviteByEmail(`test-${pw.random.id()}@mattermost.com`);

        const invitedModal = await channelsPage.getMembersInvitedModal(team.display_name);
        await invitedModal.toBeVisible();

        // * Verify the invite is rejected for the disallowed domain
        await expect(invitedModal.notSentSection).toBeVisible();
        expect(await invitedModal.getNotSentResultReason()).toContain(
            'The following email addresses do not belong to an accepted domain',
        );
    } finally {
        await adminClient.patchConfig({
            EmailSettings: {RequireEmailVerification: originalConfig.EmailSettings.RequireEmailVerification},
            ServiceSettings: {EnableEmailInvitations: originalConfig.ServiceSettings.EnableEmailInvitations},
            TeamSettings: {
                RestrictCreationToDomains: originalConfig.TeamSettings.RestrictCreationToDomains,
                EnableUserCreation: originalConfig.TeamSettings.EnableUserCreation,
            },
        });
    }
});
