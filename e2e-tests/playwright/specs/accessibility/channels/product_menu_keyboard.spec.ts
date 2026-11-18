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

    const menu = app.globalHeader.productMenu.menuList;
    await expect(menu).toBeVisible();

    // # Select the focused item with the keyboard
    await page.keyboard.press('Enter');

    // * Should close the menu and stay on the channels product
    await expect(menu).toBeHidden();
    await expect(app.globalHeader.productMenu.container).toHaveAttribute('aria-expanded', 'false');
    await expect(app.center.composer).toBeVisible();
    await expect(app.center.postCreate.message.container).toBeVisible();
});

async function testProductMenuWithKeyboard(app: App, page: Page) {
    await expect(app.globalHeader.productMenu.channelsMenuItem).toBeVisible();

    const menu = app.globalHeader.productMenu.menuList;
    await expect(menu).toBeVisible();

    // The items after Channels depend on the licence, permissions and installed products, and no single keyed part
    // spans them, so the walk reads the menu's rendered items by their role.
    // eslint-disable-next-line test-surface/e2e-no-literal-locators -- keyboard walk over every rendered menuitem, whose set varies by licence, permissions and products
    const menuItems = await menu.locator.getByRole('menuitem').all();
    expect(menuItems.length).toBeGreaterThan(1);
    const firstItem = menuItems[0];
    const lastItem = menuItems[menuItems.length - 1];

    // * Should start focused on Channels, which is always the first item
    await expect(app.globalHeader.productMenu.channelsMenuItem).toBeFocused();
    await expect(firstItem).toBeFocused();

    // * Should move focus down through every item in order
    for (const item of menuItems.slice(1)) {
        await page.keyboard.press('ArrowDown');
        await expect(item).toBeFocused();
    }

    // * Should wrap around to the first item at the end of the list
    await page.keyboard.press('ArrowDown');
    await expect(firstItem).toBeFocused();

    // * Should wrap around to the last item when moving back up from the first
    await page.keyboard.press('ArrowUp');
    await expect(lastItem).toBeFocused();

    // * Should jump to the first and last items with Home and End
    await page.keyboard.press('Home');
    await expect(firstItem).toBeFocused();
    await page.keyboard.press('End');
    await expect(lastItem).toBeFocused();

    // * Should be able to close the menu by pressing escape
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(app.globalHeader.productMenu.container).toHaveAttribute('aria-expanded', 'false');

    // * Should be focused back on the menu button
    await expect(app.globalHeader.productMenu.container).toBeFocused();
}
