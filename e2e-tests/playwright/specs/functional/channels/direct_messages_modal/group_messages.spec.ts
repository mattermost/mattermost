// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {duration, expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify users can be added and removed while creating a group message.
 */
test('MM-T460 Add and remove users while creating new Group Message', async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const participants = await adminClient.createUsers(team.id, 3, 'gm-edit');

    // # Open the Direct Messages modal and select two users
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();
    const modal = await channelsPage.openDirectChannelsModal();
    await modal.selectUser(participants[0]);
    await modal.selectUser(participants[1]);

    // * Verify two users are selected, and the remaining-members counter reflects the selection
    // (a group message allows up to 8 members total, 7 besides the current user)
    await expect(modal.getRemoveButton(participants[0].username)).toBeVisible();
    await expect(modal.getRemoveButton(participants[1].username)).toBeVisible();
    await expect(modal.memberLimitHelpText).toContainText('You can add 5 more people');

    // # Remove one user via its remove button
    await modal.removeUser(participants[1].username);

    // * Verify the counter reflects the removal
    await expect(modal.memberLimitHelpText).toContainText('You can add 6 more people');

    // # Add a different user
    await modal.selectUser(participants[2]);

    // * Verify the selected list reflects the removal and addition, and the counter updates again
    await expect(modal.getRemoveButton(participants[1].username)).toHaveCount(0);
    await expect(modal.getRemoveButton(participants[2].username)).toBeVisible();
    await expect(modal.memberLimitHelpText).toContainText('You can add 5 more people');

    // # Remove the last selected user via backspace in the empty search input
    await modal.searchInput.press('Backspace');

    // * Verify the selected list and counter reflect the backspace removal
    await expect(modal.getRemoveButton(participants[2].username)).toHaveCount(0);
    await expect(modal.memberLimitHelpText).toContainText('You can add 6 more people');
});

/**
 * @objective Verify the group message intro, sidebar label, and member count render for participants.
 */
test('MM-T465 Create a group message and show participant details', async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const participants = await adminClient.createUsers(team.id, 2, 'gm-intro');

    // # Create a group message from the Direct Messages modal
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();
    const modal = await channelsPage.openDirectChannelsModal();
    for (const participant of participants) {
        await modal.selectUser(participant);
    }
    await modal.goToChannel();

    // * Verify the group message intro, participant avatars, sidebar label, and member count. The
    // sidebar label sorts the other participants' usernames with numeric-aware locale comparison
    // (digit runs compare by value, not by character code), so match that here rather than a plain
    // string sort.
    const sortedParticipants = [...participants].sort((a, b) =>
        a.username.localeCompare(b.username, undefined, {numeric: true}),
    );
    await expect(channelsPage.centerView.channelIntro).toContainText('This is the start of your group message history');
    await expect(channelsPage.centerView.channelIntro.locator('.profile-icon')).toHaveCount(2);
    await channelsPage.centerView.header.toHaveTitle(participants[0].username);
    await channelsPage.centerView.header.toHaveTitle(participants[1].username);
    await expect(channelsPage.sidebarLeft.item(participants[0].username)).toContainText(
        `${sortedParticipants[0].username}, ${sortedParticipants[1].username}`,
    );
    await expect(channelsPage.sidebarLeft.memberCountBadge(participants[0].username)).toContainText('2');

    // # Post a message so the group message persists in the sidebar
    await channelsPage.postMessage('Hi group');

    // * Verify the message appears in the group message
    await (await channelsPage.getLastPost()).toContainText('Hi group');
});

/**
 * @objective Verify a mention posted in a group message creates an unread mention for the mentioned participant.
 */
test('MM-T469 Create a group message and post a mention for another user', async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const [sender, secondParticipant] = await adminClient.createUsers(team.id, 2, 'gm-mention');
    const gmChannel = await adminClient.createGroupChannel([user.id, sender.id, secondParticipant.id]);

    // # View another channel, then have a participant mention the test user in the GM
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'off-topic');
    await channelsPage.toBeVisible();
    await pw.stubNotification(page, 'granted');
    await adminClient.createPost({
        channel_id: gmChannel.id,
        user_id: sender.id,
        message: `@${user.username} Hello from GM`,
    });

    // * Verify a desktop notification fires for the mention
    const notifications = await pw.waitForNotification(page, 1);
    expect(notifications.length).toBeGreaterThanOrEqual(1);

    // * Verify the group message becomes unread with a mention badge
    await channelsPage.sidebarLeft.assertItemUnread(sender.username);
    await expect(channelsPage.sidebarLeft.unreadMentionsBadge(sender.username)).toBeVisible();
});

/**
 * @objective Verify muting a group message suppresses normal unread notification styling but keeps mention counts.
 */
test('MM-T475 Group Message Channel Preferences Mute channel', async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const [sender, secondParticipant] = await adminClient.createUsers(team.id, 2, 'gm-mute');
    const gmChannel = await adminClient.createGroupChannel([user.id, sender.id, secondParticipant.id]);

    // # Open the GM and mute it through notification preferences
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.gotoMessage(team.name, gmChannel.name);
    await channelsPage.toBeVisible();
    const notificationPreferences = await channelsPage.openChannelNotificationPreferences();
    await notificationPreferences.muteChannelCheckbox.check();
    await notificationPreferences.save();

    // # Post a normal message from another participant while away
    // `goto` is a full page navigation, so (re-)stub notifications only once settled on the away channel
    await channelsPage.goto(team.name, 'off-topic');
    await pw.stubNotification(page, 'granted');
    await adminClient.createPost({channel_id: gmChannel.id, user_id: sender.id, message: 'Muted normal GM message'});

    // * Verify no notification fires for the normal message while muted. Every GM post implicitly
    // mentions all members server-side (server/channels/app/notification.go), so the mention badge
    // still shows here even for a non-@mention message — that's current, correct behavior, not a bug.
    await pw.wait(duration.two_sec);
    expect(await page.evaluate(() => window.getNotifications())).toHaveLength(0);
    await expect(channelsPage.sidebarLeft.unreadMentionsBadge(sender.username)).toBeVisible();

    // # Post a message that mentions the user while away
    await adminClient.createPost({
        channel_id: gmChannel.id,
        user_id: sender.id,
        message: `@${user.username} Muted mention GM message`,
    });

    // * Verify muting still suppresses the notification, but the mention indicator appears
    await pw.wait(duration.two_sec);
    expect(await page.evaluate(() => window.getNotifications())).toHaveLength(0);
    await expect(channelsPage.sidebarLeft.unreadMentionsBadge(sender.username)).toBeVisible();
});

/**
 * @objective Verify a closed group message can be reopened from the Direct Messages modal.
 */
test('MM-T478 Closing group message channels and re-opening via Direct Messages modal', async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const participants = await adminClient.createUsers(team.id, 2, 'gm-reopen');
    const gmChannel = await adminClient.createGroupChannel([user.id, participants[0].id, participants[1].id]);

    // # Open then close the group message conversation
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.gotoMessage(team.name, gmChannel.name);
    await channelsPage.toBeVisible();
    await channelsPage.closeGroupMessage();
    await expect(channelsPage.sidebarLeft.item(participants[0].username)).toHaveCount(0);

    // # Reopen the same GM from the Direct Messages modal. Searching by a single member's username
    // only surfaces an option to start a new conversation with that one person, not the existing
    // group message, so reselect both participants to resurface the existing conversation.
    const modal = await channelsPage.openDirectChannelsModal();
    await modal.selectUser(participants[0]);
    await modal.selectUser(participants[1]);
    await modal.goToChannel();

    // * Verify the existing group message opens again
    await channelsPage.centerView.header.toHaveTitle(participants[0].username);
    await channelsPage.centerView.header.toHaveTitle(participants[1].username);
});
