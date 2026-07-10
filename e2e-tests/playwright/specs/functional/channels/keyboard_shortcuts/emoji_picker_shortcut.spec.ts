// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify the Ctrl/Cmd+Shift+\ shortcut opens the emoji picker to react to the last message,
 * and that it can be dismissed.
 */
test('MM-T4693 opens the emoji picker with the keyboard shortcut', {tag: '@keyboard_shortcuts'}, async ({pw}) => {
    const {user, team} = await pw.initSetup();
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Post a message so there is a last message to react to
    await channelsPage.centerView.postCreate.postMessage('this is a test');
    await channelsPage.centerView.postCreate.input.focus();

    // # Press the emoji picker shortcut
    await page.keyboard.press('ControlOrMeta+Shift+\\');

    // * Verify the emoji picker opens
    await expect(channelsPage.reactionEmojiPicker.container).toBeVisible();

    // # Dismiss the emoji picker
    await page.keyboard.press('Escape');

    // * Verify the emoji picker is closed
    await expect(channelsPage.reactionEmojiPicker.container).not.toBeVisible();
});
