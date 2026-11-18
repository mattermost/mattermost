// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Api, duration, expect, settle, test, waitForApi} from '@mattermost/playwright-lib';

/**
 * @objective Verify a user can open a self direct message, post a message, and does not receive a desktop notification.
 */
test('MM-T457 Self direct message', {tag: '@direct_messages'}, async ({pw}) => {
    const {team, user} = await pw.initSetup();

    // # Open the Direct Messages modal and search for the current user
    const {app, page} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: 'town-square'});
    await expect(app.center.postCreate).toBeVisible();
    await pw.stubNotification(page, 'granted');
    await app.lhs.header.openBrowseOrAddMenuButton.clickTo(app.lhs.browseOrAddMenu.openDirectMessageMenuItem);
    const modal = await app.lhs.browseOrAddMenu.openDirectMessageMenuItem.clickTo(app.directMessagesModal);

    // * Verify the current user appears, then select them to immediately open the self direct message
    await Promise.all([
        waitForApi(page, Api.SearchUsers, {
            predicate: (_, response) => response.request().postDataJSON()?.term === user.username,
        }),
        modal.options.searchCombobox.fill(user.username),
    ]);
    await expect(modal.options.user(user)).toBeVisible();
    // A user suggestion is exposed as a role-free row; choosing it requires its scoped locator.
    await modal.options.user(user).container.click();
    await expect(modal).not.toBeVisible();

    // * Verify the channel header identifies the current user
    await expect(app.channelHeader.openMenuButton).toContainText(`${user.username} (you)`);

    // # Post a message to the self direct message
    await app.center.postCreate.message.container.fill('todo list for today: 1,2,3');
    await settle(app.center.postCreate.sendButton, {wait: Api.CreatePost}).click();
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
    const {client: otherUserClient} = await pw.makeClient(otherUser);
    await otherUserClient.createPost({channel_id: channel.id, message: 'Hello'});

    // # Open the direct message and choose to add its channel header
    const {app, page} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, path: 'messages', channel: `@${otherUser.username}`});
    await expect(app.center.postCreate).toBeVisible();
    await app.channelHeader.container.hover();
    const editHeader = await app.channelHeader.addHeaderButton.clickTo(app.editChannelHeaderModal);

    // # Enter and save a multiline channel header
    const expectedHeader = 'This is a line\n\nThis is another line';
    await editHeader.header.container.fill(expectedHeader);
    await settle(editHeader.header.container, {wait: Api.PatchChannel}).press('Enter');
    await expect(editHeader).not.toBeVisible();

    // # Hover over the saved header text
    await page.mouse.move(0, 0);
    const tooltip = app.channelHeader.descriptionPopover;
    await expect(tooltip).not.toBeVisible();
    const headerText = app.channelHeader.description;
    await expect(headerText).toContainText('This is a line');
    // Force the hover: opening the popover mounts a full-screen floating overlay that would otherwise be
    // reported as intercepting the pointer.
    await headerText.locator.hover({force: true});

    // * Verify the popover displays the complete multiline header, including preserved line breaks
    await expect(tooltip).toBeVisible();
    // toHaveText normalizes whitespace, so the preserved line breaks are read from the rendered innerText
    await expect.poll(async () => tooltip.locator.evaluate((el: HTMLElement) => el.innerText)).toBe(expectedHeader);
});
