// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Capture snapshots of settings modal and key focused elements on keyboard navigation
 */
test(
    'settings modal visual check',
    {tag: ['@visual', '@settings', '@snapshots']},
    async ({pw, browserName, viewport}, testInfo) => {
        // # Create and sign in a new user
        const {user} = await pw.initSetup();

        // # Log in a user in new browser context
        const {page, channelsPage} = await pw.testBrowser.login(user);
        const globalHeader = channelsPage.globalHeader;
        const settingsModal = channelsPage.settingsModal;

        // # Visit a default channel page
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        // # Set focus to Settings button and press Enter
        await globalHeader.settingsButton.focus();
        await page.keyboard.press('Enter');

        // * Settings modal should be visible and focus should be on the modal
        await expect(settingsModal.container).toBeVisible();
        await pw.toBeFocusedWithFocusVisible(settingsModal.container);

        const testArgs = {page, browserName, viewport};
        await pw.hideDynamicChannelsContent(page);
        await pw.matchSnapshot(
            {...testInfo, title: `${testInfo.title}`},
            {...testArgs, locator: settingsModal.content},
        );

        // # Press Tab to move focus to Close button
        await page.keyboard.press('Tab');
        // * Verify focus is on Close button
        await pw.toBeFocusedWithFocusVisible(settingsModal.closeButton);
        await pw.matchSnapshot(
            {...testInfo, title: `${testInfo.title} close button`},
            {...testArgs, locator: settingsModal.content},
        );

        // # Press Tab to move focus to Notifications tab
        await page.keyboard.press('Tab');
        // * Verify focus is on Notifications tab and Notifications Settings panel is visible
        await pw.toBeFocusedWithFocusVisible(settingsModal.notificationsTab);
        await pw.matchSnapshot(
            {...testInfo, title: `${testInfo.title} notifications tab`},
            {...testArgs, locator: settingsModal.content},
        );

        // # Press arrow down key to move focus to Display tab
        await page.keyboard.press('ArrowDown');
        // * Verify focus is on Display tab and Display Settings panel is visible
        await pw.toBeFocusedWithFocusVisible(settingsModal.displayTab);
        await pw.matchSnapshot(
            {...testInfo, title: `${testInfo.title} display tab`},
            {...testArgs, locator: settingsModal.content},
        );

        // # Press arrow down key to move focus to Sidebar tab
        await page.keyboard.press('ArrowDown');
        // * Verify focus is on Sidebar tab and Sidebar Settings panel is visible
        await pw.toBeFocusedWithFocusVisible(settingsModal.sidebarTab);
        await pw.matchSnapshot(
            {...testInfo, title: `${testInfo.title} sidebar tab`},
            {...testArgs, locator: settingsModal.content},
        );

        // # Press arrow down key to move focus to Advanced tab
        await page.keyboard.press('ArrowDown');
        // * Verify focus is on Advanced tab and Advanced Settings panel is visible
        await pw.toBeFocusedWithFocusVisible(settingsModal.advancedTab);
        await pw.matchSnapshot(
            {...testInfo, title: `${testInfo.title} advanced tab`},
            {...testArgs, locator: settingsModal.content},
        );
    },
);
