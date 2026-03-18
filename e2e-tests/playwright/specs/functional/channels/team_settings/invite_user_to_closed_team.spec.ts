// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ChannelsPage, expect, test} from '@mattermost/playwright-lib';

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

    const {page} = await pw.testBrowser.login(adminUser);
    const channelsPage = new ChannelsPage(page);

    // # Navigate to team
    await channelsPage.goto(team.name);
    await page.waitForLoadState('networkidle');

    // # Open Team Settings Modal and go to Access tab
    const teamSettings = await channelsPage.openTeamSettings();
    const accessSettings = await teamSettings.openAccessTab();

    // # Enable "Allow only users with a specific email domain" and add the domain
    await accessSettings.enableAllowedDomains();
    await accessSettings.addDomain(emailDomain);

    // # Save changes
    await teamSettings.save();
    await teamSettings.verifySavedMessage();

    // # Close the Team Settings modal and wait for it to disappear
    await teamSettings.close();
    await expect(teamSettings.container).not.toBeVisible();

    // # Open team menu and click 'Invite People'
    await channelsPage.sidebarLeft.teamMenuButton.click();
    await channelsPage.teamMenu.toBeVisible();
    await channelsPage.teamMenu.clickInvitePeople();

    // # Get the invite people modal and invite user with valid email domain
    const inviteModal = await channelsPage.getInvitePeopleModal(team.display_name);
    await inviteModal.toBeVisible();
    await inviteModal.inviteByEmail(newUser.email);

    // * Verify that the user has been successfully invited to the team
    const membersInvitedModal = await channelsPage.getMembersInvitedModal(team.display_name);
    await membersInvitedModal.toBeVisible();
    const sentReason = await membersInvitedModal.getSentResultReason();
    expect(sentReason).toBe('This member has been added to the team.');

    // # Click 'Invite More People' to return to the invite form
    await membersInvitedModal.clickInviteMore();

    // # Invite a user with an invalid email domain (not sample.mattermost.com)
    const invalidEmail = `user.${await pw.random.id()}@invalid.com`;
    await inviteModal.inviteByEmail(invalidEmail);

    // * Verify that the invite failed with the correct domain restriction error
    const membersInvitedModal2 = await channelsPage.getMembersInvitedModal(team.display_name);
    await membersInvitedModal2.toBeVisible();
    const notSentReason = await membersInvitedModal2.getNotSentResultReason();
    expect(notSentReason).toContain(
        `The following email addresses do not belong to an accepted domain: ${invalidEmail}.`,
    );
});
