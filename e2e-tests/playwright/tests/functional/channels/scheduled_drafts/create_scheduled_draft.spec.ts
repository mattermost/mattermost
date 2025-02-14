// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Page} from '@playwright/test';
import {test} from '@e2e-support/test_fixture';
import {ChannelsPage, ScheduledDraftPage} from '@e2e-support/ui/pages';
import {duration, wait} from '@e2e-support/util';

test('MM-T5643_1 should create a scheduled message from a channel', async ({pw}) => {
    test.setTimeout(duration.four_min);

    const draftMessage = 'Scheduled Draft';
    // # Skip test if no license
    await pw.skipIfNoLicense();

    const {user} = await pw.initSetup();
    const {page, channelsPage, scheduledDraftPage} = await pw.testBrowser.login(user);

    await setupChannelPage(channelsPage, draftMessage);
    await scheduleMessage(channelsPage);

    await channelsPage.centerView.verifyscheduledDraftChannelInfo();

    const postBoxIndicator = await channelsPage.centerView.scheduledDraftChannelInfoMessageText.innerText();

    await verifyScheduledDraft(channelsPage, scheduledDraftPage, draftMessage, postBoxIndicator);

    // # Hover and verify options
    await scheduledDraftPage.verifyOnHoverActionItems(draftMessage);

    // # Go back and wait for message to arrive
    await goBackToChannelAndWaitForMessageToArrive(page);

    // * Verify the message has been sent and there's no more scheduled messages
    await expect(channelsPage.centerView.scheduledDraftChannelInfoMessage).not.toBeVisible();
    await expect(channelsPage.sidebarLeft.scheduledDraftCountonLHS).not.toBeVisible();
    await expect(await channelsPage.getLastPost()).toHaveText(draftMessage);
    await channelsPage.sidebarLeft.assertNoPendingScheduledDraft();
});

test('MM-T5643_6 should create a scheduled message under a thread post ', async ({pw}) => {
    const draftMessage = 'Scheduled Threaded Message';
    // # Skip test if no license
    await pw.skipIfNoLicense();

    const {user} = await pw.initSetup();

    // # Log in as a user in new browser context
    const {channelsPage, scheduledDraftPage} = await pw.testBrowser.login(user);

    // # Visit default channel page
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    await channelsPage.centerView.postCreate.postMessage('Root Message');

    // # Start a thread by clicking on reply menuitem from post options menu
    const post = await channelsPage.centerView.getLastPost();
    await replyToLastPost(post);

    const sidebarRight = channelsPage.sidebarRight;
    await sidebarRight.toBeVisible();

    // # Post a message in the thread
    await sidebarRight.postCreate.postMessage('Replying to a thread');

    // # Write a message in the reply thread but don't send it
    await sidebarRight.postCreate.writeMessage(draftMessage);
    await expect(sidebarRight.postCreate.input).toHaveText(draftMessage);

    await sidebarRight.postCreate.scheduleDraftMessageButton.isVisible();
    await sidebarRight.postCreate.scheduleDraftMessageButton.click();

    await scheduleMessage(channelsPage);

    await sidebarRight.postBoxIndicator.isVisible();
    const messageLocator = sidebarRight.scheduledDraftChannelInfoMessage.first();
    await expect(messageLocator).toContainText('Message scheduled for');

    // Save the time displayed in the thread
    const scheduledDraftThreadedPanelInfo = await sidebarRight.postBoxIndicator.innerText();

    await channelsPage.sidebarRight.clickOnSeeAllscheduledDrafts();
    const scheduledDraftPageInfo = await scheduledDraftPage.scheduledDraftPageInfo.innerHTML();
    await channelsPage.sidebarLeft.assertscheduledDraftCountLHS('1');

    await scheduledDraftPage.toBeVisible();
    await scheduledDraftPage.assertBadgeCountOnTab('1');

    await scheduledDraftPage.assertscheduledDraftBody(draftMessage);

    await compareMessageTimestamps(scheduledDraftThreadedPanelInfo, scheduledDraftPageInfo, scheduledDraftPage);

    // # Hover and verify options
    await scheduledDraftPage.verifyOnHoverActionItems(draftMessage);

    await scheduledDraftPage.sendScheduledMessage(draftMessage);

    await sidebarRight.toBeVisible();
    (await sidebarRight.getLastPost()).toContainText(draftMessage);

    await expect(channelsPage.sidebarRight.scheduledDraftChannelInfoMessage).not.toBeVisible();
    await expect(channelsPage.sidebarLeft.scheduledDraftCountonLHS).not.toBeVisible();
    await channelsPage.sidebarLeft.assertNoPendingScheduledDraft();
});

test('MM-T5644 should reschedule a scheduled message', async ({pw}) => {
    const draftMessage = 'Scheduled Draft';
    await pw.skipIfNoLicense();

    const {user} = await pw.initSetup();
    const {channelsPage, scheduledDraftPage} = await pw.testBrowser.login(user);

    await setupChannelPage(channelsPage, draftMessage);
    await scheduleMessage(channelsPage);

    // * Verify the Initial Date and time of scheduled Draft
    await channelsPage.centerView.verifyscheduledDraftChannelInfo();
    const postBoxIndicator = await channelsPage.centerView.scheduledDraftChannelInfoMessageText.innerText();
    await verifyScheduledDraft(channelsPage, scheduledDraftPage, draftMessage, postBoxIndicator);

    await scheduledDraftPage.openRescheduleModal(draftMessage);

    // # Reschedule it to 2 days from today
    await channelsPage.scheduledDraftModal.selectDay(2);
    await channelsPage.scheduledDraftModal.confirm();

    // # Note the new Scheduled time
    const scheduledDraftPageInfo = await scheduledDraftPage.getTimeStampOfMessage(draftMessage);

    // # Go to Channel
    await channelsPage.goto();

    // * Verify the New Time reflecting in the channel
    const rescheduledDraftChannelInfo = await channelsPage.centerView.scheduledDraftChannelInfoMessageText.innerText();
    await compareMessageTimestamps(rescheduledDraftChannelInfo, scheduledDraftPageInfo, scheduledDraftPage);
});

test('MM-T5645 should delete a scheduled message', async ({pw}) => {
    const draftMessage = 'Scheduled Draft';
    await pw.skipIfNoLicense();

    const {user} = await pw.initSetup();
    const {channelsPage, scheduledDraftPage} = await pw.testBrowser.login(user);

    await setupChannelPage(channelsPage, draftMessage);
    await scheduleMessage(channelsPage);
    const postBoxIndicator = await channelsPage.centerView.scheduledDraftChannelInfoMessageText.innerText();

    await verifyScheduledDraft(channelsPage, scheduledDraftPage, draftMessage, postBoxIndicator);

    await scheduledDraftPage.deleteScheduledMessage(draftMessage);

    await expect(scheduledDraftPage.scheduledDraftPanel(draftMessage)).not.toBeVisible();
    await expect(scheduledDraftPage.noscheduledDraftIcon).toBeVisible();
});

test('MM-T5643_9 should send a scheduled message immediately', async ({pw}) => {
    const draftMessage = 'Scheduled Draft';
    await pw.skipIfNoLicense();

    const {user} = await pw.initSetup();
    const {channelsPage, scheduledDraftPage} = await pw.testBrowser.login(user);

    await setupChannelPage(channelsPage, draftMessage);
    await scheduleMessage(channelsPage);
    const postBoxIndicator = await channelsPage.centerView.scheduledDraftChannelInfoMessageText.innerText();

    await verifyScheduledDraft(channelsPage, scheduledDraftPage, draftMessage, postBoxIndicator);

    await scheduledDraftPage.sendScheduledMessage(draftMessage);
    await wait(duration.two_sec);

    await expect(scheduledDraftPage.scheduledDraftPanel(draftMessage)).not.toBeVisible();

    // Verify message has arrived
    await expect(channelsPage.centerView.scheduledDraftChannelInfoMessage).not.toBeVisible();
    await expect(channelsPage.sidebarLeft.scheduledDraftCountonLHS).not.toBeVisible();
    await expect(await channelsPage.getLastPost()).toHaveText(draftMessage);
});

test('MM-T5643_3 should create a scheduled message from a DM', async ({pw}) => {
    const draftMessage = 'Scheduled Draft';
    // # Skip test if no license
    await pw.skipIfNoLicense();

    const {user, team} = await pw.initSetup();
    const {user: user2} = await pw.initSetup();

    const {page, channelsPage, scheduledDraftPage} = await pw.testBrowser.login(user);

    await setupChannelPage(channelsPage, draftMessage, team.name, `@${user2.username}`);
    await scheduleMessage(channelsPage);

    await channelsPage.centerView.verifyscheduledDraftChannelInfo();

    const postBoxIndicator = await channelsPage.centerView.scheduledDraftChannelInfoMessageText.innerText();

    await verifyScheduledDraft(channelsPage, scheduledDraftPage, draftMessage, postBoxIndicator);

    // # Hover and verify options
    await scheduledDraftPage.verifyOnHoverActionItems(draftMessage);

    await scheduledDraftPage.sendScheduledMessage(draftMessage);
    await page.waitForSelector(channelsPage.centerView.scheduledDraftChannelInfoMessageLocator, {state: 'hidden'});

    // * Verify the message has been sent and there's no more scheduled messages
    await expect(channelsPage.centerView.scheduledDraftChannelInfoMessage).not.toBeVisible();
    await expect(channelsPage.sidebarLeft.scheduledDraftCountonLHS).not.toBeVisible();
    await expect(await channelsPage.getLastPost()).toHaveText(draftMessage);

    await channelsPage.sidebarLeft.assertNoPendingScheduledDraft();
});

test('MM-T5648 should create a draft and then schedule it', async ({pw}) => {
    const draftMessage = 'Draft to be Scheduled';
    await pw.skipIfNoLicense();

    const {user, team} = await pw.initSetup();
    const {channelsPage, draftPage, scheduledDraftPage} = await pw.testBrowser.login(user);

    // await setupChannelPage(channelsPage, draftMessage);
    await channelsPage.goto();
    await channelsPage.toBeVisible();
    await channelsPage.centerView.postCreate.writeMessage(draftMessage);

    // go to drafts page
    await draftPage.goTo(team.name);
    await draftPage.toBeVisible();
    await draftPage.assertBadgeCountOnTab('1');
    await draftPage.assertDraftBody(draftMessage);
    await draftPage.verifyScheduleIcon(draftMessage);
    await draftPage.openScheduleModal(draftMessage);

    // # Reschedule it to 2 days from today
    await channelsPage.scheduledDraftModal.selectDay(2);
    await channelsPage.scheduledDraftModal.confirm();

    await scheduledDraftPage.goTo(team.name);
    await scheduledDraftPage.toBeVisible();
    await scheduledDraftPage.assertBadgeCountOnTab('1');
    await scheduledDraftPage.assertscheduledDraftBody(draftMessage);
});

test('MM-T5644 should edit scheduled message', async ({pw}) => {
    const draftMessage = 'Scheduled Draft';
    // # Skip test if no license
    await pw.skipIfNoLicense();

    const {user} = await pw.initSetup();
    const {page, channelsPage, scheduledDraftPage} = await pw.testBrowser.login(user);

    await setupChannelPage(channelsPage, draftMessage);
    await scheduleMessage(channelsPage);

    await channelsPage.centerView.verifyscheduledDraftChannelInfo();

    const postBoxIndicator = await channelsPage.centerView.scheduledDraftChannelInfoMessageText.innerText();

    await verifyScheduledDraft(channelsPage, scheduledDraftPage, draftMessage, postBoxIndicator);

    // # Hover and verify options
    await scheduledDraftPage.verifyOnHoverActionItems(draftMessage);

    const updatedText = 'updated text';
    await scheduledDraftPage.editText(updatedText);

    await scheduledDraftPage.sendScheduledMessage(updatedText);

    // * Verify the message has been sent and there's no more scheduled messages
    await page.waitForSelector(channelsPage.centerView.scheduledDraftChannelInfoMessageLocator, {state: 'hidden'});
    await expect(channelsPage.centerView.scheduledDraftChannelInfoMessage).not.toBeVisible();
    await expect(channelsPage.sidebarLeft.scheduledDraftCountonLHS).not.toBeVisible();
    await expect(await channelsPage.getLastPost()).toHaveText(updatedText);

    await channelsPage.sidebarLeft.assertNoPendingScheduledDraft();
});

test('MM-T5650 should copy scheduled message', async ({pw, browserName}) => {
    // Skip this test in Firefox clipboard permissions are not supported
    test.skip(browserName === 'firefox', 'Test not supported in Firefox');

    // # Skip test if no license
    await pw.skipIfNoLicense();

    const draftMessage = 'Scheduled Draft';

    const {user} = await pw.initSetup();
    const {page, channelsPage, scheduledDraftPage} = await pw.testBrowser.login(user);

    await setupChannelPage(channelsPage, draftMessage);
    await scheduleMessage(channelsPage);

    await channelsPage.centerView.verifyscheduledDraftChannelInfo();

    const postBoxIndicator = await channelsPage.centerView.scheduledDraftChannelInfoMessageText.innerText();

    await verifyScheduledDraft(channelsPage, scheduledDraftPage, draftMessage, postBoxIndicator);

    await scheduledDraftPage.copyScheduledMessage(draftMessage);

    await page.goBack();

    await channelsPage.centerView.postCreate.input.focus();

    await page.keyboard.down('ControlOrMeta');
    await page.keyboard.press('V');
    await page.keyboard.up('ControlOrMeta');

    // * Assert the message typed is same as the copied message
    await expect(channelsPage.centerView.postCreate.input).toHaveText(draftMessage);
});

async function goBackToChannelAndWaitForMessageToArrive(page: Page): Promise<void> {
    await page.goBack();
    await wait(duration.two_min);
    await page.reload();
}

async function replyToLastPost(post: any): Promise<void> {
    await post.hover();
    await post.postMenu.toBeVisible();
    await post.postMenu.reply();
}

async function setupChannelPage(
    channelsPage: ChannelsPage,
    draftMessage: string,
    teamName?: string,
    channelName?: string,
): Promise<void> {
    await channelsPage.goto(teamName, channelName);
    await channelsPage.toBeVisible();

    await channelsPage.centerView.postCreate.writeMessage(draftMessage);
    await channelsPage.centerView.postCreate.clickOnScheduleDraftDropdownButton();
}

/**
 * Schedules a draft message by selecting a custom time and confirming.
 */
async function scheduleMessage(pageObject: ChannelsPage): Promise<void> {
    await pageObject.scheduledDraftDropdown.toBeVisible();
    await pageObject.scheduledDraftDropdown.selectCustomTime();

    await pageObject.scheduledDraftModal.toBeVisible();
    await pageObject.scheduledDraftModal.selectDay();
    await pageObject.scheduledDraftModal.selectTime();
    await pageObject.scheduledDraftModal.confirm();
}

/**
 * Extracts and verifies the scheduled message on the scheduled page and in the channel.
 */
async function verifyScheduledDraft(
    channelsPage: ChannelsPage,
    scheduledDraftPage: ScheduledDraftPage,
    draftMessage: string,
    postBoxIndicator: string,
): Promise<void> {
    await verifyscheduledDraftCount(channelsPage, '1');
    await scheduledDraftPage.toBeVisible();
    await scheduledDraftPage.assertBadgeCountOnTab('1');
    await scheduledDraftPage.assertscheduledDraftBody(draftMessage);

    const scheduledDraftPageInfo = await scheduledDraftPage.getTimeStampOfMessage(draftMessage);
    await compareMessageTimestamps(postBoxIndicator, scheduledDraftPageInfo, scheduledDraftPage);
}

/**
 * Verifies the scheduled message count on the sidebar.
 */
async function verifyscheduledDraftCount(page: ChannelsPage, expectedCount: string): Promise<void> {
    await page.centerView.clickOnSeeAllscheduledDrafts();
    await page.sidebarLeft.assertscheduledDraftCountLHS(expectedCount);
}

/**
 * Compares the time in the channel and the scheduled page to ensure consistency.
 */
async function compareMessageTimestamps(
    timeInChannel: string,
    scheduledDraftPageInfo: string,
    scheduledDraftPage: ScheduledDraftPage,
): Promise<void> {
    // Extract time from channel using the same date pattern
    const matchedTimeInChannel = timeInChannel.match(scheduledDraftPage.datePattern);
    const timeInSchedulePage = extractTimeFromHtml(scheduledDraftPageInfo, scheduledDraftPage);

    if (!matchedTimeInChannel || !timeInSchedulePage) {
        throw new Error('Could not extract date and time from one or both elements.');
    }

    const firstElementTime = matchedTimeInChannel[0];
    const secondElementTime = timeInSchedulePage[0];

    // Compare extracted times
    expect(firstElementTime).toBe(secondElementTime);
}

/**
 * Removes HTML tags from the scheduled message content and extracts the time pattern.
 */
function extractTimeFromHtml(htmlContent: string, scheduledDraftPage: ScheduledDraftPage): RegExpMatchArray | null {
    // Remove all HTML tags and match the expected time pattern using the datePattern from scheduledDraftPage
    const cleanedText = htmlContent.replace(/<\/?[^>]+(>|$)/g, '');

    // Use the datePattern to extract the exact match for time
    const matchedTime = cleanedText.match(scheduledDraftPage.datePattern);
    return matchedTime;
}
