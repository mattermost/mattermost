// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';

import {createWikiThroughUI, createPageThroughUI, createTestChannel, ensurePanelOpen, waitForPageInHierarchy, fillCreatePageModal} from './test_helpers';

/**
 * @objective Verify page duplication creates a copy with default "Duplicate of [title]" naming
 */
test('duplicates page to same wiki with default title', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);

    await channelsPage.goto(team.name, channel.name);

    // # Create wiki and original page through UI
    const wiki = await createWikiThroughUI(page, `Duplicate Wiki ${pw.random.id()}`);
    const originalPage = await createPageThroughUI(page, 'Original Page', 'Original content here');

    // # Wait for page to be fully committed to database
    await page.waitForTimeout(1000);

    // # Ensure panel is open
    await ensurePanelOpen(page);

    // # Open page menu using the menu button (more reliable than right-click)
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]').first();
    const pageNode = hierarchyPanel.locator(`[data-page-id="${originalPage.id}"]`).first();
    await pageNode.hover();

    const menuButton = pageNode.locator('[data-testid="page-tree-node-menu-button"]').first();
    await menuButton.click();

    // # Wait for context menu and click "Duplicate" option
    const contextMenu = page.locator('[data-testid="page-context-menu"]');
    await contextMenu.waitFor({state: 'visible', timeout: 5000});

    const duplicateOption = contextMenu.locator('[data-testid="page-context-menu-duplicate"]').first();
    await duplicateOption.click();

    // # Wait for duplicate modal to appear
    const duplicateModal = page.getByRole('dialog', {name: /Duplicate/i});
    await duplicateModal.waitFor({state: 'visible', timeout: 5000});

    // * Verify modal title is "Duplicate Page"
    const modalTitle = duplicateModal.locator('h1, [role="heading"]').first();
    await expect(modalTitle).toContainText('Duplicate');

    // # Confirm duplication without changing title (uses default)
    const confirmButton = duplicateModal.getByRole('button', {name: /Duplicate/i}).first();
    await confirmButton.click();

    // # Wait for duplication to complete
    await page.waitForLoadState('networkidle');

    // * Verify duplicated page appears in hierarchy with "Duplicate of" prefix
    const duplicateNode = page.locator('[data-page-id]').filter({hasText: 'Duplicate of Original Page'}).first();
    await expect(duplicateNode).toBeVisible({timeout: 15000});

    // # Click on duplicated page to view it
    await duplicateNode.click();
    await page.waitForLoadState('networkidle');

    // * Verify duplicated page content is the same as original
    const pageContent = page.locator('[data-testid="page-viewer-content"]');
    await expect(pageContent).toContainText('Original content here');
});

/**
 * @objective Verify page duplication supports custom title override
 */
test('duplicates page with custom title', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki and original page through UI
    await createWikiThroughUI(page, `Custom Title Wiki ${pw.random.id()}`);
    const originalPage = await createPageThroughUI(page, 'Source Page', 'Source content');

    // # Wait for page to be fully committed to database
    await page.waitForTimeout(1000);

    // # Ensure panel is open
    await ensurePanelOpen(page);

    // # Open page menu using the menu button (more reliable than right-click)
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]').first();
    const pageNode = hierarchyPanel.locator(`[data-page-id="${originalPage.id}"]`).first();
    await pageNode.hover();

    const menuButton = pageNode.locator('[data-testid="page-tree-node-menu-button"]').first();
    await menuButton.click();

    // # Wait for context menu and click "Duplicate" option
    const contextMenu = page.locator('[data-testid="page-context-menu"]');
    await contextMenu.waitFor({state: 'visible', timeout: 5000});

    const duplicateOption = contextMenu.locator('[data-testid="page-context-menu-duplicate"]').first();
    await duplicateOption.click();

    // # Wait for duplicate modal
    const duplicateModal = page.getByRole('dialog', {name: /Duplicate/i});
    await duplicateModal.waitFor({state: 'visible', timeout: 5000});

    // # Enter custom title in the title input field
    const titleInput = page.locator('#custom-title-input');
    await titleInput.waitFor({state: 'visible', timeout: 3000});
    await titleInput.fill('My Custom Duplicate Title');

    // # Confirm duplication
    const confirmButton = duplicateModal.getByRole('button', {name: /Duplicate/i}).first();
    await confirmButton.click();

    // # Wait for duplication to complete
    await page.waitForLoadState('networkidle');

    // * Verify duplicated page appears with custom title
    const duplicateNode = page.locator('[data-page-id]').filter({hasText: 'My Custom Duplicate Title'}).first();
    await expect(duplicateNode).toBeVisible({timeout: 15000});

    // # Click on duplicated page
    await duplicateNode.click();
    await page.waitForLoadState('networkidle');

    // * Verify content is copied
    const pageContent = page.locator('[data-testid="page-viewer-content"]');
    await expect(pageContent).toContainText('Source content');
});

/**
 * @objective Verify page duplication to different wiki within same channel
 */
test('duplicates page to different wiki in same channel', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create source wiki and page
    const sourceWiki = await createWikiThroughUI(page, `Source Wiki ${pw.random.id()}`);
    const originalPage = await createPageThroughUI(page, 'Page to Duplicate', 'Content to copy');

    // # Wait for page to be fully committed to database
    await page.waitForTimeout(3000);

    // # Navigate back to channel and create target wiki
    await channelsPage.goto(team.name, channel.name);
    const targetWiki = await createWikiThroughUI(page, `Target Wiki ${pw.random.id()}`);

    // # Navigate back to channel to access wiki tabs
    await channelsPage.goto(team.name, channel.name);

    // # Navigate back to source wiki by clicking its tab
    const sourceWikiTab = page.locator('.wiki-tab').filter({hasText: sourceWiki.title}).first();
    await sourceWikiTab.waitFor({state: 'visible', timeout: 15000});
    await sourceWikiTab.click();
    await page.waitForLoadState('networkidle');

    // # Ensure panel is open
    await ensurePanelOpen(page);

    // # Open page menu using the menu button (more reliable than right-click)
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]').first();
    const pageNode = hierarchyPanel.locator(`[data-page-id="${originalPage.id}"]`).first();
    await pageNode.waitFor({state: 'visible', timeout: 15000});

    // # Hover to reveal menu button
    await pageNode.hover();

    // # Click menu button
    const menuButton = pageNode.locator('[data-testid="page-tree-node-menu-button"]').first();
    await menuButton.click();

    // # Wait for context menu to appear
    const contextMenu = page.locator('[data-testid="page-context-menu"]');
    await contextMenu.waitFor({state: 'visible', timeout: 5000});

    // # Click "Duplicate" option
    const duplicateOption = contextMenu.locator('[data-testid="page-context-menu-duplicate"]').first();
    await duplicateOption.click();

    // # Wait for duplicate modal
    const duplicateModal = page.getByRole('dialog', {name: /Duplicate/i});
    await duplicateModal.waitFor({state: 'visible', timeout: 15000});

    // # Select target wiki from dropdown
    const wikiSelect = page.locator('#target-wiki-select');
    await wikiSelect.selectOption(targetWiki.id);

    // # Confirm duplication
    const confirmButton = duplicateModal.getByRole('button', {name: /Duplicate/i}).first();
    await confirmButton.click();

    // # Wait for duplication to complete
    await page.waitForLoadState('networkidle');

    // # Navigate back to channel to access wiki tabs
    await channelsPage.goto(team.name, channel.name);

    // # Navigate to Target Wiki by clicking its tab to verify the duplicated page
    const targetWikiTab = page.locator('.wiki-tab').filter({hasText: targetWiki.title}).first();
    await targetWikiTab.waitFor({state: 'visible', timeout: 15000});
    await targetWikiTab.click();
    await page.waitForLoadState('networkidle');

    // # Ensure panel is open
    await ensurePanelOpen(page);

    // * Verify page appears in target wiki hierarchy
    const hierarchyPanelTarget = page.locator('[data-testid="pages-hierarchy-panel"]').first();
    const duplicateNode = hierarchyPanelTarget.locator('[data-page-id]').filter({hasText: 'Duplicate of Page to Duplicate'}).first();
    await expect(duplicateNode).toBeVisible({timeout: 15000});

    // # Click on duplicated page
    await duplicateNode.click();
    await page.waitForLoadState('networkidle');

    // * Verify content is copied
    const pageContent = page.locator('[data-testid="page-viewer-content"]');
    await expect(pageContent).toContainText('Content to copy');
});

/**
 * @objective Verify page duplication supports parent page selection for hierarchy placement
 */
test('duplicates page as child under selected parent', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki, parent page, and page to duplicate
    await createWikiThroughUI(page, `Hierarchy Wiki ${pw.random.id()}`);
    const parentPage = await createPageThroughUI(page, 'Parent Page', 'Parent content');

    // # Ensure panel is open
    await ensurePanelOpen(page);

    // # Create the page to duplicate at root level
    const pageToDuplicate = await createPageThroughUI(page, 'Page to Place', 'Content to place');

    // # Wait for page to be fully committed to database
    await page.waitForTimeout(3000);

    // # Ensure panel is open again
    await ensurePanelOpen(page);

    // # Open page menu using the menu button (more reliable than right-click)
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]').first();
    const pageNode = hierarchyPanel.locator(`[data-page-id="${pageToDuplicate.id}"]`).first();
    await pageNode.waitFor({state: 'visible', timeout: 15000});

    // # Hover to reveal menu button
    await pageNode.hover();

    // # Click menu button
    const menuButton = pageNode.locator('[data-testid="page-tree-node-menu-button"]').first();
    await menuButton.click();

    // # Wait for context menu to appear
    const contextMenu = page.locator('[data-testid="page-context-menu"]');
    await contextMenu.waitFor({state: 'visible', timeout: 5000});

    // # Click "Duplicate" option
    const duplicateOption = contextMenu.locator('[data-testid="page-context-menu-duplicate"]').first();
    await duplicateOption.click();

    // # Wait for duplicate modal
    const duplicateModal = page.getByRole('dialog', {name: /Duplicate/i});
    await duplicateModal.waitFor({state: 'visible', timeout: 15000});

    // # Wait for pages to load in the modal (they load asynchronously)
    // The parent page button should appear after pages load
    const parentButton = duplicateModal.getByRole('button', {name: parentPage.title});
    await parentButton.waitFor({state: 'visible', timeout: 10000});

    // # Select parent page from the page list in the modal
    await parentButton.click();

    // # Confirm duplication
    const confirmButton = duplicateModal.getByRole('button', {name: /Duplicate/i}).first();
    await confirmButton.click();

    // # Wait for duplication to complete
    await page.waitForLoadState('networkidle');

    // # Wait for the duplicated page to appear in hierarchy
    await page.waitForTimeout(2000);

    // # Ensure hierarchy panel is open and updated
    await ensurePanelOpen(page);

    // # Wait for parent page toggle to appear (indicates it now has children)
    const parentNodeToggle = hierarchyPanel.locator(`[data-page-id="${parentPage.id}"]`).locator('[data-testid="page-tree-node-expand-button"]').first();
    await parentNodeToggle.waitFor({state: 'visible', timeout: 15000});

    // # Expand parent page to see children
    await parentNodeToggle.click();
    await page.waitForTimeout(2000);

    // * Verify duplicated page appears as child of parent
    // Just look for the duplicate page by text in the hierarchy - it should be visible after expanding
    const duplicateChild = hierarchyPanel.locator('[data-page-id]').filter({hasText: /Duplicate of Page/i}).first();
    await expect(duplicateChild).toBeVisible({timeout: 15000});

    // # Click on duplicated child page
    await duplicateChild.click();
    await page.waitForLoadState('networkidle');

    // * Verify content is copied
    const pageContent = page.locator('[data-testid="page-viewer-content"]');
    await expect(pageContent).toContainText('Content to place');
});

/**
 * @objective Verify duplication shows warning when original page has child pages
 */
test('displays children warning when duplicating page with children', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki and parent page with children
    await createWikiThroughUI(page, `Children Wiki ${pw.random.id()}`);
    const parentPage = await createPageThroughUI(page, 'Parent with Children', 'Parent content');

    // # Wait for page to be fully committed to database
    await page.waitForTimeout(3000);

    // # Ensure panel is open
    await ensurePanelOpen(page);

    // # Create child page using the menu button (more reliable than right-click)
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]').first();
    const parentNode = hierarchyPanel.locator(`[data-page-id="${parentPage.id}"]`).first();
    await parentNode.waitFor({state: 'visible', timeout: 15000});

    // # Hover to reveal menu button
    await parentNode.hover();

    // # Click menu button
    const menuButton = parentNode.locator('[data-testid="page-tree-node-menu-button"]').first();
    await menuButton.click();

    // # Wait for context menu to appear
    const contextMenu = page.locator('[data-testid="page-context-menu"]');
    await contextMenu.waitFor({state: 'visible', timeout: 5000});

    const newChildOption = contextMenu.locator('[data-testid="page-context-menu-new-child"]').first();
    await newChildOption.click();
    await fillCreatePageModal(page, 'Child Page');

    // # Wait for editor and publish child
    const editor = page.locator('.ProseMirror').first();
    await editor.waitFor({state: 'visible', timeout: 15000});
    await editor.click();
    await page.waitForTimeout(2000);
    await editor.type('Child content');
    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]');
    await publishButton.waitFor({state: 'visible', timeout: 15000});
    await publishButton.click();
    await page.waitForLoadState('networkidle');

    // # Ensure panel is open
    await ensurePanelOpen(page);

    // # Open parent page menu using the menu button (more reliable than right-click)
    const parentNodeForDuplicate = hierarchyPanel.locator(`[data-page-id="${parentPage.id}"]`).first();
    await parentNodeForDuplicate.waitFor({state: 'visible', timeout: 15000});

    // # Hover to reveal menu button
    await parentNodeForDuplicate.hover();

    // # Click menu button
    const menuButtonDuplicate = parentNodeForDuplicate.locator('[data-testid="page-tree-node-menu-button"]').first();
    await menuButtonDuplicate.click();

    // # Wait for context menu to appear
    const contextMenuDuplicate = page.locator('[data-testid="page-context-menu"]');
    await contextMenuDuplicate.waitFor({state: 'visible', timeout: 5000});

    const duplicateOption = contextMenuDuplicate.locator('[data-testid="page-context-menu-duplicate"]').first();
    await duplicateOption.click();

    // # Wait for duplicate modal
    const duplicateModal = page.getByRole('dialog', {name: /Duplicate/i});
    await duplicateModal.waitFor({state: 'visible', timeout: 15000});

    // * Verify warning message about children appears
    const warningText = duplicateModal.locator('text=/child pages will not be duplicated|only the selected page is copied/i');
    await expect(warningText).toBeVisible({timeout: 15000});

    // # Confirm duplication
    const confirmButton = duplicateModal.getByRole('button', {name: /Duplicate/i}).first();
    await confirmButton.click();

    // # Wait for duplication to complete
    await page.waitForLoadState('networkidle');

    // * Verify duplicated page appears without children
    const duplicateNode = page.locator('[data-page-id]').filter({hasText: 'Duplicate of Parent with Children'}).first();
    await expect(duplicateNode).toBeVisible({timeout: 15000});

    // * Verify no toggle button exists (no children)
    const duplicateToggle = duplicateNode.locator('[data-testid="node-toggle"]');
    await expect(duplicateToggle).not.toBeVisible();
});

/**
 * @objective Verify page content including rich text formatting is duplicated correctly
 */
test('duplicates page with rich text content preserving formatting', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki and page with rich text
    await createWikiThroughUI(page, `Rich Text Wiki ${pw.random.id()}`);

    // # Click "New Page" button
    const newPageButton = page.locator('[data-testid="new-page-button"]').first();
    await newPageButton.click();
    await fillCreatePageModal(page, 'Rich Content Page');

    // # Wait for editor and add rich text content
    const editor = page.locator('.ProseMirror').first();
    await editor.waitFor({state: 'visible', timeout: 5000});
    await editor.click();

    // # Add heading
    await page.keyboard.type('Main Heading');
    await page.keyboard.press('Enter');

    // # Determine platform-specific modifier key
    const isMac = process.platform === 'darwin';
    const modifierKey = isMac ? 'Meta' : 'Control';

    // # Add bold text
    await page.keyboard.press(`${modifierKey}+KeyB`);
    await page.keyboard.type('Bold text');
    await page.keyboard.press(`${modifierKey}+KeyB`);
    await page.keyboard.press('Enter');

    // # Add italic text
    await page.keyboard.press(`${modifierKey}+KeyI`);
    await page.keyboard.type('Italic text');
    await page.keyboard.press(`${modifierKey}+KeyI`);

    // # Publish the page
    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]');
    await publishButton.click();
    await page.waitForLoadState('networkidle');

    // # Wait for page viewer to appear (ensures publish succeeded and navigation completed)
    const pageViewer = page.locator('[data-testid="page-viewer-content"]');
    await pageViewer.waitFor({state: 'visible', timeout: 15000});

    // # Get page ID from URL
    const url = page.url();
    const pageIdMatch = url.match(/\/wiki\/[^/]+\/[^/]+\/([^/?]+)/);
    const pageId = pageIdMatch?.[1];

    if (!pageId) {
        throw new Error('Failed to get page ID from URL');
    }

    // # Wait for page to be fully committed to database
    await page.waitForTimeout(1000);

    // # Ensure panel is open
    await ensurePanelOpen(page);

    // # Wait for page to appear in hierarchy panel
    await waitForPageInHierarchy(page, 'Rich Content Page', 10000);

    // # Wait for the page node with data-page-id attribute to be available (scope to hierarchy panel)
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]').first();
    const pageNode = hierarchyPanel.locator(`[data-page-id="${pageId}"]`).first();
    await pageNode.waitFor({state: 'visible', timeout: 10000});

    // # Duplicate the page using menu button
    await pageNode.hover();
    const menuButton = pageNode.locator('[data-testid="page-tree-node-menu-button"]').first();
    await menuButton.click();

    // # Wait for context menu and click "Duplicate"
    const contextMenu = page.locator('[data-testid="page-context-menu"]');
    await contextMenu.waitFor({state: 'visible', timeout: 5000});

    const duplicateOption = contextMenu.locator('[data-testid="page-context-menu-duplicate"]').first();
    await duplicateOption.click();

    // # Confirm duplication
    const duplicateModal = page.getByRole('dialog', {name: /Duplicate/i});
    await duplicateModal.waitFor({state: 'visible', timeout: 5000});
    const confirmButton = duplicateModal.getByRole('button', {name: /Duplicate/i}).first();
    await confirmButton.click();

    // # Wait for duplication
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // # Click on duplicated page
    const duplicateNode = page.locator('[data-page-id]').filter({hasText: 'Duplicate of Rich Content Page'}).first();
    await duplicateNode.click();
    await page.waitForLoadState('networkidle');

    // * Verify all content is present
    const pageContent = page.locator('[data-testid="page-viewer-content"]');
    await expect(pageContent).toContainText('Main Heading');
    await expect(pageContent).toContainText('Bold text');
    await expect(pageContent).toContainText('Italic text');

    // * Verify formatting is preserved (check for bold/italic elements)
    const boldText = pageContent.locator('strong, b').filter({hasText: 'Bold text'});
    await expect(boldText).toBeVisible();

    const italicText = pageContent.locator('em, i').filter({hasText: 'Italic text'});
    await expect(italicText).toBeVisible();
});
