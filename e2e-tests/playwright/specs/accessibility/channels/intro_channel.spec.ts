// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, type App} from '@mattermost/playwright-lib';

/** Posts a message from the center composer and returns its post once it shows. */
async function postMessage(app: App, message: string) {
    const {postCreate, postList} = app.center;
    const before = (await postList.postList.keys()).at(-1);
    await postCreate.message.container.fill(message);
    await postCreate.sendButton.click();
    await expect.poll(async () => (await postList.postList.keys()).at(-1)).not.toBe(before);
    const ids = await postList.postList.keys();
    return postList.post({id: ids[ids.length - 1]});
}

test.fixme('Base channel accessibility', async ({pw, axe}) => {
    // # Create and sign in a new user
    const {user, team} = await pw.initSetup();

    // # Log in a user in new browser context
    const {app, page} = await pw.testBrowser.login(user);

    // # Visit a default channel page
    await app.teamPage.goto({team});
    await expect(app.center.composer).toBeVisible();
    await postMessage(app, 'hello');

    // # Analyze the page
    // Disable 'color-contrast' to be addressed by MM-53814
    const accessibilityScanResults = await axe.builder(page, {disableColorContrast: true}).analyze();

    // * Should have no violation
    expect(accessibilityScanResults.violations).toHaveLength(0);
});

test('Post actions tab support', async ({pw, axe}) => {
    // # Create and sign in a new user
    const {user, adminClient, team} = await pw.initSetup();
    const config = await adminClient.getConfig();
    const license = await adminClient.getClientLicenseOld();

    // # Log in a user in new browser context
    const {app, page} = await pw.testBrowser.login(user);

    // # Visit a default channel page
    await app.teamPage.goto({team});
    await expect(app.center.composer).toBeVisible();
    const post = await postMessage(app, 'hello');
    await post.locator.hover();
    await expect(post.menu.dotMenuButton).toBeVisible();

    // # Open the dot menu
    await post.menu.dotMenuButton.press('Enter');

    // * Dot menu should be visible and have focused
    const dotMenu = app.postDotMenu;
    await expect(dotMenu).toBeVisible();
    await expect(dotMenu.replyMenuItem.locator).toBeFocused();

    // # Analyze the page
    const accessibilityScanResults = await axe.builder(page, {disableColorContrast: true, within: dotMenu}).analyze();

    // * Should have no violation
    expect(accessibilityScanResults.violations).toHaveLength(0);

    // * Should move focus to Quote after arrow down
    await dotMenu.replyMenuItem.press('ArrowDown');
    await expect(dotMenu.quoteMenuItem.locator).toBeFocused();

    // * Should move focus to Forward after arrow down
    await dotMenu.quoteMenuItem.press('ArrowDown');
    await expect(dotMenu.forwardMenuItem.locator).toBeFocused();

    // * Should move focus to Follow message after arrow down
    await dotMenu.forwardMenuItem.press('ArrowDown');
    await expect(dotMenu.followThreadMenuItem.locator).toBeFocused();

    // * Should move focus to Mark as Unread after arrow down
    await dotMenu.followThreadMenuItem.press('ArrowDown');
    await expect(dotMenu.markAsUnreadMenuItem.locator).toBeFocused();

    // * Should move focus to Save after arrow down
    await dotMenu.markAsUnreadMenuItem.press('ArrowDown');
    await expect(dotMenu.saveMenuItem.locator).toBeFocused();

    // * Should move focus to Remind after arrow down
    await dotMenu.saveMenuItem.press('ArrowDown');
    await expect(dotMenu.remindMenuItem.locator).toBeFocused();

    // * Should move focus to Pin to Channel after arrow down
    await dotMenu.remindMenuItem.press('ArrowDown');
    await expect(dotMenu.pinMenuItem.locator).toBeFocused();

    if (config.FeatureFlags.MoveThreadsEnabled && license.IsLicensed === 'true') {
        // * Should move focus to Move Thread after arrow down
        await dotMenu.pinMenuItem.press('ArrowDown');
        await expect(dotMenu.moveThreadMenuItem.locator).toBeFocused();

        // * Should move focus to Copy Text after arrow down
        await dotMenu.moveThreadMenuItem.press('ArrowDown');
        await expect(dotMenu.copyTextMenuItem.locator).toBeFocused();
    } else {
        // * Should move focus to Copy Text after arrow down
        await dotMenu.pinMenuItem.press('ArrowDown');
        await expect(dotMenu.copyTextMenuItem.locator).toBeFocused();
    }

    // * Should move focus to Copy Link after arrow down
    await dotMenu.copyTextMenuItem.press('ArrowDown');
    await expect(dotMenu.copyLinkMenuItem.locator).toBeFocused();

    // * Should move focus to Edit after arrow down
    await dotMenu.copyLinkMenuItem.press('ArrowDown');
    await expect(dotMenu.editMenuItem.locator).toBeFocused();

    // * Should move focus to Delete after arrow down
    // "Quarantine for Review" is inserted between Edit and Delete when content flagging is on.
    await dotMenu.editMenuItem.press('ArrowDown');
    if (config.ContentFlaggingSettings?.EnableContentFlagging) {
        await expect(dotMenu.flagMenuItem.locator).toBeFocused();
        await page.keyboard.press('ArrowDown');
    }
    await expect(dotMenu.deleteMenuItem.locator).toBeFocused();

    // * Then, should move focus back to Reply after arrow down
    await dotMenu.deleteMenuItem.press('ArrowDown');
    await expect(dotMenu.replyMenuItem.locator).toBeFocused();

    // * Should move focus to Delete after arrow uo
    await dotMenu.locator.press('ArrowUp');
    await expect(dotMenu.deleteMenuItem.locator).toBeFocused();

    // # Set focus to Remind
    await dotMenu.remindMenuItem.focus();
    await expect(dotMenu.remindMenuItem.locator).toBeFocused();

    // * Reminder menu should still be hidden
    const reminderMenu = dotMenu.remindMenu;
    await expect(reminderMenu.locator).toBeHidden();

    // # Press arrow right
    await dotMenu.remindMenuItem.press('ArrowRight');

    // * Reminder menu should be visible
    await expect(reminderMenu).toBeVisible();

    // * Should have focus on 30 mins after submenu opens
    await expect(reminderMenu.option('thirty_minutes').locator).toBeFocused();

    // * Should move focus to 1 hour after arrow down
    await reminderMenu.option('thirty_minutes').press('ArrowDown');
    await expect(reminderMenu.option('one_hour').locator).toBeFocused();

    // * Should move focus to 2 hours after arrow down
    await reminderMenu.option('one_hour').press('ArrowDown');
    await expect(reminderMenu.option('two_hours').locator).toBeFocused();

    // * Should move focus to Tomorrow after arrow down
    await reminderMenu.option('two_hours').press('ArrowDown');
    await expect(reminderMenu.option('tomorrow').locator).toBeFocused();

    // * Should move focus to Custom after arrow down
    await reminderMenu.option('tomorrow').press('ArrowDown');
    await expect(reminderMenu.option('custom').locator).toBeFocused();

    // * Then, should move focus back to 30 mins after arrow down
    await reminderMenu.option('custom').press('ArrowDown');
    await expect(reminderMenu.option('thirty_minutes').locator).toBeFocused();

    // * Should hide Reminder menu and focus to Remind menu after arrow left
    await reminderMenu.locator.press('ArrowLeft');
    await expect(reminderMenu.locator).toBeHidden();
    await expect(dotMenu.remindMenuItem.locator).toBeFocused();

    // * Should hide Dot menu of Escape
    await dotMenu.locator.press('Escape');
    await expect(dotMenu.locator).toBeHidden();
});
