// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';

import {createWikiThroughUI, createPageThroughUI, createChildPageThroughContextMenu, createTestChannel, ensurePanelOpen, waitForPageInHierarchy, fillCreatePageModal, getWikiTab, waitForWikiViewLoad, openDuplicatePageModal, confirmDuplicatePage, waitForDuplicatedPageInHierarchy, getPageIdFromUrl, publishCurrentPage, getEditorAndWait, typeInEditor, getHierarchyPanel} from './test_helpers';

/**
 * @objective Verify page duplication creates a copy with default "Copy of [title]" naming at same level
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

    // # Open duplicate modal and confirm with default settings
    const duplicateModal = await openDuplicatePageModal(page, originalPage.id);

    // * Verify modal title is "Duplicate Page"
    const modalTitle = duplicateModal.locator('h1, [role="heading"]').first();
    await expect(modalTitle).toContainText('Duplicate');

    // # Confirm duplication without changing title (uses default "Copy of" prefix)
    await confirmDuplicatePage(page, duplicateModal);

    // * Verify duplicated page appears in hierarchy with "Copy of" prefix
    const duplicateNode = await waitForDuplicatedPageInHierarchy(page, 'Copy of Original Page');

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
    // # Open duplicate modal and set custom title
    const duplicateModal = await openDuplicatePageModal(page, originalPage.id);
    await confirmDuplicatePage(page, duplicateModal, 'My Custom Duplicate Title');

    // * Verify duplicated page appears with custom title
    const duplicateNode = await waitForDuplicatedPageInHierarchy(page, 'My Custom Duplicate Title');

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
    const sourceWikiTab = getWikiTab(page, sourceWiki.title);
    await sourceWikiTab.waitFor({state: 'visible', timeout: 15000});
    await sourceWikiTab.click();
    await page.waitForLoadState('networkidle');

    // # Wait for wiki view to load
    await waitForWikiViewLoad(page);

    // # Ensure panel is open
    await ensurePanelOpen(page);

    // # Open duplicate modal and select target wiki
    const duplicateModal = await openDuplicatePageModal(page, originalPage.id);
    await confirmDuplicatePage(page, duplicateModal, undefined, targetWiki.id);

    // # Navigate back to channel to access wiki tabs
    await channelsPage.goto(team.name, channel.name);

    // # Navigate to Target Wiki by clicking its tab to verify the duplicated page
    const targetWikiTab = getWikiTab(page, targetWiki.title);
    await targetWikiTab.waitFor({state: 'visible', timeout: 15000});
    await targetWikiTab.click();
    await page.waitForLoadState('networkidle');

    // # Ensure panel is open
    await ensurePanelOpen(page);

    // * Verify page appears in target wiki hierarchy
    const hierarchyPanelTarget = getHierarchyPanel(page).first();
    const duplicateNode = hierarchyPanelTarget.locator('[data-page-id]').filter({hasText: 'Copy of Page to Duplicate'}).first();
    await expect(duplicateNode).toBeVisible({timeout: 15000});

    // # Click on duplicated page
    await duplicateNode.click();
    await page.waitForLoadState('networkidle');

    // * Verify content is copied
    const pageContent = page.locator('[data-testid="page-viewer-content"]');
    await expect(pageContent).toContainText('Content to copy');
});

/**
 * @objective Verify page duplication places duplicate at same level as source (inherits parent)
 */
test('duplicates child page at same level as source', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki and parent page
    await createWikiThroughUI(page, `Hierarchy Wiki ${pw.random.id()}`);
    const parentPage = await createPageThroughUI(page, 'Parent Page', 'Parent content');

    // # Create a child page under the parent
    const childPage = await createChildPageThroughContextMenu(page, parentPage.id!, 'Child Page', 'Child content');

    // # Ensure hierarchy panel is open
    await ensurePanelOpen(page);

    const hierarchyPanel = getHierarchyPanel(page).first();

    // # Wait for child page to appear in hierarchy
    await waitForPageInHierarchy(page, 'Child Page', 15000);

    // # Duplicate the child page
    const duplicateModal = await openDuplicatePageModal(page, childPage.id);
    await confirmDuplicatePage(page, duplicateModal);

    // # Wait for duplication to complete
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // # Ensure hierarchy panel is open and updated
    await ensurePanelOpen(page);

    // * Verify duplicated page appears as sibling under same parent
    const duplicateChild = hierarchyPanel.locator('[data-page-id]').filter({hasText: 'Copy of Child Page'}).first();
    await expect(duplicateChild).toBeVisible({timeout: 15000});

    // # Click on duplicated child page
    await duplicateChild.click();
    await page.waitForLoadState('networkidle');

    // * Verify content is copied
    const pageContent = page.locator('[data-testid="page-viewer-content"]');
    await expect(pageContent).toContainText('Child content');
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

    // # Create child page
    await createChildPageThroughContextMenu(page, parentPage.id!, 'Child Page', 'Child content');

    // # Ensure panel is open
    await ensurePanelOpen(page);

    // # Open duplicate modal
    const duplicateModal = await openDuplicatePageModal(page, parentPage.id);

    // * Verify warning message about children appears
    const warningText = duplicateModal.locator('text=/child pages will not be duplicated|only the selected page is copied/i');
    await expect(warningText).toBeVisible({timeout: 15000});

    // # Confirm duplication
    await confirmDuplicatePage(page, duplicateModal);

    // * Verify duplicated page appears without children
    const duplicateNode = await waitForDuplicatedPageInHierarchy(page, 'Copy of Parent with Children');

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
    const editor = await getEditorAndWait(page);
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
    await publishCurrentPage(page);

    // # Get page ID from URL
    const url = page.url();
    const pageId = getPageIdFromUrl(url);

    if (!pageId) {
        throw new Error(`Failed to get page ID from URL: ${url}`);
    }

    // # Wait for page to be fully committed to database
    await page.waitForTimeout(1000);

    // # Ensure panel is open
    await ensurePanelOpen(page);

    // # Wait for page to appear in hierarchy panel
    await waitForPageInHierarchy(page, 'Rich Content Page', 10000);

    // # Wait for the page node with data-page-id attribute to be available (scope to hierarchy panel)
    const hierarchyPanel = getHierarchyPanel(page).first();
    const pageNode = hierarchyPanel.locator(`[data-page-id="${pageId}"]`).first();
    await pageNode.waitFor({state: 'visible', timeout: 10000});

    // # Duplicate the page
    const duplicateModal = await openDuplicatePageModal(page, pageId);
    await confirmDuplicatePage(page, duplicateModal);

    // # Wait for duplication
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // # Click on duplicated page
    const duplicateNode = page.locator('[data-page-id]').filter({hasText: 'Copy of Rich Content Page'}).first();
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
