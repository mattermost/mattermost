// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';
import {
    createChildPageThroughContextMenu,
    createPageThroughUI,
    createTestChannel,
    createWikiThroughUI,
    DEFAULT_PAGE_STATUS,
    deleteDefaultDraftThroughUI,
    deletePageThroughUI,
    editPageThroughUI,
    getHierarchyPanel,
    getPageViewerContent,
    loginAndNavigateToChannel,
    SHORT_WAIT,
    uniqueName,
} from './test_helpers';

/**
 * @objective Verify full page creation flow: create wiki through bookmarks UI, then create page
 */
test('creates wiki and root page through full UI flow', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through bookmarks UI
    await createWikiThroughUI(page, uniqueName('Test Wiki'));

    // * Verify navigated to new wiki
    await expect(page).toHaveURL(/\/wiki\/[^/]+\/[^/]+/);

    // # Create page through UI
    await createPageThroughUI(page, 'New Test Page', 'Page content here');

    // * Verify page created and content displayed
    const pageContent = getPageViewerContent(page);
    await expect(pageContent).toBeVisible();
    await expect(pageContent).toContainText('Page content here');
});

/**
 * @objective Verify child page creation through full UI flow
 */
test('creates child page under parent', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Test Wiki'));

    // # Create parent page through UI
    const parentPage = await createPageThroughUI(page, 'Parent Page', 'Parent content');

    // # Create child page through context menu
    await createChildPageThroughContextMenu(page, parentPage.id!, 'Child Page', 'Child content');

    // * Verify child page created
    const pageContent = getPageViewerContent(page);
    await expect(pageContent).toContainText('Child content');
});

/**
 * @objective Verify reading/viewing published page through full UI flow
 */
test('views published page', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and page through UI
    await createWikiThroughUI(page, uniqueName('View Wiki'));
    await createPageThroughUI(page, 'Test Page', 'Test content to view');

    // * Verify page content displayed
    const pageContent = getPageViewerContent(page);
    await expect(pageContent).toBeVisible();
    await expect(pageContent).toContainText('Test content to view');
});

/**
 * @objective Verify page update flow through full UI
 */
test('updates existing page content', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and page through UI
    await createWikiThroughUI(page, uniqueName('Update Wiki'));
    await createPageThroughUI(page, 'Page to Update', 'Original content');

    // # Edit the page by replacing content
    await editPageThroughUI(page, 'Completely new updated content', true);

    // * Verify original content was replaced (not appended)
    const pageContent = getPageViewerContent(page);
    await expect(pageContent).toContainText('Completely new updated content');
    await expect(pageContent).not.toContainText('Original content');
});

/**
 * @objective Verify page deletion through full UI flow
 */
test('deletes page', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and page through UI
    await createWikiThroughUI(page, uniqueName('Delete Wiki'));
    const testPage = await createPageThroughUI(page, 'Page to Delete', 'Content');

    // # Delete the page through sidebar context menu
    await deletePageThroughUI(page, 'Page to Delete');

    // * Verify navigated away from deleted page
    await expect(async () => {
        const currentUrl = page.url();
        expect(currentUrl).not.toMatch(new RegExp(`/pages/${testPage.id}`));
    }).toPass({timeout: SHORT_WAIT});

    // * Verify page no longer appears in hierarchy panel
    const hierarchyPanel = getHierarchyPanel(page);
    await expect(hierarchyPanel).not.toContainText('Page to Delete');
});

/**
 * @objective Verify wiki is created with a default draft page
 */
test('wiki starts with default draft page', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('New Wiki'));

    // * Verify default draft page appears in sidebar
    const draftNode = page.locator('[data-testid="page-tree-node"][data-is-draft="true"]');
    await expect(draftNode).toBeVisible();
});

/**
 * @objective Verify empty state appears after deleting the default draft
 */
test('shows empty state after deleting default draft', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Empty Wiki'));

    // # Delete the default draft
    await deleteDefaultDraftThroughUI(page);

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
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Multi Page Wiki'));

    // # Create multiple pages through UI
    await createPageThroughUI(page, 'Page 1', 'Content 1');
    await createPageThroughUI(page, 'Page 2', 'Content 2');
    await createPageThroughUI(page, 'Page 3', 'Content 3');

    // * Verify all pages appear in hierarchy
    const hierarchyPanel = getHierarchyPanel(page);
    await expect(hierarchyPanel).toContainText('Page 1');
    await expect(hierarchyPanel).toContainText('Page 2');
    await expect(hierarchyPanel).toContainText('Page 3');
});

/**
 * @objective Verify page metadata (author, status) is displayed correctly through full UI flow
 */
test('displays page metadata', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and page through UI
    await createWikiThroughUI(page, uniqueName('Meta Wiki'));
    await createPageThroughUI(page, 'Page with Metadata', 'Test content');

    // * Verify metadata container is visible
    const metadata = page.locator('[data-testid="page-viewer-meta"]');
    await expect(metadata).toBeVisible();

    // * Verify author displays correct username
    const author = page.locator('[data-testid="page-viewer-author"]');
    await expect(author).toBeVisible();
    await expect(author).toContainText('By');
    await expect(author).toContainText(user.username);

    // * Verify status displays default status for published pages
    const status = page.locator('[data-testid="page-viewer-status"]');
    await expect(status).toBeVisible();
    await expect(status).toContainText(DEFAULT_PAGE_STATUS);
});

/**
 * @objective Verify that a page can be exported to PDF format
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
test.skip('exports page to PDF', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    // Implementation TBD
});
