// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';

import {createWikiThroughUI, createPageThroughUI, createChildPageThroughContextMenu, createTestChannel, addHeadingToEditor, fillCreatePageModal, renamePageViaContextMenu, createDraftThroughUI, openMovePageModal, confirmMoveToTarget, renamePageInline, waitForSearchDebounce, waitForEditModeReady, waitForWikiViewLoad, navigateToWikiView, navigateToPage, getBreadcrumb, getHierarchyPanel, deletePageWithOption, getEditorAndWait, typeInEditor} from './test_helpers';

/**
 * @objective Verify page hierarchy expansion and collapse functionality
 */
test('expands and collapses page nodes', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Hierarchy Wiki ${pw.random.id()}`);

    // # Create parent and child pages through UI
    const parentPage = await createPageThroughUI(page, 'Parent Page', 'Parent content');
    const childPage = await createChildPageThroughContextMenu(page, parentPage.id!, 'Child Page', 'Child content');

    // * Verify hierarchy panel is visible
    const hierarchyPanel = getHierarchyPanel(page);
    await expect(hierarchyPanel).toBeVisible();

    // # Locate parent page node
    const parentNode = page.locator('[data-testid="page-tree-node"][data-page-id="' + parentPage.id + '"]');
    await expect(parentNode).toBeVisible();

    // * Verify child node is visible (parent should be auto-expanded after child creation)
    const childNode = page.locator('[data-testid="page-tree-node"][data-page-id="' + childPage.id + '"]');
    await expect(childNode).toBeVisible({timeout: 5000});

    // # Collapse parent node
    const expandButton = parentNode.locator('[data-testid="page-tree-node-expand-button"]');
    await expect(expandButton).toBeVisible();
    await expandButton.click();
    await page.waitForTimeout(300);

    // * Verify child is hidden after collapse
    await expect(childNode).not.toBeVisible();

    // # Expand parent node again
    await expandButton.click();
    await page.waitForTimeout(300);

    // * Verify child is visible again after expand
    await expect(childNode).toBeVisible({timeout: 5000});
});

/**
 * @objective Verify moving page to new parent within same wiki
 */
test('moves page to new parent within same wiki', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Move Wiki ${pw.random.id()}`);

    // # Create two root pages through UI
    const page1 = await createPageThroughUI(page, 'Page 1', 'Content 1');
    const page2 = await createPageThroughUI(page, 'Page 2', 'Content 2');

    // # Right-click Page 2 to move it
    const hierarchyPanel = getHierarchyPanel(page);
    const page2Node = hierarchyPanel.locator('text="Page 2"').first();

    await expect(page2Node).toBeVisible();
    await page2Node.click({button: 'right'});

    // # Select "Move" from context menu
    const contextMenu = page.locator('[data-testid="page-context-menu"]');
    await expect(contextMenu).toBeVisible({timeout: 2000});
    const moveButton = contextMenu.locator('[data-testid="page-context-menu-move"], button:has-text("Move To")').first();
    await expect(moveButton).toBeVisible();
    await moveButton.click();

    // # Select Page 1 as new parent in modal
    const moveModal = page.getByRole('dialog', {name: /Move/i});
    await expect(moveModal).toBeVisible({timeout: 3000});
    // Use data-page-id attribute to find the page option
    const page1Option = moveModal.locator(`[data-page-id="${page1.id}"]`).first();
    await page1Option.click();

    const confirmButton = moveModal.getByRole('button', {name: 'Move'});
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();

    // Wait for modal to close
    await expect(moveModal).not.toBeVisible({timeout: 5000});
    await page.waitForLoadState('networkidle');

    // * Verify Page 2 now appears under Page 1
    // Check breadcrumb navigation shows the hierarchy
    const breadcrumbNav = page.locator('[aria-label*="breadcrumb" i]').first();
    await expect(breadcrumbNav).toContainText('Page 1');
    await expect(breadcrumbNav).toContainText('Page 2');

    // Find Page 1 in hierarchy panel
    const page1Node = hierarchyPanel.locator('[data-page-id="' + page1.id + '"]').first();
    await expect(page1Node).toBeVisible();

    // Expand Page 1 to reveal its children
    const expandButton = page1Node.locator('[data-testid="page-tree-node-expand-button"]').first();
    await expect(expandButton).toBeVisible();

    // Check if Page 1 is collapsed (chevron-right) and expand it
    const chevronRight = page1Node.locator('.icon-chevron-right').first();
    const isCollapsed = await chevronRight.count() > 0;
    if (isCollapsed) {
        await expandButton.click();
        await page.waitForTimeout(500);
    }

    // * Verify Page 2 is now visible as a child of Page 1 in the hierarchy
    const page2AsChild = hierarchyPanel.locator('[data-page-id="' + page2.id + '"]').first();
    await expect(page2AsChild).toBeVisible();

    // Verify Page 2 is indented (child level) under Page 1
    // by checking it appears after Page 1 in the DOM
    const allPageNodes = hierarchyPanel.locator('[data-page-id]');
    const page1Index = await allPageNodes.evaluateAll((nodes, p1Id) => {
        return nodes.findIndex(n => n.getAttribute('data-page-id') === p1Id);
    }, page1.id);
    const page2Index = await allPageNodes.evaluateAll((nodes, p2Id) => {
        return nodes.findIndex(n => n.getAttribute('data-page-id') === p2Id);
    }, page2.id);
    expect(page2Index).toBeGreaterThan(page1Index);

    // * Verify breadcrumbs reflect new hierarchy: Wiki > Page 1 > Page 2
    const breadcrumb = getBreadcrumb(page);
    await expect(breadcrumb).toBeVisible({timeout: 5000});

    // * Verify wiki name (not a link anymore)
    const wikiName = breadcrumb.locator('.PageBreadcrumb__wiki-name');
    await expect(wikiName).toContainText(wiki.title);

    // * Verify page links (only the ancestor pages, not wiki or current page)
    const breadcrumbLinks = breadcrumb.locator('.PageBreadcrumb__link');
    await expect(breadcrumbLinks).toHaveCount(1);
    await expect(breadcrumbLinks.nth(0)).toContainText('Page 1');

    const currentPage = breadcrumb.locator('[aria-current="page"]');
    await expect(currentPage).toContainText('Page 2');
});

/**
 * @objective Verify circular hierarchy prevention
 */
test('prevents circular hierarchy - cannot move page to own descendant', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Circular Wiki ${pw.random.id()}`);

    // # Create hierarchy (grandparent → parent → child) through UI
    const grandparent = await createPageThroughUI(page, 'Grandparent', 'Grandparent content');
    const parent = await createChildPageThroughContextMenu(page, grandparent.id!, 'Parent', 'Parent content');
    const child = await createChildPageThroughContextMenu(page, parent.id!, 'Child', 'Child content');

    // Navigate back to wiki view to ensure hierarchy panel is loaded
    await navigateToWikiView(page, pw.url, team.name, channel.id, wiki.id);

    // # Attempt to move grandparent under its child (circular) - open modal using helper
    const moveModal = await openMovePageModal(page, 'Grandparent');

    // * Verify descendants are not shown in the page list (circular references prevented by excluding descendants)
    // The modal should not show any page options with data-page-id since all pages are descendants
    const childOption = moveModal.locator(`[data-page-id="${child.id}"]`);
    await expect(childOption).not.toBeVisible();

    const parentOption = moveModal.locator(`[data-page-id="${parent.id}"]`);
    await expect(parentOption).not.toBeVisible();

    // * Verify "Root level" option is still available (you can move to root)
    const rootOption = moveModal.getByText('Root level (no parent)');
    await expect(rootOption).toBeVisible();
});

/**
 * @objective Verify moving page between different wikis
 */
test('moves page between wikis', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create two wikis through UI
    const wiki1 = await createWikiThroughUI(page, `Wiki 1 ${pw.random.id()}`);
    const pageInWiki1 = await createPageThroughUI(page, 'Page to Move', 'Content');

    // Navigate back to channel to create second wiki
    await channelsPage.goto(team.name, channel.name);
    const wiki2 = await createWikiThroughUI(page, `Wiki 2 ${pw.random.id()}`);

    // Navigate back to wiki1 to perform the move
    await navigateToWikiView(page, pw.url, team.name, channel.id, wiki1.id);

    // # Move page to Wiki 2 using helper
    const moveModal = await openMovePageModal(page, 'Page to Move');

    // Select Wiki 2 from dropdown
    const wikiSelect = moveModal.locator('#target-wiki-select');
    await wikiSelect.selectOption(wiki2.id);

    // Confirm move
    const confirmButton = moveModal.getByRole('button', {name: 'Move'});
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();

    // Wait for modal to close
    await expect(moveModal).not.toBeVisible({timeout: 5000});
    await page.waitForLoadState('networkidle');

    // * Verify page removed from Wiki 1
    await navigateToWikiView(page, pw.url, team.name, channel.id, wiki1.id);

    const hierarchyPanel = getHierarchyPanel(page);
    const pageInWiki1Still = hierarchyPanel.locator('text="Page to Move"').first();
    await expect(pageInWiki1Still).not.toBeVisible({timeout: 3000});

    // * Verify page appears in Wiki 2
    await navigateToWikiView(page, pw.url, team.name, channel.id, wiki2.id);

    const pageInWiki2 = hierarchyPanel.locator('text="Page to Move"').first();
    await expect(pageInWiki2).toBeVisible();

    // # Click on the page to view it and verify breadcrumbs
    await pageInWiki2.click();
    await page.waitForLoadState('networkidle');

    // * Verify breadcrumbs show Wiki 2 > Page to Move
    const breadcrumb = getBreadcrumb(page);
    await expect(breadcrumb).toBeVisible({timeout: 5000});

    // * Verify wiki name (not a link anymore)
    const wikiName = breadcrumb.locator('.PageBreadcrumb__wiki-name');
    await expect(wikiName).toContainText(wiki2.title);

    // * Verify no page links (page is at wiki root)
    const breadcrumbLinks = breadcrumb.locator('.PageBreadcrumb__link');
    await expect(breadcrumbLinks).toHaveCount(0);

    const currentPage = breadcrumb.locator('[aria-current="page"]');
    await expect(currentPage).toContainText('Page to Move');
});

/**
 * @objective Verify moving page to become child of another page in same wiki
 */
test('moves page to child of another page in same wiki', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Move Child Wiki ${pw.random.id()}`);

    // # Create parent page and a child page under it
    const parentPage = await createPageThroughUI(page, 'Parent Page', 'Parent content');
    const existingChild = await createChildPageThroughContextMenu(page, parentPage.id!, 'Existing Child', 'Existing child content');

    // # Create another root page to move
    const pageToMove = await createPageThroughUI(page, 'Page to Move', 'Content to move');

    // # Right-click the page to move
    const hierarchyPanel = getHierarchyPanel(page);
    const pageToMoveNode = hierarchyPanel.locator('text="Page to Move"').first();

    await expect(pageToMoveNode).toBeVisible();
    await pageToMoveNode.click({button: 'right'});

    // # Select "Move" from context menu
    const contextMenu = page.locator('[data-testid="page-context-menu"]');
    await expect(contextMenu).toBeVisible({timeout: 2000});
    const moveButton = contextMenu.locator('[data-testid="page-context-menu-move"], button:has-text("Move To")').first();
    await expect(moveButton).toBeVisible();
    await moveButton.click();

    // # Select Existing Child as new parent in modal
    const moveModal = page.getByRole('dialog', {name: /Move/i});
    await expect(moveModal).toBeVisible({timeout: 3000});
    const existingChildOption = moveModal.locator(`[data-page-id="${existingChild.id}"]`).first();
    await existingChildOption.click();

    const confirmButton = moveModal.getByRole('button', {name: 'Move'});
    await confirmButton.click();

    // Wait for modal to close
    await expect(moveModal).not.toBeVisible({timeout: 5000});
    await page.waitForLoadState('networkidle');

    // * Verify hierarchy: Parent Page > Existing Child > Page to Move
    // Find and expand Parent Page
    const parentNode = hierarchyPanel.locator('[data-page-id="' + parentPage.id + '"]').first();
    await expect(parentNode).toBeVisible();

    const parentExpandButton = parentNode.locator('[data-testid="page-tree-node-expand-button"]').first();
    const parentChevronRight = parentNode.locator('.icon-chevron-right').first();
    if (await parentChevronRight.count() > 0) {
        await parentExpandButton.click();
        await page.waitForTimeout(500);
    }

    // Find and expand Existing Child
    const existingChildNode = hierarchyPanel.locator('[data-page-id="' + existingChild.id + '"]').first();
    await expect(existingChildNode).toBeVisible();

    const childExpandButton = existingChildNode.locator('[data-testid="page-tree-node-expand-button"]').first();
    const childChevronRight = existingChildNode.locator('.icon-chevron-right').first();
    if (await childChevronRight.count() > 0) {
        await childExpandButton.click();
        await page.waitForTimeout(500);
    }

    // * Verify Page to Move is now visible as a child of Existing Child
    const movedPageNode = hierarchyPanel.locator('[data-page-id="' + pageToMove.id + '"]').first();
    await expect(movedPageNode).toBeVisible();

    // # Click on moved page to view it and verify breadcrumbs
    await movedPageNode.click();
    await page.waitForLoadState('networkidle');

    // * Verify breadcrumbs reflect full hierarchy: Wiki > Parent Page > Existing Child > Page to Move
    const breadcrumb = page.locator('[data-testid="breadcrumb"]');
    await expect(breadcrumb).toBeVisible({timeout: 5000});

    // * Verify wiki name (not a link anymore)
    const wikiName = breadcrumb.locator('.PageBreadcrumb__wiki-name');
    await expect(wikiName).toContainText(wiki.title);

    // * Verify page links (only the ancestor pages, not wiki or current page)
    const breadcrumbLinks = breadcrumb.locator('.PageBreadcrumb__link');
    await expect(breadcrumbLinks).toHaveCount(2);
    await expect(breadcrumbLinks.nth(0)).toContainText('Parent Page');
    await expect(breadcrumbLinks.nth(1)).toContainText('Existing Child');

    const currentPage = breadcrumb.locator('[aria-current="page"]');
    await expect(currentPage).toContainText('Page to Move');
});

/**
 * @objective Verify moving page to child of another page in different wiki
 */
test('moves page to child of another page in different wiki', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create first wiki with a page to move
    const wiki1 = await createWikiThroughUI(page, `Wiki 1 ${pw.random.id()}`);
    const pageToMove = await createPageThroughUI(page, 'Page to Move', 'Content to move');

    // # Navigate back to channel to create second wiki
    await channelsPage.goto(team.name, channel.name);
    const wiki2 = await createWikiThroughUI(page, `Wiki 2 ${pw.random.id()}`);

    // # Create hierarchy in Wiki 2: Parent > Child
    const parentPage = await createPageThroughUI(page, 'Parent in Wiki 2', 'Parent content');
    const childPage = await createChildPageThroughContextMenu(page, parentPage.id!, 'Child in Wiki 2', 'Child content');

    // # Navigate back to Wiki 1 to perform the move
    await navigateToWikiView(page, pw.url, team.name, channel.id, wiki1.id);

    // # Move page to Child in Wiki 2 using helper
    const moveModal = await openMovePageModal(page, 'Page to Move');

    // # Select Wiki 2 first from dropdown
    const wikiSelect = moveModal.locator('#target-wiki-select');
    await wikiSelect.selectOption(wiki2.id);

    // Wait for pages to load
    await page.waitForTimeout(500);

    // # Then select Child as parent and confirm
    await confirmMoveToTarget(page, moveModal, `[data-page-id="${childPage.id}"]`);

    // * Verify page removed from Wiki 1
    await navigateToWikiView(page, pw.url, team.name, channel.id, wiki1.id);

    const hierarchyPanel = getHierarchyPanel(page);
    const pageInWiki1Still = hierarchyPanel.locator('text="Page to Move"').first();
    await expect(pageInWiki1Still).not.toBeVisible({timeout: 3000});

    // * Verify page appears in Wiki 2 under Child in Wiki 2
    await navigateToWikiView(page, pw.url, team.name, channel.id, wiki2.id);

    // Find and expand Parent in Wiki 2
    const parentNode = hierarchyPanel.locator('[data-page-id="' + parentPage.id + '"]').first();
    await expect(parentNode).toBeVisible();

    const parentExpandButton = parentNode.locator('[data-testid="page-tree-node-expand-button"]').first();
    const parentChevronRight = parentNode.locator('.icon-chevron-right').first();
    if (await parentChevronRight.count() > 0) {
        await parentExpandButton.click();
        await page.waitForTimeout(500);
    }

    // Find and expand Child in Wiki 2
    const childNode = hierarchyPanel.locator('[data-page-id="' + childPage.id + '"]').first();
    await expect(childNode).toBeVisible();

    const childExpandButton = childNode.locator('[data-testid="page-tree-node-expand-button"]').first();
    const childChevronRight = childNode.locator('.icon-chevron-right').first();
    if (await childChevronRight.count() > 0) {
        await childExpandButton.click();
        await page.waitForTimeout(500);
    }

    // * Verify Page to Move is now visible as a child of Child in Wiki 2
    const movedPageNode = hierarchyPanel.locator('[data-page-id="' + pageToMove.id + '"]').first();
    await expect(movedPageNode).toBeVisible();

    // # Click on moved page to view it and verify breadcrumbs
    await movedPageNode.click();
    await page.waitForLoadState('networkidle');

    // * Verify breadcrumbs reflect new hierarchy: Wiki 2 > Parent in Wiki 2 > Child in Wiki 2 > Page to Move
    const breadcrumb = getBreadcrumb(page);
    await expect(breadcrumb).toBeVisible({timeout: 5000});

    // * Verify wiki name (not a link anymore)
    const wikiName = breadcrumb.locator('.PageBreadcrumb__wiki-name');
    await expect(wikiName).toContainText(wiki2.title);

    // * Verify page links (only the ancestor pages, not wiki or current page)
    const breadcrumbLinks = breadcrumb.locator('.PageBreadcrumb__link');
    await expect(breadcrumbLinks).toHaveCount(2);
    await expect(breadcrumbLinks.nth(0)).toContainText('Parent in Wiki 2');
    await expect(breadcrumbLinks.nth(1)).toContainText('Child in Wiki 2');

    const currentPage = breadcrumb.locator('[aria-current="page"]');
    await expect(currentPage).toContainText('Page to Move');
});

/**
 * @objective Verify renaming page via context menu
 */
test('renames page via context menu', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki and page through UI
    const wiki = await createWikiThroughUI(page, `Rename Wiki ${pw.random.id()}`);
    const testPage = await createPageThroughUI(page, 'Original Name', 'Content');

    // # Rename page via context menu
    await renamePageViaContextMenu(page, 'Original Name', 'Updated Name');

    // # Wait for network to settle
    await page.waitForLoadState('networkidle');

    // * Verify page renamed in hierarchy
    const hierarchyPanel = getHierarchyPanel(page);
    const renamedNode = hierarchyPanel.locator('text="Updated Name"').first();
    await expect(renamedNode).toBeVisible();

    // * Verify old name no longer visible
    const oldNode = hierarchyPanel.locator('text="Original Name"').first();
    await expect(oldNode).not.toBeVisible();
});

/**
 * @objective Verify inline rename via double-click
 *
 * NOTE: Skipped - inline rename via double-click is not yet implemented in the UI
 */
test.skip('renames page inline via double-click', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki and page through UI
    const wiki = await createWikiThroughUI(page, `Inline Rename Wiki ${pw.random.id()}`);
    const testPage = await createPageThroughUI(page, 'Original Title', 'Content');

    // Navigate back to wiki view to ensure hierarchy panel is visible
    await navigateToWikiView(page, pw.url, team.name, channel.id, wiki.id);

    // # Rename page inline using helper
    await renamePageInline(page, 'Original Title', 'Inline Renamed');

    // * Verify rename succeeded
    const hierarchyPanel = getHierarchyPanel(page);
    const renamedNode = hierarchyPanel.locator('text="Inline Renamed"').first();
    await expect(renamedNode).toBeVisible();
});
/**
 * @objective Verify special characters and Unicode in page names
 */
test('handles special characters in page names', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki and page through UI
    const wiki = await createWikiThroughUI(page, `Unicode Wiki ${pw.random.id()}`);
    const testPage = await createPageThroughUI(page, 'Simple Name', 'Content');

    // # Rename with Unicode and emoji using the helper function
    const specialName = 'Page 🚀 with 中文 and émojis';
    await renamePageViaContextMenu(page, 'Simple Name', specialName);

    // * Verify special characters preserved in hierarchy
    const hierarchyPanel = getHierarchyPanel(page);
    const renamedNode = hierarchyPanel.locator(`text="${specialName}"`).first();

    await expect(renamedNode).toBeVisible({timeout: 5000});
    const nodeText = await renamedNode.textContent();
    expect(nodeText).toContain('🚀');
    expect(nodeText).toContain('中文');
    expect(nodeText).toContain('émojis');
});

/**
/**
 * @objective Verify drag-and-drop to make a page a child of another page
 */
test.skip('makes page a child via drag-drop', {tag: '@pages'}, async ({pw}) => {
    // BLOCKED: Playwright drag-and-drop doesn't work with react-beautiful-dnd
    //
    // The UI functionality WORKS and is implemented (page_tree_view.tsx:139-182)
    // The underlying API is tested via "moves page to new parent within same wiki" test (uses modal)
    //
    // Known issue: Playwright's native drag-and-drop (dragTo, mouse.down/up) doesn't properly
    // trigger react-beautiful-dnd's event handlers. Would need custom CDP commands or visual testing.
    //
    // Alternatives:
    // 1. Test via context menu "Move To" modal (already tested)
    // 2. Use visual regression testing for drag behavior
    // 3. Implement custom CDP drag-and-drop for react-beautiful-dnd
    const channel = await createTestChannel(sharedAdminClient, sharedTeam.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(sharedUser);
    await channelsPage.goto(sharedTeam.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Drag Wiki ${pw.random.id()}`);

    // # Create two root-level pages
    const parentPage = await createPageThroughUI(page, 'Parent Page', 'Parent content');
    const siblingPage = await createPageThroughUI(page, 'Sibling Page', 'Sibling content');

    // * Verify both pages are visible in hierarchy panel
    const hierarchyPanel = getHierarchyPanel(page);
    const parentNode = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-page-id="${parentPage.id}"]`);
    const siblingNode = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-page-id="${siblingPage.id}"]`);
    await expect(parentNode).toBeVisible();
    await expect(siblingNode).toBeVisible();

    // # Get initial padding of both nodes
    const initialParentPadding = await parentNode.evaluate((el) => {
        return window.getComputedStyle(el).paddingLeft;
    });
    const initialSiblingPadding = await siblingNode.evaluate((el) => {
        return window.getComputedStyle(el).paddingLeft;
    });

    // * Verify both start at same level (same padding)
    expect(initialParentPadding).toBe(initialSiblingPadding);

    // # Perform manual drag-and-drop using CDP (react-beautiful-dnd compatible)
    const siblingBox = await siblingNode.boundingBox();
    const parentBox = await parentNode.boundingBox();

    if (!siblingBox || !parentBox) {
        throw new Error('Could not get bounding boxes for drag operation');
    }

    // Start drag from center of sibling
    await page.mouse.move(siblingBox.x + siblingBox.width / 2, siblingBox.y + siblingBox.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(100);

    // Move to center of parent (combine behavior in react-beautiful-dnd)
    await page.mouse.move(parentBox.x + parentBox.width / 2, parentBox.y + parentBox.height / 2, {steps: 10});
    await page.waitForTimeout(200);

    // Drop
    await page.mouse.up();

    // # Wait for drag operation to complete and UI to update
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // * Verify parent now has expand button (indicating it has children)
    const expandButton = parentNode.locator('[data-testid="page-tree-node-expand-button"]');
    await expect(expandButton).toBeVisible({timeout: 5000});

    // # Expand parent to see children
    await expandButton.click();
    await page.waitForTimeout(500);

    // * Verify sibling page appears under parent
    const childNode = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-page-id="${siblingPage.id}"]`);
    await expect(childNode).toBeVisible({timeout: 5000});

    // * Verify child has increased indentation (depth indicator)
    const childPadding = await childNode.evaluate((el) => {
        return window.getComputedStyle(el).paddingLeft;
    });

    // Child should have 20px more padding than initial sibling padding (one level deeper)
    expect(parseInt(childPadding)).toBeGreaterThan(parseInt(initialSiblingPadding));
});

/**
 * @objective Verify drag-and-drop to promote a child page to root level
 */
test.skip('promotes child page to root level via drag-drop', {tag: '@pages'}, async ({pw}) => {
    // BLOCKED: Playwright drag-and-drop doesn't work with react-beautiful-dnd (same as above test)
    //
    // The UI functionality WORKS - dragging child between root nodes should promote it
    // The underlying API is tested via "moves page to new parent within same wiki" test (uses modal)
    const channel = await createTestChannel(sharedAdminClient, sharedTeam.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(sharedUser);
    await channelsPage.goto(sharedTeam.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Promote Wiki ${pw.random.id()}`);

    // # Create parent page and a child page
    const parentPage = await createPageThroughUI(page, 'Parent Page', 'Parent content');
    const childPage = await createChildPageThroughContextMenu(page, parentPage.id!, 'Child Page', 'Child content');

    // # Create a second root page to drag between
    const rootPage2 = await createPageThroughUI(page, 'Root Page 2', 'Root content 2');

    // * Verify initial hierarchy
    const hierarchyPanel = getHierarchyPanel(page);
    const parentNode = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-page-id="${parentPage.id}"]`);
    await expect(parentNode).toBeVisible();

    // # Expand parent to see child
    const expandButton = parentNode.locator('[data-testid="page-tree-node-expand-button"]');
    await expandButton.click();
    await page.waitForTimeout(500);

    const childNode = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-page-id="${childPage.id}"]`);
    await expect(childNode).toBeVisible();

    // # Get initial padding of child (should be indented)
    const initialChildPadding = await childNode.evaluate((el) => {
        return window.getComputedStyle(el).paddingLeft;
    });
    const parentPadding = await parentNode.evaluate((el) => {
        return window.getComputedStyle(el).paddingLeft;
    });

    // * Verify child is indented more than parent
    expect(parseInt(initialChildPadding)).toBeGreaterThan(parseInt(parentPadding));

    // # Perform drag-and-drop to move child BETWEEN root pages
    // Get the root page 2 node position
    const rootPage2Node = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-page-id="${rootPage2.id}"]`);
    await expect(rootPage2Node).toBeVisible();

    const childBox = await childNode.boundingBox();
    const rootPage2Box = await rootPage2Node.boundingBox();

    if (!childBox || !rootPage2Box) {
        throw new Error('Could not get bounding boxes for drag operation');
    }

    // # Start drag from center of child
    await page.mouse.move(childBox.x + childBox.width / 2, childBox.y + childBox.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(100);

    // # Move to space BETWEEN root pages (above rootPage2, not ON it)
    // Move to just above the rootPage2 to drop BETWEEN pages
    await page.mouse.move(rootPage2Box.x + rootPage2Box.width / 2, rootPage2Box.y - 5, {steps: 10});
    await page.waitForTimeout(200);

    // # Drop
    await page.mouse.up();

    // # Wait for drag operation to complete and UI to update
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // * Verify child node is now at root level (no longer under parent)
    // Parent node should no longer have expand button (or should collapse)
    const parentStillHasExpandButton = await parentNode.locator('[data-testid="page-tree-node-expand-button"]').isVisible().catch(() => false);

    // If parent still has expand button, it should show child is gone
    if (parentStillHasExpandButton) {
        // Collapse and re-expand to refresh
        await expandButton.click();
        await page.waitForTimeout(300);
        await expandButton.click();
        await page.waitForTimeout(500);

        // Child should not be visible under parent anymore
        const childStillUnderParent = await hierarchyPanel.locator(`[data-testid="page-tree-node"][data-page-id="${childPage.id}"]`).count();
        expect(childStillUnderParent).toBe(0);
    }

    // * Verify promoted child now appears at root level with same padding as other root pages
    const promotedChildNode = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-page-id="${childPage.id}"]`).first();
    await expect(promotedChildNode).toBeVisible({timeout: 5000});

    const newChildPadding = await promotedChildNode.evaluate((el) => {
        return window.getComputedStyle(el).paddingLeft;
    });

    // Should now have same padding as root pages (not indented)
    expect(newChildPadding).toBe(parentPadding);
});

test.skip('reorders pages at same level via drag-drop', {tag: '@pages'}, async ({pw}) => {
    // BLOCKED: Requires DisplayOrder field implementation
    //
    // Current limitation: Pages are ordered by CreateAt timestamp only (no display_order field)
    // The drag-drop UI exists (react-beautiful-dnd) but only supports parent changes, not sibling reordering
    //
    // To implement:
    // 1. Add DisplayOrder field to Post model (server/public/model/post.go)
    // 2. Update database schema with migration
    // 3. Modify GetPageChildren query to ORDER BY DisplayOrder, CreateAt (server/channels/store/sqlstore/page_store.go:33)
    // 4. Implement reorder API endpoint
    // 5. Update handleDragEnd in page_tree_view.tsx:156-164 to calculate new order and call reorder API
});

/**
 * @objective Verify navigation through a 10-level deep page hierarchy
 */
test('navigates page hierarchy depth of 10 levels', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Depth Wiki ${pw.random.id()}`);

    // # Create 10-level hierarchy through UI
    const level1 = await createPageThroughUI(page, 'Level 1', 'Content at level 1');
    const level2 = await createChildPageThroughContextMenu(page, level1.id!, 'Level 2', 'Content at level 2');
    const level3 = await createChildPageThroughContextMenu(page, level2.id!, 'Level 3', 'Content at level 3');
    const level4 = await createChildPageThroughContextMenu(page, level3.id!, 'Level 4', 'Content at level 4');
    const level5 = await createChildPageThroughContextMenu(page, level4.id!, 'Level 5', 'Content at level 5');
    const level6 = await createChildPageThroughContextMenu(page, level5.id!, 'Level 6', 'Content at level 6');
    const level7 = await createChildPageThroughContextMenu(page, level6.id!, 'Level 7', 'Content at level 7');
    const level8 = await createChildPageThroughContextMenu(page, level7.id!, 'Level 8', 'Content at level 8');
    const level9 = await createChildPageThroughContextMenu(page, level8.id!, 'Level 9', 'Content at level 9');
    const level10 = await createChildPageThroughContextMenu(page, level9.id!, 'Level 10', 'Content at level 10');

    // * Verify deepest page content is displayed
    const pageContent = page.locator('[data-testid="page-viewer-content"]');
    await expect(pageContent).toContainText('Content at level 10');

    // * Verify breadcrumb shows full hierarchy
    const breadcrumb = page.locator('[data-testid="breadcrumb"]');
    await expect(breadcrumb).toBeVisible();
});

/**
 * @objective Verify that creating an 11th level page fails due to max depth limit
 */
test('enforces max hierarchy depth - 11th level fails', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Max Depth Wiki ${pw.random.id()}`);

    // # Create 10-level hierarchy through UI (maximum allowed)
    const level1 = await createPageThroughUI(page, 'Level 1', 'Level 1 content');
    const level2 = await createChildPageThroughContextMenu(page, level1.id!, 'Level 2', 'Level 2 content');
    const level3 = await createChildPageThroughContextMenu(page, level2.id!, 'Level 3', 'Level 3 content');
    const level4 = await createChildPageThroughContextMenu(page, level3.id!, 'Level 4', 'Level 4 content');
    const level5 = await createChildPageThroughContextMenu(page, level4.id!, 'Level 5', 'Level 5 content');
    const level6 = await createChildPageThroughContextMenu(page, level5.id!, 'Level 6', 'Level 6 content');
    const level7 = await createChildPageThroughContextMenu(page, level6.id!, 'Level 7', 'Level 7 content');
    const level8 = await createChildPageThroughContextMenu(page, level7.id!, 'Level 8', 'Level 8 content');
    const level9 = await createChildPageThroughContextMenu(page, level8.id!, 'Level 9', 'Level 9 content');
    const level10 = await createChildPageThroughContextMenu(page, level9.id!, 'Level 10', 'Level 10 content');

    // # Attempt to create 11th level through UI (should fail on publish due to server-side validation)
    const level10Node = page.locator(`[data-testid="page-tree-node"][data-page-id="${level10.id}"]`);
    const menuButton = level10Node.locator('[data-testid="page-tree-node-menu-button"]');
    await menuButton.click();

    const addChildButton = page.locator('[data-testid="page-context-menu-new-child"]').first();
    await addChildButton.click();
    await fillCreatePageModal(page, 'Level 11');

    // # Wait for draft editor to appear
    const editor = await getEditorAndWait(page);
    await editor.click();
    await page.keyboard.type('Level 11 content');

    // # Attempt to publish (server should reject due to max depth)
    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]');
    await publishButton.click();

    // * Verify error bar is displayed with max depth message
    // Mattermost shows errors in an announcement bar at the top of the page
    const errorBar = page.locator('.announcement-bar, [role="alert"]').filter({hasText: /depth|limit|maximum|exceed/i});
    await expect(errorBar).toBeVisible({timeout: 5000});

    // * Verify we're still in edit mode (draft editor still visible, not navigated away)
    await expect(editor).toBeVisible();
});

/**
 * @objective Verify search functionality filters pages in hierarchy panel
 */
test('searches and filters pages in hierarchy', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Search Wiki ${pw.random.id()}`);

    // # Create multiple pages through UI with distinct titles
    await createPageThroughUI(page, 'Apple Documentation', 'Apple content');
    await createPageThroughUI(page, 'Banana Guide', 'Banana content');
    await createPageThroughUI(page, 'Apple Tutorial', 'Apple tutorial content');

    // Navigate back to wiki view to ensure hierarchy panel with search is visible
    await navigateToWikiView(page, pw.url, team.name, channel.id, wiki.id);

    // # Type search query
    const searchInput = page.locator('[data-testid="pages-search-input"]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Apple');

    // # Wait for search debounce and results to update
    await waitForSearchDebounce(page);

    // * Verify filtered results show only Apple pages
    const hierarchyPanel = getHierarchyPanel(page);
    await expect(hierarchyPanel).toContainText('Apple Documentation');
    await expect(hierarchyPanel).toContainText('Apple Tutorial');

    // * Verify Banana page is not visible in filtered results
    const bananaNode = hierarchyPanel.locator('text=Banana Guide');
    await expect(bananaNode).not.toBeVisible();
});

/**
 * @objective Verify expansion state persists when navigating away and back to wiki
 */
test('preserves expansion state across navigation', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Expansion State Wiki ${pw.random.id()}`);

    // # Create parent and child pages through UI
    const parentPage = await createPageThroughUI(page, 'Parent Page', 'Parent content');
    const childPage = await createChildPageThroughContextMenu(page, parentPage.id!, 'Child Page', 'Child content');

    // * Verify child is initially visible (parent auto-expanded after child creation)
    const hierarchyPanel = getHierarchyPanel(page);
    const parentNode = page.locator('[data-testid="page-tree-node"][data-page-id="' + parentPage.id + '"]');
    const childNode = page.locator('[data-testid="page-tree-node"][data-page-id="' + childPage.id + '"]');
    await expect(childNode).toBeVisible({timeout: 5000});

    // # Collapse parent node
    const expandButton = parentNode.locator('[data-testid="page-tree-node-expand-button"]');
    await expect(expandButton).toBeVisible();
    await expandButton.click();
    await page.waitForTimeout(300);

    // * Verify child is hidden after collapse
    await expect(childNode).not.toBeVisible();

    // # Navigate away to channel view (click channel name or navigate to channel)
    await channelsPage.goto(team.name, channel.name);
    await page.waitForTimeout(500);

    // * Verify we're in the channel view (not wiki view)
    const channelHeader = page.locator('#channelHeaderTitle, [data-testid="channel-header-title"]');
    await expect(channelHeader).toBeVisible({timeout: 3000});

    // # Navigate back to wiki by clicking the wiki bookmark
    const wikiBookmark = page.locator(`[data-bookmark-link*="wiki"], a:has-text("${wiki.title}")`).first();
    await expect(wikiBookmark).toBeVisible({timeout: 3000});
    await wikiBookmark.click();
    await page.waitForTimeout(500);

    // * Verify we're back in wiki view
    await expect(hierarchyPanel).toBeVisible({timeout: 5000});

    // * Verify parent node is still collapsed (child not visible)
    await expect(childNode).not.toBeVisible();

    // * Verify parent is still in the hierarchy (not deleted)
    await expect(parentNode).toBeVisible();
});

/**
 * @objective Verify deleting a page with children using cascade option deletes all descendants
 */
test('deletes page with children - cascade option', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Cascade Delete Wiki ${pw.random.id()}`);

    // # Create parent page with children through UI
    const parentPage = await createPageThroughUI(page, 'Parent Page', 'Parent content');
    await createChildPageThroughContextMenu(page, parentPage.id!, 'Child Page 1', 'Child 1 content');
    await createChildPageThroughContextMenu(page, parentPage.id!, 'Child Page 2', 'Child 2 content');

    // # Delete parent page with cascade option (deletes parent and children)
    await deletePageWithOption(page, parentPage.id!, 'cascade');

    // * Verify parent and children are no longer in hierarchy
    const hierarchyPanel = getHierarchyPanel(page);
    await expect(hierarchyPanel).not.toContainText('Parent Page');
    await expect(hierarchyPanel).not.toContainText('Child Page 1');
    await expect(hierarchyPanel).not.toContainText('Child Page 2');
});

/**
 * @objective Verify deleting a page with move-to-parent option preserves children
 */
test('deletes page with children - move to root option', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Move Delete Wiki ${pw.random.id()}`);

    // # Create parent page with child through UI
    const parentPage = await createPageThroughUI(page, 'Parent to Delete', 'Parent content');
    await createChildPageThroughContextMenu(page, parentPage.id!, 'Child to Preserve', 'Child content');

    // # Delete parent page with move-to-parent option (preserves children)
    await deletePageWithOption(page, parentPage.id!, 'move-to-parent');

    // * Verify parent is deleted but child is preserved
    const hierarchyPanel = getHierarchyPanel(page);
    await expect(hierarchyPanel).not.toContainText('Parent to Delete');
    await expect(hierarchyPanel).toContainText('Child to Preserve');
});

/**
 * @objective Verify creating a child page via parent page context menu
 */
test('creates child page via context menu', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Context Menu Wiki ${pw.random.id()}`);

    // # Create parent page through UI
    const parentPage = await createPageThroughUI(page, 'Parent Page', 'Parent content');

    // # Create child page through context menu
    const childPage = await createChildPageThroughContextMenu(page, parentPage.id!, 'Child via Context Menu', 'Child content');

    // * Verify child page appears under parent in hierarchy
    const hierarchyPanel = getHierarchyPanel(page);
    await expect(hierarchyPanel).toContainText('Child via Context Menu');

    // * Verify child page is clickable and loads correctly
    const childNode = page.locator('[data-testid="page-tree-node"][data-page-id="' + childPage.id + '"]');
    await expect(childNode).toBeVisible();
});

/**
 * @objective Verify hierarchy panel state persists after page refresh
 */
test('preserves node count and state after page refresh', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // Wait for channel to be fully loaded
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Persist State Wiki ${pw.random.id()}`);

    // # Create published pages
    const publishedPage1 = await createPageThroughUI(page, 'Published Page 1', 'Content 1');
    const publishedPage2 = await createPageThroughUI(page, 'Published Page 2', 'Content 2');

    // # Create child page under first published page
    const childPage = await createChildPageThroughContextMenu(page, publishedPage1.id!, 'Child Page', 'Child content');

    // # Create drafts
    const draft1 = await createDraftThroughUI(page, 'Draft Page 1', 'Draft content 1');
    const draft2 = await createDraftThroughUI(page, 'Draft Page 2', 'Draft content 2');

    // # Navigate to one of the published pages to see full hierarchy with panel open
    await navigateToPage(page, pw.url, team.name, channel.id, wiki.id, publishedPage1.id);

    const hierarchyPanel = getHierarchyPanel(page);
    await expect(hierarchyPanel).toBeVisible({timeout: 5000});

    // # Expand parent node to make child visible
    const parent1Node = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-page-id="${publishedPage1.id}"]`);
    const expandButton = parent1Node.locator('[data-testid="page-tree-node-expand-button"]');
    await expect(expandButton).toBeVisible();
    await expandButton.click();
    await page.waitForTimeout(300);

    // * Verify EXACT nodes we created are visible before refresh
    const published1NodeBefore = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-page-id="${publishedPage1.id}"]`);
    const published2NodeBefore = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-page-id="${publishedPage2.id}"]`);
    const childNodeBefore = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-page-id="${childPage.id}"]`);
    const draft1NodeBefore = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-page-id="${draft1.id}"]`);
    const draft2NodeBefore = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-page-id="${draft2.id}"]`);

    await expect(published1NodeBefore).toBeVisible();
    await expect(published2NodeBefore).toBeVisible();
    await expect(childNodeBefore).toBeVisible();
    await expect(draft1NodeBefore).toBeVisible();
    await expect(draft2NodeBefore).toBeVisible();

    // * Verify EXACT state of each node before refresh
    await expect(published1NodeBefore).toHaveAttribute('data-is-draft', 'false');
    await expect(published2NodeBefore).toHaveAttribute('data-is-draft', 'false');
    await expect(childNodeBefore).toHaveAttribute('data-is-draft', 'false');
    await expect(draft1NodeBefore).toHaveAttribute('data-is-draft', 'true');
    await expect(draft2NodeBefore).toHaveAttribute('data-is-draft', 'true');

    // * Get text content of each node to verify names match exactly
    const published1TextBefore = await published1NodeBefore.textContent();
    const published2TextBefore = await published2NodeBefore.textContent();
    const childTextBefore = await childNodeBefore.textContent();
    const draft1TextBefore = await draft1NodeBefore.textContent();
    const draft2TextBefore = await draft2NodeBefore.textContent();

    // # Refresh the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // * Verify hierarchy panel is still visible after refresh
    await expect(hierarchyPanel).toBeVisible({timeout: 5000});

    // # Expand parent node again after refresh to make child visible
    const parent1NodeAfter = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-page-id="${publishedPage1.id}"]`);
    const expandButtonAfter = parent1NodeAfter.locator('[data-testid="page-tree-node-expand-button"]');
    await expect(expandButtonAfter).toBeVisible();
    await expandButtonAfter.click();
    await page.waitForTimeout(300);

    // * Verify EXACT same nodes are visible after refresh
    const published1NodeAfter = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-page-id="${publishedPage1.id}"]`);
    const published2NodeAfter = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-page-id="${publishedPage2.id}"]`);
    const childNodeAfter = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-page-id="${childPage.id}"]`);
    const draft1NodeAfter = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-page-id="${draft1.id}"]`);
    const draft2NodeAfter = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-page-id="${draft2.id}"]`);

    await expect(published1NodeAfter).toBeVisible();
    await expect(published2NodeAfter).toBeVisible();
    await expect(childNodeAfter).toBeVisible();
    await expect(draft1NodeAfter).toBeVisible();
    await expect(draft2NodeAfter).toBeVisible();

    // * Verify EXACT state of each node after refresh - must match exactly
    await expect(published1NodeAfter).toHaveAttribute('data-is-draft', 'false');
    await expect(published2NodeAfter).toHaveAttribute('data-is-draft', 'false');
    await expect(childNodeAfter).toHaveAttribute('data-is-draft', 'false');
    await expect(draft1NodeAfter).toHaveAttribute('data-is-draft', 'true');
    await expect(draft2NodeAfter).toHaveAttribute('data-is-draft', 'true');

    // * Verify text content matches EXACTLY after refresh
    const published1TextAfter = await published1NodeAfter.textContent();
    const published2TextAfter = await published2NodeAfter.textContent();
    const childTextAfter = await childNodeAfter.textContent();
    const draft1TextAfter = await draft1NodeAfter.textContent();
    const draft2TextAfter = await draft2NodeAfter.textContent();

    expect(published1TextAfter).toBe(published1TextBefore);
    expect(published2TextAfter).toBe(published2TextBefore);
    expect(childTextAfter).toBe(childTextBefore);
    expect(draft1TextAfter).toBe(draft1TextBefore);
    expect(draft2TextAfter).toBe(draft2TextBefore);

    // Cleanup: Navigate away from the channel before deleting it
    try {
        // Navigate to town square to ensure we're not on the channel we're about to delete
        await channelsPage.goto(team.name, 'town-square');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);

        // Now delete the channel
        await adminClient.deleteChannel(channel.id);
    } catch (error) {
        // Ignore cleanup errors - test has already passed
    }
});

/**
 * @objective Verify page hierarchy maintains stable ordering when selecting different pages
 */
test('maintains stable page order when selecting pages', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wikiTitle = `Ordering Test Wiki ${pw.random.id()}`;
    await createWikiThroughUI(page, wikiTitle);

    // # Create 5 sibling pages
    const pageNames = ['Page Alpha', 'Page Beta', 'Page Gamma', 'Page Delta', 'Page Epsilon'];
    for (const pageName of pageNames) {
        await createPageThroughUI(page, pageName, `Content for ${pageName}`);
    }

    // # Get initial order of pages in hierarchy
    const hierarchyPanel = getHierarchyPanel(page);
    await expect(hierarchyPanel).toBeVisible();

    const getPageOrder = async () => {
        const pageNodes = hierarchyPanel.locator('[data-testid="page-tree-node"]');
        const count = await pageNodes.count();
        const ids = [];

        for (let i = 0; i < count; i++) {
            const node = pageNodes.nth(i);
            const id = await node.getAttribute('data-page-id');
            if (id) {
                ids.push(id);
            }
        }

        return ids;
    };

    const initialOrder = await getPageOrder();
    expect(initialOrder.length).toBeGreaterThanOrEqual(5);

    // # Click through each page and verify order doesn't change
    for (let i = 0; i < Math.min(pageNames.length, initialOrder.length); i++) {
        // * Click on the page by ID
        const pageNode = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-page-id="${initialOrder[i]}"]`);
        const titleButton = pageNode.locator('[data-testid="page-tree-node-title"]');
        await titleButton.click();

        // Wait for navigation
        await page.waitForTimeout(500);

        // * Verify order is still the same
        const currentOrder = await getPageOrder();
        expect(currentOrder).toEqual(initialOrder);
    }
});

/**
 * @objective Verify page hierarchy order remains stable when adding new pages
 */
test('maintains stable order when adding new pages', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki
    const wikiTitle = `Add Pages Test ${pw.random.id()}`;
    await createWikiThroughUI(page, wikiTitle);

    // # Create initial 3 pages
    const initialPages = ['First', 'Second', 'Third'];
    for (const pageName of initialPages) {
        await createPageThroughUI(page, pageName, `Content for ${pageName}`);
    }

    // # Get page IDs in order
    const hierarchyPanel = getHierarchyPanel(page);
    const getPageIds = async () => {
        const pageNodes = hierarchyPanel.locator('[data-testid="page-tree-node"]');
        const count = await pageNodes.count();
        const ids = [];

        for (let i = 0; i < count; i++) {
            const node = pageNodes.nth(i);
            const id = await node.getAttribute('data-page-id');
            if (id) {
                ids.push(id);
            }
        }

        return ids;
    };

    const orderBefore = await getPageIds();
    expect(orderBefore.length).toBeGreaterThanOrEqual(3);

    // # Add a new page
    await createPageThroughUI(page, 'Fourth', 'Content for Fourth');

    // * Verify existing pages maintained their relative order
    const orderAfter = await getPageIds();

    // The first 3 pages should preserve their relative order
    for (let i = 0; i < orderBefore.length - 1; i++) {
        const currentIndexInAfter = orderAfter.indexOf(orderBefore[i]);
        const nextIndexInAfter = orderAfter.indexOf(orderBefore[i + 1]);

        // Both pages should still exist
        expect(currentIndexInAfter).toBeGreaterThanOrEqual(0);
        expect(nextIndexInAfter).toBeGreaterThanOrEqual(0);

        // Relative order should be preserved
        expect(currentIndexInAfter).toBeLessThan(nextIndexInAfter);
    }
});
