// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';
import {
    createWikiThroughUI,
    createPageThroughUI,
    createChildPageThroughContextMenu,
    createTestChannel,
    getHierarchyPanel,
    loginAndNavigateToChannel,
    uniqueName,
    SHORT_WAIT,
    ELEMENT_TIMEOUT,
    UI_MICRO_WAIT,
    DRAG_ANIMATION_WAIT,
} from './test_helpers';

/**
 * @objective Verify drag-and-drop to make a page a child of another page
 */
test.skip('makes page a child via drag-drop', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
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
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Drag Wiki'));

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
    await page.waitForTimeout(UI_MICRO_WAIT);

    // Move to center of parent (combine behavior in react-beautiful-dnd)
    await page.mouse.move(parentBox.x + parentBox.width / 2, parentBox.y + parentBox.height / 2, {steps: 10});
    await page.waitForTimeout(UI_MICRO_WAIT * 2);

    // Drop
    await page.mouse.up();

    // # Wait for drag operation to complete and UI to update
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DRAG_ANIMATION_WAIT);

    // * Verify parent now has expand button (indicating it has children)
    const expandButton = parentNode.locator('[data-testid="page-tree-node-expand-button"]');
    await expect(expandButton).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Expand parent to see children
    await expandButton.click();
    await page.waitForTimeout(SHORT_WAIT);

    // * Verify sibling page appears under parent
    const childNode = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-page-id="${siblingPage.id}"]`);
    await expect(childNode).toBeVisible({timeout: ELEMENT_TIMEOUT});

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
test.skip('promotes child page to root level via drag-drop', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    // BLOCKED: Playwright drag-and-drop doesn't work with react-beautiful-dnd (same as above test)
    //
    // The UI functionality WORKS - dragging child between root nodes should promote it
    // The underlying API is tested via "moves page to new parent within same wiki" test (uses modal)
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Promote Wiki'));

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
    await page.waitForTimeout(SHORT_WAIT);

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
    await page.waitForTimeout(UI_MICRO_WAIT);

    // # Move to space BETWEEN root pages (above rootPage2, not ON it)
    // Move to just above the rootPage2 to drop BETWEEN pages
    await page.mouse.move(rootPage2Box.x + rootPage2Box.width / 2, rootPage2Box.y - 5, {steps: 10});
    await page.waitForTimeout(UI_MICRO_WAIT * 2);

    // # Drop
    await page.mouse.up();

    // # Wait for drag operation to complete and UI to update
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DRAG_ANIMATION_WAIT);

    // * Verify child node is now at root level (no longer under parent)
    // Parent node should no longer have expand button (or should collapse)
    const parentStillHasExpandButton = await parentNode
        .locator('[data-testid="page-tree-node-expand-button"]')
        .isVisible()
        .catch(() => false);

    // If parent still has expand button, it should show child is gone
    if (parentStillHasExpandButton) {
        // Collapse and re-expand to refresh
        await expandButton.click();
        await page.waitForTimeout(UI_MICRO_WAIT * 3);
        await expandButton.click();
        await page.waitForTimeout(SHORT_WAIT);

        // Child should not be visible under parent anymore
        const childStillUnderParent = await hierarchyPanel
            .locator(`[data-testid="page-tree-node"][data-page-id="${childPage.id}"]`)
            .count();
        expect(childStillUnderParent).toBe(0);
    }

    // * Verify promoted child now appears at root level with same padding as other root pages
    const promotedChildNode = hierarchyPanel
        .locator(`[data-testid="page-tree-node"][data-page-id="${childPage.id}"]`)
        .first();
    await expect(promotedChildNode).toBeVisible({timeout: ELEMENT_TIMEOUT});

    const newChildPadding = await promotedChildNode.evaluate((el) => {
        return window.getComputedStyle(el).paddingLeft;
    });

    // Should now have same padding as root pages (not indented)
    expect(newChildPadding).toBe(parentPadding);
});

/**
 * @objective Verify drag-and-drop reordering of pages at the same hierarchy level
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
test.skip('reorders pages at same level via drag-drop', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    // NOTE: page_sort_order is NOW IMPLEMENTED (stored in Post.Props)
    // The DisplayOrder blocker has been resolved.
    //
    // However, this test remains skipped due to Playwright + react-beautiful-dnd compatibility issues.
    // Playwright's native drag-and-drop (dragTo, mouse.down/up) doesn't properly trigger
    // react-beautiful-dnd's event handlers.
    //
    // The reordering functionality is tested via the "reorders pages via API call" test below.
});

/**
 * @objective Verify page reordering works via API call with new_index parameter
 * This tests the complete reordering flow from API to frontend rendering.
 */
test('reorders pages via API call', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Reorder API Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, uniqueName('Reorder Wiki'));

    // # Create three root-level pages (they will be ordered by create_at initially)
    const page1 = await createPageThroughUI(page, 'Page 1', 'Content 1');
    await page.waitForTimeout(SHORT_WAIT);
    await createPageThroughUI(page, 'Page 2', 'Content 2');
    await page.waitForTimeout(SHORT_WAIT);
    await createPageThroughUI(page, 'Page 3', 'Content 3');

    // * Verify pages exist in hierarchy panel
    const hierarchyPanel = getHierarchyPanel(page);

    // Wait for pages to load in hierarchy panel
    await page.waitForTimeout(SHORT_WAIT);

    // Get order of our test pages by filtering to only pages with "Page " prefix
    const getTestPageOrder = async () => {
        const nodes = await hierarchyPanel.locator('[data-testid="page-tree-node"]').all();
        const titles: string[] = [];
        for (const node of nodes) {
            const titleEl = node.locator('[data-testid="page-tree-node-title"]');
            const title = await titleEl.textContent();
            if (title && title.startsWith('Page ')) {
                titles.push(title);
            }
        }
        return titles;
    };

    const initialOrder = await getTestPageOrder();
    expect(initialOrder).toEqual(['Page 1', 'Page 2', 'Page 3']);

    // # Call API to move Page 1 to index 2 (end of list among root pages)
    // This should result in order: Page 2, Page 3, Page 1
    await adminClient.movePage(wiki.id, page1.id!, '', 2);

    // # Refresh page to get updated order from server
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(SHORT_WAIT);

    // * Verify new order: Page 2, Page 3, Page 1
    const newOrder = await getTestPageOrder();
    expect(newOrder).toEqual(['Page 2', 'Page 3', 'Page 1']);
});
