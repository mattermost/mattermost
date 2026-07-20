// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that users can search for GIFs, select them, and post them correctly when using the center textbox.
 */
test.fixme(
    'MM-T5445 searches for GIF from center textbox and posts selected GIF correctly',
    {tag: '@gif_picker'},
    async ({pw}) => {
        // # Initialize a test user
        const {user} = await pw.initSetup();

        // # Log in as a user in new browser context
        const {channelsPage} = await pw.testBrowser.login(user);

        // # Navigate to default channel page
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        // # Open emoji/gif picker from center textbox
        await channelsPage.centerView.postCreate.openEmojiPicker();

        // * Verify emoji/gif picker popup appears
        await channelsPage.emojiGifPickerPopup.toBeVisible();

        // # Switch to GIF tab in the picker
        await channelsPage.emojiGifPickerPopup.openGifTab();

        // # Search for GIFs using the term "hello"
        await channelsPage.emojiGifPickerPopup.searchGif('hello');

        // # Select the first GIF from search results
        const {img: firstSearchGifResult, alt: altOfFirstSearchGifResult} =
            await channelsPage.emojiGifPickerPopup.getNthGif(0);
        await firstSearchGifResult.click();

        // # Send the selected GIF as a message
        await channelsPage.centerView.postCreate.sendMessage();

        // * Verify the posted message contains the selected GIF
        const lastPost = await channelsPage.getLastPost();
        await lastPost.toBeVisible();
        await expect(lastPost.body.getByLabel('file thumbnail')).toHaveAttribute('alt', altOfFirstSearchGifResult);
    },
);

/**
 * @objective Verify that users can search for GIFs, select them, and post them correctly when using the right-hand sidebar.
 */
test.fixme(
    'MM-T5446 searches for GIF from RHS textbox and posts selected GIF correctly in thread',
    {tag: '@gif_picker'},
    async ({pw}) => {
        // # Initialize a test user
        const {user} = await pw.initSetup();

        // # Log in as a user in new browser context
        const {channelsPage} = await pw.testBrowser.login(user);

        // # Navigate to default channel page
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        // # Post a message to create a thread
        await channelsPage.postMessage('Message to open RHS');

        // # Open the message in right-hand sidebar to start a thread
        const lastPost = await channelsPage.getLastPost();
        await lastPost.hover();
        await lastPost.postMenu.toBeVisible();
        await lastPost.postMenu.reply();

        // * Verify right sidebar opens and is visible
        const sidebarRight = channelsPage.sidebarRight;
        await sidebarRight.toBeVisible();

        // # Post an initial reply in the thread
        await sidebarRight.postCreate.toBeVisible();
        await sidebarRight.postCreate.writeMessage('Replying to a thread');
        await sidebarRight.postCreate.sendMessage();

        // # Open emoji/gif picker from the RHS textbox
        await sidebarRight.postCreate.openEmojiPicker();

        // * Verify emoji/gif picker popup appears
        await channelsPage.emojiGifPickerPopup.toBeVisible();

        // # Switch to GIF tab in the picker
        await channelsPage.emojiGifPickerPopup.openGifTab();

        // # Search for GIFs using the term "hello"
        await channelsPage.emojiGifPickerPopup.searchGif('hello');

        // # Select the first GIF from search results
        const {img: firstSearchGifResult, alt: altOfFirstSearchGifResult} =
            await channelsPage.emojiGifPickerPopup.getNthGif(0);
        await firstSearchGifResult.click();

        // # Send the selected GIF as a message in the thread
        await sidebarRight.postCreate.sendMessage();

        // * Verify the posted message in the thread contains the selected GIF
        const lastPostInRHS = await sidebarRight.getLastPost();
        await lastPostInRHS.toBeVisible();
        await expect(lastPostInRHS.body.getByLabel('file thumbnail')).toHaveAttribute('alt', altOfFirstSearchGifResult);
    },
);
