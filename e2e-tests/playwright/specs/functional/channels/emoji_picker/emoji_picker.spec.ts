// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, type App} from '@mattermost/playwright-lib';

/**
 * @objective Verify that using the emoji picker adds emojis to the correct place in the post textbox based on the
 * location of the keyboard caret, that keyboard focus is moved back to the post textbox correctly, and that the
 * keyboard caret is placed in the correct place.
 */
test(
    'Should add emoji to post textbox correctly and handle focus/selection correctly',
    {tag: '@emoji_picker'},
    async ({pw}) => {
        // # Initialize a test user
        const {user, team, townSquare} = await pw.initSetup();
        // # Log in as a user in new browser context and navigate to the default channel
        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: townSquare});
        const input = app.center.postCreate.message.container;

        // # Open emoji picker from center textbox and click on an emoji
        await pickEmoji(app, 'slightly_smiling_face');

        // * Verify that the emoji was correctly added to the post textbox (as unicode), followed by a space
        await expectPostCreateState(input, '🙂 ', '');

        // # Repeat those steps with another emoji
        await pickEmoji(app, 'upside_down_face');

        // * Verify that the second emoji was correctly added to the post textbox (as unicode), also followed by a space
        await expectPostCreateState(input, '🙂 🙃 ', '');

        // # Clear the textbox and replace it with some text
        await input.fill('ab');

        // # Move left so that the caret is in the middle of the text
        await input.press('ArrowLeft');
        await expect(input).toHaveJSProperty('selectionStart', 1);

        // * Verify that the caret is in the right place
        await expectPostCreateState(input, 'a', 'b');

        // # Open the emoji picker again and select another emoji
        await pickEmoji(app, 'face_with_raised_eyebrow');

        // * Verify that the emoji was added with surrounding whitespace (as unicode) and that the caret is placed after that
        await expectPostCreateState(input, 'a 🤨 ', 'b');

        // # Clear the textbox and replace it with some words
        await input.fill('this is a test');

        // # Move left again so that the caret is between words but after a space
        await input.press('ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft');
        await expect(input).toHaveJSProperty('selectionStart', 'this is a '.length);

        // * Again, verify that the caret is in the right place
        await expectPostCreateState(input, 'this is a ', 'test');

        // # Open the emoji picker again and select another emoji
        await pickEmoji(app, 'neutral_face');

        // * Verify that the emoji was added without an extra space before it (as unicode)
        await expectPostCreateState(input, 'this is a 😐 ', 'test');
    },
);

/** Opens the emoji picker from the composer, picks the emoji, and waits for the picker to close. */
async function pickEmoji(app: App, shortName: string) {
    await app.center.postCreate.emojiButton.clickTo(app.emojiPicker.searchTextbox);
    await app.emojiPicker.systemEmoji(shortName).click();
    await expect(app.emojiPicker.searchTextbox).not.toBeVisible();
}

async function expectPostCreateState(
    input: App['center']['postCreate']['message']['container'],
    textBeforeCaret: string,
    textAfterCaret: string,
) {
    // * Verify that the post textbox is focused
    await expect(input).toBeFocused();

    // * Verify that the text in it is as expected
    await expect(input).toHaveValue(textBeforeCaret + textAfterCaret);

    // * Verify that the keyboard caret is in the correct place
    // Selection offsets describe the native textarea's caret and require reading its DOM properties.
    const selectionStart = await input.locator.evaluate((element: HTMLTextAreaElement) => element.selectionStart);
    expect(selectionStart).toEqual(textBeforeCaret.length);
    const selectionEnd = await input.locator.evaluate((element: HTMLTextAreaElement) => element.selectionEnd);
    expect(selectionEnd).toEqual(textBeforeCaret.length);
}
