// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that formatting applied with the formatting bar or a keyboard shortcut can be undone and redone,
 * and that undo continues back through text typed before the formatting was applied.
 */
test('MM-62091 undo and redo formatting applied in the message box', {tag: '@messaging'}, async ({pw}) => {
    const {user, team, townSquare: channel} = await pw.initSetup();
    const {app, page} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel});

    const {postCreate} = app.center;
    const input = postCreate.message.container.locator;

    // # Type a message and select the word "writing"
    await input.click();
    await expect(input).toBeFocused();
    await input.pressSequentially('test writing post');
    await expect(input).toHaveValue('test writing post');
    await input.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(5, 12));

    // # Apply bold with the formatting bar
    await postCreate.formattingBar.control('bold').toggle();
    await expect(input).toHaveValue('test **writing** post');

    // # Undo, then redo the formatting
    await page.keyboard.press('ControlOrMeta+Z');
    await expect(input).toHaveValue('test writing post');
    await page.keyboard.press('ControlOrMeta+Shift+Z');
    await expect(input).toHaveValue('test **writing** post');

    // # Undo the formatting again, then keep undoing
    await page.keyboard.press('ControlOrMeta+Z');
    await expect(input).toHaveValue('test writing post');
    await page.keyboard.press('ControlOrMeta+Z');

    // * Verify undo reaches the text typed before the formatting was applied
    await expect(input).not.toHaveValue('test writing post');
    expect('test writing post'.startsWith(await input.inputValue())).toBe(true);

    // # Type a heading, apply the heading format with the formatting bar, then toggle it off with the same button
    await input.fill('my title');
    await expect(input).toHaveValue('my title');
    await postCreate.formattingBar.control('heading').toggle();
    await expect(input).toHaveValue('### my title');
    await postCreate.formattingBar.control('heading').toggle();
    await expect(input).toHaveValue('my title');

    // * Verify each step can be undone
    await page.keyboard.press('ControlOrMeta+Z');
    await expect(input).toHaveValue('### my title');
    await page.keyboard.press('ControlOrMeta+Z');
    await expect(input).toHaveValue('my title');

    // # Apply italic with the keyboard shortcut to a selected word, undo it, and post the message
    await input.fill('some words');
    await expect(input).toHaveValue('some words');
    await input.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(5, 10));
    await page.keyboard.press('ControlOrMeta+I');
    await expect(input).toHaveValue('some *words*');
    await page.keyboard.press('ControlOrMeta+Z');
    await expect(input).toHaveValue('some words');
    const posts = app.center.postList.postList;
    const postsBefore = (await posts.keys()).length;
    await postCreate.sendButton.click();
    await expect(posts).toHaveKeyCount(postsBefore + 1);

    // * Verify the posted message is the undone text without formatting
    const lastPost = await posts.last();
    await expect(lastPost.message.container).toContainText('some words');
    // The rendered markdown has no generated part; an emphasis element would mean the italics were not undone.
    await expect(lastPost.message.container.locator.locator('em')).toHaveCount(0);
    await expect(lastPost.message.container).not.toContainText('*');
});
