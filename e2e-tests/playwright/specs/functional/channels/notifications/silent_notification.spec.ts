// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {postToWebhook} from '../webhook_helpers';

function notificationText(n: {title?: string; body?: string}) {
    return `${n.title ?? ''}\n${n.body ?? ''}`;
}

function channelHasMessage(posts: {posts: Record<string, {message?: string}>}, message: string) {
    return Object.values(posts.posts).some((p) => p.message?.includes(message));
}

test.describe('Silent notification webhook delivery', () => {
    /**
     * @objective Verify integration posts with silent=true are delivered in-channel without unread or desktop notify side effects.
     *
     * @precondition
     * - User is a member of a dedicated channel with an incoming webhook
     * - User is viewing a different channel so webhook posts are not auto-marked read
     * - Desktop notify level is mention-based (default); messages include @username
     */
    test(
        'incoming webhook silent post is visible without unread or desktop notification',
        {tag: ['@notifications']},
        async ({pw}) => {
            const {team, user, adminClient} = await pw.initSetup();

            const channel = await adminClient.createChannel(
                pw.random.channel({
                    teamId: team.id,
                    name: 'silent-hook',
                    displayName: 'Silent Hook Test',
                    unique: true,
                }),
            );
            await adminClient.addToChannel(user.id, channel.id);

            const webhook = await adminClient.createIncomingWebhook({
                channel_id: channel.id,
                display_name: 'Silent E2E Hook',
            });

            const {page, channelsPage} = await pw.testBrowser.login(user);

            // # Mark the webhook channel as read, then view another channel
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();
            await channelsPage.goto(team.name, 'off-topic');
            await channelsPage.toBeVisible();

            await pw.stubNotification(page, 'granted');

            // # Post a normal webhook message with @mention to verify unread + notification baseline
            const normalMessage = `normal webhook @${user.username} ${Date.now()}`;
            await postToWebhook(webhook.id, {text: normalMessage});
            await channelsPage.sidebarLeft.assertItemUnread(channel.name, pw.duration.half_min);
            await expect
                .poll(async () => (await page.evaluate(() => window.getNotifications())).length)
                .toBeGreaterThan(0);

            await channelsPage.sidebarLeft.goToItem(channel.name);
            const normalPost = await channelsPage.getLastPost();
            await normalPost.toContainText(normalMessage);

            await channelsPage.goto(team.name, 'off-topic');
            await channelsPage.toBeVisible();
            await channelsPage.sidebarLeft.assertItemRead(channel.name);

            const syncChannel = await adminClient.createChannel(
                pw.random.channel({
                    teamId: team.id,
                    name: 'sync-pulse',
                    displayName: 'Sync Pulse',
                    unique: true,
                }),
            );
            await adminClient.addToChannel(user.id, syncChannel.id);

            await pw.clearCapturedNotifications(page);

            // # Post silent webhook, then a normal post on another channel to flush the WS pipeline (FIFO)
            const silentMessage = `silent webhook @${user.username} ${Date.now()}`;
            await postToWebhook(webhook.id, {text: silentMessage, silent: true});

            await expect
                .poll(async () => channelHasMessage(await adminClient.getPosts(channel.id, 0, 30), silentMessage))
                .toBe(true);

            const pulseMessage = `pulse ${Date.now()}`;
            await adminClient.createPost({channel_id: syncChannel.id, message: pulseMessage});

            await channelsPage.sidebarLeft.assertItemUnread(syncChannel.name, pw.duration.half_min);
            await channelsPage.sidebarLeft.assertItemRead(channel.name);

            const notificationsAfterSilent = await page.evaluate(() => window.getNotifications());
            expect(notificationsAfterSilent.some((n) => notificationText(n).includes(silentMessage))).toBe(false);

            // * Silent post is still visible; no New Messages separator (final assertions — goToItem marks viewed)
            await channelsPage.sidebarLeft.goToItem(channel.name);
            const silentPost = await channelsPage.getLastPost();
            await silentPost.toContainText(silentMessage);
            await expect(channelsPage.centerView.notificationSeparator).not.toBeVisible();
        },
    );

    /**
     * @objective Verify a user @mentioned in a silent webhook post does not receive a desktop notification.
     */
    test(
        'silent webhook @mention does not desktop-notify the mentioned user',
        {tag: ['@notifications']},
        async ({pw}) => {
            const {team, user, adminClient} = await pw.initSetup();

            const mentionedUser = await pw.createNewUserProfile(adminClient);
            await adminClient.addToTeam(team.id, mentionedUser.id);

            const channel = await adminClient.createChannel(
                pw.random.channel({
                    teamId: team.id,
                    name: 'silent-mention',
                    displayName: 'Silent Mention Test',
                    unique: true,
                }),
            );
            await adminClient.addToChannel(user.id, channel.id);
            await adminClient.addToChannel(mentionedUser.id, channel.id);

            const webhook = await adminClient.createIncomingWebhook({
                channel_id: channel.id,
                display_name: 'Silent Mention Hook',
            });

            const {channelsPage: posterChannelsPage} = await pw.testBrowser.login(user);
            await posterChannelsPage.goto(team.name, channel.name);
            await posterChannelsPage.toBeVisible();
            await posterChannelsPage.goto(team.name, 'off-topic');
            await posterChannelsPage.toBeVisible();

            const {page: mentioneePage, channelsPage: mentioneeChannelsPage} =
                await pw.testBrowser.login(mentionedUser);
            await mentioneeChannelsPage.goto(team.name, 'off-topic');
            await mentioneeChannelsPage.toBeVisible();
            await pw.stubNotification(mentioneePage, 'granted');

            // # Baseline: normal @mention webhook should notify the mentioned user and mark channel unread
            const normalMessage = `normal mention @${mentionedUser.username} ${Date.now()}`;
            await postToWebhook(webhook.id, {text: normalMessage});
            await mentioneeChannelsPage.sidebarLeft.assertItemUnread(channel.name, pw.duration.half_min);
            await expect
                .poll(async () => (await mentioneePage.evaluate(() => window.getNotifications())).length)
                .toBeGreaterThan(0);

            // # Mark the channel read by opening it, then return to off-topic for a clean baseline
            await mentioneeChannelsPage.sidebarLeft.goToItem(channel.name);
            await mentioneeChannelsPage.toBeVisible();
            await mentioneeChannelsPage.goto(team.name, 'off-topic');
            await mentioneeChannelsPage.toBeVisible();
            await mentioneeChannelsPage.sidebarLeft.assertItemRead(channel.name);

            await pw.clearCapturedNotifications(mentioneePage);

            // # Silent @mention should not notify the mentioned user nor mark the channel unread
            const silentMessage = `silent mention @${mentionedUser.username} ${Date.now()}`;
            await postToWebhook(webhook.id, {text: silentMessage, silent: true});

            await expect
                .poll(async () => channelHasMessage(await adminClient.getPosts(channel.id, 0, 30), silentMessage))
                .toBe(true);

            await expect
                .poll(async () => (await mentioneePage.evaluate(() => window.getNotifications())).length)
                .toBe(0);
            await mentioneeChannelsPage.sidebarLeft.assertItemRead(channel.name);

            const notificationsAfterSilent = await mentioneePage.evaluate(() => window.getNotifications());
            expect(notificationsAfterSilent.some((n) => notificationText(n).includes(silentMessage))).toBe(false);
        },
    );
});
