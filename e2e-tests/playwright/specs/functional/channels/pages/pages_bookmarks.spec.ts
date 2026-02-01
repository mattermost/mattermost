// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';
import {
    createWikiThroughUI,
    createPageThroughUI,
    createTestChannel,
    openPageActionsMenu,
    clickPageContextMenuItem,
    verifyPageContentContains,
    verifyBookmarkExists,
    verifyBookmarkNotExists,
    loginAndNavigateToChannel,
    uniqueName,
    ELEMENT_TIMEOUT,
} from './test_helpers';

/**
 * @objective Verify creating a bookmark from a page to a different channel
 */
test('creates bookmark from page to another channel', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;

    // # Create two test channels
    const sourceChannel = await createTestChannel(adminClient, team.id, uniqueName('Source Channel'));
    const targetChannel = await createTestChannel(adminClient, team.id, uniqueName('Target Channel'));

    // # Add user to both channels so they appear in the channel selector
    await adminClient.addToChannel(user.id, sourceChannel.id);
    await adminClient.addToChannel(user.id, targetChannel.id);

    // # Navigate to source channel and create wiki with page
    const {page, channelsPage} = await loginAndNavigateToChannel(pw, user, team.name, sourceChannel.name);
    const wiki = await createWikiThroughUI(page, uniqueName('Test Wiki'));
    await createPageThroughUI(page, 'Page to Bookmark', 'Content for bookmarking');

    // # Open page actions menu and click "Bookmark in channel..." option
    await openPageActionsMenu(page);
    await clickPageContextMenuItem(page, 'bookmark-in-channel');

    // # Wait for bookmark channel select modal to appear
    const modal = page.locator('.BookmarkChannelSelect');
    await expect(modal).toBeVisible();

    // # Select target channel from dropdown
    const channelSelect = modal.locator('#channelSelect');
    await expect(channelSelect).toBeVisible();
    await channelSelect.selectOption({label: targetChannel.display_name});

    // # Click Bookmark button to create bookmark
    const bookmarkButton = modal.getByRole('button', {name: 'Bookmark'});
    await expect(bookmarkButton).toBeEnabled();

    // * Wait for bookmark creation API call to complete
    const [response] = await Promise.all([
        page.waitForResponse(
            (resp) =>
                resp.url().includes('/api/v4/channels/') &&
                resp.url().includes('/bookmarks') &&
                resp.request().method() === 'POST',
        ),
        bookmarkButton.click(),
    ]);

    // * Verify bookmark was created successfully
    expect(response.status()).toBe(201);

    // * Verify modal closes
    await expect(modal).not.toBeVisible();

    // # Navigate to target channel
    await channelsPage.goto(team.name, targetChannel.name);

    // * Verify bookmark with page title is present
    const bookmark = await verifyBookmarkExists(page, 'Page to Bookmark');

    // # Click the bookmark to navigate to the page
    await bookmark.click();

    // * Verify navigated to the correct page in source channel
    await expect(page).toHaveURL(new RegExp(`/${team.name}/wiki/${sourceChannel.id}/${wiki.id}/`));

    // * Verify page content is displayed
    await verifyPageContentContains(page, 'Content for bookmarking');
});

/**
 * @objective Verify bookmark button is disabled when no channel is selected
 */
test('disables bookmark button when no channel selected', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    // # Add user to channel
    await adminClient.addToChannel(user.id, channel.id);

    // # Navigate to channel
    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and page
    await createWikiThroughUI(page, uniqueName('Test Wiki'));
    await createPageThroughUI(page, 'Test Page', 'Test content');

    // # Open page actions menu and click "Bookmark in channel..."
    await openPageActionsMenu(page);
    await clickPageContextMenuItem(page, 'bookmark-in-channel');

    // # Wait for modal to appear
    const modal = page.locator('.BookmarkChannelSelect');
    await expect(modal).toBeVisible();

    // * Verify Bookmark button is disabled when no channel selected
    const bookmarkButton = modal.getByRole('button', {name: 'Bookmark'});
    await expect(bookmarkButton).toBeDisabled();
});

/**
 * @objective Verify canceling bookmark creation closes modal without creating bookmark
 */
test('cancels bookmark creation and closes modal', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    // # Add user to channel
    await adminClient.addToChannel(user.id, channel.id);

    // # Navigate to channel
    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and page
    await createWikiThroughUI(page, uniqueName('Test Wiki'));
    await createPageThroughUI(page, 'Test Page', 'Test content');

    // # Open page actions menu and click "Bookmark in channel..."
    await openPageActionsMenu(page);
    await clickPageContextMenuItem(page, 'bookmark-in-channel');

    // # Wait for modal to appear
    const modal = page.locator('.BookmarkChannelSelect');
    await expect(modal).toBeVisible();

    // # Click Cancel button
    const cancelButton = modal.getByRole('button', {name: 'Cancel'});
    await cancelButton.click();

    // * Verify modal closes
    await expect(modal).not.toBeVisible();

    // * Verify no new bookmark was created
    await verifyBookmarkNotExists(page, 'Test Page');
});

/**
 * @objective Verify bookmarking a page in the same channel it was created in
 */
test('creates bookmark in same channel as page', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    // # Add user to channel so it appears in the channel selector
    await adminClient.addToChannel(user.id, channel.id);

    // # Navigate to channel
    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and page
    await createWikiThroughUI(page, uniqueName('Test Wiki'));
    await createPageThroughUI(page, 'Same Channel Page', 'Content');

    // # Open page actions menu and click "Bookmark in channel..."
    await openPageActionsMenu(page);
    await clickPageContextMenuItem(page, 'bookmark-in-channel');

    // # Select same channel from dropdown
    const modal = page.locator('.BookmarkChannelSelect');
    const channelSelect = modal.locator('#channelSelect');
    await channelSelect.selectOption({label: channel.display_name});

    // # Click Bookmark button
    const bookmarkButton = modal.getByRole('button', {name: 'Bookmark'});
    await bookmarkButton.click();

    // * Verify modal closes
    await expect(modal).not.toBeVisible();

    // * Wait for Bookmarks tab to appear (React re-render after Redux update)
    const bookmarksTab = page.getByRole('button', {name: /Bookmarks/});
    await expect(bookmarksTab).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify bookmark appears in bookmarks container
    await verifyBookmarkExists(page, 'Same Channel Page');
});
