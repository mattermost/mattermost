// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {createLinkBookmark} from './support';

/**
 * @objective Verify a bookmark's URL and title can be edited and saved.
 */
test('MM-T5610 edits a bookmark URL and title', {tag: '@channels'}, async ({pw}) => {
    const {adminClient, team, user, userClient} = await pw.initSetup();
    const channel = await adminClient.createPublicChannel(team.id, `Edit ${pw.random.id()}`);
    await adminClient.addToChannel(user.id, channel.id);
    await createLinkBookmark(userClient, channel.id, 'Community Server', 'https://community.mattermost.com');

    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    const editModal = channelsPage.getBookmarkEditModal();

    // # Open the bookmark editor and change its URL and title
    await channelsPage.channelBookmarksBar.openBookmarkMenu('Community Server');
    await channelsPage.channelBookmarksBar.editMenuItem.click();
    await editModal.toBeVisible();
    await editModal.linkInput.fill('https://hub.mattermost.com');
    await expect(editModal.titleInput).toHaveValue('hub.mattermost.com');
    await expect(editModal.saveButton).toBeEnabled();
    await editModal.titleInput.fill('Hub Server');
    await editModal.saveButton.click();

    // * Verify the updated bookmark title and link
    await expect(channelsPage.channelBookmarksBar.getBookmark('Hub Server')).toBeVisible();
    await expect(channelsPage.channelBookmarksBar.getBookmark('Hub Server')).toHaveAttribute(
        'href',
        /^https:\/\/hub\.mattermost\.com/,
    );
});

/**
 * @objective Verify users without bookmark-management permissions can only open or copy bookmarks.
 */
test('MM-T5615 restricts bookmark management to users with permission', {tag: '@channels'}, async ({pw}) => {
    const {adminClient, team, user, userClient} = await pw.initSetup();
    const channel = await adminClient.createPublicChannel(team.id, `Permissions ${pw.random.id()}`);
    await adminClient.addToChannel(user.id, channel.id);
    await createLinkBookmark(userClient, channel.id, 'First link', 'https://example.com/first');
    await createLinkBookmark(userClient, channel.id, 'Second link', 'https://example.com/second');
    const scheme = await adminClient.createScheme({
        display_name: `Bookmark permissions ${pw.random.id()}`,
        scope: 'team',
    });
    const channelUserRole = await adminClient.getRoleByName(scheme.default_channel_user_role);
    const restrictedPermissions = channelUserRole.permissions.filter((permission) => !permission.includes('bookmark'));

    // # Assign an isolated team scheme without bookmark-management permissions
    await adminClient.patchRole(channelUserRole.id, {permissions: restrictedPermissions});
    await adminClient.updateTeamScheme(team.id, scheme.id);
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

    // * Verify bookmarks render in their original order
    const bookmarkLinks = channelsPage.channelBookmarksBar.getBookmarkLinks();
    await expect(bookmarkLinks).toHaveText(['First link', 'Second link']);

    const firstLink = channelsPage.channelBookmarksBar.getBookmark('First link');
    await firstLink.focus();
    await firstLink.press('Space');
    await firstLink.press('ArrowRight');
    await firstLink.press('Space');

    // * Verify the keyboard reorder attempt did not change the bookmark order or link
    await expect(bookmarkLinks).toHaveText(['First link', 'Second link']);
    await expect(channelsPage.channelBookmarksBar.getBookmark('First link')).toHaveAttribute(
        'href',
        /^https:\/\/example\.com\/first/,
    );
});

/**
 * @objective Verify archived channels allow opening/copying bookmarks but prevent add, edit, delete, and reorder.
 */
test('MM-T5725 prevents bookmark management in an archived channel', {tag: '@channels'}, async ({pw}) => {
    const {adminClient, team, user, userClient} = await pw.initSetup();
    const channel = await adminClient.createPublicChannel(team.id, `Archived ${pw.random.id()}`);
    await adminClient.addToChannel(user.id, channel.id);
    await createLinkBookmark(userClient, channel.id, 'First link', 'https://example.com/first');
    await createLinkBookmark(userClient, channel.id, 'Second link', 'https://example.com/second');

    // # Archive a channel containing two bookmarks
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.archiveChannel();

    // * Verify bookmark management controls are unavailable
    await expect(channelsPage.channelBookmarksBar.addBookmarkButton).not.toBeVisible();
    await channelsPage.channelBookmarksBar.openBookmarkMenu('First link');
    await expect(channelsPage.channelBookmarksBar.openMenuItem).toBeVisible();
    await expect(channelsPage.channelBookmarksBar.copyLinkMenuItem).toBeVisible();
    await expect(channelsPage.channelBookmarksBar.editMenuItem).not.toBeVisible();
    await expect(channelsPage.channelBookmarksBar.deleteMenuItem).not.toBeVisible();
    await page.keyboard.press('Escape');

    // * Verify bookmarks render in their original order
    const bookmarkLinks = channelsPage.channelBookmarksBar.getBookmarkLinks();
    await expect(bookmarkLinks).toHaveText(['First link', 'Second link']);

    const firstLink = channelsPage.channelBookmarksBar.getBookmark('First link');
    await firstLink.focus();
    await firstLink.press('Space');
    await firstLink.press('ArrowRight');
    await firstLink.press('Space');

    // * Verify the keyboard reorder attempt did not change the bookmark order or link
    await expect(bookmarkLinks).toHaveText(['First link', 'Second link']);
    await expect(channelsPage.channelBookmarksBar.getBookmark('First link')).toHaveAttribute(
        'href',
        /^https:\/\/example\.com\/first/,
    );
});
