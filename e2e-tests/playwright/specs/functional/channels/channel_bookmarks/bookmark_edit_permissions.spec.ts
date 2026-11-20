// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Api, expect, settle, test} from '@mattermost/playwright-lib';

import {createLinkBookmark} from './support';

/**
 * @objective Verify a bookmark's URL and title can be edited and saved.
 */
test('MM-T5610 edits a bookmark URL and title', {tag: '@channels'}, async ({pw}) => {
    const {adminClient, team, user, userClient} = await pw.initSetup();
    const channel = await adminClient.createPublicChannel(team.id, `Edit ${pw.random.id()}`);
    await adminClient.addToChannel(user.id, channel.id);
    const bookmark = await createLinkBookmark(
        userClient,
        channel.id,
        'Community Server',
        'https://community.mattermost.com',
    );

    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: channel.name});
    const item = app.channelBookmarks.bookmark(bookmark);

    // # Open the bookmark editor and change its URL and title
    await item.container.hover();
    await item.openMenuButton.clickTo(app.bookmarkMenu.openMenuItem);
    const editModal = await app.bookmarkMenu.editMenuItem.clickTo(app.bookmarkModal);
    await editModal.link.container.fill('https://hub.mattermost.com');
    await expect(editModal.title.container).toHaveValue('hub.mattermost.com');
    await expect(editModal.confirmButton).toBeEnabled();
    await editModal.title.container.fill('Hub Server');
    await settle(editModal.confirmButton, {wait: Api.UpdateChannelBookmark}).click();

    // * Verify the updated bookmark title and link
    await expect(item.openLink).toHaveText('Hub Server');
    await expect(item.openLink).toHaveAttribute('href', /^https:\/\/hub\.mattermost\.com/);
});

/**
 * @objective Verify users without bookmark-management permissions can only open or copy bookmarks.
 */
test('MM-T5615 restricts bookmark management to users with permission', {tag: '@channels'}, async ({pw}) => {
    const {adminClient, team, user, userClient} = await pw.initSetup();
    const channel = await adminClient.createPublicChannel(team.id, `Permissions ${pw.random.id()}`);
    await adminClient.addToChannel(user.id, channel.id);
    const first = await createLinkBookmark(userClient, channel.id, 'First link', 'https://example.com/first');
    const second = await createLinkBookmark(userClient, channel.id, 'Second link', 'https://example.com/second');
    await pw.ensurePhase2MigrationCompleted();
    const scheme = await adminClient.createScheme({
        display_name: `Bookmark permissions ${pw.random.id()}`,
        scope: 'team',
    });
    const channelUserRole = await adminClient.getRoleByName(scheme.default_channel_user_role);
    const restrictedPermissions = channelUserRole.permissions.filter((permission) => !permission.includes('bookmark'));

    // # Assign an isolated team scheme without bookmark-management permissions
    await adminClient.patchRole(channelUserRole.id, {permissions: restrictedPermissions});
    await adminClient.updateTeamScheme(team.id, scheme.id);
    const {app, page} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: channel.name});
    await expect(app.channelBookmarks).toBeVisible();

    // * Verify add, edit, and delete controls are unavailable
    const bar = app.channelBookmarks;
    const firstItem = bar.bookmark(first);
    await expect(bar.openMenuButton).not.toBeVisible();
    await firstItem.container.hover();
    await firstItem.openMenuButton.clickTo(app.bookmarkMenu.openMenuItem);
    await expect(app.bookmarkMenu.copyLinkMenuItem).toBeVisible();
    await expect(app.bookmarkMenu.editMenuItem).not.toBeVisible();
    await expect(app.bookmarkMenu.deleteMenuItem).not.toBeVisible();
    await page.keyboard.press('Escape');
    await expect(app.bookmarkMenu.openMenuItem).not.toBeVisible();

    // * Verify bookmarks render in their original order
    await expect(bar.bookmarkList).toHaveKeys([first.id, second.id]);
    await expect(firstItem.openLink).toHaveText('First link');
    await expect(bar.bookmark(second).openLink).toHaveText('Second link');

    await firstItem.openLink.focus();
    await firstItem.openLink.press('Space', 'ArrowRight', 'Space');

    // * Verify the keyboard reorder attempt did not change the bookmark order or link
    await expect(bar.bookmarkList).toHaveKeys([first.id, second.id]);
    await expect(firstItem.openLink).toHaveAttribute('href', /^https:\/\/example\.com\/first/);
});

/**
 * @objective Verify archived channels allow opening/copying bookmarks but prevent add, edit, delete, and reorder.
 */
test('MM-T5725 prevents bookmark management in an archived channel', {tag: '@channels'}, async ({pw}) => {
    const {adminClient, team, user, userClient} = await pw.initSetup();
    const channel = await adminClient.createPublicChannel(team.id, `Archived ${pw.random.id()}`);
    await adminClient.addToChannel(user.id, channel.id);
    const first = await createLinkBookmark(userClient, channel.id, 'First link', 'https://example.com/first');
    const second = await createLinkBookmark(userClient, channel.id, 'Second link', 'https://example.com/second');

    // # Archive a channel containing two bookmarks
    const {app, page} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: channel.name});
    await app.channelHeader.openMenuButton.clickTo(app.channelHeader.menu.archiveChannelMenuItem);
    const archiveModal = await app.channelHeader.menu.archiveChannelMenuItem.clickTo(app.deleteChannelModal);
    await settle(archiveModal.confirmButton, {wait: Api.DeleteChannel}).click();
    await expect(app.center.archivedNotice).toBeVisible();

    // * Verify bookmark management controls are unavailable
    const bar = app.channelBookmarks;
    const firstItem = bar.bookmark(first);
    await expect(bar.openMenuButton).not.toBeVisible();
    await firstItem.container.hover();
    await firstItem.openMenuButton.clickTo(app.bookmarkMenu.openMenuItem);
    await expect(app.bookmarkMenu.copyLinkMenuItem).toBeVisible();
    await expect(app.bookmarkMenu.editMenuItem).not.toBeVisible();
    await expect(app.bookmarkMenu.deleteMenuItem).not.toBeVisible();
    await page.keyboard.press('Escape');
    await expect(app.bookmarkMenu.openMenuItem).not.toBeVisible();

    // * Verify bookmarks render in their original order
    await expect(bar.bookmarkList).toHaveKeys([first.id, second.id]);
    await expect(firstItem.openLink).toHaveText('First link');
    await expect(bar.bookmark(second).openLink).toHaveText('Second link');

    await firstItem.openLink.focus();
    await firstItem.openLink.press('Space', 'ArrowRight', 'Space');

    // * Verify the keyboard reorder attempt did not change the bookmark order or link
    await expect(bar.bookmarkList).toHaveKeys([first.id, second.id]);
    await expect(firstItem.openLink).toHaveAttribute('href', /^https:\/\/example\.com\/first/);
});
