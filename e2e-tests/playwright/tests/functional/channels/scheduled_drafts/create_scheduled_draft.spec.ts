import {expect} from '@playwright/test';

import {test} from '@e2e-support/test_fixture';

test('MM-T5465-1 Should add the keyword when enter, comma or tab is pressed on the textbox', async ({pw, pages}) => {
    // # Skip test if no license
    await pw.skipIfNoLicense();

    const {user} = await pw.initSetup();

    // # Log in as a user in new browser context
    const {page} = await pw.testBrowser.login(user);

    // # Visit default channel page
    const channelPage = new pages.ChannelsPage(page);
    await channelPage.goto();
    await channelPage.toBeVisible();

    await channelPage.centerView.postCreate.writeMessage('Scheduled Draft');
    await channelPage.centerView.postCreate.clickOnScheduleDraftDropdownButton();

    await channelPage.scheduledDraftDropdown.toBeVisible();
    await channelPage.scheduledDraftDropdown.chooseCustomTime();

    await expect (page.locator('div.GenericModal__wrapper-enter-key-press-catcher')).toBeVisible();
    await page.locator('div.Input_wrapper').click();
   
    // DATE
    let dayText = 'Today';
    const currentDate = new Date();
    const day = currentDate.getDate();  // Get the current day of the month
    const month = currentDate.toLocaleString('default', { month: 'long' }); // Full month name

    // Check if the selected date is today, otherwise set dayText to "Tomorrow"
    const selectedDate = new Date();
    selectedDate.setDate(currentDate.getDate() + 1); // Adjust as needed

    if (selectedDate.getDate() !== currentDate.getDate()) {
        dayText = 'Tomorrow';
    }

    // Select the button based on the current day and month
    const dateButton = page.locator(`button[aria-label*='${day}th ${month}']`);
    await dateButton.click();

    // TIME
    await page.locator('div.dateTime__input').click();
    const currentTime = new Date();
    currentTime.setMinutes(currentTime.getMinutes() + 1); // Add 1 minute to the current time

    // Format the time to match the UI (e.g., "12:02 AM")
    const formattedTime = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

    // Construct the locator to select the time element by the formatted time
    const timeButton = page.locator(`span.MenuItem__primary-time:has-text("${formattedTime}")`);
    await timeButton.scrollIntoViewIfNeeded();
    await expect(timeButton).toBeVisible();
    await timeButton.click();

    // SEND
    await page.locator('button.confirm').isVisible();
    await page.locator('button.confirm').click();

    // VERIFY in CHANNEL
    const scheduledPostChannelIndicator = page.locator('div.postBoxIndicator');
    await scheduledPostChannelIndicator.isVisible();

    await page.getByTestId('scheduledPostIcon').isVisible();
    const expectedMessage = `Message scheduled for ${dayText} at ${formattedTime}`;

    // Locate the message element and verify the text
    const messageLocator = page.locator('.ScheduledPostIndicator span:has-text("Message scheduled for")');
    await expect(messageLocator).toContainText(expectedMessage);

    // Click on "See all scheduled messages"
    const seeAllMessagesLink = page.locator('a:has-text("See all scheduled messages")');
    await seeAllMessagesLink.click();

});
