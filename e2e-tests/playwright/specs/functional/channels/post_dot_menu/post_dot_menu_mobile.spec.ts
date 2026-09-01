// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

import type {PlaywrightExtended} from '@mattermost/playwright-lib';
import {expect, test} from '@mattermost/playwright-lib';

test.describe('Post dot menu in mobile view', () => {
    // A narrow width triggers the mobile/responsive layout, where the post
    // actions ("…") menu is rendered inside a full-screen modal instead of a popover.
    test.use({viewport: {width: 400, height: 900}});

    /**
     * @objective Clicking the dimmed area outside the post actions menu dismisses it in mobile view.
     */
    test('closes the post actions menu when clicking outside it', {tag: '@channels'}, async ({pw}) => {
        const {page, post, copyTextMenuItem} = await openMobilePostActionsMenu(
            pw,
            'Message for mobile dot menu outside-click test',
        );

        // # Click the dimmed area directly above the menu, then reopen and click below it
        await clickDimmedArea(page, 'above');

        // * The menu is dismissed
        await expect(copyTextMenuItem).toBeHidden();

        // # Reopen the menu
        await post.hover();
        await post.postMenu.openDotMenu();
        await expect(copyTextMenuItem).toBeVisible();

        // # Click the dimmed area below the menu
        await clickDimmedArea(page, 'below');

        // * The menu is dismissed again
        await expect(copyTextMenuItem).toBeHidden();
    });

    /**
     * @objective Selecting a menu item still dismisses the menu in mobile view. This guards that the
     * outside-click fix (which relies on pointer-events) does not break interaction with the items.
     */
    test('closes the post actions menu when a menu item is selected', {tag: '@channels'}, async ({pw}) => {
        const {copyTextMenuItem} = await openMobilePostActionsMenu(pw, 'Message for mobile dot menu item-click test');

        // # Select a menu item
        await copyTextMenuItem.click();

        // * The menu is dismissed
        await expect(copyTextMenuItem).toBeHidden();
    });
});

// Logs in a fresh user, posts a message, and opens the post actions ("…") menu on it.
async function openMobilePostActionsMenu(pw: PlaywrightExtended, message: string) {
    // # Initialize a user and log in
    const {user} = await pw.initSetup();
    const {channelsPage, page} = await pw.testBrowser.login(user);

    // # Post a message in the default channel
    await channelsPage.goto();
    await channelsPage.toBeVisible();
    await channelsPage.postMessage(message);

    // # Open the post actions ("…") menu on the message
    const post = await channelsPage.getLastPost();
    await post.toBeVisible();
    await post.hover();
    await post.postMenu.toBeVisible();
    await post.postMenu.openDotMenu();

    // * The menu opens with its items visible
    const copyTextMenuItem = page.getByRole('menuitem', {name: 'Copy Text'});
    await expect(copyTextMenuItem).toBeVisible();

    return {channelsPage, page, post, copyTextMenuItem};
}

// Clicks the dimmed backdrop area of the open menu modal, above or below the menu list. The point is
// chosen to fall inside the modal dialog but outside the menu items, which is exactly the region the fix
// makes dismissible. It deliberately avoids the outer `.modal` container area beyond the dialog, which
// react-bootstrap already dismisses regardless of the fix (so clicking there would not test the fix).
async function clickDimmedArea(page: Page, position: 'above' | 'below') {
    const dialogBox = await page.locator('.menuModal').boundingBox();
    const listBox = await page.locator('.menuModal .MuiList-root').boundingBox();
    expect(dialogBox).not.toBeNull();
    expect(listBox).not.toBeNull();

    // Click just outside the menu list, staying close to it so the point remains within the modal
    // dialog's dimmed area. The guards assert the point sits inside the dialog bounds but outside the
    // list, i.e. the region the fix makes dismissible (never the outer `.modal` region beyond the
    // dialog, which dismisses regardless of the fix).
    const gap = 25;
    const x = listBox!.x + listBox!.width / 2;
    let y: number;
    if (position === 'above') {
        y = listBox!.y - gap;
        expect(y).toBeGreaterThan(dialogBox!.y);
        expect(y).toBeLessThan(listBox!.y);
    } else {
        const listBottom = listBox!.y + listBox!.height;
        y = listBottom + gap;
        expect(y).toBeGreaterThan(listBottom);
        expect(y).toBeLessThan(dialogBox!.y + dialogBox!.height);
    }

    await page.mouse.click(x, y);
}
