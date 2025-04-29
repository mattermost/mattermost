// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';
import type {ChannelsPage} from '@mattermost/playwright-lib';

/**
 * Setup for all tests.
 * Ensures that a valid license is available before running any tests.
 * Skips tests if no license is available or if the required feature is not enabled.
 */
test.beforeEach(async ({pw}) => {
    // Ensure license but skip test if no license which is required for "Scheduled Drafts"
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
});

/**
 * Verify the ability to create a scheduled message from a channel.
 *
 * Precondition:
 * 1. A test server with valid license to support scheduled message features
 * 2. User has permissions to create and manage scheduled messages
 *
 * Steps:
 * 1. Login as a user
 * 2. Navigate to a channel
 * 3. Create a scheduled message
 * 4. Verify scheduled post indicator with correct date/time
 * 5. Wait for scheduled message to be sent
 * 6. Verify message appears in channel
 *
 * Expected:
 * - User can successfully schedule a message from a channel
 * - Scheduled post indicator shows correct date and time
 * - Message is sent at the scheduled time
 * - Scheduled message indicators disappear after message is sent
 */
test('MM-T5643_1 should create a scheduled message from a channel', async ({pw}) => {
    const draftMessage = `Scheduled Draft ${pw.random.id()}`;

    const {user} = await pw.initSetup();
    const {page, channelsPage, scheduledPostsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    const {selectedDate, selectedTime} = await channelsPage.scheduleMessage(draftMessage, 0, 1);

    await verifyScheduledPostIndicator(channelsPage, selectedDate, selectedTime);

    // Verify scheduled post badge in left sidebar shows correct count
    await channelsPage.sidebarLeft.scheduledPostBadge.isVisible();
    await expect(channelsPage.sidebarLeft.scheduledPostBadge).toHaveText('1');

    // Navigate to scheduled posts page
    await channelsPage.centerView.scheduledPostIndicator.seeAllLink.click();

    // Verify scheduled posts page displays correct information
    await scheduledPostsPage.toBeVisible();
    expect(await scheduledPostsPage.getBadgeCountOnTab()).toBe('1');

    // Verify scheduled post appears in scheduled posts page
    const scheduledPost = await scheduledPostsPage.getLastPost();
    await expect(scheduledPost.panelBody).toContainText(draftMessage);
    await expect(scheduledPost.panelHeader).toContainText(`Send ${selectedDate} at ${selectedTime}`);

    // # Hover and verify options
    await scheduledPost.hover();
    await expect(scheduledPost.deleteButton).toBeVisible();
    await expect(scheduledPost.editButton).toBeVisible();
    await expect(scheduledPost.copyTextButton).toBeVisible();
    await expect(scheduledPost.rescheduleButton).toBeVisible();
    await expect(scheduledPost.sendNowButton).toBeVisible();

    // # Go back and wait for message to arrive
    await page.goBack();

    // * Verify the message has been sent and there's no more scheduled messages
    await pw.waitUntil(
        async () => {
            const post = await channelsPage.getLastPost();
            const content = await post.container.textContent();

            return content?.includes(draftMessage);
        },
        {timeout: pw.duration.two_min},
    );
    await expect(channelsPage.centerView.scheduledPostIndicator.container).not.toBeVisible();
    await expect(channelsPage.sidebarLeft.scheduledPostBadge).not.toBeVisible();
});

/**
 * Verify the ability to create a scheduled message in a thread.
 *
 * Precondition:
 * 1. A test server with valid license to support scheduled message features
 * 2. User has permissions to create and manage scheduled messages
 *
 * Steps:
 * 1. Login as a user
 * 2. Navigate to a channel
 * 3. Create a root post and start a thread
 * 4. Create a scheduled message within the thread
 * 5. Verify scheduled message indicators in the thread
 * 6. Send the scheduled message immediately
 * 7. Verify message appears in the thread
 *
 * Expected:
 * - User can successfully schedule a message in a thread
 * - Scheduled message indicators show correct information
 * - Message appears in the thread when sent
 * - Scheduled message indicators disappear after sending
 */
test('MM-T5643_6 should create a scheduled message under a thread post ', async ({pw}) => {
    const draftMessage = `Scheduled Threaded Message ${pw.random.id()}`;

    const {user} = await pw.initSetup();

    // # Log in as a user in new browser context
    const {channelsPage, scheduledPostsPage} = await pw.testBrowser.login(user);

    // # Visit default channel page
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    await channelsPage.postMessage('Root Message');

    // # Start a thread by clicking on reply menuitem from post options menu
    const lastPost = await channelsPage.getLastPost();
    await lastPost.openRhs();

    const sidebarRight = channelsPage.sidebarRight;
    await sidebarRight.toBeVisible();

    // # Post a message in the thread
    await sidebarRight.postMessage('Replying to a thread');

    // # Write a message in the reply thread but don't send it
    await sidebarRight.postCreate.writeMessage(draftMessage);
    await expect(sidebarRight.postCreate.input).toHaveText(draftMessage);

    await expect(sidebarRight.postCreate.scheduleMessageButton).toBeVisible();
    await sidebarRight.postCreate.scheduleMessageButton.click();

    await channelsPage.scheduleMessageMenu.toBeVisible();
    await channelsPage.scheduleMessageMenu.selectCustomTime();

    const {selectedDate, selectedTime} = await channelsPage.scheduleMessageModal.scheduleMessage(1);

    await sidebarRight.scheduledPostIndicator.toBeVisible();
    await expect(sidebarRight.scheduledPostIndicator.icon).toBeVisible();
    await expect(sidebarRight.scheduledPostIndicator.messageText).toContainText(
        `Message scheduled for ${selectedDate} at ${selectedTime}.`,
    );

    // Navigate to scheduled posts page
    await sidebarRight.scheduledPostIndicator.seeAllLink.click();

    // Verify scheduled posts page displays correct information
    await scheduledPostsPage.toBeVisible();
    expect(await scheduledPostsPage.getBadgeCountOnTab()).toBe('1');
    const scheduledPost = await scheduledPostsPage.getLastPost();
    await expect(scheduledPost.panelBody).toContainText(draftMessage);
    await expect(scheduledPost.panelHeader).toContainText(`Send on ${selectedDate} at ${selectedTime}`);

    // # Hover and verify options
    await scheduledPost.hover();
    await expect(scheduledPost.deleteButton).toBeVisible();
    await expect(scheduledPost.editButton).toBeVisible();
    await expect(scheduledPost.copyTextButton).toBeVisible();
    await expect(scheduledPost.rescheduleButton).toBeVisible();
    await expect(scheduledPost.sendNowButton).toBeVisible();

    await scheduledPost.sendNowButton.click();

    await scheduledPostsPage.sendMessageNowModal.toBeVisible();
    await scheduledPostsPage.sendMessageNowModal.sendNowButton.click();

    await sidebarRight.toBeVisible();
    (await sidebarRight.getLastPost()).toContainText(draftMessage);

    await expect(sidebarRight.scheduledPostIndicator.container).not.toBeVisible();
    await expect(channelsPage.sidebarLeft.scheduledPostBadge).not.toBeVisible();
});

/**
 * Verify the ability to reschedule a scheduled message.
 *
 * Precondition:
 * 1. A test server with valid license to support scheduled message features
 * 2. User has permissions to create and manage scheduled messages
 *
 * Steps:
 * 1. Login as a user
 * 2. Navigate to a channel
 * 3. Create a scheduled message
 * 4. Go to scheduled posts page
 * 5. Reschedule the message to a new date/time
 * 6. Verify the message shows updated scheduled time in channel
 *
 * Expected:
 * - User can successfully reschedule a message
 * - Badge count in left sidebar remains accurate
 * - New scheduled time is displayed correctly in channel
 */
test('MM-T5644 should reschedule a scheduled message', async ({pw}) => {
    const draftMessage = `Scheduled Draft ${pw.random.id()}`;

    // Setup test user and login
    const {user} = await pw.initSetup();
    const {channelsPage, scheduledPostsPage} = await pw.testBrowser.login(user);

    // Navigate to channel page
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // Create a scheduled message with 1 day offset
    const {selectedDate, selectedTime} = await channelsPage.scheduleMessage(draftMessage, 1);

    // Verify scheduled message indicator appears with correct date/time
    await verifyScheduledPostIndicator(channelsPage, selectedDate, selectedTime);

    // Verify scheduled post badge in left sidebar shows correct count
    await channelsPage.sidebarLeft.scheduledPostBadge.isVisible();
    await expect(channelsPage.sidebarLeft.scheduledPostBadge).toHaveText('1');

    // Navigate to scheduled posts page
    await channelsPage.centerView.scheduledPostIndicator.seeAllLink.click();

    // Verify scheduled posts page displays correct information
    await scheduledPostsPage.toBeVisible();
    expect(await scheduledPostsPage.getBadgeCountOnTab()).toBe('1');
    const scheduledPost = await scheduledPostsPage.getLastPost();
    await expect(scheduledPost.panelBody).toContainText(draftMessage);
    await expect(scheduledPost.panelHeader).toContainText(`Send on ${selectedDate} at ${selectedTime}`);

    // Reschedule message to 2 days from today
    const {selectedDate: newSelectedDate, selectedTime: newSelectedTime} = await scheduledPostsPage.rescheduleMessage(
        scheduledPost,
        2,
    );

    // Return to channel page
    await channelsPage.goto();

    // Verify the message shows updated scheduled time
    await verifyScheduledPostIndicator(channelsPage, newSelectedDate, newSelectedTime);
});

/**
 * Verify the ability to delete a scheduled message.
 *
 * Precondition:
 * 1. A test server with valid license to support scheduled message features
 * 2. User has permissions to create and manage scheduled messages
 *
 * Steps:
 * 1. Login as a user
 * 2. Navigate to a channel
 * 3. Create a scheduled message
 * 4. Navigate to scheduled drafts page
 * 5. Delete the scheduled message
 * 6. Verify message is no longer visible
 *
 * Expected:
 * - User can successfully delete a scheduled message
 * - The message is no longer visible in scheduled drafts page
 * - "No scheduled drafts" indicator is shown
 */
test('MM-T5645 should delete a scheduled message', async ({pw}) => {
    const draftMessage = `Scheduled Draft ${pw.random.id()}`;

    // Setup test user and login
    const {user} = await pw.initSetup();
    const {channelsPage, scheduledPostsPage} = await pw.testBrowser.login(user);

    // Navigate to channel and create scheduled message
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // Create a scheduled message with 1 day offset
    const {selectedDate, selectedTime} = await channelsPage.scheduleMessage(draftMessage, 1);

    // Verify scheduled message indicator appears with correct date/time
    await verifyScheduledPostIndicator(channelsPage, selectedDate, selectedTime);

    // Navigate to scheduled posts page
    await channelsPage.centerView.scheduledPostIndicator.seeAllLink.click();

    // Delete the scheduled message
    await scheduledPostsPage.toBeVisible();
    const scheduledPost = await scheduledPostsPage.getLastPost();
    await scheduledPost.hover();
    await scheduledPost.deleteButton.click();

    await scheduledPostsPage.deleteScheduledPostModal.toBeVisible();
    await scheduledPostsPage.deleteScheduledPostModal.deleteButton.click();

    // Verify the scheduled message is removed from the scheduled posts page
    await expect(scheduledPost.container).not.toBeVisible();
    await expect(scheduledPostsPage.badge).not.toBeVisible();
    await expect(scheduledPostsPage.noScheduledDrafts).toBeVisible();
});

/**
 * Verify the ability to send a scheduled message immediately.
 *
 * Precondition:
 * 1. A test server with valid license to support scheduled message features
 * 2. User has permissions to create and manage scheduled messages
 *
 * Steps:
 * 1. Login as a user
 * 2. Navigate to a channel
 * 3. Create a scheduled message
 * 4. Navigate to scheduled drafts page
 * 5. Send the scheduled message immediately
 * 6. Verify message appears in channel
 *
 * Expected:
 * - User can send a scheduled message immediately
 * - Message disappears from scheduled drafts
 * - Message appears in the channel
 * - Scheduled draft indicators disappear
 */
test('MM-T5643_9 should send a scheduled message immediately', async ({pw}) => {
    const draftMessage = `Scheduled Draft ${pw.random.id()}`;

    // Setup test user and login
    const {user, townSquareUrl} = await pw.initSetup();
    const {channelsPage, scheduledPostsPage} = await pw.testBrowser.login(user);

    // Navigate to channel and create scheduled message
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // Create a scheduled message with 1 day offset
    const {selectedDate, selectedTime} = await channelsPage.scheduleMessage(draftMessage, 1);

    // Verify scheduled message indicator appears with correct date/time
    await verifyScheduledPostIndicator(channelsPage, selectedDate, selectedTime);

    // Navigate to scheduled posts page
    await channelsPage.centerView.scheduledPostIndicator.seeAllLink.click();

    // Send the scheduled message immediately
    const scheduledPost = await scheduledPostsPage.getLastPost();
    await scheduledPost.hover();
    await scheduledPost.sendNowButton.click();
    await scheduledPostsPage.sendMessageNowModal.toBeVisible();
    await scheduledPostsPage.sendMessageNowModal.sendNowButton.click();

    await expect(channelsPage.page).toHaveURL(townSquareUrl);

    // Verify message has been posted to the channel
    await expect(channelsPage.centerView.scheduledPostIndicator.container).not.toBeVisible();
    await expect(channelsPage.sidebarLeft.scheduledPostBadge).not.toBeVisible();
    const lastPost = await channelsPage.getLastPost();
    await expect(lastPost.body).toHaveText(draftMessage);
});

/**
 * Verify the ability to create a scheduled message from a direct message (DM).
 *
 * Precondition:
 * 1. A test server with valid license to support scheduled message features
 * 2. User has permissions to create and manage scheduled messages
 * 3. Two user accounts exist
 *
 * Steps:
 * 1. Login as the first user
 * 2. Navigate to a DM channel with the second user
 * 3. Create a scheduled message
 * 4. Navigate to scheduled drafts page
 * 5. Send the scheduled message immediately
 * 6. Verify message appears in the DM channel
 *
 * Expected:
 * - User can successfully schedule a message from a DM channel
 * - Message appears in the DM channel when sent
 * - Scheduled message indicators disappear after sending
 */
test('MM-T5643_3 should create a scheduled message from a DM', async ({pw}) => {
    const draftMessage = `Scheduled Draft ${pw.random.id()}`;

    const {user, team, adminClient} = await pw.initSetup();
    const otherUser = await adminClient.createUser(pw.random.user(), '', '');

    const {channelsPage, scheduledPostsPage} = await pw.testBrowser.login(user);

    await channelsPage.goto(team.name, `@${otherUser.username}`);
    await channelsPage.toBeVisible();

    await channelsPage.scheduleMessage(draftMessage, 1);

    // Navigate to scheduled posts page
    if (pw.isOutsideRemoteUserHour(otherUser.timezone)) {
        await channelsPage.centerView.scheduledPostIndicator.scheduledMessageLink.click();
    } else {
        await channelsPage.centerView.scheduledPostIndicator.seeAllLink.click();
    }

    await scheduledPostsPage.toBeVisible();

    // Send the scheduled message immediately
    const scheduledPost = await scheduledPostsPage.getLastPost();
    await scheduledPost.hover();
    await scheduledPost.sendNowButton.click();
    await scheduledPostsPage.sendMessageNowModal.toBeVisible();
    await scheduledPostsPage.sendMessageNowModal.sendNowButton.click();

    await expect(channelsPage.page).toHaveURL(`/${team.name}/messages/@${otherUser.username}`);

    // Verify message has been posted to the DM channel
    await expect(channelsPage.centerView.scheduledPostIndicator.container).not.toBeVisible();
    await expect(channelsPage.sidebarLeft.scheduledPostBadge).not.toBeVisible();
    const lastPost = await channelsPage.getLastPost();
    await expect(lastPost.body).toHaveText(draftMessage);
});

/**
 * Verify the ability to convert a draft message to a scheduled message.
 *
 * Precondition:
 * 1. A test server with valid license to support scheduled message features
 * 2. User has permissions to create drafts and scheduled messages
 *
 * Steps:
 * 1. Login as a user
 * 2. Navigate to a channel and create a draft message
 * 3. Navigate to drafts page
 * 4. Verify draft message exists
 * 5. Open schedule modal from draft and schedule it
 * 6. Navigate to scheduled drafts page
 * 7. Verify the message appears as a scheduled draft
 *
 * Expected:
 * - User can convert a draft message to a scheduled message
 * - Message appears in the scheduled drafts page with correct information
 * - Badge count in scheduled drafts page shows correct count
 */
test('MM-T5648 should create a draft and then schedule it', async ({pw}) => {
    const draftMessage = `Scheduled Draft ${pw.random.id()}`;

    const {user, team} = await pw.initSetup();
    const {channelsPage, draftsPage, scheduledPostsPage} = await pw.testBrowser.login(user);

    // await setupChannelPage(channelsPage, draftMessage);
    await channelsPage.goto();
    await channelsPage.toBeVisible();
    await channelsPage.centerView.postCreate.writeMessage(draftMessage);

    // go to drafts page
    await draftsPage.goto(team.name);
    await draftsPage.toBeVisible();
    expect(await draftsPage.getBadgeCountOnTab()).toBe('1');

    const draftedPost = await draftsPage.getLastPost();
    await expect(draftedPost.panelBody).toContainText(draftMessage);

    await draftedPost.hover();
    await draftedPost.scheduleButton.click();
    await draftsPage.scheduleMessageModal.toBeVisible();
    const {selectedDate, selectedTime} = await draftsPage.scheduleMessageModal.scheduleMessage(2);

    await scheduledPostsPage.goto(team.name);
    await scheduledPostsPage.toBeVisible();
    expect(await scheduledPostsPage.getBadgeCountOnTab()).toBe('1');

    // Verify scheduled post appears in scheduled posts page
    const scheduledPost = await scheduledPostsPage.getLastPost();
    await expect(scheduledPost.panelBody).toContainText(draftMessage);
    await expect(scheduledPost.panelHeader).toContainText(`Send on ${selectedDate} at ${selectedTime}`);
});

/**
 * Verify the ability to edit a scheduled message before it's sent.
 *
 * Precondition:
 * 1. A test server with valid license to support scheduled message features
 * 2. User has permissions to create and edit scheduled messages
 *
 * Steps:
 * 1. Login as a user
 * 2. Navigate to a channel
 * 3. Create a scheduled message
 * 4. Navigate to scheduled drafts page
 * 5. Edit the scheduled message
 * 6. Send the message immediately
 * 7. Verify the edited message appears in the channel
 *
 * Expected:
 * - User can successfully edit a scheduled message
 * - The edited message appears in the channel when sent
 * - Scheduled message indicators disappear after sending
 */
test('MM-T5644 should edit scheduled message', async ({pw}) => {
    const draftMessage = `Scheduled Draft ${pw.random.id()}`;

    const {user, townSquareUrl} = await pw.initSetup();
    const {channelsPage, scheduledPostsPage} = await pw.testBrowser.login(user);

    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // Create a scheduled message with 1 day offset
    const {selectedDate, selectedTime} = await channelsPage.scheduleMessage(draftMessage, 2);

    // Verify scheduled message indicator appears with correct date/time
    await verifyScheduledPostIndicator(channelsPage, selectedDate, selectedTime);

    // Verify scheduled post badge in left sidebar shows correct count
    await channelsPage.sidebarLeft.scheduledPostBadge.isVisible();
    await expect(channelsPage.sidebarLeft.scheduledPostBadge).toHaveText('1');

    // Navigate to scheduled posts page
    await channelsPage.centerView.scheduledPostIndicator.seeAllLink.click();

    // Verify scheduled posts page displays correct information
    await scheduledPostsPage.toBeVisible();
    expect(await scheduledPostsPage.getBadgeCountOnTab()).toBe('1');
    const scheduledPost = await scheduledPostsPage.getLastPost();
    await expect(scheduledPost.panelBody).toContainText(draftMessage);
    await expect(scheduledPost.panelHeader).toContainText(`Send on ${selectedDate} at ${selectedTime}`);

    // # Hover and click edit button
    await scheduledPost.hover();
    await scheduledPost.editButton.click();

    const updatedText = 'updated text';
    await scheduledPost.editTextBox.fill(updatedText);
    await scheduledPost.saveButton.click();

    await expect(scheduledPost.panelBody).toContainText(updatedText);
    await expect(scheduledPost.panelHeader).toContainText(`Send on ${selectedDate} at ${selectedTime}`);

    await scheduledPost.hover();
    await scheduledPost.sendNowButton.click();
    await scheduledPostsPage.sendMessageNowModal.toBeVisible();
    await scheduledPostsPage.sendMessageNowModal.sendNowButton.click();

    await expect(channelsPage.page).toHaveURL(townSquareUrl);

    // Verify message has been posted to the channel and no more scheduled messages
    await expect(channelsPage.centerView.scheduledPostIndicator.container).not.toBeVisible();
    await expect(channelsPage.sidebarLeft.scheduledPostBadge).not.toBeVisible();
    const lastPost = await channelsPage.getLastPost();
    await expect(lastPost.body).toHaveText(updatedText);
});

/**
 * Verify the ability to copy a scheduled message to clipboard.
 *
 * Precondition:
 * 1. A test server with valid license to support scheduled message features
 * 2. User has permissions to create scheduled messages
 * 3. Browser supports clipboard operations (not Firefox)
 *
 * Steps:
 * 1. Login as a user
 * 2. Navigate to a channel
 * 3. Create a scheduled message
 * 4. Navigate to scheduled drafts page
 * 5. Copy the scheduled message content
 * 6. Return to channel page
 * 7. Paste the copied message in post creator
 * 8. Verify the copied message content
 *
 * Expected:
 * - User can successfully copy a scheduled message
 * - The copied message content matches the original message
 * - Message can be pasted in the post creator
 */
test('MM-T5650 should copy scheduled message', async ({pw, browserName}) => {
    // Skip this test in Firefox clipboard permissions are not supported
    test.skip(browserName === 'firefox', 'Test not supported in Firefox');

    const draftMessage = `Scheduled Draft ${pw.random.id()}`;

    const {user} = await pw.initSetup();
    const {page, channelsPage, scheduledPostsPage} = await pw.testBrowser.login(user);

    await channelsPage.goto();
    await channelsPage.toBeVisible();

    const {selectedDate, selectedTime} = await channelsPage.scheduleMessage(draftMessage, 1);

    await channelsPage.sidebarLeft.scheduledPostBadge.isVisible();
    await expect(channelsPage.sidebarLeft.scheduledPostBadge).toHaveText('1');

    // Verify scheduled post badge in left sidebar shows correct count
    await channelsPage.sidebarLeft.scheduledPostBadge.isVisible();
    await expect(channelsPage.sidebarLeft.scheduledPostBadge).toHaveText('1');

    // Navigate to scheduled posts page
    await channelsPage.centerView.scheduledPostIndicator.seeAllLink.click();

    // Verify scheduled posts page displays correct information
    await scheduledPostsPage.toBeVisible();
    expect(await scheduledPostsPage.getBadgeCountOnTab()).toBe('1');
    const scheduledPost = await scheduledPostsPage.getLastPost();
    await expect(scheduledPost.panelBody).toContainText(draftMessage);
    await expect(scheduledPost.panelHeader).toContainText(`Send on ${selectedDate} at ${selectedTime}`);

    // Copy the scheduled message
    await scheduledPost.hover();
    await scheduledPost.copyTextButton.click();

    await page.goBack();

    await channelsPage.centerView.postCreate.input.focus();

    await page.keyboard.down('ControlOrMeta');
    await page.keyboard.press('V');
    await page.keyboard.up('ControlOrMeta');

    // * Assert the message typed is same as the copied message
    await expect(channelsPage.centerView.postCreate.input).toHaveText(draftMessage);
});

/**
 * Verifies that the scheduled post indicator is visible and displays the correct date and time.
 *
 * @param channelsPage - The ChannelsPage instance
 * @param selectedDate - The selected date for the scheduled message
 * @param selectedTime - The selected time for the scheduled message
 */
async function verifyScheduledPostIndicator(
    channelsPage: ChannelsPage,
    selectedDate: string,
    selectedTime: string | null,
) {
    await channelsPage.centerView.scheduledPostIndicator.toBeVisible();
    await expect(channelsPage.centerView.scheduledPostIndicator.icon).toBeVisible();
    await expect(channelsPage.centerView.scheduledPostIndicator.messageText).toContainText(
        `Message scheduled for ${selectedDate} at ${selectedTime}.`,
    );
}
