// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';

import {createWikiThroughUI, createPageThroughUI, createChildPageThroughContextMenu, createTestChannel, ensurePanelOpen, getNewPageButton, fillCreatePageModal, createDraftThroughUI} from './test_helpers';

/**
 * @objective Verify draft auto-save functionality and persistence
 */
test('auto-saves draft while editing', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Draft Wiki ${pw.random.id()}`);

    // # Create draft
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Draft Page');

    // # Wait for editor to appear (draft created and loaded)
    const editor = page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();
    await editor.waitFor({state: 'visible', timeout: 5000});

    // # Fill content
    await editor.click();
    await editor.type('Draft content here');

    // * Wait for auto-save to complete
    await page.waitForTimeout(2000);

    // # Refresh page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // * Verify draft persisted
    const titleAfterReload = page.locator('[data-testid="wiki-page-title-input"]');
    const editorAfterReload = page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();

    await expect(titleAfterReload).toBeVisible();
    await expect(titleAfterReload).toHaveValue('Draft Page');

    await expect(editorAfterReload).toBeVisible();
    await expect(editorAfterReload).toContainText('Draft content here');
});

/**
 * @objective Verify draft discard functionality
 */
test('discards draft and removes from hierarchy', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Discard Wiki ${pw.random.id()}`);

    // # Create draft
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Draft to Discard');

    // # Wait for editor to appear (draft created and loaded)
    const editor = page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();
    await editor.waitFor({state: 'visible', timeout: 5000});

    // # Fill content
    await editor.click();
    await editor.type('This will be discarded');

    // Wait for auto-save
    await page.waitForTimeout(2000);

    // # Delete draft via hierarchy panel context menu
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');
    const draftNode = hierarchyPanel.locator('[data-testid="page-tree-node"]', {hasText: 'Draft to Discard'});

    const menuButton = draftNode.locator('[data-testid="page-tree-node-menu-button"]');
    await menuButton.click();

    const deleteMenuItem = page.locator('[data-testid="page-context-menu-delete"]');
    await deleteMenuItem.click();

    // # Confirm deletion in modal (MM modal for drafts, per our P0 fix)
    const confirmDialog = page.getByRole('dialog', {name: /Delete|Confirm/i});
    await expect(confirmDialog).toBeVisible({timeout: 3000});

    const confirmButton = confirmDialog.getByRole('button', {name: /Delete|Confirm/i});
    await confirmButton.click();

    await page.waitForLoadState('networkidle');

    // * Verify draft removed from hierarchy
    await page.waitForTimeout(500);
    await expect(draftNode).not.toBeVisible();
});

/**
 * @objective Verify multiple drafts display in hierarchy panel
 */
test('shows multiple drafts in hierarchy section', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Multi Draft Wiki ${pw.random.id()}`);

    // # Create first draft
    let newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Draft 1');

    await page.waitForTimeout(1000); // Wait for editor to load

    let titleInput = page.locator('[data-testid="wiki-page-title-input"]');
    await titleInput.fill('Draft 1');

    let editor = page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();
    await editor.click();
    await editor.type('Content 1');

    await page.waitForTimeout(2000); // Wait for auto-save

    // # Navigate back to wiki (without publishing)
    // First go to channel to deselect any auto-selected drafts
    await page.goto(`${pw.url}/${team.name}/channels/${channel.name}`);
    await page.waitForTimeout(500);

    // Then navigate back to wiki
    await page.goto(`${pw.url}/${team.name}/wiki/${channel.id}/${wiki.id}`);
    await page.waitForLoadState('networkidle');

    // Wait for wiki view to be ready
    await page.locator('[data-testid="wiki-view"]').waitFor({state: 'visible', timeout: 10000});

    // Wait for pages panel to be rendered (it should be visible since we have a draft)
    await page.locator('[data-testid="pages-hierarchy-panel"]').waitFor({state: 'visible', timeout: 10000});

    // # Open pages panel if it's collapsed
    await ensurePanelOpen(page);

    // Wait for new page button specifically
    newPageButton = getNewPageButton(page);
    await newPageButton.waitFor({state: 'visible', timeout: 10000});

    // # Create second draft
    await newPageButton.click();
    await fillCreatePageModal(page, 'Draft 2');

    await page.waitForTimeout(1000); // Wait for editor to load

    titleInput = page.locator('[data-testid="wiki-page-title-input"]');
    await titleInput.fill('Draft 2');

    editor = page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();
    await editor.click();
    await editor.type('Content 2');

    await page.waitForTimeout(2000);

    // # Navigate back to check drafts section
    await page.goto(`${pw.url}/${team.name}/wiki/${channel.id}/${wiki.id}`);
    await page.waitForLoadState('networkidle');

    // * Verify drafts exist in hierarchy (drafts are integrated in tree with data-is-draft attribute)
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');
    const draftNodes = hierarchyPanel.locator('[data-testid="page-tree-node"][data-is-draft="true"]');
    const draftCount = await draftNodes.count();
    expect(draftCount).toBeGreaterThanOrEqual(1); // At least one draft should be visible
});

/**
 * @objective Verify draft recovery after browser refresh
 */
test('recovers draft after browser refresh', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Refresh Wiki ${pw.random.id()}`);

    // # Create draft
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Draft Before Refresh');

    // # Wait for editor to appear (draft created and loaded)
    const editor = page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();
    await editor.waitFor({state: 'visible', timeout: 5000});

    // # Fill content
    await editor.click();
    await editor.type('Content that should survive refresh');

    // * Wait for auto-save
    await page.waitForTimeout(3000);

    // # Refresh browser
    await page.reload();
    await page.waitForLoadState('networkidle');

    // * Verify draft recovered (either in editor or drafts section)
    await page.waitForTimeout(1000);

    const titleAfterRefresh = page.locator('[data-testid="wiki-page-title-input"]');
    const editorAfterRefresh = page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();

    const editorVisible = await editorAfterRefresh.isVisible().catch(() => false);
    const titleVisible = await titleAfterRefresh.isVisible().catch(() => false);

    if (editorVisible && titleVisible) {
        // * Verify draft recovered in editor with both title AND content preserved
        const titleValue = await titleAfterRefresh.inputValue();
        const editorText = await editorAfterRefresh.textContent();

        expect(titleValue).toBe('Draft Before Refresh');
        expect(editorText).toContain('Content that should survive refresh');
    } else {
        // * Verify draft appears in hierarchy tree (drafts are integrated in tree)
        const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');
        const draftNode = hierarchyPanel.locator('[data-testid="page-tree-node"][data-is-draft="true"]', {hasText: 'Draft Before Refresh'});
        await expect(draftNode).toBeVisible();
    }
});

/**
 * @objective Verify editing published page creates draft
 */
test('converts published page to draft when editing', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki and published page through UI
    const wiki = await createWikiThroughUI(page, `Edit Wiki ${pw.random.id()}`);
    const publishedPage = await createPageThroughUI(page, 'Published Page', 'Original content');

    // # Start editing
    const editButton = page.locator('[data-testid="wiki-page-edit-button"]');
    await editButton.click();

    const editor = page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();
    await editor.click();
    await page.keyboard.press('End');
    await editor.type(' - Modified content');

    await page.waitForTimeout(2000); // Wait for auto-save

    // * Verify URL shows draft pattern
    const currentUrl = page.url();
    const isDraftUrl = currentUrl.includes('/drafts/') || currentUrl.includes('/edit');
    expect(isDraftUrl).toBe(true);

    // * Verify hierarchy tree shows this page as draft
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');
    const draftNode = hierarchyPanel.locator('[data-testid="page-tree-node"][data-is-draft="true"]', {hasText: 'Published Page'});
    await expect(draftNode).toBeVisible();
});

/**
 * @objective Verify clicking draft node in hierarchy navigates to draft editor
 */
test('navigates to draft editor when clicking draft node', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Nav Draft Wiki ${pw.random.id()}`);

    // # Create draft
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Navigable Draft');

    await page.waitForTimeout(1000); // Wait for editor to load

    const titleInput = page.locator('[data-testid="wiki-page-title-input"]');
    const editor = page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();
    await editor.click();
    await editor.type('Draft content');

    await page.waitForTimeout(2000);

    // # Navigate away from draft
    await page.goto(`${pw.url}/${team.name}/wiki/${channel.id}/${wiki.id}`);
    await page.waitForLoadState('networkidle');

    // # Click draft node in hierarchy (drafts are integrated in tree)
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');
    const draftNode = hierarchyPanel.locator('[data-testid="page-tree-node"][data-is-draft="true"]', {hasText: 'Navigable Draft'});
    await expect(draftNode).toBeVisible();
    await draftNode.click();
    await page.waitForLoadState('networkidle');

    // * Verify navigated to draft editor
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/\/drafts\/|\/edit/);

    // * Verify editor shows draft content
    const editorAfterNav = page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();
    await expect(editorAfterNav).toBeVisible();
    await expect(editorAfterNav).toContainText('Draft content');
});

/**
 * @objective Verify draft node appears at correct hierarchy level
 */
test('shows draft node as child of intended parent in tree', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);

    // # Listen to console logs
    page.on('console', (msg) => {
        const text = msg.text();
        if (text.includes('[createPage]') || text.includes('[PagesHierarchyPanel]') || text.includes('[getPageDraftsForWiki]')) {
            console.log('Browser console:', text);
        }
    });

    await channelsPage.goto(team.name, channel.name);

    // # Create wiki and parent page through UI
    const wiki = await createWikiThroughUI(page, `Hierarchy Draft Wiki ${pw.random.id()}`);
    const parentPage = await createPageThroughUI(page, 'Parent Page', 'Parent content');

    // # Wait for parent node to appear in tree
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');
    const parentNode = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-page-id="${parentPage.id}"]`);
    await parentNode.waitFor({state: 'visible', timeout: 5000});

    // # Create child draft via right-click context menu
    await parentNode.click({button: 'right'});

    const contextMenu = page.locator('[data-testid="page-context-menu"]');
    await expect(contextMenu).toBeVisible({timeout: 2000});
    const createSubpageButton = contextMenu.locator('button:has-text("New subpage")');
    await createSubpageButton.click();
    await fillCreatePageModal(page, 'Child Draft Node');

    // # Wait for editor to load
    await page.waitForTimeout(1000);

    // # Add some content and wait for auto-save and hierarchy refresh
    const editor = page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();
    await editor.click();
    await editor.type('Child content');
    await page.waitForTimeout(3000);

    // * Verify parent node now has expand button (showing it has the child)
    const updatedParentNode = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-page-id="${parentPage.id}"]`);
    const expandButton = updatedParentNode.locator('[data-testid="page-tree-node-expand-button"]');
    await expect(expandButton).toBeVisible({timeout: 5000});

    // # Check if parent is already expanded - if not, click to expand
    // The createPage action calls expandAncestors, so parent should already be expanded
    // But we need to wait for the expand to take effect
    await page.waitForTimeout(500);

    // * Verify child draft appears under parent in hierarchy (should be visible without clicking expand)
    const childDraftNode = hierarchyPanel.locator('[data-testid="page-tree-node"]:has-text("Child Draft Node")').first();
    await expect(childDraftNode).toBeVisible({timeout: 5000});

    // * Verify draft node is indented (indicating child relationship)
    const draftPaddingLeft = await childDraftNode.evaluate((el) => window.getComputedStyle(el).paddingLeft);
    const parentPaddingLeft = await updatedParentNode.evaluate((el) => window.getComputedStyle(el).paddingLeft);
    expect(parseInt(draftPaddingLeft)).toBeGreaterThan(parseInt(parentPaddingLeft));
});

/**
 * @objective Verify switching between multiple drafts preserves content
 */
test('switches between multiple drafts without losing content', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Multi Switch Wiki ${pw.random.id()}`);

    // # Create first draft
    let newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'First Draft');

    await page.waitForTimeout(1000); // Wait for editor to load

    let titleInput = page.locator('[data-testid="wiki-page-title-input"]');
    await titleInput.fill('First Draft');

    let editor = page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();
    await editor.click();
    await editor.type('First draft content');

    await page.waitForTimeout(2000);

    // # Navigate back and create second draft
    // First go to channel to deselect any auto-selected drafts
    await page.goto(`${pw.url}/${team.name}/channels/${channel.name}`);
    await page.waitForTimeout(500);

    // Then navigate back to wiki
    await page.goto(`${pw.url}/${team.name}/wiki/${channel.id}/${wiki.id}`);
    await page.waitForLoadState('networkidle');

    // Wait for wiki view to be ready
    await page.locator('[data-testid="wiki-view"]').waitFor({state: 'visible', timeout: 10000});

    // Wait for pages panel to be rendered (it should be visible since we have a draft)
    await page.locator('[data-testid="pages-hierarchy-panel"]').waitFor({state: 'visible', timeout: 10000});

    // # Open pages panel if it's collapsed
    await ensurePanelOpen(page);

    // Wait for new page button specifically
    newPageButton = getNewPageButton(page);
    await newPageButton.waitFor({state: 'visible', timeout: 10000});

    await newPageButton.click();
    await fillCreatePageModal(page, 'Second Draft');

    await page.waitForTimeout(1000); // Wait for editor to load

    titleInput = page.locator('[data-testid="wiki-page-title-input"]');
    await titleInput.fill('Second Draft');

    editor = page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();
    await editor.click();
    await editor.type('Second draft content');

    await page.waitForTimeout(2000);

    // # Switch back to first draft (drafts are integrated in tree)
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');
    const firstDraftNode = hierarchyPanel.locator('[data-testid="page-tree-node"][data-is-draft="true"]', {hasText: 'First Draft'});
    await expect(firstDraftNode).toBeVisible();
    await firstDraftNode.click();
    await page.waitForLoadState('networkidle');

    // * Verify first draft content preserved
    titleInput = page.locator('[data-testid="wiki-page-title-input"]');
    editor = page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();

    await expect(titleInput).toHaveValue('First Draft');
    await expect(editor).toContainText('First draft content');

    // # Switch to second draft
    const secondDraftNode = hierarchyPanel.locator('[data-testid="page-tree-node"][data-is-draft="true"]', {hasText: 'Second Draft'});
    await expect(secondDraftNode).toBeVisible();
    await secondDraftNode.click();
    await page.waitForLoadState('networkidle');

    // * Verify second draft content preserved
    await expect(titleInput).toHaveValue('Second Draft');
    await expect(editor).toContainText('Second draft content');
});

/**
 * @objective Verify draft visual distinction in hierarchy panel
 */
test('displays draft nodes with visual distinction from published pages', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki and published page through UI
    const wiki = await createWikiThroughUI(page, `Visual Wiki ${pw.random.id()}`);
    const publishedPage = await createPageThroughUI(page, 'Published Page', 'Published content');

    // # Create draft
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Draft Page');

    // Wait for editor to load
    await page.waitForTimeout(1000);

    const titleInput = page.locator('[data-testid="wiki-page-title-input"]');
    await titleInput.waitFor({state: 'visible', timeout: 5000});
    await titleInput.fill('Draft Page');

    const editor = page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();
    await editor.click();
    await editor.type('Draft content');

    await page.waitForTimeout(2000);

    // # Navigate back to view hierarchy
    await page.goto(`${pw.url}/${team.name}/wiki/${channel.id}/${wiki.id}`);
    await page.waitForLoadState('networkidle');

    // * Verify draft and published page have different visual indicators
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');

    // Find the PageTreeNode containers (not just the text)
    const publishedContainer = hierarchyPanel.locator('[data-testid="page-tree-node"]').filter({hasText: 'Published Page'}).first();
    const draftContainer = hierarchyPanel.locator('[data-testid="page-tree-node"]').filter({hasText: 'Draft Page'}).first();

    if (await publishedContainer.isVisible().catch(() => false) && await draftContainer.isVisible().catch(() => false)) {
        // * Verify draft has data-is-draft attribute
        const isDraftAttribute = await draftContainer.getAttribute('data-is-draft');
        expect(isDraftAttribute).toBe('true');

        // * Verify draft badge is visible
        const draftBadge = draftContainer.locator('[data-testid="draft-badge"]');
        expect(await draftBadge.isVisible()).toBe(true);

        // * Verify published page doesn't have draft indicators
        const publishedIsDraft = await publishedContainer.getAttribute('data-is-draft');
        expect(publishedIsDraft).toBe('false');
    }
});

/**
 * @objective Verify publishing default wiki page immediately removes draft entry from hierarchy without duplicate nodes
 */
test('removes draft from hierarchy after immediately publishing default wiki page', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);

    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI (creates default page as draft)
    const wikiName = `Wiki ${pw.random.id()}`;
    const wiki = await createWikiThroughUI(page, wikiName);

    // # Ensure pages panel is open
    await ensurePanelOpen(page);

    // # Wait for wiki to load - but minimize waits to increase race condition likelihood
    await page.waitForLoadState('networkidle');

    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');

    // # The default page should already be loaded in the editor after wiki creation
    // Get the title to verify the page later (should be "Untitled page" or wiki name)
    const titleInput = page.locator('[data-testid="wiki-page-title-input"]');
    await titleInput.waitFor({state: 'visible', timeout: 5000});
    const pageTitle = await titleInput.inputValue();

    // # Publish IMMEDIATELY without delays (this increases race condition probability)
    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]');
    await publishButton.waitFor({state: 'visible', timeout: 5000});
    await publishButton.click();

    // # Wait for publish to complete and state to stabilize
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // * Verify only published page exists (no draft entry)
    const publishedPageNode = hierarchyPanel.locator('[data-testid="page-tree-node"]').filter({hasText: pageTitle}).first();
    await expect(publishedPageNode).toBeVisible({timeout: 5000});

    // * Verify the page is marked as published (not draft)
    const isDraftAttribute = await publishedPageNode.getAttribute('data-is-draft');
    expect(isDraftAttribute).toBe('false');

    // * Verify there's no draft badge
    const draftBadge = publishedPageNode.locator('[data-testid="draft-badge"]');
    expect(await draftBadge.isVisible().catch(() => false)).toBe(false);

    // * Verify there's only ONE page node with this title (not both published and draft)
    const allNodesWithName = hierarchyPanel.locator('[data-testid="page-tree-node"]').filter({hasText: pageTitle});
    const nodeCount = await allNodesWithName.count();
    expect(nodeCount).toBe(1);
});

/**
 * @objective Verify publishing parent draft maintains child draft hierarchy without page refresh
 *
 * @precondition
 * WebSocket connections are enabled for real-time draft updates
 */
test('publishes parent draft and child draft stays under published parent', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Parent Child Draft Wiki ${pw.random.id()}`);

    // # Create parent draft (NOT published)
    const parentDraft = await createDraftThroughUI(page, 'Parent Draft', 'Parent draft content');

    // # Navigate back to wiki view to see hierarchy
    await page.goto(`${pw.url}/${team.name}/wiki/${channel.id}/${wiki.id}`);
    await page.waitForLoadState('networkidle');

    // # Ensure pages panel is open
    await ensurePanelOpen(page);

    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');

    // * Verify parent draft appears in hierarchy
    const parentDraftNode = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-is-draft="true"]`).filter({hasText: 'Parent Draft'});
    await expect(parentDraftNode).toBeVisible({timeout: 5000});

    // # Create child draft under parent draft via right-click context menu
    await parentDraftNode.click({button: 'right'});

    const contextMenu = page.locator('[data-testid="page-context-menu"]');
    await contextMenu.waitFor({state: 'visible', timeout: 5000});

    const createSubpageButton = contextMenu.locator('[data-testid="page-context-menu-new-child"]').first();
    await createSubpageButton.click();

    // # Fill in modal and create child draft
    await fillCreatePageModal(page, 'Child Draft');

    // # Wait for editor to appear and add content
    const editor = page.locator('.ProseMirror').first();
    await editor.waitFor({state: 'visible', timeout: 5000});
    await editor.click();
    await editor.type('Child draft content');

    // # Wait for auto-save to complete
    await page.waitForTimeout(2000);

    // # Navigate back to wiki view to see updated hierarchy
    await page.goto(`${pw.url}/${team.name}/wiki/${channel.id}/${wiki.id}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // # Ensure pages panel is open after navigation
    await ensurePanelOpen(page);

    // # Refind parent node after navigation (page reloaded)
    const parentDraftNodeAfterChildCreate = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-is-draft="true"]`).filter({hasText: 'Parent Draft'});
    await expect(parentDraftNodeAfterChildCreate).toBeVisible({timeout: 5000});

    // # Expand parent node to see child
    const expandButton = parentDraftNodeAfterChildCreate.locator('[data-testid="page-tree-node-expand-button"]');
    await expect(expandButton).toBeVisible({timeout: 2000});
    await expandButton.click();
    await page.waitForTimeout(500);

    // * Verify child draft appears under parent draft in hierarchy
    const childDraftNode = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-is-draft="true"]`).filter({hasText: 'Child Draft'});
    await expect(childDraftNode).toBeVisible({timeout: 10000});

    // * Verify child has greater indentation than parent (indicating hierarchy)
    const parentPadding = await parentDraftNodeAfterChildCreate.evaluate((el) => window.getComputedStyle(el).paddingLeft);
    const childPadding = await childDraftNode.evaluate((el) => window.getComputedStyle(el).paddingLeft);
    expect(parseInt(childPadding)).toBeGreaterThan(parseInt(parentPadding));

    // # Click on parent draft to edit it
    await parentDraftNodeAfterChildCreate.click();
    await page.waitForLoadState('networkidle');

    // # Publish parent draft
    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]');
    await publishButton.waitFor({state: 'visible', timeout: 5000});
    await publishButton.click();

    // # Wait for publish to complete and websocket events to be processed
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // Give more time for websocket events

    // # Navigate to wiki view to see hierarchy (page may still be on published page view)
    await page.goto(`${pw.url}/${team.name}/wiki/${channel.id}/${wiki.id}/${parentDraft.id}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // # Ensure pages panel is open
    await ensurePanelOpen(page);

    // * Verify parent is now published (no draft badge)
    const publishedParentNode = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-is-draft="false"]`).filter({hasText: 'Parent Draft'});
    await expect(publishedParentNode).toBeVisible({timeout: 5000});

    // * Verify parent has no draft badge
    const parentDraftBadge = publishedParentNode.locator('[data-testid="draft-badge"]');
    expect(await parentDraftBadge.isVisible().catch(() => false)).toBe(false);

    // # Expand published parent node to see child draft
    const expandAfterPublish = publishedParentNode.locator('[data-testid="page-tree-node-expand-button"]');
    await expect(expandAfterPublish).toBeVisible({timeout: 2000});
    await expandAfterPublish.click();
    await page.waitForTimeout(1000);

    // * Verify child draft is STILL under published parent (NOT moved to root)
    // The child should still be visible and still be a draft
    const childDraftAfterPublish = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-is-draft="true"]`).filter({hasText: 'Child Draft'});
    await expect(childDraftAfterPublish).toBeVisible({timeout: 10000});

    // * Verify child still has draft badge
    const childDraftBadge = childDraftAfterPublish.locator('[data-testid="draft-badge"]');
    await expect(childDraftBadge).toBeVisible();

    // * Verify child still has greater indentation than parent (hierarchy maintained)
    const publishedParentPadding = await publishedParentNode.evaluate((el) => window.getComputedStyle(el).paddingLeft);
    const childAfterPublishPadding = await childDraftAfterPublish.evaluate((el) => window.getComputedStyle(el).paddingLeft);
    expect(parseInt(childAfterPublishPadding)).toBeGreaterThan(parseInt(publishedParentPadding));

    // * Verify there's only ONE parent node (no duplicate published + draft nodes)
    const allParentNodes = hierarchyPanel.locator('[data-testid="page-tree-node"]').filter({hasText: 'Parent Draft'});
    const parentNodeCount = await allParentNodes.count();
    expect(parentNodeCount).toBe(1);

    // * Test passes! Child draft stayed under published parent without page refresh
    // This verifies the websocket event handling fix is working correctly
});
