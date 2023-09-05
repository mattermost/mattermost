// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@e2e-support/test_fixture';

test('MM-XXX Should search, select and post correct Gif when Gif picker is opened from center textbox', async ({
    pw,
    pages,
}) => {
    const {user} = await pw.initSetup();

    // # Log in as user in new browser context
    const {page} = await pw.testBrowser.login(user);

    // # Visit default channel page
    const channelPage = new pages.ChannelsPage(page);
    await channelPage.goto();
    await channelPage.toBeVisible();

    // # Open emoji/gif picker
    await channelPage.postCreate.openEmojiPicker();
    await channelPage.emojiGifPickerPopup.toBeVisible();

    // # Open gif tab
    await channelPage.emojiGifPickerPopup.openGifTab();

    // # Search for gif
    await channelPage.emojiGifPickerPopup.searchGif('hello');

    // # Select first gif
    const {img: firstSearchGifResult, alt: altOfFirstSearchGifResult} = await channelPage.emojiGifPickerPopup.getNthGif(0);
    await firstSearchGifResult.click();

    // # Send the selected gif as a message
    await channelPage.postCreate.sendMessage();

    // * Verify that last message has the gif
    const lastPost = await channelPage.getLastPost();
    await lastPost.toBeVisible();
    await expect(lastPost.body.getByLabel('file thumbnail')).toHaveAttribute('alt', altOfFirstSearchGifResult);
});

test('MM-XXX Should search, select and post correct Gif when Gif picker is opened from RHS textbox', async ({
    pw,
    pages,
}) => {
    const {user} = await pw.initSetup();

    // # Log in as user in new browser context
    const {page} = await pw.testBrowser.login(user);

    // # Visit default channel page
    const channelPage = new pages.ChannelsPage(page);
    await channelPage.goto();
    await channelPage.toBeVisible();

    // # Send a message
    await channelPage.postCreate.postMessage('Message to open RHS');

    // # Open the last post sent in RHS
    const lastPost = await channelPage.getLastPost();
    await lastPost.hover();
    await lastPost.postMenu.toBeVisible();
    await lastPost.postMenu.reply();

    const sidebarRight = channelPage.sidebarRight;
    await sidebarRight.toBeVisible();

    // # Send a message in the thread
    await sidebarRight.postCreate.toBeVisible();
    await sidebarRight.postCreate.writeMessage('Replying to a thread');
    await sidebarRight.postCreate.sendMessage();

    // # Open emoji/gif picker
    await sidebarRight.postCreate.openEmojiPicker();
    await channelPage.emojiGifPickerPopup.toBeVisible();

    // # Open gif tab
    await channelPage.emojiGifPickerPopup.openGifTab();

    // # Search for gif
    await channelPage.emojiGifPickerPopup.searchGif('hello');

    // # Select first gif
    const {img: firstSearchGifResult, alt: altOfFirstSearchGifResult} = await channelPage.emojiGifPickerPopup.getNthGif(0);
    await firstSearchGifResult.click();

    // # Send the selected gif as a message in the thread
    await sidebarRight.postCreate.sendMessage();

    // * Verify that last message has the gif
    const lastPostInRHS = await sidebarRight.getLastPost();
    await lastPostInRHS.toBeVisible();
    await expect(lastPostInRHS.body.getByLabel('file thumbnail')).toHaveAttribute('alt', altOfFirstSearchGifResult);
});
