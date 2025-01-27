// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@e2e-support/test_fixture';

test.fixme(
    'MM-T5445 Should search, select and post correct Gif when Gif picker is opened from center textbox',
    async ({pw}) => {
        const {user} = await pw.initSetup();

        // # Log in as a user in new browser context
        const {channelsPage} = await pw.testBrowser.login(user);

        // # Visit default channel page
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        // # Open emoji/gif picker
        await channelsPage.centerView.postCreate.openEmojiPicker();
        await channelsPage.emojiGifPickerPopup.toBeVisible();

        // # Open gif tab
        await channelsPage.emojiGifPickerPopup.openGifTab();

        // # Search for gif
        await channelsPage.emojiGifPickerPopup.searchGif('hello');

        // # Select the first gif
        const {img: firstSearchGifResult, alt: altOfFirstSearchGifResult} =
            await channelsPage.emojiGifPickerPopup.getNthGif(0);
        await firstSearchGifResult.click();

        // # Send the selected gif as a message
        await channelsPage.centerView.postCreate.sendMessage();

        // * Verify that last message has the gif
        const lastPost = await channelsPage.centerView.getLastPost();
        await lastPost.toBeVisible();
        await expect(lastPost.body.getByLabel('file thumbnail')).toHaveAttribute('alt', altOfFirstSearchGifResult);
    },
);

test.fixme(
    'MM-T5446 Should search, select and post correct Gif when Gif picker is opened from RHS textbox',
    async ({pw}) => {
        const {user} = await pw.initSetup();

        // # Log in as a user in new browser context
        const {channelsPage} = await pw.testBrowser.login(user);

        // # Visit default channel page
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        // # Send a message
        await channelsPage.centerView.postCreate.postMessage('Message to open RHS');

        // # Open the last post sent in RHS
        const lastPost = await channelsPage.centerView.getLastPost();
        await lastPost.hover();
        await lastPost.postMenu.toBeVisible();
        await lastPost.postMenu.reply();

        const sidebarRight = channelsPage.sidebarRight;
        await sidebarRight.toBeVisible();

        // # Send a message in the thread
        await sidebarRight.postCreate.toBeVisible();
        await sidebarRight.postCreate.writeMessage('Replying to a thread');
        await sidebarRight.postCreate.sendMessage();

        // # Open emoji/gif picker
        await sidebarRight.postCreate.openEmojiPicker();
        await channelsPage.emojiGifPickerPopup.toBeVisible();

        // # Open gif tab
        await channelsPage.emojiGifPickerPopup.openGifTab();

        // # Search for gif
        await channelsPage.emojiGifPickerPopup.searchGif('hello');

        // # Select the first gif
        const {img: firstSearchGifResult, alt: altOfFirstSearchGifResult} =
            await channelsPage.emojiGifPickerPopup.getNthGif(0);
        await firstSearchGifResult.click();

        // # Send the selected gif as a message in the thread
        await sidebarRight.postCreate.sendMessage();

        // * Verify that last message has the gif
        const lastPostInRHS = await sidebarRight.getLastPost();
        await lastPostInRHS.toBeVisible();
        await expect(lastPostInRHS.body.getByLabel('file thumbnail')).toHaveAttribute('alt', altOfFirstSearchGifResult);
    },
);
