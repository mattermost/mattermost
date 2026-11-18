// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Api, expect, postWith, settle, test, waitForApi, type App, DefaultChannel} from '@mattermost/playwright-lib';

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
        await modal.options.user(member).container.click();
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
 * @objective Verify muting a group message suppresses normal unread notification styling but keeps mention counts.
 */
test('MM-T475 Group Message Channel Preferences Mute channel', async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const [sender, secondParticipant] = await adminClient.createUsers(team.id, 2, 'gm-mute');
    const gmChannel = await adminClient.createGroupChannel([user.id, sender.id, secondParticipant.id]);

    // # Open the GM and mute it through notification preferences
    const {page, app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, path: 'messages', channel: gmChannel});
    await expect(app.center.composer.locator).toBeVisible();
    await app.channelHeader.openMenuButton.click();
    await expect(app.channelHeader.menu.notificationPreferencesMenuItem).toBeVisible();
    const preferences = await app.channelHeader.menu.notificationPreferencesMenuItem.clickTo(
        app.channelNotificationsModal,
    );
    await expect(preferences).toBeVisible();
    await preferences.muteCheckbox.check();
    await expect(preferences.muteCheckbox).toBeChecked();
    await Promise.all([waitForApi(page, Api.UpdateChannelNotifyProps), preferences.saveButton.click()]);
    await expect(preferences).not.toBeVisible();

    // # Post a normal message from another participant while away
    // `goto` is a full page navigation, so (re-)stub notifications only once settled on the away channel
    await app.channelsPage.goto({team, channel: DefaultChannel.OffTopic});
    await pw.stubNotification(page, 'granted');
    await pw.postAs(sender, {channel_id: gmChannel.id, message: 'Muted normal GM message'});

    // * Verify no notification fires for the normal message while muted. Every GM post implicitly
    // mentions all members server-side (server/channels/app/notification.go), so the mention badge
    // still shows here even for a non-@mention message — that's current, correct behavior, not a bug.
    // (the badge counting the post shows the client has processed it, so a notification would have fired by then)
    await expect(app.lhs.channelList.channel(gmChannel).mentionBadgeText).toHaveText('1');
    expect(await page.evaluate(() => window.getNotifications())).toHaveLength(0);

    // # Post a message that mentions the user while away
    await pw.postAs(sender, {
        channel_id: gmChannel.id,
        message: `@${user.username} Muted mention GM message`,
    });

    // * Verify muting still suppresses the notification, but the mention indicator appears
    await expect(app.lhs.channelList.channel(gmChannel).mentionBadgeText).toHaveText('2');
    expect(await page.evaluate(() => window.getNotifications())).toHaveLength(0);
});

/**
 * @objective Verify a closed group message can be reopened from the Direct Messages modal.
 */
test('MM-T478 Closing group message channels and re-opening via Direct Messages modal', async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const participants = await adminClient.createUsers(team.id, 2, 'gm-reopen');
    const gmChannel = await adminClient.createGroupChannel([user.id, participants[0].id, participants[1].id]);

    // # Open then close the group message conversation
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, path: 'messages', channel: gmChannel});
    await expect(app.center.composer.locator).toBeVisible();
    await closeGroup(app, gmChannel.name);
    await expect(app.lhs.channelList.channel(gmChannel).locator).toHaveCount(0);

    // # Reopen the same GM from the Direct Messages modal. Searching by a single member's username
    // only surfaces an option to start a new conversation with that one person, not the existing
    // group message, so reselect both participants to resurface the existing conversation.
    await openGroup(app, participants);

    // * Verify the existing group message opens again
    await expect(app.channelHeader.openMenuButton).toContainText(participants[0].username);
    await expect(app.channelHeader.openMenuButton).toContainText(participants[1].username);
});

/**
 * @objective Verify that a closed group message can be reopened via a saved message and via the Direct Messages modal.
 *
 * MM-T477 and MM-T479 are duplicates of MM-T476 and are covered by this test.
 */
test(
    'MM-T476 MM-T477 MM-T479 closes and reopens a group message via saved messages and the DM modal',
    {tag: '@direct_messages'},
    async ({pw}) => {
        // # Create the test user plus two more users on the team
        const {user, team, adminClient, userClient, townSquare} = await pw.initSetup();
        const [member1, member2] = await adminClient.createUsers(team.id, 2, 'gm');

        const {page, app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: townSquare});

        // # Create a group message and post a message, then save that message
        await openGroup(app, [member1, member2]);
        const slug = getChannelSlugFromUrl(page);

        const token = `message to save ${pw.random.id()}`;
        await app.center.postCreate.message.container.fill(token);
        const sent = await settle(app.center.postCreate.sendButton, {wait: Api.CreatePost}).click();
        const savedPostId = sent.id;
        await expect(app.center.postList.post(sent).message.container).toHaveText(token);
        await userClient.savePreferences(user.id, [
            {user_id: user.id, category: 'flagged_post', name: savedPostId, value: 'true'},
        ]);

        // # Close the group message conversation
        await closeGroup(app, slug);

        // # Reopen the group message by jumping to the saved message
        await app.globalHeader.savedMessagesButton.clickTo(app.search.results.post(savedPostId).container);
        const result = await postWith(app.search.results, {text: token});
        await expect(result).toContainText(token);
        await result.container.hover();
        await result.menu.jumpLink.click();

        // * Verify the group message channel is reopened
        await expect.poll(() => page.url(), {timeout: pw.duration.ten_sec}).toContain(`/messages/${slug}`);

        // # Close it again and reopen it via the Direct Messages modal
        await closeGroup(app, slug);
        await openGroup(app, [member1, member2]);

        // * Verify the group message channel is reopened again
        await expect.poll(() => page.url(), {timeout: pw.duration.ten_sec}).toContain(`/messages/${slug}`);
    },
);
