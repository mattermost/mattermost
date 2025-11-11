// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';

import {createWikiThroughUI, createPageThroughUI, createChildPageThroughContextMenu, createTestChannel} from './test_helpers';

/**
 * @objective Verify full page creation flow: create wiki through bookmarks UI, then create page
 */
test('creates wiki and root page through full UI flow', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through bookmarks UI
    const wiki = await createWikiThroughUI(page, `Test Wiki ${pw.random.id()}`);

    // * Verify navigated to new wiki
    await expect(page).toHaveURL(/\/wiki\/[^/]+\/[^/]+/);

    // # Create page through UI
    await createPageThroughUI(page, 'New Test Page', 'Page content here');

    // * Verify page created and content displayed
    const pageContent = page.locator('[data-testid="page-viewer-content"]');
    await expect(pageContent).toBeVisible();
    await expect(pageContent).toContainText('Page content here');
});

/**
 * @objective Verify child page creation through full UI flow
 */
test('creates child page under parent', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, `Test Wiki ${pw.random.id()}`);

    // # Create parent page through UI
    const parentPage = await createPageThroughUI(page, 'Parent Page', 'Parent content');

    // # Create child page through context menu
    await createChildPageThroughContextMenu(page, parentPage.id!, 'Child Page', 'Child content');

    // * Verify child page created
    const pageContent = page.locator('[data-testid="page-viewer-content"]');
    await expect(pageContent).toContainText('Child content');
});

/**
 * @objective Verify reading/viewing published page through full UI flow
 */
test('views published page', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki and page through UI
    await createWikiThroughUI(page, `View Wiki ${pw.random.id()}`);
    await createPageThroughUI(page, 'Test Page', 'Test content to view');

    // * Verify page content displayed
    const pageContent = page.locator('[data-testid="page-viewer-content"]');
    await expect(pageContent).toBeVisible();
    await expect(pageContent).toContainText('Test content to view');
});

/**
 * @objective Verify page update flow through full UI
 */
test('updates existing page content', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki and page through UI
    await createWikiThroughUI(page, `Update Wiki ${pw.random.id()}`);
    await createPageThroughUI(page, 'Page to Update', 'Original content');

    // # Edit the page
    const editButton = page.locator('[data-testid="wiki-page-edit-button"]');
    await editButton.click();

    const editor = page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();
    await editor.click();
    await page.keyboard.press('End');
    await editor.type(' Updated content');

    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]');
    await publishButton.click();
    await page.waitForLoadState('networkidle');

    // * Verify updated content displayed
    const pageContent = page.locator('[data-testid="page-viewer-content"]');
    await expect(pageContent).toContainText('Updated content');
});

/**
 * @objective Verify page deletion through full UI flow
 */
test('deletes page', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki and page through UI
    await createWikiThroughUI(page, `Delete Wiki ${pw.random.id()}`);
    const testPage = await createPageThroughUI(page, 'Page to Delete', 'Content');

    // # Delete the page through sidebar context menu
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');
    const pageNode = hierarchyPanel.locator('[data-testid="page-tree-node"]', {hasText: 'Page to Delete'});

    // Click the menu button on the page node
    const menuButton = pageNode.locator('[data-testid="page-tree-node-menu-button"]');
    await menuButton.click();

    // Click delete from the context menu
    const deleteMenuItem = page.locator('[data-testid="page-context-menu-delete"]');
    await deleteMenuItem.click();

    // # Confirm deletion in modal (now using MM modal instead of browser confirm)
    const confirmDialog = page.getByRole('dialog', {name: /Delete|Confirm/i});
    await expect(confirmDialog).toBeVisible({timeout: 3000});

    const confirmButton = confirmDialog.getByRole('button', {name: /Delete|Confirm/i});
    await confirmButton.click();

    await page.waitForLoadState('networkidle');

    // * Verify navigated away from deleted page
    await page.waitForTimeout(500);
    const currentUrl = page.url();
    expect(currentUrl).not.toMatch(new RegExp(`/pages/${testPage.id}`));

    // * Verify page no longer appears in hierarchy panel
    await expect(hierarchyPanel).not.toContainText('Page to Delete');
});

/**
 * @objective Verify page duplication through full UI flow
 */
test.skip('duplicates page', {tag: '@pages'}, async ({pw}) => {
    // TODO: Page duplication functionality not yet implemented
    // Confluence reference: Uses "More actions" → "Duplicate" menu option
    // Copies: content, attachments, labels, restrictions
    // Does not copy: comments, version history
    // New page named: "Duplicate of [originalItemName]"

    const channel = await createTestChannel(sharedAdminClient, sharedTeam.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(sharedUser);
    await channelsPage.goto(sharedTeam.name, channel.name);

    // # Create wiki and page through UI
    await createWikiThroughUI(page, `Duplicate Wiki ${pw.random.id()}`);
    await createPageThroughUI(page, 'Original Page', 'Content to duplicate');

    // # Duplicate the page
    const pageActions = page.locator('[data-testid="page-actions"], [data-testid="wiki-page-more-actions"]').first();
    await pageActions.click();

    const duplicateButton = page.locator('[data-testid="page-context-menu-duplicate"]').first();
    await expect(duplicateButton).toBeVisible();
    await duplicateButton.click();
    await page.waitForLoadState('networkidle');
});

/**
 * @objective Verify wiki is created with a default draft page
 */
test('wiki starts with default draft page', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, `New Wiki ${pw.random.id()}`);

    // * Verify default draft page appears in sidebar
    const draftNode = page.locator('[data-testid="page-tree-node"]').filter({has: page.locator('[data-testid="draft-badge"]')});
    await expect(draftNode).toBeVisible();
});

/**
 * @objective Verify empty state appears after deleting the default draft
 */
test('shows empty state after deleting default draft', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, `Empty Wiki ${pw.random.id()}`);

    // # Wait for default draft to load and delete it
    const draftNode = page.locator('[data-testid="page-tree-node"]').filter({has: page.locator('[data-testid="draft-badge"]')});
    await draftNode.waitFor({state: 'visible', timeout: 10000});

    const menuButton = draftNode.locator('[data-testid="page-tree-node-menu-button"]');
    await menuButton.click();

    const deleteMenuItem = page.locator('[data-testid="page-context-menu-delete"]');
    await deleteMenuItem.click();

    // # Confirm deletion in modal
    const deleteButton = page.locator('[data-testid="delete-button"]');
    await deleteButton.waitFor({state: 'visible', timeout: 5000});
    await deleteButton.click();

    await page.waitForLoadState('networkidle');

    // * Verify empty state displayed
    const emptyState = page.locator('[data-testid="pages-hierarchy-empty"]');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText(/no pages/i);
});

/**
 * @objective Verify page list rendering through full UI flow
 */
test('displays multiple pages in hierarchy', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, `Multi Page Wiki ${pw.random.id()}`);

    // # Create multiple pages through UI
    await createPageThroughUI(page, 'Page 1', 'Content 1');
    await createPageThroughUI(page, 'Page 2', 'Content 2');
    await createPageThroughUI(page, 'Page 3', 'Content 3');

    // * Verify all pages appear in hierarchy
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');
    await expect(hierarchyPanel).toContainText('Page 1');
    await expect(hierarchyPanel).toContainText('Page 2');
    await expect(hierarchyPanel).toContainText('Page 3');
});

/**
 * @objective Verify page metadata (author, status) is displayed correctly through full UI flow
 */
test('displays page metadata', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki and page through UI
    await createWikiThroughUI(page, `Meta Wiki ${pw.random.id()}`);
    await createPageThroughUI(page, 'Page with Metadata', 'Test content');

    // * Verify metadata container is visible
    const metadata = page.locator('[data-testid="page-viewer-meta"]');
    await expect(metadata).toBeVisible();

    // * Verify author is displayed
    const author = page.locator('[data-testid="page-viewer-author"]');
    await expect(author).toBeVisible();
    await expect(author).toContainText('By');

    // * Verify status is displayed
    const status = page.locator('[data-testid="page-viewer-status"]');
    await expect(status).toBeVisible();
});

test.skip('shows page version history', {tag: '@pages'}, async ({pw}) => {
    // Implementation TBD
});

test.skip('exports page to PDF', {tag: '@pages'}, async ({pw}) => {
    // Implementation TBD
});
