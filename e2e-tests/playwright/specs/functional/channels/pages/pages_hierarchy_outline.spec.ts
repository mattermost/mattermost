// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';

import {
    createWikiThroughUI,
    createPageThroughUI,
    createTestChannel,
    addHeadingToEditor,
    fillCreatePageModal,
    waitForEditModeReady,
    navigateToWikiView,
    getPageOutlineInHierarchy,
    showPageOutline,
    showPageOutlineViaRightClick,
    hidePageOutline,
    verifyOutlineHeadingVisible,
    clickOutlineHeading,
    publishCurrentPage,
    clearEditorContent,
} from './test_helpers';

/**
 * @objective Verify show/hide outline toggle in hierarchy panel and menu item label changes
 */
test('toggles page outline visibility in hierarchy panel', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Outline Wiki ${pw.random.id()}`);

    // # Create a page with headings through UI
    const newPageButton = page.locator('[data-testid="new-page-button"]');
    await newPageButton.click();
    await fillCreatePageModal(page, 'Feature Spec');

    const editor = page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();
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

    // Extract page ID from URL
    const url = page.url();
    const pageIdMatch = url.match(/\/pages\/([^/]+)/);
    const testPage = {id: pageIdMatch ? pageIdMatch[1] : null};

    // Navigate back to wiki view to ensure hierarchy panel is visible
    await navigateToWikiView(page, pw.url, team.name, channel.id, wiki.id);

    // * Verify outline initially hidden in hierarchy panel
    const outlineInTree = await getPageOutlineInHierarchy(page, 'Feature Spec');
    await expect(outlineInTree).not.toBeVisible({timeout: 2000});

    // # Open context menu via right-click
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');
    const pageNode = hierarchyPanel.locator('[data-testid="page-tree-node"]').filter({hasText: 'Feature Spec'}).first();
    await pageNode.click({button: 'right'});

    // * Verify context menu shows "Show outline" when outline is hidden
    const contextMenu = page.locator('[data-testid="page-context-menu"]');
    await contextMenu.waitFor({state: 'visible', timeout: 2000});
    const showOutlineButton = contextMenu.locator('[data-testid="page-context-menu-show-outline"]');
    await expect(showOutlineButton).toHaveText('Show outline');

    // # Click "Show outline" to show the outline
    await showOutlineButton.click();

    // * Verify outline appears
    await expect(outlineInTree).toBeVisible({timeout: 3000});
    const outlineText = await outlineInTree.textContent();
    expect(outlineText).toContain('Overview');
    expect(outlineText).toContain('Requirements');

    // # Open context menu again via right-click
    await pageNode.click({button: 'right'});
    await contextMenu.waitFor({state: 'visible', timeout: 2000});

    // * Verify context menu now shows "Hide outline" when outline is visible
    const hideOutlineButton = contextMenu.locator('[data-testid="page-context-menu-show-outline"]');
    await expect(hideOutlineButton).toHaveText('Hide outline');

    // # Click "Hide outline" to hide the outline
    await hideOutlineButton.click();

    // * Verify outline is hidden
    await expect(outlineInTree).not.toBeVisible({timeout: 2000});

    // # Open context menu one more time to verify it changed back
    await pageNode.click({button: 'right'});
    await contextMenu.waitFor({state: 'visible', timeout: 2000});

    // * Verify context menu shows "Show outline" again
    await expect(showOutlineButton).toHaveText('Show outline');
});

/**
 * @objective Verify outline updates when page headings are modified
 */
test('updates outline in hierarchy when page headings change', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);

    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Outline Wiki ${pw.random.id()}`);

    // # Create a page with empty content (we'll add headings by editing)
    const testPage = await createPageThroughUI(page, 'Page with Headings', ' ');

    // Navigate back to wiki view to ensure hierarchy panel is visible
    await navigateToWikiView(page, pw.url, team.name, channel.id, wiki.id);

    // # Click on the page to view it, then edit
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');
    const pageNode = hierarchyPanel.locator(`text="Page with Headings"`).first();
    await pageNode.click();
    await page.waitForLoadState('networkidle');

    // # Click edit button and wait for edit mode to be ready
    const editButton = page.locator('[data-testid="wiki-page-edit-button"], button:has-text("Edit")').first();
    await expect(editButton).toBeVisible({timeout: 2000});
    await editButton.click();

    // # Wait for edit mode to be fully ready using helper
    await waitForEditModeReady(page);

    const editor = page.locator('.ProseMirror').first();
    await editor.click();

    // # Clear existing content
    await clearEditorContent(page);

    // # Add headings using helper without content (similar to test 3)
    await addHeadingToEditor(page, 1, 'Heading 1');
    await editor.press('Enter');
    await page.waitForTimeout(300);
    await editor.type('Content for heading 1');
    await editor.press('Enter');
    await page.waitForTimeout(1000);

    await addHeadingToEditor(page, 2, 'Heading 2');
    await editor.press('Enter');
    await page.waitForTimeout(300);
    await editor.type('Content for heading 2');
    await editor.press('Enter');
    await page.waitForTimeout(1000);

    await addHeadingToEditor(page, 3, 'Heading 3');
    await editor.press('Enter');
    await editor.type('Content for heading 3');
    await page.waitForTimeout(500);

    // # Publish the page
    await publishCurrentPage(page);

    // # Show outline for the page
    await showPageOutline(page, testPage.id);

    // * Verify outline is visible and headings appear
    await verifyOutlineHeadingVisible(page, 'Heading 1', 10000);
    await verifyOutlineHeadingVisible(page, 'Heading 2', 10000);
    await verifyOutlineHeadingVisible(page, 'Heading 3', 10000);
});

/**
 * @objective Verify clicking outline item navigates to heading in page
 */
test('clicks outline item in hierarchy to navigate to heading', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Outline Click Wiki ${pw.random.id()}`);

    // # Create a page with empty content (we'll add headings by editing)
    const testPage = await createPageThroughUI(page, 'Navigate to Headings', ' ');

    // Navigate back to wiki view to ensure hierarchy panel is visible
    await navigateToWikiView(page, pw.url, team.name, channel.id, wiki.id);

    // # Click on the page to view it, then edit
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');
    const pageNode = hierarchyPanel.locator(`text="Navigate to Headings"`).first();
    await pageNode.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // # Wait for page viewer to be visible (confirms we're in view mode)
    await page.locator('[data-testid="page-viewer-content"]').waitFor({state: 'visible', timeout: 5000});

    // # Click edit button and wait for edit mode to be ready
    const editButton = page.locator('[data-testid="wiki-page-edit-button"]');
    await editButton.waitFor({state: 'visible', timeout: 5000});
    await editButton.click({force: true});

    // # Wait for edit mode to be fully ready using helper
    await waitForEditModeReady(page);

    const editor = page.locator('.ProseMirror').first();
    await editor.click();

    // # Clear existing content
    await clearEditorContent(page);

    // # Add H1 heading "Introduction" with multiple paragraphs
    let introContent = '';
    for (let i = 0; i < 10; i++) {
        introContent += 'Introduction paragraph. ';
    }
    await addHeadingToEditor(page, 1, 'Introduction', introContent);
    await page.waitForTimeout(500);

    // # Add H2 heading "Middle Section" with multiple paragraphs
    let middleContent = '';
    for (let i = 0; i < 10; i++) {
        middleContent += 'Middle section content. ';
    }
    await addHeadingToEditor(page, 2, 'Middle Section', middleContent);
    await page.waitForTimeout(500);

    // # Add H2 heading "Conclusion" with some content
    await addHeadingToEditor(page, 2, 'Conclusion', 'Conclusion content.');

    // # Publish the page
    await publishCurrentPage(page);

    // # Show outline for the page
    await showPageOutline(page, testPage.id);

    // * Verify "Conclusion" heading appears in outline
    await verifyOutlineHeadingVisible(page, 'Conclusion', 5000);

    // # Click on "Conclusion" heading in outline to navigate
    await clickOutlineHeading(page, 'Conclusion');

    // * Verify page navigates to the heading location (heading is visible in viewport)
    const conclusionHeading = page.locator('h2:has-text("Conclusion"), h1:has-text("Conclusion"), h3:has-text("Conclusion")').first();
    await expect(conclusionHeading).toBeInViewport({timeout: 3000});
});

/**
 * @objective Verify outline visibility persists across page navigation
 */
test('preserves outline visibility setting when navigating between pages', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Persist Outline Wiki ${pw.random.id()}`);

    // # Create page 1 and immediately add headings (before creating page 2)
    const page1 = await createPageThroughUI(page, 'Page 1 with Headings', ' ');

    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');
    const page1Node = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-page-id="${page1.id}"]`).first();

    // # Edit Page 1 immediately after creation (no navigation away yet)
    const editButton1 = page.locator('[data-testid="wiki-page-edit-button"], button:has-text("Edit")').first();
    await editButton1.click();
    await page.waitForTimeout(500);

    const editor1 = page.locator('.ProseMirror').first();
    await editor1.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');

    // Type the heading text
    await page.keyboard.type('Page 1 Heading');
    await page.waitForTimeout(200);

    // Create native DOM selection explicitly (fixes headless browser issue)
    await editor1.evaluate((node) => {
        const sel = node.ownerDocument.getSelection();
        const range = node.ownerDocument.createRange();
        range.selectNodeContents(node.firstChild);
        sel.removeAllRanges();
        sel.addRange(range);
        node.dispatchEvent(new Event('selectionchange', {bubbles: true}));
    });

    // Wait for formatting bubble to appear
    const formattingBubble = page.locator('.formatting-bar-bubble').first();
    await formattingBubble.waitFor({state: 'visible', timeout: 5000});
    await page.waitForTimeout(200);

    // Click Heading 1 button (force:true to click through inline-comment-bubble overlay)
    const headingButton = formattingBubble.locator('button[title="Heading 1"]').first();
    await headingButton.waitFor({state: 'visible', timeout: 3000});
    await headingButton.click({force: true});
    await page.waitForTimeout(500);

    // Verify heading exists in editor before publishing
    const h1InEditor = editor1.locator('h1:has-text("Page 1 Heading")');
    await expect(h1InEditor).toBeVisible({timeout: 3000});

    // # Publish page 1
    await publishCurrentPage(page);

    // # Verify the heading was published correctly by checking page viewer
    const pageViewer = page.locator('[data-testid="page-viewer-content"]');
    const publishedHeading = pageViewer.locator('h1:has-text("Page 1 Heading")');
    await expect(publishedHeading).toBeVisible({timeout: 5000});

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
    await verifyOutlineHeadingVisible(page, 'Page 1 Heading', 5000);

    // # Navigate to Page 2
    const page2Node = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-page-id="${page2.id}"]`).first();
    await page2Node.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // * Verify outline for Page 1 is still expanded in hierarchy
    await verifyOutlineHeadingVisible(page, 'Page 1 Heading', 5000);

    // # Navigate back to Page 1
    await page1Node.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // * Verify outline remains expanded
    await verifyOutlineHeadingVisible(page, 'Page 1 Heading', 5000);

    // # Hide outline for Page 1
    await hidePageOutline(page, page1.id);

    // * Verify outline is collapsed
    const page1OutlineHeading = page.locator('[role="treeitem"]').filter({hasText: /^Page 1 Heading$/}).first();
    const isCollapsed = await page1OutlineHeading.isVisible().catch(() => false);
    expect(isCollapsed).toBe(false);

    // # Navigate away and back
    await page2Node.click();
    await page.waitForLoadState('networkidle');
    await page1Node.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // * Verify outline remains collapsed after navigation
    const stillCollapsed = await page1OutlineHeading.isVisible().catch(() => false);
    expect(stillCollapsed).toBe(false);
});
