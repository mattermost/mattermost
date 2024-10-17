import {expect, Page} from '@playwright/test';
import {test} from '@e2e-support/test_fixture';
import {duration, wait} from '@e2e-support/util';
import {ChannelsPage, ScheduledMessagePage} from '@e2e-support/ui/pages';

test('Should create a scheduled message from a channel', async ({pw, pages}) => {
    test.setTimeout(120000);

    const draftMessage = 'Scheduled Draft';
    // # Skip test if no license
    await pw.skipIfNoLicense();

    const {user} = await pw.initSetup();
    const {page} = await pw.testBrowser.login(user);
    const channelPage = new pages.ChannelsPage(page);
    const scheduledMessagePage = new pages.ScheduledMessagePage(page);

    await setupChannelPage(channelPage, draftMessage);
    await scheduleMessage(channelPage);

    await channelPage.centerView.verifyScheduledMessageChannelInfo();

    const scheduledMessageChannelInfo = await channelPage.centerView.scheduledMessageChannelInfoMessageText.innerText();

    await verifyScheduledMessages(channelPage, pages, draftMessage, scheduledMessageChannelInfo);

    // # Hover and verify options
    await scheduledMessagePage.verifyOnHoverActionItems(draftMessage);

    // # Go back and wait for message to arrive
    await page.goBack();
    await wait(duration.half_min);
    await page.reload();

    // * Verify the message has been sent and there's no more scheduled messages
    await expect(channelPage.centerView.scheduledMessageChannelInfoMessage).not.toBeVisible();
    await expect(channelPage.sidebarLeft.scheduledMessageCountonLHS).not.toBeVisible();
    await expect(await channelPage.getLastPost()).toHaveText(draftMessage);

    await verifyNoScheduledMessagesPending(page, scheduledMessagePage, draftMessage);
});

test('Should create a scheduled message under a thread post ', async ({pw, pages}) => {
    test.setTimeout(120000);

    const draftMessage = 'Scheduled Threaded Message';
    // # Skip test if no license
    await pw.skipIfNoLicense();

    const {user} = await pw.initSetup();

    // # Log in as a user in new browser context
    const {page} = await pw.testBrowser.login(user);

    // # Visit default channel page
    const channelPage = new pages.ChannelsPage(page);
    await channelPage.goto();
    await channelPage.toBeVisible();

    await channelPage.centerView.postCreate.postMessage('Root Message');

    // # Start a thread by clicking on reply menuitem from post options menu
    const post = await channelPage.centerView.getLastPost();
    await replyToLastPost(post);

    const sidebarRight = channelPage.sidebarRight;
    await sidebarRight.toBeVisible();

    // # Post a message in the thread
    await sidebarRight.postCreate.postMessage('Replying to a thread');

    // # Write a message in the reply thread but don't send it
    await sidebarRight.postCreate.writeMessage(draftMessage);
    await expect(sidebarRight.postCreate.input).toHaveText(draftMessage);

    await sidebarRight.postCreate.scheduleDraftMessageButton.isVisible();
    await sidebarRight.postCreate.scheduleDraftMessageButton.click();

    await scheduleMessage(channelPage);

    await sidebarRight.scheduledMessageChannelInfo.isVisible();
    const messageLocator = sidebarRight.scheduledMessageChannelInfoMessage.first();
    await expect(messageLocator).toContainText('Message scheduled for');

    // Save the time displayed in the thread
    const scheduledMessageThreadedPanelInfo = await sidebarRight.scheduledMessageChannelInfo.innerText();
    const scheduledMessagePage = new pages.ScheduledMessagePage(page);

    await channelPage.sidebarRight.clickOnSeeAllScheduledMessages();
    const scheduledMessagePageInfo = await scheduledMessagePage.scheduledMessagePageInfo.innerHTML();
    await channelPage.sidebarLeft.assertScheduledMessageCountLHS('1');

    await scheduledMessagePage.toBeVisible();
    await scheduledMessagePage.assertBadgeCountOnTab('1');

    await scheduledMessagePage.assertScheduledMessageBody(draftMessage);

    await compareMessageTimestamps(scheduledMessageThreadedPanelInfo, scheduledMessagePageInfo, scheduledMessagePage);

    // # Hover and verify options
    await scheduledMessagePage.verifyOnHoverActionItems(draftMessage);

    await goBackToChannelAndWaitForMessageToArrive(page);

    await replyToLastPost(post);

    // * Verify the message has been sent and there's no more scheduled messages
    await expect(channelPage.sidebarRight.scheduledMessageChannelInfoMessage).not.toBeVisible();
    await expect(channelPage.sidebarLeft.scheduledMessageCountonLHS).not.toBeVisible();

    const lastPost = channelPage.sidebarRight.rhsPostBody.last();
    await expect(lastPost).toHaveText(draftMessage);
    await expect(scheduledMessagePage.scheduledMessagePanel(draftMessage)).not.toBeVisible();

    await verifyNoScheduledMessagesPending(page, scheduledMessagePage, draftMessage);
});

async function verifyNoScheduledMessagesPending(
    page: Page,
    scheduledMessagePage: ScheduledMessagePage,
    draftMessage: string,
): Promise<void> {
    await page.goForward();
    await expect(scheduledMessagePage.scheduledMessagePanel(draftMessage)).not.toBeVisible();
    await expect(scheduledMessagePage.noScheduledMessageIcon).toBeVisible();
}

async function goBackToChannelAndWaitForMessageToArrive(page: Page): Promise<void> {
    await page.goBack();
    await wait(duration.half_min);
    await page.reload();
}

async function replyToLastPost(post: any): Promise<void> {
    await post.hover();
    await post.postMenu.toBeVisible();
    await post.postMenu.reply();
}

async function setupChannelPage(channelPage: ChannelsPage, draftMessage: string): Promise<void> {
    await channelPage.goto();
    await channelPage.toBeVisible();

    await channelPage.centerView.postCreate.writeMessage(draftMessage);
    await channelPage.centerView.postCreate.clickOnScheduleDraftDropdownButton();
}

/**
 * Schedules a draft message by selecting a custom time and confirming.
 */
async function scheduleMessage(pageObject: any): Promise<void> {
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
async function verifyScheduledMessages(
    channelPage: ChannelsPage,
    pages: any,
    draftMessage: string,
    scheduledMessageChannelInfo: string,
): Promise<void> {
    const scheduledMessagePage = new pages.ScheduledMessagePage(channelPage.page);

    await verifyScheduledMessageCount(channelPage, '1');
    await scheduledMessagePage.toBeVisible();
    await scheduledMessagePage.assertBadgeCountOnTab('1');
    await scheduledMessagePage.assertScheduledMessageBody(draftMessage);

    const scheduledMessagePageInfo = await scheduledMessagePage.scheduledMessagePageInfo.innerHTML();
    await compareMessageTimestamps(scheduledMessageChannelInfo, scheduledMessagePageInfo, scheduledMessagePage);
}

/**
 * Verifies the scheduled message count on the sidebar.
 */
async function verifyScheduledMessageCount(page: ChannelsPage, expectedCount: string): Promise<void> {
    await page.centerView.clickOnSeeAllScheduledMessages();
    await page.sidebarLeft.assertScheduledMessageCountLHS(expectedCount);
}

/**
 * Compares the time in the channel and the scheduled page to ensure consistency.
 */
async function compareMessageTimestamps(
    timeInChannel: string,
    scheduledMessagePageInfo: string,
    scheduledMessagePage: ScheduledMessagePage,
): Promise<void> {
    // Extract time from channel using the same date pattern
    const matchedTimeInChannel = timeInChannel.match(scheduledMessagePage.datePattern);
    const timeInSchedulePage = extractTimeFromHtml(scheduledMessagePageInfo, scheduledMessagePage);

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
function extractTimeFromHtml(htmlContent: string, scheduledMessagePage: ScheduledMessagePage): RegExpMatchArray | null {
    // Remove all HTML tags and match the expected time pattern using the datePattern from scheduledMessagePage
    const cleanedText = htmlContent.replace(/<\/?[^>]+(>|$)/g, '');

    // Use the datePattern to extract the exact match for time
    const matchedTime = cleanedText.match(scheduledMessagePage.datePattern);
    return matchedTime;
}
