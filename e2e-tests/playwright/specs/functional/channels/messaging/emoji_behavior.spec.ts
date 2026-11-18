// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, Api, postWith, settle} from '@mattermost/playwright-lib';

/**
 * @objective Verify selecting an emoji from the picker inserts it at the current caret position.
 */
test('MM-T95 Selecting an emoji from emoji picker should insert it at the cursor position', async ({pw}) => {
    const {user, team, offTopic: channel} = await pw.initSetup();
    // # Log in and place the caret between "Hello" and "World"
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel});
    const composer = app.center.postCreate;
    await composer.message.container.fill('HelloWorld!');
    await composer.message.container.press(
        'ArrowLeft',
        'ArrowLeft',
        'ArrowLeft',
        'ArrowLeft',
        'ArrowLeft',
        'ArrowLeft',
    );
    await expect(composer.message.container).toHaveJSProperty('selectionStart', 'Hello'.length);

    // # Select the grinning emoji from the picker
    await composer.emojiButton.clickTo(app.emojiPicker.searchTextbox);
    await app.emojiPicker.systemEmoji('grinning').click();

    // * The emoji is inserted at the caret
    await expect(composer.message.container).toHaveValue('Hello 😀 World!');

    // # Send the message
    await settle(composer.sendButton, {wait: Api.CreatePost}).click();

    // * The message is shown in the channel as typed
    const sent = await postWith(app.center.postList, {text: 'Hello 😀 World!'});
    await expect(sent.message.container).toContainText('Hello 😀 World!');
});

/**
 * @objective Verify an emoji followed by punctuation renders as an emoji without separating the punctuation.
 */
test('MM-T222 Emoji characters followed by punctuation', async ({pw}) => {
    const {user, team, userClient, offTopic: channel} = await pw.initSetup();
    const post = await userClient.createPost({channel_id: channel.id, message: ':)='});

    // # Open the channel with an emoticon followed by punctuation
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel});
    const item = app.center.postList.post(post);

    // * The emoticon renders as an emoji, and the punctuation stays right after it with no stray whitespace
    const emoji = item.markdown.emoji('slightly_smiling_face').locator;
    await expect(emoji).toHaveAttribute('aria-label', ':slightly_smiling_face:');
    await expect(item.message.container).toHaveText(':)=');
});

/**
 * @objective Verify that a leading colon is ignored when searching in the emoji picker.
 */
test('MM-T156 ignores a leading colon when searching the emoji picker', {tag: '@messaging'}, async ({pw}) => {
    const {user, team, userClient, townSquare: channel} = await pw.initSetup();
    const post = await userClient.createPost({
        channel_id: channel.id,
        message: `emoji picker search ${pw.random.id()}`,
    });

    // # Open the channel and the post's reaction picker
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel});
    const item = app.center.postList.post(post);
    await item.container.hover();
    await item.menu.addReactionButton.clickTo(app.emojiPicker.searchTextbox);

    // # Search using a leading colon
    await app.emojiPicker.searchTextbox.fill(':tax');

    // * The leading colon is ignored and the taxi emoji is returned
    await expect(app.emojiPicker.systemEmoji('taxi')).toBeVisible();
});
