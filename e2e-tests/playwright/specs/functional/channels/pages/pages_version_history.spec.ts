// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';
import {
    AUTOSAVE_WAIT,
    buildWikiPageUrl,
    createPageThroughUI,
    createTestChannel,
    createTestUserInChannel,
    createWikiThroughUI,
    EDITOR_LOAD_WAIT,
    editPageThroughUI,
    ELEMENT_TIMEOUT,
    ensurePanelOpen,
    getPageTreeNodeByTitle,
    getVersionHistoryItems,
    getVersionHistoryModal,
    loginAndNavigateToChannel,
    openVersionHistoryModal,
    PAGE_LOAD_TIMEOUT,
    restorePageVersion,
    SHORT_WAIT,
    uniqueName,
    verifyVersionHistoryModal,
    WEBSOCKET_WAIT,
} from './test_helpers';

/**
 * @objective Verify page version history tracks edits and displays historical versions
 */
test('shows page version history after multiple edits', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and page through UI
    await createWikiThroughUI(page, uniqueName('History Wiki'));
    await createPageThroughUI(page, 'Version Test Page', 'Original content v1');

    // # Make first edit
    await editPageThroughUI(page, '\n\nEdited content v2');
    await page.waitForTimeout(AUTOSAVE_WAIT); // Wait for Redux store to update

    // # Make second edit
    await editPageThroughUI(page, '\n\nFinal content v3');
    await page.waitForTimeout(AUTOSAVE_WAIT); // Wait for Redux store to update

    // # Wait for page to be updated in Redux store (visible in tree)
    const pageNode = getPageTreeNodeByTitle(page, 'Version Test Page');
    await pageNode.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

    // # Additional wait to ensure Redux state is fully updated after edits
    await page.waitForTimeout(EDITOR_LOAD_WAIT);

    // # Open version history modal
    await openVersionHistoryModal(page, 'Version Test Page');

    // * Verify version history modal displays correctly (2 historical versions, current version excluded)
    await verifyVersionHistoryModal(page, 'Version Test Page', 2);
});

/**
 * @objective Verify non-author users can view version history of pages
 */
test('allows non-author to view page version history', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    // # User 1 creates page
    const {page: page1} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    const wiki = await createWikiThroughUI(page1, uniqueName('Shared Wiki'));
    const createdPage = await createPageThroughUI(page1, 'Shared Page', 'Content by user 1');

    // # Edit page to create version history
    await editPageThroughUI(page1, '\n\nEdited by user 1');
    await page1.waitForTimeout(AUTOSAVE_WAIT); // Wait for auto-save

    // # User 2 (non-author) opens the same wiki and page
    const {user: user2} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

    // Close user1 page after user2 is set up
    await page1.close();

    const {page: page2} = await pw.testBrowser.login(user2);

    // # Navigate directly to the wiki page URL
    const wikiPageUrl = buildWikiPageUrl(pw.url, team.name, channel.id, wiki.id, createdPage.id);
    await page2.goto(wikiPageUrl);
    await page2.waitForLoadState('networkidle');

    // # Wait for wiki view to load first
    await page2.waitForSelector('[data-testid="wiki-view"]', {state: 'visible', timeout: PAGE_LOAD_TIMEOUT});

    // # Ensure hierarchy panel is open
    await ensurePanelOpen(page2);

    // # Open version history as non-author
    await openVersionHistoryModal(page2, 'Shared Page');

    // * Verify non-author can see version history (1 historical version, current version excluded)
    const versionModal = getVersionHistoryModal(page2);
    await expect(versionModal).toBeVisible();

    const historyItems = getVersionHistoryItems(page2);
    await expect(historyItems).toHaveCount(1, {timeout: ELEMENT_TIMEOUT});
});

/**
 * @objective Verify page version history limits to 10 versions
 */
test('enforces 10-version limit in page history', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and page through UI
    await createWikiThroughUI(page, uniqueName('Version Limit Wiki'));
    await createPageThroughUI(page, 'Version Limit Test', 'Original version');

    // # Make 14 edits (total 15 versions including original)
    for (let i = 1; i <= 14; i++) {
        await editPageThroughUI(page, `\n\nEdit ${i}`);
        await page.waitForTimeout(SHORT_WAIT); // Small delay between edits
    }

    // # Wait for all edits to be saved
    await page.waitForTimeout(AUTOSAVE_WAIT);

    // # Open version history modal
    await openVersionHistoryModal(page, 'Version Limit Test');

    // * Verify only 10 versions are displayed (not all 15)
    const versionModal = getVersionHistoryModal(page);
    await expect(versionModal).toBeVisible();

    const historyItems = getVersionHistoryItems(page);
    await expect(historyItems).toHaveCount(10, {timeout: ELEMENT_TIMEOUT});
});

/**
 * @objective Verify version history modal displays edit timestamps and authors
 *
 * @precondition
 * Version history shows when edits were made but does not yet support full content restoration
 */
test('views version history modal with edit timestamps', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and page through UI
    await createWikiThroughUI(page, uniqueName('Version History Wiki'));
    await createPageThroughUI(page, 'Version History Page', 'Version 1 content');

    // # Make first edit
    await editPageThroughUI(page, '\n\nVersion 2 content');
    await page.waitForTimeout(AUTOSAVE_WAIT); // Wait for Redux store to update

    // # Make second edit
    await editPageThroughUI(page, '\n\nVersion 3 content');
    await page.waitForTimeout(AUTOSAVE_WAIT); // Wait for Redux store to update

    // # Wait for page to be updated in Redux store (visible in tree)
    const pageNode = getPageTreeNodeByTitle(page, 'Version History Page');
    await pageNode.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

    // # Additional wait to ensure Redux state is fully updated after edits
    await page.waitForTimeout(EDITOR_LOAD_WAIT);

    // # Open version history modal
    await openVersionHistoryModal(page, 'Version History Page');

    // * Verify version history modal displays correctly (2 historical versions, current version excluded)
    await verifyVersionHistoryModal(page, 'Version History Page', 2);

    // * Verify version history items display timestamps and authors
    const historyItems = getVersionHistoryItems(page);
    const firstItem = historyItems.first();

    // * Verify timestamp is displayed (e.g., "5 seconds ago", "1 minute ago", "Today")
    await expect(firstItem).toContainText(/(\d+\s+(second|minute|hour|day)s?\s+ago|Today|Yesterday)/i, {
        timeout: ELEMENT_TIMEOUT,
    });

    // * Expand first item to verify author is displayed
    await firstItem.click();
    await expect(firstItem).toContainText(user.username, {timeout: ELEMENT_TIMEOUT});
});

/**
 * @objective Verify restoring a previous page version from version history
 */
test('restores previous page version from version history', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and page with initial content
    await createWikiThroughUI(page, uniqueName('Restore Wiki'));
    await createPageThroughUI(page, 'Restore Test Page', 'Version 1: Original content');

    // # Make first edit
    await editPageThroughUI(page, '\n\nVersion 2: First edit');
    await page.waitForTimeout(AUTOSAVE_WAIT);

    // # Make second edit
    await editPageThroughUI(page, '\n\nVersion 3: Second edit');
    await page.waitForTimeout(AUTOSAVE_WAIT);

    // # Wait for page to be updated in Redux store
    const pageNode = getPageTreeNodeByTitle(page, 'Restore Test Page');
    await pageNode.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    await page.waitForTimeout(EDITOR_LOAD_WAIT);

    // # Open version history modal
    await openVersionHistoryModal(page, 'Restore Test Page');

    // * Verify version history shows 2 historical versions
    const historyItems = getVersionHistoryItems(page);
    await expect(historyItems).toHaveCount(2, {timeout: ELEMENT_TIMEOUT});

    // # Restore the first historical version (most recent edit before current)
    await restorePageVersion(page, 0);

    // * Verify version history modal closes after restore
    const versionModal = getVersionHistoryModal(page);
    await expect(versionModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Wait for WebSocket event to propagate and update stores
    await page.waitForTimeout(WEBSOCKET_WAIT);

    // * Verify page content shows the restored version (Version 2)
    const wikiView = page.locator('[data-testid="wiki-view"]');
    await expect(wikiView).toContainText('Version 2: First edit');
    await expect(wikiView).not.toContainText('Version 3: Second edit');

    // * Verify the page in hierarchy panel is still accessible (validates wiki store update)
    // This ensures the RECEIVED_PAGE_IN_WIKI action was dispatched via WebSocket
    const hierarchyPageNode = getPageTreeNodeByTitle(page, 'Restore Test Page');
    await expect(hierarchyPageNode).toBeVisible();

    // * Verify clicking the page in hierarchy still works (validates page metadata in wiki store)
    await hierarchyPageNode.click();
    await expect(wikiView).toContainText('Version 2: First edit', {timeout: ELEMENT_TIMEOUT});

    // # Reopen version history to verify restore created a new version
    await openVersionHistoryModal(page, 'Restore Test Page');

    // * Verify version history now shows 3 historical versions
    await expect(historyItems).toHaveCount(3, {timeout: ELEMENT_TIMEOUT});
});

/**
 * @objective Verify non-author users can restore page versions
 */
test('allows non-author to restore page version', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    // # User 1 creates page and makes edits
    const {page: page1} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    const wiki = await createWikiThroughUI(page1, uniqueName('Restore Wiki'));
    const createdPage = await createPageThroughUI(page1, 'Shared Restore Page', 'Version 1: Original by user1');

    // # Make edits to create version history
    await editPageThroughUI(page1, '\n\nVersion 2: Edit by user1');
    await page1.waitForTimeout(AUTOSAVE_WAIT);

    await editPageThroughUI(page1, '\n\nVersion 3: Another edit');
    await page1.waitForTimeout(AUTOSAVE_WAIT);

    // # User 2 (non-author) joins channel
    const {user: user2} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

    // Close user1 page after user2 is set up
    await page1.close();

    const {page: page2} = await pw.testBrowser.login(user2);

    // # Navigate directly to the wiki page URL
    const wikiPageUrl = buildWikiPageUrl(pw.url, team.name, channel.id, wiki.id, createdPage.id);
    await page2.goto(wikiPageUrl);
    await page2.waitForLoadState('networkidle');

    // # Wait for wiki view to load
    await page2.waitForSelector('[data-testid="wiki-view"]', {state: 'visible', timeout: PAGE_LOAD_TIMEOUT});

    // # Ensure hierarchy panel is open
    await ensurePanelOpen(page2);

    // # Open version history as non-author
    await openVersionHistoryModal(page2, 'Shared Restore Page');

    // * Verify version history shows 2 historical versions
    const historyItems = getVersionHistoryItems(page2);
    await expect(historyItems).toHaveCount(2, {timeout: ELEMENT_TIMEOUT});

    // # Non-author restores a previous version
    await restorePageVersion(page2, 0);

    // * Verify version history modal closes after restore
    const versionModal = getVersionHistoryModal(page2);
    await expect(versionModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Wait for WebSocket event to propagate
    await page2.waitForTimeout(WEBSOCKET_WAIT);

    // * Verify page content shows the restored version
    const wikiView = page2.locator('[data-testid="wiki-view"]');
    await expect(wikiView).toContainText('Version 2: Edit by user1');
    await expect(wikiView).not.toContainText('Version 3: Another edit');

    // # Reopen version history to verify restore created a new version
    await openVersionHistoryModal(page2, 'Shared Restore Page');

    // * Verify version history now shows 3 historical versions
    await expect(historyItems).toHaveCount(3, {timeout: ELEMENT_TIMEOUT});
});
