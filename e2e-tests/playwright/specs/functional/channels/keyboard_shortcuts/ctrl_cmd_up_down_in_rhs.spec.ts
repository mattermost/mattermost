// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify Ctrl/Cmd+Up and Ctrl/Cmd+Down cycle through reply message history in the RHS,
 * and that the history is shared with the center textbox's own history.
 */
test('MM-T1257 CTRL/CMD+UP and CTRL/CMD+DOWN in RHS', async ({pw}) => {
    const firstMessage = 'Hello World!';
    const messages = ['This', 'is', 'an', 'e2e test', '/shrug'];

    const {user, team} = await pw.initSetup();
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Post a message in the center textbox, then open a reply thread for it
    await channelsPage.centerView.postCreate.postMessage(firstMessage);
    const rootPost = await channelsPage.getLastPost();
    await rootPost.reply();
    await channelsPage.sidebarRight.toBeVisible();

    // # Post each reply message in the RHS textbox
    const {postCreate} = channelsPage.sidebarRight;
    for (const message of messages) {
        await postCreate.postMessage(message);
    }

    await postCreate.input.focus();

    // * Verify Ctrl/Cmd+Up cycles backward through the RHS reply history
    for (const message of [...messages].reverse()) {
        await page.keyboard.press('ControlOrMeta+ArrowUp');
        await expect(postCreate.input).toHaveValue(message);
    }

    // * Verify one more Ctrl/Cmd+Up continues into the shared history from the center textbox
    await page.keyboard.press('ControlOrMeta+ArrowUp');
    await expect(postCreate.input).toHaveValue(firstMessage);

    // * Verify Ctrl/Cmd+Down moves forward by one step, back to the first reply message
    await page.keyboard.press('ControlOrMeta+ArrowDown');
    await expect(postCreate.input).toHaveValue(messages[0]);

    // # Close the RHS
    await channelsPage.sidebarRight.close();

    // * Verify the center textbox shares the same message history as the RHS
    await channelsPage.centerView.postCreate.input.focus();
    await page.keyboard.press('ControlOrMeta+ArrowUp');
    await expect(channelsPage.centerView.postCreate.input).toHaveValue(messages[messages.length - 1]);
});
