// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@e2e-support/test_fixture';

test('Base channel accessibility', async ({pw, pages, axe}) => {
    // # Create and sign in a new user
    const {user} = await pw.initSetup();

    // # Log in a user in new browser context
    const {page} = await pw.testBrowser.login(user);

    // # Visit a default channel page
    const channelsPage = new pages.ChannelsPage(page);
    await channelsPage.goto();
    await channelsPage.toBeVisible();
    await channelsPage.postCreate.postMessage('hello');

    // # Analyze the page
    // Disable 'color-contrast' to be addressed by MM-53814
    const accessibilityScanResults = await axe.builder(page, {disableColorContrast: true}).analyze();

    // * Should have no violation
    expect(accessibilityScanResults.violations).toHaveLength(0);
});

test('Post actions tab support', async ({pw, pages, axe}) => {
    // # Create and sign in a new user
    const {user} = await pw.initSetup();

    // # Log in a user in new browser context
    const {page} = await pw.testBrowser.login(user);

    // # Visit a default channel page
    const channelsPage = new pages.ChannelsPage(page);
    await channelsPage.goto();
    await channelsPage.toBeVisible();
    await channelsPage.postCreate.postMessage('hello');

    const post = await channelsPage.getLastPost();
    await post.hover();
    await post.postMenu.toBeVisible();

    // # Open the dot menu
    await post.postMenu.dotMenuButton.click();

    // * Dot menu should be visible and have focused
    await channelsPage.postDotMenu.toBeVisible();
    await expect(channelsPage.postDotMenu.container).toBeFocused();

    // # Analyze the page
    const accessibilityScanResults = await axe
        .builder(page, {disableColorContrast: true})
        .include('.MuiMenu-list')
        .analyze();

    // * Should have no violation
    expect(accessibilityScanResults.violations).toHaveLength(0);

    // * Should move focus to Reply after arrow down
    await channelsPage.postDotMenu.container.press('ArrowDown');
    await expect(channelsPage.postDotMenu.replyMenuItem).toBeFocused();

    // * Should move focus to Forward after arrow down
    await channelsPage.postDotMenu.replyMenuItem.press('ArrowDown');
    await expect(channelsPage.postDotMenu.forwardMenuItem).toBeFocused();

    // * Should move focus to Follow message after arrow down
    await channelsPage.postDotMenu.forwardMenuItem.press('ArrowDown');
    await expect(channelsPage.postDotMenu.followMessageMenuItem).toBeFocused();

    // * Should move focus to Mark as Unread after arrow down
    await channelsPage.postDotMenu.followMessageMenuItem.press('ArrowDown');
    await expect(channelsPage.postDotMenu.markAsUnreadMenuItem).toBeFocused();

    // * Should move focus to Remind after arrow down
    await channelsPage.postDotMenu.markAsUnreadMenuItem.press('ArrowDown');
    await expect(channelsPage.postDotMenu.remindMenuItem).toBeFocused();

    // * Should move focus to Save after arrow down
    await channelsPage.postDotMenu.remindMenuItem.press('ArrowDown');
    await expect(channelsPage.postDotMenu.saveMenuItem).toBeFocused();

    // * Should move focus to Pin to Channel after arrow down
    await channelsPage.postDotMenu.saveMenuItem.press('ArrowDown');
    await expect(channelsPage.postDotMenu.pinToChannelMenuItem).toBeFocused();

    // * Should move focus to Copy Link after arrow down
    await channelsPage.postDotMenu.pinToChannelMenuItem.press('ArrowDown');
    await expect(channelsPage.postDotMenu.copyLinkMenuItem).toBeFocused();

    // * Should move focus to Edit after arrow down
    await channelsPage.postDotMenu.copyLinkMenuItem.press('ArrowDown');
    await expect(channelsPage.postDotMenu.editMenuItem).toBeFocused();

    // * Should move focus to Copy Text after arrow down
    await channelsPage.postDotMenu.editMenuItem.press('ArrowDown');
    await expect(channelsPage.postDotMenu.copyTextMenuItem).toBeFocused();

    // * Should move focus to Delete after arrow down
    await channelsPage.postDotMenu.copyTextMenuItem.press('ArrowDown');
    await expect(channelsPage.postDotMenu.deleteMenuItem).toBeFocused();

    // * Then, should move focus back to Reply after arrow down
    await channelsPage.postDotMenu.deleteMenuItem.press('ArrowDown');
    await expect(channelsPage.postDotMenu.replyMenuItem).toBeFocused();

    // * Should move focus to Delete after arrow uo
    await channelsPage.postDotMenu.container.press('ArrowUp');
    expect(await channelsPage.postDotMenu.deleteMenuItem).toBeFocused();

    // # Set focus to Remind
    await channelsPage.postDotMenu.remindMenuItem.focus();
    await expect(channelsPage.postDotMenu.remindMenuItem).toBeFocused();

    // * Reminder menu should still be hidden
    await expect(channelsPage.postReminderMenu.container).toBeHidden();

    // # Press arrow right
    await channelsPage.postDotMenu.remindMenuItem.press('ArrowRight');

    // * Reminder menu should be visible and have focused
    channelsPage.postReminderMenu.toBeVisible();
    await expect(channelsPage.postReminderMenu.container).toBeFocused();

    // * Should move focus to 30 mins after arrow down
    await channelsPage.postReminderMenu.container.press('ArrowDown');
    expect(await channelsPage.postReminderMenu.thirtyMinsMenuItem).toBeFocused();

    // * Should move focus to 1 hour after arrow down
    await channelsPage.postReminderMenu.thirtyMinsMenuItem.press('ArrowDown');
    expect(await channelsPage.postReminderMenu.oneHourMenuItem).toBeFocused();

    // * Should move focus to 2 hours after arrow down
    await channelsPage.postReminderMenu.oneHourMenuItem.press('ArrowDown');
    expect(await channelsPage.postReminderMenu.twoHoursMenuItem).toBeFocused();

    // * Should move focus to Tomorrow after arrow down
    await channelsPage.postReminderMenu.twoHoursMenuItem.press('ArrowDown');
    expect(await channelsPage.postReminderMenu.tomorrowMenuItem).toBeFocused();

    // * Should move focus to Custom after arrow down
    await channelsPage.postReminderMenu.tomorrowMenuItem.press('ArrowDown');
    expect(await channelsPage.postReminderMenu.customMenuItem).toBeFocused();

    // * Then, should move focus back to 30 mins after arrow down
    await channelsPage.postReminderMenu.customMenuItem.press('ArrowDown');
    expect(await channelsPage.postReminderMenu.thirtyMinsMenuItem).toBeFocused();

    // * Should hide Reminder menu and focus to Remind menu after arrow left
    await channelsPage.postReminderMenu.container.press('ArrowLeft');
    await expect(channelsPage.postReminderMenu.container).toBeHidden();
    await expect(channelsPage.postDotMenu.remindMenuItem).toBeFocused();

    // * Should hide Dot menu of Escape
    await channelsPage.postDotMenu.container.press('Escape');
    await expect(channelsPage.postDotMenu.container).toBeHidden();
});
