// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {duration, expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify a user can open a self direct message, post a message, and does not receive a desktop notification.
 */
test('MM-T457 Self direct message', {tag: '@direct_messages'}, async ({pw}) => {
    const {team, user} = await pw.initSetup();

    // # Open the Direct Messages modal and search for the current user
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();
    await pw.stubNotification(page, 'granted');
    const modal = await channelsPage.openDirectChannelsModal();

    // * Verify the current user appears, then select them to immediately open the self direct message
    await modal.openSelfDirectMessage(user.username);

    // * Verify the channel header identifies the current user
    await channelsPage.centerView.header.toHaveTitle(`${user.username} (you)`);

    // # Post a message to the self direct message
    await channelsPage.postMessage('todo list for today: 1,2,3');
    await pw.wait(duration.one_sec);

    // * Verify no desktop notification is received for the self-authored message
    expect(await page.evaluate(() => window.getNotifications())).toHaveLength(0);
});

/**
 * @objective Verify a direct message channel header supports multiline text and displays the saved text in its popover.
 */
test('MM-T458 Edit direct message channel header', {tag: '@direct_messages'}, async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const [otherUser] = await adminClient.createUsers(team.id, 1, 'dm-header');
    const channel = await adminClient.createDirectChannel([user.id, otherUser.id]);
    await adminClient.createPost({channel_id: channel.id, user_id: otherUser.id, message: 'Hello'});

    // # Open the direct message and choose to add its channel header
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, `@${otherUser.username}`);
    await channelsPage.toBeVisible();
    await channelsPage.centerView.header.openAddChannelHeader();

    // # Enter and save a multiline channel header
    const expectedHeader = 'This is a line\n\nThis is another line';
    await channelsPage.editChannelHeaderModal.setHeaderWithEnter(expectedHeader);

    // # Hover over the saved header text
    await page.mouse.move(0, 0);
    const tooltip = channelsPage.centerView.header.getHeaderTooltip('This is a line');
    await expect(tooltip).not.toBeVisible();
    const headerText = channelsPage.centerView.header.getHeaderText('This is a line');
    await headerText.hover({force: true});

    // * Verify the popover displays the complete multiline header
    await expect(tooltip).toHaveText(expectedHeader);
});
