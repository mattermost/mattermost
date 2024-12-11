// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@e2e-support/test_fixture';

test('MM-T5139: Message Priority - Standard message priority and system setting', async ({pw, pages}) => {
    // # Setup test environment
    const {user} = await pw.initSetup();
    
    // # Log in as a user in new browser context
    const {page} = await pw.testBrowser.login(user);

    // # Visit default channel page
    const channelPage = new pages.ChannelsPage(page);
    await channelPage.goto();
    await channelPage.toBeVisible();

    // # Verify formatting bar has message priority icon
    await expect(channelPage.centerView.postCreate.priorityButton).toBeVisible();

    // # Click on the message priority icon and verify menu
    await channelPage.centerView.postCreate.openPriorityMenu();
    
    // # Verify menu opens with correct header
    const priorityDialog = page.getByRole('dialog');
    await expect(priorityDialog).toBeVisible();
    const menuHeader = priorityDialog.locator('h4.modal-title');
    await expect(menuHeader).toHaveText('Message priority');

    // # Verify Standard option is selected by default
    const standardOption = priorityDialog.getByRole('menuitem', { name: 'Standard' });
    await expect(standardOption).toBeVisible();
    await expect(standardOption.locator('svg.StyledCheckIcon-dFKfoY')).toBeVisible();

    // # Close menu and post message
    await page.getByRole('button', { name: 'Cancel' }).click();
    const testMessage = 'This is just a test message';
    await channelPage.postMessage(testMessage);

    // # Verify message posts without priority label
    const lastPost = await channelPage.centerView.getLastPost();
    await lastPost.toBeVisible();
    await lastPost.toContainText(testMessage);
    await expect(lastPost.container.locator('.post-priority')).not.toBeVisible();

    // # Open post in RHS and verify
    await lastPost.container.click();
    await channelPage.sidebarRight.toBeVisible();
    
    // # Get RHS post and verify content
    const rhsPost = await channelPage.sidebarRight.getLastPost();
    await rhsPost.toBeVisible();
    await rhsPost.toContainText(testMessage);
    await expect(rhsPost.container.locator('.post-priority')).not.toBeVisible();

    // # Verify RHS formatting bar doesn't have priority button
    await expect(channelPage.sidebarRight.postCreate.priorityButton).not.toBeVisible();
});
