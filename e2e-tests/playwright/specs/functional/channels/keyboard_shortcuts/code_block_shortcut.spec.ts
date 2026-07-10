// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

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
