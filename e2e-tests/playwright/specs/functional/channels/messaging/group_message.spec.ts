// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify a group message channel header can be added, posts a system message, and updates read state for participants.
 */
test('MM-T472 Add a channel header to a GM', {tag: '@messaging'}, async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const members = await adminClient.createUsers(team.id, 3, 'gm-header-add');
    const groupChannel = await adminClient.createGroupChannel([user.id, ...members.map((member) => member.id)]);
    const header = 'peace and progress';

    // # Open the group message
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.gotoMessage(team.name, groupChannel.name);
    await channelsPage.toBeVisible();
    // * Verify no channel header is set
    await expect(channelsPage.centerView.header.addChannelHeaderButton).not.toBeVisible();

    // # Hover the header, open the header editor, and save a header
    await channelsPage.centerView.header.openAddChannelHeader();
    await channelsPage.editChannelHeaderModal.setHeaderWithEnter(header);

    // * Verify the header appears and a deletable system message records the update
    await expect(channelsPage.centerView.header.getHeaderText(header)).toBeVisible();
    const systemPost = await channelsPage.getLastPost();
    await systemPost.toContainText('updated the channel header');
    await systemPost.hover();
    await systemPost.postMenu.openDotMenu();
    await expect(channelsPage.postDotMenu.deleteMenuItem).toBeVisible();
    await page.keyboard.press('Escape');

    // * Verify the group message remains read for the user who changed the header
    await channelsPage.sidebarLeft.assertItemRead(members[0].username);

    // # Sign in as another group member and view Town Square
    const {channelsPage: memberChannelsPage} = await pw.testBrowser.login(members[0]);
    await memberChannelsPage.goto(team.name, 'town-square');
    await memberChannelsPage.toBeVisible();

    // * Verify the header update marks the group message unread for the other member
    await memberChannelsPage.sidebarLeft.assertItemUnread(user.username);
});

/**
 * @objective Verify an existing group message channel header can be edited and marks the conversation unread for another participant.
 */
test('MM-T473_1 Edit GM channel header', {tag: '@messaging'}, async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const members = await adminClient.createUsers(team.id, 3, 'gm-header-edit');
    const groupChannel = await adminClient.createGroupChannel([user.id, ...members.map((member) => member.id)]);
    await adminClient.patchChannel(groupChannel.id, {header: 'peace and progress'});
    const header = 'In pursuit of peace and progress';

    // # Open the group message with an existing header
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.gotoMessage(team.name, groupChannel.name);
    await channelsPage.toBeVisible();

    // * Verify the add-header action is absent because a header is already set
    await expect(channelsPage.centerView.header.addChannelHeaderButton).toHaveCount(0);

    // # Open the channel menu, choose Edit Header, and save the replacement
    const channelMenu = await channelsPage.openChannelMenu();
    await channelMenu.openEditHeader();
    await channelsPage.editChannelHeaderModal.setHeaderWithEnter(header);

    // * Verify the new header appears and a system message records the update
    await expect(channelsPage.centerView.header.getHeaderText(header)).toBeVisible();
    await (await channelsPage.getLastPost()).toContainText('updated the channel header');

    // # Sign in as another group member and view Town Square
    const {channelsPage: memberChannelsPage} = await pw.testBrowser.login(members[0]);
    await memberChannelsPage.goto(team.name, 'town-square');
    await memberChannelsPage.toBeVisible();

    // * Verify the edit marks the group message unread for the other member
    await memberChannelsPage.sidebarLeft.assertItemUnread(user.username);
});

/**
 * @objective Verify a username mention in a group message channel header is interactive without highlighting the current user.
 */
test('MM-T473_2 Edit GM channel header with a mention', {tag: '@messaging'}, async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const members = await adminClient.createUsers(team.id, 3, 'gm-header-mention');
    const groupChannel = await adminClient.createGroupChannel([user.id, ...members.map((member) => member.id)]);
    await adminClient.patchChannel(groupChannel.id, {header: 'peace and progress'});
    const header = `In pursuit of peace and progress by @${user.username}`;

    // # Open the group message and edit the existing header
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.gotoMessage(team.name, groupChannel.name);
    await channelsPage.toBeVisible();
    const channelMenu = await channelsPage.openChannelMenu();
    await channelMenu.openEditHeader();
    await channelsPage.editChannelHeaderModal.setHeader(header);

    // * Verify the mention opens the user's profile and is not highlighted for the mentioned user
    const mention = channelsPage.centerView.header.getHeaderMention(`@${user.username}`);
    await expect(mention).toBeVisible();
    await expect(mention).toHaveText(`@${user.username}`);
    await expect(mention).not.toHaveClass(/mention--highlight/);
});
