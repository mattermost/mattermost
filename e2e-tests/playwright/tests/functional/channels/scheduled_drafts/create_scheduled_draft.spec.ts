import {expect} from '@playwright/test';
import {test} from '@e2e-support/test_fixture';
import {duration, wait} from '@e2e-support/util';

test('Should create a scheduled draft from a channel', async ({pw, pages}) => {
    test.setTimeout(120000);

    const draftMessage = 'Scheduled Draft';
    // # Skip test if no license
    await pw.skipIfNoLicense();

    const {user} = await pw.initSetup();

    // # Log in as a user in new browser context
    const {page} = await pw.testBrowser.login(user);

    // # Visit default channel page
    const channelPage = new pages.ChannelsPage(page);
    await channelPage.goto();
    await channelPage.toBeVisible();

    await channelPage.centerView.postCreate.writeMessage(draftMessage);
    await channelPage.centerView.postCreate.clickOnScheduleDraftDropdownButton();

    await channelPage.scheduledDraftDropdown.toBeVisible();
    await channelPage.scheduledDraftDropdown.selectCustomTime();

    await channelPage.scheduledDraftModal.toBeVisible();
    await channelPage.scheduledDraftModal.selectDay();
    await channelPage.scheduledDraftModal.selectTime();
    await channelPage.scheduledDraftModal.confirm();

    await channelPage.centerView.verifyScheduledMessageChannelInfo();

    const scheduledMessageChannelInfo = await channelPage.centerView.scheduledMessageChannelInfoMessageText.innerText();

    await channelPage.centerView.clickOnSeeAllScheduledMessages();
    await channelPage.sidebarLeft.assertScheduledMessageCountLHS('1');

    const scheduledMessagePage = new pages.ScheduledMessagePage(page);
    await scheduledMessagePage.toBeVisible();
    await scheduledMessagePage.assertBadgeCountOnTab('1');

    await scheduledMessagePage.assertScheduledMessageBody(draftMessage);

    const scheduledMessagePageInfo = await scheduledMessagePage.scheduledMessagePageInfo.innerHTML();

    // # Verify time shown in channel is same as that shown in the scheduled tab
    const timeInChannel = scheduledMessageChannelInfo.match(scheduledMessagePage.datePattern);
    const timeInSchedulePage = scheduledMessagePageInfo
        .replace(/<\/?[^>]+(>|$)/g, '')
        .match(scheduledMessagePage.datePattern);

    // # Ensure both elements have matched the expected pattern
    if (!timeInChannel || !timeInSchedulePage) {
        throw new Error('Could not extract date and time from one or both elements.');
    }

    const firstElementTime = timeInChannel[0];
    const secondElementTime = timeInSchedulePage[0];

    // # Compare the extracted date and time parts
    expect(firstElementTime).toBe(secondElementTime);

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
    await expect(scheduledMessagePage.scheduledMessagePanel(draftMessage)).not.toBeVisible();
});
