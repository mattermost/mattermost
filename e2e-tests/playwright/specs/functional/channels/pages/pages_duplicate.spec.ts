// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';
import {
    createWikiThroughUI,
    createPageThroughUI,
    createChildPageThroughContextMenu,
    createTestChannel,
    ensurePanelOpen,
    getPageViewerContent,
    getHierarchyPanel,
    waitForPageInHierarchy,
    waitForDuplicatedPageInHierarchy,
    duplicatePageThroughUI,
    openMovePageModal,
    loginAndNavigateToChannel,
    uniqueName,
    EDITOR_LOAD_WAIT,
    AUTOSAVE_WAIT,
    ELEMENT_TIMEOUT,
} from './test_helpers';

/**
 * @objective Verify page duplication creates a copy with default "Copy of [title]" naming at same level
 */
test('duplicates page to same wiki with default title', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and original page through UI
    await createWikiThroughUI(page, uniqueName('Duplicate Wiki'));
    const originalPage = await createPageThroughUI(page, 'Original Page', 'Original content here');

    // # Wait for page to be fully committed to database
    await page.waitForTimeout(EDITOR_LOAD_WAIT);

    // # Ensure panel is open
    await ensurePanelOpen(page);

    // # Duplicate the page using context menu (immediate action, no modal)
    await duplicatePageThroughUI(page, originalPage.id);

    // * Verify duplicated page appears in hierarchy with "Copy of" prefix
    const duplicateNode = await waitForDuplicatedPageInHierarchy(page, 'Copy of Original Page');

    // # Click on duplicated page to view it
    await duplicateNode.click();
    await page.waitForLoadState('networkidle');

    // * Verify duplicated page content is the same as original
    const pageContent = getPageViewerContent(page);
    await expect(pageContent).toContainText('Original content here');
});

/**
 * @objective Verify page duplication places duplicate at same level as source (inherits parent)
 */
test('duplicates child page at same level as source', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and parent page
    await createWikiThroughUI(page, uniqueName('Hierarchy Wiki'));
    const parentPage = await createPageThroughUI(page, 'Parent Page', 'Parent content');

    // # Create a child page under the parent
    const childPage = await createChildPageThroughContextMenu(page, parentPage.id!, 'Child Page', 'Child content');

    // # Ensure hierarchy panel is open
    await ensurePanelOpen(page);

    // # Wait for child page to appear in hierarchy
    await waitForPageInHierarchy(page, 'Child Page', 15000);

    // # Duplicate the child page (immediate action)
    await duplicatePageThroughUI(page, childPage.id);

    // * Verify duplicated page appears as sibling under same parent
    const duplicateChild = await waitForDuplicatedPageInHierarchy(page, 'Copy of Child Page');

    // # Click on duplicated child page
    await duplicateChild.click();
    await page.waitForLoadState('networkidle');

    // * Verify content is copied
    const pageContent = getPageViewerContent(page);
    await expect(pageContent).toContainText('Child content');
});

/**
 * @objective Verify page content is duplicated correctly
 */
test('duplicates page content correctly', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and page with content
    await createWikiThroughUI(page, uniqueName('Content Wiki'));
    const contentPage = await createPageThroughUI(
        page,
        'Content Page',
        'This is the original page content with some text.',
    );

    // # Wait for page to be fully committed to database
    await page.waitForTimeout(AUTOSAVE_WAIT);

    // # Ensure panel is open
    await ensurePanelOpen(page);

    // # Duplicate the page (immediate action)
    await duplicatePageThroughUI(page, contentPage.id);

    // # Wait for duplicated page to appear and click on it
    const duplicateNode = await waitForDuplicatedPageInHierarchy(page, 'Copy of Content Page');
    await duplicateNode.click();
    await page.waitForLoadState('networkidle');

    // * Verify content is duplicated
    const pageContent = getPageViewerContent(page);
    await expect(pageContent).toContainText('This is the original page content with some text.');
});

/**
 * @objective Verify page duplication maintains hierarchy structure by placing duplicates at same level
 */
test('duplicates root page at root level', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and root-level pages
    await createWikiThroughUI(page, uniqueName('Root Level Wiki'));
    const rootPage1 = await createPageThroughUI(page, 'Root Page 1', 'First root content');
    await createPageThroughUI(page, 'Root Page 2', 'Second root content');

    // # Ensure panel is open
    await ensurePanelOpen(page);

    // # Duplicate the first root page
    await duplicatePageThroughUI(page, rootPage1.id);

    // * Verify duplicated page appears at root level
    const duplicateNode = await waitForDuplicatedPageInHierarchy(page, 'Copy of Root Page 1');

    // # Click on duplicated page
    await duplicateNode.click();
    await page.waitForLoadState('networkidle');

    // * Verify content is copied
    const pageContent = getPageViewerContent(page);
    await expect(pageContent).toContainText('First root content');
});

/**
 * @objective Verify duplicated page can be moved to a new parent
 * Regression test: Move modal was not showing for duplicated pages
 */
test('moves duplicated page to new parent', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and two pages through UI
    await createWikiThroughUI(page, uniqueName('Move Duplicate Wiki'));
    const page1 = await createPageThroughUI(page, 'Page 1', 'Page 1 content');
    const page2 = await createPageThroughUI(page, 'Page 2', 'Page 2 content');

    // # Wait for pages to be fully committed to database
    await page.waitForTimeout(EDITOR_LOAD_WAIT);

    // # Ensure panel is open
    await ensurePanelOpen(page);

    // # Duplicate Page 1
    await duplicatePageThroughUI(page, page1.id);

    // * Verify duplicated page appears in hierarchy
    const duplicateNode = await waitForDuplicatedPageInHierarchy(page, 'Copy of Page 1');
    await expect(duplicateNode).toBeVisible();

    // # Open move modal for the duplicated page
    const moveModal = await openMovePageModal(page, 'Copy of Page 1');

    // * Verify move modal is visible
    await expect(moveModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Select Page 2 as new parent
    const page2Option = moveModal.locator(`[data-page-id="${page2.id}"]`).first();
    await page2Option.click();

    const confirmButton = moveModal.getByRole('button', {name: 'Move'});
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();

    // Wait for modal to close
    await expect(moveModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});
    await page.waitForLoadState('networkidle');

    // * Verify duplicated page now appears under Page 2 in hierarchy
    const hierarchyPanel = getHierarchyPanel(page);
    const page2Node = hierarchyPanel.locator('[data-page-id="' + page2.id + '"]').first();
    await expect(page2Node).toBeVisible();

    // Expand Page 2 to reveal children
    const expandButton = page2Node.locator('[data-testid="page-tree-node-expand-button"]').first();
    await expect(expandButton).toBeVisible();
    const chevronRight = page2Node.locator('.icon-chevron-right').first();
    if ((await chevronRight.count()) > 0) {
        await expandButton.click();
    }

    // * Verify "Copy of Page 1" is now a child of Page 2
    const movedDuplicateNode = hierarchyPanel
        .locator('[data-testid="page-tree-node"]')
        .filter({hasText: 'Copy of Page 1'})
        .first();
    await expect(movedDuplicateNode).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await expect(movedDuplicateNode).toHaveAttribute('data-depth', '1', {timeout: ELEMENT_TIMEOUT});
});
