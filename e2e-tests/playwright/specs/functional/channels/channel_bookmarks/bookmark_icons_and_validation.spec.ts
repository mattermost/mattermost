// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Api, expect, settle, test} from '@mattermost/playwright-lib';

import {createLinkBookmark} from './support';

/**
 * @objective Verify a bookmark without favicon metadata displays the fallback link icon.
 */
test('MM-T5605 uses a fallback icon when a link has no favicon', {tag: '@channels'}, async ({pw}) => {
    // # Create a link bookmark without favicon metadata
    const {adminClient, team, user, userClient} = await pw.initSetup();
    const channel = await adminClient.createPublicChannel(team.id, `Fallback ${pw.random.id()}`);
    await adminClient.addToChannel(user.id, channel.id);
    const bookmark = await createLinkBookmark(userClient, channel.id, 'No favicon', 'https://invalid.example.test');

    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: channel.name});
    await expect(app.channelBookmarks).toBeVisible();

    // * Verify the fallback link icon is used
    await expect(app.channelBookmarks.bookmark(bookmark).icon).toHaveAttribute('data-icon-kind', 'link-fallback');
});

/**
 * @objective Verify a bookmark favicon can be changed to an emoji and reverted to its fallback icon.
 */
test(
    'MM-T5606 MM-T5607 changes a bookmark favicon to an emoji and restores the fallback',
    {tag: '@channels'},
    async ({pw}) => {
        const {adminClient, team, user, userClient} = await pw.initSetup();
        const channel = await adminClient.createPublicChannel(team.id, `Icon ${pw.random.id()}`);
        await adminClient.addToChannel(user.id, channel.id);
        const bookmark = await createLinkBookmark(
            userClient,
            channel.id,
            'Editable icon',
            'https://invalid.example.test',
        );

        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: channel.name});
        await expect(app.channelBookmarks).toBeVisible();
        const item = app.channelBookmarks.bookmark(bookmark);

        // # Edit the bookmark and choose an emoji icon
        await item.container.hover();
        await item.openMenuButton.clickTo(app.bookmarkMenu.editMenuItem);
        let editModal = await app.bookmarkMenu.editMenuItem.clickTo(app.bookmarkModal);
        await editModal.emojiButton.clickTo(app.emojiPicker.searchTextbox);
        await app.emojiPicker.searchTextbox.fill('smile');
        await app.emojiPicker.searchTextbox.press('Enter');
        await expect(app.emojiPicker.searchTextbox).not.toBeVisible();
        await settle(editModal.confirmButton, {wait: Api.UpdateChannelBookmark}).click();

        // * Verify the bookmark now uses an emoji icon
        await expect(item.icon).toHaveAttribute('data-icon-kind', 'emoji');

        // # Edit again and remove the emoji
        await item.container.hover();
        await item.openMenuButton.clickTo(app.bookmarkMenu.editMenuItem);
        editModal = await app.bookmarkMenu.editMenuItem.clickTo(app.bookmarkModal);
        await editModal.removeEmojiButton.click();
        await expect(editModal.removeEmojiButton).not.toBeVisible();
        await settle(editModal.confirmButton, {wait: Api.UpdateChannelBookmark}).click();

        // * Verify the fallback icon is restored
        await expect(item.icon).toHaveAttribute('data-icon-kind', 'link-fallback');
    },
);

/**
 * @objective Verify an invalid URL shows an error and cannot be saved as a bookmark.
 */
test('MM-T5608 rejects an invalid bookmark URL', {tag: '@channels'}, async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const channel = await adminClient.createPublicChannel(team.id, `Invalid ${pw.random.id()}`);
    await adminClient.addToChannel(user.id, channel.id);

    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: channel.name});

    // # Open Add bookmark and enter invalid URL text
    const bookmarks = app.channelHeader.menu.bookmarks;
    await app.channelHeader.openMenuButton.clickTo(bookmarks.container);
    await bookmarks.container.hover();
    await expect(bookmarks.addLinkMenuItem).toBeVisible();
    await bookmarks.addLinkMenuItem.clickTo(app.bookmarkModal);
    await app.bookmarkModal.link.container.fill('this is not a URL');

    // * Verify the validation error appears and saving is disabled
    await expect(app.bookmarkModal.link.validationAlert).toBeVisible();
    await expect(app.bookmarkModal.confirmButton).toBeDisabled();
});
