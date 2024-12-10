import {expect, Page} from '@playwright/test';
import {test} from '@e2e-support/test_fixture';
import {ChannelsPage, ScheduledDraftPage} from '@e2e-support/ui/pages';
import {duration, wait} from '@e2e-support/util';

test.fixme('MM-T5643_1 should create a scheduled message from a channel', async ({pw, pages}) => {
    test.setTimeout(120000);

    const draftMessage = 'Scheduled Draft';
    // # Skip test if no license
    await pw.skipIfNoLicense();

    const {user, team} = await pw.initSetup();
    const {page} = await pw.testBrowser.login(user);
    const channelPage = new pages.ChannelsPage(page);
    const scheduledDraftPage = new pages.ScheduledDraftPage(page);

    await setupChannelPage(channelPage, draftMessage);
    await scheduleMessage(channelPage);

    await channelPage.centerView.verifyscheduledDraftChannelInfo();

    const scheduledDraftChannelInfo = await channelPage.centerView.scheduledDraftChannelInfoMessageText.innerText();

    await verifyscheduledDrafts(channelPage, pages, draftMessage, scheduledDraftChannelInfo);

    // # Hover and verify options
    await scheduledDraftPage.verifyOnHoverActionItems(draftMessage);

    // # Go back and wait for message to arrive
    await goBackToChannelAndWaitForMessageToArrive(page);

    // * Verify the message has been sent and there's no more scheduled messages
    await expect(channelPage.centerView.scheduledDraftChannelInfoMessage).not.toBeVisible();
    await expect(channelPage.sidebarLeft.scheduledDraftCountonLHS).not.toBeVisible();
    await expect(await channelPage.getLastPost()).toHaveText(draftMessage);

    await verifyNoscheduledDraftsPending(channelPage, team, scheduledDraftPage, draftMessage);
});

test.fixme('MM-T5643_6 should create a scheduled message under a thread post ', async ({pw, pages}) => {
    test.setTimeout(120000);

    const draftMessage = 'Scheduled Threaded Message';
    // # Skip test if no license
    await pw.skipIfNoLicense();

    const {user, team} = await pw.initSetup();

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

    await sidebarRight.scheduledDraftChannelInfo.isVisible();
    const messageLocator = sidebarRight.scheduledDraftChannelInfoMessage.first();
    await expect(messageLocator).toContainText('Message scheduled for');

    // Save the time displayed in the thread
    const scheduledDraftThreadedPanelInfo = await sidebarRight.scheduledDraftChannelInfo.innerText();
    const scheduledDraftPage = new pages.ScheduledDraftPage(page);

    await channelPage.sidebarRight.clickOnSeeAllscheduledDrafts();
    const scheduledDraftPageInfo = await scheduledDraftPage.scheduledDraftPageInfo.innerHTML();
    await channelPage.sidebarLeft.assertscheduledDraftCountLHS('1');

    await scheduledDraftPage.toBeVisible();
    await scheduledDraftPage.assertBadgeCountOnTab('1');

    await scheduledDraftPage.assertscheduledDraftBody(draftMessage);

    await compareMessageTimestamps(scheduledDraftThreadedPanelInfo, scheduledDraftPageInfo, scheduledDraftPage);

    // # Hover and verify options
    await scheduledDraftPage.verifyOnHoverActionItems(draftMessage);

    await goBackToChannelAndWaitForMessageToArrive(page);

    await replyToLastPost(post);

    // * Verify the message has been sent and there's no more scheduled messages
    await expect(channelPage.sidebarRight.scheduledDraftChannelInfoMessage).not.toBeVisible();
    await expect(channelPage.sidebarLeft.scheduledDraftCountonLHS).not.toBeVisible();

    const lastPost = channelPage.sidebarRight.rhsPostBody.last();
    await expect(lastPost).toHaveText(draftMessage);
    await expect(scheduledDraftPage.scheduledDraftPanel(draftMessage)).not.toBeVisible();

    await verifyNoscheduledDraftsPending(channelPage, team, scheduledDraftPage, draftMessage);
});

test.fixme('MM-T5644 should rechedule a scheduled message', async ({pw, pages}) => {
    const draftMessage = 'Scheduled Draft';
    await pw.skipIfNoLicense();

    const {user} = await pw.initSetup();
    const {page} = await pw.testBrowser.login(user);
    const channelPage = new pages.ChannelsPage(page);
    const scheduledDraftPage = new pages.ScheduledDraftPage(page);

    await setupChannelPage(channelPage, draftMessage);
    await scheduleMessage(channelPage);

    // * Verify the Initial Date and time of scheduled Draft
    await channelPage.centerView.verifyscheduledDraftChannelInfo();
    const scheduledDraftChannelInfo = await channelPage.centerView.scheduledDraftChannelInfoMessageText.innerText();
    await verifyscheduledDrafts(channelPage, pages, draftMessage, scheduledDraftChannelInfo);

    await scheduledDraftPage.openRescheduleModal(draftMessage);

    // # Reschedule it to 2 days from today
    await channelPage.scheduledDraftModal.selectDay(2);
    await channelPage.scheduledDraftModal.confirm();

    // # Note the new Scheduled time
    const scheduledDraftPageInfo = await scheduledDraftPage.getTimeStampOfMessage(draftMessage);

    // # Go to Channel
    await channelPage.goto();

    // * Verify the New Time reflecting in the channel
    const rescheduledDraftChannelInfo = await channelPage.centerView.scheduledDraftChannelInfoMessageText.innerText();
    await compareMessageTimestamps(rescheduledDraftChannelInfo, scheduledDraftPageInfo, scheduledDraftPage);
});

test.fixme('MM-T5645 should delete a scheduled message', async ({pw, pages}) => {
    const draftMessage = 'Scheduled Draft';
    await pw.skipIfNoLicense();

    const {user} = await pw.initSetup();
    const {page} = await pw.testBrowser.login(user);
    const channelPage = new pages.ChannelsPage(page);
    const scheduledDraftPage = new pages.ScheduledDraftPage(page);

    await setupChannelPage(channelPage, draftMessage);
    await scheduleMessage(channelPage);
    const scheduledDraftChannelInfo = await channelPage.centerView.scheduledDraftChannelInfoMessageText.innerText();

    await verifyscheduledDrafts(channelPage, pages, draftMessage, scheduledDraftChannelInfo);

    await scheduledDraftPage.deleteScheduledMessage(draftMessage);

    await expect(scheduledDraftPage.scheduledDraftPanel(draftMessage)).not.toBeVisible();
    await expect(scheduledDraftPage.noscheduledDraftIcon).toBeVisible();
});

test.fixme('MM-T5643_9 should send a scheduled message immediately', async ({pw, pages}) => {
    const draftMessage = 'Scheduled Draft';
    await pw.skipIfNoLicense();

    const {user} = await pw.initSetup();
    const {page} = await pw.testBrowser.login(user);
    const channelPage = new pages.ChannelsPage(page);
    const scheduledDraftPage = new pages.ScheduledDraftPage(page);

    await setupChannelPage(channelPage, draftMessage);
    await scheduleMessage(channelPage);
    const scheduledDraftChannelInfo = await channelPage.centerView.scheduledDraftChannelInfoMessageText.innerText();

    await verifyscheduledDrafts(channelPage, pages, draftMessage, scheduledDraftChannelInfo);

    await scheduledDraftPage.sendScheduledMessage(draftMessage);

    await expect(scheduledDraftPage.scheduledDraftPanel(draftMessage)).not.toBeVisible();

    // Verify message has arrived
    await expect(channelPage.centerView.scheduledDraftChannelInfoMessage).not.toBeVisible();
    await expect(channelPage.sidebarLeft.scheduledDraftCountonLHS).not.toBeVisible();
    await expect(await channelPage.getLastPost()).toHaveText(draftMessage);
});

test.fixme('MM-T5643_3 should create a scheduled message from a DM', async ({pw, pages}) => {
    test.setTimeout(120000);

    const draftMessage = 'Scheduled Draft';
    // # Skip test if no license
    await pw.skipIfNoLicense();

    const {user, team} = await pw.initSetup();
    const {user: user2} = await pw.initSetup();

    const {page} = await pw.testBrowser.login(user);
    const channelPage = new pages.ChannelsPage(page);
    const scheduledDraftPage = new pages.ScheduledDraftPage(page);

    await setupChannelPage(channelPage, draftMessage, team.name, `@${user2.username}`);
    await scheduleMessage(channelPage);

    await channelPage.centerView.verifyscheduledDraftChannelInfo();

    const scheduledDraftChannelInfo = await channelPage.centerView.scheduledDraftChannelInfoMessageText.innerText();

    await verifyscheduledDrafts(channelPage, pages, draftMessage, scheduledDraftChannelInfo);

    // # Hover and verify options
    await scheduledDraftPage.verifyOnHoverActionItems(draftMessage);

    // # Go back and wait for message to arrive
    await goBackToChannelAndWaitForMessageToArrive(page);

    // * Verify the message has been sent and there's no more scheduled messages
    await expect(channelPage.centerView.scheduledDraftChannelInfoMessage).not.toBeVisible();
    await expect(channelPage.sidebarLeft.scheduledDraftCountonLHS).not.toBeVisible();
    await expect(await channelPage.getLastPost()).toHaveText(draftMessage);

    await verifyNoscheduledDraftsPending(channelPage, team, scheduledDraftPage, draftMessage);
});

test('MM-T5648 should create a draft and then schedule it', async ({pw, pages}) => {
    test.setTimeout(120000);

    const draftMessage = 'Draft to be Scheduled';
    await pw.skipIfNoLicense();

    const {user, team} = await pw.initSetup();
    const {page} = await pw.testBrowser.login(user);
    const channelPage = new pages.ChannelsPage(page);

    // await setupChannelPage(channelPage, draftMessage);
    await channelPage.goto();
    await channelPage.toBeVisible();
    await channelPage.centerView.postCreate.writeMessage(draftMessage);

    // go to drafts page
    const draftsPage = new pages.DraftPage(page);
    await draftsPage.goTo(team.name);
    await draftsPage.toBeVisible();
    await draftsPage.assertBadgeCountOnTab('1');
    await draftsPage.assertDraftBody(draftMessage);
    await draftsPage.verifyScheduleIcon(draftMessage);
    await draftsPage.openScheduleModal(draftMessage);

    // # Reschedule it to 2 days from today
    await channelPage.scheduledDraftModal.selectDay(2);
    await channelPage.scheduledDraftModal.confirm();

    const scheduledDraftPage = new pages.ScheduledDraftPage(page);
    await scheduledDraftPage.goTo(team.name);
    await scheduledDraftPage.toBeVisible();
    await scheduledDraftPage.assertBadgeCountOnTab('1');
    await scheduledDraftPage.assertscheduledDraftBody(draftMessage);
});

test.fixme('MM-T5644 should edit scheduled message', async ({pw, pages}) => {
    test.setTimeout(120000);

    const draftMessage = 'Scheduled Draft';
    // # Skip test if no license
    await pw.skipIfNoLicense();

    const {user, team} = await pw.initSetup();
    const {page} = await pw.testBrowser.login(user);
    const channelPage = new pages.ChannelsPage(page);
    const scheduledDraftPage = new pages.ScheduledDraftPage(page);

    await setupChannelPage(channelPage, draftMessage);
    await scheduleMessage(channelPage);

    await channelPage.centerView.verifyscheduledDraftChannelInfo();

    const scheduledDraftChannelInfo = await channelPage.centerView.scheduledDraftChannelInfoMessageText.innerText();

    await verifyscheduledDrafts(channelPage, pages, draftMessage, scheduledDraftChannelInfo);

    // # Hover and verify options
    await scheduledDraftPage.verifyOnHoverActionItems(draftMessage);

    const updatedText = 'updated text';
    await scheduledDraftPage.editText(updatedText);

    // # Go back and wait for message to arrive
    await goBackToChannelAndWaitForMessageToArrive(page);

    // * Verify the message has been sent and there's no more scheduled messages
    await expect(channelPage.centerView.scheduledDraftChannelInfoMessage).not.toBeVisible();
    await expect(channelPage.sidebarLeft.scheduledDraftCountonLHS).not.toBeVisible();
    await expect(await channelPage.getLastPost()).toHaveText(draftMessage);

    await verifyNoscheduledDraftsPending(channelPage, team, scheduledDraftPage, draftMessage);
});

test.fixme('MM-T5650 should copy scheduled message', async ({pw, pages, browserName}) => {
    test.setTimeout(120000);

    // Skip this test in Firefox clipboard permissions are not supported
    test.skip(browserName === 'firefox', 'Test not supported in Firefox');

    const draftMessage = 'Scheduled Draft';
    // # Skip test if no license
    await pw.skipIfNoLicense();

    const {user} = await pw.initSetup();
    const {page, context} = await pw.testBrowser.login(user);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    const channelPage = new pages.ChannelsPage(page);
    const scheduledDraftPage = new pages.ScheduledDraftPage(page);

    await setupChannelPage(channelPage, draftMessage);
    await scheduleMessage(channelPage);

    await channelPage.centerView.verifyscheduledDraftChannelInfo();

    const scheduledDraftChannelInfo = await channelPage.centerView.scheduledDraftChannelInfoMessageText.innerText();

    await verifyscheduledDrafts(channelPage, pages, draftMessage, scheduledDraftChannelInfo);

    await scheduledDraftPage.copyScheduledMessage(draftMessage);

    await page.goBack();

    await channelPage.centerView.postCreate.input.focus();

    await page.keyboard.down('Meta');
    await page.keyboard.press('V');
    await page.keyboard.up('Meta');

    // * Assert the message typed is same as the copied message
    await expect(channelPage.centerView.postCreate.input).toHaveText(draftMessage);
});

async function verifyNoscheduledDraftsPending(
    channelPage: ChannelsPage,
    team: any,
    scheduledDraftPage: ScheduledDraftPage,
    draftMessage: string,
): Promise<void> {
    await channelPage.goto(team.name, 'scheduled_posts');
    await expect(scheduledDraftPage.scheduledDraftPanel(draftMessage)).not.toBeVisible();
    await expect(scheduledDraftPage.noscheduledDraftIcon).toBeVisible();
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

async function setupChannelPage(
    channelPage: ChannelsPage,
    draftMessage: string,
    teamName?: string,
    channelName?: string,
): Promise<void> {
    await channelPage.goto(teamName, channelName);
    await channelPage.toBeVisible();

    await channelPage.centerView.postCreate.writeMessage(draftMessage);
    await channelPage.centerView.postCreate.clickOnScheduleDraftDropdownButton();
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
async function verifyscheduledDrafts(
    channelPage: ChannelsPage,
    pages: any,
    draftMessage: string,
    scheduledDraftChannelInfo: string,
): Promise<void> {
    const scheduledDraftPage = new pages.ScheduledDraftPage(channelPage.page);

    await verifyscheduledDraftCount(channelPage, '1');
    await scheduledDraftPage.toBeVisible();
    await scheduledDraftPage.assertBadgeCountOnTab('1');
    await scheduledDraftPage.assertscheduledDraftBody(draftMessage);

    const scheduledDraftPageInfo = await scheduledDraftPage.getTimeStampOfMessage(draftMessage);
    await compareMessageTimestamps(scheduledDraftChannelInfo, scheduledDraftPageInfo, scheduledDraftPage);
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
