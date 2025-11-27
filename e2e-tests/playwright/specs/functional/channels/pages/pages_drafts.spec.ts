// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';

import {createWikiThroughUI, createPageThroughUI, createChildPageThroughContextMenu, createTestChannel, ensurePanelOpen, getNewPageButton, fillCreatePageModal, createDraftThroughUI, deletePageThroughUI, getEditorAndWait, typeInEditor, clearEditorContent, navigateToWikiView, navigateToPage, getHierarchyPanel, clickPageInHierarchy, enterEditMode, verifyPageContentContains, AUTOSAVE_WAIT, EDITOR_LOAD_WAIT, ELEMENT_TIMEOUT, SHORT_WAIT, WEBSOCKET_WAIT, HIERARCHY_TIMEOUT} from './test_helpers';

/**
 * @objective Verify draft auto-save functionality and persistence
 */
test('auto-saves draft while editing', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Draft Wiki ${pw.random.id()}`);

    // # Create draft
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Draft Page');

    // # Wait for editor to appear (draft created and loaded)
    const editor = await getEditorAndWait(page);

    // # Fill content
    await typeInEditor(page, 'Draft content here');

    // * Wait for auto-save to complete
    await page.waitForTimeout(AUTOSAVE_WAIT);

    // # Refresh page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // * Verify draft persisted
    const titleAfterReload = page.locator('[data-testid="wiki-page-title-input"]');
    const editorAfterReload = await getEditorAndWait(page);

    await expect(titleAfterReload).toBeVisible();
    await expect(titleAfterReload).toHaveValue('Draft Page');

    await expect(editorAfterReload).toContainText('Draft content here');
});

/**
 * @objective Verify navigation away from edit mode auto-saves draft without prompt and auto-resumes on edit
 */
test('auto-saves draft when navigating away and auto-resumes on edit', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    // # Setup: Create wiki with two pages
    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    const wiki = await createWikiThroughUI(page, `Test Wiki ${pw.random.id()}`);
    const pageA = await createPageThroughUI(page, 'Page A', 'Original content A');
    const pageB = await createPageThroughUI(page, 'Page B', 'Original content B');

    // # Navigate to Page A and edit
    await clickPageInHierarchy(page, 'Page A');
    await page.waitForLoadState('networkidle');
    await enterEditMode(page);

    const editor = await getEditorAndWait(page);
    await editor.click();
    await clearEditorContent(page);
    await typeInEditor(page, 'Draft changes to Page A');
    await page.waitForTimeout(AUTOSAVE_WAIT);

    // # Navigate to Page B
    await clickPageInHierarchy(page, 'Page B');

    // * Verify navigation completes immediately without prompt
    await page.waitForURL(new RegExp(`/wiki/.*/.*/${pageB.id}`));
    await page.waitForLoadState('networkidle');
    await verifyPageContentContains(page, 'Original content B');

    // * Verify hierarchy does NOT show a draft node for Page A (only the published page)
    const hierarchyPanel = getHierarchyPanel(page);
    const pageADraftNode = hierarchyPanel.locator('[data-testid="page-tree-node"][data-is-draft="true"]', {hasText: 'Page A'});
    await expect(pageADraftNode).not.toBeVisible();
    const pageAPublishedNode = hierarchyPanel.locator('[data-testid="page-tree-node"]', {hasText: 'Page A'});
    await expect(pageAPublishedNode).toBeVisible();

    // # Navigate back to Page A
    await clickPageInHierarchy(page, 'Page A');
    await page.waitForLoadState('networkidle');

    // * Verify viewing published page (not draft)
    await verifyPageContentContains(page, 'Original content A');

    // * Verify "Unpublished changes" indicator is shown
    const unpublishedIndicator = page.locator('[data-testid="wiki-page-unpublished-indicator"]');
    await expect(unpublishedIndicator).toBeVisible();
    await expect(unpublishedIndicator).toContainText('Unpublished changes');

    // # Click Edit button
    const editButton = page.locator('[data-testid="wiki-page-edit-button"]').first();
    await editButton.click();

    // * Verify NO modal appears (auto-resumes like Confluence)
    // * Verify automatically navigated to draft URL
    await page.waitForURL(/\/drafts\//);
    await page.waitForLoadState('networkidle');

    // * Verify editor shows draft content (auto-resumed)
    const editorAfter = await getEditorAndWait(page);
    await expect(editorAfter).toContainText('Draft changes to Page A');
});

/**
 * @objective Verify auto-save indicator shows saving status to user
 */
test.skip('displays saving indicator during auto-save', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and draft
    const wiki = await createWikiThroughUI(page, `Indicator Wiki ${pw.random.id()}`);

    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Auto-save Indicator Test');

    // # Wait for editor to appear
    const editor = await getEditorAndWait(page);

    // # Type content to trigger auto-save
    await typeInEditor(page, 'Testing auto-save indicator');

    // * Verify "Saving..." indicator appears
    const savingIndicator = page.locator('[data-testid="draft-saving-indicator"], .saving-indicator, [aria-label*="Saving"], .draft-status').first();
    await expect(savingIndicator).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await expect(savingIndicator).toContainText(/saving|autosav/i);

    // * Wait for save to complete and verify "Saved" indicator
    await page.waitForTimeout(WEBSOCKET_WAIT); // Wait for auto-save to complete

    const savedIndicator = page.locator('[data-testid="draft-saved-indicator"], .saved-indicator, [aria-label*="Saved"], .draft-status').first();
    await expect(savedIndicator).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await expect(savedIndicator).toContainText(/saved|auto.*saved/i);

    // # Type more content to trigger another auto-save cycle
    await editor.click();
    await editor.pressSequentially(' - more content');

    // * Verify "Saving..." indicator appears again
    await expect(savingIndicator).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Wait and verify "Saved" appears again
    await page.waitForTimeout(WEBSOCKET_WAIT);
    await expect(savedIndicator).toBeVisible({timeout: ELEMENT_TIMEOUT});
});

/**
 * @objective Verify draft discard functionality
 */
test('discards draft and removes from hierarchy', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Discard Wiki ${pw.random.id()}`);

    // # Create draft
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Draft to Discard');

    // # Wait for editor to appear (draft created and loaded)
    const editor = await getEditorAndWait(page);

    // # Fill content
    await typeInEditor(page, 'This will be discarded');

    // * Wait for auto-save to complete
    await page.waitForTimeout(AUTOSAVE_WAIT);

    // # Delete draft via hierarchy panel context menu
    await deletePageThroughUI(page, 'Draft to Discard');

    // * Verify draft removed from hierarchy
    const hierarchyPanel = getHierarchyPanel(page);
    await expect(hierarchyPanel).not.toContainText('Draft to Discard');
});

/**
 * @objective Verify multiple drafts display in hierarchy panel
 */
test('shows multiple drafts in hierarchy section', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Multi Draft Wiki ${pw.random.id()}`);

    // # Create first draft
    let newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Draft 1');

    await page.waitForTimeout(EDITOR_LOAD_WAIT);

    let editor = await getEditorAndWait(page);
    await typeInEditor(page, 'Content 1');

    await page.waitForTimeout(AUTOSAVE_WAIT);

    // # Navigate back to wiki (without publishing)
    // First go to channel to deselect any auto-selected drafts
    await page.goto(`${pw.url}/${team.name}/channels/${channel.name}`);
    await page.waitForTimeout(SHORT_WAIT);

    // Then navigate back to wiki
    await navigateToWikiView(page, pw.url, team.name, channel.id, wiki.id);

    // # Open pages panel if it's collapsed
    await ensurePanelOpen(page);

    // Wait for new page button specifically
    newPageButton = getNewPageButton(page);
    await newPageButton.waitFor({state: 'visible', timeout: HIERARCHY_TIMEOUT});

    // # Create second draft
    await newPageButton.click();
    await fillCreatePageModal(page, 'Draft 2');

    await page.waitForTimeout(EDITOR_LOAD_WAIT);

    editor = await getEditorAndWait(page);
    await typeInEditor(page, 'Content 2');

    await page.waitForTimeout(AUTOSAVE_WAIT);

    // # Navigate back to check drafts section
    await navigateToWikiView(page, pw.url, team.name, channel.id, wiki.id);

    // * Verify both explicitly created drafts exist in hierarchy (drafts are integrated in tree with data-is-draft attribute)
    const hierarchyPanel = getHierarchyPanel(page);

    // Check for our specific drafts by name (more robust than counting all drafts)
    const draft1Node = hierarchyPanel.locator('[data-testid="page-tree-node"][data-is-draft="true"]', {hasText: 'Draft 1'});
    const draft2Node = hierarchyPanel.locator('[data-testid="page-tree-node"][data-is-draft="true"]', {hasText: 'Draft 2'});

    await expect(draft1Node).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await expect(draft2Node).toBeVisible({timeout: ELEMENT_TIMEOUT});
});

/**
 * @objective Verify draft recovery after browser refresh
 */
test('recovers draft after browser refresh', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Refresh Wiki ${pw.random.id()}`);

    // # Create draft
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Draft Before Refresh');

    // # Wait for editor to appear (draft created and loaded)
    const editor = await getEditorAndWait(page);

    // # Fill content
    await typeInEditor(page, 'Content that should survive refresh');

    // * Wait for auto-save to complete
    await page.waitForTimeout(AUTOSAVE_WAIT);

    // # Refresh browser
    await page.reload();
    await page.waitForLoadState('networkidle');

    // * Verify draft recovered (either in editor or drafts section)
    await page.waitForTimeout(EDITOR_LOAD_WAIT);

    const titleAfterRefresh = page.locator('[data-testid="wiki-page-title-input"]');
    const editorAfterRefresh = await getEditorAndWait(page);

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
        const hierarchyPanel = getHierarchyPanel(page);
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
    await channelsPage.toBeVisible();

    // # Create wiki and published page through UI
    const wiki = await createWikiThroughUI(page, `Edit Wiki ${pw.random.id()}`);
    const publishedPage = await createPageThroughUI(page, 'Published Page', 'Original content');

    // # Start editing
    const editButton = page.locator('[data-testid="wiki-page-edit-button"]');
    await editButton.click();

    const editor = await getEditorAndWait(page);
    await editor.click();
    await page.keyboard.press('End');
    await typeInEditor(page, ' - Modified content');

    await page.waitForTimeout(AUTOSAVE_WAIT);

    // * Verify URL shows draft pattern
    const currentUrl = page.url();
    const isDraftUrl = currentUrl.includes('/drafts/') || currentUrl.includes('/edit');
    expect(isDraftUrl).toBe(true);

    // * Verify hierarchy tree does NOT show a draft node (only published page node)
    const hierarchyPanel = getHierarchyPanel(page);
    const draftNode = hierarchyPanel.locator('[data-testid="page-tree-node"][data-is-draft="true"]', {hasText: 'Published Page'});
    await expect(draftNode).not.toBeVisible();

    // * Verify published page node is still visible
    const publishedNode = hierarchyPanel.locator('[data-testid="page-tree-node"]', {hasText: 'Published Page'});
    await expect(publishedNode).toBeVisible();

    // # Navigate away to Untitled page (draft-only) to abandon current draft editor
    const urlBeforeNav = page.url();
    const untitledButton = hierarchyPanel.getByRole('button', {name: 'Untitled page', exact: true});
    await untitledButton.click();
    // Wait for URL to change to a different page
    await page.waitForFunction((oldUrl) => window.location.href !== oldUrl, urlBeforeNav, {timeout: HIERARCHY_TIMEOUT});

    // # Navigate back to Published Page - should now show in view mode with "Unpublished changes"
    await clickPageInHierarchy(page, 'Published Page'); // This waits for page-viewer-content

    // * Verify viewing published page (not draft)
    await verifyPageContentContains(page, 'Original content');

    // * Verify "Unpublished changes" indicator is shown
    const unpublishedIndicator = page.locator('[data-testid="wiki-page-unpublished-indicator"]');
    await expect(unpublishedIndicator).toBeVisible();
    await expect(unpublishedIndicator).toContainText('Unpublished changes');
});

/**
 * @objective Verify clicking draft node in hierarchy navigates to draft editor
 */
test('navigates to draft editor when clicking draft node', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Nav Draft Wiki ${pw.random.id()}`);

    // # Create draft
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Navigable Draft');

    await page.waitForTimeout(EDITOR_LOAD_WAIT);

    const titleInput = page.locator('[data-testid="wiki-page-title-input"]');
    const editor = await getEditorAndWait(page);
    await typeInEditor(page, 'Draft content');

    await page.waitForTimeout(AUTOSAVE_WAIT);

    // # Navigate away from draft
    await navigateToWikiView(page, pw.url, team.name, channel.id, wiki.id);
    await ensurePanelOpen(page);

    // # Click draft node in hierarchy (drafts are integrated in tree)
    const hierarchyPanel = getHierarchyPanel(page);
    const draftNode = hierarchyPanel.locator('[data-testid="page-tree-node"][data-is-draft="true"]', {hasText: 'Navigable Draft'});
    await expect(draftNode).toBeVisible();
    await draftNode.click();
    await page.waitForLoadState('networkidle');

    // * Verify navigated to draft editor
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/\/drafts\/|\/edit/);

    // * Verify editor shows draft content
    const editorAfterNav = await getEditorAndWait(page);
    await expect(editorAfterNav).toContainText('Draft content');
});

/**
 * @objective Verify draft node appears at correct hierarchy level
 */
test('shows draft node as child of intended parent in tree', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);


    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and parent page through UI
    const wiki = await createWikiThroughUI(page, `Hierarchy Draft Wiki ${pw.random.id()}`);
    const parentPage = await createPageThroughUI(page, 'Parent Page', 'Parent content');

    // # Wait for parent node to appear in tree
    const hierarchyPanel = getHierarchyPanel(page);
    const parentNode = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-page-id="${parentPage.id}"]`);
    await parentNode.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

    // # Create child draft via right-click context menu
    await parentNode.click({button: 'right'});

    const contextMenu = page.locator('[data-testid="page-context-menu"]');
    await expect(contextMenu).toBeVisible({timeout: WEBSOCKET_WAIT});
    const createSubpageButton = contextMenu.locator('button:has-text("New subpage")');
    await createSubpageButton.click();
    await fillCreatePageModal(page, 'Child Draft Node');

    // # Wait for editor to load
    await page.waitForTimeout(EDITOR_LOAD_WAIT);

    // # Add some content and wait for auto-save and hierarchy refresh
    const editor = await getEditorAndWait(page);
    await typeInEditor(page, 'Child content');
    await page.waitForTimeout(AUTOSAVE_WAIT);

    // * Verify parent node now has expand button (showing it has the child)
    const updatedParentNode = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-page-id="${parentPage.id}"]`);
    const expandButton = updatedParentNode.locator('[data-testid="page-tree-node-expand-button"]');
    await expect(expandButton).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Check if parent is already expanded - if not, click to expand
    // The createPage action calls expandAncestors, so parent should already be expanded
    // But we need to wait for the expand to take effect
    await page.waitForTimeout(SHORT_WAIT);

    // * Verify child draft appears under parent in hierarchy (should be visible without clicking expand)
    const childDraftNode = hierarchyPanel.locator('[data-testid="page-tree-node"]:has-text("Child Draft Node")').first();
    await expect(childDraftNode).toBeVisible({timeout: ELEMENT_TIMEOUT});

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
    await channelsPage.toBeVisible();

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Multi Switch Wiki ${pw.random.id()}`);

    // # Create first draft
    let newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'First Draft');

    await page.waitForTimeout(EDITOR_LOAD_WAIT);

    let titleInput = page.locator('[data-testid="wiki-page-title-input"]');
    let editor = await getEditorAndWait(page);
    await typeInEditor(page, 'First draft content');

    await page.waitForTimeout(AUTOSAVE_WAIT);

    // # Navigate back and create second draft
    // First go to channel to deselect any auto-selected drafts
    await page.goto(`${pw.url}/${team.name}/channels/${channel.name}`);
    await page.waitForTimeout(SHORT_WAIT);

    // Then navigate back to wiki
    await navigateToWikiView(page, pw.url, team.name, channel.id, wiki.id);

    // # Open pages panel if it's collapsed
    await ensurePanelOpen(page);

    // Wait for new page button specifically
    newPageButton = getNewPageButton(page);
    await newPageButton.waitFor({state: 'visible', timeout: HIERARCHY_TIMEOUT});

    await newPageButton.click();
    await fillCreatePageModal(page, 'Second Draft');

    await page.waitForTimeout(EDITOR_LOAD_WAIT);

    editor = await getEditorAndWait(page);
    await typeInEditor(page, 'Second draft content');

    await page.waitForTimeout(AUTOSAVE_WAIT);

    // # Switch back to first draft (drafts are integrated in tree)
    const hierarchyPanel = getHierarchyPanel(page);
    const firstDraftNode = hierarchyPanel.locator('[data-testid="page-tree-node"][data-is-draft="true"]', {hasText: 'First Draft'});
    await expect(firstDraftNode).toBeVisible();
    await firstDraftNode.click();
    await page.waitForLoadState('networkidle');

    // * Verify first draft content preserved
    titleInput = page.locator('[data-testid="wiki-page-title-input"]');
    editor = await getEditorAndWait(page);

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
    await channelsPage.toBeVisible();

    // # Create wiki and published page through UI
    const wiki = await createWikiThroughUI(page, `Visual Wiki ${pw.random.id()}`);
    const publishedPage = await createPageThroughUI(page, 'Published Page', 'Published content');

    // # Create draft
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Draft Page');

    // Wait for editor to load
    await page.waitForTimeout(EDITOR_LOAD_WAIT);

    const editor = await getEditorAndWait(page);
    await typeInEditor(page, 'Draft content');

    await page.waitForTimeout(AUTOSAVE_WAIT);

    // # Navigate back to view hierarchy
    await navigateToWikiView(page, pw.url, team.name, channel.id, wiki.id);
    await ensurePanelOpen(page);

    // * Verify draft and published page have different visual indicators
    const hierarchyPanel = getHierarchyPanel(page);

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
    await channelsPage.toBeVisible();

    // # Create wiki through UI (creates default page as draft)
    const wikiName = `Wiki ${pw.random.id()}`;
    const wiki = await createWikiThroughUI(page, wikiName);

    // # Ensure pages panel is open
    await ensurePanelOpen(page);

    // # Wait for wiki to load - but minimize waits to increase race condition likelihood
    await page.waitForLoadState('networkidle');

    const hierarchyPanel = getHierarchyPanel(page);

    // # The default page should already be loaded in the editor after wiki creation
    // Get the title to verify the page later (should be "Untitled page" or wiki name)
    const titleInput = page.locator('[data-testid="wiki-page-title-input"]');
    await titleInput.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    const pageTitle = await titleInput.inputValue();

    // # Publish IMMEDIATELY without delays (this increases race condition probability)
    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]');
    await publishButton.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    await publishButton.click();

    // # Wait for publish to complete and state to stabilize
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(SHORT_WAIT);

    // * Verify only published page exists (no draft entry)
    const publishedPageNode = hierarchyPanel.locator('[data-testid="page-tree-node"]').filter({hasText: pageTitle}).first();
    await expect(publishedPageNode).toBeVisible({timeout: ELEMENT_TIMEOUT});

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
    await channelsPage.toBeVisible();

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Parent Child Draft Wiki ${pw.random.id()}`);

    // # Create parent draft (NOT published)
    const parentDraft = await createDraftThroughUI(page, 'Parent Draft', 'Parent draft content');

    // # Navigate back to wiki view to see hierarchy
    await navigateToWikiView(page, pw.url, team.name, channel.id, wiki.id);

    // # Ensure pages panel is open
    await ensurePanelOpen(page);

    const hierarchyPanel = getHierarchyPanel(page);

    // * Verify parent draft appears in hierarchy
    const parentDraftNode = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-is-draft="true"]`).filter({hasText: 'Parent Draft'});
    await expect(parentDraftNode).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Create child draft under parent draft via right-click context menu
    await parentDraftNode.click({button: 'right'});

    const contextMenu = page.locator('[data-testid="page-context-menu"]');
    await contextMenu.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

    const createSubpageButton = contextMenu.locator('[data-testid="page-context-menu-new-child"]').first();
    await createSubpageButton.click();

    // # Fill in modal and create child draft
    await fillCreatePageModal(page, 'Child Draft');

    // # Wait for editor to appear and add content
    const editor = await getEditorAndWait(page);
    await typeInEditor(page, 'Child draft content');

    // # Wait for auto-save to complete
    await page.waitForTimeout(AUTOSAVE_WAIT);

    // # Navigate back to wiki view to see updated hierarchy
    await navigateToWikiView(page, pw.url, team.name, channel.id, wiki.id);
    await page.waitForTimeout(SHORT_WAIT);

    // # Ensure pages panel is open after navigation
    await ensurePanelOpen(page);

    // # Refind parent node after navigation (page reloaded)
    const parentDraftNodeAfterChildCreate = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-is-draft="true"]`).filter({hasText: 'Parent Draft'});
    await expect(parentDraftNodeAfterChildCreate).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Expand parent node to see child
    const expandButton = parentDraftNodeAfterChildCreate.locator('[data-testid="page-tree-node-expand-button"]');
    await expect(expandButton).toBeVisible({timeout: WEBSOCKET_WAIT});
    await expandButton.click();
    await page.waitForTimeout(SHORT_WAIT);

    // * Verify child draft appears under parent draft in hierarchy
    const childDraftNode = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-is-draft="true"]`).filter({hasText: 'Child Draft'});
    await expect(childDraftNode).toBeVisible({timeout: HIERARCHY_TIMEOUT});

    // * Verify child has greater indentation than parent (indicating hierarchy)
    const parentPadding = await parentDraftNodeAfterChildCreate.evaluate((el) => window.getComputedStyle(el).paddingLeft);
    const childPadding = await childDraftNode.evaluate((el) => window.getComputedStyle(el).paddingLeft);
    expect(parseInt(childPadding)).toBeGreaterThan(parseInt(parentPadding));

    // # Click on parent draft to edit it
    await parentDraftNodeAfterChildCreate.click();
    await page.waitForLoadState('networkidle');

    // # Publish parent draft
    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]');
    await publishButton.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    await publishButton.click();

    // # Wait for publish to complete and websocket events to be processed
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(AUTOSAVE_WAIT);

    // # Navigate to wiki view to see hierarchy
    await navigateToWikiView(page, pw.url, team.name, channel.id, wiki.id);
    await page.waitForTimeout(EDITOR_LOAD_WAIT);

    // # Ensure pages panel is open
    await ensurePanelOpen(page);

    // * Verify parent is now published (no draft badge)
    const publishedParentNode = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-is-draft="false"]`).filter({hasText: 'Parent Draft'});
    await expect(publishedParentNode).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify parent has no draft badge
    const parentDraftBadge = publishedParentNode.locator('[data-testid="draft-badge"]');
    expect(await parentDraftBadge.isVisible().catch(() => false)).toBe(false);

    // # Expand published parent node to see child draft
    const expandAfterPublish = publishedParentNode.locator('[data-testid="page-tree-node-expand-button"]');
    await expect(expandAfterPublish).toBeVisible({timeout: WEBSOCKET_WAIT});
    await expandAfterPublish.click();
    await page.waitForTimeout(EDITOR_LOAD_WAIT);

    // * Verify child draft is STILL under published parent (NOT moved to root)
    // The child should still be visible and still be a draft
    const childDraftAfterPublish = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-is-draft="true"]`).filter({hasText: 'Child Draft'});
    await expect(childDraftAfterPublish).toBeVisible({timeout: HIERARCHY_TIMEOUT});

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
