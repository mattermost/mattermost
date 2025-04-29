// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

test('Theme settings should be keyboard accessible', async ({axe, pw}) => {
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
    let accessibilityScanResults = await ab.analyze();
    expect(accessibilityScanResults.violations).toHaveLength(0);

    // # Open display tab
    await settingsModal.container.focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('ArrowDown');

    // * The display tab should be open
    const {displaySettings} = settingsModal;
    await displaySettings.toBeVisible();

    // * The display tab should have no accessibility violations
    accessibilityScanResults = await ab.analyze();
    expect(accessibilityScanResults.violations).toHaveLength(0);

    // # Open the theme section
    await page.keyboard.press('Tab');
    await page.keyboard.press('Space');

    // * The theme section should be open
    await displaySettings.verifySectionIsExpanded('theme');

    // * The Premade Themes option should be focused
    await expect(page.getByLabel('Premade Themes')).toBeFocused();

    // * The theme section for premade themes should have no accessibility violations
    accessibilityScanResults = await ab.analyze();
    expect(accessibilityScanResults.violations).toHaveLength(0);

    // * Should be able to tab through the options
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', {name: 'Denim'})).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', {name: 'Sapphire'})).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', {name: 'Quartz'})).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', {name: 'Indigo'})).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', {name: 'Onyx'})).toBeFocused();
    await page.keyboard.press('Tab');

    // Note: There's no "Apply to all your teams" option because this user is only on one team
    await expect(page.getByRole('link', {name: 'See other themes'})).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', {name: 'Save'})).toBeFocused();

    // # Go back to the premade/custom option
    await page.getByLabel('Premade Themes').focus();

    // # Switch to the custom theme section
    await page.keyboard.press('ArrowDown');

    // * The Custom Theme option should be focused
    await expect(page.getByLabel('Custom Theme')).toBeFocused();

    // * Check the ARIA of the Sidebar Styles section
    await page.keyboard.press('Tab');
    const sidebarStyles = page.getByRole('button', {name: 'Sidebar Styles'});
    await expect(sidebarStyles).toBeFocused();
    await expect(sidebarStyles).toHaveAttribute('aria-expanded', 'false');

    // * Check that we can tab over the collapsed section to the next section and then back again
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', {name: 'Center Channel Styles'})).toBeFocused();

    await page.keyboard.press('Shift+Tab');
    await expect(sidebarStyles).toBeFocused();

    // * Check that we can expand the section
    await page.keyboard.press('Enter');
    await expect(sidebarStyles).toHaveAttribute('aria-expanded', 'true');

    // # Wait for the expanding animation to be open
    await expect(page.getByLabel('Sidebar Styles')).toHaveCSS('overflow-y', 'visible');

    // * Check that we can tab through color pickers
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Sidebar BG', {exact: true})).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Sidebar Text', {exact: true})).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Sidebar Header BG')).toBeFocused();

    // * The theme section for custom themes should have no accessibility violations
    accessibilityScanResults = await ab.analyze();
    expect(accessibilityScanResults.violations).toHaveLength(0);
});
