// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify the member list of an archived channel is viewable but read-only (no member management).
 */
test('MM-T1671 shows a read-only member list for an archived channel', {tag: '@channels'}, async ({pw}) => {
    const {adminClient, adminUser, team, user} = await pw.initSetup();
    const channel = await adminClient.createPublicChannel(team.id, `Archive ${pw.random.id()}`);
    await adminClient.addToChannel(user.id, channel.id);
    await adminClient.addToChannel(adminUser.id, channel.id);

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
    await expect(channelsPage.sidebarRight.container.getByText(adminUser.username).first()).toBeVisible();

    // * Verify member management controls are not available for the archived channel
    await expect(channelsPage.sidebarRight.manageMembersButton).not.toBeVisible();
    await expect(channelsPage.sidebarRight.addMembersButton).not.toBeVisible();
});
