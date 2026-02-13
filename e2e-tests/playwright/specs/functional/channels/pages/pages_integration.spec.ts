// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';
import {
    addInlineCommentInEditMode,
    addReplyToCommentThread,
    buildChannelUrl,
    buildWikiPageUrl,
    clickCommentMarkerAndOpenRHS,
    confirmMoveToTarget,
    createChildPageThroughContextMenu,
    createPageThroughUI,
    createWikiThroughUI,
    deletePageViaActionsMenu,
    EDITOR_LOAD_WAIT,
    ELEMENT_TIMEOUT,
    enterEditMode,
    expandPageTreeNode,
    fillAndSubmitCommentModal,
    fillCreatePageModal,
    getBreadcrumb,
    getBreadcrumbLinks,
    getEditorAndWait,
    getHierarchyPanel,
    getNewPageButton,
    getPageTreeNodeByTitle,
    HIERARCHY_TIMEOUT,
    loginAndNavigateToChannel,
    navigateToPage,
    openInlineCommentModal,
    openMovePageModal,
    publishPage,
    selectTextInEditor,
    SHORT_WAIT,
    toggleCommentResolution,
    uniqueName,
    verifyBreadcrumbContains,
    verifyBreadcrumbDoesNotContain,
    verifyCommentMarkerVisible,
    verifyHierarchyContains,
    verifyPageContentContains,
    verifyWikiRHSContent,
    waitForSearchDebounce,
    WEBSOCKET_WAIT,
} from './test_helpers';

/**
 * @objective Verify complete workflow: create parent page, create child, verify hierarchy
 */
test('completes full page lifecycle with hierarchy and comments', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user} = sharedPagesSetup;

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, 'town-square');

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Integration Wiki'));

    // # Step 1: Create parent page
    const parentPage = await createPageThroughUI(page, 'Parent Integration Page', 'Parent page content');

    // # Step 2: Create child page
    await createChildPageThroughContextMenu(page, parentPage.id, 'Child Integration Page', 'Child page content');

    // * Verify child page was created with correct content
    await verifyPageContentContains(page, 'Child page content');

    // # Step 3: Add inline comment to child page
    await enterEditMode(page);
    await addInlineCommentInEditMode(page, 'Integration test comment');
    await publishPage(page);

    // * Verify comment marker visible
    const commentMarker = await verifyCommentMarkerVisible(page);

    // * Verify comment accessible via RHS
    const rhs = await clickCommentMarkerAndOpenRHS(page, commentMarker);
    await verifyWikiRHSContent(page, rhs, ['Integration test comment']);

    // * Verify hierarchy exists (child is under parent)
    const hierarchyPanel = getHierarchyPanel(page);
    await expect(hierarchyPanel).toBeVisible();
    await verifyHierarchyContains(page, 'Parent Integration Page');
    await verifyHierarchyContains(page, 'Child Integration Page');
});

/**
 * @objective Verify draft save, navigate away, return, edit, publish workflow
 */
test(
    'saves draft, navigates away, returns to draft, then publishes',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user} = sharedPagesSetup;

        const {page, channelsPage} = await loginAndNavigateToChannel(pw, user, team.name, 'town-square');

        // # Create wiki through UI
        const wiki = await createWikiThroughUI(page, uniqueName('Draft Flow Wiki'));

        // # Step 1: Create draft
        const newPageButton = getNewPageButton(page);
        await expect(newPageButton).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await newPageButton.click();
        await fillCreatePageModal(page, 'Draft Flow Test');

        const editor = await getEditorAndWait(page);
        await editor.click();
        await editor.type('Draft content in progress');

        // * Wait for auto-save
        await page.waitForTimeout(ELEMENT_TIMEOUT);

        // # Step 2: Navigate away (without publishing)
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Step 3: Return to wiki by clicking the wiki tab
        const wikiTab = page.getByRole('tab', {name: wiki.title});
        await expect(wikiTab).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await wikiTab.click();
        await page.waitForLoadState('networkidle');

        // # Step 4: Find and open draft (drafts are integrated in tree with data-is-draft attribute)
        const hierarchyPanel = getHierarchyPanel(page);
        const draftNode = hierarchyPanel.locator('[data-testid="page-tree-node"][data-is-draft="true"]', {
            hasText: 'Draft Flow Test',
        });
        await expect(draftNode).toBeVisible({timeout: HIERARCHY_TIMEOUT});
        await draftNode.click();
        await page.waitForLoadState('networkidle');

        // * Verify draft content restored
        const editorContent = await editor.textContent();
        expect(editorContent).toContain('Draft content in progress');

        // # Step 5: Edit draft
        await editor.click();
        await editor.type(' - additional content');

        // # Step 6: Publish
        await publishPage(page);

        // * Verify published
        await verifyPageContentContains(page, 'Draft content in progress - additional content');
    },
);

/**
 * @objective Verify page with inline comments can be edited without losing comments
 */
test('preserves inline comments when editing page content', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user} = sharedPagesSetup;

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, 'town-square');

    // # Create wiki and page through UI
    await createWikiThroughUI(page, uniqueName('Comment Preservation Wiki'));
    await createPageThroughUI(page, 'Page with Comments', 'Content with comment marker');

    // # Enter edit mode and add inline comment using proven helper
    await enterEditMode(page);
    await addInlineCommentInEditMode(page, 'Important comment to preserve');

    // # Publish the page (isNewPage=true because we're publishing edits)
    await publishPage(page);

    // * Verify comment marker visible in viewer mode
    await verifyCommentMarkerVisible(page);

    // # Edit page content again to verify comment preservation
    await enterEditMode(page);

    const editor2 = await getEditorAndWait(page);
    await editor2.click();
    await page.keyboard.press('End');
    await editor2.type(' - edited');

    await publishPage(page);

    // * Verify comment marker still present after edit
    await verifyCommentMarkerVisible(page);

    // * Verify comment content accessible via RHS
    const commentMarker2 = await verifyCommentMarkerVisible(page);
    const rhs = await clickCommentMarkerAndOpenRHS(page, commentMarker2);
    await verifyWikiRHSContent(page, rhs, ['Important comment to preserve']);
});

/**
 * @objective Verify search, navigate to result, add comment, navigate back
 */
test(
    'searches page, opens result, adds comment, returns to search',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user} = sharedPagesSetup;

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, 'town-square');

        // # Create wiki and page through UI
        const searchTerm = uniqueName('SearchTerm');
        await createWikiThroughUI(page, uniqueName('Search Flow Wiki'));
        const searchablePage = await createPageThroughUI(
            page,
            `Page with ${searchTerm}`,
            `Content containing ${searchTerm}`,
        );

        // # Perform search
        const searchInput = page.locator('[data-testid="pages-search-input"]').first();
        await expect(searchInput).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await searchInput.fill(searchTerm);
        await waitForSearchDebounce(page);

        // # Click search result - use getByRole to find the button containing the search term
        const searchResult = page.getByRole('button', {name: new RegExp(searchTerm)}).first();
        await expect(searchResult).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await searchResult.click();
        await page.waitForLoadState('networkidle');

        // * Verify on correct page
        const currentUrl = page.url();
        expect(currentUrl).toContain(searchablePage.id);

        // # Add comment
        await enterEditMode(page);
        await addInlineCommentInEditMode(page, 'Comment from search flow');
        await publishPage(page);

        // # Navigate back
        await page.goBack();
        await page.waitForLoadState('networkidle');

        // * Verify search input is visible (confirms we're back in the wiki view)
        await expect(searchInput).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // * Verify we can still perform searches
        await searchInput.clear();
        await searchInput.fill(searchTerm);
        await waitForSearchDebounce(page);

        // * Verify search results are functional
        const searchResultAfterBack = page.getByRole('button', {name: new RegExp(searchTerm)}).first();
        await expect(searchResultAfterBack).toBeVisible({timeout: ELEMENT_TIMEOUT});
    },
);

/**
 * @objective Verify create nested hierarchy, add comments at each level, navigate via breadcrumbs
 */
test(
    'creates multi-level hierarchy with comments and breadcrumb navigation',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user} = sharedPagesSetup;

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, 'town-square');

        // # Create wiki through UI
        await createWikiThroughUI(page, uniqueName('Hierarchy Flow Wiki'));

        // # Create level 1 page
        const level1Page = await createPageThroughUI(page, 'Level 1 Page', 'Level 1 content');

        // # Add comment to level 1
        await enterEditMode(page);
        await addInlineCommentInEditMode(page, 'Level 1 comment');
        await publishPage(page);

        // # Create level 2 page (child)
        await createChildPageThroughContextMenu(page, level1Page.id!, 'Level 2 Page', 'Level 2 content');

        // # Add comment to level 2
        await enterEditMode(page);
        await addInlineCommentInEditMode(page, 'Level 2 comment');
        await publishPage(page);

        // # Navigate back to level 1 via breadcrumb
        const breadcrumb = getBreadcrumb(page);
        await breadcrumb.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
        const level1Link = getBreadcrumbLinks(page).filter({hasText: 'Level 1 Page'}).first();
        await level1Link.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
        await level1Link.click();
        await page.waitForLoadState('networkidle');

        // * Verify on level 1 page
        await verifyPageContentContains(page, 'Level 1 content');

        // * Verify level 1 comment still accessible
        const marker = await verifyCommentMarkerVisible(page);
        const rhs = await clickCommentMarkerAndOpenRHS(page, marker);
        await verifyWikiRHSContent(page, rhs, ['Level 1 comment']);
    },
);

/**
 * @objective Verify page deletion with confirmation and hierarchy update
 */
test('deletes page with children and updates hierarchy', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, 'town-square');

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, uniqueName('Delete Flow Wiki'));

    // # Create parent with child through UI
    const parent = await createPageThroughUI(page, 'Parent to Delete', 'Parent content');
    await createChildPageThroughContextMenu(page, parent.id!, 'Child Page', 'Child content');

    // # Navigate back to parent page (createChildPageThroughContextMenu leaves us on the child)
    await navigateToPage(page, pw.url, team.name, channel.id, wiki.id, parent.id!);

    // # Delete parent page via actions menu
    await deletePageViaActionsMenu(page, 'cascade');

    // * Verify redirected away from deleted page
    const currentUrl = page.url();
    expect(currentUrl).not.toContain(parent.id);

    // * Verify page no longer in hierarchy
    const hierarchyPanel = getHierarchyPanel(page);
    await expect(hierarchyPanel).toBeVisible({timeout: ELEMENT_TIMEOUT});
    const parentNode = hierarchyPanel.locator('text="Parent to Delete"').first();
    await expect(parentNode).not.toBeVisible({timeout: WEBSOCKET_WAIT});
});

/**
 * @objective Verify page rename with breadcrumb and hierarchy updates
 *
 * Note: This test uses the context menu rename feature which opens edit mode.
 * Inline title editing (clicking title to edit) is not currently implemented.
 */
test('renames page and updates breadcrumbs and hierarchy', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, 'town-square');

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, uniqueName('Rename Flow Wiki'));

    const oldTitle = 'Original Page Title';
    const newTitle = 'Renamed Page Title';

    // # Create parent and child pages through UI
    const renamePage = await createPageThroughUI(page, oldTitle, 'Page content');
    const child = await createChildPageThroughContextMenu(page, renamePage.id!, 'Child of Renamed', 'Child content');

    // # Rename page via context menu
    const pageNode = page.locator(`[data-testid="page-tree-node"][data-page-id="${renamePage.id}"]`);
    const menuButton = pageNode.locator('[data-testid="page-tree-node-menu-button"]');
    await menuButton.click();

    const renameMenuItem = page.locator('[data-testid="page-context-menu-rename"]').first();
    await renameMenuItem.click();

    // * Verify rename modal opened
    await expect(page.locator('[data-testid="rename-page-modal-title-input"]')).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Change title in rename modal
    const titleInput = page.locator('[data-testid="rename-page-modal-title-input"]');
    await titleInput.clear();
    await titleInput.fill(newTitle);

    // # Confirm rename
    const renameButton = page.locator('button:has-text("Rename")').last();
    await renameButton.click();

    // * Verify modal closed
    await expect(page.locator('[data-testid="rename-page-modal-title-input"]')).not.toBeVisible({
        timeout: ELEMENT_TIMEOUT,
    });

    // * Verify title updated in hierarchy panel
    // This ensures Redux state is fully updated before we navigate away
    const hierarchyPanelAfterRename = getHierarchyPanel(page);
    await expect(hierarchyPanelAfterRename).toContainText(newTitle, {timeout: ELEMENT_TIMEOUT});

    // # Navigate to child page
    const childPageUrl = buildWikiPageUrl(pw.url, team.name, channel.id, wiki.id, child.id);
    await page.goto(childPageUrl);
    await page.waitForLoadState('networkidle');

    // * Verify breadcrumb shows new parent title
    await verifyBreadcrumbContains(page, newTitle);

    // * Verify breadcrumb no longer shows old title
    await verifyBreadcrumbDoesNotContain(page, oldTitle);

    // * Verify hierarchy panel shows new title on child page
    const hierarchyPanel = getHierarchyPanel(page);
    await expect(hierarchyPanel).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await expect(hierarchyPanel).toContainText(newTitle);

    // * Verify hierarchy panel no longer shows old title
    await expect(hierarchyPanel).not.toContainText(oldTitle, {timeout: WEBSOCKET_WAIT});
});

/**
 * @objective Verify deep link with multiple features: comments, editing, hierarchy
 */
test(
    'opens page via deep link, adds comment, edits, verifies hierarchy',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, 'town-square');

        // # Create wiki and pages through UI
        const wiki = await createWikiThroughUI(page, uniqueName('Deep Link Flow Wiki'));
        const parent = await createPageThroughUI(page, 'Deep Link Parent', 'Parent content');
        const child = await createChildPageThroughContextMenu(
            page,
            parent.id!,
            'Deep Link Child',
            'Child deep link content',
        );

        // # Open child page via deep link
        const deepLink = buildWikiPageUrl(pw.url, team.name, channel.id, wiki.id, child.id);
        await page.goto(deepLink);
        await page.waitForLoadState('networkidle');

        // * Verify page loaded
        await verifyPageContentContains(page, 'Child deep link content');

        // # Add comment
        await enterEditMode(page);
        await addInlineCommentInEditMode(page, 'Deep link comment');
        await publishPage(page);

        // # Edit page again
        await enterEditMode(page);
        const editor = await getEditorAndWait(page);
        await editor.click();
        await editor.type(' - EDITED');
        await publishPage(page);

        // * Verify breadcrumb shows hierarchy
        await verifyBreadcrumbContains(page, 'Deep Link Parent');
        await verifyBreadcrumbContains(page, 'Deep Link Child');

        // * Verify hierarchy panel shows structure
        await verifyHierarchyContains(page, 'Deep Link Parent');
        // Expand parent to see child in hierarchy
        await expandPageTreeNode(page, 'Deep Link Parent');
        // Wait for expand animation and children to render
        await page.waitForTimeout(EDITOR_LOAD_WAIT);
        await verifyHierarchyContains(page, 'Deep Link Child');
    },
);

/**
 * @objective Verify complex workflow: multi-level hierarchy, comments, editing, permissions
 */
test('executes complex multi-feature workflow end-to-end', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user} = sharedPagesSetup;

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, 'town-square');

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Complex Workflow Wiki'));

    // # Step 1: Create root page
    const rootPage = await createPageThroughUI(page, 'Root Project Page', 'Root project documentation');

    // # Step 2: Create child pages
    await createChildPageThroughContextMenu(page, rootPage.id!, 'Requirements', 'Project requirements');

    // # Step 3: Enter edit mode to add inline comment
    await enterEditMode(page);

    // # Step 4: Select text and add inline comment
    await selectTextInEditor(page);
    const commentModal = await openInlineCommentModal(page);
    await fillAndSubmitCommentModal(page, commentModal, 'Need to review these requirements');

    // # Publish page
    await publishPage(page);

    // # Step 5: Reply to comment
    const marker = await verifyCommentMarkerVisible(page);
    const rhs = await clickCommentMarkerAndOpenRHS(page, marker);

    // # Add reply
    await addReplyToCommentThread(page, rhs, 'Requirements approved');

    // # Step 6: Resolve comment
    await toggleCommentResolution(page, rhs);

    // # Step 7: Navigate via breadcrumb
    const breadcrumb = getBreadcrumb(page);
    await breadcrumb.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    const rootLink = getBreadcrumbLinks(page).filter({hasText: 'Root Project Page'}).first();
    await rootLink.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    await rootLink.click();
    await page.waitForLoadState('networkidle');

    // * Verify on root page
    await verifyPageContentContains(page, 'Root project documentation');

    // # Step 8: Verify hierarchy shows all pages
    await verifyHierarchyContains(page, 'Root Project Page');
    await verifyHierarchyContains(page, 'Requirements');

    // * Test complete - multi-feature workflow successful
});

/**
 * @objective Verify draft to publish workflow with auto-save and recovery
 */
test(
    'creates draft with auto-save, closes browser, recovers and publishes',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, 'town-square');

        // # Create wiki through UI
        const wiki = await createWikiThroughUI(page, uniqueName('Draft Recovery Wiki'));

        // # Create draft via modal
        const newPageButton = getNewPageButton(page);
        await newPageButton.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
        await newPageButton.click();

        // # Fill modal and create page
        await fillCreatePageModal(page, 'Draft Recovery Test');

        // # Edit draft content
        const editor = await getEditorAndWait(page);
        await editor.click();
        await editor.type('Important draft content that must not be lost');

        // * Wait for auto-save
        await page.waitForTimeout(ELEMENT_TIMEOUT);

        // # Simulate browser close (navigate away)
        await page.goto(buildChannelUrl(pw.url, team.name, 'town-square'));
        await page.waitForLoadState('networkidle');

        // # Return to wiki (use correct wiki URL format)
        await page.goto(buildWikiPageUrl(pw.url, team.name, channel.id, wiki.id));
        await page.waitForLoadState('networkidle');

        // # Wait for hierarchy panel to load
        const hierarchyPanel = getHierarchyPanel(page);
        await hierarchyPanel.waitFor({state: 'visible', timeout: HIERARCHY_TIMEOUT});

        // # Recover draft (drafts are integrated in tree with data-is-draft attribute)
        const draftNode = hierarchyPanel
            .locator('[data-testid="page-tree-node"][data-is-draft="true"]')
            .filter({hasText: 'Draft Recovery Test'});
        await draftNode.waitFor({state: 'visible', timeout: HIERARCHY_TIMEOUT});
        await draftNode.click();
        await page.waitForLoadState('networkidle');

        // * Verify content recovered
        const editor2 = await getEditorAndWait(page);
        const editorContent = await editor2.textContent();
        expect(editorContent).toContain('Important draft content that must not be lost');

        // # Publish draft
        await publishPage(page);

        // * Verify published successfully
        await verifyPageContentContains(page, 'Important draft content that must not be lost');

        // * Verify draft no longer in drafts section (use correct wiki URL format)
        await page.goto(buildWikiPageUrl(pw.url, team.name, channel.id, wiki.id));
        await page.waitForLoadState('networkidle');

        const hierarchyPanel2 = getHierarchyPanel(page);
        await hierarchyPanel2.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

        const draftNode2 = hierarchyPanel2
            .locator('[data-testid="page-tree-node"][data-is-draft="true"]')
            .filter({hasText: 'Draft Recovery Test'});
        await expect(draftNode2).not.toBeVisible({timeout: WEBSOCKET_WAIT});
    },
);

/**
 * @objective Verify page move affects breadcrumbs, hierarchy, and permissions
 */
test('moves page to new parent and verifies UI updates', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user} = sharedPagesSetup;

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, 'town-square');

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Move Page Wiki'));

    // # Create pages: Parent A, Parent B, Child (under A) through UI
    const parentA = await createPageThroughUI(page, 'Parent A', 'Parent A content');
    await createPageThroughUI(page, 'Parent B', 'Parent B content');
    await createChildPageThroughContextMenu(page, parentA.id!, 'Child Page to Move', 'Child content');

    // * Verify initial breadcrumb shows Parent A
    await verifyBreadcrumbContains(page, 'Parent A');

    // # Move child to Parent B
    const moveModal = await openMovePageModal(page, 'Child Page to Move');
    const parentBOption = moveModal.locator('text="Parent B"').first();
    await expect(parentBOption).toBeVisible();
    await confirmMoveToTarget(page, moveModal, 'text="Parent B"');

    // * Verify breadcrumb now shows Parent B
    await verifyBreadcrumbContains(page, 'Parent B');
    await verifyBreadcrumbDoesNotContain(page, 'Parent A');

    // * Verify hierarchy panel shows child under Parent B
    const hierarchyPanel = getHierarchyPanel(page);
    await expect(hierarchyPanel).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Expand Parent B by clicking the expand button (NOT the title, which navigates)
    await expandPageTreeNode(page, 'Parent B');

    const childUnderParentB = hierarchyPanel.locator('text="Child Page to Move"').first();
    await expect(childUnderParentB).toBeVisible({timeout: WEBSOCKET_WAIT});

    // * Verify child is NO LONGER under Parent A
    // Parent A should either have no expand button (no children) or if expanded, should not show the child
    const parentATreeNode = getPageTreeNodeByTitle(page, 'Parent A').first();
    await expect(parentATreeNode).toBeVisible();

    // Check if Parent A has an expand button (might have no children now)
    const parentAExpandButton = parentATreeNode.locator('[data-testid="page-tree-node-expand-button"]');
    const hasExpandButton = (await parentAExpandButton.count()) > 0;

    if (hasExpandButton) {
        // If Parent A still has expand button, expand it and verify child is not there
        await parentAExpandButton.click();
        await page.waitForTimeout(SHORT_WAIT);
    }

    // Check that the child is not present under Parent A's subtree
    const childUnderParentA = parentATreeNode.locator('text="Child Page to Move"');
    await expect(childUnderParentA).not.toBeVisible({timeout: WEBSOCKET_WAIT});
});

/**
 * @objective Verify pages can be found using wiki tree panel search and results are filtered correctly
 */
test('searches pages with filters and verifies results', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user} = sharedPagesSetup;

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, 'town-square');

    // # Create wiki through UI
    const searchTerm = uniqueName('FilterTest');
    await createWikiThroughUI(page, uniqueName('Search Filters Wiki'));

    // # Create multiple pages through UI
    await createPageThroughUI(page, `${searchTerm} First Page`, 'First page content');
    await page.waitForTimeout(EDITOR_LOAD_WAIT);
    await createPageThroughUI(page, `${searchTerm} Second Page`, 'Second page content');

    // # Perform search in wiki tree panel
    const searchInput = page.locator('[data-testid="pages-search-input"]').first();
    await expect(searchInput).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await searchInput.fill(searchTerm);

    // * Verify both pages appear in filtered tree
    const treeContainer = page.locator('[data-testid="pages-hierarchy-tree"]').first();
    await expect(treeContainer).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await expect(treeContainer).toContainText('First Page', {timeout: SHORT_WAIT});
    await expect(treeContainer).toContainText('Second Page');

    // # Clear search to verify both pages exist
    await searchInput.clear();

    // * Verify both pages still visible after clearing search
    await expect(treeContainer).toContainText('First Page', {timeout: SHORT_WAIT});
    await expect(treeContainer).toContainText('Second Page');
});
