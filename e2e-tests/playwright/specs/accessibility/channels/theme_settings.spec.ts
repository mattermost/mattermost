// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

test('Theme settings should be keyboard accessible', async ({axe, pw}) => {
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
    let accessibilityScanResults = await ab.analyze();
    expect(accessibilityScanResults.violations).toHaveLength(0);

    // # Open display tab
    await app.userSettingsModal.container.focus();
    await app.userSettingsModal.container.press('Tab', 'Tab', 'ArrowDown');

    // * The display tab should be open
    const theme = app.settings.display.section('theme');
    await expect(app.settings.panel('display')).toBeVisible();
    await expect(theme).toBeVisible();

    // * The display tab should have no accessibility violations
    accessibilityScanResults = await ab.analyze();
    expect(accessibilityScanResults.violations).toHaveLength(0);

    // # Open the theme section
    await tabs.tab('display').press('Tab', 'Space');

    // * The theme section should be open
    await expect(theme.editButton).not.toBeVisible();
    await expect(theme).toBeVisible();
    await expect(theme.saveButton).toBeVisible();

    // * The Premade Themes option should be focused
    const premade = theme.theme.option('premade');
    await expect(premade).toBeFocused();

    // * The theme section for premade themes should have no accessibility violations
    accessibilityScanResults = await ab.analyze();
    expect(accessibilityScanResults.violations).toHaveLength(0);

    // * Should be able to tab through the options
    for (const premadeTheme of ['denim', 'sapphire', 'quartz', 'indigo', 'onyx'] as const) {
        await page.keyboard.press('Tab');
        await expect(theme.premadeTheme(premadeTheme)).toBeFocused();
    }
    await page.keyboard.press('Tab');

    // Note: There's no "Apply to all your teams" option because this user is only on one team
    await expect(theme.otherThemesLink).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(theme.saveButton).toBeFocused();

    // # Go back to the premade/custom option
    await premade.focus();

    // # Switch to the custom theme section
    await page.keyboard.press('ArrowDown');

    // * The Custom Theme option should be focused
    await expect(theme.theme.option('custom')).toBeFocused();

    // * Check the ARIA of the Sidebar Styles section
    await page.keyboard.press('Tab');
    const sidebarStyles = theme.styleToggle('sidebar');
    await expect(sidebarStyles).toBeFocused();
    await expect(sidebarStyles).toHaveAttribute('aria-expanded', 'false');

    // * Check that we can tab over the collapsed section to the next section and then back again
    await page.keyboard.press('Tab');
    await expect(theme.styleToggle('center_channel')).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(sidebarStyles).toBeFocused();

    // * Check that we can expand the section
    await page.keyboard.press('Enter');
    await expect(sidebarStyles).toHaveAttribute('aria-expanded', 'true');

    // # Wait for the expanding animation to be open
    await expect(theme.stylePanel('sidebar')).toHaveCSS('overflow-y', 'visible');

    // * Check that we can tab through color pickers
    // The choosers are keyed by their position among the theme's elements: Sidebar BG, Sidebar Text, Sidebar Header BG.
    for (const position of [0, 1, 2]) {
        await page.keyboard.press('Tab');
        await expect(theme.color(position).valueTextbox).toBeFocused();
    }

    // * The theme section for custom themes should have no accessibility violations
    accessibilityScanResults = await ab.analyze();
    expect(accessibilityScanResults.violations).toHaveLength(0);
});
