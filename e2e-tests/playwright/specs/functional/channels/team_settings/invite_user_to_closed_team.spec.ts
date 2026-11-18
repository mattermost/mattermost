// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserProfile} from '@mattermost/types/users';

import {
    type App,
    expect,
    formatMessage,
    Msg,
    openTeamSettings,
    test,
    duration,
    Api,
    settle,
} from '@mattermost/playwright-lib';

/**
 * Types the email in the invite dialog's people input, takes its suggestion and sends the invite. The suggestion is
 * the user's own when the email belongs to an account, and "Add email" otherwise.
 */
async function inviteByEmail(app: App, email: string, user?: Pick<UserProfile, 'id'>) {
    const invite = app.invitationModal.invite;
    const input = invite.users.inputCombobox;
    await input.focus();
    await input.type(email);

    // the menu offers the suggestion once its search finishes; Enter takes it
    const suggestion = user ? invite.users.user(user) : invite.users.emailOption;
    await expect(suggestion).toBeVisible({timeout: duration.half_min});
    await input.press('Enter');
    await expect(input).toHaveValue('');
    await expect(invite.sendButton).toBeEnabled();
    await settle(invite.sendButton, {wait: user ? Api.AddTeamMembers : Api.InviteUsersToTeam}).click();
}

/**
 * @objective Verify that a user with a valid email domain can be invited to a closed team,
 * and a user with an invalid email domain is rejected with the correct error message.
 */
test('MM-T388 Invite new user to closed team with email domain restriction', {tag: '@team_settings'}, async ({pw}) => {
    const emailDomain = 'sample.mattermost.com';

    // # Set up admin user and team
    const {adminUser, adminClient, team} = await pw.initSetup();

    // # Enable email invitations so the invite modal shows "Add email" option
    await adminClient.patchConfig({
        ServiceSettings: {EnableEmailInvitations: true},
    });

    // # Create a new user NOT on the team (default email is @sample.mattermost.com)
    const newUser = await adminClient.createUser(await pw.random.user(), '', '');

    const townSquare = await adminClient.getChannelByName(team.id, 'town-square');
    const {app} = await pw.testBrowser.login(adminUser);

    // # Navigate to team
    await app.channelsPage.goto({team, channel: townSquare});

    // # Open Team Settings Modal and go to Access tab
    const settings = await openTeamSettings(app, 'access');

    // # Enable "Allow only users with a specific email domain" and add the domain
    await settings.access.allowedDomainsCheckbox.check();
    await expect(settings.access.allowedDomainsCheckbox).toBeChecked();
    const domains = settings.access.allowedDomainsInput.inputCombobox;
    await domains.fill(emailDomain);
    await domains.press('Enter');
    await expect(settings.access.allowedDomainsInput).toContainText(emailDomain);

    // # Save changes
    await settle(settings.savePanel.saveButton, {wait: Api.PatchTeam}).click();
    await expect(settings.savePanel.messageText).toHaveText(formatMessage(Msg.saveChangesPanel.saved));
    await expect(settings.savePanel.messageText).toBeVisible();

    // # Close the Team Settings modal and wait for it to disappear
    await settings.closeButton.click();
    await expect(settings).not.toBeVisible();
    await expect(settings.closeButton).not.toBeVisible();

    // Ensure email invitations are enabled before opening the invite modal.
    await adminClient.patchConfig({
        ServiceSettings: {EnableEmailInvitations: true},
    });
    await pw.waitUntil(async () => {
        const cfg = await adminClient.getConfig();
        return cfg.ServiceSettings?.EnableEmailInvitations === true;
    });

    // # Open team menu and click 'Invite People', and invite the user with a valid email domain
    await app.lhs.header.openTeamMenuButton.clickTo(app.lhs.teamMenu);
    await app.lhs.teamMenu.invitePeopleMenuItem.clickTo(app.invitationModal);
    await inviteByEmail(app, newUser.email, newUser);

    // * Verify that the user has been successfully invited to the team
    const result = app.invitationModal.result;
    await expect(result.sent).toBeVisible();
    await expect(result.sent).toContainMessage(Msg.invite.members['added-to-team']);

    await adminClient.patchConfig({
        ServiceSettings: {EnableEmailInvitations: true},
    });
    await pw.waitUntil(async () => {
        const cfg = await adminClient.getConfig();
        return cfg.ServiceSettings?.EnableEmailInvitations === true;
    });

    // # Click 'Invite More People' to return to the invite form
    await result.inviteMoreButton.clickTo(app.invitationModal.invite.users.inputCombobox);

    // # Invite a user with an invalid email domain (not sample.mattermost.com)
    const invalidEmail = `user.${pw.random.id()}@invalid.com`;
    await inviteByEmail(app, invalidEmail);

    // * Verify that the invite failed with the correct domain restriction error
    await expect(result.notSent).toBeVisible();
    await expect(result.notSent).toContainText(
        `The following email addresses do not belong to an accepted domain: ${invalidEmail}.`,
    );
});
