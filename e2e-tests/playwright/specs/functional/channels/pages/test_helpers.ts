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
 * Creates a wiki through the UI using the bookmarks menu
 * @param page - Playwright page object
 * @param wikiName - Name for the wiki
 * @returns The created wiki (extracted from navigation URL)
 */
export async function createWikiThroughUI(page: Page, wikiName: string) {
    // # Wait for page to fully load after navigation
    await page.waitForLoadState('domcontentloaded');
    await page.waitForLoadState('networkidle');

    // # Initialize bookmarks bar if not already initialized
    const bookmarksPlusButton = page.locator('#channelBookmarksPlusMenuButton');
    const isPlusButtonVisible = await bookmarksPlusButton.isVisible({timeout: 5000}).catch(() => false);

    if (!isPlusButtonVisible) {
        // # Ensure we're on the channel view (not wiki view or other)
        // Wait for channel header to be visible
        const channelHeader = page.locator('#channelHeaderDropdownButton, #channelHeaderTitle');
        await channelHeader.first().waitFor({state: 'visible', timeout: 10000});

        // # Click channel name dropdown to open menu (use reliable ID selector)
        const channelNameButton = page.locator('#channelHeaderDropdownButton');
        await channelNameButton.click({timeout: 10000});

        // # Wait for menu to appear
        await page.waitForTimeout(500);

        // # Hover on "Bookmarks Bar" submenu to expand it
        const bookmarksBarSubmenu = page.locator('[role="menuitem"]').filter({hasText: 'Bookmarks Bar'}).first();
        await bookmarksBarSubmenu.hover();

        // # Wait for submenu to expand
        await page.waitForTimeout(500);

        // # Click "Add a link" from the submenu
        const addLinkOption = page.locator('[role="menuitem"]').filter({hasText: 'Add a link'}).first();
        await addLinkOption.click();

        // # Wait for "Add a bookmark" modal to appear
        await page.getByRole('heading', {name: 'Add a bookmark'}).waitFor({state: 'visible', timeout: 5000});

        // # Fill in link URL (first input in the modal)
        const linkUrlInput = page.getByRole('dialog').locator('input').first();
        await linkUrlInput.fill('https://www.mattermost.com');

        // # Fill in title (second input in the modal)
        const linkTitleInput = page.getByRole('dialog').locator('input').nth(1);
        await linkTitleInput.fill('Mattermost');

        // # Save the bookmark
        const saveButton = page.getByRole('button', {name: /save|add/i}).first();
        await saveButton.click();

        // # Wait for bookmark to be created and bookmarks bar to appear
        await page.waitForTimeout(1500);
    }

    // # Click bookmarks "+" button
    await bookmarksPlusButton.waitFor({state: 'visible', timeout: 5000});
    await bookmarksPlusButton.click();

    // # Wait for dropdown menu
    await page.waitForTimeout(500);

    // # Click "Create wiki (experiment)" menu item
    const createWikiOption = page.locator('#channelBookmarksCreateWiki, [role="menuitem"]:has-text("Create wiki")').first();
    await createWikiOption.click();

    // # Fill wiki name in modal
    const wikiNameInput = page.locator('#wiki-name-input');
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
    // # Handle native prompt dialog for page title
    page.once('dialog', async (dialog) => {
        await dialog.accept(pageTitle);
    });

    // # Click "New Page" button (will trigger the prompt)
    const newPageButton = getNewPageButton(page);
    await newPageButton.waitFor({state: 'visible', timeout: 5000});
    await newPageButton.click();

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

    // # Handle native prompt dialog for page title
    page.once('dialog', async (dialog) => {
        await dialog.accept(pageTitle);
    });

    // # Click "New subpage" option (will trigger the prompt)
    const addChildButton = page.locator('[data-testid="page-context-menu-new-child"]').first();
    await addChildButton.click();

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
    // # Click the heading button in the toolbar (format button first, then type)
    const headingButton = page.locator(`button[title="Heading ${level}"]`).first();
    await headingButton.click();
    await page.waitForTimeout(200);

    // # Type the heading text
    await page.keyboard.type(text);

    // # Press Enter to exit heading and start new paragraph
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
    const pageButton = hierarchyPanel.locator(`button:has-text("${pageTitle}")`);
    await pageButton.waitFor({state: 'visible', timeout});
}
