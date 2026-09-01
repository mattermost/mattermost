// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that pasting with Ctrl/Cmd+Shift+V skips Mattermost's own paste-formatting
 * logic (e.g. auto-converting a pasted HTML table into markdown table syntax), unlike a normal
 * paste which applies it.
 */
test('MM-T1434 pasting with Ctrl/Cmd+Shift+V skips Mattermost paste formatting', {tag: '@messaging'}, async ({pw}) => {
    const {user, team} = await pw.initSetup();
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    const html = '<table><tr><td>foo</td><td>bar</td></tr></table>';
    const plainText = 'foo\tbar';
    const {postCreate} = channelsPage.centerView;
    const {input} = postCreate;

    // # Paste the HTML table normally
    await postCreate.pasteHtml(html, plainText);

    // * Verify Mattermost formatted it into markdown table syntax
    await expect(input).toHaveValue('| foo | bar |\n| --- | --- |\n');

    // # Clear the input, then paste the same HTML table with the "without formatting" flag
    await input.fill('');
    await postCreate.pasteHtml(html, plainText, {withoutFormatting: true});

    // * Verify the plain-text fallback was inserted without markdown table formatting
    await expect(input).toHaveValue(plainText);
    await expect(input).not.toHaveValue(/\|/);
});
