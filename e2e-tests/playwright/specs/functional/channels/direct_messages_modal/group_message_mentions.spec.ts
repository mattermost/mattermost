// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Api, expect, settle, test, waitForApi, type App} from '@mattermost/playwright-lib';

import {getChannelSlugFromUrl} from './helpers';

/** Opens a group conversation by selecting its members in the Direct Messages dialog. */
async function openGroup(app: App, members: Array<{id: string; username: string}>) {
    await app.lhs.header.openBrowseOrAddMenuButton.click();
    await expect(app.lhs.browseOrAddMenu.openDirectMessageMenuItem).toBeVisible();
    const modal = await app.lhs.browseOrAddMenu.openDirectMessageMenuItem.clickTo(app.directMessagesModal);
    for (const member of members) {
        // Opening the dialog can also search; wait for the response to this member's term.
        await Promise.all([
            waitForApi(app.page, Api.SearchUsers, {
                predicate: (_, response) => response.request().postDataJSON()?.term === member.username,
            }),
            modal.options.searchCombobox.fill(member.username),
        ]);
        // The add button shows when the row is hovered.
        await modal.options.user(member).container.hover();
        await modal.options.user(member).addButton.click();
        await expect(modal.options.remove(member.id)).toBeVisible();
    }
    await modal.options.saveButton.click();
    await expect(modal).not.toBeVisible();
    for (const member of members) {
        await expect(app.channelHeader.openMenuButton).toContainText(member.username);
    }
}

/** Closes the current group conversation and waits for its sidebar entry to leave. */
async function closeGroup(app: App, name: string) {
    await app.channelHeader.openMenuButton.click();
    await expect(app.channelHeader.menu.closeMessageMenuItem).toBeVisible();
    await app.channelHeader.menu.closeMessageMenuItem.click();
    await expect(app.lhs.channelList.channel(name)).not.toBeAttached();
}

/**
 * @objective Verify a mention posted in a group message creates an unread mention for the mentioned participant.
 */
test('MM-T469 Create a group message and post a mention for another user', async ({pw}) => {
    const {adminClient, team, user, offTopic} = await pw.initSetup();
    const [sender, secondParticipant] = await adminClient.createUsers(team.id, 2, 'gm-mention');
    const gmChannel = await adminClient.createGroupChannel([user.id, sender.id, secondParticipant.id]);

    // # View another channel, then have a participant mention the test user in the GM
    const {page, app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: offTopic});
    await pw.stubNotification(page, 'granted');
    await pw.postAs(sender, {
        channel_id: gmChannel.id,
        message: `@${user.username} Hello from GM`,
    });

    // * Verify a desktop notification fires for the mention
    const notifications = await pw.waitForNotification(page, 1);
    expect(notifications.length).toBeGreaterThanOrEqual(1);

    // * Verify the group message becomes unread with a mention badge
    await expect(app.lhs.channelList.channel(gmChannel).container).toHaveAccessibleName(/ (unread|\d+ mentions?)$/);
    await expect(app.lhs.channelList.channel(gmChannel).mentionBadgeText).toBeVisible();
});

/**
 * @objective Verify that a group message can be created with a mention, closed, and then recreated with the same members.
 *
 * MM-T480 covers the same behavior as MM-T466 and is covered by this test.
 */
test(
    'MM-T466 MM-T480 creates a group message with a mention, closes it, and recreates it',
    {tag: '@direct_messages'},
    async ({pw}) => {
        // # Create the test user plus two more users on the team
        const {user, team, adminClient, townSquare} = await pw.initSetup();
        const [member1, member2] = await adminClient.createUsers(team.id, 2, 'gm');

        const {page, app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: townSquare});

        // # Create a group message with the two members
        await openGroup(app, [member1, member2]);

        // # Post a message that mentions one of the members
        const token = `gm mention ${pw.random.id()}`;
        await app.center.postCreate.message.container.fill(`@${member1.username} ${token}`);
        const sent = await settle(app.center.postCreate.sendButton, {wait: Api.CreatePost}).click();
        await expect(app.center.postList.post(sent).message.container).toContainText(token);

        // # Close the group message conversation
        const slug = getChannelSlugFromUrl(page);
        await closeGroup(app, slug);

        // # Recreate the group message with the same members
        await openGroup(app, [member1, member2]);

        // * Verify the same group message channel is reopened
        await expect.poll(() => page.url(), {timeout: pw.duration.ten_sec}).toContain(`/messages/${slug}`);
    },
);
