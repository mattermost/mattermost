// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify a member's name in the channel members RHS opens and closes their profile popover.
 */
test('should open and close profile popover from channel members RHS', async ({pw}) => {
    // # Initialize setup with two users in the same team and channel
    const {user, team, adminClient} = await pw.initSetup();

    const channel = await adminClient.createChannel(
        pw.random.channel({teamId: team.id, displayName: 'Test Channel', name: 'test-channel'}),
    );
    await adminClient.addToChannel(user.id, channel.id);

    const testUser = await adminClient.createUser(await pw.random.user(), '', '');
    await adminClient.addToTeam(team.id, testUser.id);
    await adminClient.addToChannel(testUser.id, channel.id);

    // # Log in and navigate to the channel
    const {app, page} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel});

    // # Open the channel members RHS from the channel menu
    await app.channelHeader.openMenuButton.click();
    await expect(app.channelHeader.menu.membersMenuItem).toBeVisible();
    await app.channelHeader.menu.membersMenuItem.click();

    // # Click the test user's name in the member list to open their profile popover
    const member = app.rhs.channelMembers.member(testUser);
    await expect(member).toBeVisible();
    // the name is text inside the profile popover's button: clicking it opens the popover (a text part has no click verb)
    await member.profile.click();

    // * Verify the profile popover shows the user
    const popover = app.profilePopover;
    await expect(popover).toBeVisible();
    await expect(popover).toContainText(`@${testUser.username}`);

    // # Click outside the popover to close it
    await page.mouse.click(1, 1);

    // * Verify the profile popover is no longer visible
    await expect(popover).not.toBeVisible();
});
