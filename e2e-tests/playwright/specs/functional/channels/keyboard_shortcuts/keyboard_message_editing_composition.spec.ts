// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify pressing Up arrow in an empty message box opens the edit box for the last post in both
 * the center channel and a thread, and that Escape closes the edit box without saving.
 *
 * MM-T1263 covers the same behavior as MM-T1262 and is covered by this test.
 */
test(
    'MM-T1262 MM-T1263 opens and cancels the edit box with Up arrow and Escape',
    {tag: '@keyboard_shortcuts'},
    async ({pw}) => {
        const {user, team} = await pw.initSetup();
        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Post a message and press Up arrow from the empty center message box
        const message = `edit shortcut ${pw.random.id()}`;
        await channelsPage.postMessage(message);
        await channelsPage.centerView.postCreate.input.focus();
        await page.keyboard.press('ArrowUp');

        // * Verify the edit box opens with the last message
        await channelsPage.centerView.postEdit.toBeVisible();
        await expect(channelsPage.centerView.postEdit.input).toHaveValue(message);

        // # Close the edit box with Escape
        await page.keyboard.press('Escape');

        // * Verify the edit box closes and the post remains unchanged
        await channelsPage.centerView.postEdit.toNotBeVisible();
        await channelsPage.centerView.waitUntilLastPostContains(message);

        // # Open a thread on the last post and post a reply
        const post = await channelsPage.getLastPost();
        await post.reply();
        await channelsPage.sidebarRight.toBeVisible();
        const reply = `reply shortcut ${pw.random.id()}`;
        await channelsPage.sidebarRight.postMessage(reply);
        await channelsPage.sidebarRight.toContainText(reply);

        // # Press Up arrow from the empty thread reply box
        await channelsPage.sidebarRight.postCreate.input.focus();
        await page.keyboard.press('ArrowUp');

        // * Verify the thread edit box opens with the reply, then closes with Escape
        await channelsPage.sidebarRight.postEdit.toBeVisible();
        await expect(channelsPage.sidebarRight.postEdit.input).toHaveValue(reply);
        await page.keyboard.press('Escape');
        await channelsPage.sidebarRight.postEdit.toNotBeVisible();

        // * Verify the reply is still present after cancelling the edit
        await channelsPage.sidebarRight.toContainText(reply);
    },
);

/**
 * @objective Verify Shift+Enter adds new lines in the message box to compose a fenced code block, which is
 * then posted as a code block.
 *
 * MM-T1268 covers the same behavior as MM-T1267 and is covered by this test.
 */
test(
    'MM-T1267 MM-T1268 composes and posts a code block using Shift+Enter for new lines',
    {tag: '@keyboard_shortcuts'},
    async ({pw}) => {
        const {user, team} = await pw.initSetup();
        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Compose a fenced code block using Shift+Enter for new lines
        const code = `code ${pw.random.id()}`;
        const input = channelsPage.centerView.postCreate.input;
        await input.focus();
        await input.pressSequentially('```');
        await page.keyboard.press('Shift+Enter');
        await input.pressSequentially(code);
        await page.keyboard.press('Shift+Enter');
        await input.pressSequentially('```');

        // * Verify Shift+Enter produced the multi-line fenced code block in the message box
        await expect(input).toHaveValue(`\`\`\`\n${code}\n\`\`\``);

        // # Post the code block (Enter inserts a newline inside a fenced block, so use the send button)
        await channelsPage.centerView.postCreate.sendMessage();

        // * Verify the code block is posted with the code content and the fence markers consumed (rendered as a code block, not literal backticks)
        await channelsPage.centerView.waitUntilLastPostContains(code);
        const post = await channelsPage.getLastPost();
        await post.toContainText(code);
        await post.toNotContainText('```');
    },
);
