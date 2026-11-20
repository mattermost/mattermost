// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, settle, test, Api} from '@mattermost/playwright-lib';

/**
 * @objective Verify the member list of an archived channel is viewable but read-only (no member management).
 */
test('MM-T1671 shows a read-only member list for an archived channel', {tag: '@channels'}, async ({pw}) => {
    const {adminClient, adminUser, team, user} = await pw.initSetup();
    const channel = await adminClient.createPublicChannel(team.id, `Archive ${pw.random.id()}`);
    await adminClient.addToChannel(user.id, channel.id);

    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel});

    // * Verify the member list offers member management while the channel is active (the controls checked below)
    await app.channelHeader.openMenuButton.clickTo(app.channelHeader.menu.membersMenuItem);
    await app.channelHeader.menu.membersMenuItem.click();
    await expect(app.rhs.channelMembers.manageButton).toBeVisible();
    await expect(app.rhs.channelMembers.addButton).toBeVisible();

    // # Archive the channel
    await app.channelHeader.openMenuButton.clickTo(app.channelHeader.menu.membersMenuItem);
    const archiveModal = await app.channelHeader.menu.archiveChannelMenuItem.clickTo(app.deleteChannelModal);
    await settle(archiveModal.confirmButton, {wait: Api.DeleteChannel}).click();
    await expect(app.center.archivedNotice).toBeVisible();

    // # Open the channel members list
    await app.channelHeader.openMenuButton.clickTo(app.channelHeader.menu.membersMenuItem);
    await app.channelHeader.menu.membersMenuItem.click();

    // * Verify the member list is shown with the channel members
    const members = app.rhs.channelMembers;
    await expect(members.member(adminUser)).toBeVisible();
    await expect(members.member(user)).toBeVisible();

    // * Verify member management controls are not available for the archived channel
    await expect(members.manageButton).not.toBeVisible();
    await expect(members.addButton).not.toBeVisible();
});

/**
 * @objective Verify a post from an archived channel can be found in search and its Jump link opens the
 * archived channel in read-only mode.
 */
test('MM-T1679 opens an archived channel by jumping from search results', {tag: '@channels'}, async ({pw}) => {
    const {adminClient, team, user, townSquare} = await pw.initSetup();
    const channel = await adminClient.createPublicChannel(team.id, `Archived ${pw.random.id()}`);
    await adminClient.addToChannel(user.id, channel.id);
    const message = `archived post ${pw.random.id()}`;
    const post = await pw.postAs(user, {channel_id: channel.id, message});
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel});

    // # Archive the channel, then move to another channel
    await app.channelHeader.openMenuButton.clickTo(app.channelHeader.menu.membersMenuItem);
    const archiveModal = await app.channelHeader.menu.archiveChannelMenuItem.clickTo(app.deleteChannelModal);
    await settle(archiveModal.confirmButton, {wait: Api.DeleteChannel}).click();
    await expect(app.center.archivedNotice).toBeVisible();
    await app.lhs.channelList.channel(townSquare).container.click();
    await expect(app.channelHeader.openMenuButton).toContainText(townSquare.display_name);
    await expect(app.center.archivedNotice).not.toBeVisible();

    // # Search for the message posted in the archived channel
    await app.globalHeader.search.openButton.clickTo(app.searchBox.inputSearchbox);
    await app.searchBox.inputSearchbox.fill(message);
    await app.searchBox.inputSearchbox.press('Enter');

    // # Jump to the post from the search results
    const result = app.search.results.post(post);
    await expect(result.message.container).toHaveText(message);
    await result.container.hover();
    await result.menu.jumpLink.click();

    // * Verify the archived channel is opened in read-only mode
    await expect(app.channelHeader.openMenuButton).toContainText(channel.display_name);
    await expect(app.channelHeader.archivedIconText).toBeVisible();
    await expect(app.center.archivedNotice).toBeVisible();
    await expect(app.center.postCreate.message.container).not.toBeVisible();
});
