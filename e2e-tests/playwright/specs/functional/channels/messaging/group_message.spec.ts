// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Api, expect, settle, test, type App} from '@mattermost/playwright-lib';

// A sidebar link's accessible name ends in "unread", or "N mention(s)", while the channel has unread messages
const UNREAD = / (unread|\d+ mentions?)$/;

/** The text of the channel's newest post. */
async function lastPostText(app: App) {
    const lastId = (await app.center.postList.postList.keys()).at(-1);
    return lastId ? app.center.postList.post({id: lastId}).message.container.text() : '';
}

/**
 * @objective Verify a group message channel header can be added, posts a system message, and updates read state for participants.
 */
test('MM-T472 Add a channel header to a GM', {tag: '@messaging'}, async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const members = await adminClient.createUsers(team.id, 3, 'gm-header-add');
    const groupChannel = await adminClient.createGroupChannel([user.id, ...members.map((member) => member.id)]);
    const header = 'peace and progress';

    // # Open the group message
    const {app, page} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, path: 'messages', channel: groupChannel});

    // * Verify no channel header is set (the add button shows only on hover)
    await expect(app.channelHeader.openMenuButton).toBeVisible();
    await expect(app.channelHeader.addHeaderButton).not.toBeVisible();

    // # Hover the header, open the header editor, and save a header
    await app.channelHeader.openMenuButton.hover();
    const editor = await app.channelHeader.addHeaderButton.clickTo(app.editChannelHeaderModal);
    await editor.header.container.fill(header);
    await settle(editor.saveButton, {wait: Api.PatchChannel}).click();
    await expect(editor.header.container).not.toBeVisible();

    // * Verify the header appears and a deletable system message records the update
    await expect(app.channelHeader.description).toContainText(header);
    await expect.poll(() => lastPostText(app)).toContain('updated the channel header');
    const systemPost = app.center.postList.post({id: (await app.center.postList.postList.keys()).at(-1)!});
    await systemPost.container.hover();
    await systemPost.menu.dotMenuButton.clickTo(app.postDotMenu);
    const dotMenu = app.postDotMenu;
    await expect(dotMenu.deleteMenuItem).toBeVisible();
    await page.keyboard.press('Escape');

    // * Verify the group message remains read for the user who changed the header
    await expect(app.lhs.channelList.channel(groupChannel).container).not.toHaveAccessibleName(UNREAD);

    // # Sign in as another group member and view Town Square
    const townSquare = await adminClient.getChannelByName(team.id, 'town-square');
    const {app: memberApp} = await pw.testBrowser.login(members[0]);
    await memberApp.channelsPage.goto({team, channel: townSquare});

    // * Verify the header update marks the group message unread for the other member
    await expect(memberApp.lhs.channelList.channel(groupChannel).container).toHaveAccessibleName(UNREAD);
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
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, path: 'messages', channel: groupChannel});

    // * Verify the add-header action is absent because a header is already set
    await expect(app.channelHeader.description).toContainText('peace and progress');
    await expect(app.channelHeader.addHeaderButton).toHaveCount(0);

    // # Open the channel menu, choose Edit Header, and save the replacement
    await app.channelHeader.openMenuButton.click();
    await expect(app.channelHeader.menu.settingsMenuItem).toBeVisible();
    const menu = app.channelHeader.menu;
    await menu.settingsMenuItem.hover(); // a group message keeps Edit Header in the Settings submenu
    const editor = await menu.editHeaderMenuItem.clickTo(app.editChannelHeaderModal);
    await editor.header.container.fill(header);
    await settle(editor.saveButton, {wait: Api.PatchChannel}).click();
    await expect(editor.header.container).not.toBeVisible();

    // * Verify the new header appears and a system message records the update
    await expect(app.channelHeader.description).toContainText(header);
    await expect.poll(() => lastPostText(app)).toContain('updated the channel header');

    // # Sign in as another group member and view Town Square
    const townSquare = await adminClient.getChannelByName(team.id, 'town-square');
    const {app: memberApp} = await pw.testBrowser.login(members[0]);
    await memberApp.channelsPage.goto({team, channel: townSquare});

    // * Verify the edit marks the group message unread for the other member
    await expect(memberApp.lhs.channelList.channel(groupChannel).container).toHaveAccessibleName(UNREAD);
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
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, path: 'messages', channel: groupChannel});
    await app.channelHeader.openMenuButton.click();
    await expect(app.channelHeader.menu.settingsMenuItem).toBeVisible();
    const menu = app.channelHeader.menu;
    await menu.settingsMenuItem.hover(); // a group message keeps Edit Header in the Settings submenu
    const editor = await menu.editHeaderMenuItem.clickTo(app.editChannelHeaderModal);
    await editor.header.container.fill(header);
    await settle(editor.saveButton, {wait: Api.PatchChannel}).click();
    await expect(editor.header.container).not.toBeVisible();

    // * Verify the mention is shown and is not highlighted for the mentioned user
    const mention = app.channelHeader.markdown.mention(user);
    await expect(mention).toBeVisible();
    await expect(mention).toHaveText(`@${user.username}`);
    await expect(mention).not.toHaveClass(/mention--highlight/);
});
