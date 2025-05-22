// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, ScheduledPostIndicator} from '@mattermost/playwright-lib';
import type {ChannelsPage, ScheduledPostsPage} from '@mattermost/playwright-lib';

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
test(
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
        const indicatorMessage = `Message scheduled for ${selectedDate} at ${selectedTime}.`;
        await verifyScheduledPostIndicator(channelsPage.centerView.scheduledPostIndicator, indicatorMessage);

        // * Verify scheduled post badge in left sidebar shows count of 1
        await verifyScheduledPostBadgeOnLeftSidebar(channelsPage, 1);

        // # Navigate to scheduled posts page via "See all" link
        await channelsPage.centerView.scheduledPostIndicator.seeAllLink.click();

        // * Verify scheduled post appears with correct information
        const sendOnMessage = `Send ${selectedDate} at ${selectedTime}`;
        await verifyScheduledPost(scheduledPostsPage, {draftMessage, sendOnMessage, badgeCountOnTab: 1});

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
        const indicatorMessage = `Message scheduled for ${selectedDate} at ${selectedTime}.`;
        await verifyScheduledPostIndicator(sidebarRight.scheduledPostIndicator, indicatorMessage);

        // # Navigate to scheduled posts page using indicator link
        await sidebarRight.scheduledPostIndicator.seeAllLink.click();

        // * Verify scheduled post appears with correct information
        const sendOnMessage = `Send on ${selectedDate} at ${selectedTime}`;
        const scheduledPost = await verifyScheduledPost(scheduledPostsPage, {
            draftMessage,
            sendOnMessage,
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
        const indicatorMessage = `Message scheduled for ${selectedDate} at ${selectedTime}.`;
        await verifyScheduledPostIndicator(channelsPage.centerView.scheduledPostIndicator, indicatorMessage);

        // * Verify scheduled post badge appears with count of 1
        await verifyScheduledPostBadgeOnLeftSidebar(channelsPage, 1);

        // # Navigate to scheduled posts page via indicator link
        await channelsPage.centerView.scheduledPostIndicator.seeAllLink.click();

        // * Verify scheduled post appears with correct information
        const sendOnMessage = `Send on ${selectedDate} at ${selectedTime}`;
        const scheduledPost = await verifyScheduledPost(scheduledPostsPage, {
            draftMessage,
            sendOnMessage,
            badgeCountOnTab: 1,
        });

        // # Reschedule the message to a different date (2 days from now)
        const {selectedDate: newSelectedDate, selectedTime: newSelectedTime} =
            await scheduledPostsPage.rescheduleMessage(scheduledPost, 2);

        // # Return to channel page
        await channelsPage.goto();

        // * Verify indicator shows the updated scheduled time
        const newIndicatorMessage = `Message scheduled for ${newSelectedDate} at ${newSelectedTime}.`;
        await verifyScheduledPostIndicator(channelsPage.centerView.scheduledPostIndicator, newIndicatorMessage);
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
        const indicatorMessage = `Message scheduled for ${selectedDate} at ${selectedTime}.`;
        await verifyScheduledPostIndicator(channelsPage.centerView.scheduledPostIndicator, indicatorMessage);

        // # Navigate to scheduled posts page via indicator link
        await channelsPage.centerView.scheduledPostIndicator.seeAllLink.click();

        // * Verify scheduled post appears with correct information
        const sendOnMessage = `Send on ${selectedDate} at ${selectedTime}`;
        const scheduledPost = await verifyScheduledPost(scheduledPostsPage, {
            draftMessage,
            sendOnMessage,
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
        const indicatorMessage = `Message scheduled for ${selectedDate} at ${selectedTime}.`;
        await verifyScheduledPostIndicator(channelsPage.centerView.scheduledPostIndicator, indicatorMessage);

        // # Navigate to scheduled posts page via indicator link
        await channelsPage.centerView.scheduledPostIndicator.seeAllLink.click();

        // * Verify scheduled post appears with correct information
        const sendOnMessage = `Send on ${selectedDate} at ${selectedTime}`;
        const scheduledPost = await verifyScheduledPost(scheduledPostsPage, {
            draftMessage,
            sendOnMessage,
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
        const otherUser = await adminClient.createUser(pw.random.user(), '', '');

        // # Login as first user and navigate to DM channel with second user
        const {channelsPage, scheduledPostsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, `@${otherUser.username}`);
        await channelsPage.toBeVisible();

        // # Create a scheduled message for tomorrow in the DM
        const {selectedDate, selectedTime} = await channelsPage.scheduleMessage(draftMessage, 1);

        // * Verify appropriate scheduled message indicator appears
        let indicatorMessage;
        if (pw.isOutsideRemoteUserHour(otherUser.timezone)) {
            indicatorMessage = 'You have one scheduled message.';
        } else {
            indicatorMessage = `Message scheduled for ${selectedDate} at ${selectedTime}.`;
        }
        await channelsPage.centerView.scheduledPostIndicator.toBeVisible();
        await expect(channelsPage.centerView.scheduledPostIndicator.messageText).toContainText(indicatorMessage);

        // # Navigate to scheduled posts page using appropriate link
        if (pw.isOutsideRemoteUserHour(otherUser.timezone)) {
            await channelsPage.centerView.scheduledPostIndicator.scheduledMessageLink.click();
        } else {
            await channelsPage.centerView.scheduledPostIndicator.seeAllLink.click();
        }

        // * Verify scheduled post appears with correct information
        const sendOnMessage = `Send on ${selectedDate} at ${selectedTime}`;
        const scheduledPost = await verifyScheduledPost(scheduledPostsPage, {
            draftMessage,
            sendOnMessage,
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

/**
 * @objective Verify the ability to convert a draft message to a scheduled message.
 *
 * @precondition
 * A test server with valid license to support scheduled message features
 */
test(
    'MM-T5648 converts draft message to scheduled message from drafts page',
    {tag: '@scheduled_messages'},
    async ({pw}) => {
        const draftMessage = `Scheduled Draft ${pw.random.id()}`;

        // # Initialize test user, login and navigate to a channel
        const {user, team} = await pw.initSetup();
        const {channelsPage, draftsPage, scheduledPostsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        // # Create a draft message without sending it
        await channelsPage.centerView.postCreate.input.fill(draftMessage);

        // # Navigate to the drafts page
        await draftsPage.goto(team.name);
        await draftsPage.toBeVisible();

        // * Verify draft count badge shows one draft
        expect(await draftsPage.getBadgeCountOnTab()).toBe('1');

        // * Verify draft message content appears correctly
        const draftedPost = await draftsPage.getLastPost();
        await expect(draftedPost.panelBody).toContainText(draftMessage);

        // # Schedule the draft for 2 days in the future
        await draftedPost.hover();
        await draftedPost.scheduleButton.click();
        await draftsPage.scheduleMessageModal.toBeVisible();
        const {selectedDate, selectedTime} = await draftsPage.scheduleMessageModal.scheduleMessage(2);

        // # Navigate to scheduled posts page
        await scheduledPostsPage.goto(team.name);

        // * Verify scheduled post appears with correct information
        const sendOnMessage = `Send on ${selectedDate} at ${selectedTime}`;
        await verifyScheduledPost(scheduledPostsPage, {draftMessage, sendOnMessage, badgeCountOnTab: 1});
    },
);

/**
 * @objective Verify the ability to edit a scheduled message before it's sent.
 *
 * @precondition
 * A test server with valid license to support scheduled message features
 */
test(
    'MM-T5644_1 edits scheduled message content while preserving scheduled time',
    {tag: '@scheduled_messages'},
    async ({pw}) => {
        const draftMessage = `Scheduled Draft ${pw.random.id()}`;

        // # Initialize test user, login and navigate to a channel
        const {user, townSquareUrl} = await pw.initSetup();
        const {channelsPage, scheduledPostsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        // # Create a scheduled message for 2 days in the future
        const {selectedDate, selectedTime} = await channelsPage.scheduleMessage(draftMessage, 2);

        // * Verify scheduled message indicator shows correct date and time
        const indicatorMessage = `Message scheduled for ${selectedDate} at ${selectedTime}.`;
        await verifyScheduledPostIndicator(channelsPage.centerView.scheduledPostIndicator, indicatorMessage);

        // * Verify scheduled post badge shows count of 1
        await verifyScheduledPostBadgeOnLeftSidebar(channelsPage, 1);

        // # Navigate to scheduled posts page via indicator link
        await channelsPage.centerView.scheduledPostIndicator.seeAllLink.click();

        // * Verify scheduled post appears with correct information
        const sendOnMessage = `Send on ${selectedDate} at ${selectedTime}`;
        const scheduledPost = await verifyScheduledPost(scheduledPostsPage, {
            draftMessage,
            sendOnMessage,
            badgeCountOnTab: 1,
        });

        // # Edit the scheduled message content
        await scheduledPost.hover();
        await scheduledPost.editButton.click();
        const updatedText = 'updated text';
        await scheduledPost.editTextBox.fill(updatedText);
        await scheduledPost.saveButton.click();

        // * Verify the edited message content is updated
        await expect(scheduledPost.panelBody).toContainText(updatedText);

        // * Verify scheduled date/time remains unchanged
        await expect(scheduledPost.panelHeader).toContainText(`Send on ${selectedDate} at ${selectedTime}`);

        // # Send the edited message immediately
        await scheduledPost.hover();
        await scheduledPost.sendNowButton.click();
        await scheduledPostsPage.sendMessageNowModal.toBeVisible();
        await scheduledPostsPage.sendMessageNowModal.sendNowButton.click();

        // * Verify page redirects to the channel
        await expect(channelsPage.page).toHaveURL(townSquareUrl);

        // * Verify scheduled indicators are removed
        await channelsPage.centerView.scheduledPostIndicator.toBeNotVisible();
        await expect(channelsPage.sidebarLeft.scheduledPostBadge).not.toBeVisible();

        // * Verify edited message was posted in the channel
        const lastPost = await channelsPage.getLastPost();
        await expect(lastPost.body).toHaveText(updatedText);
    },
);

/**
 * @objective Verify the ability to copy a scheduled message to clipboard.
 *
 * @precondition
 * A test server with valid license to support scheduled message features
 */
test(
    'MM-T5650 copies scheduled message text to clipboard for reuse',
    {tag: '@scheduled_messages'},
    async ({pw, browserName}) => {
        // # Skip this test in Firefox since clipboard permissions are not supported
        test.skip(browserName === 'firefox', 'Test not supported in Firefox');

        const draftMessage = `Scheduled Draft ${pw.random.id()}`;

        // # Initialize test user, login and navigate to a channel
        const {user} = await pw.initSetup();
        const {page, channelsPage, scheduledPostsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        // # Create a scheduled message for tomorrow
        const {selectedDate, selectedTime} = await channelsPage.scheduleMessage(draftMessage, 1);

        // * Verify scheduled post badge shows count of 1
        await verifyScheduledPostBadgeOnLeftSidebar(channelsPage, 1);

        // # Navigate to scheduled posts page via indicator link
        await channelsPage.centerView.scheduledPostIndicator.seeAllLink.click();

        // * Verify scheduled post appears with correct information
        const sendOnMessage = `Send on ${selectedDate} at ${selectedTime}`;
        const scheduledPost = await verifyScheduledPost(scheduledPostsPage, {
            draftMessage,
            sendOnMessage,
            badgeCountOnTab: 1,
        });

        // # Copy the scheduled message text to clipboard
        await scheduledPost.hover();
        await scheduledPost.copyTextButton.click();

        // # Return to the channel page
        await page.goBack();

        // # Paste the copied message into the post input box
        await channelsPage.centerView.postCreate.input.focus();
        await page.keyboard.down('ControlOrMeta');
        await page.keyboard.press('V');
        await page.keyboard.up('ControlOrMeta');

        // * Verify the clipboard content was pasted correctly
        await expect(channelsPage.centerView.postCreate.input).toHaveText(draftMessage);
    },
);

/**
 * Verifies that the scheduled post indicator is visible and displays the correct date and time.
 *
 * @param scheduledPostIndicator - The ScheduledPostIndicator instance
 * @param messageText - A post message
 */
async function verifyScheduledPostIndicator(scheduledPostIndicator: ScheduledPostIndicator, messageText: string) {
    await scheduledPostIndicator.toBeVisible();
    await expect(scheduledPostIndicator.icon).toBeVisible();
    await expect(scheduledPostIndicator.messageText).toContainText(messageText);
}

async function verifyScheduledPostBadgeOnLeftSidebar(channelsPage: ChannelsPage, count: number) {
    await channelsPage.sidebarLeft.scheduledPostBadge.isVisible();
    await expect(channelsPage.sidebarLeft.scheduledPostBadge).toHaveText(count.toString());
}

async function verifyScheduledPost(
    scheduledPostsPage: ScheduledPostsPage,
    {
        draftMessage,
        sendOnMessage,
        badgeCountOnTab,
    }: {draftMessage: string; sendOnMessage: string; badgeCountOnTab: number},
) {
    // * Verify scheduled posts page is visible
    await scheduledPostsPage.toBeVisible();

    // * Verify scheduled post badge on tab has correct count
    expect(await scheduledPostsPage.getBadgeCountOnTab()).toBe(badgeCountOnTab.toString());

    // * Verify scheduled post appears in scheduled posts page
    const scheduledPost = await scheduledPostsPage.getLastPost();
    await expect(scheduledPost.panelBody).toContainText(draftMessage);

    await expect(scheduledPost.panelHeader).toContainText(sendOnMessage);

    return scheduledPost;
}
