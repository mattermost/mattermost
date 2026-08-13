// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

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
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Open channel members RHS by clicking the Members button in the header
    await channelsPage.centerView.header.openChannelMenu();
    const membersMenuItem = page.locator('#channelMembers');
    await membersMenuItem.click();

    // * Verify the channel members RHS is visible
    await channelsPage.sidebarRight.toBeVisible();

    // # Find the test user in the member list and click their display name to open profile popover
    const memberEntry = page.getByTestId(`memberline-${testUser.id}`);
    await expect(memberEntry).toBeVisible();

    const displayName = memberEntry.locator('.channel-members-rhs__display-name');
    await displayName.click();

    // * Verify the profile popover is visible
    const popover = channelsPage.userProfilePopover;
    await popover.toBeVisible();
    await expect(popover.container.getByText(`@${testUser.username}`)).toBeVisible();

    // # Click outside the popover to close it
    await page.mouse.click(1, 1);

    // * Verify the profile popover is no longer visible
    await expect(popover.container).not.toBeVisible();
});
