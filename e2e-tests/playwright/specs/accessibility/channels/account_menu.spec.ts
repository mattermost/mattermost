// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, ChannelsPage} from '@mattermost/playwright-lib';

/**
 * @objective Verify that the user account menu passes automated accessibility checks
 */
test('scans user account menu for automated accessibility violations', {tag: '@accessibility'}, async ({pw, axe}) => {
    // # Create and sign in a new user
    const {user} = await pw.initSetup();
    const {page, channelsPage} = await pw.testBrowser.login(user);

    // # Visit a default channel page
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Click on the account menu button
    await channelsPage.globalHeader.accountMenuButton.click();

    // # Analyze the page
    const accessibilityScanResults = await axe
        .builder(page, {disableColorContrast: true})
        .include(channelsPage.userAccountMenu.getContainerId())
        .analyze();

    // * Should have no violation
    expect(accessibilityScanResults.violations).toHaveLength(0);
});

/**
 * @objective Verify that the user account menu has correct ARIA structure and roles
 */
test('matches user account menu ARIA structure snapshot', {tag: '@accessibility'}, async ({pw}) => {
    // # Create and sign in a new user
    const {user} = await pw.initSetup();
    const {channelsPage} = await pw.testBrowser.login(user);

    // # Visit a default channel page
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Click on the account menu button
    await channelsPage.globalHeader.accountMenuButton.click();

    // * Verify account menu is visible
    await channelsPage.userAccountMenu.toBeVisible();

    await expect(channelsPage.userAccountMenu.container).toMatchAriaSnapshot(`
      - menu:
        - menuitem "${user.first_name} ${user.last_name} @${user.username}"
        - separator
        - menuitem "Set custom status"
        - separator
        - menuitem "Online"
        - menuitem "Away"
        - menuitem "Do not disturb Disables all notifications":
          - img
          - text: Do not disturb Disables all notifications
          - img
        - menuitem "Offline"
        - separator
        - menuitem "Profile"
        - separator
        - menuitem "Log out"
    `);
});

/**
 * @objective Verify that user account menu can be navigated with keyboard after opening with mouse
 */
test('navigates user account menu with keyboard after opening with mouse', {tag: '@accessibility'}, async ({pw}) => {
    // # Create and sign in a new user
    const {user} = await pw.initSetup();
    const {channelsPage} = await pw.testBrowser.login(user);

    // # Visit a default channel page
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Click on the account menu button
    await channelsPage.globalHeader.accountMenuButton.click();

    // * Verify account menu keyboard navigation: initial focus, scrolling up/down, submenu access, wrap-around behavior, submenu/menu closing, and return focus
    await testMenuWithKeyboard(user.username, channelsPage);
});

/**
 * @objective Verify that user account menu can be navigated with keyboard after opening with keyboard
 */
test('navigates user account menu with keyboard after opening with keyboard', {tag: '@accessibility'}, async ({pw}) => {
    // # Create and sign in a new user
    const {user} = await pw.initSetup();
    const {page, channelsPage} = await pw.testBrowser.login(user);

    // # Visit a default channel page
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Focus the account menu button and press space to open
    await channelsPage.globalHeader.accountMenuButton.focus();
    await expect(channelsPage.globalHeader.accountMenuButton).toBeFocused();
    await page.keyboard.press('Space');

    // * Verify account menu keyboard navigation: initial focus, scrolling up/down, submenu access, wrap-around behavior, submenu/menu closing, and return focus
    await testMenuWithKeyboard(user.username, channelsPage);
});

/**
 * @objective Verify that user account menu integrates properly with tab navigation sequence
 */
test('integrates user account menu with tab navigation sequence', {tag: '@accessibility'}, async ({pw}) => {
    // # Create and sign in a new user
    const {user} = await pw.initSetup();
    const {page, channelsPage} = await pw.testBrowser.login(user);

    // # Visit a default channel page
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Focus on settings button at global header
    await channelsPage.globalHeader.settingsButton.focus();

    // # Press tab to focus on account menu button
    await page.keyboard.press('Tab');

    // * Verify account menu button is focused
    await expect(channelsPage.globalHeader.accountMenuButton).toBeFocused();

    // # Press space to open account menu
    await page.keyboard.press('Space');

    // * Verify account menu is visible
    const accountMenu = channelsPage.userAccountMenu;
    await accountMenu.toBeVisible();

    // # Press escape to close account menu
    await page.keyboard.press('Escape');

    // * Verify focus is backed to account menu button
    await expect(channelsPage.globalHeader.accountMenuButton).toBeFocused();

    // # Focus on team button in sidebar left
    await channelsPage.sidebarLeft.teamButton.focus();

    // # Press shift+tab
    await page.keyboard.press('Shift+Tab');

    // * Verify focus is at account menu button
    await expect(channelsPage.globalHeader.accountMenuButton).toBeFocused();

    // # Press space to open account menu
    await page.keyboard.press('Space');

    // * Verify account menu is visible
    await accountMenu.toBeVisible();
});

/**
 * @objective Verify that user account menu handles rapid keyboard input without issues
 */
test('handles rapid key presses in user account menu', {tag: '@accessibility'}, async ({pw}) => {
    // # Create and sign in a new user
    const {user} = await pw.initSetup();
    const {page, channelsPage} = await pw.testBrowser.login(user);

    // # Visit a default channel page
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Focus the account menu button and press space to open
    await channelsPage.globalHeader.accountMenuButton.focus();
    await expect(channelsPage.globalHeader.accountMenuButton).toBeFocused();
    await page.keyboard.press('Space');

    const accountMenu = channelsPage.userAccountMenu;

    // # Press down arrow 7 times to navigate to logout button
    for (let i = 0; i < 7; i++) {
        await page.keyboard.press('ArrowDown');
    }
    // * Verify logout button is focused after rapid navigation
    await expect(accountMenu.logout).toBeFocused();

    // # Press up arrow 7 times to navigate back to username button
    for (let i = 0; i < 7; i++) {
        await page.keyboard.press('ArrowUp');
    }
    // * Verify username button is focused after rapid navigation
    await expect(accountMenu.username(user.username)).toBeFocused();
});

/**
 * @objective Verify that focusing menu items does not trigger unexpected page changes
 */
test('prevents unexpected changes when focusing user account menu items', {tag: '@accessibility'}, async ({pw}) => {
    // # Create and sign in a new user
    const {user} = await pw.initSetup();
    const {page, channelsPage} = await pw.testBrowser.login(user);

    // # Visit a default channel page
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Take a snapshot of the page
    let snapshot = await page.locator('body').ariaSnapshot();

    // # Focus on settings button at global header
    await channelsPage.globalHeader.settingsButton.focus();

    // * Verify the page matches the snapshot
    await expect(page.locator('body')).toMatchAriaSnapshot(snapshot);

    // # Press tab to focus on account menu button
    await page.keyboard.press('Tab');

    // * Verify account menu button is focused
    await expect(channelsPage.globalHeader.accountMenuButton).toBeFocused();

    // # Press space to open account menu
    await page.keyboard.press('Space');

    // * Verify account menu is visible
    const accountMenu = channelsPage.userAccountMenu;
    await accountMenu.toBeVisible();

    // # Take a snapshot of the account menu
    snapshot = await accountMenu.container.ariaSnapshot();

    // # Navigate through menu items with arrow keys
    for (let i = 0; i < 10; i++) {
        await page.keyboard.press('ArrowDown');
        // * Verify menu structure remains unchanged during navigation
        await expect(accountMenu.container).toMatchAriaSnapshot(snapshot);
    }

    // # Focus on the dnd submenu
    await channelsPage.userAccountMenu.dnd.focus();

    // # Press right arrow to open the dnd submenu
    await page.keyboard.press('ArrowRight');

    // # Take a snapshot of the dnd submenu
    snapshot = await channelsPage.dndSubMenu.container.ariaSnapshot();

    // # Navigate through submenu items with arrow keys
    for (let i = 0; i < 10; i++) {
        await page.keyboard.press('ArrowDown');
        // * Verify submenu structure remains unchanged during navigation
        await expect(channelsPage.dndSubMenu.container).toMatchAriaSnapshot(snapshot);
    }
});

/**
 * Helper function to test comprehensive keyboard navigation of the user account menu
 * @param username The username to verify in focus assertions
 * @param channelsPage The channels page object containing menu references
 */
async function testMenuWithKeyboard(username: string, channelsPage: ChannelsPage) {
    const accountMenu = channelsPage.userAccountMenu;

    // * Should start focused on the first menu item
    await expect(accountMenu.username(username)).toBeFocused();

    // * Should be able to scroll down through the menu with the keyboard
    await channelsPage.page.keyboard.press('ArrowDown');
    await expect(accountMenu.setCustomStatus).toBeFocused();
    await channelsPage.page.keyboard.press('ArrowDown');
    await expect(accountMenu.online).toBeFocused();
    await channelsPage.page.keyboard.press('ArrowDown');
    await expect(accountMenu.away).toBeFocused();
    await channelsPage.page.keyboard.press('ArrowDown');
    await expect(accountMenu.dnd).toBeFocused();
    await channelsPage.page.keyboard.press('ArrowDown');
    await expect(accountMenu.offline).toBeFocused();
    await channelsPage.page.keyboard.press('ArrowDown');
    await expect(accountMenu.profile).toBeFocused();
    await channelsPage.page.keyboard.press('ArrowDown');
    await expect(accountMenu.logout).toBeFocused();

    // * Should wrap around on menu items when you reach the end
    await channelsPage.page.keyboard.press('ArrowDown');
    await expect(accountMenu.username(username)).toBeFocused();
    await channelsPage.page.keyboard.press('ArrowUp');
    await expect(accountMenu.logout).toBeFocused();

    // * Should be able to scroll back up through the menu with the keyboard
    await channelsPage.page.keyboard.press('ArrowUp');
    await expect(accountMenu.profile).toBeFocused();
    await channelsPage.page.keyboard.press('ArrowUp');
    await expect(accountMenu.offline).toBeFocused();
    await channelsPage.page.keyboard.press('ArrowUp');
    await expect(accountMenu.dnd).toBeFocused();

    // * Should be able to move into the submenu by pressing the right arrow
    const dndSubMenu = channelsPage.dndSubMenu;
    await channelsPage.page.keyboard.press('ArrowRight');
    await expect(dndSubMenu.dontClear).toBeFocused();

    // * Should be able to scroll through the submenu with the keyboard
    await channelsPage.page.keyboard.press('ArrowDown');
    await expect(dndSubMenu.after30mins).toBeFocused();
    await channelsPage.page.keyboard.press('ArrowDown');
    await expect(dndSubMenu.after1hour).toBeFocused();
    await channelsPage.page.keyboard.press('ArrowDown');
    await expect(dndSubMenu.after2hours).toBeFocused();
    await channelsPage.page.keyboard.press('ArrowDown');
    await expect(dndSubMenu.afterTomorrow).toBeFocused();
    await channelsPage.page.keyboard.press('ArrowDown');
    await expect(dndSubMenu.chooseDateAndTime).toBeFocused();

    // * Should wrap around on submenu items when you reach the end
    await channelsPage.page.keyboard.press('ArrowDown');
    await expect(dndSubMenu.dontClear).toBeFocused();
    await channelsPage.page.keyboard.press('ArrowUp');
    await expect(dndSubMenu.chooseDateAndTime).toBeFocused();

    // * Should be able to close the submenu by pressing the left arrow
    await channelsPage.page.keyboard.press('ArrowLeft');
    await expect(accountMenu.dnd).toBeFocused();

    // * Should be able to close the menu by pressing escape
    await channelsPage.page.keyboard.press('Escape');
    await expect(accountMenu.container).not.toBeVisible();

    // * Verify focus returns to the menu button
    await expect(channelsPage.globalHeader.accountMenuButton).toBeFocused();
}
