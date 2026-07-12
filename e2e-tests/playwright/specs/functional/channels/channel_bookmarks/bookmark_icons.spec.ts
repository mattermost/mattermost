// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {createLinkBookmark} from './support';

/**
 * @objective Verify a bookmark without favicon metadata displays the fallback link icon.
 */
test('MM-T5605 uses a fallback icon when a link has no favicon', {tag: '@channels'}, async ({pw}) => {
    // # Create a link bookmark without favicon metadata
    const {adminClient, team, user, userClient} = await pw.initSetup();
    const channel = await adminClient.createPublicChannel(team.id, `Fallback ${pw.random.id()}`);
    await adminClient.addToChannel(user.id, channel.id);
    await createLinkBookmark(userClient, channel.id, 'No favicon', 'https://invalid.example.test');

    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.channelBookmarksBar.toBeVisible();

    // * Verify the fallback link icon is used
    await expect(channelsPage.channelBookmarksBar.getBookmarkIcon('No favicon')).toHaveAttribute(
        'data-icon-kind',
        'link-fallback',
    );
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
        await createLinkBookmark(userClient, channel.id, 'Editable icon', 'https://invalid.example.test');

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.channelBookmarksBar.toBeVisible();
        const editModal = channelsPage.getBookmarkEditModal();

        // # Edit the bookmark and choose an emoji icon
        await channelsPage.channelBookmarksBar.openBookmarkMenu('Editable icon');
        await channelsPage.channelBookmarksBar.editMenuItem.click();
        await editModal.toBeVisible();
        await editModal.selectEmoji('smile');
        await editModal.saveButton.click();

        // * Verify the bookmark now uses an emoji icon
        await expect(channelsPage.channelBookmarksBar.getBookmarkIcon('Editable icon')).toHaveAttribute(
            'data-icon-kind',
            'emoji',
        );

        // # Edit again and remove the emoji
        await channelsPage.channelBookmarksBar.openBookmarkMenu('Editable icon');
        await channelsPage.channelBookmarksBar.editMenuItem.click();
        await editModal.toBeVisible();
        await editModal.removeEmojiButton.click();
        await editModal.saveButton.click();

        // * Verify the fallback icon is restored
        await expect(channelsPage.channelBookmarksBar.getBookmarkIcon('Editable icon')).toHaveAttribute(
            'data-icon-kind',
            'link-fallback',
        );
    },
);
