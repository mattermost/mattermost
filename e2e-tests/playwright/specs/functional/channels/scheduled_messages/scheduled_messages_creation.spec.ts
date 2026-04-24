// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {verifyScheduledPost, verifyScheduledPostBadgeOnLeftSidebar, verifyScheduledPostIndicator} from './support';

test.beforeEach(async ({pw}) => {
    // Ensure license but skip test if no license which is required for "Scheduled Drafts"
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
});

/**
 * @objective Verify the ability to create a scheduled message from a channel.
 *
 * @precondition
 * A test server with valid license to support scheduled message features
 */
test.fixme(
    'MM-T5643_1 creates scheduled message from channel and posts at scheduled time',
    {tag: '@scheduled_messages'},
    async ({pw}) => {
        // Set test timeout to 4 mins to wait for the scheduled message to be sent
        // which is expected within 2 mins.
        test.setTimeout(pw.duration.four_min);

        const draftMessage = `Scheduled Draft ${pw.random.id()}`;

        // # Initialize test user, login and navigate to a channel
        const {user} = await pw.initSetup();
        const {page, channelsPage, scheduledPostsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        // # Create a scheduled message with short delay
        const {selectedDate, selectedTime} = await channelsPage.scheduleMessage(draftMessage, 0, 1);

        // * Verify scheduled post indicator shows correct date and time
        await verifyScheduledPostIndicator(channelsPage.centerView.scheduledPostIndicator, selectedDate, selectedTime);

        // * Verify scheduled post badge in left sidebar shows count of 1
        await verifyScheduledPostBadgeOnLeftSidebar(channelsPage, 1);

        // # Navigate to scheduled posts page via "See all" link
        await channelsPage.centerView.scheduledPostIndicator.seeAllLink.click();

        // * Verify scheduled post appears with correct information
        await verifyScheduledPost(scheduledPostsPage, {draftMessage, selectedDate, selectedTime, badgeCountOnTab: 1});

        // # Return to the channels page
        await page.goBack();

        // * Verify scheduled message was posted successfully
        await pw.waitUntil(
            async () => {
                const post = await channelsPage.getLastPost();
                const content = await post.container.textContent();

                return content?.includes(draftMessage);
            },
            {timeout: pw.duration.two_min},
        );

        // * Verify scheduled indicators are removed after posting
        await channelsPage.centerView.scheduledPostIndicator.toBeNotVisible();
        await expect(scheduledPostsPage.badge).not.toBeVisible();
        await expect(channelsPage.sidebarLeft.scheduledPostBadge).not.toBeVisible();
    },
);

/**
 * @objective Verify the ability to create a scheduled message in a thread.
 *
 * @precondition
 * A test server with valid license to support scheduled message features
 */
test(
    'MM-T5643_6 creates scheduled message in thread and posts in thread conversation',
    {tag: '@scheduled_messages'},
    async ({pw}) => {
        const draftMessage = `Scheduled Threaded Message ${pw.random.id()}`;

        // # Initialize test user, login and navigate to a channel
        const {user} = await pw.initSetup();
        const {channelsPage, scheduledPostsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        // # Create a root message in the channel
        await channelsPage.postMessage('Root Message');

        // # Start a thread by replying to the message
        const {sidebarRight} = await channelsPage.replyToLastPost('Replying to a thread');

        // # Create a scheduled message within the thread
        const {selectedDate, selectedTime} = await channelsPage.scheduleMessageFromThread(draftMessage, 1);

        // * Verify scheduled post indicator shows correct date and time
        await verifyScheduledPostIndicator(sidebarRight.scheduledPostIndicator, selectedDate, selectedTime);

        // # Navigate to scheduled posts page using indicator link
        await sidebarRight.scheduledPostIndicator.seeAllLink.click();

        // * Verify scheduled post appears with correct information
        const scheduledPost = await verifyScheduledPost(scheduledPostsPage, {
            draftMessage,
            selectedDate,
            selectedTime,
            badgeCountOnTab: 1,
        });

        // # Send the scheduled message immediately
        await scheduledPost.hover();
        await scheduledPost.sendNowButton.click();
        await scheduledPostsPage.sendMessageNowModal.toBeVisible();
        await scheduledPostsPage.sendMessageNowModal.sendNowButton.click();

        // * Verify message is posted in the thread
        await sidebarRight.toBeVisible();
        const lastPost = await sidebarRight.getLastPost();
        await expect(lastPost.body).toContainText(draftMessage);

        // * Verify all scheduled message indicators are removed
        await sidebarRight.scheduledPostIndicator.toBeNotVisible();
        await expect(scheduledPostsPage.noScheduledDrafts).toBeVisible();
        await expect(scheduledPostsPage.badge).not.toBeVisible();
        await expect(channelsPage.sidebarLeft.scheduledPostBadge).not.toBeVisible();
    },
);

/**
 * @objective Verify the ability to create a scheduled message from a direct message (DM).
 *
 * @precondition
 * A test server with valid license to support scheduled message features
 */
test(
    'MM-T5643_3 creates scheduled message from DM channel and posts at scheduled time',
    {tag: '@scheduled_messages'},
    async ({pw}) => {
        const draftMessage = `Scheduled Draft ${pw.random.id()}`;

        // # Initialize test setup with main user and create a second user
        const {user, team, adminClient} = await pw.initSetup();
        const otherUser = await adminClient.createUser(await pw.random.user(), '', '');

        // # Login as first user and navigate to DM channel with second user
        const {channelsPage, scheduledPostsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, `@${otherUser.username}`);
        await channelsPage.toBeVisible();

        // # Create a scheduled message for tomorrow in the DM
        const {selectedDate, selectedTime} = await channelsPage.scheduleMessage(draftMessage, 1);

        // * Verify appropriate scheduled message indicator appears
        await channelsPage.centerView.scheduledPostIndicator.toBeVisible();
        if (pw.isOutsideRemoteUserHour(otherUser.timezone)) {
            // Special case for timezone - expect generic message
            await expect(channelsPage.centerView.scheduledPostIndicator.messageText).toContainText(
                'You have one scheduled message.',
            );
        } else {
            // Normal case - verify the scheduled indicator
            await verifyScheduledPostIndicator(
                channelsPage.centerView.scheduledPostIndicator,
                selectedDate,
                selectedTime,
            );
        }

        // # Navigate to scheduled posts page using appropriate link
        if (pw.isOutsideRemoteUserHour(otherUser.timezone)) {
            await channelsPage.centerView.scheduledPostIndicator.scheduledMessageLink.click();
        } else {
            await channelsPage.centerView.scheduledPostIndicator.seeAllLink.click();
        }

        // * Verify scheduled post appears with correct information
        const scheduledPost = await verifyScheduledPost(scheduledPostsPage, {
            draftMessage,
            selectedDate,
            selectedTime,
            badgeCountOnTab: 1,
        });

        // # Send the scheduled message immediately instead of waiting
        await scheduledPost.hover();
        await scheduledPost.sendNowButton.click();
        await scheduledPostsPage.sendMessageNowModal.toBeVisible();
        await scheduledPostsPage.sendMessageNowModal.sendNowButton.click();

        // * Verify page redirects to the DM channel
        await expect(channelsPage.page).toHaveURL(`/${team.name}/messages/@${otherUser.username}`);

        // * Verify scheduled indicators are removed
        await channelsPage.centerView.scheduledPostIndicator.toBeNotVisible();
        await expect(channelsPage.sidebarLeft.scheduledPostBadge).not.toBeVisible();

        // * Verify message was posted in the DM channel
        const lastPost = await channelsPage.getLastPost();
        await expect(lastPost.body).toContainText(draftMessage);
    },
);
