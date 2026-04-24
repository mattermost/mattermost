// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {SETTINGS_PANEL_DISABLED_RULES, setupAndOpenSettingsModal} from './support';

/**
 * @objective Verify that focus is properly managed when opening and closing settings modal using keyboard interactions
 */
test(
    'manages focus when opening and closing settings modal with keyboard',
    {tag: ['@accessibility', '@settings']},
    async ({pw}) => {
        const {page, settingsModal, globalHeader} = await setupAndOpenSettingsModal(pw);

        // * Focus should be on the modal
        await pw.toBeFocusedWithFocusVisible(settingsModal.container);

        // # Press Tab and verify focus is on Close button
        await page.keyboard.press('Tab');
        await pw.toBeFocusedWithFocusVisible(settingsModal.closeButton);

        // # Press Enter and verify Settings modal is closed and focus is back on Settings button
        await page.keyboard.press('Enter');
        await expect(settingsModal.container).not.toBeVisible();
        await pw.toBeFocusedWithFocusVisible(globalHeader.settingsButton);

        // # Open Settings modal again
        await page.keyboard.press('Enter');
        await expect(settingsModal.container).toBeVisible();

        // # Press Escape and verify Settings modal is closed and focus is back on Settings button
        await page.keyboard.press('Escape');
        await expect(settingsModal.container).not.toBeVisible();
        await pw.toBeFocusedWithFocusVisible(globalHeader.settingsButton);
    },
);

/**
 * @objective Verify that users can navigate between settings tabs using arrow keys
 */
test('navigates between settings tabs using arrow keys', {tag: ['@accessibility', '@settings']}, async ({pw}) => {
    const {page, settingsModal} = await setupAndOpenSettingsModal(pw);

    // * Focus should be on the modal
    await pw.toBeFocusedWithFocusVisible(settingsModal.container);

    // # Press Tab twice and verify focus is on Notifications tab and Notifications Settings panel is visible
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(settingsModal.notificationsTab).toBeVisible();
    await pw.toBeFocusedWithFocusVisible(settingsModal.notificationsTab);
    await expect(settingsModal.notificationsSettings.container).toBeVisible();

    // # Press arrow down key and verify focus is on Display tab and Display Settings panel is visible
    await page.keyboard.press('ArrowDown');
    await pw.toBeFocusedWithFocusVisible(settingsModal.displayTab);
    await expect(settingsModal.displaySettings.container).toBeVisible();

    // # Press arrow down key and verify focus is on Sidebar tab and Sidebar Settings panel is visible
    await page.keyboard.press('ArrowDown');
    await expect(settingsModal.sidebarTab).toBeVisible();
    await pw.toBeFocusedWithFocusVisible(settingsModal.sidebarTab);
    await expect(settingsModal.sidebarSettings.container).toBeVisible();

    // # Press Tab and verify focus is on Advanced tab and Advanced Settings panel is visible
    await page.keyboard.press('ArrowDown');
    await pw.toBeFocusedWithFocusVisible(settingsModal.advancedTab);
    await expect(settingsModal.advancedSettings.container).toBeVisible();

    // # Press arrow down key and verify focus is back on Notifications tab and Notifications Settings panel is visible
    await page.keyboard.press('ArrowDown');
    await expect(settingsModal.notificationsTab).toBeVisible();
    await pw.toBeFocusedWithFocusVisible(settingsModal.notificationsTab);
    await expect(settingsModal.notificationsSettings.container).toBeVisible();

    // # Press arrow up key and verify focus is on Advanced tab and Advanced Settings panel is visible
    await page.keyboard.press('ArrowUp');
    await expect(settingsModal.advancedTab).toBeVisible();
    await pw.toBeFocusedWithFocusVisible(settingsModal.advancedTab);
    await expect(settingsModal.advancedSettings.container).toBeVisible();
});

/**
 * @objective Verify that notifications settings panel meets WCAG accessibility standards
 */
test(
    'passes accessibility scan on notifications settings panel',
    {tag: ['@accessibility', '@settings']},
    async ({pw, axe}) => {
        const {page, settingsModal} = await setupAndOpenSettingsModal(pw);

        // * Notifications panel should be visible
        await expect(settingsModal.notificationsSettings.container).toBeVisible();

        // * Analyze the Settings modal with notifications panel
        const accessibilityScanResults = await axe
            .builder(page, {disableColorContrast: true})
            .disableRules(SETTINGS_PANEL_DISABLED_RULES)
            .include(settingsModal.getContainerId())
            .analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);
