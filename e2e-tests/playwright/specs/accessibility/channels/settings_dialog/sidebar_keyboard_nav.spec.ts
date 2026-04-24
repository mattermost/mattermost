// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

import {setupAndOpenSettingsModal} from './support';

/**
 * @objective Verify keyboard navigation works correctly through all interactive elements in the Sidebar settings panel
 */
test(
    'navigate on keyboard tab between interactive elements',
    {tag: ['@accessibility', '@settings', '@sidebar_settings']},
    async ({pw}) => {
        const {page, settingsModal} = await setupAndOpenSettingsModal(pw);
        const sidebarSettings = settingsModal.sidebarSettings;

        // * Focus should be on the modal
        await pw.toBeFocusedWithFocusVisible(settingsModal.container);

        // # Press Tab and verify focus is on Close button
        await page.keyboard.press('Tab');
        await pw.toBeFocusedWithFocusVisible(settingsModal.closeButton);

        // # Press Tab to move focus to Notifications tab
        await page.keyboard.press('Tab');
        await pw.toBeFocusedWithFocusVisible(settingsModal.notificationsTab);

        // # Press ArrowDown to navigate to Display tab
        await page.keyboard.press('ArrowDown');
        await pw.toBeFocusedWithFocusVisible(settingsModal.displayTab);

        // # Press ArrowDown to navigate to Sidebar tab
        await page.keyboard.press('ArrowDown');
        await pw.toBeFocusedWithFocusVisible(settingsModal.sidebarTab);

        // # Press Tab to move focus to Group unread channels separately button
        await page.keyboard.press('Tab');
        await pw.toBeFocusedWithFocusVisible(sidebarSettings.groupUnreadEditButton);

        // # Press Tab to move focus to Number of direct messages to show button
        await page.keyboard.press('Tab');
        await pw.toBeFocusedWithFocusVisible(sidebarSettings.limitVisibleDMsEditButton);
    },
);
