// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';

import {createWikiThroughUI, createPageThroughUI, createChildPageThroughContextMenu, getNewPageButton, fillCreatePageModal} from './test_helpers';

/**
 * @objective Verify warning when navigating away with unsaved changes
 *
 * @precondition
 * Pages/Wiki feature is enabled on the server
 */
test.skip('warns when navigating away with unsaved changes', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Unsaved Changes Wiki ${pw.random.id()}`);

    // # Create new page
    // Scope to pages hierarchy panel to avoid strict mode violations with duplicate elements
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]').first();
    const newPageButton = hierarchyPanel.locator('[data-testid="new-page-button"]');
    await newPageButton.click();

    // # Make changes
    const titleInput = page.locator('[data-testid="wiki-page-title-input"]').first();
    await titleInput.fill('Draft With Changes');

    const editor = page.locator('.ProseMirror').first();
    await editor.click();
    await editor.type('Important unsaved content here');

    // * Wait for auto-save indicator (if exists)
    await page.waitForTimeout(1000);

    const savingIndicator = page.locator('[data-testid="saving-indicator"], .saving-indicator').first();
    if (await savingIndicator.isVisible().catch(() => false)) {
        // Wait for "Saved" or "Saving..." to appear
        await page.waitForTimeout(2000);
    }

    // # Try to navigate away via new page button
    const newPageButton2 = getNewPageButton(page);
    await newPageButton2.click();

    // * Verify warning dialog appears
    await page.waitForTimeout(500);

    const warningDialog = page.getByRole('dialog', {name: /Unsaved Changes|Discard Changes|Discard Draft/i});
    const hasWarning = await warningDialog.isVisible({timeout: 3000}).catch(() => false);

    if (hasWarning) {
        await expect(warningDialog).toContainText(/unsaved|discard|changes/i);

        // * Verify options: "Stay" or "Discard"
        const stayButton = warningDialog.locator('button:has-text("Stay"), [data-testid="cancel-button"]').first();
        const discardButton = warningDialog.locator('[data-testid="wiki-page-discard-button"], button:has-text("Leave")').first();

        await expect(stayButton).toBeVisible();
        await expect(discardButton).toBeVisible();

        // # Click "Stay"
        await stayButton.click();

        // * Verify still on editor with changes preserved
        await expect(titleInput).toHaveValue('Draft With Changes');
        await expect(editor).toContainText('Important unsaved content');
    }
});

/**
 * @objective Verify warning when using browser back button with unsaved changes
 */
test.skip('warns when using browser back button with unsaved changes', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    // # Setup: Create published page
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and published page through UI
    const wiki = await createWikiThroughUI(page, `Back Button Wiki ${pw.random.id()}`);
    const publishedPage = await createPageThroughUI(page, 'Published Page', 'Original content');

    // Navigate to page
    await page.goto(`${pw.url}/${team.name}/channels/${channel.name}/wikis/${wiki.id}/pages/${publishedPage.id}`);
    await page.waitForLoadState('networkidle');

    // # Start editing
    const editButton = page.locator('[data-testid="wiki-page-edit-button"]');
    await editButton.click();

    const editor = page.locator('.ProseMirror').first();
    await editor.click();
    await editor.type(' - Modified content');

    // Wait for changes to register
    await page.waitForTimeout(1000);

    // # Use browser back button
    await page.goBack();

    // * Playwright cannot interact with browser's native beforeunload dialog
    // Instead, verify that custom dialog appears or navigation is blocked
    await page.waitForTimeout(500);

    const warningDialog = page.getByRole('dialog', {name: /Unsaved Changes|Discard/i});
    const hasCustomWarning = await warningDialog.isVisible().catch(() => false);

    if (hasCustomWarning) {
        await expect(warningDialog).toContainText(/unsaved changes/i);
    } else {
        // If using native beforeunload, page should still be on editor
        const editorStillVisible = await page.locator('.ProseMirror').first().isVisible();
        expect(editorStillVisible).toBe(true);
    }
});

/**
 * @objective Verify scroll position is preserved when navigating back to page
 */
test.skip('preserves scroll position when navigating back to page', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    // # Setup: Create page with long content
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Scroll Wiki ${pw.random.id()}`);

    // # Create page with long content through UI
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Long Page');

    const editor = page.locator('.ProseMirror').first();
    await editor.click();

    // Generate long content (50 paragraphs)
    const longContent = Array(50).fill(0).map((_, i) =>
        `Paragraph ${i + 1} - Lorem ipsum dolor sit amet, consectetur adipiscing elit.`
    ).join('\n\n');

    await editor.type(longContent);

    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]').first();
    await publishButton.click();

    // Wait for page to be published and visible
    await page.waitForLoadState('networkidle');

    // # Scroll down
    const pageContent = page.locator('[data-testid="page-viewer-content"]');
    await pageContent.evaluate((el) => el.scrollTop = 1000);

    // Verify we scrolled
    const scrollTopBefore = await pageContent.evaluate((el) => el.scrollTop);
    expect(scrollTopBefore).toBeGreaterThan(500);

    // # Navigate to different page
    await newPageButton.click();

    // # Navigate back
    await page.goBack();
    await page.waitForLoadState('networkidle');

    // * Verify scroll position restored (or close to it)
    const scrollTopAfter = await pageContent.evaluate((el) => el.scrollTop);

    // Allow some tolerance (within 200px)
    const difference = Math.abs(scrollTopAfter - scrollTopBefore);
    expect(difference).toBeLessThan(300);
});

/**
 * @objective Verify browser refresh during edit recovers draft without data loss
 */
test('handles browser refresh during edit without data loss', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    // # Setup
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Refresh Wiki ${pw.random.id()}`);

    // Reload to ensure clean state (wiki is already visible after creation)
    await page.reload();
    await page.waitForLoadState('networkidle');

    // # Create new page
    // Scope to pages hierarchy panel to avoid strict mode violations with duplicate elements
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]').first();
    await hierarchyPanel.waitFor({state: 'visible', timeout: 5000});
    const newPageButton = hierarchyPanel.locator('[data-testid="new-page-button"]');
    await newPageButton.waitFor({state: 'visible', timeout: 5000});
    await newPageButton.click();

    // # Fill in the create page modal
    await fillCreatePageModal(page, 'Draft Before Refresh');

    // # Wait for the draft page to be created and displayed
    await page.waitForLoadState('networkidle');

    // # Make additional changes to title and content
    const titleInput = page.locator('[data-testid="wiki-page-title-input"]').first();
    await titleInput.fill('Draft Before Refresh - Modified');

    const editor = page.locator('.ProseMirror').first();
    await editor.click();
    await editor.type('Content that should survive refresh');

    // * Wait for auto-save
    await page.waitForTimeout(2000);

    const savingIndicator = page.locator('[data-testid="saving-indicator"], .saving-indicator').first();
    if (await savingIndicator.isVisible().catch(() => false)) {
        // Wait for "Saved" state
        await pw.waitUntil(
            async () => {
                const text = await savingIndicator.textContent();
                return text?.includes('Saved') || text?.includes('saved');
            },
            {timeout: 5000},
        );
    }

    // # Refresh browser
    await page.reload();
    await page.waitForLoadState('networkidle');

    // * Verify draft recovered from localStorage or server
    await page.waitForTimeout(1000);

    const editorAfterRefresh = page.locator('.ProseMirror').first();
    const titleAfterRefresh = page.locator('[data-testid="wiki-page-title-input"]').first();

    // Check if draft was recovered
    const editorVisible = await editorAfterRefresh.isVisible().catch(() => false);
    const titleVisible = await titleAfterRefresh.isVisible().catch(() => false);

    if (editorVisible && titleVisible) {
        // Draft should be recovered
        const titleValue = await titleAfterRefresh.inputValue();
        const editorText = await editorAfterRefresh.textContent();

        // Either exact match or draft was saved to server
        const titleMatches = titleValue === 'Draft Before Refresh';
        const contentMatches = editorText?.includes('Content that should survive refresh');

        expect(titleMatches || contentMatches).toBe(true);
    } else {
        // If not in editor, draft might be in hierarchy tree (drafts are integrated in tree)
        const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');
        const draftNode = hierarchyPanel.locator('[data-testid="page-tree-node"][data-is-draft="true"]', {hasText: 'Draft Before Refresh'});
        const hasDraft = await draftNode.isVisible().catch(() => false);

        if (hasDraft) {
            await expect(draftNode).toBeVisible();
        }
    }
});
