// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, lastPost, test, testConfig, type App, duration} from '@mattermost/playwright-lib';

async function postToWebhook(webhookId: string, payload: Record<string, unknown>) {
    const hookUrl = `${testConfig.baseURL}/hooks/${webhookId}`;
    const resp = await fetch(hookUrl, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
    });

    if (!resp.ok) {
        throw new Error(`Webhook POST failed: ${resp.status} ${await resp.text()}`);
    }
}

function notificationText(n: {title?: string; body?: string}) {
    return `${n.title ?? ''}\n${n.body ?? ''}`;
}

/** Checks the center channel's most recent post contains `message`. */
async function expectLastPostContains(app: App, message: string) {
    const post = await lastPost(app.center.postList);
    await expect(post.locator).toContainText(message);
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
        async ({pw, headless, browserName}) => {
            test.skip(
                headless && browserName !== 'firefox' && browserName !== 'webkit',
                'In headless mode, Notification stubbing is only reliable in Firefox (and WebKit when configured). Use npm run playwright-ui (headed), --project=firefox, or PW_HEADLESS=false.',
            );

            const {team, user, adminClient, offTopic} = await pw.initSetup();

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

            const {app, page} = await pw.testBrowser.login(user);

            // # Mark the webhook channel as read, then view another channel
            await app.channelsPage.goto({team, channel: channel.name});
            await app.channelsPage.goto({team, channel: offTopic});

            await pw.stubNotification(page, 'granted');

            const channelLink = app.lhs.channelList.channel(channel).container.locator;

            // # Post a normal webhook message with @mention to verify unread + notification baseline
            const normalMessage = `normal webhook @${user.username} ${Date.now()}`;
            await postToWebhook(webhook.id, {text: normalMessage});
            await expect(channelLink).toHaveClass(/unread-title/, {timeout: duration.half_min});
            await expect
                .poll(async () => (await page.evaluate(() => window.getNotifications())).length)
                .toBeGreaterThan(0);

            await app.lhs.channelList.channel(channel).container.click();

            await expect(app.channelHeader.openMenuButton).toContainText(channel.display_name);
            await expectLastPostContains(app, normalMessage);

            await app.channelsPage.goto({team, channel: offTopic});
            await expect(channelLink).not.toHaveClass(/unread-title/);

            const syncChannel = await adminClient.createChannel(
                pw.random.channel({
                    teamId: team.id,
                    name: 'sync-pulse',
                    displayName: 'Sync Pulse',
                    unique: true,
                }),
            );
            await adminClient.addToChannel(user.id, syncChannel.id);
            const syncChannelLink = app.lhs.channelList.channel(syncChannel).container.locator;

            await pw.clearCapturedNotifications(page);

            // # Post silent webhook, then a normal post on another channel to flush the WS pipeline (FIFO)
            const silentMessage = `silent webhook @${user.username} ${Date.now()}`;
            await postToWebhook(webhook.id, {text: silentMessage, silent: true});

            await expect
                .poll(async () => channelHasMessage(await adminClient.getPosts(channel.id, 0, 30), silentMessage))
                .toBe(true);

            const pulseMessage = `pulse ${Date.now()}`;
            await adminClient.createPost({channel_id: syncChannel.id, message: pulseMessage});

            await expect(syncChannelLink).toHaveClass(/unread-title/, {timeout: duration.half_min});
            await expect(channelLink).not.toHaveClass(/unread-title/);

            const notificationsAfterSilent = await page.evaluate(() => window.getNotifications());
            expect(notificationsAfterSilent.some((n) => notificationText(n).includes(silentMessage))).toBe(false);

            // * Silent post is still visible; no New Messages separator (final assertions — goToItem marks viewed)
            await app.lhs.channelList.channel(channel).container.click();
            await expect(app.channelHeader.openMenuButton).toContainText(channel.display_name);
            await expectLastPostContains(app, silentMessage);
            await expect(app.center.postList.newMessages).not.toBeVisible();
        },
    );

    /**
     * @objective Verify a user @mentioned in a silent webhook post does not receive a desktop notification.
     */
    test(
        'silent webhook @mention does not desktop-notify the mentioned user',
        {tag: ['@notifications']},
        async ({pw, headless, browserName}) => {
            test.skip(
                headless && browserName !== 'firefox' && browserName !== 'webkit',
                'Desktop notification stubbing is only reliable in headless Firefox and WebKit.',
            );

            const {team, user, adminClient, offTopic} = await pw.initSetup();

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

            const {app: posterApp} = await pw.testBrowser.login(user);
            await posterApp.channelsPage.goto({team, channel: channel.name});
            await posterApp.channelsPage.goto({team, channel: offTopic});

            const {app: mentionee, page: mentioneePage} = await pw.testBrowser.login(mentionedUser);
            await mentionee.channelsPage.goto({team, channel: offTopic});
            await pw.stubNotification(mentioneePage, 'granted');

            const channelLink = mentionee.lhs.channelList.channel(channel).container.locator;

            // # Baseline: normal @mention webhook should notify the mentioned user and mark channel unread
            const normalMessage = `normal mention @${mentionedUser.username} ${Date.now()}`;
            await postToWebhook(webhook.id, {text: normalMessage});
            await expect(channelLink).toHaveClass(/unread-title/, {timeout: duration.half_min});
            await expect
                .poll(async () => (await mentioneePage.evaluate(() => window.getNotifications())).length)
                .toBeGreaterThan(0);

            // # Mark the channel read by opening it, then return to off-topic for a clean baseline
            await mentionee.lhs.channelList.channel(channel).container.click();
            await expect(mentionee.channelHeader.openMenuButton).toContainText(channel.display_name);
            await expect(mentionee.center.composer).toBeVisible();
            await mentionee.channelsPage.goto({team, channel: offTopic});
            await expect(channelLink).not.toHaveClass(/unread-title/);

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
            await expect(channelLink).not.toHaveClass(/unread-title/);

            const notificationsAfterSilent = await mentioneePage.evaluate(() => window.getNotifications());
            expect(notificationsAfterSilent.some((n) => notificationText(n).includes(silentMessage))).toBe(false);
        },
    );
});
