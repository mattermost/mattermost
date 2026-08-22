// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import type {Channel} from '@mattermost/types/channels';
import {CollapsedThreads} from '@mattermost/types/config';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile, UserNotifyProps} from '@mattermost/types/users';

import {
    duration,
    expect,
    test,
    type ChannelsPage,
    type PlaywrightClient4,
    type PlaywrightExtended,
} from '@mattermost/playwright-lib';

test.describe('Reply notifications', () => {
    let adminClient: PlaywrightClient4;
    let team: Team;
    let channel: Channel;
    let receiver: UserProfile;
    let sender: UserProfile;
    let receiverPage: Page;
    let channelsPage: ChannelsPage;
    let playwright: PlaywrightExtended;

    test.beforeEach(async ({pw}, testInfo) => {
        const comments: UserNotifyProps['comments'] = testInfo.title.includes('MM-T552') ? 'root' : 'any';

        // # Create a receiver, sender, and dedicated channel for the reply-notification scenario
        const setup = await pw.initSetup();
        playwright = pw;
        adminClient = setup.adminClient;
        team = setup.team;
        receiver = setup.user;

        // # Disable collapsed threads and wait for the notification pipeline to apply the config change
        await adminClient.patchConfig({ServiceSettings: {CollapsedThreads: CollapsedThreads.DISABLED}});
        [sender] = await adminClient.createUsers(team.id, 1, 'reply-notification-sender');
        channel = await adminClient.createPublicChannel(team.id, 'Reply Notifications');
        await adminClient.addToChannel(receiver.id, channel.id);
        await adminClient.addToChannel(sender.id, channel.id);

        // # Set the receiver's reply-notification preference through notify_props
        await adminClient.patchUser({
            id: receiver.id,
            notify_props: {...receiver.notify_props, comments},
        });

        // # Log in as the receiver, open the test channel, and capture desktop notifications
        const browserSession = await pw.testBrowser.login(receiver);
        receiverPage = browserSession.page;
        channelsPage = browserSession.channelsPage;
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();
        await pw.stubNotification(receiverPage, 'granted');
    });

    async function goToTownSquare() {
        const channelViewResponse = receiverPage.waitForResponse(
            (response) =>
                response.url().endsWith('/api/v4/channels/members/me/view') &&
                response.request().method() === 'POST' &&
                response.ok(),
        );
        await channelsPage.sidebarLeft.goToItem('Town Square');
        await channelViewResponse;
    }

    async function verifyStartedThreadNotification(message: string) {
        // # Start a thread as the receiver
        const rootPostResponse = receiverPage.waitForResponse(
            (response) =>
                response.url().endsWith('/api/v4/posts') &&
                response.request().method() === 'POST' &&
                response.status() === 201,
        );
        await channelsPage.postMessage('Hi there, this is another root message');
        const rootPost = (await (await rootPostResponse).json()) as {id: string};

        // # Move to Town Square and post a reply as the sender
        await goToTownSquare();
        await adminClient.createPost({
            channel_id: channel.id,
            user_id: sender.id,
            root_id: rootPost.id,
            message,
        });

        // * Verify the reply triggers a desktop notification and unread-mention badge
        const notifications = await playwright.waitForNotification(receiverPage, 1, duration.ten_sec);
        expect(notifications.length).toBeGreaterThanOrEqual(1);
        await expect(channelsPage.sidebarLeft.unreadMentionsBadge(channel.name)).toBeVisible();

        // # Return to the test channel
        await channelsPage.sidebarLeft.goToItem(channel.name);

        // * Verify the exact reply text and reply-notification highlight
        const replyPost = await channelsPage.getLastPost();
        await replyPost.toBeReplyNotification(message);
    }

    /**
     * @objective Verify replies trigger notifications for the user who started the thread when reply notifications are set to threads they start.
     */
    test('MM-T552 Trigger notifications on messages in threads that I start', {tag: '@notifications'}, async () => {
        // # Start a thread and receive a reply while viewing another channel
        await verifyStartedThreadNotification('This is a reply to the root post');

        // * Verify the reply produces all expected notification indicators
    });

    /**
     * @objective Verify replies trigger notifications for the user who started the thread when reply notifications are set to threads they start or participate in.
     */
    test(
        'MM-T553 Trigger notifications on messages in reply threads that I start or participate in - start thread',
        {tag: '@notifications'},
        async () => {
            // # Start a thread and receive a reply while viewing another channel
            await verifyStartedThreadNotification('This is a reply to the root post');

            // * Verify the reply produces all expected notification indicators
        },
    );

    /**
     * @objective Verify replies trigger notifications for a user who participated in a thread started by another user.
     */
    test(
        'MM-T554 Trigger notifications on messages in reply threads that I start or participate in - participate in',
        {tag: '@notifications'},
        async ({pw}) => {
            // # Start a thread as the sender
            const rootPost = await adminClient.createPost({
                channel_id: channel.id,
                user_id: sender.id,
                message: 'a root message by some other user',
            });

            // # Open the thread and post a reply as the receiver to participate in it
            const receiverRootPost = await channelsPage.centerView.getPostById(rootPost.id);
            await receiverRootPost.reply();
            await channelsPage.sidebarRight.toBeVisible();
            const receiverReplyResponse = receiverPage.waitForResponse(
                (response) =>
                    response.url().endsWith('/api/v4/posts') &&
                    response.request().method() === 'POST' &&
                    response.status() === 201,
            );
            await channelsPage.sidebarRight.postMessage('this is a reply from the receiver');
            await receiverReplyResponse;

            // * Verify the receiver's reply appears in the thread
            const receiverReply = await channelsPage.sidebarRight.getLastPost();
            await receiverReply.toContainText('this is a reply from the receiver');

            // # Move to Town Square, clear captured notifications, and post another reply as the sender
            await goToTownSquare();
            await pw.clearCapturedNotifications(receiverPage);
            const message = 'This is a reply by sender';
            const senderReply = await adminClient.createPost({
                channel_id: channel.id,
                user_id: sender.id,
                root_id: rootPost.id,
                message,
            });

            // * Verify the reply triggers a desktop notification and unread-mention badge
            const notifications = await pw.waitForNotification(receiverPage, 1, duration.ten_sec);
            expect(notifications.length).toBeGreaterThanOrEqual(1);
            await expect(channelsPage.sidebarLeft.unreadMentionsBadge(channel.name)).toBeVisible();

            // # Return to the test channel
            await channelsPage.sidebarLeft.goToItem(channel.name);

            // * Verify the exact reply text and reply-notification highlight in the thread
            const replyPost = await channelsPage.sidebarRight.getPostById(senderReply.id);
            await replyPost.toBeReplyNotification(message);
        },
    );
});
