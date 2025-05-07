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
test('MM-T5643_1 should create a scheduled message from a channel', {tag: '@scheduled_messages'}, async ({pw}) => {
    // Set test timeout to 4 mins to wait for the scheduled message to be sent
    // which is expected within 2 mins.
    test.setTimeout(pw.duration.four_min);

    const draftMessage = `Scheduled Draft ${pw.random.id()}`;

    // 1. Setup test user, login and navigate to a channel
    const {user} = await pw.initSetup();
    const {page, channelsPage, scheduledPostsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // 2. Create a scheduled message
    const {selectedDate, selectedTime} = await channelsPage.scheduleMessage(draftMessage, 0, 1);

    // * Verify scheduled post indicator with correct date/time
    const indicatorMessage = `Message scheduled for ${selectedDate} at ${selectedTime}.`;
    await verifyScheduledPostIndicator(channelsPage.centerView.scheduledPostIndicator, indicatorMessage);

    // * Verify scheduled post badge in left sidebar shows correct count
    await verifyScheduledPostBadgeOnLeftSidebar(channelsPage, 1);

    // 3. Click "See all link" to navigate to scheduled posts page
    await channelsPage.centerView.scheduledPostIndicator.seeAllLink.click();

    // * Verify scheduled posts page displays correct information
    const sendOnMessage = `Send ${selectedDate} at ${selectedTime}`;
    await verifyScheduledPost(scheduledPostsPage, {draftMessage, sendOnMessage, badgeCountOnTab: 1});

    // 4. Go back to the channels page
    await page.goBack();

    // * Verify the message has been posted and there's no more scheduled messages
    await pw.waitUntil(
        async () => {
            const post = await channelsPage.getLastPost();
            const content = await post.container.textContent();

            return content?.includes(draftMessage);
        },
        {timeout: pw.duration.two_min},
    );
    await channelsPage.centerView.scheduledPostIndicator.toBeNotVisible();
    await expect(scheduledPostsPage.badge).not.toBeVisible();
    await expect(channelsPage.sidebarLeft.scheduledPostBadge).not.toBeVisible();
});

/**
 * @objective Verify the ability to create a scheduled message in a thread.
 *
 * @precondition
 * A test server with valid license to support scheduled message features
 */
test('MM-T5643_6 should create a scheduled message under a thread post', {tag: '@scheduled_messages'}, async ({pw}) => {
    const draftMessage = `Scheduled Threaded Message ${pw.random.id()}`;

    // 1. Setup test user, login and navigate to a channel
    const {user} = await pw.initSetup();
    const {channelsPage, scheduledPostsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // 2. Post a message
    await channelsPage.postMessage('Root Message');

    // 3. Reply to a message
    const {sidebarRight} = await channelsPage.replyToLastPost('Replying to a thread');

    // 4. Create a scheduled message from the thread
    const {selectedDate, selectedTime} = await channelsPage.scheduleMessageFromThread(draftMessage, 1);

    // * Verify scheduled post indicator with correct date/time
    const indicatorMessage = `Message scheduled for ${selectedDate} at ${selectedTime}.`;
    await verifyScheduledPostIndicator(sidebarRight.scheduledPostIndicator, indicatorMessage);

    // 5. Navigate to scheduled posts page
    await sidebarRight.scheduledPostIndicator.seeAllLink.click();

    // * Verify scheduled posts page displays correct information
    const sendOnMessage = `Send on ${selectedDate} at ${selectedTime}`;
    const scheduledPost = await verifyScheduledPost(scheduledPostsPage, {
        draftMessage,
        sendOnMessage,
        badgeCountOnTab: 1,
    });

    // 6. Hover over the scheduled post and send now
    await scheduledPost.hover();
    await scheduledPost.sendNowButton.click();
    await scheduledPostsPage.sendMessageNowModal.toBeVisible();
    await scheduledPostsPage.sendMessageNowModal.sendNowButton.click();

    // * Verify the message has been posted and there's no more scheduled messages
    await sidebarRight.toBeVisible();
    const lastPost = await sidebarRight.getLastPost();
    await expect(lastPost.body).toContainText(draftMessage);
    await sidebarRight.scheduledPostIndicator.toBeNotVisible();
    await expect(scheduledPostsPage.noScheduledDrafts).toBeVisible();
    await expect(scheduledPostsPage.badge).not.toBeVisible();
    await expect(channelsPage.sidebarLeft.scheduledPostBadge).not.toBeVisible();
});

/**
 * @objective Verify the ability to reschedule a scheduled message.
 *
 * @precondition
 * A test server with valid license to support scheduled message features
 */
test('MM-T5644 should reschedule a scheduled message', {tag: '@scheduled_messages'}, async ({pw}) => {
    const draftMessage = `Scheduled Draft ${pw.random.id()}`;

    // 1. Setup test user, login and navigate to a channel
    const {user} = await pw.initSetup();
    const {channelsPage, scheduledPostsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // 2. Create a scheduled message with 1 day offset
    const {selectedDate, selectedTime} = await channelsPage.scheduleMessage(draftMessage, 1);

    // * Verify scheduled message indicator appears with correct date/time
    const indicatorMessage = `Message scheduled for ${selectedDate} at ${selectedTime}.`;
    await verifyScheduledPostIndicator(channelsPage.centerView.scheduledPostIndicator, indicatorMessage);

    // * Verify scheduled post badge in left sidebar shows correct count
    await verifyScheduledPostBadgeOnLeftSidebar(channelsPage, 1);

    // 3. Navigate to scheduled posts page
    await channelsPage.centerView.scheduledPostIndicator.seeAllLink.click();

    // * Verify scheduled posts page displays correct information
    const sendOnMessage = `Send on ${selectedDate} at ${selectedTime}`;
    const scheduledPost = await verifyScheduledPost(scheduledPostsPage, {
        draftMessage,
        sendOnMessage,
        badgeCountOnTab: 1,
    });

    // 4. Reschedule message to 2 days from today
    const {selectedDate: newSelectedDate, selectedTime: newSelectedTime} = await scheduledPostsPage.rescheduleMessage(
        scheduledPost,
        2,
    );

    // 5. Return to channel page
    await channelsPage.goto();

    // * Verify the message shows updated scheduled time
    const newIndicatorMessage = `Message scheduled for ${newSelectedDate} at ${newSelectedTime}.`;
    await verifyScheduledPostIndicator(channelsPage.centerView.scheduledPostIndicator, newIndicatorMessage);
});

/**
 * @objective Verify the ability to delete a scheduled message.
 *
 * @precondition
 * A test server with valid license to support scheduled message features
 */
test('MM-T5645 should delete a scheduled message', {tag: '@scheduled_messages'}, async ({pw}) => {
    const draftMessage = `Scheduled Draft ${pw.random.id()}`;

    // 1. Setup test user, login and navigate to a channel
    const {user} = await pw.initSetup();
    const {channelsPage, scheduledPostsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // 2. Create a scheduled message with 1 day offset
    const {selectedDate, selectedTime} = await channelsPage.scheduleMessage(draftMessage, 1);

    // * Verify scheduled message indicator appears with correct date/time
    const indicatorMessage = `Message scheduled for ${selectedDate} at ${selectedTime}.`;
    await verifyScheduledPostIndicator(channelsPage.centerView.scheduledPostIndicator, indicatorMessage);

    // 3. Navigate to scheduled posts page
    await channelsPage.centerView.scheduledPostIndicator.seeAllLink.click();

    // * Verify scheduled posts page displays correct information
    const sendOnMessage = `Send on ${selectedDate} at ${selectedTime}`;
    const scheduledPost = await verifyScheduledPost(scheduledPostsPage, {
        draftMessage,
        sendOnMessage,
        badgeCountOnTab: 1,
    });

    // 4. Delete the scheduled message
    await scheduledPost.hover();
    await scheduledPost.deleteButton.click();

    await scheduledPostsPage.deleteScheduledPostModal.toBeVisible();
    await scheduledPostsPage.deleteScheduledPostModal.deleteButton.click();

    // * Verify the scheduled message is removed from the scheduled posts page
    await expect(scheduledPostsPage.noScheduledDrafts).toBeVisible();
    await expect(scheduledPostsPage.badge).not.toBeVisible();
    await expect(channelsPage.sidebarLeft.scheduledPostBadge).not.toBeVisible();
});

/**
 * @objective Verify the ability to send a scheduled message immediately.
 *
 * @precondition
 * A test server with valid license to support scheduled message features
 */
test('MM-T5643_9 should send a scheduled message immediately', {tag: '@scheduled_messages'}, async ({pw}) => {
    const draftMessage = `Scheduled Draft ${pw.random.id()}`;

    // 1. Setup test user, login and navigate to a channel
    const {user, townSquareUrl} = await pw.initSetup();
    const {channelsPage, scheduledPostsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // 2. Create a scheduled message with 1 day offset
    const {selectedDate, selectedTime} = await channelsPage.scheduleMessage(draftMessage, 1);

    // * Verify scheduled message indicator appears with correct date/time
    const indicatorMessage = `Message scheduled for ${selectedDate} at ${selectedTime}.`;
    await verifyScheduledPostIndicator(channelsPage.centerView.scheduledPostIndicator, indicatorMessage);

    // 3. Navigate to scheduled posts page
    await channelsPage.centerView.scheduledPostIndicator.seeAllLink.click();

    // * Verify scheduled posts page displays correct information
    const sendOnMessage = `Send on ${selectedDate} at ${selectedTime}`;
    const scheduledPost = await verifyScheduledPost(scheduledPostsPage, {
        draftMessage,
        sendOnMessage,
        badgeCountOnTab: 1,
    });

    // 4. Send the scheduled message immediately
    await scheduledPost.hover();
    await scheduledPost.sendNowButton.click();
    await scheduledPostsPage.sendMessageNowModal.toBeVisible();
    await scheduledPostsPage.sendMessageNowModal.sendNowButton.click();

    // * Verify it redirects to the channels page, the message has been posted and there's no more scheduled messages
    await expect(channelsPage.page).toHaveURL(townSquareUrl);
    await channelsPage.centerView.scheduledPostIndicator.toBeNotVisible();
    await expect(channelsPage.sidebarLeft.scheduledPostBadge).not.toBeVisible();
    const lastPost = await channelsPage.getLastPost();
    await expect(lastPost.body).toContainText(draftMessage);
});

/**
 * @objective Verify the ability to create a scheduled message from a direct message (DM).
 *
 * @precondition
 * A test server with valid license to support scheduled message features
 */
test('MM-T5643_3 should create a scheduled message from a DM', {tag: '@scheduled_messages'}, async ({pw}) => {
    const draftMessage = `Scheduled Draft ${pw.random.id()}`;

    // 1. Setup test user and another user
    const {user, team, adminClient} = await pw.initSetup();
    const otherUser = await adminClient.createUser(pw.random.user(), '', '');

    // 2. Login the first user and navigate to a DM channel with the other user
    const {channelsPage, scheduledPostsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, `@${otherUser.username}`);
    await channelsPage.toBeVisible();

    // 3. Create a scheduled message with 1 day offset
    const {selectedDate, selectedTime} = await channelsPage.scheduleMessage(draftMessage, 1);

    // * Verify scheduled message indicator appears with correct date/time
    let indicatorMessage;
    if (pw.isOutsideRemoteUserHour(otherUser.timezone)) {
        indicatorMessage = 'You have one scheduled message.';
    } else {
        indicatorMessage = `Message scheduled for ${selectedDate} at ${selectedTime}.`;
    }
    await channelsPage.centerView.scheduledPostIndicator.toBeVisible();
    await expect(channelsPage.centerView.scheduledPostIndicator.messageText).toContainText(indicatorMessage);

    // 4. Navigate to scheduled posts page
    if (pw.isOutsideRemoteUserHour(otherUser.timezone)) {
        await channelsPage.centerView.scheduledPostIndicator.scheduledMessageLink.click();
    } else {
        await channelsPage.centerView.scheduledPostIndicator.seeAllLink.click();
    }

    // * Verify scheduled posts page displays correct information
    const sendOnMessage = `Send on ${selectedDate} at ${selectedTime}`;
    const scheduledPost = await verifyScheduledPost(scheduledPostsPage, {
        draftMessage,
        sendOnMessage,
        badgeCountOnTab: 1,
    });

    // 5. Send the scheduled message immediately
    await scheduledPost.hover();
    await scheduledPost.sendNowButton.click();
    await scheduledPostsPage.sendMessageNowModal.toBeVisible();
    await scheduledPostsPage.sendMessageNowModal.sendNowButton.click();

    // * Verify it redirects to the DM channel, message is posted and there's no more scheduled messages
    await expect(channelsPage.page).toHaveURL(`/${team.name}/messages/@${otherUser.username}`);
    await channelsPage.centerView.scheduledPostIndicator.toBeNotVisible();
    await expect(channelsPage.sidebarLeft.scheduledPostBadge).not.toBeVisible();
    const lastPost = await channelsPage.getLastPost();
    await expect(lastPost.body).toContainText(draftMessage);
});

/**
 * @objective Verify the ability to convert a draft message to a scheduled message.
 *
 * @precondition
 * A test server with valid license to support scheduled message features
 */
test('MM-T5648 should create a draft and then schedule it', {tag: '@scheduled_messages'}, async ({pw}) => {
    const draftMessage = `Scheduled Draft ${pw.random.id()}`;

    // 1. Setup test user, login and navigate to a channel
    const {user, team} = await pw.initSetup();
    const {channelsPage, draftsPage, scheduledPostsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // 2. Create a draft message
    await channelsPage.centerView.postCreate.input.fill(draftMessage);

    // 3. Go to drafts page
    await draftsPage.goto(team.name);
    await draftsPage.toBeVisible();
    expect(await draftsPage.getBadgeCountOnTab()).toBe('1');

    // * Verify draft message exists
    const draftedPost = await draftsPage.getLastPost();
    await expect(draftedPost.panelBody).toContainText(draftMessage);

    // 4. Open schedule modal from draft and schedule it to the next 2 days
    await draftedPost.hover();
    await draftedPost.scheduleButton.click();
    await draftsPage.scheduleMessageModal.toBeVisible();
    const {selectedDate, selectedTime} = await draftsPage.scheduleMessageModal.scheduleMessage(2);

    // 5. Navigate to scheduled posts page
    await scheduledPostsPage.goto(team.name);

    // * Verify scheduled posts page displays correct information
    const sendOnMessage = `Send on ${selectedDate} at ${selectedTime}`;
    await verifyScheduledPost(scheduledPostsPage, {draftMessage, sendOnMessage, badgeCountOnTab: 1});
});

/**
 * @objective Verify the ability to edit a scheduled message before it's sent.
 *
 * @precondition
 * A test server with valid license to support scheduled message features
 */
test('MM-T5644 should edit scheduled message', {tag: '@scheduled_messages'}, async ({pw}) => {
    const draftMessage = `Scheduled Draft ${pw.random.id()}`;

    // 1. Setup test user, login and navigate to a channel
    const {user, townSquareUrl} = await pw.initSetup();
    const {channelsPage, scheduledPostsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // 2. Create a scheduled message with 2 days offset
    const {selectedDate, selectedTime} = await channelsPage.scheduleMessage(draftMessage, 2);

    // * Verify scheduled message indicator appears with correct date/time
    const indicatorMessage = `Message scheduled for ${selectedDate} at ${selectedTime}.`;
    await verifyScheduledPostIndicator(channelsPage.centerView.scheduledPostIndicator, indicatorMessage);

    // * Verify scheduled post badge in left sidebar shows correct count
    await verifyScheduledPostBadgeOnLeftSidebar(channelsPage, 1);

    // 3. Navigate to scheduled posts page
    await channelsPage.centerView.scheduledPostIndicator.seeAllLink.click();

    // * Verify scheduled posts page displays correct information
    const sendOnMessage = `Send on ${selectedDate} at ${selectedTime}`;
    const scheduledPost = await verifyScheduledPost(scheduledPostsPage, {
        draftMessage,
        sendOnMessage,
        badgeCountOnTab: 1,
    });

    // 4. Hover and click edit button
    await scheduledPost.hover();
    await scheduledPost.editButton.click();

    // 5. Edit the scheduled message
    const updatedText = 'updated text';
    await scheduledPost.editTextBox.fill(updatedText);
    await scheduledPost.saveButton.click();

    // 6. Verify the edited message appears in the channel
    await expect(scheduledPost.panelBody).toContainText(updatedText);
    await expect(scheduledPost.panelHeader).toContainText(`Send on ${selectedDate} at ${selectedTime}`);

    // 7. Send the message immediately
    await scheduledPost.hover();
    await scheduledPost.sendNowButton.click();
    await scheduledPostsPage.sendMessageNowModal.toBeVisible();
    await scheduledPostsPage.sendMessageNowModal.sendNowButton.click();

    // * Verify it redirects to the channels page, the message has been posted and there's no more scheduled messages
    await expect(channelsPage.page).toHaveURL(townSquareUrl);
    await channelsPage.centerView.scheduledPostIndicator.toBeNotVisible();
    await expect(channelsPage.sidebarLeft.scheduledPostBadge).not.toBeVisible();
    const lastPost = await channelsPage.getLastPost();
    await expect(lastPost.body).toHaveText(updatedText);
});

/**
 * @objective Verify the ability to copy a scheduled message to clipboard.
 *
 * @precondition
 * A test server with valid license to support scheduled message features
 */
test('MM-T5650 should copy scheduled message', {tag: '@scheduled_messages'}, async ({pw, browserName}) => {
    // Skip this test in Firefox clipboard permissions are not supported
    test.skip(browserName === 'firefox', 'Test not supported in Firefox');

    const draftMessage = `Scheduled Draft ${pw.random.id()}`;

    // 1. Setup test user, login and navigate to a channel
    const {user} = await pw.initSetup();
    const {page, channelsPage, scheduledPostsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // 2. Create a scheduled message with 1 day offset
    const {selectedDate, selectedTime} = await channelsPage.scheduleMessage(draftMessage, 1);

    // * Verify scheduled post badge in left sidebar shows correct count
    await verifyScheduledPostBadgeOnLeftSidebar(channelsPage, 1);

    // 3. Navigate to scheduled posts page
    await channelsPage.centerView.scheduledPostIndicator.seeAllLink.click();

    // * Verify scheduled posts page displays correct information
    const sendOnMessage = `Send on ${selectedDate} at ${selectedTime}`;
    const scheduledPost = await verifyScheduledPost(scheduledPostsPage, {
        draftMessage,
        sendOnMessage,
        badgeCountOnTab: 1,
    });

    // 4. Copy the scheduled message
    await scheduledPost.hover();
    await scheduledPost.copyTextButton.click();

    // 5. Return to channel page
    await page.goBack();

    // 6. Paste the copied message in post creator
    await channelsPage.centerView.postCreate.input.focus();
    await page.keyboard.down('ControlOrMeta');
    await page.keyboard.press('V');
    await page.keyboard.up('ControlOrMeta');

    // * Verify the copied message is pasted in the post input box
    await expect(channelsPage.centerView.postCreate.input).toHaveText(draftMessage);
});

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
