// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page, Locator} from '@playwright/test';
import {expect} from '@playwright/test';
import type {Client4} from '@mattermost/client';
import type {Channel} from '@mattermost/types/channels';

/**
 * Gets the platform-specific modifier key (Meta for macOS, Control for Windows/Linux)
 * @returns The modifier key string
 */
export function getModifierKey(): string {
    const isMac = process.platform === 'darwin';
    return isMac ? 'Meta' : 'Control';
}

/**
 * Selects all text in the current focused element using platform-aware keyboard shortcut
 * @param page - Playwright page object
 */
export async function selectAllText(page: Page): Promise<void> {
    const modifierKey = getModifierKey();
    await page.keyboard.down(modifierKey);
    await page.keyboard.press('a');
    await page.keyboard.up(modifierKey);
}

/**
 * Performs a platform-aware keyboard shortcut (e.g., 'b' for bold, 'i' for italic)
 * @param page - Playwright page object
 * @param key - The key to press with the modifier (e.g., 'b', 'i', 'l')
 */
export async function pressModifierKey(page: Page, key: string): Promise<void> {
    const modifierKey = getModifierKey();
    await page.keyboard.press(`${modifierKey}+${key}`);
}

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
 * Opens the page link modal by using the keyboard shortcut (Mod-L)
 * @param page - Playwright page object
 * @returns The link modal locator
 */
export async function openPageLinkModalViaButton(page: Page): Promise<Locator> {
    // Wait for editor to be ready
    const editor = page.locator('.ProseMirror').first();
    await editor.waitFor({state: 'visible', timeout: 5000});

    // Type some text and select it (required for link insertion)
    await editor.click();
    await editor.pressSequentially('test text', {delay: 10});
    await page.keyboard.press('Meta+A'); // Mac: Cmd+A, select all

    // Use keyboard shortcut Mod-L to open link modal (more reliable than bubble menu)
    await page.keyboard.press('Meta+l'); // Mac: Cmd+L

    // Wait for the link modal to appear
    const linkModal = page.locator('[data-testid="page-link-modal"]').first();
    await linkModal.waitFor({state: 'visible', timeout: 5000});

    return linkModal;
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
    await addContentButton.waitFor({state: 'visible', timeout: 15000});
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

    // # Wait for wiki view to fully load before interacting with it
    await waitForWikiViewLoad(page);

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
 * Navigates to a wiki view and waits for it to load
 * @param page - Playwright page object
 * @param baseUrl - Base URL (e.g., pw.url)
 * @param teamName - Team name
 * @param channelId - Channel ID
 * @param wikiId - Wiki ID
 */
export async function navigateToWikiView(page: Page, baseUrl: string, teamName: string, channelId: string, wikiId: string) {
    await page.goto(`${baseUrl}/${teamName}/wiki/${channelId}/${wikiId}`);
    await page.waitForLoadState('networkidle');
    await waitForWikiViewLoad(page);
}

/**
 * Constructs a wiki page URL
 * Matches the URL pattern used by the wiki router: /:team/wiki/:channelId/:wikiId/:pageId
 * @param baseUrl - Base URL (e.g., pw.url)
 * @param teamName - Team name
 * @param channelId - Channel ID (not channel name)
 * @param wikiId - Wiki ID
 * @param pageId - Page ID (optional)
 * @returns Full URL to the wiki page
 */
export function buildWikiPageUrl(baseUrl: string, teamName: string, channelId: string, wikiId: string, pageId?: string): string {
    const basePath = `${baseUrl}/${teamName}/wiki/${channelId}/${wikiId}`;
    return pageId ? `${basePath}/${pageId}` : basePath;
}

/**
 * Opens the pages hierarchy panel if it's collapsed
 * @param page - Playwright page object
 */
export async function ensurePanelOpen(page: Page) {
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');
    const hamburgerButton = page.locator('[data-testid="wiki-view-hamburger-button"]');

    // Wait for either the panel or hamburger button to appear
    // This handles both cases: panel already open OR panel collapsed
    await page.waitForSelector(
        '[data-testid="pages-hierarchy-panel"], [data-testid="wiki-view-hamburger-button"]',
        {state: 'visible', timeout: 10000},
    );

    // Check current state
    const isPanelVisible = await hierarchyPanel.isVisible();
    const isHamburgerVisible = await hamburgerButton.isVisible();

    if (!isPanelVisible && isHamburgerVisible) {
        // Panel is collapsed, hamburger is visible → click to open
        await hamburgerButton.click();
        await hierarchyPanel.waitFor({state: 'visible', timeout: 10000});
        await page.waitForTimeout(500);
    }
    // else: panel is already open, do nothing
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
    await editor.waitFor({state: 'attached', timeout: 5000});

    // # Fill page content in TipTap editor
    await editor.click({timeout: 10000, force: false});

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

    // # Wait for URL to change from draft to published page (navigation after publish)
    // URL pattern changes from: /wiki/{channelId}/{wikiId}/drafts/{draftId}
    // to: /wiki/{channelId}/{wikiId}/{pageId}
    await page.waitForURL(/\/wiki\/[^/]+\/[^/]+\/[^/]+$/, {timeout: 10000});

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

    // # Wait for loading screen to disappear (draft being loaded)
    await page.locator('.no-results__holder').waitFor({state: 'hidden', timeout: 5000}).catch(() => {
        // Loading screen might not appear if draft loads instantly
    });

    // # Wait for editor to appear (draft created and loaded)
    const editor = page.locator('.ProseMirror').first();
    await editor.waitFor({state: 'visible', timeout: 5000});
    await editor.waitFor({state: 'attached', timeout: 5000});

    // # Fill page content in TipTap editor
    await editor.click({timeout: 10000, force: false});

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

    // # Wait for URL to change from draft to published page (navigation after publish)
    // URL pattern changes from: /wiki/{channelId}/{wikiId}/drafts/{draftId}
    // to: /wiki/{channelId}/{wikiId}/{pageId}
    await page.waitForURL(/\/wiki\/[^/]+\/[^/]+\/[^/]+$/, {timeout: 10000});

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
    // # Get editor - try specific testid first, fall back to generic selector
    let editor = page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();
    if (!(await editor.isVisible({timeout: 1000}).catch(() => false))) {
        editor = page.locator('.ProseMirror').first();
    }

    await editor.click();
    await page.waitForTimeout(100);

    // # Ensure we're at the absolute end of the document by pressing Control+End (or Command+End on Mac)
    const isMac = process.platform === 'darwin';
    await page.keyboard.press(isMac ? 'Meta+ArrowDown' : 'Control+End');
    await page.waitForTimeout(200);

    // # Type the heading text directly using editor.type()
    await editor.type(text);
    await page.waitForTimeout(100);

    // # Select only the text we just typed by pressing Shift+ArrowLeft for each character
    // This ensures we don't select existing content in the editor
    for (let i = 0; i < text.length; i++) {
        await page.keyboard.press('Shift+ArrowLeft');
    }
    await page.waitForTimeout(500);

    // # Wait for the formatting bubble menu to appear
    const formattingBubble = page.locator('.formatting-bar-bubble').first();
    await formattingBubble.waitFor({state: 'visible', timeout: 10000});

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

    // # Wait for page to open in edit mode
    await waitForEditModeReady(page);

    // # Update title in editor
    const titleInput = page.locator('[data-testid="wiki-page-title-input"]').first();
    await titleInput.waitFor({state: 'visible', timeout: 5000});
    await titleInput.clear();
    await titleInput.fill(newTitle);

    // # Publish/Update the page
    const updateButton = page.locator('[data-testid="wiki-page-update-button"]').first();
    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]').first();

    const isUpdateVisible = await updateButton.isVisible().catch(() => false);
    if (isUpdateVisible) {
        await updateButton.click();
    } else {
        await publishButton.click();
    }

    // # Wait for save to complete
    await page.waitForLoadState('networkidle');

    // # Wait for view mode to load
    await waitForWikiViewLoad(page);
}

/**
 * Gets the page outline locator for a specific page in the hierarchy panel
 * The outline is a sibling of the page-tree-node, rendered in a draggable wrapper
 * @param page - Playwright page object
 * @param pageTitle - Title of the page to find the outline for
 * @returns Locator for the outline div
 */
export async function getPageOutlineInHierarchy(page: Page, pageTitle: string) {
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');
    const pageNode = hierarchyPanel.locator('[data-testid="page-tree-node"]').filter({hasText: pageTitle}).first();
    const draggableWrapper = pageNode.locator('..').first();
    return draggableWrapper.locator('[data-testid="page-outline"]').first();
}

/**
 * Shows the outline for a page using the context menu
 * @param page - Playwright page object
 * @param pageId - ID of the page to show outline for
 */
export async function showPageOutline(page: Page, pageId: string) {
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');
    const pageNode = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-page-id="${pageId}"]`).first();

    // Click menu button
    const menuButton = pageNode.locator('[data-testid="page-tree-node-menu-button"]').first();
    await menuButton.click();

    // Click "Show outline" button
    const contextMenu = page.locator('[data-testid="page-context-menu"]');
    await contextMenu.waitFor({state: 'visible', timeout: 3000});

    const showOutlineButton = contextMenu.locator('button:has-text("Show outline")').first();
    await showOutlineButton.waitFor({state: 'visible', timeout: 3000});
    await showOutlineButton.click();

    // Wait for Redux action and outline rendering
    await page.waitForTimeout(3000);
}

/**
 * Shows the outline for a page using right-click context menu
 * @param page - Playwright page object
 * @param pageTitle - Title of the page to show outline for
 */
export async function showPageOutlineViaRightClick(page: Page, pageTitle: string) {
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');
    const pageNode = hierarchyPanel.locator('[data-testid="page-tree-node"]').filter({hasText: pageTitle}).first();

    // Right-click to open context menu
    await pageNode.click({button: 'right'});

    // Click "Show outline" button
    const contextMenu = page.locator('[data-testid="page-context-menu"]');
    await contextMenu.waitFor({state: 'visible', timeout: 2000});

    const showOutlineButton = contextMenu.locator('button:has-text("Show Outline"), [data-testid="page-context-menu-show-outline"]').first();
    await showOutlineButton.waitFor({state: 'visible'});
    await showOutlineButton.click();

    // Wait for Redux action and outline rendering
    await page.waitForTimeout(500);
}

/**
 * Hides the outline for a page using the context menu
 * @param page - Playwright page object
 * @param pageId - ID of the page to hide outline for
 */
export async function hidePageOutline(page: Page, pageId: string) {
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');
    const pageNode = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-page-id="${pageId}"]`).first();

    // Click menu button
    const menuButton = pageNode.locator('[data-testid="page-tree-node-menu-button"]').first();
    await menuButton.click();

    // Click "Hide outline" button (or "Show outline" if currently hidden - it toggles)
    const contextMenu = page.locator('[data-testid="page-context-menu"]');
    await contextMenu.waitFor({state: 'visible', timeout: 3000});

    const hideOutlineButton = contextMenu.locator('button:has-text("Show outline"), button:has-text("Hide outline")').first();
    await hideOutlineButton.click();

    // Wait for Redux action
    await page.waitForTimeout(500);
}

/**
 * Verifies that an outline heading is visible in the hierarchy panel
 * @param page - Playwright page object
 * @param headingText - Text of the heading to verify
 * @param timeout - Optional timeout in milliseconds
 */
export async function verifyOutlineHeadingVisible(page: Page, headingText: string, timeout: number = 5000) {
    const headingNode = page.locator('[role="treeitem"]').filter({hasText: new RegExp(`^${headingText}$`)}).first();
    await headingNode.waitFor({state: 'visible', timeout});
}

/**
 * Clicks on an outline heading to navigate to it
 * @param page - Playwright page object
 * @param headingText - Text of the heading to click
 */
export async function clickOutlineHeading(page: Page, headingText: string) {
    const headingNode = page.locator('[role="treeitem"]').filter({hasText: new RegExp(`^${headingText}$`)}).first();
    await headingNode.waitFor({state: 'visible', timeout: 5000});
    await headingNode.click();
    await page.waitForTimeout(1000);
}

/**
 * Publishes the current page being edited
 * Waits for editor transactions to complete, triggers autosave, then publishes
 * @param page - Playwright page object
 */
export async function publishCurrentPage(page: Page) {
    // Wait for editor transactions to complete (including HeadingIdPlugin)
    await page.waitForTimeout(1000);

    // Click outside editor to ensure focus is lost and all pending transactions flush
    await page.locator('[data-testid="wiki-page-header"]').click();

    // Wait for autosave to complete (500ms debounce + extra buffer)
    await page.waitForTimeout(2000);

    // Click publish button
    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]');
    await publishButton.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
}

/**
 * Clears all content in the editor
 * @param page - Playwright page object
 */
export async function clearEditorContent(page: Page) {
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(200);
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
 * Waits for edit mode to be fully ready after clicking the Edit button
 * This ensures the draft is loaded with page_id and inline comments are enabled
 * @param page - Playwright page object
 * @param timeout - Optional timeout in milliseconds (default: 10000)
 */
export async function waitForEditModeReady(page: Page, timeout: number = 10000) {
    // # Wait for editor to be visible and editable
    const editor = page.locator('.ProseMirror').first();
    await editor.waitFor({state: 'visible', timeout});

    // # Wait for URL to change to draft mode
    await page.waitForURL(/\/drafts\//, {timeout});

    // # Wait for network to settle after draft creation
    await page.waitForLoadState('networkidle');

    // # Give the draft state time to sync with the correct page_id
    await page.waitForTimeout(1000);
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
    await page.waitForTimeout(300);

    // # Select all text using platform-aware keyboard shortcut
    await selectAllText(page);

    // # Wait longer for the formatting toolbar/comment button to appear after selection
    await page.waitForTimeout(1000);

    // # Wait for and click the inline comment button
    const commentButton = page.locator('button[aria-label*="comment"], [data-testid="inline-comment-submit"]').first();
    const buttonVisible = await commentButton.isVisible({timeout: 3000}).catch(() => false);

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

/**
 * Gets all wiki tab wrappers in the current channel
 * @param page - Playwright page object
 * @returns Locator for all wiki tab wrappers
 */
export function getAllWikiTabs(page: Page): Locator {
    return page.locator('.channel-tabs-container__tab-wrapper--wiki');
}

/**
 * Renames a wiki through the wiki tab menu using the rename modal
 * This is a more complete version that handles the actual modal interaction
 * @param page - Playwright page object
 * @param oldWikiName - Current name of the wiki
 * @param newWikiName - New name for the wiki
 */
export async function renameWikiThroughModal(page: Page, oldWikiName: string, newWikiName: string) {
    await openWikiTabMenu(page, oldWikiName);
    await clickWikiTabMenuItem(page, 'wiki-tab-rename');

    const renameModal = page.getByRole('dialog');
    await renameModal.waitFor({state: 'visible', timeout: 3000});

    const titleInput = renameModal.locator('#text-input-modal-input');
    await titleInput.clear();
    await titleInput.fill(newWikiName);

    const renameButton = renameModal.getByRole('button', {name: /rename/i});
    await renameButton.click();

    await renameModal.waitFor({state: 'hidden', timeout: 5000});
    await page.waitForTimeout(1000);
}

/**
 * Deletes a wiki through the wiki tab menu with confirmation
 * @param page - Playwright page object
 * @param wikiName - Name of the wiki to delete
 */
export async function deleteWikiThroughModalConfirmation(page: Page, wikiName: string) {
    await openWikiTabMenu(page, wikiName);
    await clickWikiTabMenuItem(page, 'wiki-tab-delete');

    const confirmModal = page.getByRole('dialog');
    await confirmModal.waitFor({state: 'visible', timeout: 3000});

    const confirmButton = confirmModal.getByRole('button', {name: /delete|yes/i});
    await confirmButton.click();

    await confirmModal.waitFor({state: 'hidden', timeout: 5000});
}

/**
 * Navigates back to a channel from the wiki view
 * @param page - Playwright page object
 * @param channelsPage - ChannelsPage object from the test browser
 * @param teamName - Name of the team
 * @param channelName - Name of the channel
 */
export async function navigateToChannelFromWiki(page: Page, channelsPage: any, teamName: string, channelName: string) {
    await channelsPage.goto(teamName, channelName);
    await page.waitForLoadState('networkidle');
}

/**
 * Verifies the wiki name appears in the breadcrumb
 * @param page - Playwright page object
 * @param wikiName - Expected wiki name to find in breadcrumb
 * @param timeout - Optional timeout in ms (default: 5000)
 */
export async function verifyWikiNameInBreadcrumb(page: Page, wikiName: string, timeout = 5000) {
    const breadcrumb = page.locator('[data-testid="breadcrumb"]').first();
    await expect(breadcrumb).toBeVisible({timeout});
    await expect(breadcrumb).toContainText(wikiName);
}

/**
 * Verifies navigation to wiki view by checking URL pattern
 * @param page - Playwright page object
 */
export async function verifyNavigatedToWiki(page: Page) {
    await expect(page).toHaveURL(/\/wiki\/[^/]+\/[^/]+/);
}

/**
 * Extracts wiki ID from current URL
 * @param page - Playwright page object
 * @returns Wiki ID or null if not found
 */
export function extractWikiIdFromUrl(page: Page): string | null {
    const url = page.url();
    const match = url.match(/\/wiki\/[^/]+\/([^/?]+)/);
    return match ? match[1] : null;
}

/**
 * Verifies that accessing a deleted wiki results in error or redirect
 * @param page - Playwright page object
 * @param channelName - Name of the channel to check for redirect
 */
export async function verifyWikiDeleted(page: Page, channelName: string) {
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const errorLocator = page.locator('text=/not found|error|doesn\'t exist/i');
    const isRedirected = page.url().includes(`/channels/${channelName}`) || !page.url().includes('/wiki/');

    if (!isRedirected) {
        await expect(errorLocator).toBeVisible({timeout: 5000});
    } else {
        expect(isRedirected).toBeTruthy();
    }
}

/**
 * Waits for a wiki tab to appear and be ready for interaction
 * @param page - Playwright page object
 * @param wikiName - Name of the wiki tab to wait for
 * @param timeout - Optional timeout in ms (default: 5000)
 */
export async function waitForWikiTab(page: Page, wikiName: string, timeout = 5000) {
    const wikiTab = getWikiTab(page, wikiName);
    await wikiTab.waitFor({state: 'visible', timeout});
    return wikiTab;
}

/**
 * Opens a wiki by clicking its tab in the channel tab bar
 * @param page - Playwright page object
 * @param wikiName - Name of the wiki to open
 */
export async function openWikiByTab(page: Page, wikiName: string) {
    const wikiTab = await waitForWikiTab(page, wikiName);
    await wikiTab.click();
}

/**
 * Moves a wiki to another channel through the wiki tab menu
 * @param page - Playwright page object
 * @param wikiName - Name of the wiki to move
 * @param targetChannelId - ID of the target channel
 */
export async function moveWikiToChannel(page: Page, wikiName: string, targetChannelId: string) {
    await openWikiTabMenu(page, wikiName);
    await clickWikiTabMenuItem(page, 'wiki-tab-move');

    const moveModal = page.getByRole('dialog');
    await moveModal.waitFor({state: 'visible', timeout: 3000});

    const channelSelect = moveModal.locator('#target-channel-select');
    await channelSelect.waitFor({state: 'visible', timeout: 3000});

    await page.waitForFunction(
        (selectId) => {
            const select = document.querySelector(`#${selectId}`) as HTMLSelectElement;
            return select && select.options.length > 1;
        },
        'target-channel-select',
        {timeout: 5000},
    );

    await channelSelect.selectOption({value: targetChannelId});

    const moveButton = moveModal.getByRole('button', {name: /move wiki/i});
    await moveButton.click();

    await moveModal.waitFor({state: 'hidden', timeout: 5000});
    await page.waitForLoadState('networkidle');
}

/**
 * Gets the breadcrumb locator
 * @param page - Playwright page object
 * @returns The breadcrumb locator
 */
export function getBreadcrumb(page: Page): Locator {
    return page.locator('[data-testid="breadcrumb"]').first();
}

/**
 * Verifies breadcrumb contains specific text
 * @param page - Playwright page object
 * @param expectedText - Text to find in breadcrumb
 * @param timeout - Optional timeout in ms (default: 5000)
 */
export async function verifyBreadcrumbContains(page: Page, expectedText: string, timeout = 5000) {
    const breadcrumb = getBreadcrumb(page);
    await expect(breadcrumb).toBeVisible({timeout});
    await expect(breadcrumb).toContainText(expectedText);
}

/**
 * Verifies breadcrumb does not contain specific text
 * @param page - Playwright page object
 * @param unexpectedText - Text that should not be in breadcrumb
 */
export async function verifyBreadcrumbDoesNotContain(page: Page, unexpectedText: string) {
    const breadcrumb = getBreadcrumb(page);
    const breadcrumbText = await breadcrumb.textContent();
    expect(breadcrumbText).not.toContain(unexpectedText);
}

/**
 * Gets the hierarchy panel locator
 * @param page - Playwright page object
 * @returns The hierarchy panel locator
 */
export function getHierarchyPanel(page: Page): Locator {
    return page.locator('[data-testid="pages-hierarchy-panel"]');
}

/**
 * Verifies hierarchy panel contains specific text
 * @param page - Playwright page object
 * @param expectedText - Text to find in hierarchy panel
 * @param timeout - Optional timeout in ms (default: 5000)
 */
export async function verifyHierarchyContains(page: Page, expectedText: string, timeout = 5000) {
    const hierarchyPanel = getHierarchyPanel(page);
    await expect(hierarchyPanel).toBeVisible({timeout});
    await expect(hierarchyPanel).toContainText(expectedText);
}

/**
 * Gets the page viewer content locator
 * @param page - Playwright page object
 * @returns The page viewer content locator
 */
export function getPageViewerContent(page: Page): Locator {
    return page.locator('[data-testid="page-viewer-content"]');
}

/**
 * Verifies page content contains specific text
 * @param page - Playwright page object
 * @param expectedText - Text to find in page content
 * @param timeout - Optional timeout in ms (default: 5000)
 */
export async function verifyPageContentContains(page: Page, expectedText: string, timeout = 5000) {
    const pageContent = getPageViewerContent(page);
    await expect(pageContent).toBeVisible({timeout});
    await expect(pageContent).toContainText(expectedText);
}

/**
 * Gets the TipTap editor locator
 * @param page - Playwright page object
 * @returns The TipTap editor locator
 */
export function getEditor(page: Page): Locator {
    return page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();
}

/**
 * Clicks edit button and waits for editor to be ready
 * @param page - Playwright page object
 * @param timeout - Optional timeout in ms (default: 5000)
 */
export async function enterEditMode(page: Page, timeout = 5000) {
    const editButton = page.locator('[data-testid="wiki-page-edit-button"]').first();
    await expect(editButton).toBeVisible({timeout});
    await editButton.click();

    const editor = getEditor(page);
    await editor.waitFor({state: 'visible', timeout});
}

/**
 * Clicks publish/save button and waits for completion
 * @param page - Playwright page object
 * @param isNewPage - Whether this is a new page (use publish button) or edit (use save button)
 */
export async function saveOrPublishPage(page: Page, isNewPage = false) {
    const button = isNewPage ?
        page.locator('[data-testid="wiki-page-publish-button"]') :
        page.locator('[data-testid="save-button"]').first();

    await expect(button).toBeVisible({timeout: 5000});
    await button.click();
    await page.waitForLoadState('networkidle');
}

/**
 * Closes the Wiki RHS if it's open
 * @param page - Playwright page object
 */
export async function closeWikiRHS(page: Page): Promise<void> {
    const rhs = page.locator('[data-testid="wiki-rhs"]');
    const isRhsVisible = await rhs.isVisible();
    if (isRhsVisible) {
        const closeButton = rhs.locator('[data-testid="wiki-rhs-close-button"]');
        if (await closeButton.isVisible()) {
            await closeButton.click();
            await expect(rhs).not.toBeVisible({timeout: 3000});
        }
    }
}

/**
 * Publishes a page by clicking the publish button and waiting for network idle
 * @param page - Playwright page object
 */
export async function publishPage(page: Page): Promise<void> {
    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]').first();
    await publishButton.click();
    await page.waitForLoadState('networkidle');
}

/**
 * Adds a reply to a comment thread in the Wiki RHS
 * @param page - Playwright page object
 * @param rhs - Wiki RHS locator
 * @param replyText - Text content of the reply
 */
export async function addReplyToCommentThread(page: Page, rhs: Locator, replyText: string): Promise<void> {
    const replyTextarea = rhs.locator('textarea[placeholder*="Reply"], textarea').first();
    await expect(replyTextarea).toBeVisible({timeout: 5000});
    await replyTextarea.fill(replyText);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
}

/**
 * Opens the Wiki RHS via the toggle comments button (shows Page Comments and All Threads tabs)
 * This is different from clicking a comment marker which opens a single thread view
 * @param page - Playwright page object
 * @returns The Wiki RHS locator
 */
export async function openWikiRHSViaToggleButton(page: Page): Promise<Locator> {
    const toggleCommentsButton = page.locator('[data-testid="wiki-page-toggle-comments"]');
    await expect(toggleCommentsButton).toBeVisible({timeout: 5000});
    await toggleCommentsButton.click();

    const rhs = page.locator('[data-testid="wiki-rhs"]');
    await expect(rhs).toBeVisible({timeout: 5000});

    return rhs;
}

/**
 * Switches to a specific tab in the Wiki RHS
 * @param page - Playwright page object
 * @param rhs - Wiki RHS locator
 * @param tabName - Name of the tab ('Page Comments' or 'All Threads')
 */
export async function switchToWikiRHSTab(page: Page, rhs: Locator, tabName: 'Page Comments' | 'All Threads'): Promise<void> {
    const tab = rhs.getByText(tabName, {exact: true});
    await expect(tab).toBeVisible();
    await tab.click();
    await page.waitForTimeout(500);
}

/**
 * Opens the move page modal via context menu and waits for it to be ready
 * @param page - Playwright page object
 * @param pageTitle - Title of the page to move
 * @returns The move modal locator
 */
export async function openMovePageModal(page: Page, pageTitle: string): Promise<Locator> {
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');
    const pageNode = hierarchyPanel.locator(`text="${pageTitle}"`).first();

    await expect(pageNode).toBeVisible();
    await pageNode.click({button: 'right'});

    const contextMenu = page.locator('[data-testid="page-context-menu"]');
    await expect(contextMenu).toBeVisible({timeout: 2000});

    const moveButton = contextMenu.locator('[data-testid="page-context-menu-move"], button:has-text("Move to Wiki"), button:has-text("Move to")').first();
    await expect(moveButton).toBeVisible();
    await moveButton.click();

    const moveModal = page.getByRole('dialog', {name: /Move/i});
    await expect(moveModal).toBeVisible({timeout: 3000});

    return moveModal;
}

/**
 * Selects a target page in the move modal and confirms the move
 * This helper ensures proper wait for modal close and navigation
 * Note: For selecting a target wiki, use the #target-wiki-select dropdown directly
 * @param page - Playwright page object
 * @param moveModal - The move modal locator
 * @param targetSelector - CSS selector for the target page (e.g., `[data-page-id="${id}"]`)
 */
export async function confirmMoveToTarget(page: Page, moveModal: Locator, targetSelector: string) {
    const targetOption = moveModal.locator(targetSelector).first();
    await targetOption.click();

    const confirmButton = moveModal.getByRole('button', {name: 'Move'});
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();

    // KEY: Wait for modal to close explicitly (pattern from passing test)
    await expect(moveModal).not.toBeVisible({timeout: 5000});
    await page.waitForLoadState('networkidle');
}

/**
 * Renames a page inline by double-clicking the page node title
 * @param page - Playwright page object
 * @param currentTitle - Current title of the page
 * @param newTitle - New title for the page
 */
export async function renamePageInline(page: Page, currentTitle: string, newTitle: string) {
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');

    // Find the page title button/span element more precisely
    // Try multiple selectors to find the clickable title element
    const titleElement = hierarchyPanel.locator(`button:has-text("${currentTitle}"), span:has-text("${currentTitle}")`).first();

    await expect(titleElement).toBeVisible();
    await titleElement.dblclick();
    await page.waitForTimeout(500);

    // Wait for inline input to appear - try to find it in the hierarchy panel
    const inlineInput = hierarchyPanel.locator('input[type="text"]').first();

    // Check if inline editing is actually supported
    const isInputVisible = await inlineInput.isVisible({timeout: 2000}).catch(() => false);

    if (!isInputVisible) {
        throw new Error(`Inline rename not available. The input field did not appear after double-clicking "${currentTitle}". This feature may not be implemented yet.`);
    }

    await expect(inlineInput).toHaveValue(currentTitle);

    // Type new name and press Enter
    await inlineInput.fill(newTitle);
    await inlineInput.press('Enter');

    await page.waitForLoadState('networkidle');
}

/**
 * Waits for search results to update after typing in search input
 * This accounts for debouncing in the search implementation
 * @param page - Playwright page object
 * @param timeout - Optional timeout in milliseconds (default: 1000)
 */
export async function waitForSearchDebounce(page: Page, timeout: number = 1000) {
    await page.waitForTimeout(timeout);
    await page.waitForLoadState('networkidle');
}

/**
 * Toggles the page outline visibility in the hierarchy panel
 * @param page - Playwright page object
 * @param pageId - ID of the page whose outline to toggle
 */
export async function togglePageOutline(page: Page, pageId: string) {
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');
    const pageNode = hierarchyPanel.locator(`[data-page-id="${pageId}"]`).first();

    const toggleButton = pageNode.locator('[data-testid="toggle-outline"], button[aria-label*="outline"]').first();
    await expect(toggleButton).toBeVisible();
    await toggleButton.click();
    await page.waitForTimeout(300);
}

// ============================================================================
// INLINE COMMENT HELPERS
// ============================================================================
/**
 * These helpers provide reusable patterns for testing inline comments functionality.
 * They encapsulate the reliable patterns that work consistently across tests.
 *
 * USAGE EXAMPLES:
 *
 * 1. Simple workflow - Add comment and verify:
 * ```typescript
 * await createPageThroughUI(page, 'Test Page', 'Some text');
 * await enterEditMode(page);
 * await addInlineCommentInEditMode(page, 'My comment');
 * // Publish...
 * const marker = await verifyCommentMarkerVisible(page);
 * const rhs = await clickCommentMarkerAndOpenRHS(page, marker);
 * await verifyWikiRHSContent(page, rhs, ['Some text', 'My comment']);
 * ```
 *
 * 2. Step-by-step workflow with more control:
 * ```typescript
 * await enterEditMode(page);
 * await selectTextInEditor(page, 'specific text');  // or omit to select first paragraph
 * const modal = await openInlineCommentModal(page);
 * await fillAndSubmitCommentModal(page, modal, 'Comment text');
 * // Publish and verify...
 * ```
 *
 * 3. Complete workflow with one helper:
 * ```typescript
 * await createPageThroughUI(page, 'Test Page', 'Some text');
 * await enterEditMode(page);
 * const marker = await addInlineCommentAndVerify(page, 'My comment');
 * if (marker) {
 *     const rhs = await clickCommentMarkerAndOpenRHS(page, marker);
 *     await verifyWikiRHSContent(page, rhs, ['Some text', 'My comment']);
 * }
 * ```
 */

/**
 * Selects text in the editor using triple-click (most reliable method)
 * @param page - Playwright page object
 * @param textContent - Optional specific text to find and select (defaults to first paragraph)
 */
export async function selectTextInEditor(page: Page, textContent?: string) {
    const editor = page.locator('.ProseMirror').first();

    let paragraph: Locator;
    if (textContent) {
        paragraph = editor.locator('p', {hasText: textContent}).first();
    } else {
        paragraph = editor.locator('p').first();
    }

    await paragraph.click({clickCount: 3});
    await page.waitForTimeout(500);
}

/**
 * Opens the inline comment modal from the formatting bar
 * @param page - Playwright page object
 * @returns The comment modal locator
 */
export async function openInlineCommentModal(page: Page): Promise<Locator> {
    // Wait for formatting bar bubble to appear
    const formattingBarBubble = page.locator('.formatting-bar-bubble');
    await expect(formattingBarBubble).toBeVisible({timeout: 3000});

    // Click "Add Comment" button from formatting bar
    const inlineCommentButton = formattingBarBubble.locator('button[title="Add Comment"]');
    await expect(inlineCommentButton).toBeVisible();
    await inlineCommentButton.click();
    await page.waitForTimeout(500);

    // Wait for and return the modal
    const commentModal = page.getByRole('dialog', {name: 'Add Comment'});
    await expect(commentModal).toBeVisible({timeout: 3000});

    return commentModal;
}

/**
 * Fills and submits the inline comment modal
 * @param page - Playwright page object
 * @param commentModal - The comment modal locator
 * @param commentText - Text to add as comment
 */
export async function fillAndSubmitCommentModal(page: Page, commentModal: Locator, commentText: string) {
    const textarea = commentModal.locator('textarea').first();
    await textarea.fill(commentText);

    const addButton = commentModal.locator('button:has-text("Comment")').first();
    await expect(addButton).toBeEnabled();
    await addButton.click();
}

/**
 * Adds an inline comment in edit mode using the formatting bar
 * This is the reliable pattern that works consistently across tests
 * @param page - Playwright page object
 * @param commentText - Comment text to add
 * @param textToSelect - Optional specific text to select (defaults to first paragraph)
 */
export async function addInlineCommentInEditMode(
    page: Page,
    commentText: string,
    textToSelect?: string,
) {
    // Select text in editor
    await selectTextInEditor(page, textToSelect);

    // Open comment modal
    const commentModal = await openInlineCommentModal(page);

    // Fill and submit
    await fillAndSubmitCommentModal(page, commentModal, commentText);
}

/**
 * Verifies that an inline comment marker is visible on the page
 * @param page - Playwright page object
 * @returns The comment marker locator
 */
export async function verifyCommentMarkerVisible(page: Page): Promise<Locator> {
    const commentMarker = page.locator('[data-inline-comment-marker], .inline-comment-marker, [data-comment-id]').first();
    await expect(commentMarker).toBeVisible({timeout: 5000});
    return commentMarker;
}

/**
 * Clicks a comment marker and waits for the wiki RHS to open
 * @param page - Playwright page object
 * @param commentMarker - The comment marker locator (optional - will find first marker if not provided)
 * @returns The wiki RHS locator
 */
export async function clickCommentMarkerAndOpenRHS(page: Page, commentMarker?: Locator): Promise<Locator> {
    const marker = commentMarker || await verifyCommentMarkerVisible(page);
    await marker.click();

    const rhs = page.locator('[data-testid="wiki-rhs"]');
    await expect(rhs).toBeVisible({timeout: 3000});
    await page.waitForTimeout(1000);

    return rhs;
}

/**
 * Verifies that the wiki RHS contains expected content
 * @param page - Playwright page object
 * @param rhs - The wiki RHS locator
 * @param expectedTexts - Array of text strings that should be present in the RHS
 */
export async function verifyWikiRHSContent(page: Page, rhs: Locator, expectedTexts: string[]) {
    for (const text of expectedTexts) {
        await expect(rhs).toContainText(text, {timeout: 5000});
    }
}

/**
 * Complete workflow: Add inline comment in edit mode, publish, and verify marker
 * This combines the most reliable patterns from working tests
 * @param page - Playwright page object
 * @param commentText - Comment text to add
 * @param textToSelect - Optional specific text to select (defaults to first paragraph)
 * @param publishAfter - Whether to publish after adding comment (default: true)
 * @returns The comment marker locator if successful
 */
export async function addInlineCommentAndVerify(
    page: Page,
    commentText: string,
    textToSelect?: string,
    publishAfter: boolean = true,
): Promise<Locator | null> {
    try {
        // Add the inline comment
        await addInlineCommentInEditMode(page, commentText, textToSelect);

        // Publish if requested
        if (publishAfter) {
            const publishButton = page.locator('[data-testid="wiki-page-publish-button"]').first();
            await publishButton.click();
            await page.waitForLoadState('networkidle');

            // Verify marker is visible after publish
            return await verifyCommentMarkerVisible(page);
        }

        return null;
    } catch (error) {
        console.error('Failed to add inline comment:', error);
        return null;
    }
}

/**
 * Opens a post dot menu (three dots) by hovering over the post and clicking the menu button
 * This is a generic helper that works for any post context (channel, RHS, threads, etc.)
 *
 * Key learnings from debugging:
 * - Must hover over [data-testid="postContent"] to reveal the menu button (not .post__header)
 * - Menu button has data-testid="PostDotMenu-Button-{postId}"
 * - Menu appears as MUI component with role="menu"
 *
 * @param page - Playwright page object
 * @param containerLocator - The container locator (e.g., page, rhs, thread viewer)
 * @param postSelector - Optional selector for the specific post (defaults to first post)
 */
export async function openPostDotMenu(
    page: Page,
    containerLocator: Locator,
    postSelector: string = '[data-testid="postContent"]'
): Promise<void> {
    // Wait for container to be ready
    await page.waitForTimeout(500);

    // Find the post content area - this is what needs to be hovered to reveal the menu
    const postContent = containerLocator.locator(postSelector).first();
    await expect(postContent).toBeVisible({timeout: 3000});

    // Hover over the post to reveal the dot menu button
    // The menu button only appears on hover
    await postContent.hover();
    await page.waitForTimeout(500);

    // Find and click the dot menu button
    // The button has data-testid="PostDotMenu-Button-{postId}"
    const dotMenuButton = containerLocator.locator('[data-testid^="PostDotMenu-Button-"]').first();
    await expect(dotMenuButton).toBeVisible({timeout: 3000});
    await dotMenuButton.click();

    // Wait for the dropdown menu to appear
    // The menu is rendered as a Material-UI menu with role="menu"
    await page.waitForTimeout(1000);
    const menu = page.locator('[role="menu"]').last();
    await expect(menu).toBeVisible({timeout: 5000});
}

/**
 * Selects a menu item from an open post dot menu
 * The menu must already be open (e.g., via openPostDotMenu or openCommentDotMenu)
 *
 * @param page - Playwright page object
 * @param menuItemSelector - Selector for the menu item (can use id, data-testid, or role-based selectors)
 * @param timeout - Optional timeout in milliseconds (default: 3000)
 *
 * @example
 * // Select by ID pattern
 * await selectPostDotMenuItem(page, '[id*="resolve_comment"]');
 *
 * @example
 * // Select by data-testid
 * await selectPostDotMenuItem(page, '[data-testid^="delete_post_"]');
 *
 * @example
 * // Select by role and name
 * await selectPostDotMenuItem(page, 'menuitem[role="menuitem"]', {name: /Edit/i});
 */
export async function selectPostDotMenuItem(
    page: Page,
    menuItemSelector: string,
    timeout: number = 3000
): Promise<void> {
    const menuItem = page.locator(menuItemSelector).first();
    await expect(menuItem).toBeVisible({timeout});
    await menuItem.click();
    await page.waitForTimeout(500);
}

/**
 * Opens the dot menu (three dots) for a comment post in the Wiki RHS
 * This is a convenience wrapper around openPostDotMenu for RHS comments
 * @param page - Playwright page object
 * @param rhs - The wiki RHS locator
 */
export async function openCommentDotMenu(page: Page, rhs: Locator): Promise<void> {
    await openPostDotMenu(page, rhs);
}

/**
 * Resolves or unresolves a page comment from the Wiki RHS
 * Opens the dot menu and clicks the resolve/unresolve option
 * @param page - Playwright page object
 * @param rhs - The wiki RHS locator
 */
export async function toggleCommentResolution(page: Page, rhs: Locator): Promise<void> {
    // Open the dot menu (which also waits for the modal to appear)
    await openCommentDotMenu(page, rhs);

    // The modal is now open and visible (verified by openCommentDotMenu)
    // Find the Resolve/Unresolve menu item
    // The menu item has id="resolve_comment_{postId}" or id="unresolve_comment_{postId}"
    const resolveMenuItem = page.locator(
        '[id*="resolve_comment"], ' +
        '[id*="unresolve_comment"], ' +
        '[data-testid*="resolve_comment"]'
    ).or(page.getByRole('menuitem', {name: /Resolve|Unresolve/i})).first();
    await expect(resolveMenuItem).toBeVisible({timeout: 3000});
    await resolveMenuItem.click();
    await page.waitForTimeout(500);
}

/**
 * Deletes a comment from the Wiki RHS by opening the dot menu and selecting delete
 * @param page - Playwright page object
 * @param rhs - The wiki RHS locator
 */
export async function deleteCommentFromRHS(page: Page, rhs: Locator): Promise<void> {
    // Open the dot menu
    await openCommentDotMenu(page, rhs);

    // Click Delete from the dropdown menu using the test ID
    // DotMenu renders delete button with data-testid="delete_post_{postId}"
    const deleteMenuItem = page.locator('[data-testid^="delete_post_"]').first();
    await expect(deleteMenuItem).toBeVisible({timeout: 3000});
    await deleteMenuItem.click();

    // Confirm deletion if modal appears
    const confirmDialog = page.getByRole('dialog', {name: /Delete|Confirm/i});
    await expect(confirmDialog).toBeVisible({timeout: 2000});
    const confirmButton = confirmDialog.locator('#deletePostModalButton');
    await expect(confirmButton).toBeVisible({timeout: 2000});
    await confirmButton.click();

    await page.waitForTimeout(500);
}

/**
 * Opens the page actions menu (three dot menu) in the wiki page header
 * @param page - Playwright page object
 * @param timeout - Optional timeout in milliseconds (default: 5000)
 * @returns The page context menu locator
 */
export async function openPageActionsMenu(page: Page, timeout: number = 5000): Promise<Locator> {
    const actionsButton = page.locator('[data-testid="wiki-page-more-actions"]');
    await actionsButton.waitFor({state: 'visible', timeout});
    await actionsButton.click();

    const contextMenu = page.locator('[data-testid="page-context-menu"]');
    await contextMenu.waitFor({state: 'visible', timeout: 3000});

    return contextMenu;
}

/**
 * Clicks a specific menu item in the page context menu
 * @param page - Playwright page object
 * @param menuItemId - The ID of the menu item (e.g., 'delete', 'move', 'rename')
 */
export async function clickPageContextMenuItem(page: Page, menuItemId: string) {
    const menuItem = page.locator(`[data-testid="page-context-menu-${menuItemId}"]`);
    await menuItem.waitFor({state: 'visible', timeout: 3000});
    await menuItem.click();
}

/**
 * Waits for the page viewer content to load and be visible
 * Useful for verifying a published page has loaded after navigation or publish
 * @param page - Playwright page object
 * @param timeout - Optional timeout in milliseconds (default: 10000)
 */
export async function waitForPageViewerLoad(page: Page, timeout: number = 10000) {
    const pageViewer = page.locator('[data-testid="page-viewer-content"]');
    await pageViewer.waitFor({state: 'visible', timeout});
}

/**
 * Creates a wiki and a page in one operation
 * This is a common setup pattern used in most comment tests
 * @param page - Playwright page object
 * @param wikiName - Name for the wiki
 * @param pageTitle - Title for the page
 * @param pageContent - Content for the page (default: empty string)
 * @returns Object containing the created wiki and page
 */
export async function createWikiAndPage(
    page: Page,
    wikiName: string,
    pageTitle: string,
    pageContent: string = ''
) {
    const wiki = await createWikiThroughUI(page, wikiName);
    const testPage = await createPageThroughUI(page, pageTitle, pageContent);
    return {wiki, page: testPage};
}

/**
 * Complete setup for comment testing: creates wiki, page, adds inline comment, and publishes
 * This composite helper is specifically designed for resolve/unresolve tests
 * When this test passes, all resolve/unresolve tests using it will have a working baseline
 *
 * @param page - Playwright page object
 * @param wikiName - Name for the wiki
 * @param pageTitle - Title for the page
 * @param pageContent - Content for the page
 * @param commentText - Text for the inline comment
 * @returns Object containing wiki, page, and comment marker locator
 *
 * @example
 * const {marker} = await setupPageWithComment(
 *   page,
 *   'Test Wiki',
 *   'Test Page',
 *   'Some content',
 *   'Needs review'
 * );
 */
export async function setupPageWithComment(
    page: Page,
    wikiName: string,
    pageTitle: string,
    pageContent: string,
    commentText: string
) {
    // Create wiki and page
    const {wiki, page: testPage} = await createWikiAndPage(page, wikiName, pageTitle, pageContent);

    // Enter edit mode and add inline comment with publish
    await enterEditMode(page);
    const marker = await addInlineCommentAndVerify(page, commentText, undefined, true);

    return {wiki, page: testPage, marker};
}
