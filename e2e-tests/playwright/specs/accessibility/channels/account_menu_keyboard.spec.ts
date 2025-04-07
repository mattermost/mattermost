// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Page} from '@playwright/test';
import {UserProfile} from '@mattermost/types/users';

import {expect, test, ChannelsPage} from '@mattermost/playwright-lib';

test('MM-63451 should be able to navigate the account settings menu with the keyboard after opening it with the mouse', async ({
    pw,
}) => {
    // # Create and sign in a new user
    const {user} = await pw.initSetup();

    // # Log in a user in new browser context
    const {page, channelsPage} = await pw.testBrowser.login(user);

    // # Visit a default channel page
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Click on the account menu button
    await channelsPage.globalHeader.accountMenuButton.click();

    await testMenuWithKeyboard(user, page, channelsPage);
});

test('MM-63451 should be able to navigate the account settings menu with the keyboard after opening it with the keyboard', async ({
    pw,
}) => {
    // # Create and sign in a new user
    const {user} = await pw.initSetup();

    // # Log in a user in new browser context
    const {page, channelsPage} = await pw.testBrowser.login(user);

    // # Visit a default channel page
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Focus the account menu button
    await channelsPage.globalHeader.accountMenuButton.focus();
    await expect(channelsPage.globalHeader.accountMenuButton).toBeFocused();
    await page.keyboard.press('Space');

    await testMenuWithKeyboard(user, page, channelsPage);
});

async function testMenuWithKeyboard(user: UserProfile, page: Page, channelsPage: ChannelsPage) {
    // * Should start focused on the first menu item
    await expect(page.getByRole('menuitem', {name: '@' + user.username})).toBeFocused();

    // * Should be able to scroll down through the menu with the keyboard
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', {name: 'Set custom status'})).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', {name: 'Online'})).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', {name: 'Away'})).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', {name: 'Do not disturb Disables all notifications'})).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', {name: 'Offline'})).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', {name: 'Profile'})).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', {name: 'Log Out'})).toBeFocused();

    // * Should be able to scroll back up through the menu with the keyboard
    await page.keyboard.press('ArrowUp');
    await expect(page.getByRole('menuitem', {name: 'Profile'})).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(page.getByRole('menuitem', {name: 'Offline'})).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(page.getByRole('menuitem', {name: 'Do not disturb Disables all notifications'})).toBeFocused();

    // * Should be able to move into the submenu by pressing the right arrow
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('menuitem', {name: "Don't clear"})).toBeFocused();

    // * Should be able to scroll through the submenu with the keyboard
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', {name: '30 mins'})).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', {name: '1 hour'})).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', {name: '2 hours'})).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', {name: 'Tomorrow'})).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', {name: 'Choose date and time'})).toBeFocused();

    // * Should wrap around when you reach the end
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', {name: "Don't clear"})).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(page.getByRole('menuitem', {name: 'Choose date and time'})).toBeFocused();

    // * Should be able to close the submenu by pressing the left arrow
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('menuitem', {name: 'Do not disturb Disables all notifications'})).toBeFocused();

    // * Should be able to close the menu by pressing escape
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menuitem')).toHaveCount(0);

    // * Should be focused back on the menu button
    await expect(channelsPage.globalHeader.accountMenuButton).toBeFocused();
}
