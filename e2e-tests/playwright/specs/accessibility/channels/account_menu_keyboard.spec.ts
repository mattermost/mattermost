// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

import {expect, test, type App} from '@mattermost/playwright-lib';

test('MM-63451 should be able to navigate the account settings menu with the keyboard after opening it with the mouse', async ({
    pw,
}) => {
    // # Create and sign in a new user
    const {user, team} = await pw.initSetup();

    // # Log in a user in new browser context
    const {app, page} = await pw.testBrowser.login(user);

    // # Visit a default channel page
    await app.teamPage.goto({team});
    await expect(app.center.composer).toBeVisible();
    await expect(app.center.postCreate.message.container).toBeVisible();

    // # Click on the account menu button
    await app.globalHeader.openAccountMenuButton.clickTo(app.globalHeader.accountMenu.nameMenuItem);

    await testMenuWithKeyboard(app, page);
});

test('MM-63451 should be able to navigate the account settings menu with the keyboard after opening it with the keyboard', async ({
    pw,
}) => {
    // # Create and sign in a new user
    const {user, team} = await pw.initSetup();

    // # Log in a user in new browser context
    const {app, page} = await pw.testBrowser.login(user);

    // # Visit a default channel page
    await app.teamPage.goto({team});
    await expect(app.center.composer).toBeVisible();
    await expect(app.center.postCreate.message.container).toBeVisible();

    // # Focus the account menu button
    await app.globalHeader.openAccountMenuButton.focus();
    await expect(app.globalHeader.openAccountMenuButton).toBeFocused();
    await app.globalHeader.openAccountMenuButton.pressTo('Space', app.globalHeader.accountMenu.nameMenuItem);

    await testMenuWithKeyboard(app, page);
});

async function testMenuWithKeyboard(app: App, page: Page) {
    const menu = app.globalHeader.accountMenu;
    const dnd = menu.dndMenu;
    const dndTrigger = menu.dndMenuItem;

    // * Should start focused on the first menu item
    await expect(menu.nameMenuItem).toBeFocused();

    // * Should be able to scroll down through the menu with the keyboard
    await page.keyboard.press('ArrowDown');
    await expect(menu.setCustomStatusMenuItem).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(menu.onlineMenuItem).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(menu.awayMenuItem).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(dndTrigger).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(menu.offlineMenuItem).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(menu.profileMenuItem).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(menu.logOutMenuItem).toBeFocused();

    // * Should be able to scroll back up through the menu with the keyboard
    await page.keyboard.press('ArrowUp');
    await expect(menu.profileMenuItem).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(menu.offlineMenuItem).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(dndTrigger).toBeFocused();

    // * Should be able to move into the submenu by pressing the right arrow
    await page.keyboard.press('ArrowRight');
    await expect(dnd.doNotClearMenuItem).toBeFocused();

    // * Should be able to scroll through the submenu with the keyboard
    await page.keyboard.press('ArrowDown');
    await expect(dnd.thirtyMinutesMenuItem).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(dnd.oneHourMenuItem).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(dnd.twoHoursMenuItem).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(dnd.tomorrowMenuItem).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(dnd.customMenuItem).toBeFocused();

    // * Should wrap around when you reach the end
    await page.keyboard.press('ArrowDown');
    await expect(dnd.doNotClearMenuItem).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(dnd.customMenuItem).toBeFocused();

    // * Should be able to close the submenu by pressing the left arrow
    await page.keyboard.press('ArrowLeft');
    await expect(dndTrigger).toBeFocused();

    await expect(menu.container).toBeVisible();

    // * Should be able to close the menu by pressing escape
    await page.keyboard.press('Escape');
    await expect(menu.container).toBeHidden();
    await expect(app.globalHeader.openAccountMenuButton).toHaveAttribute('aria-expanded', 'false');

    // * Should be focused back on the menu button
    await expect(app.globalHeader.openAccountMenuButton).toBeFocused();
}
