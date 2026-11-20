// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

import type {ChannelsPage} from '@mattermost/playwright-lib';
import {expect, test} from '@mattermost/playwright-lib';

test('MM-55271 should be able to navigate the product menu with the keyboard after opening it with the mouse', async ({
    pw,
}) => {
    // # Create and sign in a new user
    const {user} = await pw.initSetup();

    // # Log in a user in new browser context
    const {page, channelsPage} = await pw.testBrowser.login(user);

    // # Visit a default channel page
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Click on the product menu button
    await channelsPage.globalHeader.switchProductMenuButton.click();

    await testProductMenuWithKeyboard(page, channelsPage);
});

test('MM-55271 should be able to navigate the product menu with the keyboard after opening it with the keyboard', async ({
    pw,
}) => {
    // # Create and sign in a new user
    const {user} = await pw.initSetup();

    // # Log in a user in new browser context
    const {page, channelsPage} = await pw.testBrowser.login(user);

    // # Visit a default channel page
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Focus the product menu button and open it with the keyboard
    await channelsPage.globalHeader.switchProductMenuButton.focus();
    await expect(channelsPage.globalHeader.switchProductMenuButton).toBeFocused();
    await page.keyboard.press('Space');

    await testProductMenuWithKeyboard(page, channelsPage);
});

test('MM-55271 should be able to select a product menu item with the keyboard', async ({pw}) => {
    // # Create and sign in a new user
    const {user} = await pw.initSetup();

    // # Log in a user in new browser context
    const {page, channelsPage} = await pw.testBrowser.login(user);

    // # Visit a default channel page
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Open the product menu with the keyboard
    await channelsPage.globalHeader.switchProductMenuButton.focus();
    await page.keyboard.press('Enter');
    await channelsPage.switchProductMenu.toBeVisible();

    // * Should start focused on Channels, the first item
    await expect(channelsPage.switchProductMenu.channelsMenuItem).toBeFocused();

    // # Select the focused item with the keyboard
    await page.keyboard.press('Enter');

    // * Should close the menu and stay on the channels product
    await expect(page.getByRole('menuitem')).toHaveCount(0);
    await channelsPage.toBeVisible();
});

async function testProductMenuWithKeyboard(page: Page, channelsPage: ChannelsPage) {
    await channelsPage.switchProductMenu.toBeVisible();

    const menuItems = page.getByRole('menuitem');

    // * Should start focused on Channels, which is always the first item
    await expect(channelsPage.switchProductMenu.channelsMenuItem).toBeFocused();
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
    await expect(page.getByRole('menuitem')).toHaveCount(0);

    // * Should be focused back on the menu button
    await expect(channelsPage.globalHeader.switchProductMenuButton).toBeFocused();
}
