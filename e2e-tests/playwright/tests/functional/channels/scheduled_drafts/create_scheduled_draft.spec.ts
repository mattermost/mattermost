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
    
    await expect(page).toHaveURL(/.*scheduled_posts/);

    await channelPage.sidebarLeft.verifyScheduledMessageCountLHS();


    // const scheduledMessageBody = page.locator('div.post__body')
    // await expect(scheduledMessageBody).toBeVisible();
    // await expect(scheduledMessageBody).toHaveText(draftMessage);
    // const scheduledMessagePageInfo = await page.locator('span:has-text("Send on")').innerText();

    // // Extract the relevant date and time (e.g., "Today at 10:45 PM")
    // const firstElementMatch = scheduledMessageChannelInfo.match(/(Today|Tomorrow) at \d{1,2}:\d{2} [APM]{2}/);
    // const secondElementMatch = scheduledMessagePageInfo.match(/(Today|Tomorrow) at \d{1,2}:\d{2} [APM]{2}/);

    // // Ensure both elements have matched the expected pattern
    // if (!firstElementMatch || !secondElementMatch) {
    //     throw new Error('Could not extract date and time from one or both elements.');
    // }

    // const firstElementTime = firstElementMatch[0];
    // const secondElementTime = secondElementMatch[0];

    // // Compare the extracted date and time parts
    // expect(firstElementTime).toBe(secondElementTime);

    // // Hover and verify options
    // const panelElement = page.locator('article.Panel');
    // await panelElement.hover();

    // // Verify the 'trash-can' icon is visible and hover over it
    // const deleteIcon = page.locator('#draft_icon-trash-can-outline_delete');
    // await expect(deleteIcon).toBeVisible();
    // await deleteIcon.hover();

    // // Verify the tooltip for the 'trash-can' icon
    // const deleteTooltip = page.locator('text=Delete scheduled post');
    // await expect(deleteTooltip).toBeVisible();

    // // Verify the 'reschedule' icon is visible and hover over it
    // const rescheduleIcon = page.locator('#draft_icon-clock-send-outline_reschedule');
    // await expect(rescheduleIcon).toBeVisible();
    // await rescheduleIcon.hover();

    // // Verify the tooltip for the 'reschedule' icon
    // const rescheduleTooltip = page.locator('text=Reschedule post');
    // await expect(rescheduleTooltip).toBeVisible();

    // // Go back and wait for message to arrive
    // await page.goBack();
    // await wait(duration.half_min);
    // await page.reload();

    // await expect(messageLocator).not.toBeVisible();
    // await expect(scheduledCountbadge).not.toBeVisible();

    // const lastPostText = page.locator('div.post-message__text').last();
    // lastPostText.isVisible();
    // await expect(lastPostText).toHaveText(draftMessage);

    // await page.goForward();
    // expect(panelElement).not.toBeVisible();
});

