// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page, Locator} from '@playwright/test';
import {expect} from '@playwright/test';
import type {Client4} from '@mattermost/client';
import type {Channel} from '@mattermost/types/channels';

/**
 * Creates a test channel for pages/wiki tests
 * @param client - Client4 instance
 * @param teamId - Team ID
 * @param channelName - Name for the channel
 * @returns The created channel
 */
export async function createTestChannel(client: Client4, teamId: string, channelName: string): Promise<Channel> {
    return await client.createChannel({
        team_id: teamId,
        name: channelName.toLowerCase().replace(/[^a-z0-9-_]/g, '-'),
        display_name: channelName,
        type: 'O',
    });
}

/**
 * Gets the new page button locator scoped to the pages hierarchy panel
 * This avoids strict mode violations when there are multiple buttons with the same testid
 * @param page - Playwright page object
 * @returns The new page button locator
 */
export function getNewPageButton(page: Page): Locator {
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]').first();
    return hierarchyPanel.locator('[data-testid="new-page-button"]');
}

/**
 * Fills in the create page modal with a title and clicks Create
 * This is a reusable helper for any test that needs to create a page via the modal
 * @param page - Playwright page object
 * @param pageTitle - Title for the page
 */
export async function fillCreatePageModal(page: Page, pageTitle: string) {
    // # Wait for create page modal to appear
    const modalInput = page.locator('[data-testid="create-page-modal-title-input"]');
    await modalInput.waitFor({state: 'visible', timeout: 5000});

    // # Fill in page title
    await modalInput.fill(pageTitle);

    // # Click Create button in modal
    const createButton = page.getByRole('button', {name: 'Create'});
    await createButton.click();

    // # Wait for modal to close
    await modalInput.waitFor({state: 'hidden', timeout: 5000});
}

/**
 * Opens the page link modal using the keyboard shortcut (Ctrl+L or Cmd+L on Mac)
 * @param editor - The editor locator (ProseMirror element)
 * @returns The link modal locator
 */
export async function openPageLinkModal(editor: Locator): Promise<Locator> {
    const isMac = process.platform === 'darwin';
    const modifierKey = isMac ? 'Meta' : 'Control';
    await editor.press(`${modifierKey}+KeyL`);

    const page = editor.page();
    return page.locator('[data-testid="page-link-modal"]').first();
}

/**
 * Opens the page link modal by clicking the link button in the editor toolbar
 * @param page - Playwright page object
 * @returns The link modal locator
 */
export async function openPageLinkModalViaButton(page: Page): Promise<Locator> {
    // Wait for editor toolbar to be visible (only visible when editor is in edit mode)
    const toolbar = page.locator('.tiptap-toolbar');
    await toolbar.waitFor({state: 'visible', timeout: 10000});

    // Wait for link button to be visible and clickable
    const linkButton = page.locator('[data-testid="page-link-button"]');
    await linkButton.waitFor({state: 'visible', timeout: 5000});
    await linkButton.click();

    return page.locator('[data-testid="page-link-modal"]').first();
}

/**
 * Creates a wiki through the UI using the channel tab bar
 * @param page - Playwright page object
 * @param wikiName - Name for the wiki
 * @returns The created wiki (extracted from navigation URL)
 */
export async function createWikiThroughUI(page: Page, wikiName: string) {
    // # Wait for page to fully load after navigation
    await page.waitForLoadState('domcontentloaded');
    await page.waitForLoadState('networkidle');

    // # Click the add content button in the unified channel tabs bar
    // First, check if we need to navigate to channel view
    const currentUrl = page.url();
    const isInWikiView = currentUrl.includes('/wiki/');

    if (isInWikiView) {
        // # Navigate to channel view first
        const channelIdMatch = currentUrl.match(/\/wiki\/([^/]+)/);
        if (channelIdMatch) {
            const channelId = channelIdMatch[1];
            const teamMatch = currentUrl.match(/\/([^/]+)\/wiki\//);
            if (teamMatch) {
                const teamName = teamMatch[1];
                await page.goto(`/${teamName}/channels/${channelId}`);
                await page.waitForLoadState('networkidle');
            }
        }
    }

    // # Click the "+" button in the channel tabs to open the add content menu
    const addContentButton = page.locator('#add-tab-content');
    await addContentButton.waitFor({state: 'visible', timeout: 5000});
    await addContentButton.click();

    // # Click "Wiki" option from the dropdown menu
    const addWikiMenuItem = page.getByText('Wiki', {exact: true});
    await addWikiMenuItem.waitFor({state: 'visible', timeout: 5000});
    await addWikiMenuItem.click();

    // # Fill wiki name in modal
    const wikiNameInput = page.locator('#text-input-modal-input');
    await wikiNameInput.waitFor({state: 'visible', timeout: 5000});
    await wikiNameInput.fill(wikiName);

    // # Click Create button - wait for it to be enabled after input fills
    const createButton = page.getByRole('button', {name: 'Create'});
    await expect(createButton).toBeEnabled({timeout: 5000});
    await createButton.click();

    // # Wait for navigation to wiki page (not just network idle)
    await page.waitForURL(/\/wiki\/[^/]+\/[^/]+/, {timeout: 10000});
    await page.waitForLoadState('networkidle');

    // Extract wiki ID from URL
    const url = page.url();
    const wikiIdMatch = url.match(/\/wiki\/[^/]+\/([^/]+)/);
    const wikiId = wikiIdMatch ? wikiIdMatch[1] : null;

    if (!wikiId) {
        throw new Error(`Failed to extract wiki ID from URL: ${url}`);
    }

    // # Open pages panel if it's collapsed
    await ensurePanelOpen(page);

    return {id: wikiId, title: wikiName};
}

/**
 * Waits for a wiki view to be fully loaded
 * @param page - Playwright page object
 */
/**
 * Waits for the wiki view React component to be mounted and rendered.
 *
 * The original implementation only waited for the wrapper element with
 * `data-testId="wiki-view"` to become visible. On slower CI runners, the
 * element might be attached to the DOM quickly, but stay hidden while the
 * lazy-loaded bundle for the wiki view is still downloading. This resulted in
 * sporadic timeouts – especially after a wiki rename when the client needs to
 * reload the pages hierarchy and other data.
 *
 * The function now:
 *   1. Waits for the element to be attached (present in DOM) – this is fast.
 *   2. Waits for the element to become visible – allowing a longer timeout so
 *      that slower environments are covered.
 *   3. If the temporary loading screen (`data-testid="wiki-view-loading"`) is
 *      rendered, it waits for that element to disappear which signals that the
 *      wiki data finished loading and the main UI is ready.
 */
export async function waitForWikiViewLoad(page: Page, timeout = 30000) {
    const wikiView = page.locator('[data-testid="wiki-view"]');

    // 1. Wait for the component to be added to the DOM
    await wikiView.waitFor({state: 'attached', timeout});

    // 2. Wait until it is actually visible to the user
    await wikiView.waitFor({state: 'visible', timeout});

    // 3. If a loading indicator is present, wait until it disappears
    const loadingLocator = page.locator('[data-testid="wiki-view-loading"]');
    const isLoadingVisible = await loadingLocator.isVisible({timeout: 1000}).catch(() => false);
    if (isLoadingVisible) {
        await loadingLocator.waitFor({state: 'hidden', timeout});
    }

    // Small extra delay to give the hierarchy panel and other async tasks time
    // to settle before the caller continues with more specific assertions.
    await page.waitForTimeout(500);
}

/**
 * Opens the pages hierarchy panel if it's collapsed
 * @param page - Playwright page object
 */
export async function ensurePanelOpen(page: Page) {
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');
    const hamburgerButton = page.locator('[data-testid="wiki-view-hamburger-button"]');

    const isPanelVisible = await hierarchyPanel.isVisible().catch(() => false);

    if (!isPanelVisible) {
        await hamburgerButton.waitFor({state: 'visible', timeout: 10000});
        await hamburgerButton.click();
        await hierarchyPanel.waitFor({state: 'visible', timeout: 10000});
        await page.waitForTimeout(500);
    }
}

/**
 * Creates a page through the UI using the "New Page" button
 * @param page - Playwright page object
 * @param pageTitle - Title for the page
 * @param pageContent - Content for the page (optional, defaults to empty string)
 */
export async function createPageThroughUI(page: Page, pageTitle: string, pageContent: string = '') {
    // # Ensure pages panel is open first
    await ensurePanelOpen(page);

    // # Click "New Page" button to open modal
    const newPageButton = getNewPageButton(page);
    await newPageButton.waitFor({state: 'visible', timeout: 5000});
    await newPageButton.click();

    // # Fill in modal and create page
    await fillCreatePageModal(page, pageTitle);

    // # Wait for editor to appear (draft created and loaded)
    const editor = page.locator('.ProseMirror').first();
    await editor.waitFor({state: 'visible', timeout: 5000});

    // # Fill page content in TipTap editor
    await editor.click();

    // Clear any existing content first (important for rapid successive page creation)
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(200);

    // Type content directly into editor element
    await editor.type(pageContent);

    // Verify content was actually entered (skip validation for whitespace-only content)
    const enteredText = await editor.textContent();
    const contentIsWhitespaceOnly = pageContent.trim() === '';
    if (!contentIsWhitespaceOnly && !enteredText?.includes(pageContent)) {
        throw new Error(`Content not entered correctly. Expected: "${pageContent}", Got: "${enteredText}"`);
    }

    // # Publish the page
    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]');

    // Verify button is visible and enabled before clicking
    await publishButton.waitFor({state: 'visible', timeout: 5000});
    const isEnabled = await publishButton.isEnabled();
    if (!isEnabled) {
        throw new Error('Publish button is disabled - cannot publish');
    }

    await publishButton.click();

    // # Wait for navigation and network to settle after publish
    await page.waitForLoadState('networkidle');

    // # Wait for page viewer to appear (means publish succeeded and page loaded)
    const pageViewer = page.locator('[data-testid="page-viewer-content"]');
    await pageViewer.waitFor({state: 'visible', timeout: 30000});

    // Extract page ID from URL pattern: /:teamName/wiki/:channelId/:wikiId/:pageId
    const url = page.url();
    const pageIdMatch = url.match(/\/wiki\/[^/]+\/[^/]+\/([^/?]+)/);
    const pageId = pageIdMatch ? pageIdMatch[1] : null;

    if (!pageId) {
        throw new Error(`Failed to extract page ID from URL: ${url}`);
    }

    return {id: pageId, title: pageTitle};
}

/**
 * Creates a child page through the context menu
 * @param page - Playwright page object
 * @param parentPageId - ID of the parent page
 * @param pageTitle - Title for the child page
 * @param pageContent - Content for the child page (optional, defaults to empty string)
 */
export async function createChildPageThroughContextMenu(
    page: Page,
    parentPageId: string,
    pageTitle: string,
    pageContent: string = '',
) {
    // # Open parent page context menu
    const parentNode = page.locator(`[data-testid="page-tree-node"][data-page-id="${parentPageId}"]`);
    const menuButton = parentNode.locator('[data-testid="page-tree-node-menu-button"]');
    await menuButton.click();

    // # Click "New subpage" option to open modal
    const addChildButton = page.locator('[data-testid="page-context-menu-new-child"]').first();
    await addChildButton.click();

    // # Fill in modal and create page
    await fillCreatePageModal(page, pageTitle);

    // # Wait for editor to appear (draft created and loaded)
    const editor = page.locator('.ProseMirror').first();
    await editor.waitFor({state: 'visible', timeout: 5000});

    // # Fill page content in TipTap editor
    await editor.click();

    // Clear any existing content first (important for rapid successive page creation)
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(200);

    // Type content directly into editor element
    await editor.type(pageContent);

    // Verify content was actually entered (skip validation for whitespace-only content)
    const enteredText = await editor.textContent();
    const contentIsWhitespaceOnly = pageContent.trim() === '';
    if (!contentIsWhitespaceOnly && !enteredText?.includes(pageContent)) {
        throw new Error(`Content not entered correctly. Expected: "${pageContent}", Got: "${enteredText}"`);
    }

    // # Publish the page
    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]');

    // Verify button is visible and enabled before clicking
    await publishButton.waitFor({state: 'visible', timeout: 5000});
    const isEnabled = await publishButton.isEnabled();
    if (!isEnabled) {
        throw new Error('Publish button is disabled - cannot publish');
    }

    await publishButton.click();

    // # Wait for navigation and network to settle after publish
    await page.waitForLoadState('networkidle');

    // # Wait for page viewer to appear (means publish succeeded and page loaded)
    const pageViewer = page.locator('[data-testid="page-viewer-content"]');
    await pageViewer.waitFor({state: 'visible', timeout: 30000});

    // Extract page ID from URL pattern: /:teamName/wiki/:channelId/:wikiId/:pageId
    const url = page.url();
    const pageIdMatch = url.match(/\/wiki\/[^/]+\/[^/]+\/([^/?]+)/);
    const pageId = pageIdMatch ? pageIdMatch[1] : null;

    if (!pageId) {
        throw new Error(`Failed to extract page ID from URL: ${url}`);
    }

    return {id: pageId, title: pageTitle};
}
/**
 * Adds a heading to the TipTap editor using the toolbar button
 * @param page - Playwright page object
 * @param level - Heading level (1, 2, or 3)
 * @param text - Heading text
 * @param addContentAfter - Optional content to add after the heading in a new paragraph
 */
export async function addHeadingToEditor(page: Page, level: 1 | 2 | 3, text: string, addContentAfter?: string) {
    // # Type the heading text
    await page.keyboard.type(text);
    await page.waitForTimeout(100);

    // # Select the text we just typed (from start to end of line)
    await page.keyboard.press('Home');
    await page.keyboard.press('Shift+End');
    await page.waitForTimeout(200);

    // # Wait for the formatting bubble menu to appear
    // The bubble menu contains both FormattingBarBubble and InlineCommentButton
    const formattingBubble = page.locator('.formatting-bar-bubble').first();
    await formattingBubble.waitFor({state: 'visible', timeout: 5000});

    // # Find and click the heading button
    const headingButton = formattingBubble.locator(`button[title="Heading ${level}"]`).first();
    await headingButton.waitFor({state: 'visible', timeout: 3000});
    // Use force:true to click through the inline-comment-bubble overlay
    await headingButton.click({force: true});
    await page.waitForTimeout(200);

    // # Press Right arrow to deselect and move cursor to end of heading
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(50);

    // # Only press Enter and add content if we have content - this prevents creating empty heading nodes
    if (addContentAfter) {
        await page.keyboard.press('Enter');
        await page.waitForTimeout(100);
        await page.keyboard.type(addContentAfter);
        await page.keyboard.press('Enter');
    }
}

/**
 * Waits for a page to appear in the hierarchy panel
 * This ensures that loadChannelPages() has completed and Redux state is updated
 * @param page - Playwright page object
 * @param pageTitle - Title of the page to wait for
 * @param timeout - Optional timeout in milliseconds (default: 5000)
 */
export async function waitForPageInHierarchy(page: Page, pageTitle: string, timeout: number = 5000) {
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]').first();
    const pageButton = hierarchyPanel.getByRole('button', {name: pageTitle, exact: true});
    await pageButton.waitFor({state: 'visible', timeout});
}

/**
 * Renames a page via context menu using the rename modal
 * @param page - Playwright page object
 * @param currentTitle - Current title of the page to rename
 * @param newTitle - New title for the page
 */
export async function renamePageViaContextMenu(page: Page, currentTitle: string, newTitle: string) {
    // # Open pages hierarchy panel
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');

    // # Right-click on page node to open context menu
    const pageNode = hierarchyPanel.locator(`text="${currentTitle}"`).first();
    await pageNode.click({button: 'right'});

    // # Click rename option in context menu
    const contextMenu = page.locator('[data-testid="page-context-menu"]');
    await contextMenu.waitFor({state: 'visible', timeout: 2000});

    const renameButton = contextMenu.locator('[data-testid="page-context-menu-rename"]');
    await renameButton.click();

    // # Wait for rename modal to appear
    const renameModal = page.getByRole('dialog', {name: /Rename/i});
    await renameModal.waitFor({state: 'visible', timeout: 3000});

    // # Fill in new title
    const titleInput = renameModal.locator('[data-testid="rename-page-modal-title-input"]');
    await titleInput.waitFor({state: 'visible', timeout: 2000});
    await titleInput.clear();
    await titleInput.fill(newTitle);

    // # Click Rename button
    const confirmButton = renameModal.getByRole('button', {name: 'Rename'});
    await confirmButton.click();

    // # Wait for modal to close
    await renameModal.waitFor({state: 'hidden', timeout: 3000});
}

/**
 * Creates a draft (without publishing) through the UI
 * @param page - Playwright page object
 * @param draftTitle - Title for the draft
 * @param draftContent - Content for the draft (optional, defaults to empty string)
 */
export async function createDraftThroughUI(page: Page, draftTitle: string, draftContent: string = '') {
    // # Click "New Page" button to open modal
    const newPageButton = getNewPageButton(page);
    await newPageButton.waitFor({state: 'visible', timeout: 5000});
    await newPageButton.click();

    // # Fill in modal and create draft
    await fillCreatePageModal(page, draftTitle);

    // # Wait for editor to appear (draft created and loaded)
    const editor = page.locator('.ProseMirror').first();
    await editor.waitFor({state: 'visible', timeout: 5000});

    // # Fill draft content in TipTap editor
    await editor.click();

    // Clear any existing content first
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(200);

    // Type content directly into editor element
    if (draftContent) {
        await editor.type(draftContent);
    }

    // Wait for auto-save to complete
    await page.waitForTimeout(2000);

    // Extract draft ID from URL pattern: /:teamName/wiki/:channelId/:wikiId/drafts/:draftId
    const url = page.url();
    const draftIdMatch = url.match(/\/drafts\/([^/?]+)/);
    const draftId = draftIdMatch ? draftIdMatch[1] : null;

    if (!draftId) {
        throw new Error(`Failed to extract draft ID from URL: ${url}`);
    }

    return {id: draftId, title: draftTitle};
}

/**
 * Adds an inline comment to selected text in the editor
 * @param page - Playwright page object
 * @param textToSelect - Text content to find (optional - if not provided, selects all text)
 * @param commentText - Comment to add
 * @param publishAfter - Whether to publish the page after adding the comment (default: true)
 * @returns True if comment was added successfully, false otherwise
 */
export async function addInlineCommentAndPublish(
    page: Page,
    textToSelect: string,
    commentText: string,
    publishAfter: boolean = true,
): Promise<boolean> {
    // # Click on the editor first
    const editor = page.locator('.ProseMirror').first();
    await editor.click();

    // # Select all text using Control+A (matches the pattern from working tests)
    await page.keyboard.down('Control');
    await page.keyboard.press('a');
    await page.keyboard.up('Control');
    await page.waitForTimeout(200);

    // # Wait for and click the inline comment button
    const commentButton = page.locator('button[aria-label*="comment"], [data-testid="inline-comment-submit"]').first();
    const buttonVisible = await commentButton.isVisible({timeout: 2000}).catch(() => false);

    if (!buttonVisible) {
        console.log('Inline comment button not visible');
        return false;
    }

    await commentButton.click();
    await page.waitForTimeout(500);

    // # Fill in the comment modal - try different selectors
    let modal = page.getByRole('dialog', {name: /Comment|Add/i});
    let modalVisible = await modal.isVisible({timeout: 2000}).catch(() => false);

    if (!modalVisible) {
        // Try without name filter
        modal = page.getByRole('dialog');
        modalVisible = await modal.isVisible({timeout: 2000}).catch(() => false);
    }

    if (!modalVisible) {
        console.log('Comment modal did not appear');
        return false;
    }

    const textarea = modal.locator('textarea').first();
    await textarea.fill(commentText);

    const addButton = modal.locator('button:has-text("Add"), button:has-text("Submit"), button:has-text("Comment")').first();
    await addButton.click();
    await page.waitForTimeout(500);

    // # Publish if requested
    if (publishAfter) {
        const publishButton = page.locator('[data-testid="wiki-page-publish-button"]').first();
        await publishButton.click();
        await page.waitForLoadState('networkidle');
    }

    return true;
}

/**
 * Gets a wiki tab by title from the unified channel tabs bar
 * @param page - Playwright page object
 * @param wikiTitle - Title of the wiki
 * @returns The wiki tab locator
 */
export function getWikiTab(page: Page, wikiTitle: string): Locator {
    return page.locator('.channel-tab').filter({hasText: wikiTitle}).first();
}

/**
 * Opens the wiki tab menu (three-dot menu)
 * @param page - Playwright page object
 * @param wikiTitle - Title of the wiki
 */
export async function openWikiTabMenu(page: Page, wikiTitle: string) {
    const wikiTabWrapper = page.locator('.channel-tabs-container__tab-wrapper--wiki').filter({hasText: wikiTitle});
    const menuButton = wikiTabWrapper.locator('[id^="wiki-tab-menu-"]').first();
    await menuButton.waitFor({state: 'visible', timeout: 5000});
    await menuButton.click();
}

/**
 * Clicks a menu item in the wiki tab menu
 * @param page - Playwright page object
 * @param menuItemId - ID of the menu item (e.g., 'wiki-tab-rename', 'wiki-tab-delete')
 */
export async function clickWikiTabMenuItem(page: Page, menuItemId: string) {
    const menuItem = page.locator(`#${menuItemId}`);
    await menuItem.waitFor({state: 'visible', timeout: 5000});
    await menuItem.click();
}

/**
 * Renames a wiki through the tab menu
 * @param page - Playwright page object
 * @param oldTitle - Current title of the wiki
 * @param newTitle - New title for the wiki
 */
export async function renameWikiThroughTabMenu(page: Page, oldTitle: string, newTitle: string) {
    await openWikiTabMenu(page, oldTitle);
    await clickWikiTabMenuItem(page, 'wiki-tab-rename');

    const input = page.locator('input[type="text"]').first();
    await input.waitFor({state: 'visible', timeout: 5000});
    await input.fill(newTitle);

    const confirmButton = page.getByRole('button', {name: 'Save'});
    await confirmButton.click();
    await page.waitForLoadState('networkidle');
}

/**
 * Deletes a wiki through the tab menu
 * @param page - Playwright page object
 * @param wikiTitle - Title of the wiki to delete
 */
export async function deleteWikiThroughTabMenu(page: Page, wikiTitle: string) {
    await openWikiTabMenu(page, wikiTitle);
    await clickWikiTabMenuItem(page, 'wiki-tab-delete');

    const confirmButton = page.getByRole('button', {name: 'Delete'});
    await confirmButton.waitFor({state: 'visible', timeout: 5000});
    await confirmButton.click();
    await page.waitForLoadState('networkidle');
}

/**
 * Verifies that a wiki tab exists with the given title
 * @param page - Playwright page object
 * @param wikiTitle - Title of the wiki to verify
 * @returns True if the tab exists
 */
export async function verifyWikiTabExists(page: Page, wikiTitle: string): Promise<boolean> {
    const wikiTab = getWikiTab(page, wikiTitle);
    return wikiTab.isVisible();
}
