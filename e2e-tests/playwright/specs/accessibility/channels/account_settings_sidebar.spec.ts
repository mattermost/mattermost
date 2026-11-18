// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

test('Settings sidebar should be keyboard accessible', async ({axe, pw}) => {
    const {user, team} = await pw.initSetup();

    // # Log in as a user in new browser context
    const {app, page} = await pw.testBrowser.login(user);

    // # Initialize Axe
    const ab = axe.builder(page).disableRules([
        'color-contrast',
        // Known issue: These fail due to the way we've grouped plugin setting tabs together in the LHS
        'aria-required-children',
        'aria-required-parent',
    ]);

    // # Visit default channel page
    await app.teamPage.goto({team});
    await expect(app.center.composer).toBeVisible();
    await expect(app.center.postCreate.message.container).toBeVisible();

    // # Open settings modal
    await app.globalHeader.settingsButton.clickTo(app.userSettingsModal);
    const {tabs} = app.userSettingsModal;
    await expect(tabs.tab('notifications')).toBeVisible();

    // * The settings modal should have no accessibility violations
    const accessibilityScanResults = await ab.analyze();
    expect(accessibilityScanResults.violations).toHaveLength(0);

    // # Focus the sidebar
    await app.userSettingsModal.container.focus();
    await app.userSettingsModal.container.press('Tab', 'Tab');

    // A tab's own section shows that the tab is open
    const notifications = app.settings.notifications.section('desktopAndMobile');
    const display = app.settings.display.section('theme');
    const sidebar = app.settings.sidebar.section('showUnreadsCategory');
    const advanced = app.settings.advanced.section('formatting');

    // * The Notifications tab should start focused
    await expect(tabs.tab('notifications')).toBeFocused();
    await expect(notifications).toBeVisible();

    // * Pressing the down arrow should focus and show the Display tab
    await page.keyboard.press('ArrowDown');
    await expect(tabs.tab('display')).toBeFocused();
    await expect(display).toBeVisible();

    // * Pressing the down arrow should focus and show the Sidebar tab
    await page.keyboard.press('ArrowDown');
    await expect(tabs.tab('sidebar')).toBeFocused();
    await expect(sidebar).toBeVisible();

    // * Pressing the down arrow should focus and show the Advanced tab
    await page.keyboard.press('ArrowDown');
    await expect(tabs.tab('advanced')).toBeFocused();
    await expect(advanced).toBeVisible();

    // * Pressing the up arrow should go back through the tabs
    await page.keyboard.press('ArrowUp');
    await expect(tabs.tab('sidebar')).toBeFocused();
    await expect(sidebar).toBeVisible();

    await page.keyboard.press('ArrowUp');
    await expect(tabs.tab('display')).toBeFocused();
    await expect(display).toBeVisible();

    await page.keyboard.press('ArrowUp');
    await expect(tabs.tab('notifications')).toBeFocused();
    await expect(notifications).toBeVisible();
});
