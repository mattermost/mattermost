// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';
import {
    createWikiThroughUI,
    createPageThroughUI,
    createChildPageThroughContextMenu,
    createTestChannel,
    fillCreatePageModal,
    renamePageViaContextMenu,
    createDraftThroughUI,
    openMovePageModal,
    confirmMoveToTarget,
    renamePageInline,
    waitForSearchDebounce,
    navigateToWikiView,
    navigateToPage,
    getBreadcrumb,
    getBreadcrumbWikiName,
    getBreadcrumbLinks,
    getBreadcrumbCurrentPage,
    verifyBreadcrumbContains,
    getHierarchyPanel,
    getPageViewerContent,
    deletePageWithOption,
    getEditorAndWait,
    openHierarchyNodeActionsMenu,
    uniqueName,
    ELEMENT_TIMEOUT,
} from './test_helpers';

/**
 * @objective Verify page hierarchy expansion and collapse functionality
 */
test('expands and collapses page nodes', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Hierarchy Wiki'));

    // # Create parent and child pages through UI
    const parentPage = await createPageThroughUI(page, 'Parent Page', 'Parent content');
    const childPage = await createChildPageThroughContextMenu(page, parentPage.id!, 'Child Page', 'Child content');

    // * Verify hierarchy panel is visible
    const hierarchyPanel = getHierarchyPanel(page);
    await expect(hierarchyPanel).toBeVisible();

    // # Locate parent page node
    const parentNode = page.locator('[data-testid="page-tree-node"][data-page-id="' + parentPage.id + '"]');
    await expect(parentNode).toBeVisible();

    // * Verify parent has expand button (indicates it has children)
    const expandButton = parentNode.locator('[data-testid="page-tree-node-expand-button"]');
    await expect(expandButton).toBeVisible();

    // * Verify child node is visible in hierarchy (parent should be auto-expanded after child creation)
    const childNode = page.locator('[data-testid="page-tree-node"][data-page-id="' + childPage.id + '"]');
    await expect(childNode).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify parent-child relationship: child appears AFTER parent in DOM order
    const allNodes = hierarchyPanel.locator('[data-testid="page-tree-node"]');
    const parentIndex = await allNodes.evaluateAll((nodes, pId) => {
        return nodes.findIndex((n) => n.getAttribute('data-page-id') === pId);
    }, parentPage.id);
    const childIndex = await allNodes.evaluateAll((nodes, cId) => {
        return nodes.findIndex((n) => n.getAttribute('data-page-id') === cId);
    }, childPage.id);
    expect(childIndex).toBeGreaterThan(parentIndex); // Child must come after parent in DOM

    // # Collapse parent node
    await expandButton.click();

    // * Verify child is hidden after collapse
    await expect(childNode).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Expand parent node again
    await expandButton.click();

    // * Verify child is visible again after expand
    await expect(childNode).toBeVisible({timeout: ELEMENT_TIMEOUT});
});

/**
 * @objective Verify moving page to new parent within same wiki
 */
test('moves page to new parent within same wiki', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, uniqueName('Move Wiki'));

    // # Create two root pages through UI
    const page1 = await createPageThroughUI(page, 'Page 1', 'Content 1');
    const page2 = await createPageThroughUI(page, 'Page 2', 'Content 2');

    // # Open Page 2's actions menu to move it
    const hierarchyPanel = getHierarchyPanel(page);
    const page2Node = hierarchyPanel.locator('[data-testid="page-tree-node"]').filter({hasText: 'Page 2'}).first();

    await expect(page2Node).toBeVisible();
    const contextMenu = await openHierarchyNodeActionsMenu(page, page2Node);

    // # Select "Move" from context menu
    const moveButton = contextMenu
        .locator('[data-testid="page-context-menu-move"], button:has-text("Move To")')
        .first();
    await expect(moveButton).toBeVisible();
    await moveButton.click();

    // # Select Page 1 as new parent in modal
    const moveModal = page.getByRole('dialog', {name: /Move/i});
    await expect(moveModal).toBeVisible({timeout: ELEMENT_TIMEOUT});
    // Use data-page-id attribute to find the page option
    const page1Option = moveModal.locator(`[data-page-id="${page1.id}"]`).first();
    await page1Option.click();

    const confirmButton = moveModal.getByRole('button', {name: 'Move'});
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();

    // Wait for modal to close
    await expect(moveModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});
    await page.waitForLoadState('networkidle');

    // * Verify Page 2 now appears under Page 1 in hierarchy panel
    // Find Page 1 in hierarchy panel
    const page1Node = hierarchyPanel.locator('[data-page-id="' + page1.id + '"]').first();
    await expect(page1Node).toBeVisible();

    // Expand Page 1 to reveal its children
    const expandButton = page1Node.locator('[data-testid="page-tree-node-expand-button"]').first();
    await expect(expandButton).toBeVisible();

    // Check if Page 1 is collapsed (chevron-right) and expand it
    const chevronRight = page1Node.locator('.icon-chevron-right').first();
    const isCollapsed = (await chevronRight.count()) > 0;
    if (isCollapsed) {
        await expandButton.click();
    }

    // * Verify Page 2 is now visible as a child of Page 1 in the hierarchy
    const page2AsChild = hierarchyPanel.locator('[data-page-id="' + page2.id + '"]').first();
    await expect(page2AsChild).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify Page 2 has correct depth (depth=1 indicates child of Page 1 which is at depth=0)
    await expect(page1Node).toHaveAttribute('data-depth', '0', {timeout: ELEMENT_TIMEOUT});
    await expect(page2AsChild).toHaveAttribute('data-depth', '1', {timeout: ELEMENT_TIMEOUT});

    // # Click on Page 2 to navigate to it
    await page2AsChild.click();

    // * Verify breadcrumbs reflect new hierarchy: Wiki > Page 1 > Page 2
    const breadcrumb = getBreadcrumb(page);
    await expect(breadcrumb).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify wiki name (not a link anymore)
    const wikiName = getBreadcrumbWikiName(page);
    await expect(wikiName).toContainText(wiki.title);

    // * Verify page links (only the ancestor pages, not wiki or current page)
    const breadcrumbLinks = getBreadcrumbLinks(page);
    await expect(breadcrumbLinks).toHaveCount(1);
    await expect(breadcrumbLinks.nth(0)).toContainText('Page 1');

    const currentPageElement = getBreadcrumbCurrentPage(page);
    await expect(currentPageElement).toContainText('Page 2');
});

/**
 * @objective Verify circular hierarchy prevention
 */
test(
    'prevents circular hierarchy - cannot move page to own descendant',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

        const {page, channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        // # Create wiki through UI
        const wiki = await createWikiThroughUI(page, uniqueName('Circular Wiki'));

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
    },
);

/**
 * @objective Verify moving page between different wikis
 */
test('moves page between wikis', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create two wikis through UI
    const wiki1 = await createWikiThroughUI(page, uniqueName('Wiki 1'));
    await createPageThroughUI(page, 'Page to Move', 'Content');

    // Navigate back to channel to create second wiki
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();
    const wiki2 = await createWikiThroughUI(page, uniqueName('Wiki 2'));

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
    await expect(moveModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});
    await page.waitForLoadState('networkidle');

    // * Verify page removed from Wiki 1
    await navigateToWikiView(page, pw.url, team.name, channel.id, wiki1.id);

    const hierarchyPanel = getHierarchyPanel(page);
    const pageInWiki1Still = hierarchyPanel.locator('text="Page to Move"').first();
    await expect(pageInWiki1Still).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify page appears in Wiki 2
    await navigateToWikiView(page, pw.url, team.name, channel.id, wiki2.id);

    const pageInWiki2 = hierarchyPanel.locator('text="Page to Move"').first();
    await expect(pageInWiki2).toBeVisible();

    // # Click on the page to view it and verify breadcrumbs
    await pageInWiki2.click();
    await page.waitForLoadState('networkidle');

    // * Verify breadcrumbs show Wiki 2 > Page to Move
    const breadcrumb = getBreadcrumb(page);
    await expect(breadcrumb).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify wiki name (not a link anymore)
    const wikiName = getBreadcrumbWikiName(page);
    await expect(wikiName).toContainText(wiki2.title);

    // * Verify no page links (page is at wiki root)
    const breadcrumbLinks = getBreadcrumbLinks(page);
    await expect(breadcrumbLinks).toHaveCount(0);

    const currentPageElement = getBreadcrumbCurrentPage(page);
    await expect(currentPageElement).toContainText('Page to Move');
});

/**
 * @objective Verify moving page to become child of another page in same wiki
 */
test('moves page to child of another page in same wiki', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, uniqueName('Move Child Wiki'));

    // # Create parent page and a child page under it
    const parentPage = await createPageThroughUI(page, 'Parent Page', 'Parent content');
    const existingChild = await createChildPageThroughContextMenu(
        page,
        parentPage.id!,
        'Existing Child',
        'Existing child content',
    );

    // # Create another root page to move
    const pageToMove = await createPageThroughUI(page, 'Page to Move', 'Content to move');

    // # Open actions menu for the page to move
    const hierarchyPanel = getHierarchyPanel(page);
    const pageToMoveNode = hierarchyPanel
        .locator('[data-testid="page-tree-node"]')
        .filter({hasText: 'Page to Move'})
        .first();

    await expect(pageToMoveNode).toBeVisible();
    const contextMenu2 = await openHierarchyNodeActionsMenu(page, pageToMoveNode);

    // # Select "Move" from context menu
    const moveButton = contextMenu2
        .locator('[data-testid="page-context-menu-move"], button:has-text("Move To")')
        .first();
    await expect(moveButton).toBeVisible();
    await moveButton.click();

    // # Select Existing Child as new parent in modal
    const moveModal = page.getByRole('dialog', {name: /Move/i});
    await expect(moveModal).toBeVisible({timeout: ELEMENT_TIMEOUT});
    const existingChildOption = moveModal.locator(`[data-page-id="${existingChild.id}"]`).first();
    await existingChildOption.click();

    const confirmButton = moveModal.getByRole('button', {name: 'Move'});
    await confirmButton.click();

    // Wait for modal to close
    await expect(moveModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});
    await page.waitForLoadState('networkidle');

    // * Verify hierarchy: Parent Page > Existing Child > Page to Move
    // Find and expand Parent Page
    const parentNode = hierarchyPanel.locator('[data-page-id="' + parentPage.id + '"]').first();
    await expect(parentNode).toBeVisible();

    const parentExpandButton = parentNode.locator('[data-testid="page-tree-node-expand-button"]').first();
    const parentChevronRight = parentNode.locator('.icon-chevron-right').first();
    if ((await parentChevronRight.count()) > 0) {
        await parentExpandButton.click();
    }

    // Find and expand Existing Child
    const existingChildNode = hierarchyPanel.locator('[data-page-id="' + existingChild.id + '"]').first();
    await expect(existingChildNode).toBeVisible({timeout: ELEMENT_TIMEOUT});

    const childExpandButton = existingChildNode.locator('[data-testid="page-tree-node-expand-button"]').first();
    const childChevronRight = existingChildNode.locator('.icon-chevron-right').first();
    if ((await childChevronRight.count()) > 0) {
        await childExpandButton.click();
    }

    // * Verify Page to Move is now visible as a child of Existing Child
    const movedPageNode = hierarchyPanel.locator('[data-page-id="' + pageToMove.id + '"]').first();
    await expect(movedPageNode).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify correct hierarchy depth: Parent (0) > Existing Child (1) > Page to Move (2)
    await expect(parentNode).toHaveAttribute('data-depth', '0', {timeout: ELEMENT_TIMEOUT});
    await expect(existingChildNode).toHaveAttribute('data-depth', '1', {timeout: ELEMENT_TIMEOUT});
    await expect(movedPageNode).toHaveAttribute('data-depth', '2', {timeout: ELEMENT_TIMEOUT});

    // # Click on moved page to navigate to it
    await movedPageNode.click();

    // * Verify breadcrumbs reflect full hierarchy: Wiki > Parent Page > Existing Child > Page to Move
    const breadcrumb = getBreadcrumb(page);
    await expect(breadcrumb).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify wiki name (not a link anymore)
    const wikiName = getBreadcrumbWikiName(page);
    await expect(wikiName).toContainText(wiki.title);

    // * Verify page links (only the ancestor pages, not wiki or current page)
    const breadcrumbLinks = getBreadcrumbLinks(page);
    await expect(breadcrumbLinks).toHaveCount(2);
    await expect(breadcrumbLinks.nth(0)).toContainText('Parent Page');
    await expect(breadcrumbLinks.nth(1)).toContainText('Existing Child');

    const currentPageElement = getBreadcrumbCurrentPage(page);
    await expect(currentPageElement).toContainText('Page to Move');
});

/**
 * @objective Verify moving page to child of another page in different wiki
 */
test('moves page to child of another page in different wiki', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create first wiki with a page to move
    const wiki1 = await createWikiThroughUI(page, uniqueName('Wiki 1'));
    const pageToMove = await createPageThroughUI(page, 'Page to Move', 'Content to move');

    // # Navigate back to channel to create second wiki
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();
    const wiki2 = await createWikiThroughUI(page, uniqueName('Wiki 2'));

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

    // # Wait for pages list to load after wiki selection
    const childOption = moveModal.locator(`[data-page-id="${childPage.id}"]`);
    await expect(childOption).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Then select Child as parent and confirm
    await confirmMoveToTarget(page, moveModal, `[data-page-id="${childPage.id}"]`);

    // * Verify page removed from Wiki 1
    await navigateToWikiView(page, pw.url, team.name, channel.id, wiki1.id);

    const hierarchyPanel = getHierarchyPanel(page);
    const pageInWiki1Still = hierarchyPanel.locator('text="Page to Move"').first();
    await expect(pageInWiki1Still).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify page appears in Wiki 2 under Child in Wiki 2
    await navigateToWikiView(page, pw.url, team.name, channel.id, wiki2.id);

    // Find and expand Parent in Wiki 2
    const parentNode = hierarchyPanel.locator('[data-page-id="' + parentPage.id + '"]').first();
    await expect(parentNode).toBeVisible({timeout: ELEMENT_TIMEOUT});

    const parentExpandButton = parentNode.locator('[data-testid="page-tree-node-expand-button"]').first();
    const parentChevronRight = parentNode.locator('.icon-chevron-right').first();
    if ((await parentChevronRight.count()) > 0) {
        await parentExpandButton.click();
    }

    // Find and expand Child in Wiki 2
    const childNode = hierarchyPanel.locator('[data-page-id="' + childPage.id + '"]').first();
    await expect(childNode).toBeVisible({timeout: ELEMENT_TIMEOUT});

    const childExpandButton = childNode.locator('[data-testid="page-tree-node-expand-button"]').first();
    const childChevronRight = childNode.locator('.icon-chevron-right').first();
    if ((await childChevronRight.count()) > 0) {
        await childExpandButton.click();
    }

    // * Verify Page to Move is now visible as a child of Child in Wiki 2
    const movedPageNode = hierarchyPanel.locator('[data-page-id="' + pageToMove.id + '"]').first();
    await expect(movedPageNode).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify correct hierarchy depth: Parent (0) > Child (1) > Page to Move (2)
    await expect(parentNode).toHaveAttribute('data-depth', '0', {timeout: ELEMENT_TIMEOUT});
    await expect(childNode).toHaveAttribute('data-depth', '1', {timeout: ELEMENT_TIMEOUT});
    await expect(movedPageNode).toHaveAttribute('data-depth', '2', {timeout: ELEMENT_TIMEOUT});

    // # Click on moved page to view it and verify breadcrumbs
    await movedPageNode.click();
    await page.waitForLoadState('networkidle');

    // * Verify breadcrumbs reflect new hierarchy: Wiki 2 > Parent in Wiki 2 > Child in Wiki 2 > Page to Move
    const breadcrumb = getBreadcrumb(page);
    await expect(breadcrumb).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify wiki name (not a link anymore)
    const wikiName = getBreadcrumbWikiName(page);
    await expect(wikiName).toContainText(wiki2.title);

    // * Verify page links (only the ancestor pages, not wiki or current page)
    const breadcrumbLinks = getBreadcrumbLinks(page);
    await expect(breadcrumbLinks).toHaveCount(2);
    await expect(breadcrumbLinks.nth(0)).toContainText('Parent in Wiki 2');
    await expect(breadcrumbLinks.nth(1)).toContainText('Child in Wiki 2');

    const currentPageElement = getBreadcrumbCurrentPage(page);
    await expect(currentPageElement).toContainText('Page to Move');
});

/**
 * @objective Verify renaming page via context menu
 */
test('renames page via context menu', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page through UI
    await createWikiThroughUI(page, uniqueName('Rename Wiki'));
    await createPageThroughUI(page, 'Original Name', 'Content');

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
 * @objective Verify renaming a first-time draft (unpublished) via context menu
 */
test('renames first-time draft via context menu', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Draft Rename Wiki'));

    // # Create a draft (not published) through UI
    const draft = await createDraftThroughUI(page, 'Original Draft Name', 'Draft content');

    // # Rename draft via context menu
    await renamePageViaContextMenu(page, 'Original Draft Name', 'Renamed Draft');

    // # Wait for network to settle
    await page.waitForLoadState('networkidle');

    // * Verify draft renamed in hierarchy
    const hierarchyPanel = getHierarchyPanel(page);
    const renamedNode = hierarchyPanel.locator('text="Renamed Draft"').first();
    await expect(renamedNode).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify old name no longer visible
    const oldNode = hierarchyPanel.locator('text="Original Draft Name"').first();
    await expect(oldNode).not.toBeVisible();

    // * Verify the node is still marked as a draft
    const draftNode = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-page-id="${draft.id}"]`);
    await expect(draftNode).toHaveAttribute('data-is-draft', 'true');
});

/**
 * @objective Verify inline rename via double-click
 *
 * NOTE: Skipped - inline rename via double-click is not yet implemented in the UI
 */
test.skip('renames page inline via double-click', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page through UI
    const wiki = await createWikiThroughUI(page, uniqueName('Inline Rename Wiki'));
    await createPageThroughUI(page, 'Original Title', 'Content');

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
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page through UI
    await createWikiThroughUI(page, uniqueName('Unicode Wiki'));
    await createPageThroughUI(page, 'Simple Name', 'Content');

    // # Rename with Unicode and emoji using the helper function
    const specialName = 'Page 🚀 with 中文 and émojis';
    await renamePageViaContextMenu(page, 'Simple Name', specialName);

    // * Verify special characters preserved in hierarchy
    const hierarchyPanel = getHierarchyPanel(page);
    const renamedNode = hierarchyPanel.locator(`text="${specialName}"`).first();

    await expect(renamedNode).toBeVisible({timeout: ELEMENT_TIMEOUT});
    const nodeText = await renamedNode.textContent();
    expect(nodeText).toContain('🚀');
    expect(nodeText).toContain('中文');
    expect(nodeText).toContain('émojis');
});

/**
 * @objective Verify navigation through a 10-level deep page hierarchy
 */
test('navigates page hierarchy depth of 10 levels', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Depth Wiki'));

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
    await createChildPageThroughContextMenu(page, level9.id!, 'Level 10', 'Content at level 10');

    // * Verify deepest page content is displayed
    const pageContent = getPageViewerContent(page);
    await expect(pageContent).toContainText('Content at level 10');

    // * Verify breadcrumb shows full hierarchy with all 10 levels
    const breadcrumb = getBreadcrumb(page);
    await expect(breadcrumb).toBeVisible();

    // * Verify all ancestor pages appear in breadcrumb (Level 1-10)
    await verifyBreadcrumbContains(page, 'Level 1');
    await verifyBreadcrumbContains(page, 'Level 2');
    await verifyBreadcrumbContains(page, 'Level 3');
    await verifyBreadcrumbContains(page, 'Level 4');
    await verifyBreadcrumbContains(page, 'Level 5');
    await verifyBreadcrumbContains(page, 'Level 6');
    await verifyBreadcrumbContains(page, 'Level 7');
    await verifyBreadcrumbContains(page, 'Level 8');
    await verifyBreadcrumbContains(page, 'Level 9');
    await verifyBreadcrumbContains(page, 'Level 10');

    // * Verify breadcrumb has all expected links (at least 9 ancestor links)
    const breadcrumbLinks = getBreadcrumbLinks(page);
    const linkCount = await breadcrumbLinks.count();
    expect(linkCount).toBeGreaterThanOrEqual(9); // At minimum, 9 ancestor links (current page may not be a link)
});

/**
 * @objective Verify that creating a 12th level page fails due to max depth limit (max depth is 10, allowing levels 1-11)
 */
test('enforces max hierarchy depth - 12th level fails', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Max Depth Wiki'));

    // # Create 11-level hierarchy through UI (maximum allowed - depth 0-10)
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
    const level11 = await createChildPageThroughContextMenu(page, level10.id!, 'Level 11', 'Level 11 content');

    // # Attempt to create 12th level through UI (should fail on publish due to server-side validation)
    const level11Node = page.locator(`[data-testid="page-tree-node"][data-page-id="${level11.id}"]`);
    const menuButton = level11Node.locator('[data-testid="page-tree-node-menu-button"]');
    await menuButton.click();

    const addChildButton = page.locator('[data-testid="page-context-menu-new-child"]').first();
    await addChildButton.click();
    await fillCreatePageModal(page, 'Level 12');

    // # Wait for draft editor to appear
    const editor = await getEditorAndWait(page);
    await editor.click();
    await page.keyboard.type('Level 12 content');

    // # Attempt to publish (server should reject due to max depth)
    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]');
    await publishButton.click();

    // * Verify error bar is displayed with max depth message
    // Mattermost shows errors in an announcement bar at the top of the page
    const errorBar = page.locator('.announcement-bar, [role="alert"]').filter({hasText: /depth|limit|maximum|exceed/i});
    await expect(errorBar).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify we're still in edit mode (draft editor still visible, not navigated away)
    await expect(editor).toBeVisible();
});

/**
 * @objective Verify search functionality filters pages in hierarchy panel
 */
test('searches and filters pages in hierarchy', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, uniqueName('Search Wiki'));

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
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, uniqueName('Expansion State Wiki'));

    // # Create parent and child pages through UI
    const parentPage = await createPageThroughUI(page, 'Parent Page', 'Parent content');
    const childPage = await createChildPageThroughContextMenu(page, parentPage.id!, 'Child Page', 'Child content');

    // * Verify child is initially visible (parent auto-expanded after child creation)
    const hierarchyPanel = getHierarchyPanel(page);
    const parentNode = page.locator('[data-testid="page-tree-node"][data-page-id="' + parentPage.id + '"]');
    const childNode = page.locator('[data-testid="page-tree-node"][data-page-id="' + childPage.id + '"]');
    await expect(childNode).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Collapse parent node
    const expandButton = parentNode.locator('[data-testid="page-tree-node-expand-button"]');
    await expect(expandButton).toBeVisible();
    await expandButton.click();

    // * Verify child is hidden after collapse
    await expect(childNode).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Navigate away to channel view (click channel name or navigate to channel)
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // * Verify we're in the channel view (not wiki view)
    const channelHeader = page.locator('#channelHeaderTitle, [data-testid="channel-header-title"]');
    await expect(channelHeader).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Navigate back to wiki by clicking the wiki tab
    const wikiTab = page.getByRole('tab', {name: wiki.title});
    await expect(wikiTab).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await wikiTab.click();

    // * Verify we're back in wiki view
    await expect(hierarchyPanel).toBeVisible({timeout: ELEMENT_TIMEOUT});

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
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Cascade Delete Wiki'));

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
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Move Delete Wiki'));

    // # Create parent page with child through UI
    const parentPage = await createPageThroughUI(page, 'Parent to Delete', 'Parent content');
    const childPage = await createChildPageThroughContextMenu(
        page,
        parentPage.id!,
        'Child to Preserve',
        'Child content',
    );

    // # Delete parent page with move-to-parent option (preserves children)
    await deletePageWithOption(page, parentPage.id!, 'move-to-parent');

    // * Verify parent is deleted
    const hierarchyPanel = getHierarchyPanel(page);
    await expect(hierarchyPanel).not.toContainText('Parent to Delete');

    // * Verify child is preserved
    await expect(hierarchyPanel).toContainText('Child to Preserve');

    // * Verify child moved to root level (not nested under any other page)
    const childNode = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-page-id="${childPage.id}"]`);
    await expect(childNode).toBeVisible();

    // * Verify child is at root level by checking it's NOT nested inside another page-tree-node
    // Root-level pages are direct children of the tree container, not nested in other page nodes
    const nestedChildNode = hierarchyPanel
        .locator('[data-testid="page-tree-node"] [data-testid="page-tree-node"]')
        .filter({has: page.locator(`[data-page-id="${childPage.id}"]`)});
    const isNested = await nestedChildNode.count();
    expect(isNested).toBe(0); // Should be 0 because child is at root level, not nested
});

/**
 * @objective Verify creating a child page via parent page context menu
 */
test('creates child page via context menu', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Context Menu Wiki'));

    // # Create parent page through UI
    const parentPage = await createPageThroughUI(page, 'Parent Page', 'Parent content');

    // # Create child page through context menu
    const childPage = await createChildPageThroughContextMenu(
        page,
        parentPage.id!,
        'Child via Context Menu',
        'Child content',
    );

    // * Verify child page appears under parent in hierarchy
    const hierarchyPanel = getHierarchyPanel(page);
    const parentNode = hierarchyPanel.locator('[data-testid="page-tree-node"][data-page-id="' + parentPage.id + '"]');
    const childNode = hierarchyPanel.locator('[data-testid="page-tree-node"][data-page-id="' + childPage.id + '"]');

    await expect(childNode).toBeVisible();

    // * Verify correct parent-child depth relationship
    await expect(parentNode).toHaveAttribute('data-depth', '0');
    await expect(childNode).toHaveAttribute('data-depth', '1');
});

/**
 * @objective Verify hierarchy panel state persists after page refresh
 */
test('preserves node count and state after page refresh', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // Wait for channel to be fully loaded
    await page.waitForLoadState('networkidle');

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, uniqueName('Persist State Wiki'));

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
    await expect(hierarchyPanel).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Expand parent node to make child visible
    const parent1Node = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-page-id="${publishedPage1.id}"]`);
    const expandButton = parent1Node.locator('[data-testid="page-tree-node-expand-button"]');
    await expect(expandButton).toBeVisible();
    await expandButton.click();

    // * Verify EXACT nodes we created are visible before refresh
    const published1NodeBefore = hierarchyPanel.locator(
        `[data-testid="page-tree-node"][data-page-id="${publishedPage1.id}"]`,
    );
    const published2NodeBefore = hierarchyPanel.locator(
        `[data-testid="page-tree-node"][data-page-id="${publishedPage2.id}"]`,
    );
    const childNodeBefore = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-page-id="${childPage.id}"]`);
    const draft1NodeBefore = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-page-id="${draft1.id}"]`);
    const draft2NodeBefore = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-page-id="${draft2.id}"]`);

    await expect(published1NodeBefore).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await expect(published2NodeBefore).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await expect(childNodeBefore).toBeVisible({timeout: ELEMENT_TIMEOUT});
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
    await expect(hierarchyPanel).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Expand parent node again after refresh to make child visible
    const parent1NodeAfter = hierarchyPanel.locator(
        `[data-testid="page-tree-node"][data-page-id="${publishedPage1.id}"]`,
    );
    const expandButtonAfter = parent1NodeAfter.locator('[data-testid="page-tree-node-expand-button"]');
    await expect(expandButtonAfter).toBeVisible();
    await expandButtonAfter.click();

    // * Verify EXACT same nodes are visible after refresh
    const published1NodeAfter = hierarchyPanel.locator(
        `[data-testid="page-tree-node"][data-page-id="${publishedPage1.id}"]`,
    );
    const published2NodeAfter = hierarchyPanel.locator(
        `[data-testid="page-tree-node"][data-page-id="${publishedPage2.id}"]`,
    );
    const childNodeAfter = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-page-id="${childPage.id}"]`);
    const draft1NodeAfter = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-page-id="${draft1.id}"]`);
    const draft2NodeAfter = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-page-id="${draft2.id}"]`);

    await expect(published1NodeAfter).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await expect(published2NodeAfter).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await expect(childNodeAfter).toBeVisible({timeout: ELEMENT_TIMEOUT});
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
        await channelsPage.toBeVisible();

        // Now delete the channel
        await adminClient.deleteChannel(channel.id);
    } catch {
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
    await channelsPage.toBeVisible();

    // # Create wiki through UI
    const wikiTitle = uniqueName('Ordering Test Wiki');
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
        // Only get published pages (exclude drafts)
        const pageNodes = hierarchyPanel.locator('[data-testid="page-tree-node"][data-is-draft="false"]');
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

        // Wait for page content to load
        const pageContent = getPageViewerContent(page);
        await expect(pageContent).toBeVisible({timeout: ELEMENT_TIMEOUT});

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
    await channelsPage.toBeVisible();

    // # Create wiki
    const wikiTitle = uniqueName('Add Pages Test');
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
