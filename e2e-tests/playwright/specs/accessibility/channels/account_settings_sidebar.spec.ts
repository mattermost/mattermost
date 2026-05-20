// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

test('Settings sidebar should be keyboard accessible', async ({axe, pw}) => {
    const {user} = await pw.initSetup();

    // # Log in as a user in new browser context
    const {page, channelsPage} = await pw.testBrowser.login(user);

    // # Initialize Axe
    const ab = axe.builder(page).disableRules([
        'color-contrast',

        // Known issue: These fail due to the way we've grouped plugin setting tabs together in the LHS
        'aria-required-children',
        'aria-required-parent',
    ]);

    // # Visit default channel page
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Open settings modal
    const settingsModal = await channelsPage.globalHeader.openSettings();

    // * The settings modal should have no accessibility violations
    const accessibilityScanResults = await ab.analyze();
    expect(accessibilityScanResults.violations).toHaveLength(0);

    // # Focus the sidebar
    await settingsModal.container.focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // * The Notifications tab should start focused
    await expect(page.getByRole('tab', {name: 'Notifications'})).toBeFocused();
    await expect(page.getByText('Desktop and mobile notifications')).toBeVisible();

    // * Pressing the down arrow should focus and show the Display tab
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('tab', {name: 'Display'})).toBeFocused();
    await expect(page.getByText('Theme', {exact: true})).toBeVisible();

    // * Pressing the down arrow should focus and show the Sidebar tab
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('tab', {name: 'Sidebar'})).toBeFocused();
    await expect(page.getByText('Group unread channels separately')).toBeVisible();

    // * Pressing the down arrow should focus and show the Advanced tab
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('tab', {name: 'Advanced'})).toBeFocused();
    await expect(page.getByText('Enable Post Formatting')).toBeVisible();

    // * Pressing the up arrow should go back through the tabs
    await page.keyboard.press('ArrowUp');
    await expect(page.getByRole('tab', {name: 'Sidebar'})).toBeFocused();
    await expect(page.getByText('Group unread channels separately')).toBeVisible();

    await page.keyboard.press('ArrowUp');
    await expect(page.getByRole('tab', {name: 'Display'})).toBeFocused();
    await expect(page.getByText('Theme', {exact: true})).toBeVisible();

    await page.keyboard.press('ArrowUp');
    await expect(page.getByRole('tab', {name: 'Notifications'})).toBeFocused();
    await expect(page.getByText('Desktop and mobile notifications')).toBeVisible();
});
