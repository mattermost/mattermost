// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';

import {expect, test, type App, type PlaywrightExtended, Api, postWith, settle} from '@mattermost/playwright-lib';

test.describe('Post dot menu in mobile view', () => {
    // A narrow width triggers the mobile/responsive layout, where the post
    // actions ("…") menu is rendered inside a full-screen modal instead of a popover.
    test.use({viewport: {width: 400, height: 900}});

    /**
     * @objective Clicking the dimmed area outside the post actions menu dismisses it in mobile view.
     */
    test('closes the post actions menu when clicking outside it', {tag: '@channels'}, async ({pw}) => {
        const {app, post, menu} = await openMobilePostActionsMenu(pw, 'Message for mobile dot menu outside-click test');

        // # Click the dimmed area directly above the menu
        await clickDimmedArea(app, 'above');

        // * The menu is dismissed
        await expect(menu.copyTextMenuItem).toBeHidden();

        // # Reopen the menu
        await post.container.hover();
        await post.menu.dotMenuButton.click();
        await expect(menu.copyTextMenuItem).toBeVisible();
        await expect(app.menuModal).toHaveCSS('opacity', '1');

        // # Click the dimmed area below the menu
        await clickDimmedArea(app, 'below');

        // * The menu is dismissed again
        await expect(menu.copyTextMenuItem).toBeHidden();
    });

    /**
     * @objective Selecting a menu item still dismisses the menu in mobile view. This guards that the
     * outside-click fix (which relies on pointer-events) does not break interaction with the items.
     */
    test('closes the post actions menu when a menu item is selected', {tag: '@channels'}, async ({pw}) => {
        const {menu} = await openMobilePostActionsMenu(pw, 'Message for mobile dot menu item-click test');

        // # Select a menu item
        await menu.copyTextMenuItem.click();

        // * The menu is dismissed
        await expect(menu.copyTextMenuItem).toBeHidden();
    });
});

// Logs in a fresh user, posts a message, and opens the post actions ("…") menu on it.
async function openMobilePostActionsMenu(pw: PlaywrightExtended, message: string) {
    // # Initialize a user and log in
    const {user, team} = await pw.initSetup();
    const {app} = await pw.testBrowser.login(user);

    // # Post a message in the default channel
    await app.teamPage.goto({team});
    await expect(app.center.composer).toBeVisible();
    const {postList} = app.center;
    await app.center.postCreate.message.container.fill(message);
    await settle(app.center.postCreate.sendButton, {wait: Api.CreatePost}).click();

    // # Open the post actions ("…") menu on the message
    const post = await postWith(postList, {text: message});
    await post.container.hover();
    await post.menu.dotMenuButton.click();
    const menu = app.postDotMenu;

    // * The menu opens with its items visible
    await expect(menu.copyTextMenuItem).toBeVisible();

    // # Wait for the modal's entrance animation to finish, so the menu has stopped sliding before
    // # clickDimmedArea() measures where it is
    await expect(app.menuModal).toHaveCSS('opacity', '1');

    return {app, post, menu};
}

// The modal dialog fills the modal's width, and its height but for a margin at the top and bottom (a few pixels above,
// about 35 below, at 400x900): a point this far inside the modal's top and bottom edges is in the dialog.
const DIALOG_MARGIN = 50;

// The element's box on the page; it must be laid out.
async function boxOf(locator: Locator) {
    const box = await locator.boundingBox();
    if (!box) {
        throw new Error('Expected the element to have a bounding box');
    }
    return box;
}

// Clicks the dimmed area of the open menu modal, above or below the menu list. The point is
// chosen to fall inside the modal dialog but outside the menu items, which is exactly the region the fix
// makes dismissible. It deliberately avoids the modal's edges beyond the dialog, which
// react-bootstrap already dismisses regardless of the fix (so clicking there would not test the fix).
async function clickDimmedArea(app: App, position: 'above' | 'below') {
    const modalBox = await boxOf(app.menuModal.locator);
    const listBox = await boxOf(app.menuModal.items.locator);

    // Click just outside the menu list, staying close to it so the point remains within the modal
    // dialog's dimmed area. The guards assert the point sits inside the dialog bounds but outside the
    // list, i.e. the region the fix makes dismissible.
    const gap = 25;
    const x = listBox.x + listBox.width / 2;
    let y: number;
    if (position === 'above') {
        y = listBox.y - gap;
        expect(y).toBeGreaterThan(modalBox.y + DIALOG_MARGIN);
        expect(y).toBeLessThan(listBox.y);
    } else {
        const listBottom = listBox.y + listBox.height;
        y = listBottom + gap;
        expect(y).toBeGreaterThan(listBottom);
        expect(y).toBeLessThan(modalBox.y + modalBox.height - DIALOG_MARGIN);
    }
    await app.page.mouse.click(x, y);
    await expect(app.menuModal.items).not.toBeVisible();
}
