// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

const allSkinTones = ['default', '1F3FB', '1F3FC', '1F3FD', '1F3FE', '1F3FF'] as const;

/**
 * @objective Verify that the emoji picker's skin tone selector shows all skin tones, applies the selected
 * skin tone to inserted emojis and posted messages, persists the selection across picker reopens and page
 * reloads, and allows restoring the default skin tone.
 */
test(
    'MM-T4110 Should select a skin tone, apply it to posted emojis and persist it',
    {tag: '@emoji_picker'},
    async ({pw}) => {
        // # Initialize a test user
        const {user} = await pw.initSetup();

        // # Log in as a user in new browser context
        const {channelsPage} = await pw.testBrowser.login(user);
        const {emojiGifPickerPopup} = channelsPage;
        const {postCreate} = channelsPage.centerView;

        // # Navigate to default channel page
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        // # Open emoji picker from center textbox
        await postCreate.openEmojiPicker();
        await emojiGifPickerPopup.toBeVisible();

        // * Verify the skin tone selector is collapsed with the default skin tone selected
        await emojiGifPickerPopup.verifySelectedSkinTone('default');

        // # Expand the skin tone selector
        await emojiGifPickerPopup.openSkinToneSelector();

        // * Verify all six skin tone choices are visible
        for (const skinTone of allSkinTones) {
            await expect(emojiGifPickerPopup.getSkinToneChoice(skinTone)).toBeVisible();
        }

        // # Select the dark skin tone
        // * Verify the selector collapses with the dark skin tone applied (asserted by selectSkinTone)
        await emojiGifPickerPopup.selectSkinTone('1F3FF');

        // # Search for the thumbs up emoji and click it
        await emojiGifPickerPopup.searchEmoji('thumbsup');
        await emojiGifPickerPopup.clickEmoji('+1 dark skin tone');

        // * Verify emoji picker popup disappears and the inserted emoji carries the dark skin tone
        await emojiGifPickerPopup.notToBeVisible();
        await expect(postCreate.input).toHaveValue('👍🏿 ');

        // # Send the message
        await postCreate.sendMessage();

        // * Verify the posted emoji renders with the dark skin tone
        const lastPost = await channelsPage.getLastPost();
        await expect(lastPost.container.getByTestId('postEmoji.:+1_dark_skin_tone:')).toBeVisible();

        // # Reopen the emoji picker
        await postCreate.openEmojiPicker();
        await emojiGifPickerPopup.toBeVisible();

        // * Verify the dark skin tone persists on picker reopen
        await emojiGifPickerPopup.verifySelectedSkinTone('1F3FF');

        // # Reload the page and reopen the emoji picker
        await channelsPage.goto();
        await channelsPage.toBeVisible();
        await postCreate.openEmojiPicker();
        await emojiGifPickerPopup.toBeVisible();

        // * Verify the dark skin tone persists across page reload (skin tone is saved as a user preference)
        await emojiGifPickerPopup.verifySelectedSkinTone('1F3FF');

        // # Expand the skin tone selector and restore the default skin tone
        await emojiGifPickerPopup.openSkinToneSelector();

        // * Verify the selector collapses with the default skin tone applied (asserted by selectSkinTone)
        await emojiGifPickerPopup.selectSkinTone('default');
    },
);
