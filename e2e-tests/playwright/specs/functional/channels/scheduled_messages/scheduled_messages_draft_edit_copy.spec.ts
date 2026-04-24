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
        await verifyScheduledPost(scheduledPostsPage, {draftMessage, selectedDate, selectedTime, badgeCountOnTab: 1});
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
        await verifyScheduledPostIndicator(channelsPage.centerView.scheduledPostIndicator, selectedDate, selectedTime);

        // * Verify scheduled post badge shows count of 1
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

        // # Edit the scheduled message content
        await scheduledPost.hover();
        await scheduledPost.editButton.click();
        const updatedText = 'updated text';
        await scheduledPost.editTextBox.fill(updatedText);
        await scheduledPost.saveButton.click();

        // * Verify the edited message content is updated
        await expect(scheduledPost.panelBody).toContainText(updatedText);

        // * Verify scheduled date/time remains unchanged
        await expect(scheduledPost.panelHeader).toContainText(selectedTime);

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
        const scheduledPost = await verifyScheduledPost(scheduledPostsPage, {
            draftMessage,
            selectedDate,
            selectedTime,
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
