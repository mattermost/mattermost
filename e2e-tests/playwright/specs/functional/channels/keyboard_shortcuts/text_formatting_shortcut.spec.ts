// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify Ctrl/Cmd+B and Ctrl/Cmd+I wrap the message text in bold and italic markdown and
 * that the posted message renders the formatting.
 */
test('MM-T3405 formats text as bold and italic with keyboard shortcuts', {tag: '@keyboard_shortcuts'}, async ({pw}) => {
    const {user, team} = await pw.initSetup();
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    const postCreate = channelsPage.centerView.postCreate;

    // # Type a message, select it, and apply the bold shortcut
    await postCreate.input.click();
    await postCreate.input.fill('bolded text');
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.press('ControlOrMeta+B');

    // * Verify the text is wrapped in bold markdown
    await expect(postCreate.input).toHaveValue('**bolded text**');

    // # Post the bold message
    await postCreate.sendMessage();

    // * Verify the posted message renders as bold without literal markdown characters
    const boldPost = await channelsPage.getLastPost();
    await expect(boldPost.container.locator('strong')).toHaveText('bolded text');
    await boldPost.toNotContainText('**');

    // # Type another message, select it, and apply the italic shortcut
    await postCreate.input.click();
    await postCreate.input.fill('italic text');
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.press('ControlOrMeta+I');

    // * Verify the text is wrapped in italic markdown
    await expect(postCreate.input).toHaveValue('*italic text*');

    // # Post the italic message
    await postCreate.sendMessage();

    // * Verify the posted message renders as italic without literal markdown characters
    const italicPost = await channelsPage.getLastPost();
    await expect(italicPost.container.locator('em')).toHaveText('italic text');
    await italicPost.toNotContainText('*italic');
});
