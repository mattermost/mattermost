// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, Api, settle} from '@mattermost/playwright-lib';

/**
 * @objective Verify Ctrl/Cmd+B and Ctrl/Cmd+I wrap the message text in bold and italic markdown and
 * that the posted message renders the formatting.
 */
test('MM-T3405 formats text as bold and italic with keyboard shortcuts', {tag: '@keyboard_shortcuts'}, async ({pw}) => {
    const {user, team, townSquare: channel} = await pw.initSetup();
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel});

    const composer = app.center.postCreate;
    const input = composer.message.container;
    const lastPost = async (count: number) => {
        await expect.poll(async () => (await app.center.postList.postList.keys()).length).toBeGreaterThanOrEqual(count);
        return app.center.postList.post({id: (await app.center.postList.postList.keys()).at(-1)!});
    };

    // # Type text, select it and press Ctrl/Cmd+B
    await input.fill('bolded text');
    await input.press('ControlOrMeta+A', 'ControlOrMeta+B');

    // * Verify the text is wrapped in bold markdown
    await expect(input).toHaveValue('**bolded text**');

    // # Send it
    await settle(composer.sendButton, {wait: Api.CreatePost}).click();
    await expect(input).toHaveValue('');

    // * Verify the post renders bold text without the markdown
    const boldPost = await lastPost(1);
    await expect(boldPost.message.container.locator.getByRole('strong')).toHaveText('bolded text');
    await expect(boldPost.message.container).not.toContainText('**');

    // # Type text, select it and press Ctrl/Cmd+I
    await input.fill('italic text');
    await input.press('ControlOrMeta+A', 'ControlOrMeta+I');

    // * Verify the text is wrapped in italic markdown
    await expect(input).toHaveValue('*italic text*');

    // # Send it
    await settle(composer.sendButton, {wait: Api.CreatePost}).click();
    await expect(input).toHaveValue('');

    // * Verify the post renders italic text without the markdown
    const italicPost = await lastPost(2);
    await expect(italicPost.message.container.locator.getByRole('emphasis')).toHaveText('italic text');
    await expect(italicPost.message.container).not.toContainText('*');
});

/**
 * @objective Verify the Ctrl/Cmd+Shift+\ shortcut opens the emoji picker to react to the last message,
 * and that it can be dismissed.
 */
test('MM-T4693 opens the emoji picker with the keyboard shortcut', {tag: '@keyboard_shortcuts'}, async ({pw}) => {
    const {user, team, userClient, townSquare: channel} = await pw.initSetup();
    await userClient.createPost({channel_id: channel.id, message: 'this is a test'});
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel});

    // # Press Ctrl/Cmd+Shift+\ in the message box
    const input = app.center.postCreate.message.container;
    await input.focus();
    await input.press('ControlOrMeta+Shift+\\');

    // * Verify the emoji picker opens
    await expect(app.emojiPicker.searchTextbox).toBeVisible();

    // # Press Escape
    await app.emojiPicker.searchTextbox.press('Escape');

    // * Verify the emoji picker closes
    await expect(app.emojiPicker.searchTextbox).not.toBeVisible();
});
