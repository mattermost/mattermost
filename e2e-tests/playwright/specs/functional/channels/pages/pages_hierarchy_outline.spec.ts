// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';
import {
    createWikiThroughUI,
    createPageThroughUI,
    createTestChannel,
    addHeadingToEditor,
    fillCreatePageModal,
    navigateToWikiView,
    getEditor,
    getNewPageButton,
    getPageOutlineInHierarchy,
    getPageViewerContent,
    showPageOutline,
    showPageOutlineViaRightClick,
    hidePageOutline,
    verifyOutlineHeadingVisible,
    clickOutlineHeading,
    publishCurrentPage,
    clearEditorContent,
    getHierarchyPanel,
    enterEditMode,
    waitForEditModeReady,
    selectAllText,
    openHierarchyNodeActionsMenu,
    SHORT_WAIT,
    EDITOR_LOAD_WAIT,
    ELEMENT_TIMEOUT,
    WEBSOCKET_WAIT,
    UI_MICRO_WAIT,
    HIERARCHY_TIMEOUT,
} from './test_helpers';

/**
 * @objective Verify show/hide outline toggle in hierarchy panel and menu item label changes
 */
test('toggles page outline visibility in hierarchy panel', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${await pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Outline Wiki ${await pw.random.id()}`);

    // # Create a page with headings through UI
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Feature Spec');

    const editor = getEditor(page);
    await editor.click();

    // # Type "Overview" and make it H2 using helper
    await addHeadingToEditor(page, 2, 'Overview');

    // # Add paragraph
    await editor.press('End');
    await editor.press('Enter');
    await editor.type('Some overview text');

    // # Add another heading "Requirements" as H2 using helper
    await editor.press('Enter');
    await addHeadingToEditor(page, 2, 'Requirements');

    // # Add paragraph
    await editor.press('End');
    await editor.press('Enter');
    await editor.type('Some requirements');

    // # Publish the page
    await publishCurrentPage(page);

    // Extract page ID from URL (consumed by navigateToWikiView below)
    const url = page.url();
    url.match(/\/pages\/([^/]+)/);

    // Navigate back to wiki view to ensure hierarchy panel is visible
    await navigateToWikiView(page, pw.url, team.name, channel.id, wiki.id);

    // * Verify outline initially hidden in hierarchy panel
    const outlineInTree = await getPageOutlineInHierarchy(page, 'Feature Spec');
    await expect(outlineInTree).not.toBeVisible({timeout: WEBSOCKET_WAIT});

    // # Open context menu via page actions menu button
    const hierarchyPanel = getHierarchyPanel(page);
    const pageNode = hierarchyPanel.locator('[data-testid="page-tree-node"]').filter({hasText: 'Feature Spec'}).first();
    let contextMenu = await openHierarchyNodeActionsMenu(page, pageNode);

    // * Verify context menu shows "Show outline" when outline is hidden
    const showOutlineButton = contextMenu.locator('[data-testid="page-context-menu-show-outline"]');
    await expect(showOutlineButton).toHaveText('Show outline');

    // # Click "Show outline" to show the outline
    await showOutlineButton.click();

    // * Verify outline appears
    await expect(outlineInTree).toBeVisible({timeout: ELEMENT_TIMEOUT});
    const outlineText = await outlineInTree.textContent();
    expect(outlineText).toContain('Overview');
    expect(outlineText).toContain('Requirements');

    // # Open context menu again via page actions menu
    contextMenu = await openHierarchyNodeActionsMenu(page, pageNode);

    // * Verify context menu now shows "Hide outline" when outline is visible
    const hideOutlineButton = contextMenu.locator('[data-testid="page-context-menu-show-outline"]');
    await expect(hideOutlineButton).toHaveText('Hide outline');

    // # Click "Hide outline" to hide the outline
    await hideOutlineButton.click();

    // * Verify outline is hidden
    await expect(outlineInTree).not.toBeVisible({timeout: WEBSOCKET_WAIT});

    // # Open context menu one more time to verify it changed back
    contextMenu = await openHierarchyNodeActionsMenu(page, pageNode);

    // * Verify context menu shows "Show outline" again
    const showOutlineButton2 = contextMenu.locator('[data-testid="page-context-menu-show-outline"]');
    await expect(showOutlineButton2).toHaveText('Show outline');
});

/**
 * @objective Verify outline updates when page headings are modified
 */
test('updates outline in hierarchy when page headings change', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${await pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);

    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Outline Wiki ${await pw.random.id()}`);

    // # Create a page with empty content (we'll add headings by editing)
    await createPageThroughUI(page, 'Page with Headings', ' ');

    // Navigate back to wiki view to ensure hierarchy panel is visible
    await navigateToWikiView(page, pw.url, team.name, channel.id, wiki.id);

    // # Click on the page to view it, then edit
    const hierarchyPanel = getHierarchyPanel(page);
    const pageNode = hierarchyPanel.locator(`text="Page with Headings"`).first();
    await pageNode.click();
    await page.waitForLoadState('networkidle');

    // # Enter edit mode
    await enterEditMode(page);
    await waitForEditModeReady(page);

    const editor = getEditor(page);
    await editor.click();

    // # Clear existing content
    await clearEditorContent(page);

    // # Add headings using helper without content (similar to test 3)
    await addHeadingToEditor(page, 1, 'Heading 1');
    await editor.press('Enter');
    await page.waitForTimeout(UI_MICRO_WAIT * 3);
    await editor.type('Content for heading 1');
    await editor.press('Enter');
    await page.waitForTimeout(EDITOR_LOAD_WAIT);

    await addHeadingToEditor(page, 2, 'Heading 2');
    await editor.press('Enter');
    await page.waitForTimeout(UI_MICRO_WAIT * 3);
    await editor.type('Content for heading 2');
    await editor.press('Enter');
    await page.waitForTimeout(EDITOR_LOAD_WAIT);

    await addHeadingToEditor(page, 3, 'Heading 3');
    await editor.press('Enter');
    await editor.type('Content for heading 3');
    await page.waitForTimeout(SHORT_WAIT);

    // # Publish the page
    await publishCurrentPage(page);

    // # Show outline for the page using right-click (more reliable after navigation)
    await showPageOutlineViaRightClick(page, 'Page with Headings');

    // * Verify initial outline headings appear
    await verifyOutlineHeadingVisible(page, 'Heading 1', HIERARCHY_TIMEOUT);
    await verifyOutlineHeadingVisible(page, 'Heading 2', HIERARCHY_TIMEOUT);
    await verifyOutlineHeadingVisible(page, 'Heading 3', HIERARCHY_TIMEOUT);

    // # Edit the page and change the headings to test UPDATE behavior
    await enterEditMode(page);
    await waitForEditModeReady(page);

    await editor.click();

    // # Clear content using select all + delete
    await selectAllText(page);
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(UI_MICRO_WAIT * 2);

    // # Add different headings with new names
    await addHeadingToEditor(page, 1, 'Updated Heading 1');
    await editor.press('Enter');
    await page.waitForTimeout(UI_MICRO_WAIT * 3);
    await editor.type('Updated content');
    await editor.press('Enter');
    await page.waitForTimeout(EDITOR_LOAD_WAIT);

    await addHeadingToEditor(page, 2, 'New Heading 2');
    await editor.press('Enter');
    await page.waitForTimeout(UI_MICRO_WAIT * 3);
    await editor.type('New content');
    await editor.press('Enter');
    await page.waitForTimeout(SHORT_WAIT);

    // # Publish the updated page
    await publishCurrentPage(page);

    // # Ensure outline is still shown after publish (it should persist)
    const outlineInTree = await getPageOutlineInHierarchy(page, 'Page with Headings');
    const outlineVisible = await outlineInTree.isVisible({timeout: 1000}).catch(() => false);

    // If outline collapsed after edit, show it again
    if (!outlineVisible) {
        await showPageOutlineViaRightClick(page, 'Page with Headings');
    }

    // * Verify outline reflects the CHANGES (old headings gone, new headings present)
    await verifyOutlineHeadingVisible(page, 'Updated Heading 1', HIERARCHY_TIMEOUT);
    await verifyOutlineHeadingVisible(page, 'New Heading 2', HIERARCHY_TIMEOUT);

    // * Verify old headings are no longer in outline
    const oldHeading1 = page
        .locator('[role="treeitem"]')
        .filter({hasText: /^Heading 1$/})
        .first();
    const oldHeading3 = page
        .locator('[role="treeitem"]')
        .filter({hasText: /^Heading 3$/})
        .first();
    expect(await oldHeading1.isVisible().catch(() => false)).toBe(false);
    expect(await oldHeading3.isVisible().catch(() => false)).toBe(false);
});

/**
 * @objective Verify clicking outline item navigates to heading in page
 */
test('clicks outline item in hierarchy to navigate to heading', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${await pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Outline Click Wiki ${await pw.random.id()}`);

    // # Create a page with empty content (we'll add headings by editing)
    await createPageThroughUI(page, 'Navigate to Headings', ' ');

    // Navigate back to wiki view to ensure hierarchy panel is visible
    await navigateToWikiView(page, pw.url, team.name, channel.id, wiki.id);

    // # Click on the page to view it, then edit
    const hierarchyPanel = getHierarchyPanel(page);
    const pageNode = hierarchyPanel.locator(`text="Navigate to Headings"`).first();
    await pageNode.click();
    await page.waitForLoadState('networkidle');

    // # Wait for page viewer to be visible (confirms we're in view mode)
    await getPageViewerContent(page).waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

    // # Enter edit mode
    await enterEditMode(page);
    await waitForEditModeReady(page);

    const editor = getEditor(page);
    await editor.click();

    // # Clear existing content
    await clearEditorContent(page);

    // # Add H1 heading "Introduction" with multiple paragraphs
    let introContent = '';
    for (let i = 0; i < 10; i++) {
        introContent += 'Introduction paragraph. ';
    }
    await addHeadingToEditor(page, 1, 'Introduction', introContent);
    await page.waitForTimeout(SHORT_WAIT);

    // # Add H2 heading "Middle Section" with multiple paragraphs
    let middleContent = '';
    for (let i = 0; i < 10; i++) {
        middleContent += 'Middle section content. ';
    }
    await addHeadingToEditor(page, 2, 'Middle Section', middleContent);
    await page.waitForTimeout(SHORT_WAIT);

    // # Add H2 heading "Conclusion" with some content
    await addHeadingToEditor(page, 2, 'Conclusion', 'Conclusion content.');

    // # Publish the page
    await publishCurrentPage(page);

    // # Show outline for the page using right-click (more reliable after navigation)
    await showPageOutlineViaRightClick(page, 'Navigate to Headings');

    // * Verify "Conclusion" heading appears in outline
    await verifyOutlineHeadingVisible(page, 'Conclusion', ELEMENT_TIMEOUT);

    // # Click on "Conclusion" heading in outline to navigate
    await clickOutlineHeading(page, 'Conclusion');

    // * Verify page navigates to the heading location (heading is visible in viewport)
    const conclusionHeading = page
        .locator('h2:has-text("Conclusion"), h1:has-text("Conclusion"), h3:has-text("Conclusion")')
        .first();
    await expect(conclusionHeading).toBeInViewport({timeout: ELEMENT_TIMEOUT});
});

/**
 * @objective Verify outline visibility persists across page navigation
 */
test(
    'preserves outline visibility setting when navigating between pages',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await createTestChannel(adminClient, team.id, `Test Channel ${await pw.random.id()}`);

        const {page, channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        // # Create wiki through UI
        await createWikiThroughUI(page, `Persist Outline Wiki ${await pw.random.id()}`);

        // # Create page 1 and immediately add headings (before creating page 2)
        const page1 = await createPageThroughUI(page, 'Page 1 with Headings', ' ');

        const hierarchyPanel = getHierarchyPanel(page);
        const page1Node = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-page-id="${page1.id}"]`).first();

        // # Edit Page 1 immediately after creation (no navigation away yet)
        await enterEditMode(page);
        await waitForEditModeReady(page);

        const editor1 = getEditor(page);
        await editor1.click();
        await selectAllText(page);
        await page.keyboard.press('Backspace');
        await page.waitForTimeout(UI_MICRO_WAIT * 2);

        // # Add heading using helper function
        await addHeadingToEditor(page, 1, 'Page 1 Heading');

        // Verify heading exists in editor before publishing
        const h1InEditor = editor1.locator('h1:has-text("Page 1 Heading")');
        await expect(h1InEditor).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Publish page 1
        await publishCurrentPage(page);

        // # Verify the heading was published correctly by checking page viewer
        const pageViewer = getPageViewerContent(page);
        const publishedHeading = pageViewer.locator('h1:has-text("Page 1 Heading")');
        await expect(publishedHeading).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // Verify the heading has an ID (required for outline)
        const headingId = await publishedHeading.getAttribute('id');
        if (!headingId) {
            throw new Error('Heading does not have an ID attribute - outline will not work');
        }

        // # Now create page 2 (this will navigate away from page 1)
        const page2 = await createPageThroughUI(page, 'Page 2 with Headings', ' ');

        // # Show outline for Page 1
        await showPageOutline(page, page1.id);

        // * Verify outline is expanded for Page 1 by looking for the heading in tree items
        await verifyOutlineHeadingVisible(page, 'Page 1 Heading', ELEMENT_TIMEOUT);

        // # Navigate to Page 2
        const page2Node = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-page-id="${page2.id}"]`).first();
        await page2Node.click();
        await page.waitForLoadState('networkidle');

        // * Verify outline for Page 1 is still expanded in hierarchy
        await verifyOutlineHeadingVisible(page, 'Page 1 Heading', ELEMENT_TIMEOUT);

        // # Navigate back to Page 1
        await page1Node.click();
        await page.waitForLoadState('networkidle');

        // * Verify outline remains expanded
        await verifyOutlineHeadingVisible(page, 'Page 1 Heading', ELEMENT_TIMEOUT);

        // # Hide outline for Page 1
        await hidePageOutline(page, page1.id);

        // * Verify outline is collapsed (scoped to Page 1's outline container)
        const page1OutlineContainer = await getPageOutlineInHierarchy(page, 'Page 1 with Headings');
        const page1OutlineHeading = page1OutlineContainer
            .locator('[role="treeitem"]')
            .filter({hasText: /^Page 1 Heading$/})
            .first();
        const isCollapsed = await page1OutlineHeading.isVisible().catch(() => false);
        expect(isCollapsed).toBe(false);

        // # Navigate away and back
        await page2Node.click();
        await page.waitForLoadState('networkidle');
        await page1Node.click();
        await page.waitForLoadState('networkidle');

        // * Verify outline remains collapsed after navigation (scoped to Page 1's outline)
        await expect(async () => {
            const stillCollapsed = await page1OutlineHeading.isVisible().catch(() => false);
            expect(stillCollapsed).toBe(false);
        }).toPass({timeout: SHORT_WAIT});
    },
);
