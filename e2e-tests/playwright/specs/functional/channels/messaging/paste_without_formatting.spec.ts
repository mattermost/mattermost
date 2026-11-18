// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, pasteHtml, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that pasting with Ctrl/Cmd+Shift+V skips Mattermost's own paste-formatting
 * logic (e.g. auto-converting a pasted HTML table into markdown table syntax), unlike a normal
 * paste which applies it.
 */
test('MM-T1434 pasting with Ctrl/Cmd+Shift+V skips Mattermost paste formatting', {tag: '@messaging'}, async ({pw}) => {
    const {user, team, townSquare: channel} = await pw.initSetup();
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel});

    const html = '<table><tr><td>foo</td><td>bar</td></tr></table>';
    const plainText = 'foo\tbar';
    const input = app.center.postCreate.message.container;

    // # Paste the HTML table normally
    await pasteHtml(input, html, plainText);

    // * Verify Mattermost formatted it into markdown table syntax
    await expect(input).toHaveValue('| foo | bar |\n| --- | --- |\n');

    // # Clear the input, then paste the same HTML table with the "without formatting" flag
    await input.fill('');
    await expect(input).toHaveValue('');
    await pasteHtml(input, html, plainText, {withoutFormatting: true});

    // * Verify the plain-text fallback was inserted without markdown table formatting
    await expect(input).toHaveValue(plainText);
    await expect(input).not.toHaveValue(/\|/);
});
