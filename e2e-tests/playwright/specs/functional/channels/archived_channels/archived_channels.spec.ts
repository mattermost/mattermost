// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify the member list of an archived channel is viewable but read-only (no member management).
 *
 * MM-T1719 is an exact duplicate of MM-T1671 and is covered by this test.
 */
test('MM-T1671 MM-T1719 shows a read-only member list for an archived channel', {tag: '@channels'}, async ({pw}) => {
    const {adminClient, adminUser, team, user} = await pw.initSetup();
    const channel = await adminClient.createPublicChannel(team.id, `Archive ${pw.random.id()}`);
    await adminClient.addToChannel(user.id, channel.id);

    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Archive the channel
    await channelsPage.archiveChannel();

    // # Open the channel members list
    const channelMenu = await channelsPage.openChannelMenu();
    await channelMenu.members.click();
    await channelsPage.sidebarRight.toBeVisible();

    // * Verify the member list is shown with the channel members
    await channelsPage.sidebarRight.toContainText(adminUser.username);

    // * Verify member management controls are not available for the archived channel
    await expect(channelsPage.sidebarRight.manageMembersButton).not.toBeVisible();
    await expect(channelsPage.sidebarRight.addMembersButton).not.toBeVisible();
});

/**
 * @objective Verify a post from an archived channel can be found in search and its Jump link opens the
 * archived channel in read-only mode.
 */
test('MM-T1679 opens an archived channel by jumping from search results', {tag: '@channels'}, async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const channel = await adminClient.createPublicChannel(team.id, `Archived ${pw.random.id()}`);
    await adminClient.addToChannel(user.id, channel.id);
    const message = `archived post ${pw.random.id()}`;
    await adminClient.createPost({channel_id: channel.id, user_id: user.id, message});

    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Archive the channel, then move to another channel
    await channelsPage.archiveChannel();
    await channelsPage.sidebarLeft.goToItem('town-square');
    await channelsPage.centerView.header.toHaveTitle('Town Square');

    // # Search for the message posted in the archived channel
    await channelsPage.searchFor(message);

    // # Jump to the post from the search results
    await expect(channelsPage.searchResultsPanel.getResultByText(message)).toBeVisible();
    await channelsPage.searchResultsPanel.jumpToResultWithText(message);

    // * Verify the archived channel is opened in read-only mode
    await channelsPage.centerView.header.toHaveTitle(channel.display_name);
    await expect(channelsPage.archivedChannelMessage).toBeVisible();
});
