// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {createLinkBookmark} from './support';

/**
 * @objective Verify users without bookmark-management permissions can only open or copy bookmarks.
 */
test('MM-T5615 restricts bookmark management to users with permission', {tag: '@channels'}, async ({pw}) => {
    const {adminClient, team, user, userClient} = await pw.initSetup();
    const channel = await adminClient.createPublicChannel(team.id, `Permissions ${pw.random.id()}`);
    await adminClient.addToChannel(user.id, channel.id);
    await createLinkBookmark(userClient, channel.id, 'First link', 'https://example.com/first');
    await createLinkBookmark(userClient, channel.id, 'Second link', 'https://example.com/second');
    const channelUserRole = await adminClient.getRoleByName('channel_user');
    const originalPermissions = [...channelUserRole.permissions];
    const restrictedPermissions = originalPermissions.filter((permission) => !permission.includes('bookmark'));

    try {
        // # Remove bookmark-management permissions from ordinary channel users
        await adminClient.patchRole(channelUserRole.id, {permissions: restrictedPermissions});
        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.channelBookmarksBar.toBeVisible();

        // * Verify add, edit, and delete controls are unavailable
        await expect(channelsPage.channelBookmarksBar.addBookmarkButton).not.toBeVisible();
        await channelsPage.channelBookmarksBar.openBookmarkMenu('First link');
        await expect(channelsPage.channelBookmarksBar.openMenuItem).toBeVisible();
        await expect(channelsPage.channelBookmarksBar.copyLinkMenuItem).toBeVisible();
        await expect(channelsPage.channelBookmarksBar.editMenuItem).not.toBeVisible();
        await expect(channelsPage.channelBookmarksBar.deleteMenuItem).not.toBeVisible();
        await page.keyboard.press('Escape');

        const firstLink = channelsPage.channelBookmarksBar.getBookmark('First link');
        await firstLink.focus();
        await firstLink.press('Space');
        await firstLink.press('ArrowRight');
        await firstLink.press('Space');
        await expect(channelsPage.channelBookmarksBar.getBookmark('First link')).toHaveAttribute(
            'href',
            /^https:\/\/example\.com\/first/,
        );
    } finally {
        await adminClient.patchRole(channelUserRole.id, {permissions: originalPermissions});
    }
});
