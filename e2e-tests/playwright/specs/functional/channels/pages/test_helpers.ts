// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page, Locator} from '@playwright/test';
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

    // # Ensure we're on the channel view (not wiki view)
    // Wait for channel header to be visible
    const channelHeader = page.locator('#channelHeaderDropdownButton, #channelHeaderTitle');
    await channelHeader.first().waitFor({state: 'visible', timeout: 10000});

    // # Click the wiki create button in the channel tab bar
    // Note: The button may not be visible yet if there are no wikis
    // Try to find it first, if not visible, navigate to channel first
    const wikiCreateButton = page.locator('.wiki-create-button');
    const isCreateButtonVisible = await wikiCreateButton.isVisible({timeout: 2000}).catch(() => false);

    if (!isCreateButtonVisible) {
        // # Navigate to channel view first (might be in a wiki view)
        const currentUrl = page.url();
        const channelIdMatch = currentUrl.match(/\/channels\/([^/]+)/);
        if (channelIdMatch) {
            // Already in channel view, tab bar should appear when first wiki is created
            // Click create button which will appear in the tab bar
            await wikiCreateButton.waitFor({state: 'visible', timeout: 5000});
        } else {
            // In wiki view, need to go back to channel
            const channelLinkMatch = currentUrl.match(/\/wiki\/([^/]+)/);
            if (channelLinkMatch) {
                const channelId = channelLinkMatch[1];
                const teamMatch = currentUrl.match(/\/([^/]+)\/(?:channels|wiki)\//);
                if (teamMatch) {
                    const teamName = teamMatch[1];
                    await page.goto(`/${teamName}/channels/${channelId}`);
                    await page.waitForLoadState('networkidle');
                }
            }
        }
    }

    // # Click wiki create button
    await wikiCreateButton.waitFor({state: 'visible', timeout: 5000});
    await wikiCreateButton.click();

    // # Fill wiki name in modal
    const wikiNameInput = page.locator('#text-input-modal-input');
    await wikiNameInput.waitFor({state: 'visible', timeout: 5000});
    await wikiNameInput.fill(wikiName);

    // # Click Create button
    const createButton = page.getByRole('button', {name: 'Create'});
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
 * Opens the pages hierarchy panel if it's collapsed
 * @param page - Playwright page object
 */
export async function ensurePanelOpen(page: Page) {
    const hamburgerButton = page.locator('[data-testid="wiki-view-hamburger-button"]');
    const isHamburgerVisible = await hamburgerButton.isVisible().catch(() => false);
    if (isHamburgerVisible) {
        await hamburgerButton.click();
        await page.waitForTimeout(300); // Wait for panel expansion animation
    }
}

/**
 * Creates a page through the UI using the "New Page" button
 * @param page - Playwright page object
 * @param pageTitle - Title for the page
 * @param pageContent - Content for the page (optional, defaults to empty string)
 */
export async function createPageThroughUI(page: Page, pageTitle: string, pageContent: string = '') {
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
    await pageViewer.waitFor({state: 'visible', timeout: 15000});

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
    await pageViewer.waitFor({state: 'visible', timeout: 15000});

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

    // # Select the text we just typed (from start to end of line)
    await page.keyboard.press('Home');
    await page.keyboard.press('Shift+End');
    await page.waitForTimeout(100);

    // # Click the heading button to format selected text as heading
    const headingButton = page.locator(`button[title="Heading ${level}"]`).first();
    await headingButton.click();
    await page.waitForTimeout(200);

    // # Move cursor to end of line and press Enter to go to next line (which will be a paragraph)
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');

    // # Optionally add content after the heading
    if (addContentAfter) {
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

