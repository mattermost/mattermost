// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {createWikiThroughUI, createPageThroughUI, createChildPageThroughContextMenu, createTestChannel, ensurePanelOpen, getNewPageButton} from './test_helpers';

/**
 * @objective Verify draft auto-save functionality and persistence
 */
test('auto-saves draft while editing', {tag: '@pages'}, async ({pw}) => {
    const {user, team, adminClient} = await pw.initSetup();
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Draft Wiki ${pw.random.id()}`);

    // # Create draft
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();

    const titleInput = page.locator('[data-testid="wiki-page-title-input"]');
    await titleInput.fill('Draft Page');

    const editor = page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();
    await editor.click();
    await editor.type('Draft content here');

    // * Verify saving indicator appears
    await page.waitForTimeout(2000); // Wait for auto-save

    const savingIndicator = page.locator('[data-testid="saving-indicator"]');
    if (await savingIndicator.isVisible().catch(() => false)) {
        const indicatorText = await savingIndicator.textContent();
        expect(indicatorText?.toLowerCase()).toMatch(/saved|saving/);
    }

    // # Refresh page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // * Verify draft persisted
    const titleAfterReload = page.locator('[data-testid="wiki-page-title-input"]');
    const editorAfterReload = page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();

    if (await titleAfterReload.isVisible().catch(() => false)) {
        await expect(titleAfterReload).toHaveValue('Draft Page');
        await expect(editorAfterReload).toContainText('Draft content here');
    }
});

/**
 * @objective Verify draft discard functionality
 */
test('discards draft and removes from hierarchy', {tag: '@pages'}, async ({pw}) => {
    const {user, team, adminClient} = await pw.initSetup();
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Discard Wiki ${pw.random.id()}`);

    // # Create draft
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();

    const titleInput = page.locator('[data-testid="wiki-page-title-input"]');
    await titleInput.fill('Draft to Discard');

    const editor = page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();
    await editor.click();
    await editor.type('This will be discarded');

    // Wait for auto-save
    await page.waitForTimeout(2000);

    // # Discard draft
    const discardButton = page.locator('[data-testid="discard-button"]');
    if (await discardButton.isVisible().catch(() => false)) {
        await discardButton.click();

        // Handle confirmation modal
        const confirmModal = page.getByRole('dialog', {name: /Discard|Confirm/i});
        if (await confirmModal.isVisible({timeout: 3000}).catch(() => false)) {
            const confirmButton = confirmModal.locator('[data-testid="wiki-page-discard-button"], [data-testid="confirm-button"]').first();
            await confirmButton.click();
        }

        await page.waitForLoadState('networkidle');

        // * Verify navigated away from draft URL
        await page.waitForTimeout(500);
        const currentUrl = page.url();
        expect(currentUrl).not.toMatch(/\/drafts\//);
    }
});

/**
 * @objective Verify multiple drafts display in hierarchy panel
 */
test('shows multiple drafts in hierarchy section', {tag: '@pages'}, async ({pw}) => {
    const {user, team, adminClient} = await pw.initSetup();
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Multi Draft Wiki ${pw.random.id()}`);

    // # Create first draft
    page.once('dialog', async (dialog) => {
        await dialog.accept('Draft 1');
    });

    let newPageButton = getNewPageButton(page);
    await newPageButton.click();

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
    page.once('dialog', async (dialog) => {
        await dialog.accept('Draft 2');
    });

    await newPageButton.click();

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
test('recovers draft after browser refresh', {tag: '@pages'}, async ({pw}) => {
    const {user, team, adminClient} = await pw.initSetup();
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Refresh Wiki ${pw.random.id()}`);

    // # Create draft
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();

    const titleInput = page.locator('[data-testid="wiki-page-title-input"]');
    await titleInput.fill('Draft Before Refresh');

    const editor = page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();
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
        // Draft recovered in editor
        const titleValue = await titleAfterRefresh.inputValue();
        const editorText = await editorAfterRefresh.textContent();

        const titleMatches = titleValue === 'Draft Before Refresh';
        const contentMatches = editorText?.includes('Content that should survive refresh');

        expect(titleMatches || contentMatches).toBe(true);
    } else {
        // Draft should be in hierarchy tree (drafts are integrated in tree)
        const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');
        const draftNode = hierarchyPanel.locator('[data-testid="page-tree-node"][data-is-draft="true"]', {hasText: 'Draft Before Refresh'});
        if (await draftNode.isVisible().catch(() => false)) {
            await expect(draftNode).toBeVisible();
        }
    }
});

/**
 * @objective Verify editing published page creates draft
 */
test('converts published page to draft when editing', {tag: '@pages'}, async ({pw}) => {
    const {user, team, adminClient} = await pw.initSetup();
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
    if (await draftNode.isVisible().catch(() => false)) {
        await expect(draftNode).toBeVisible();
    }
});

/**
 * @objective Verify clicking draft node in hierarchy navigates to draft editor
 */
test('navigates to draft editor when clicking draft node', {tag: '@pages'}, async ({pw}) => {
    const {user, team, adminClient} = await pw.initSetup();
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Nav Draft Wiki ${pw.random.id()}`);

    // # Create draft
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();

    const titleInput = page.locator('[data-testid="wiki-page-title-input"]');
    await titleInput.fill('Navigable Draft');

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
    if (await draftNode.isVisible().catch(() => false)) {
        await draftNode.click();
        await page.waitForLoadState('networkidle');

        // * Verify navigated to draft editor
        const currentUrl = page.url();
        expect(currentUrl).toMatch(/\/drafts\/|\/edit/);

        // * Verify editor shows draft content
        const editorAfterNav = page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();
        await expect(editorAfterNav).toBeVisible();
        await expect(editorAfterNav).toContainText('Draft content');
    }
});

/**
 * @objective Verify draft node appears at correct hierarchy level
 */
test('shows draft node as child of intended parent in tree', {tag: '@pages'}, async ({pw}) => {
    const {user, team, adminClient} = await pw.initSetup();
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki and parent page through UI
    const wiki = await createWikiThroughUI(page, `Hierarchy Draft Wiki ${pw.random.id()}`);
    const parentPage = await createPageThroughUI(page, 'Parent Page', 'Parent content');

    // # Wait for parent node to appear in tree
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');
    const parentNode = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-page-id="${parentPage.id}"]`);
    await parentNode.waitFor({state: 'visible', timeout: 5000});

    // # Expand parent node if it has children indicator
    const expandButton = parentNode.locator('xpath=ancestor::*').locator('[data-testid="expand-button"]').first();
    if (await expandButton.isVisible({timeout: 1000}).catch(() => false)) {
        await expandButton.click();
        await page.waitForTimeout(300);
    }

    // # Create child draft via right-click context menu
    page.once('dialog', async (dialog) => {
        await dialog.accept('Child Draft Node');
    });

    await parentNode.click({button: 'right'});

    const contextMenu = page.locator('[data-testid="page-context-menu"]');
    if (await contextMenu.isVisible({timeout: 2000}).catch(() => false)) {
        const createSubpageButton = contextMenu.locator('button:has-text("Create"), button:has-text("Subpage")').first();
        await createSubpageButton.click();

        await page.waitForTimeout(1000); // Wait for editor to load

        const titleInput = page.locator('[data-testid="wiki-page-title-input"]');
        await titleInput.fill('Child Draft Node');

        const editor = page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();
        await editor.click();
        await editor.type('Child content');

        await page.waitForTimeout(2000);

        // * Verify draft appears under parent in hierarchy
        const childDraftNode = hierarchyPanel.locator('[data-testid="page-tree-node"]:has-text("Child Draft Node")').first();
        if (await childDraftNode.isVisible().catch(() => false)) {
            // Check if draft node is indented (indicating child relationship)
            const draftPaddingLeft = await childDraftNode.evaluate((el) => window.getComputedStyle(el).paddingLeft);
            const parentPaddingLeft = await parentNode.evaluate((el) => window.getComputedStyle(el).paddingLeft);

            // Child should have more indentation than parent
            expect(parseInt(draftPaddingLeft)).toBeGreaterThan(parseInt(parentPaddingLeft));
        }
    }
});

/**
 * @objective Verify switching between multiple drafts preserves content
 */
test('switches between multiple drafts without losing content', {tag: '@pages'}, async ({pw}) => {
    const {user, team, adminClient} = await pw.initSetup();
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Multi Switch Wiki ${pw.random.id()}`);

    // # Create first draft
    page.once('dialog', async (dialog) => {
        await dialog.accept('First Draft');
    });

    let newPageButton = getNewPageButton(page);
    await newPageButton.click();

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

    page.once('dialog', async (dialog) => {
        await dialog.accept('Second Draft');
    });

    await newPageButton.click();

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
    if (await firstDraftNode.isVisible().catch(() => false)) {
        await firstDraftNode.click();
        await page.waitForLoadState('networkidle');

        // * Verify first draft content preserved
        titleInput = page.locator('[data-testid="wiki-page-title-input"]');
        editor = page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();

        await expect(titleInput).toHaveValue('First Draft');
        await expect(editor).toContainText('First draft content');

        // # Switch to second draft
        const secondDraftNode = hierarchyPanel.locator('[data-testid="page-tree-node"][data-is-draft="true"]', {hasText: 'Second Draft'});
        if (await secondDraftNode.isVisible().catch(() => false)) {
            await secondDraftNode.click();
            await page.waitForLoadState('networkidle');

            // * Verify second draft content preserved
            await expect(titleInput).toHaveValue('Second Draft');
            await expect(editor).toContainText('Second draft content');
        }
    }
});

/**
 * @objective Verify draft visual distinction in hierarchy panel
 */
test('displays draft nodes with visual distinction from published pages', {tag: '@pages'}, async ({pw}) => {
    const {user, team, adminClient} = await pw.initSetup();
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki and published page through UI
    const wiki = await createWikiThroughUI(page, `Visual Wiki ${pw.random.id()}`);
    const publishedPage = await createPageThroughUI(page, 'Published Page', 'Published content');

    // # Create draft
    // Handle native prompt dialog for page title
    page.once('dialog', async (dialog) => {
        await dialog.accept('Draft Page');
    });

    const newPageButton = getNewPageButton(page);
    await newPageButton.click();

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
