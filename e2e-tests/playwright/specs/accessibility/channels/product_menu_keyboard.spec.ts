// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

import {expect, test, type App} from '@mattermost/playwright-lib';

test('MM-55271 should be able to navigate the product menu with the keyboard after opening it with the mouse', async ({
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

    // # Click on the product menu button
    await app.globalHeader.productMenu.container.clickTo(app.globalHeader.productMenu.channelsMenuItem);

    await testProductMenuWithKeyboard(app, page);
});

test('MM-55271 should be able to navigate the product menu with the keyboard after opening it with the keyboard', async ({
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

    // # Focus the product menu button and open it with the keyboard
    await app.globalHeader.productMenu.container.focus();
    await expect(app.globalHeader.productMenu.container).toBeFocused();
    await app.globalHeader.productMenu.container.pressTo('Space', app.globalHeader.productMenu.channelsMenuItem);

    await testProductMenuWithKeyboard(app, page);
});

test('MM-55271 should be able to select a product menu item with the keyboard', async ({pw}) => {
    // # Create and sign in a new user
    const {user, team} = await pw.initSetup();

    // # Log in a user in new browser context
    const {app, page} = await pw.testBrowser.login(user);

    // # Visit a default channel page
    await app.teamPage.goto({team});
    await expect(app.center.composer).toBeVisible();
    await expect(app.center.postCreate.message.container).toBeVisible();

    // # Open the product menu with the keyboard
    await app.globalHeader.productMenu.container.focus();
    await page.keyboard.press('Enter');
    await expect(app.globalHeader.productMenu.channelsMenuItem).toBeVisible();

    // * Should start focused on Channels, the first item
    await expect(app.globalHeader.productMenu.channelsMenuItem).toBeFocused();

    // The popup has no generated root; identify it by the declared Channels item before it closes.
    const menu = page.getByRole('menu', {name: 'Product menu'});
    await expect(menu).toBeVisible();

    // # Select the focused item with the keyboard
    await page.keyboard.press('Enter');

    // * Should close the menu and stay on the channels product
    await expect(menu.getByRole('menuitem')).toHaveCount(0);
    await expect(app.globalHeader.productMenu.container).toHaveAttribute('aria-expanded', 'false');
    await expect(app.center.composer).toBeVisible();
    await expect(app.center.postCreate.message.container).toBeVisible();
});

async function testProductMenuWithKeyboard(app: App, page: Page) {
    await expect(app.globalHeader.productMenu.channelsMenuItem).toBeVisible();

    // The popup has no generated root; anchor its ordered items to the declared Channels item.
    const menu = page.getByRole('menu', {name: 'Product menu'});
    await expect(menu).toBeVisible();
    const menuItems = menu.getByRole('menuitem');

    // * Should start focused on Channels, which is always the first item
    await expect(app.globalHeader.productMenu.channelsMenuItem).toBeFocused();
    await expect(menuItems.first()).toBeFocused();

    // The items after Channels depend on the licence, permissions and installed
    // products, so walk whatever is rendered rather than a fixed list.
    const itemCount = await menuItems.count();
    expect(itemCount).toBeGreaterThan(1);

    // * Should move focus down through every item in order
    for (let index = 1; index < itemCount; index++) {
        await page.keyboard.press('ArrowDown');
        await expect(menuItems.nth(index)).toBeFocused();
    }

    // * Should wrap around to the first item at the end of the list
    await page.keyboard.press('ArrowDown');
    await expect(menuItems.first()).toBeFocused();

    // * Should wrap around to the last item when moving back up from the first
    await page.keyboard.press('ArrowUp');
    await expect(menuItems.last()).toBeFocused();

    // * Should jump to the first and last items with Home and End
    await page.keyboard.press('Home');
    await expect(menuItems.first()).toBeFocused();
    await page.keyboard.press('End');
    await expect(menuItems.last()).toBeFocused();

    // * Should be able to close the menu by pressing escape
    await page.keyboard.press('Escape');
    await expect(menuItems).toHaveCount(0);
    await expect(app.globalHeader.productMenu.container).toHaveAttribute('aria-expanded', 'false');

    // * Should be focused back on the menu button
    await expect(app.globalHeader.productMenu.container).toBeFocused();
}
