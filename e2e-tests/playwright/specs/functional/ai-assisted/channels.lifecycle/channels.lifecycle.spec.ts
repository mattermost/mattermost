// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * Verify that a user can create a channel, another user can join it,
 * and then leave it successfully. Tests the complete channel lifecycle.
 *
 * Precondition:
 * 1. A test server with default settings
 * 2. Two user accounts available
 */
test('Channel create, join, and leave lifecycle @ai-assisted', async ({pw}) => {
    // 1. Initialize with two users and a team
    const {user: user1, adminClient, team} = await pw.initSetup();
    const user2 = await adminClient.createUser(await pw.random.user('channeluser'), '', '');
    await adminClient.addToTeam(team.id, user2.id);

    // 2. Login as the first user
    const {channelsPage: channelsPage1} = await pw.testBrowser.login(user1);
    await channelsPage1.goto();
    await channelsPage1.toBeVisible();

    // 3. Create a new public channel
    const channelName = `test-channel-${Date.now()}`;
    await channelsPage1.createChannel(channelName);

    // * Verify the channel was created and appears in the sidebar
    const channelItem = channelsPage1.sidebarChannels.getByText(channelName, {exact: true});
    await expect(channelItem).toBeVisible();

    // 4. Logout and login as the second user
    await pw.testBrowser.logout();
    const {channelsPage: channelsPage2} = await pw.testBrowser.login(user2);
    await channelsPage2.goto();
    await channelsPage2.toBeVisible();

    // 5. Find and join the created channel
    await channelsPage2.openBrowseChannels();
    const publicChannelList = channelsPage2.publicChannelsList;
    const channelToJoin = publicChannelList.getByText(channelName, {exact: true});
    await expect(channelToJoin).toBeVisible();
    await channelToJoin.click();
    
    // * Verify join button and click it
    const joinButton = channelsPage2.joinChannelButton;
    await expect(joinButton).toBeVisible();
    await joinButton.click();

    // * Verify the channel now appears in the sidebar for user2
    const joinedChannelItem = channelsPage2.sidebarChannels.getByText(channelName, {exact: true});
    await expect(joinedChannelItem).toBeVisible();

    // 6. Leave the channel
    await channelsPage2.openChannelMenu();
    const leaveOption = channelsPage2.channelMenu.getByText('Leave Channel');
    await expect(leaveOption).toBeVisible();
    await leaveOption.click();

    // * Confirm the leave action if a dialog appears
    const confirmButton = channelsPage2.page.getByText('Yes, leave the channel');
    if (await confirmButton.isVisible()) {
        await confirmButton.click();
    }

    // 7. Verify the channel no longer appears in the sidebar
    await expect(joinedChannelItem).not.toBeVisible();
    
    // * Verify the channel still exists for user1 (the creator)
    await pw.testBrowser.logout();
    const {channelsPage: channelsPage1Again} = await pw.testBrowser.login(user1);
    await channelsPage1Again.goto();
    const creatorChannelItem = channelsPage1Again.sidebarChannels.getByText(channelName, {exact: true});
    await expect(creatorChannelItem).toBeVisible();
});
