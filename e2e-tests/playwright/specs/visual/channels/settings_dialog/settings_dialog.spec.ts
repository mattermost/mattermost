// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {focusVisible} from '../../../accessibility/channels/focus_support';

/**
 * @objective Capture snapshots of settings modal and key focused elements on keyboard navigation
 */
test(
    'settings modal visual check',
    {tag: ['@visual', '@settings', '@snapshots']},
    async ({pw, browserName, viewport}, testInfo) => {
        // # Create and sign in a new user
        const {user, team} = await pw.initSetup();

        // # Log in a user in new browser context
        const {app, page} = await pw.testBrowser.login(user);
        const settingsModal = app.userSettingsModal;

        // # Visit a default channel page
        await app.teamPage.goto({team});
        await expect(app.center.composer).toBeVisible();
        await expect(app.center.postCreate.message.container).toBeVisible();

        // # Set focus to Settings button and press Enter
        await app.globalHeader.settingsButton.focus();
        await page.keyboard.press('Enter');

        // * Settings modal should be visible and focus should be on the modal
        await expect(settingsModal).toBeVisible();
        await expect.poll(() => focusVisible(settingsModal)).toBe(true);

        // The snapshot helper takes a Locator for the exact modal capture boundary.
        const testArgs = {page, browserName, viewport};
        await pw.hideDynamicChannelsContent(page);
        await pw.matchSnapshot(
            {...testInfo, title: `${testInfo.title}`},
            {...testArgs, locator: settingsModal.locator},
        );

        // # Press Tab to move focus to Close button
        await page.keyboard.press('Tab');
        // * Verify focus is on Close button
        await expect.poll(() => focusVisible(settingsModal.closeButton)).toBe(true);
        await pw.matchSnapshot(
            {...testInfo, title: `${testInfo.title} close button`},
            {...testArgs, locator: settingsModal.locator},
        );

        // # Press Tab to move focus to Notifications tab
        await page.keyboard.press('Tab');
        // * Verify focus is on Notifications tab and Notifications Settings panel is visible
        await expect.poll(() => focusVisible(settingsModal.tabs.tab('notifications'))).toBe(true);
        await pw.matchSnapshot(
            {...testInfo, title: `${testInfo.title} notifications tab`},
            {...testArgs, locator: settingsModal.locator},
        );

        // # Press arrow down key to move focus to Display tab
        await page.keyboard.press('ArrowDown');
        // * Verify focus is on Display tab and Display Settings panel is visible
        await expect.poll(() => focusVisible(settingsModal.tabs.tab('display'))).toBe(true);
        await pw.matchSnapshot(
            {...testInfo, title: `${testInfo.title} display tab`},
            {...testArgs, locator: settingsModal.locator},
        );

        // # Press arrow down key to move focus to Sidebar tab
        await page.keyboard.press('ArrowDown');
        // * Verify focus is on Sidebar tab and Sidebar Settings panel is visible
        await expect.poll(() => focusVisible(settingsModal.tabs.tab('sidebar'))).toBe(true);
        await pw.matchSnapshot(
            {...testInfo, title: `${testInfo.title} sidebar tab`},
            {...testArgs, locator: settingsModal.locator},
        );

        // # Press arrow down key to move focus to Advanced tab
        await page.keyboard.press('ArrowDown');
        // * Verify focus is on Advanced tab and Advanced Settings panel is visible
        await expect.poll(() => focusVisible(settingsModal.tabs.tab('advanced'))).toBe(true);
        await pw.matchSnapshot(
            {...testInfo, title: `${testInfo.title} advanced tab`},
            {...testArgs, locator: settingsModal.locator},
        );
    },
);
