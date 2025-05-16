// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that standard message priority posts correctly without priority labels and functions as expected.
 */
test(
    'MM-T5139 posts message with standard priority and verifies no priority labels appear',
    {tag: '@message_priority'},
    async ({pw}) => {
        // # Setup test environment
        const {user} = await pw.initSetup();

        // # Log in as a user in new browser context
        const {channelsPage} = await pw.testBrowser.login(user);

        // # Visit default channel page
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        // # Open priority menu
        await channelsPage.centerView.postCreate.openPriorityMenu();

        // * Verify priority dialog appears with standard option selected
        await channelsPage.messagePriority.verifyPriorityDialog();
        await channelsPage.messagePriority.verifyStandardOptionSelected();

        // # Close priority menu
        await channelsPage.messagePriority.closePriorityMenu();

        // # Post a message with standard priority
        const testMessage = 'This is just a test message';
        await channelsPage.postMessage(testMessage);

        // * Verify message posts correctly with the expected text
        const lastPost = await channelsPage.getLastPost();
        await lastPost.toBeVisible();
        await lastPost.toContainText(testMessage);

        // * Verify no priority label appears on the post
        await expect(lastPost.container.locator('.post-priority')).not.toBeVisible();

        // # Open post in right-hand sidebar
        await lastPost.container.click();
        await channelsPage.sidebarRight.toBeVisible();

        // * Verify post content appears correctly in RHS
        const rhsPost = await channelsPage.sidebarRight.getLastPost();
        await rhsPost.toBeVisible();
        await rhsPost.toContainText(testMessage);

        // * Verify no priority label appears in RHS
        await expect(rhsPost.container.locator('.post-priority')).not.toBeVisible();

        // * Verify RHS formatting bar doesn't include priority button
        await expect(channelsPage.sidebarRight.postCreate.priorityButton).not.toBeVisible();
    },
);
