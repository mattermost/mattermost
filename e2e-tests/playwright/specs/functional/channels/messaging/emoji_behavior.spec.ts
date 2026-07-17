// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify selecting an emoji from the picker inserts it at the current caret position.
 */
test('MM-T95 Selecting an emoji from emoji picker should insert it at the cursor position', async ({pw}) => {
    const {user, team} = await pw.initSetup();

    // # Log in and place the caret between "Hello" and "World"
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'off-topic');
    await channelsPage.toBeVisible();
    await channelsPage.centerView.postCreate.writeMessage('HelloWorld!');
    for (let i = 0; i < 'World!'.length; i++) {
        await channelsPage.centerView.postCreate.input.press('ArrowLeft');
    }

    // # Select the grinning emoji from the picker
    await channelsPage.centerView.postCreate.openEmojiPicker();
    await channelsPage.emojiGifPickerPopup.toBeVisible();
    await channelsPage.emojiGifPickerPopup.clickEmoji('grinning');

    // * Verify the emoji was inserted at the caret and can be posted
    await expect(channelsPage.centerView.postCreate.input).toHaveValue('Hello 😀 World!');
    await channelsPage.centerView.postCreate.sendMessage();
    const lastPost = await channelsPage.getLastPost();
    await lastPost.toContainText('Hello 😀 World!');
});

/**
 * @objective Verify an emoji followed by punctuation renders as an emoji without separating the punctuation.
 */
test('MM-T222 Emoji characters followed by punctuation', async ({pw}) => {
    const {user, team} = await pw.initSetup();

    // # Post an emoticon followed by punctuation
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'off-topic');
    await channelsPage.toBeVisible();
    await channelsPage.postMessage(':)=');

    // * Verify the emoticon renders and the punctuation remains immediately adjacent, with no stray
    // whitespace inserted between the rendered emoji and the punctuation
    const lastPost = await channelsPage.getLastPost();
    await expect(lastPost.emoticon.first()).toHaveAttribute('aria-label', ':slightly_smiling_face:');
    await expect(lastPost.messageText.first()).toHaveText(':)=');
});

/**
 * @objective Verify that a leading colon is ignored when searching in the emoji picker.
 */
test('MM-T156 ignores a leading colon when searching the emoji picker', {tag: '@messaging'}, async ({pw}) => {
    // # Create and log in as a test user
    const {user, team} = await pw.initSetup();
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Post a message and open the emoji reaction picker on it
    await channelsPage.postMessage(`emoji picker search ${pw.random.id()}`);
    const post = await channelsPage.getLastPost();
    await post.openReactionPicker();

    // * Verify the emoji picker is open
    await channelsPage.reactionEmojiPicker.toBeVisible();

    // # Search using a leading colon
    await channelsPage.reactionEmojiPicker.searchEmoji(':tax');

    // * Verify the leading colon is ignored and the taxi emoji is returned
    await expect(channelsPage.reactionEmojiPicker.getEmoji('taxi')).toBeVisible();
});
