// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {duration, expect, test} from '@mattermost/playwright-lib';

import {getChannelSlugFromUrl} from './helpers';

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
        const {user, team, adminClient, userClient} = await pw.initSetup();
        const [member1, member2] = await adminClient.createUsers(team.id, 2, 'gm');

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Create a group message and post a message, then save that message
        const dmModal = await channelsPage.openDirectChannelsModal();
        await dmModal.selectUser(member1);
        await dmModal.selectUser(member2);
        await dmModal.goToChannel();
        const slug = getChannelSlugFromUrl(page);

        const token = `message to save ${pw.random.id()}`;
        await channelsPage.postMessage(token);
        const savedPost = await channelsPage.getLastPost();
        const savedPostId = await savedPost.getId();
        await userClient.savePreferences(user.id, [
            {user_id: user.id, category: 'flagged_post', name: savedPostId, value: 'true'},
        ]);

        // # Close the group message conversation
        await channelsPage.sidebarLeft.closeConversationAndWait(slug);

        // # Reopen the group message by jumping to the saved message
        await channelsPage.globalHeader.openSavedMessages();
        await channelsPage.searchResultsPanel.toBeVisible();
        await channelsPage.searchResultsPanel.toContainText(token);
        await channelsPage.searchResultsPanel.jumpToResultWithText(token);

        // * Verify the group message channel is reopened
        await expect.poll(() => page.url(), {timeout: pw.duration.ten_sec}).toContain(`/messages/${slug}`);

        // # Close it again and reopen it via the Direct Messages modal
        await channelsPage.sidebarLeft.closeConversationAndWait(slug);
        const dmModal2 = await channelsPage.openDirectChannelsModal();
        await dmModal2.selectUser(member1);
        await dmModal2.selectUser(member2);
        await dmModal2.goToChannel();

        // * Verify the group message channel is reopened again
        await expect.poll(() => page.url(), {timeout: pw.duration.ten_sec}).toContain(`/messages/${slug}`);
    },
);
