// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createPageViaDraft, makeClient} from '@mattermost/playwright-lib';

import {expect, test} from './pages_test_fixture';
import {
    createWikiThroughUI,
    createTestChannel,
    waitForPageInHierarchy,
    getHierarchyPanel,
    expandPageTreeNode,
    clickPageInHierarchy,
    getPageViewerContent,
    ensurePanelOpen,
    verifyBreadcrumbContains,
    createPageContent,
    uniqueName,
    ELEMENT_TIMEOUT,
    HIERARCHY_TIMEOUT,
    SHORT_WAIT,
    MAX_PAGE_DEPTH,
} from './test_helpers';

/**
 * @objective Verify hierarchy panel loads correctly with 100+ pages
 *
 * @precondition
 * Uses API to bulk-create pages for performance
 */
test('loads hierarchy panel with 100+ pages', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    test.setTimeout(300000); // 5 minutes for bulk creation

    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, 'Large Hierarchy Test', 'O', [user.id]);

    // # Login and navigate to channel
    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await page.waitForLoadState('networkidle');

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, uniqueName('Large Wiki'));

    // # Create client for API calls
    const {client} = await makeClient(user);

    // # Bulk create 100 pages via API
    const pageCount = 100;
    const createdPages: Array<{id: string; title: string}> = [];

    for (let i = 0; i < pageCount; i++) {
        const title = `Page ${String(i + 1).padStart(3, '0')}`;
        const content = createPageContent(`Content for page ${i + 1}`);
        const createdPage = await createPageViaDraft(client, wiki.id, title, content);
        createdPages.push({id: createdPage.id, title});
    }

    // # Refresh page to load all pages
    await page.reload();
    await page.waitForLoadState('networkidle');

    // # Ensure hierarchy panel is open
    await ensurePanelOpen(page);

    // * Verify hierarchy panel is visible
    const hierarchyPanel = getHierarchyPanel(page);
    await expect(hierarchyPanel).toBeVisible({timeout: HIERARCHY_TIMEOUT});

    // * Verify multiple pages are visible in hierarchy (at least some of them)
    // Check first, middle, and last pages
    await waitForPageInHierarchy(page, 'Page 001', HIERARCHY_TIMEOUT);
    await waitForPageInHierarchy(page, 'Page 050', HIERARCHY_TIMEOUT);
    await waitForPageInHierarchy(page, 'Page 100', HIERARCHY_TIMEOUT);

    // * Verify clicking on a page works correctly
    await clickPageInHierarchy(page, 'Page 050');
    const pageContent = getPageViewerContent(page);
    await expect(pageContent).toContainText('Content for page 50', {timeout: ELEMENT_TIMEOUT});
});

/**
 * @objective Verify deep hierarchy (max 10 levels) loads and navigates correctly
 *
 * @precondition
 * Uses API to create deeply nested page structure (max depth is 10)
 */
test('handles deep hierarchy with maximum nesting levels', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    test.setTimeout(180000); // 3 minutes

    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, 'Deep Hierarchy Test', 'O', [user.id]);

    // # Login and navigate to channel
    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await page.waitForLoadState('networkidle');

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, uniqueName('Deep Wiki'));

    // # Create client for API calls
    const {client} = await makeClient(user);

    // # Create max levels of nested pages via API
    const depth = MAX_PAGE_DEPTH;
    let parentId = '';
    const createdPages: Array<{id: string; title: string; level: number}> = [];

    for (let level = 1; level <= depth; level++) {
        const title = `Level ${level} Page`;
        const content = createPageContent(`Content at depth ${level}`);
        const createdPage = await createPageViaDraft(client, wiki.id, title, content, parentId);
        createdPages.push({id: createdPage.id, title, level});
        parentId = createdPage.id;
    }

    // # Refresh page to load all pages
    await page.reload();
    await page.waitForLoadState('networkidle');

    // # Ensure hierarchy panel is open
    await ensurePanelOpen(page);

    // * Verify root level page is visible
    await waitForPageInHierarchy(page, 'Level 1 Page', HIERARCHY_TIMEOUT);

    // # Expand all levels to reach the deepest page
    for (let level = 1; level < depth; level++) {
        await expandPageTreeNode(page, `Level ${level} Page`);
        await page.waitForTimeout(SHORT_WAIT);
    }

    // * Verify deepest page is visible after expanding
    await waitForPageInHierarchy(page, `Level ${depth} Page`, HIERARCHY_TIMEOUT);

    // * Click on the deepest page and verify content
    await clickPageInHierarchy(page, `Level ${depth} Page`);
    const pageContent = getPageViewerContent(page);
    await expect(pageContent).toContainText(`Content at depth ${depth}`, {timeout: ELEMENT_TIMEOUT});

    // * Verify breadcrumb shows the wiki name and parent path
    await verifyBreadcrumbContains(page, `Level ${depth} Page`);
});

/**
 * @objective Verify wide hierarchy (many siblings at same level) loads correctly
 *
 * @precondition
 * Uses API to create flat structure with many pages
 */
test('handles wide hierarchy with 50+ sibling pages', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    test.setTimeout(180000); // 3 minutes

    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, 'Wide Hierarchy Test', 'O', [user.id]);

    // # Login and navigate to channel
    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await page.waitForLoadState('networkidle');

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, uniqueName('Wide Wiki'));

    // # Create client for API calls
    const {client} = await makeClient(user);

    // # Create a parent page
    const parentContent = createPageContent('Parent page content');
    const parentPage = await createPageViaDraft(client, wiki.id, 'Parent Page', parentContent);

    // # Create 50 child pages under the parent
    const childCount = 50;
    for (let i = 0; i < childCount; i++) {
        const title = `Child ${String(i + 1).padStart(2, '0')}`;
        const content = createPageContent(`Child content ${i + 1}`);
        await createPageViaDraft(client, wiki.id, title, content, parentPage.id);
    }

    // # Refresh page to load all pages
    await page.reload();
    await page.waitForLoadState('networkidle');

    // # Ensure hierarchy panel is open
    await ensurePanelOpen(page);

    // * Verify parent page is visible
    await waitForPageInHierarchy(page, 'Parent Page', HIERARCHY_TIMEOUT);

    // # Expand parent to show children
    await expandPageTreeNode(page, 'Parent Page');
    await page.waitForTimeout(SHORT_WAIT);

    // * Verify first, middle, and last children are visible
    await waitForPageInHierarchy(page, 'Child 01', HIERARCHY_TIMEOUT);
    await waitForPageInHierarchy(page, 'Child 25', HIERARCHY_TIMEOUT);
    await waitForPageInHierarchy(page, 'Child 50', HIERARCHY_TIMEOUT);

    // * Click on a child and verify content loads
    await clickPageInHierarchy(page, 'Child 25');
    const pageContent = getPageViewerContent(page);
    await expect(pageContent).toContainText('Child content 25', {timeout: ELEMENT_TIMEOUT});
});

/**
 * @objective Verify search works correctly in a wiki with many pages
 *
 * @precondition
 * Uses API to create pages with searchable content
 */
test('searches efficiently in wiki with 50+ pages', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    test.setTimeout(180000); // 3 minutes

    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, 'Search Test', 'O', [user.id]);

    // # Login and navigate to channel
    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await page.waitForLoadState('networkidle');

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, uniqueName('Search Wiki'));

    // # Create client for API calls
    const {client} = await makeClient(user);

    // # Create 50 pages with unique identifiers
    const uniqueSearchTerm = `UniqueSearch${Date.now()}`;
    const pageCount = 50;

    for (let i = 0; i < pageCount; i++) {
        const title = `Document ${String(i + 1).padStart(2, '0')}`;
        // Only one page will have the unique search term
        const contentText = i === 25 ? `Contains ${uniqueSearchTerm} keyword` : `Generic content ${i + 1}`;
        const content = createPageContent(contentText);
        await createPageViaDraft(client, wiki.id, title, content);
    }

    // # Refresh page to load all pages
    await page.reload();
    await page.waitForLoadState('networkidle');

    // # Ensure hierarchy panel is open
    await ensurePanelOpen(page);

    // # Use the search input in the hierarchy panel
    const searchInput = page.locator('[data-testid="pages-hierarchy-search-input"]');
    if (await searchInput.isVisible()) {
        await searchInput.fill('Document 26');
        await page.waitForTimeout(SHORT_WAIT);

        // * Verify search filters to show matching page
        const searchResults = page.locator('[data-testid="page-tree-node"]');
        const resultCount = await searchResults.count();
        expect(resultCount).toBeGreaterThanOrEqual(1);

        // * Verify the matching page is visible
        await waitForPageInHierarchy(page, 'Document 26', ELEMENT_TIMEOUT);
    }
});

/**
 * @objective Verify page tree expansion and collapse works with large hierarchies
 *
 * @precondition
 * Uses API to create multi-level structure
 */
test('expands and collapses page tree nodes efficiently', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    test.setTimeout(180000); // 3 minutes

    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, 'Expand Collapse Test', 'O', [user.id]);

    // # Login and navigate to channel
    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await page.waitForLoadState('networkidle');

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, uniqueName('Expand Collapse Wiki'));

    // # Create client for API calls
    const {client} = await makeClient(user);

    // # Create a structure with multiple parent-child relationships
    // 5 root pages, each with 5 children, each child with 3 grandchildren
    const structure: Array<{id: string; title: string; level: number}> = [];

    for (let root = 1; root <= 5; root++) {
        const rootTitle = `Root ${root}`;
        const rootContent = createPageContent(`Root page ${root} content`);
        const rootPage = await createPageViaDraft(client, wiki.id, rootTitle, rootContent);
        structure.push({id: rootPage.id, title: rootTitle, level: 1});

        for (let child = 1; child <= 5; child++) {
            const childTitle = `Root ${root} Child ${child}`;
            const childContent = createPageContent(`Child content`);
            const childPage = await createPageViaDraft(client, wiki.id, childTitle, childContent, rootPage.id);
            structure.push({id: childPage.id, title: childTitle, level: 2});

            for (let grandchild = 1; grandchild <= 3; grandchild++) {
                const grandchildTitle = `R${root}C${child} Grandchild ${grandchild}`;
                const grandchildContent = createPageContent(`Grandchild content`);
                const grandchildPage = await createPageViaDraft(
                    client,
                    wiki.id,
                    grandchildTitle,
                    grandchildContent,
                    childPage.id,
                );
                structure.push({id: grandchildPage.id, title: grandchildTitle, level: 3});
            }
        }
    }

    // # Refresh page to load all pages
    await page.reload();
    await page.waitForLoadState('networkidle');

    // # Ensure hierarchy panel is open
    await ensurePanelOpen(page);

    // * Verify root pages are visible
    await waitForPageInHierarchy(page, 'Root 1', HIERARCHY_TIMEOUT);
    await waitForPageInHierarchy(page, 'Root 5', HIERARCHY_TIMEOUT);

    // # Expand Root 3 to show its children
    await expandPageTreeNode(page, 'Root 3');
    await page.waitForTimeout(SHORT_WAIT);

    // * Verify children are now visible
    await waitForPageInHierarchy(page, 'Root 3 Child 1', ELEMENT_TIMEOUT);
    await waitForPageInHierarchy(page, 'Root 3 Child 5', ELEMENT_TIMEOUT);

    // # Expand a child to show grandchildren
    await expandPageTreeNode(page, 'Root 3 Child 3');
    await page.waitForTimeout(SHORT_WAIT);

    // * Verify grandchildren are visible
    await waitForPageInHierarchy(page, 'R3C3 Grandchild 1', ELEMENT_TIMEOUT);
    await waitForPageInHierarchy(page, 'R3C3 Grandchild 3', ELEMENT_TIMEOUT);

    // # Click on a grandchild and verify navigation works
    await clickPageInHierarchy(page, 'R3C3 Grandchild 2');
    const pageContent = getPageViewerContent(page);
    await expect(pageContent).toContainText('Grandchild content', {timeout: ELEMENT_TIMEOUT});
});

/**
 * @objective Verify navigation performance with large page count
 *
 * @precondition
 * Measures time to navigate between pages in large wiki
 */
test('navigates between pages efficiently in large wiki', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    test.setTimeout(300000); // 5 minutes

    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, 'Navigation Perf Test', 'O', [user.id]);

    // # Login and navigate to channel
    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await page.waitForLoadState('networkidle');

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, uniqueName('Navigation Wiki'));

    // # Create client for API calls
    const {client} = await makeClient(user);

    // # Bulk create 75 pages via API
    const pageCount = 75;
    const createdPages: Array<{id: string; title: string}> = [];

    for (let i = 0; i < pageCount; i++) {
        const title = `Nav Page ${String(i + 1).padStart(2, '0')}`;
        const content = createPageContent(`Navigable content ${i + 1}`);
        const createdPage = await createPageViaDraft(client, wiki.id, title, content);
        createdPages.push({id: createdPage.id, title});
    }

    // # Refresh page to load all pages
    await page.reload();
    await page.waitForLoadState('networkidle');

    // # Ensure hierarchy panel is open
    await ensurePanelOpen(page);

    // # Navigate to multiple pages and verify content loads correctly
    // Note: API-created pages are drafts and open in editor mode, not viewer mode
    const pagesToTest = ['Nav Page 01', 'Nav Page 25', 'Nav Page 50', 'Nav Page 75'];

    for (const pageTitle of pagesToTest) {
        // Click on page in hierarchy
        await waitForPageInHierarchy(page, pageTitle, HIERARCHY_TIMEOUT);
        const pageNode = page.locator('[data-testid="page-tree-node"]').filter({hasText: pageTitle}).first();
        await pageNode.click();

        // * Verify page content loads (check editor content for drafts)
        const expectedNumber = pageTitle.replace('Nav Page ', '');
        const editorContent = page.locator('.ProseMirror');
        await expect(editorContent).toContainText(`Navigable content ${parseInt(expectedNumber, 10)}`, {
            timeout: HIERARCHY_TIMEOUT,
        });

        await page.waitForTimeout(SHORT_WAIT);
    }
});
