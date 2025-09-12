// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

test('Focus on opening and closing dialog on key press', async ({pw}) => {
    // # Create and sign in a new user
    const {user} = await pw.initSetup();

    // # Log in a user in new browser context
    const {page, channelsPage} = await pw.testBrowser.login(user);

    // # Visit a default channel page
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Set focus to Settings button and press Enter
    await channelsPage.globalHeader.settingsButton.focus();
    await page.keyboard.press('Enter');

    // * Settings modal should be visible and focus should be on the modal
    await expect(channelsPage.settingsModal.container).toBeVisible();
    await expect(channelsPage.settingsModal.container).toBeFocused();

    // # Press Tab and verify focus is on Close button
    await page.keyboard.press('Tab');
    await expect(channelsPage.settingsModal.closeButton).toBeFocused();

    // # Press Enter and verify Settings modal is closed and focus is back on Settings button
    await page.keyboard.press('Enter');
    await expect(channelsPage.settingsModal.container).not.toBeVisible();
    await expect(channelsPage.globalHeader.settingsButton).toBeFocused();

    // # Open Settings modal again
    await page.keyboard.press('Enter');
    await expect(channelsPage.settingsModal.container).toBeVisible();

    // # Press Escape and verify Settings modal is closed and focus is back on Settings button
    await page.keyboard.press('Escape');
    await expect(channelsPage.settingsModal.container).not.toBeVisible();
    await expect(channelsPage.globalHeader.settingsButton).toBeFocused();
});
