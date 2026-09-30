// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify Shift+Up focuses the latest thread repeatedly and reopens it after a reply is posted.
 */
test('MM-T1277 Shift+Up opens and refocuses the latest thread', {tag: '@keyboard_shortcuts'}, async ({pw}) => {
    const rootMessage = `Shift Up root ${pw.random.id()}`;
    const replyMessage = `Shift Up reply ${pw.random.id()}`;
    const {user, team} = await pw.initSetup();

    // # Post a message and press Shift+Up from the center-channel textbox
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();
    await channelsPage.postMessage(rootMessage);
    await channelsPage.centerView.postCreate.input.focus();
    await page.keyboard.press('Shift+ArrowUp');

    // * Verify the latest thread opens and its reply textbox is focused
    await channelsPage.sidebarRight.toBeVisible();
    await channelsPage.sidebarRight.toContainText(rootMessage);
    await expect(channelsPage.sidebarRight.postCreate.input).toBeFocused();

    // # Return focus to the center textbox and press Shift+Up again
    await channelsPage.centerView.postCreate.input.focus();
    await page.keyboard.press('Shift+ArrowUp');

    // * Verify the open thread's reply textbox is focused again
    await expect(channelsPage.sidebarRight.postCreate.input).toBeFocused();

    // # Post a reply, close the thread, and press Shift+Up from the center textbox
    await channelsPage.sidebarRight.postMessage(replyMessage);
    await channelsPage.sidebarRight.close();
    await channelsPage.centerView.postCreate.input.focus();
    await page.keyboard.press('Shift+ArrowUp');

    // * Verify the thread reopens with the reply textbox focused
    await channelsPage.sidebarRight.toBeVisible();
    await channelsPage.sidebarRight.toContainText(rootMessage);
    await channelsPage.sidebarRight.toContainText(replyMessage);
    await expect(channelsPage.sidebarRight.postCreate.input).toBeFocused();
});
