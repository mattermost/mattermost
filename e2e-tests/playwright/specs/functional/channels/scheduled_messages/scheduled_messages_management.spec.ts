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
 * @objective Verify the ability to reschedule a scheduled message.
 *
 * @precondition
 * A test server with valid license to support scheduled message features
 */
test(
    'MM-T5644_2 reschedules message to a future date from scheduled posts page',
    {tag: '@scheduled_messages'},
    async ({pw}) => {
        const draftMessage = `Scheduled Draft ${pw.random.id()}`;

        // # Initialize test user, login and navigate to a channel
        const {user} = await pw.initSetup();
        const {channelsPage, scheduledPostsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        // # Create a scheduled message for tomorrow
        const {selectedDate, selectedTime} = await channelsPage.scheduleMessage(draftMessage, 1);

        // * Verify scheduled message indicator shows correct date and time
        await verifyScheduledPostIndicator(channelsPage.centerView.scheduledPostIndicator, selectedDate, selectedTime);

        // * Verify scheduled post badge appears with count of 1
        await verifyScheduledPostBadgeOnLeftSidebar(channelsPage, 1);

        // # Navigate to scheduled posts page via indicator link
        await channelsPage.centerView.scheduledPostIndicator.seeAllLink.click();

        // * Verify scheduled post appears with correct information
        const scheduledPost = await verifyScheduledPost(scheduledPostsPage, {
            draftMessage,
            selectedDate,
            selectedTime,
            badgeCountOnTab: 1,
        });

        // # Reschedule the message to a different date (2 days from now)
        const {selectedDate: newSelectedDate, selectedTime: newSelectedTime} =
            await scheduledPostsPage.rescheduleMessage(scheduledPost, 2);

        // # Return to channel page
        await channelsPage.goto();

        // * Verify indicator shows the updated scheduled time
        await verifyScheduledPostIndicator(
            channelsPage.centerView.scheduledPostIndicator,
            newSelectedDate,
            newSelectedTime,
        );
    },
);

/**
 * @objective Verify the ability to delete a scheduled message.
 *
 * @precondition
 * A test server with valid license to support scheduled message features
 */
test(
    'MM-T5645 deletes scheduled message from scheduled posts page and removes all indicators',
    {tag: '@scheduled_messages'},
    async ({pw}) => {
        const draftMessage = `Scheduled Draft ${pw.random.id()}`;

        // # Initialize test user, login and navigate to a channel
        const {user} = await pw.initSetup();
        const {channelsPage, scheduledPostsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        // # Create a scheduled message for tomorrow
        const {selectedDate, selectedTime} = await channelsPage.scheduleMessage(draftMessage, 1);

        // * Verify scheduled message indicator shows correct date and time
        await verifyScheduledPostIndicator(channelsPage.centerView.scheduledPostIndicator, selectedDate, selectedTime);

        // # Navigate to scheduled posts page via indicator link
        await channelsPage.centerView.scheduledPostIndicator.seeAllLink.click();

        // * Verify scheduled post appears with correct information
        const scheduledPost = await verifyScheduledPost(scheduledPostsPage, {
            draftMessage,
            selectedDate,
            selectedTime,
            badgeCountOnTab: 1,
        });

        // # Delete the scheduled message
        await scheduledPost.hover();
        await scheduledPost.deleteButton.click();

        // # Confirm deletion in the modal
        await scheduledPostsPage.deleteScheduledPostModal.toBeVisible();
        await scheduledPostsPage.deleteScheduledPostModal.deleteButton.click();

        // * Verify the scheduled message is removed and no longer appears
        await expect(scheduledPostsPage.noScheduledDrafts).toBeVisible();
        await expect(scheduledPostsPage.badge).not.toBeVisible();
        await expect(channelsPage.sidebarLeft.scheduledPostBadge).not.toBeVisible();
    },
);

/**
 * @objective Verify the ability to send a scheduled message immediately.
 *
 * @precondition
 * A test server with valid license to support scheduled message features
 */
test(
    'MM-T5643_9 sends scheduled message immediately from scheduled posts page',
    {tag: '@scheduled_messages'},
    async ({pw}) => {
        const draftMessage = `Scheduled Draft ${pw.random.id()}`;

        // # Initialize test user, login and navigate to a channel
        const {user, townSquareUrl} = await pw.initSetup();
        const {channelsPage, scheduledPostsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        // # Create a scheduled message for tomorrow
        const {selectedDate, selectedTime} = await channelsPage.scheduleMessage(draftMessage, 1);

        // * Verify scheduled message indicator shows correct date and time
        await verifyScheduledPostIndicator(channelsPage.centerView.scheduledPostIndicator, selectedDate, selectedTime);

        // # Navigate to scheduled posts page via indicator link
        await channelsPage.centerView.scheduledPostIndicator.seeAllLink.click();

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

        // * Verify page redirects to the channel
        await expect(channelsPage.page).toHaveURL(townSquareUrl);

        // * Verify scheduled indicators are removed
        await channelsPage.centerView.scheduledPostIndicator.toBeNotVisible();
        await expect(channelsPage.sidebarLeft.scheduledPostBadge).not.toBeVisible();

        // * Verify message was posted in the channel
        const lastPost = await channelsPage.getLastPost();
        await expect(lastPost.body).toContainText(draftMessage);
    },
);
