// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page, Locator} from '@playwright/test';
import {expect} from '@playwright/test';
import type {Client4} from '@mattermost/client';
import type {Channel} from '@mattermost/types/channels';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {createRandomUser} from '@mattermost/playwright-lib';

/**
 * Standard wait times for page operations
 */
export const UI_MICRO_WAIT = 100; // Very short wait for micro UI updates (100-300ms)
export const SHORT_WAIT = 500; // Short wait for UI updates
export const EDITOR_LOAD_WAIT = 1000; // Wait for editor to load
export const AUTOSAVE_WAIT = 2000; // Wait for auto-save to complete (500ms debounce + buffer)
export const MODAL_CLOSE_TIMEOUT = 2000; // Timeout for modal to close after user action (should be prompt)
export const WEBSOCKET_WAIT = 3000; // Wait for WebSocket message to propagate
export const ELEMENT_TIMEOUT = 5000; // Standard timeout for element visibility (modals, dropdowns, panels, indicators)
export const HIERARCHY_TIMEOUT = 10000; // Timeout for hierarchy panel operations
export const PAGE_LOAD_TIMEOUT = 15000; // Timeout for full page load operations
export const DRAG_ANIMATION_WAIT = 1500; // Wait for drag-and-drop animations to complete
export const STALE_CLEANUP_TIMEOUT = 65000; // Timeout for stale editor cleanup (60s + buffer)

/**
 * Valid page status values - mirrors server/public/model/wiki.go constants.
 * These are stored directly in the backend as human-readable values.
 */
export const PAGE_STATUSES = ['Rough draft', 'In progress', 'In review', 'Done'] as const;

/**
 * Default page status for newly published pages.
 * Maps to PageStatusInProgress from server/public/model/wiki.go
 */
export const DEFAULT_PAGE_STATUS = 'In progress' as const;

/**
 * Maximum allowed nesting depth for page hierarchy
 */
export const MAX_PAGE_DEPTH = 10;

// ============================================================================
// TipTap Content Builders
// ============================================================================

/**
 * Creates a simple TipTap document with a single paragraph
 * @param text - The text content for the paragraph
 * @returns TipTap document structure
 */
export function createPageContent(text: string) {
    return {
        type: 'doc' as const,
        content: [
            {
                type: 'paragraph',
                content: [{type: 'text', text}],
            },
        ],
    };
}

/**
 * Creates a TipTap heading node
 * @param level - Heading level (1-6)
 * @param text - The heading text
 * @returns TipTap heading node
 */
export function createHeadingNode(level: 1 | 2 | 3 | 4 | 5 | 6, text: string) {
    return {
        type: 'heading',
        attrs: {level},
        content: [{type: 'text', text}],
    };
}

/**
 * Creates a TipTap paragraph node
 * @param text - The paragraph text
 * @returns TipTap paragraph node
 */
export function createParagraphNode(text: string) {
    return {
        type: 'paragraph',
        content: [{type: 'text', text}],
    };
}

/**
 * Creates a TipTap bullet list node
 * @param items - Array of text items for the list
 * @returns TipTap bulletList node
 */
export function createBulletListNode(items: string[]) {
    return {
        type: 'bulletList',
        content: items.map((text) => ({
            type: 'listItem',
            content: [
                {
                    type: 'paragraph',
                    content: [{type: 'text', text}],
                },
            ],
        })),
    };
}

/**
 * Creates a TipTap document with rich content (heading, paragraph, bullet list)
 * @param heading - The heading text
 * @param paragraph - The paragraph text
 * @param bulletItems - Array of bullet list items
 * @returns TipTap document structure with rich content
 */
export function createRichPageContent(heading: string, paragraph: string, bulletItems: string[]) {
    return {
        type: 'doc' as const,
        content: [createHeadingNode(1, heading), createParagraphNode(paragraph), createBulletListNode(bulletItems)],
    };
}

/**
 * Generates a unique name with a timestamp suffix.
 * Use this instead of `pw.random.id()` to avoid async/await issues.
 * @param prefix - The prefix for the name (e.g., 'Test Wiki', 'Test Channel')
 * @returns A unique string like 'Test Wiki 1733789234567'
 */
export function uniqueName(prefix: string): string {
    return `${prefix} ${Date.now()}`;
}

/**
 * Gets a locator for the page actions menu (dropdown menu from the 3-dot button)
 * Use this instead of hardcoded selectors to ensure consistency across tests
 * @param page - Playwright page object
 * @param pageId - Optional page ID for a specific menu (uses prefix match if not provided)
 * @returns Locator for the page actions menu
 */
export function getPageActionsMenuLocator(page: Page, pageId?: string): Locator {
    if (pageId) {
        // The menu element itself has the id, so use a direct locator
        return page.locator(`#page-actions-menu-${pageId}`);
    }
    return page.getByRole('menu', {name: 'Page actions'});
}

/**
 * Opens the page actions menu for a page node in the hierarchy panel
 * @param page - Playwright page object
 * @param pageNode - Locator for the page tree node
 * @returns Locator for the opened page actions menu
 */
export async function openHierarchyNodeActionsMenu(page: Page, pageNode: Locator): Promise<Locator> {
    await pageNode.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

    // Hover over page node to make menu button visible
    await pageNode.hover();

    // Click menu button to open context menu
    const menuButton = pageNode.locator('[data-testid="page-tree-node-menu-button"]');
    await menuButton.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    await menuButton.click();

    // Wait for context menu to render
    const contextMenu = getPageActionsMenuLocator(page);
    await contextMenu.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

    return contextMenu;
}

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
 * Extracts the page ID from a wiki URL
 * Handles both draft URLs (/:team/wiki/:channelId/:wikiId/drafts/:draftId)
 * and published URLs (/:team/wiki/:channelId/:wikiId/:pageId)
 * @param url - The URL to extract the page ID from
 * @returns The page ID or null if not found
 */
export function getPageIdFromUrl(url: string): string | null {
    // Try draft URL pattern first: /wiki/:channelId/:wikiId/drafts/:draftId
    const draftMatch = url.match(/\/wiki\/[^/]+\/[^/]+\/drafts\/([^/?]+)/);
    if (draftMatch) {
        return draftMatch[1];
    }

    // Try published URL pattern: /wiki/:channelId/:wikiId/:pageId
    const publishedMatch = url.match(/\/wiki\/[^/]+\/[^/]+\/([^/?]+)$/);
    if (publishedMatch) {
        return publishedMatch[1];
    }

    return null;
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
 * @param type - Channel type: 'O' for open/public (default), 'P' for private
 * @returns The created channel
 */
export async function createTestChannel(
    client: Client4,
    teamId: string,
    channelName: string,
    type: 'O' | 'P' = 'O',
    userIds?: string[],
): Promise<Channel> {
    const timestamp = Date.now();
    const uniqueName = `${channelName}-${timestamp}`;
    const channel = await client.createChannel({
        team_id: teamId,
        name: uniqueName.toLowerCase().replace(/[^a-z0-9-_]/g, '-'),
        display_name: uniqueName,
        type,
    });

    if (userIds) {
        for (const userId of userIds) {
            await client.addToChannel(userId, channel.id);
        }
    }

    return channel;
}

/**
 * Creates a test user and adds them to a team (but not a channel)
 * @param pw - Playwright test context with random.user utility
 * @param adminClient - Client4 instance with admin permissions
 * @param team - Team object with id
 * @param username - Optional username prefix (defaults to 'user')
 * @returns Object containing the created user and userId
 */
export async function createTestUserInTeam(pw: any, adminClient: Client4, team: {id: string}, username?: string) {
    const userData = await createRandomUser(username || 'user');
    const user = await adminClient.createUser(userData, '', '');
    user.password = userData.password;
    await adminClient.addToTeam(team.id, user.id);
    return {user, userId: user.id};
}

/**
 * Creates a test user and adds them to a team and channel
 * @param pw - Playwright test context with random.user utility
 * @param adminClient - Client4 instance with admin permissions
 * @param team - Team object with id
 * @param channel - Channel object with id
 * @param username - Optional username prefix (defaults to 'user')
 * @returns Object containing the created user and userId
 */
export async function createTestUserInChannel(
    pw: any,
    adminClient: Client4,
    team: {id: string},
    channel: {id: string},
    username?: string,
) {
    const userData = await createRandomUser(username || 'user');
    const user = await adminClient.createUser(userData, '', '');
    user.password = userData.password;
    await adminClient.addToTeam(team.id, user.id);
    await adminClient.addToChannel(user.id, channel.id);
    return {user, userId: user.id};
}

/**
 * Creates multiple test users and adds them to a team and channel
 * @param pw - Playwright test context with random.user utility
 * @param adminClient - Client4 instance with admin permissions
 * @param team - Team object with id
 * @param channel - Channel object with id
 * @param count - Number of users to create
 * @param prefix - Optional username prefix (defaults to 'user')
 * @returns Array of objects containing created users and userIds
 */
export async function createMultipleTestUsersInChannel(
    pw: any,
    adminClient: Client4,
    team: {id: string},
    channel: {id: string},
    count: number,
    prefix: string = 'user',
) {
    const users = [];
    for (let i = 0; i < count; i++) {
        const result = await createTestUserInChannel(pw, adminClient, team, channel, `${prefix}${i}`);
        users.push(result);
    }
    return users;
}

/**
 * Common test setup: creates a channel, logs in, navigates to channel, and creates a wiki.
 * Reduces boilerplate in tests that need a wiki in a fresh channel.
 *
 * @param pw - Playwright test context
 * @param sharedPagesSetup - The fixture providing team, user, and adminClient
 * @param wikiNamePrefix - Prefix for wiki name (will be made unique with timestamp)
 * @param channelNamePrefix - Prefix for channel name (will be made unique internally)
 * @returns Object with page, channelsPage, channel, and wiki
 *
 * @example
 * const {page, channel, wiki} = await setupWikiInChannel(pw, sharedPagesSetup, 'Test Wiki');
 */
export async function setupWikiInChannel(
    pw: {testBrowser: {login: (user: UserProfile) => Promise<{page: Page; channelsPage: any}>}},
    sharedPagesSetup: {team: Team; user: UserProfile; adminClient: Client4},
    wikiNamePrefix: string = 'Test Wiki',
    channelNamePrefix: string = 'Test Channel',
): Promise<{page: Page; channelsPage: any; channel: Channel; wiki: {id: string; title: string}}> {
    const {team, user, adminClient} = sharedPagesSetup;

    const channel = await createTestChannel(adminClient, team.id, channelNamePrefix);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    const wiki = await createWikiThroughUI(page, uniqueName(wikiNamePrefix));

    return {page, channelsPage, channel, wiki};
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
    await modalInput.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

    // # Fill in page title
    await modalInput.fill(pageTitle);

    // # Wait for the Create button to be ready and click it
    const createButton = page.getByRole('button', {name: 'Create'});
    await createButton.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    await createButton.waitFor({state: 'attached', timeout: ELEMENT_TIMEOUT});

    // Small delay to ensure the input is fully processed
    await page.waitForTimeout(SHORT_WAIT / 5);

    await createButton.click();

    // # Wait for modal to close (longer timeout as it waits for draft creation and navigation)
    await modalInput.waitFor({state: 'hidden', timeout: HIERARCHY_TIMEOUT + 5000});
}

/**
 * Opens the page link modal using the keyboard shortcut (Ctrl+L or Cmd+L on Mac)
 * @param editor - The editor locator (ProseMirror element)
 * @returns The link modal locator
 */
export async function openPageLinkModal(editor: Locator): Promise<Locator> {
    const modifierKey = getModifierKey();
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
    await editor.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

    // Type some text and select it (required for link insertion)
    await editor.click();
    await editor.pressSequentially('test text', {delay: 10});
    await pressModifierKey(page, 'a');

    // Use keyboard shortcut Mod-L to open link modal (more reliable than bubble menu)
    await pressModifierKey(page, 'l');

    // Wait for the link modal to appear
    const linkModal = page.locator('[data-testid="page-link-modal"]').first();
    await linkModal.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

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

    // # Wait for channel to be fully loaded by checking for the post list or center channel
    // This ensures the app has finished initializing and is showing the channel content
    try {
        await page
            .locator('#centerChannelFooter, #postListContent, #post-list')
            .first()
            .waitFor({state: 'visible', timeout: HIERARCHY_TIMEOUT + 5000});
    } catch {
        // If none of the typical channel elements are visible, wait a bit and continue
        // (may be an empty channel or different UI state)
        await page.waitForTimeout(WEBSOCKET_WAIT);
    }

    // # Wait for the channel tabs container to be visible first
    await page.locator('.channel-tabs-container').waitFor({state: 'visible', timeout: HIERARCHY_TIMEOUT + 5000});

    // # Click the "+" button in the channel tabs to open the add content menu
    const addContentButton = page.locator('#add-tab-content');
    await addContentButton.waitFor({state: 'visible', timeout: HIERARCHY_TIMEOUT + 5000});
    await addContentButton.click();

    // # Click "Wiki" option from the dropdown menu
    const addWikiMenuItem = page.getByText('Wiki', {exact: true});
    await addWikiMenuItem.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    await addWikiMenuItem.click();

    // # Fill wiki name in modal
    const wikiNameInput = page.locator('#text-input-modal-input');
    await wikiNameInput.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    await wikiNameInput.fill(wikiName);

    // # Click Create button - wait for it to be enabled after input fills
    const createButton = page.getByRole('button', {name: 'Create'});
    await expect(createButton).toBeEnabled({timeout: ELEMENT_TIMEOUT});
    await createButton.click();

    // # Wait for navigation to wiki page (not just network idle)
    await page.waitForURL(/\/wiki\/[^/]+\/[^/]+/, {timeout: HIERARCHY_TIMEOUT});
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
 * Handles several scenarios to ensure robust waiting:
 * 1. Component mounting/unmounting during route transitions - Playwright's
 *    waitFor with 'visible' state automatically retries, handling transient states
 * 2. Loading states - waits for loading indicator to disappear if present
 * 3. Async rendering - small delay ensures hierarchy panels have settled
 */
export async function waitForWikiViewLoad(page: Page, timeout = 60000) {
    const wikiView = page.locator('[data-testid="wiki-view"]');

    // Wait for the wiki view to be visible with retries to handle any temporary unmounts
    await wikiView.waitFor({state: 'visible', timeout});

    // Wait for loading to complete by ensuring loading indicator is not visible
    // This handles race conditions where loading indicator appears after initial check
    const loadingLocator = page.locator('[data-testid="wiki-view-loading"]');

    // Wait for the loading indicator to be detached/hidden
    // Use 'detached' state which covers both "hidden" and "not in DOM" cases
    // This properly handles:
    // 1. Loading indicator never appears (immediate detached state)
    // 2. Loading indicator currently visible (waits for it to be removed)
    // 3. Loading indicator appears briefly then disappears (waits for detachment)
    await loadingLocator.waitFor({state: 'detached', timeout: timeout}).catch(async () => {
        // If still attached after timeout, check if it's at least hidden
        const isStillVisible = await loadingLocator.isVisible().catch(() => false);
        if (isStillVisible) {
            throw new Error('Wiki loading indicator is still visible after timeout');
        }
        // Loading indicator is attached but hidden, which is acceptable
    });

    // Small extra delay to give the hierarchy panel and other async tasks time
    // to settle before the caller continues with more specific assertions.
    await page.waitForTimeout(SHORT_WAIT);
}

/**
 * Navigates to a wiki view and waits for it to load
 * @param page - Playwright page object
 * @param baseUrl - Base URL (e.g., pw.url)
 * @param teamName - Team name
 * @param channelId - Channel ID
 * @param wikiId - Wiki ID
 */
export async function navigateToWikiView(
    page: Page,
    baseUrl: string,
    teamName: string,
    channelId: string,
    wikiId: string,
) {
    await page.goto(`${baseUrl}/${teamName}/wiki/${channelId}/${wikiId}`);
    await page.waitForLoadState('networkidle');
    await waitForWikiViewLoad(page);
}

/**
 * Navigates to a specific page in a wiki
 * @param page - Playwright page object
 * @param baseUrl - Base URL (pw.url)
 * @param teamName - Team name
 * @param channelId - Channel ID (not name!)
 * @param wikiId - Wiki ID
 * @param pageId - Page ID to navigate to
 */
export async function navigateToPage(
    page: Page,
    baseUrl: string,
    teamName: string,
    channelId: string,
    wikiId: string,
    pageId: string,
) {
    const url = `${baseUrl}/${teamName}/wiki/${channelId}/${wikiId}/${pageId}`;
    await page.goto(url);

    // Use a longer timeout (60s) to debug potential timing issues with multi-user tests
    await page.waitForLoadState('networkidle', {timeout: 60000});

    // Wait for wiki view and page to load
    await waitForWikiViewLoad(page);

    const pageViewer = page.locator('[data-testid="page-viewer-content"]');
    await pageViewer.waitFor({state: 'visible', timeout: HIERARCHY_TIMEOUT});
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
export function buildWikiPageUrl(
    baseUrl: string,
    teamName: string,
    channelId: string,
    wikiId: string,
    pageId?: string,
): string {
    const basePath = `${baseUrl}/${teamName}/wiki/${channelId}/${wikiId}`;
    return pageId ? `${basePath}/${pageId}` : basePath;
}

/**
 * Constructs a channel URL
 * Matches the URL pattern: /:team/channels/:channelName
 * @param baseUrl - Base URL (e.g., pw.url)
 * @param teamName - Team name
 * @param channelName - Channel name (not channel ID)
 * @returns Full URL to the channel
 */
export function buildChannelUrl(baseUrl: string, teamName: string, channelName: string): string {
    return `${baseUrl}/${teamName}/channels/${channelName}`;
}

/**
 * Constructs a channel page URL (wiki page accessed via channel route)
 * Matches the URL pattern: /:team/channels/:channelName/wikis/:wikiId/pages/:pageId
 * @param baseUrl - Base URL (e.g., pw.url)
 * @param teamName - Team name
 * @param channelName - Channel name (not channel ID)
 * @param wikiId - Wiki ID
 * @param pageId - Page ID
 * @returns Full URL to the page via channel route
 */
export function buildChannelPageUrl(
    baseUrl: string,
    teamName: string,
    channelName: string,
    wikiId: string,
    pageId: string,
): string {
    return `${baseUrl}/${teamName}/channels/${channelName}/wikis/${wikiId}/pages/${pageId}`;
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
    await page.waitForSelector('[data-testid="pages-hierarchy-panel"], [data-testid="wiki-view-hamburger-button"]', {
        state: 'visible',
        timeout: HIERARCHY_TIMEOUT,
    });

    // Check current state
    const isPanelVisible = await hierarchyPanel.isVisible();
    const isHamburgerVisible = await hamburgerButton.isVisible();

    if (!isPanelVisible && isHamburgerVisible) {
        // Panel is collapsed, hamburger is visible → click to open
        await hamburgerButton.click();
        await hierarchyPanel.waitFor({state: 'visible', timeout: HIERARCHY_TIMEOUT});
        await page.waitForTimeout(SHORT_WAIT);
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
    await newPageButton.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    await newPageButton.click();

    // # Fill in modal and create page
    await fillCreatePageModal(page, pageTitle);

    // # Wait for editor to appear (draft created and loaded)
    const editor = page.locator('.ProseMirror').first();
    await editor.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    await editor.waitFor({state: 'attached', timeout: ELEMENT_TIMEOUT});

    // # Fill page content in TipTap editor using real user interaction
    await editor.click({timeout: HIERARCHY_TIMEOUT, force: false});
    await page.waitForTimeout(SHORT_WAIT * 0.6);

    // Type content using real keyboard input (tests actual user interaction)
    if (pageContent) {
        await page.keyboard.type(pageContent);
    }

    // Wait for content to be typed and registered
    await page.waitForTimeout(SHORT_WAIT * 0.6);

    // Wait for auto-save to complete (500ms debounce + network + buffer)
    await page.waitForTimeout(AUTOSAVE_WAIT * 0.75);

    // Verify content was actually entered (skip validation for whitespace-only content)
    const enteredText = await editor.textContent();
    const contentIsWhitespaceOnly = pageContent.trim() === '';
    if (!contentIsWhitespaceOnly && !enteredText?.includes(pageContent)) {
        throw new Error(`Content not entered correctly. Expected: "${pageContent}", Got: "${enteredText}"`);
    }

    // # Publish the page
    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]');

    // Verify button is visible and enabled before clicking
    await publishButton.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    const isEnabled = await publishButton.isEnabled();
    if (!isEnabled) {
        throw new Error('Publish button is disabled - cannot publish');
    }

    await publishButton.click();

    // # Wait for URL to change from draft to published page (navigation after publish)
    // URL pattern changes from: /wiki/{channelId}/{wikiId}/drafts/{draftId}
    // to: /wiki/{channelId}/{wikiId}/{pageId}
    // Regex allows optional query string or hash at the end
    await page.waitForURL(/\/wiki\/[^/]+\/[^/]+\/[^/]+(?:[?#]|$)/, {timeout: PAGE_LOAD_TIMEOUT});

    // # Wait for navigation and network to settle after publish
    await page.waitForLoadState('networkidle');

    // # Wait for page viewer to appear (means publish succeeded and page loaded)
    const pageViewer = page.locator('[data-testid="page-viewer-content"]');
    await pageViewer.waitFor({state: 'visible', timeout: PAGE_LOAD_TIMEOUT * 2});

    // Extract page ID from URL pattern: /:teamName/wiki/:channelId/:wikiId/:pageId
    const url = page.url();
    const pageId = getPageIdFromUrl(url);

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
    await page
        .locator('.no-results__holder')
        .waitFor({state: 'hidden', timeout: ELEMENT_TIMEOUT})
        .catch(() => {
            // Loading screen might not appear if draft loads instantly
        });

    // # Wait for editor to appear (draft created and loaded)
    const editor = page.locator('.ProseMirror').first();
    await editor.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    await editor.waitFor({state: 'attached', timeout: ELEMENT_TIMEOUT});

    // # Fill page content in TipTap editor using real user interaction
    await editor.click({timeout: HIERARCHY_TIMEOUT, force: false});
    await page.waitForTimeout(SHORT_WAIT * 0.6);

    // Type content using real keyboard input (tests actual user interaction)
    if (pageContent) {
        await page.keyboard.type(pageContent);
    }

    // Wait for content to be typed and registered
    await page.waitForTimeout(SHORT_WAIT * 0.6);

    // Wait for auto-save to complete (500ms debounce + network + buffer)
    await page.waitForTimeout(AUTOSAVE_WAIT * 0.75);

    // Verify content was actually entered (skip validation for whitespace-only content)
    const enteredText = await editor.textContent();
    const contentIsWhitespaceOnly = pageContent.trim() === '';
    if (!contentIsWhitespaceOnly && !enteredText?.includes(pageContent)) {
        throw new Error(`Content not entered correctly. Expected: "${pageContent}", Got: "${enteredText}"`);
    }

    // # Publish the page
    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]');

    // Verify button is visible and enabled before clicking
    await publishButton.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    const isEnabled = await publishButton.isEnabled();
    if (!isEnabled) {
        throw new Error('Publish button is disabled - cannot publish');
    }

    await publishButton.click();

    // # Wait for URL to change from draft to published page (navigation after publish)
    // URL pattern changes from: /wiki/{channelId}/{wikiId}/drafts/{draftId}
    // to: /wiki/{channelId}/{wikiId}/{pageId}
    // Regex allows optional query string or hash at the end
    await page.waitForURL(/\/wiki\/[^/]+\/[^/]+\/[^/]+(?:[?#]|$)/, {timeout: PAGE_LOAD_TIMEOUT});

    // # Wait for navigation and network to settle after publish
    await page.waitForLoadState('networkidle');

    // # Wait for page viewer to appear (means publish succeeded and page loaded)
    const pageViewer = page.locator('[data-testid="page-viewer-content"]');
    await pageViewer.waitFor({state: 'visible', timeout: PAGE_LOAD_TIMEOUT * 2});

    // Extract page ID from URL pattern: /:teamName/wiki/:channelId/:wikiId/:pageId
    const url = page.url();
    const pageId = getPageIdFromUrl(url);

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
    if (!(await editor.isVisible({timeout: EDITOR_LOAD_WAIT}).catch(() => false))) {
        editor = page.locator('.ProseMirror').first();
    }

    await editor.click();
    await page.waitForTimeout(SHORT_WAIT / 5);

    // # Ensure we're at the absolute end of the document by pressing Control+End (or Command+End on Mac)
    const isMac = process.platform === 'darwin';
    await page.keyboard.press(isMac ? 'Meta+ArrowDown' : 'Control+End');
    await page.waitForTimeout(SHORT_WAIT / 2.5);

    // # Type the heading text directly using editor.type()
    await editor.type(text);
    await page.waitForTimeout(SHORT_WAIT / 5);

    // # Select only the text we just typed by pressing Shift+ArrowLeft for each character
    // This ensures we don't select existing content in the editor
    for (let i = 0; i < text.length; i++) {
        await page.keyboard.press('Shift+ArrowLeft');
    }
    await page.waitForTimeout(SHORT_WAIT);

    // # Wait for the formatting bubble menu to appear
    const formattingBubble = page.locator('.formatting-bar-bubble').first();
    await formattingBubble.waitFor({state: 'visible', timeout: HIERARCHY_TIMEOUT});

    // # Find and click the heading button
    const headingButton = formattingBubble.locator(`button[title="Heading ${level}"]`).first();
    await headingButton.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    // Use force:true to click through the inline-comment-bubble overlay
    await headingButton.click({force: true});
    await page.waitForTimeout(SHORT_WAIT / 2.5);

    // # Press Right arrow to deselect and move cursor to end of heading
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(SHORT_WAIT / 10);

    // # Only press Enter and add content if we have content - this prevents creating empty heading nodes
    if (addContentAfter) {
        await page.keyboard.press('Enter');
        await page.waitForTimeout(SHORT_WAIT / 5);
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
export async function waitForPageInHierarchy(page: Page, pageTitle: string, timeout: number = ELEMENT_TIMEOUT) {
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]').first();
    const pageButton = hierarchyPanel.getByRole('button', {name: pageTitle, exact: true});
    await pageButton.waitFor({state: 'visible', timeout});
}

/**
 * Clicks a page in the hierarchy panel to navigate to it
 * Waits for the page to be visible in hierarchy, then clicks it and waits for page viewer to load
 * @param page - Playwright page object
 * @param pageTitle - Title of the page to click
 * @param timeout - Optional timeout in milliseconds (default: 5000)
 */
export async function clickPageInHierarchy(page: Page, pageTitle: string, timeout: number = ELEMENT_TIMEOUT) {
    await waitForPageInHierarchy(page, pageTitle, timeout);
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]').first();
    const pageButton = hierarchyPanel.getByRole('button', {name: pageTitle, exact: true});
    await pageButton.click();

    // Wait for page viewer to load
    const viewerContent = page.locator('[data-testid="page-viewer-content"]');
    await viewerContent.waitFor({state: 'visible', timeout: HIERARCHY_TIMEOUT});
}

/**
 * Renames a page via the page actions menu
 * @param page - Playwright page object
 * @param currentTitle - Current title of the page to rename
 * @param newTitle - New title for the page
 */
export async function renamePageViaContextMenu(page: Page, currentTitle: string, newTitle: string) {
    // # Open pages hierarchy panel
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');

    // # Find the page node and click its menu button
    const pageNode = hierarchyPanel.locator('[data-testid="page-tree-node"]').filter({hasText: currentTitle}).first();
    await pageNode.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

    // # Hover over the page node to reveal the menu button
    await pageNode.hover();

    // # Click the menu button to open the actions menu
    const menuButton = pageNode.locator('[data-testid="page-tree-node-menu-button"]');
    await menuButton.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    await menuButton.click();

    // # Wait for menu to be visible
    const contextMenu = getPageActionsMenuLocator(page);
    await contextMenu.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

    const renameButton = contextMenu.locator('[data-testid="page-context-menu-rename"]');
    await renameButton.click();

    // # Wait for rename modal to appear
    const renameModal = page.locator('.TextInputModal');
    await renameModal.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

    // # Fill in new title in modal input
    const modalInput = page.locator('[data-testid="rename-page-modal-title-input"]');
    await modalInput.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    await modalInput.clear();
    await modalInput.fill(newTitle);

    // Wait for React to process the input change and verify the value is set
    await page.waitForTimeout(UI_MICRO_WAIT);
    await expect(modalInput).toHaveValue(newTitle);

    // # Submit by pressing Enter on the input (triggers handleKeyDown in TextInputModal)
    await modalInput.press('Enter');

    // # Wait for modal to close - allow extra time for async operation to complete
    await renameModal.waitFor({state: 'hidden', timeout: ELEMENT_TIMEOUT});

    // # Wait for rename to complete and propagate
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(SHORT_WAIT); // Extra wait for server to process rename
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
 * Gets the outline toggle menu item from a context menu
 * @param contextMenu - The context menu locator
 * @returns Locator for the outline toggle menu item
 */
function getOutlineToggleMenuItem(contextMenu: Locator): Locator {
    return contextMenu.locator('[data-testid="page-context-menu-show-outline"]');
}

/**
 * Shows the outline for a page using the context menu
 * @param page - Playwright page object
 * @param pageId - ID of the page to show outline for
 */
export async function showPageOutline(page: Page, pageId: string) {
    // Wait for page to stabilize after any navigation/state changes
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(EDITOR_LOAD_WAIT);

    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');
    const pageNode = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-page-id="${pageId}"]`).first();
    await pageNode.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

    // Scroll the page node into view to ensure it's fully visible
    await pageNode.scrollIntoViewIfNeeded();
    await page.waitForTimeout(SHORT_WAIT * 0.6);

    // Hover over page node to make menu button visible
    await pageNode.hover();
    await page.waitForTimeout(SHORT_WAIT);

    // Click menu button using dispatchEvent to avoid race conditions with click-outside listeners
    const menuButton = pageNode.locator('[data-testid="page-tree-node-menu-button"]').first();
    await menuButton.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

    // Use evaluate to trigger a controlled click that won't interfere with React event listeners
    await menuButton.evaluate((btn) => {
        const event = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
        });
        btn.dispatchEvent(event);
    });

    // Wait for context menu to render
    await page.waitForTimeout(SHORT_WAIT * 1.6);

    // Click "Show outline" button
    const contextMenu = getPageActionsMenuLocator(page);
    await contextMenu.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

    const showOutlineButton = getOutlineToggleMenuItem(contextMenu);
    await showOutlineButton.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    await showOutlineButton.click();

    // Wait for Redux action and outline rendering
    await page.waitForTimeout(ELEMENT_TIMEOUT);
}

/**
 * Shows the outline for a page using the page actions menu
 * @param page - Playwright page object
 * @param pageTitle - Title of the page to show outline for
 */
export async function showPageOutlineViaRightClick(page: Page, pageTitle: string) {
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');
    const pageNode = hierarchyPanel.locator('[data-testid="page-tree-node"]').filter({hasText: pageTitle}).first();
    await pageNode.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

    // Hover over page node to make menu button visible
    await pageNode.hover();

    // Click menu button to open context menu
    const menuButton = pageNode.locator('[data-testid="page-tree-node-menu-button"]');
    await menuButton.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    await menuButton.click();

    // Wait for context menu to render
    await page.waitForTimeout(SHORT_WAIT / 5);

    // Click "Show outline" button
    const contextMenu = getPageActionsMenuLocator(page);
    await contextMenu.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

    const showOutlineButton = getOutlineToggleMenuItem(contextMenu);
    await showOutlineButton.waitFor({state: 'visible'});
    await showOutlineButton.click();

    // Wait for Redux action and outline rendering
    await page.waitForTimeout(SHORT_WAIT);
}

/**
 * Hides the outline for a page using the context menu
 * @param page - Playwright page object
 * @param pageId - ID of the page to hide outline for
 */
export async function hidePageOutline(page: Page, pageId: string) {
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');
    const pageNode = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-page-id="${pageId}"]`).first();
    await pageNode.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

    // Hover over page node to make menu button visible
    await pageNode.hover();
    await page.waitForTimeout(SHORT_WAIT / 2.5);

    // Click menu button
    const menuButton = pageNode.locator('[data-testid="page-tree-node-menu-button"]').first();
    await menuButton.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    await menuButton.click();

    // Wait for context menu to render
    await page.waitForTimeout(SHORT_WAIT / 5);

    // Click "Hide outline" button (or "Show outline" if currently hidden - it toggles)
    const contextMenu = getPageActionsMenuLocator(page);
    await contextMenu.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

    const hideOutlineButton = getOutlineToggleMenuItem(contextMenu);
    await hideOutlineButton.click();

    // Wait for Redux action
    await page.waitForTimeout(SHORT_WAIT);
}

/**
 * Verifies that an outline heading is visible in the hierarchy panel
 * @param page - Playwright page object
 * @param headingText - Text of the heading to verify
 * @param timeout - Optional timeout in milliseconds
 */
export async function verifyOutlineHeadingVisible(page: Page, headingText: string, timeout: number = ELEMENT_TIMEOUT) {
    const headingNode = page
        .locator('[role="treeitem"]')
        .filter({hasText: new RegExp(`^${headingText}$`)})
        .first();
    await headingNode.waitFor({state: 'visible', timeout});
}

/**
 * Clicks on an outline heading to navigate to it
 * @param page - Playwright page object
 * @param headingText - Text of the heading to click
 */
export async function clickOutlineHeading(page: Page, headingText: string) {
    const headingNode = page
        .locator('[role="treeitem"]')
        .filter({hasText: new RegExp(`^${headingText}$`)})
        .first();
    await headingNode.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    await headingNode.click();
    await page.waitForTimeout(EDITOR_LOAD_WAIT);
}

/**
 * Publishes the current page being edited
 * Waits for editor transactions to complete, triggers autosave, then publishes
 * @param page - Playwright page object
 */
export async function publishCurrentPage(page: Page) {
    // Wait for editor transactions to complete (including HeadingIdPlugin)
    await page.waitForTimeout(EDITOR_LOAD_WAIT);

    // Click outside editor to ensure focus is lost and all pending transactions flush
    await page.locator('[data-testid="wiki-page-header"]').click();

    // Wait for autosave to complete (500ms debounce + extra buffer)
    await page.waitForTimeout(WEBSOCKET_WAIT);

    // Click publish button
    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]');
    await publishButton.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(EDITOR_LOAD_WAIT);
}

/**
 * Clears all content in the editor
 * @param page - Playwright page object
 */
export async function clearEditorContent(page: Page) {
    // # Click on editor first to ensure focus
    let editor = page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();
    if (!(await editor.isVisible({timeout: EDITOR_LOAD_WAIT}).catch(() => false))) {
        editor = page.locator('.ProseMirror').first();
    }
    await editor.click();
    await page.waitForTimeout(SHORT_WAIT / 5);

    // # Select all and delete - use platform-aware shortcut
    const isMac = process.platform === 'darwin';
    await page.keyboard.press(isMac ? 'Meta+A' : 'Control+A');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(SHORT_WAIT / 2.5);
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
    await newPageButton.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    await newPageButton.click();

    // # Fill in modal and create draft
    await fillCreatePageModal(page, draftTitle);

    // # Wait for editor to appear (draft created and loaded)
    const editor = page.locator('.ProseMirror').first();
    await editor.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

    // # Fill draft content in TipTap editor
    await editor.click();

    // Clear any existing content first - use platform-aware shortcut
    const isMac = process.platform === 'darwin';
    await page.keyboard.press(isMac ? 'Meta+A' : 'Control+A');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(SHORT_WAIT / 2.5);

    // Type content directly into editor element
    if (draftContent) {
        await editor.type(draftContent);
    }

    // Wait for auto-save to complete
    await page.waitForTimeout(WEBSOCKET_WAIT);

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
export async function waitForEditModeReady(page: Page, timeout: number = HIERARCHY_TIMEOUT) {
    // # Wait for editor to be visible and editable
    const editor = page.locator('.ProseMirror').first();
    await editor.waitFor({state: 'visible', timeout});

    // # Wait for URL to change to draft mode
    await page.waitForURL(/\/drafts\//, {timeout});

    // # Wait for network to settle after draft creation
    await page.waitForLoadState('networkidle');

    // # Give the draft state time to sync with the correct page_id
    await page.waitForTimeout(EDITOR_LOAD_WAIT);
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
    await page.waitForTimeout(SHORT_WAIT * 0.6);

    // # Select all text using platform-aware keyboard shortcut
    await selectAllText(page);

    // # Wait longer for the formatting toolbar/comment button to appear after selection
    await page.waitForTimeout(EDITOR_LOAD_WAIT);

    // # Wait for and click the inline comment button
    const commentButton = page.locator('button[aria-label*="comment"], [data-testid="inline-comment-submit"]').first();
    const buttonVisible = await commentButton.isVisible({timeout: ELEMENT_TIMEOUT}).catch(() => false);

    if (!buttonVisible) {
        return false;
    }

    await commentButton.click();
    await page.waitForTimeout(SHORT_WAIT);

    // # Fill in the comment modal - try different selectors
    let modal = page.getByRole('dialog', {name: /Comment|Add/i});
    let modalVisible = await modal.isVisible({timeout: WEBSOCKET_WAIT}).catch(() => false);

    if (!modalVisible) {
        // Try without name filter
        modal = page.getByRole('dialog');
        modalVisible = await modal.isVisible({timeout: WEBSOCKET_WAIT}).catch(() => false);
    }

    if (!modalVisible) {
        return false;
    }

    const textarea = modal.locator('textarea').first();
    await textarea.fill(commentText);

    const addButton = modal
        .locator('button:has-text("Add"), button:has-text("Submit"), button:has-text("Comment")')
        .first();
    await addButton.click();
    await page.waitForTimeout(SHORT_WAIT);

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
 * Gets all wiki tabs from the unified channel tabs bar
 * @param page - Playwright page object
 * @returns Locator for all wiki tabs
 */
export function getAllWikiTabs(page: Page): Locator {
    return page.locator('.channel-tabs-container__tab-wrapper--wiki');
}

/**
 * Extracts wiki ID from a wiki tab element
 * @param page - Playwright page object
 * @param wikiName - Name of the wiki
 * @returns The wiki ID or null if not found
 */
export async function getWikiIdFromTab(page: Page, wikiName: string): Promise<string | null> {
    const wikiTab = getWikiTab(page, wikiName);
    const testId = await wikiTab.getAttribute('data-testid').catch(() => null);
    if (testId) {
        const match = testId.match(/wiki-tab-(.+)/);
        return match ? match[1] : null;
    }
    return null;
}

/**
 * Opens the wiki tab menu (three-dot menu)
 * @param page - Playwright page object
 * @param wikiTitle - Title of the wiki
 */
export async function openWikiTabMenu(page: Page, wikiTitle: string) {
    const wikiTabWrapper = page.locator('.channel-tabs-container__tab-wrapper--wiki').filter({hasText: wikiTitle});

    // Hover over the wiki tab to reveal the menu button
    await wikiTabWrapper.hover();
    await page.waitForTimeout(SHORT_WAIT);

    const menuButton = wikiTabWrapper.locator('[id^="wiki-tab-menu-"]').first();
    await menuButton.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    await menuButton.click();
}

/**
 * Clicks a menu item in the wiki tab menu
 * @param page - Playwright page object
 * @param menuItemId - ID of the menu item (e.g., 'wiki-tab-rename', 'wiki-tab-delete')
 */
export async function clickWikiTabMenuItem(page: Page, menuItemId: string) {
    const menuItem = page.locator(`#${menuItemId}`);
    await menuItem.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
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
    await input.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
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
    await confirmButton.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
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
    await renameModal.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

    const titleInput = renameModal.locator('#text-input-modal-input');
    await titleInput.clear();
    await titleInput.fill(newWikiName);

    const renameButton = renameModal.getByRole('button', {name: /rename/i});
    await renameButton.click();

    await renameModal.waitFor({state: 'hidden', timeout: MODAL_CLOSE_TIMEOUT});
    await page.waitForTimeout(EDITOR_LOAD_WAIT);
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
    await confirmModal.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

    const confirmButton = confirmModal.getByRole('button', {name: /delete|yes/i});
    await confirmButton.click();

    await confirmModal.waitFor({state: 'hidden', timeout: MODAL_CLOSE_TIMEOUT});
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
    await page.waitForTimeout(EDITOR_LOAD_WAIT);

    const errorLocator = page.locator("text=/not found|error|doesn't exist/i");
    const isRedirected = page.url().includes(`/channels/${channelName}`) || !page.url().includes('/wiki/');

    if (!isRedirected) {
        await expect(errorLocator).toBeVisible({timeout: ELEMENT_TIMEOUT});
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
    await moveModal.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

    const channelSelect = moveModal.locator('#target-channel-select');
    await channelSelect.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

    await page.waitForFunction(
        (selectId) => {
            const select = document.querySelector(`#${selectId}`) as HTMLSelectElement;
            return select && select.options.length > 1;
        },
        'target-channel-select',
        {timeout: ELEMENT_TIMEOUT},
    );

    await channelSelect.selectOption({value: targetChannelId});

    const moveButton = moveModal.getByRole('button', {name: /move wiki/i});
    await moveButton.click();

    await moveModal.waitFor({state: 'hidden', timeout: MODAL_CLOSE_TIMEOUT});
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
 * Gets the breadcrumb wiki name locator
 * @param page - Playwright page object
 * @returns The breadcrumb wiki name locator
 */
export function getBreadcrumbWikiName(page: Page): Locator {
    return getBreadcrumb(page).locator('[data-testid="breadcrumb-wiki-name"]');
}

/**
 * Gets the breadcrumb links (ancestor pages)
 * @param page - Playwright page object
 * @returns The breadcrumb links locator
 */
export function getBreadcrumbLinks(page: Page): Locator {
    return getBreadcrumb(page).locator('[data-testid="breadcrumb-link"]');
}

/**
 * Gets the breadcrumb current page locator
 * @param page - Playwright page object
 * @returns The breadcrumb current page locator
 */
export function getBreadcrumbCurrentPage(page: Page): Locator {
    return getBreadcrumb(page).locator('[data-testid="breadcrumb-current"]');
}

/**
 * Verifies breadcrumb contains specific text
 * @param page - Playwright page object
 * @param expectedText - Text to find in breadcrumb
 * @param timeout - Optional timeout in ms (default: 5000)
 */
export async function verifyBreadcrumbContains(page: Page, expectedText: string, timeout = 10000) {
    const breadcrumb = getBreadcrumb(page);
    await expect(breadcrumb).toBeVisible({timeout});
    await expect(breadcrumb).toContainText(expectedText, {timeout});
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

    // Ensure button is enabled before clicking
    // In HA mode, permissions may take time to sync across nodes.
    // Retry with reloads up to 3 times with increasing delays.
    const maxRetries = 3;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            await expect(editButton).toBeEnabled({timeout: attempt === 0 ? timeout : HIERARCHY_TIMEOUT});
            lastError = undefined;
            break;
        } catch (error) {
            lastError = error as Error;
            if (attempt < maxRetries) {
                // Wait before reload to allow HA sync
                await page.waitForTimeout(1000 * (attempt + 1));
                await page.reload();
                await page.waitForLoadState('networkidle');
                await expect(editButton).toBeVisible({timeout});
            }
        }
    }

    if (lastError) {
        throw lastError;
    }

    // Click and wait for navigation
    await editButton.click();

    await page.waitForLoadState('networkidle', {timeout: HIERARCHY_TIMEOUT});

    // Wait for the Publish button to appear (indicates we're actually in edit mode)
    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]').first();
    await publishButton.waitFor({state: 'visible', timeout});
}

/**
 * Clicks publish/save button and waits for completion
 * @param page - Playwright page object
 * @param isNewPage - Whether this is a new page (use publish button) or edit (use save button)
 */
export async function saveOrPublishPage(page: Page, isNewPage = false) {
    const button = isNewPage
        ? page.locator('[data-testid="wiki-page-publish-button"]')
        : page.locator('[data-testid="save-button"]').first();

    await expect(button).toBeVisible({timeout: ELEMENT_TIMEOUT});
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
            await expect(rhs).not.toBeVisible({timeout: ELEMENT_TIMEOUT});
        }
    }
}

/**
 * Publishes a page by clicking the publish button and waiting for view mode
 * @param page - Playwright page object
 */
export async function publishPage(page: Page): Promise<void> {
    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]').first();
    await publishButton.click();
    await page.waitForLoadState('networkidle');

    // Wait for page to transition to view mode
    const pageViewer = page.locator('[data-testid="page-viewer-content"]');
    await expect(pageViewer).toBeVisible({timeout: ELEMENT_TIMEOUT});
}

/**
 * Adds a reply to a comment thread in the Wiki RHS
 * @param page - Playwright page object
 * @param rhs - Wiki RHS locator
 * @param replyText - Text content of the reply
 */
export async function addReplyToCommentThread(page: Page, rhs: Locator, replyText: string): Promise<void> {
    const replyTextarea = rhs.locator('textarea[placeholder*="Reply"], textarea').first();
    await expect(replyTextarea).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await replyTextarea.fill(replyText);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(EDITOR_LOAD_WAIT);
}

/**
 * Opens the Wiki RHS via the toggle comments button (shows Page Comments and All Threads tabs)
 * This is different from clicking a comment marker which opens a single thread view
 * @param page - Playwright page object
 * @returns The Wiki RHS locator
 */
export async function openWikiRHSViaToggleButton(page: Page): Promise<Locator> {
    const toggleCommentsButton = page.locator('[data-testid="wiki-page-toggle-comments"]');
    await expect(toggleCommentsButton).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await toggleCommentsButton.click();

    const rhs = page.locator('[data-testid="wiki-rhs"]');
    await expect(rhs).toBeVisible({timeout: ELEMENT_TIMEOUT});

    return rhs;
}

/**
 * Switches to a specific tab in the Wiki RHS
 * @param page - Playwright page object
 * @param rhs - Wiki RHS locator
 * @param tabName - Name of the tab ('Page Comments' or 'All Threads')
 */
export async function switchToWikiRHSTab(
    page: Page,
    rhs: Locator,
    tabName: 'Page Comments' | 'All Threads',
): Promise<void> {
    const tab = rhs.getByText(tabName, {exact: true});
    await expect(tab).toBeVisible();
    await tab.click();
    await page.waitForTimeout(SHORT_WAIT);
}

/**
 * Opens the move page modal via context menu and waits for it to be ready
 * @param page - Playwright page object
 * @param pageTitle - Title of the page to move
 * @returns The move modal locator
 */
export async function openMovePageModal(page: Page, pageTitle: string): Promise<Locator> {
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');
    const pageNode = hierarchyPanel.locator('[data-testid="page-tree-node"]').filter({hasText: pageTitle}).first();

    await pageNode.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

    // Hover over page node to make menu button visible
    await pageNode.hover();

    // Click menu button to open context menu
    const menuButton = pageNode.locator('[data-testid="page-tree-node-menu-button"]');
    await menuButton.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    await menuButton.click();

    const contextMenu = getPageActionsMenuLocator(page);
    await contextMenu.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

    const moveButton = contextMenu
        .locator('[data-testid="page-context-menu-move"], button:has-text("Move to Wiki"), button:has-text("Move to")')
        .first();
    await expect(moveButton).toBeVisible();
    await moveButton.click();

    const moveModal = page.getByRole('dialog', {name: /Move/i});
    await expect(moveModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

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
    await expect(moveModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});
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
    const titleElement = hierarchyPanel
        .locator(`button:has-text("${currentTitle}"), span:has-text("${currentTitle}")`)
        .first();

    await expect(titleElement).toBeVisible();
    await titleElement.dblclick();
    await page.waitForTimeout(SHORT_WAIT);

    // Wait for inline input to appear - try to find it in the hierarchy panel
    const inlineInput = hierarchyPanel.locator('input[type="text"]').first();

    // Check if inline editing is actually supported
    const isInputVisible = await inlineInput.isVisible({timeout: WEBSOCKET_WAIT}).catch(() => false);

    if (!isInputVisible) {
        throw new Error(
            `Inline rename not available. The input field did not appear after double-clicking "${currentTitle}". This feature may not be implemented yet.`,
        );
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
export async function waitForSearchDebounce(page: Page, timeout: number = EDITOR_LOAD_WAIT) {
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
    await page.waitForTimeout(SHORT_WAIT * 0.6);
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

    // Ensure editor is focused first
    await editor.click();
    await page.waitForTimeout(SHORT_WAIT / 2);

    // Triple-click to select paragraph
    await paragraph.click({clickCount: 3});
    await page.waitForTimeout(SHORT_WAIT);

    // Verify selection exists by checking if the browser has selected text
    const hasSelection = await page.evaluate(() => {
        const selection = window.getSelection();
        return selection && selection.toString().trim().length > 0;
    });

    if (!hasSelection) {
        // Fallback: try double-click instead
        await paragraph.click({clickCount: 2});
        await page.waitForTimeout(SHORT_WAIT);
    }
}

/**
 * Opens the inline comment modal from the formatting bar
 * @param page - Playwright page object
 * @returns The comment modal locator
 */
export async function openInlineCommentModal(page: Page): Promise<Locator> {
    // Wait for formatting bar bubble to appear
    const formattingBarBubble = page.locator('.formatting-bar-bubble');
    await expect(formattingBarBubble).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // Click "Add Comment" button from formatting bar
    const inlineCommentButton = formattingBarBubble.locator('button[title="Add Comment"]');
    await expect(inlineCommentButton).toBeVisible();
    await inlineCommentButton.click();
    await page.waitForTimeout(SHORT_WAIT);

    // Wait for and return the modal
    const commentModal = page.getByRole('dialog', {name: 'Add Comment'});
    await expect(commentModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

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
export async function addInlineCommentInEditMode(page: Page, commentText: string, textToSelect?: string) {
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
    const commentMarker = page.locator('[id^="ic-"], .comment-anchor').first();
    await expect(commentMarker).toBeVisible({timeout: ELEMENT_TIMEOUT});
    return commentMarker;
}

/**
 * Clicks a comment marker and waits for the wiki RHS to open
 * @param page - Playwright page object
 * @param commentMarker - The comment marker locator (optional - will find first marker if not provided)
 * @returns The wiki RHS locator
 */
export async function clickCommentMarkerAndOpenRHS(page: Page, commentMarker?: Locator): Promise<Locator> {
    const marker = commentMarker || (await verifyCommentMarkerVisible(page));
    await marker.click();

    const rhs = page.locator('[data-testid="wiki-rhs"]');
    await expect(rhs).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await page.waitForTimeout(EDITOR_LOAD_WAIT);

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
        await expect(rhs).toContainText(text, {timeout: ELEMENT_TIMEOUT});
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
            await publishPage(page);

            // Verify marker is visible after publish
            return await verifyCommentMarkerVisible(page);
        }

        return null;
    } catch {
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
    postSelector: string = '[data-testid="postContent"]',
): Promise<void> {
    // Wait for container to be ready
    await page.waitForTimeout(SHORT_WAIT);

    // Find the post content area - this is what needs to be hovered to reveal the menu
    const postContent = containerLocator.locator(postSelector).first();
    await expect(postContent).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // Hover over the post to reveal the dot menu button
    // The menu button only appears on hover
    await postContent.hover();
    await page.waitForTimeout(SHORT_WAIT);

    // Find and click the dot menu button
    // The button has data-testid="PostDotMenu-Button-{postId}"
    const dotMenuButton = containerLocator.locator('[data-testid^="PostDotMenu-Button-"]').first();
    await expect(dotMenuButton).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await dotMenuButton.click();

    // Wait for the dropdown menu to appear
    // The menu is rendered as a Material-UI menu with role="menu"
    await page.waitForTimeout(EDITOR_LOAD_WAIT);
    const menu = page.locator('[role="menu"]').last();
    await expect(menu).toBeVisible({timeout: ELEMENT_TIMEOUT});
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
    timeout: number = ELEMENT_TIMEOUT,
): Promise<void> {
    const menuItem = page.locator(menuItemSelector).first();
    await expect(menuItem).toBeVisible({timeout});
    await menuItem.click();
    await page.waitForTimeout(SHORT_WAIT);
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
    const resolveMenuItem = page
        .locator('[id*="resolve_comment"], ' + '[id*="unresolve_comment"], ' + '[data-testid*="resolve_comment"]')
        .or(page.getByRole('menuitem', {name: /Resolve|Unresolve/i}))
        .first();
    await expect(resolveMenuItem).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await resolveMenuItem.click();
    await page.waitForTimeout(SHORT_WAIT);
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
    await expect(deleteMenuItem).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await deleteMenuItem.click();

    // Confirm deletion if modal appears
    const confirmDialog = page.getByRole('dialog', {name: /Delete|Confirm/i});
    await expect(confirmDialog).toBeVisible({timeout: WEBSOCKET_WAIT});
    const confirmButton = confirmDialog.locator('#deletePostModalButton');
    await expect(confirmButton).toBeVisible({timeout: WEBSOCKET_WAIT});
    await confirmButton.click();

    await page.waitForTimeout(SHORT_WAIT);
}

/**
 * Opens the page actions menu (three dot menu) in the wiki page header
 * @param page - Playwright page object
 * @param timeout - Optional timeout in milliseconds (default: 5000)
 * @returns The page context menu locator
 */
export async function openPageActionsMenu(page: Page, timeout: number = ELEMENT_TIMEOUT): Promise<Locator> {
    const actionsButton = page.locator('[data-testid="wiki-page-more-actions"]');
    await actionsButton.waitFor({state: 'visible', timeout});
    await actionsButton.click();

    const contextMenu = getPageActionsMenuLocator(page);
    await contextMenu.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

    return contextMenu;
}

/**
 * Clicks a specific menu item in the page context menu
 * @param page - Playwright page object
 * @param menuItemId - The ID of the menu item (e.g., 'delete', 'move', 'rename')
 */
export async function clickPageContextMenuItem(page: Page, menuItemId: string) {
    const menuItem = page.locator(`[data-testid="page-context-menu-${menuItemId}"]`);
    await menuItem.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    await menuItem.click();
}

/**
 * Waits for the page viewer content to load and be visible
 * Useful for verifying a published page has loaded after navigation or publish
 * @param page - Playwright page object
 * @param timeout - Optional timeout in milliseconds (default: 10000)
 */
export async function waitForPageViewerLoad(page: Page, timeout: number = HIERARCHY_TIMEOUT) {
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
export async function createWikiAndPage(page: Page, wikiName: string, pageTitle: string, pageContent: string = '') {
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
    commentText: string,
) {
    // Create wiki and page
    const {wiki, page: testPage} = await createWikiAndPage(page, wikiName, pageTitle, pageContent);

    // Enter edit mode and add inline comment with publish
    await enterEditMode(page);
    const marker = await addInlineCommentAndVerify(page, commentText, undefined, true);

    return {wiki, page: testPage, marker};
}

/**
 * Deletes a page through the UI using the sidebar context menu
 * This is a reusable helper that encapsulates the deletion flow
 * @param page - Playwright page object
 * @param pageTitle - Title of the page to delete
 */
export async function deletePageThroughUI(page: Page, pageTitle: string) {
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');
    const pageNode = hierarchyPanel.locator('[data-testid="page-tree-node"]', {hasText: pageTitle});

    // Click the menu button on the page node
    const menuButton = pageNode.locator('[data-testid="page-tree-node-menu-button"]');
    await menuButton.click();

    // Click delete from the context menu
    const deleteMenuItem = page.locator('[data-testid="page-context-menu-delete"]');
    await deleteMenuItem.click();

    // Confirm deletion in modal
    const deleteModal = page.getByRole('dialog');
    const deleteButton = page.locator('[data-testid="delete-button"]');
    await deleteButton.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    await deleteButton.click();

    // Wait for the modal to close, which indicates the delete operation completed
    // If the delete fails, the modal stays open and this will timeout
    await deleteModal.waitFor({state: 'hidden', timeout: MODAL_CLOSE_TIMEOUT});
    await page.waitForLoadState('networkidle');
}

/**
 * Deletes the default draft page through the UI using the sidebar context menu
 * This helper specifically targets draft nodes identified by the data-is-draft attribute
 * @param page - Playwright page object
 */
export async function deleteDefaultDraftThroughUI(page: Page) {
    const draftNode = page.locator('[data-testid="page-tree-node"][data-is-draft="true"]');
    await draftNode.waitFor({state: 'visible', timeout: HIERARCHY_TIMEOUT});

    // Click the menu button on the draft node
    const menuButton = draftNode.locator('[data-testid="page-tree-node-menu-button"]');
    await menuButton.click();

    // Click delete from the context menu
    const deleteMenuItem = page.locator('[data-testid="page-context-menu-delete"]');
    await deleteMenuItem.click();

    // Confirm deletion in modal
    const deleteButton = page.locator('[data-testid="delete-button"]');
    await deleteButton.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    await deleteButton.click();

    await page.waitForLoadState('networkidle');
}

/**
 * Opens the context menu for a page node by page ID
 * This is a reusable helper for any context menu operation
 * @param page - Playwright page object
 * @param pageId - ID of the page
 * @returns The context menu locator
 */
export async function openPageContextMenu(page: Page, pageId: string): Promise<Locator> {
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');
    await hierarchyPanel.waitFor({state: 'visible', timeout: HIERARCHY_TIMEOUT});

    const allNodes = hierarchyPanel.locator('[data-testid="page-tree-node"]');
    await allNodes.first().waitFor({state: 'visible', timeout: HIERARCHY_TIMEOUT});

    const pageNode = page.locator(`[data-testid="page-tree-node"][data-page-id="${pageId}"]`);
    await pageNode.waitFor({state: 'visible', timeout: HIERARCHY_TIMEOUT});

    await pageNode.scrollIntoViewIfNeeded();

    const menuButton = pageNode.locator('[data-testid="page-tree-node-menu-button"]');
    await expect(menuButton).toBeVisible({timeout: HIERARCHY_TIMEOUT});
    await menuButton.click();

    const contextMenu = getPageActionsMenuLocator(page, pageId);
    await contextMenu.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

    return contextMenu;
}

/**
 * Deletes a page/draft through the UI using the context menu
 * @param page - Playwright page object
 * @param pageId - ID of the page
 */
export async function deletePageDraft(page: Page, pageId: string) {
    await openPageContextMenu(page, pageId);

    const deleteOption = page.locator('[data-testid="page-context-menu-delete"]').first();

    await deleteOption.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

    await deleteOption.click();

    const deleteButton = page.locator('[data-testid="delete-button"]');
    await deleteButton.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

    await deleteButton.click();

    await page.waitForLoadState('networkidle');
}

/**
 * Deletes a page with specific options (cascade or move children)
 * This helper supports the hierarchy deletion scenarios
 * @param page - Playwright page object
 * @param pageId - ID of the page to delete
 * @param option - Deletion option: 'cascade' (delete with children) or 'move-to-parent' (move children up)
 */
export async function deletePageWithOption(page: Page, pageId: string, option: 'cascade' | 'move-to-parent') {
    // Open context menu
    await openPageContextMenu(page, pageId);

    // Click delete option
    const deleteOption = page.locator('[data-testid="page-context-menu-delete"]').first();
    await deleteOption.click();

    // Select the appropriate deletion option in modal
    const optionId = option === 'cascade' ? 'delete-option-page-and-children' : 'delete-option-page-only';
    const radioOption = page.locator(`input[id="${optionId}"]`);
    await expect(radioOption).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await radioOption.check();

    // Confirm deletion
    const deleteButton = page.locator('[data-testid="delete-button"]');
    await deleteButton.click();

    await page.waitForLoadState('networkidle');
}

/**
 * Deletes a page via the page actions menu (top-right dropdown)
 * This is different from tree context menu deletion
 * @param page - Playwright page object
 * @param option - Optional deletion option: 'cascade' (delete with children) or 'move-to-parent' (move children up)
 */
export async function deletePageViaActionsMenu(page: Page, option?: 'cascade' | 'move-to-parent') {
    await openPageActionsMenu(page);
    await clickPageContextMenuItem(page, 'delete');

    const confirmModal = page.getByRole('dialog', {name: /Delete|Confirm/i});
    await expect(confirmModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

    if (option) {
        const optionId = option === 'cascade' ? 'delete-option-page-and-children' : 'delete-option-page-only';
        const radioOption = confirmModal.locator(`input[id="${optionId}"]`);

        const radioExists = (await radioOption.count()) > 0;
        if (radioExists) {
            await expect(radioOption).toBeVisible({timeout: ELEMENT_TIMEOUT});
            await radioOption.check();
        }
    }

    const currentUrl = page.url();
    const confirmButton = confirmModal.locator('[data-testid="delete-button"], [data-testid="confirm-button"]').first();
    await confirmButton.click();

    // Wait for modal to close
    await expect(confirmModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

    // Wait for URL to change (deletion should redirect)
    await page.waitForFunction((url) => window.location.href !== url, currentUrl, {timeout: ELEMENT_TIMEOUT});

    await page.waitForLoadState('networkidle');

    // Wait for wiki view to appear after navigation
    const wikiView = page.locator('[data-testid="wiki-view"]');
    await expect(wikiView).toBeVisible({timeout: ELEMENT_TIMEOUT});
}

/**
 * Edits an existing page's content through the UI
 * @param page - Playwright page object
 * @param newContent - New content to add to the page
 * @param clearExisting - Whether to clear existing content first (default: false)
 */
export async function editPageThroughUI(page: Page, newContent: string, clearExisting: boolean = false) {
    // Wait for edit button to be visible and enabled (not disabled)
    const editButton = page.locator('[data-testid="wiki-page-edit-button"]');
    await editButton.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

    // Wait for button to be enabled (page data must be loaded)
    await page.waitForFunction(
        () => {
            const button = document.querySelector('[data-testid="wiki-page-edit-button"]') as HTMLButtonElement;
            return button && !button.disabled;
        },
        {timeout: ELEMENT_TIMEOUT},
    );

    await editButton.click();

    // Wait for editor to appear
    const editor = page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();
    await editor.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    await editor.click();

    // Clear existing content if requested
    if (clearExisting) {
        await selectAllText(page);
        await page.keyboard.press('Backspace');
        await page.waitForTimeout(SHORT_WAIT / 2.5);
    } else {
        // Otherwise, move to end
        await page.keyboard.press('End');
    }

    // Type new content
    await editor.type(newContent);

    // Publish the changes
    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]');
    await publishButton.click();

    // Wait for navigation after publish (similar to createPageThroughUI)
    await page.waitForLoadState('networkidle');

    // Wait for page viewer to appear (increased timeout to match createPageThroughUI)
    const pageViewer = page.locator('[data-testid="page-viewer-content"]');
    await pageViewer.waitFor({state: 'visible', timeout: HIERARCHY_TIMEOUT * 3});
}

/**
 * Opens the duplicate page modal via context menu
 * @param page - Playwright page object
 * @param pageId - ID of the page to duplicate
 * @returns The duplicate modal locator
 */
/**
 * Duplicates a page through the UI using the context menu (immediate action, no modal)
 * The page is duplicated at the same level in the current wiki with default "Copy of [title]" naming
 * @param page - Playwright page object
 * @param pageId - ID of the page to duplicate
 */
export async function duplicatePageThroughUI(page: Page, pageId: string) {
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');
    const pageNode = hierarchyPanel.locator(`[data-page-id="${pageId}"]`).first();
    await pageNode.waitFor({state: 'visible', timeout: HIERARCHY_TIMEOUT + 5000});

    // Hover to reveal menu button
    await pageNode.hover();

    // Click menu button
    const menuButton = pageNode.locator('[data-testid="page-tree-node-menu-button"]').first();
    await menuButton.click();

    // Wait for context menu
    const contextMenu = getPageActionsMenuLocator(page);
    await contextMenu.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

    // Click duplicate option (this now immediately duplicates the page)
    const duplicateOption = contextMenu.locator('[data-testid="page-context-menu-duplicate"]').first();
    await duplicateOption.click();

    // Wait for duplication to complete
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(EDITOR_LOAD_WAIT);
}

/**
 * Waits for a duplicated page to appear in the hierarchy
 * In HA mode, WebSocket events may take time to propagate, so we retry with reloads.
 * @param page - Playwright page object
 * @param expectedTitle - Expected title of the duplicated page
 * @param timeout - Optional timeout in milliseconds per attempt (default: 10000)
 * @returns The page node locator
 */
export async function waitForDuplicatedPageInHierarchy(
    page: Page,
    expectedTitle: string,
    timeout: number = HIERARCHY_TIMEOUT,
): Promise<Locator> {
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]').first();
    const duplicateNode = hierarchyPanel.locator('[data-page-id]').filter({hasText: expectedTitle}).first();

    // In HA mode, WebSocket events may take time to propagate
    // Retry with reloads up to 3 times
    const maxRetries = 3;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            await duplicateNode.waitFor({state: 'visible', timeout});
            return duplicateNode;
        } catch (error) {
            lastError = error as Error;
            if (attempt < maxRetries) {
                // Wait then reload to force fresh data fetch (helps in HA environments)
                await page.waitForTimeout(1000 * (attempt + 1));
                await page.reload();
                await page.waitForLoadState('networkidle');
            }
        }
    }

    throw lastError;
}

/**
 * Waits for the active editors indicator to appear with HA-resilient retry logic.
 * In HA mode, WebSocket events may take time to propagate across nodes.
 * @param page - Playwright page object
 * @param options - Optional configuration
 * @param options.timeout - Timeout in milliseconds per attempt (default: 10000)
 * @param options.expectedText - Optional text to wait for (e.g., "2 people editing")
 * @returns The active editors indicator locator
 */
export async function waitForActiveEditorsIndicator(
    page: Page,
    options: {timeout?: number; expectedText?: string} = {},
): Promise<Locator> {
    const {timeout = HIERARCHY_TIMEOUT, expectedText} = options;
    const indicator = page.locator('.active-editors-indicator');

    // In HA mode, WebSocket events may take time to propagate
    // Retry with reloads up to 5 times (more aggressive for HA)
    const maxRetries = 5;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            // Use a shorter per-attempt timeout so we can retry more
            const perAttemptTimeout = Math.min(timeout, 5000);
            await indicator.waitFor({state: 'visible', timeout: perAttemptTimeout});

            // If expectedText is specified, wait for it to appear in the indicator
            if (expectedText) {
                await expect(indicator).toContainText(expectedText, {timeout: perAttemptTimeout});
            }

            return indicator;
        } catch (error) {
            lastError = error as Error;
            if (attempt < maxRetries) {
                // Wait with increasing delays then reload to force fresh data fetch
                await page.waitForTimeout(2000 * (attempt + 1));
                await page.reload();
                await page.waitForLoadState('networkidle');
                // Extra wait for WebSocket reconnection after reload
                await page.waitForTimeout(1000);
            }
        }
    }

    throw lastError;
}

/**
 * Opens the slash command menu by typing / in the editor
 * @param page - Playwright page object
 * @param editor - Optional editor locator (if not provided, will find default editor)
 * @returns The slash command menu locator
 */
export async function openSlashCommandMenu(page: Page, editor?: Locator): Promise<Locator> {
    const editorElement = editor || page.locator('.tiptap.ProseMirror');
    await editorElement.click();
    await page.waitForTimeout(SHORT_WAIT / 5);
    await editorElement.press('/');
    const slashMenu = page.locator('.slash-command-menu');
    await slashMenu.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    return slashMenu;
}

/**
 * Types a search query in the open slash command menu
 * @param page - Playwright page object
 * @param query - Search query to type
 */
export async function typeSlashCommandQuery(page: Page, query: string): Promise<void> {
    // Type each character individually with a small delay to ensure proper suggestion handling
    for (const char of query) {
        await page.keyboard.type(char);
        await page.waitForTimeout(SHORT_WAIT / 5);
    }
    await page.waitForTimeout(SHORT_WAIT * 0.6);
}

/**
 * Selects a specific item from the slash command menu by clicking it
 * @param page - Playwright page object
 * @param slashMenu - The slash command menu locator
 * @param itemText - Text of the item to select (matches title)
 */
export async function selectSlashCommandItem(page: Page, slashMenu: Locator, itemText: string): Promise<void> {
    const item = slashMenu.locator('.slash-command-item').filter({hasText: itemText});
    await item.waitFor({state: 'visible', timeout: WEBSOCKET_WAIT});
    await item.click();
}

/**
 * Complete workflow: opens slash menu, optionally filters, and selects an item
 * @param page - Playwright page object
 * @param itemText - Text of the item to select
 * @param query - Optional search query to filter items
 */
export async function insertViaSlashCommand(page: Page, itemText: string, query?: string): Promise<void> {
    const slashMenu = await openSlashCommandMenu(page);

    if (query) {
        await typeSlashCommandQuery(page, query);
        // Wait for the menu to update with filtered results
        await page.waitForTimeout(SHORT_WAIT);
    }

    // Wait for the specific item to be visible in the menu before trying to select it
    const item = slashMenu.locator('.slash-command-item').filter({hasText: itemText});
    await item.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    await item.click();
}

/**
 * Waits for the formatting bar (bubble menu) to appear
 * @param page - Playwright page object
 * @param timeout - Optional timeout in milliseconds (default: 5000)
 * @returns The formatting bar locator
 */
export async function waitForFormattingBar(page: Page, timeout: number = ELEMENT_TIMEOUT): Promise<Locator> {
    const formattingBar = page.locator('.formatting-bar-bubble');
    await formattingBar.waitFor({state: 'visible', timeout});
    return formattingBar;
}

/**
 * Clicks a button in the formatting bar by its title attribute
 * @param page - Playwright page object
 * @param formattingBar - The formatting bar locator
 * @param buttonTitle - Title attribute of the button to click
 */
export async function clickFormattingButton(page: Page, formattingBar: Locator, buttonTitle: string): Promise<void> {
    const button = formattingBar.locator(`button[title="${buttonTitle}"]`);
    await button.waitFor({state: 'visible', timeout: WEBSOCKET_WAIT});
    await button.click();
}

/**
 * Checks if a formatting button is in active state
 * @param formattingBar - The formatting bar locator
 * @param buttonTitle - Title attribute of the button to check
 * @returns True if button has active class
 */
export async function isFormattingButtonActive(formattingBar: Locator, buttonTitle: string): Promise<boolean> {
    const button = formattingBar.locator(`button[title="${buttonTitle}"]`);
    const classes = (await button.getAttribute('class')) || '';
    return classes.includes('active');
}

/**
 * Verifies that a formatting button exists in the formatting bar
 * @param formattingBar - The formatting bar locator
 * @param iconClass - Icon class to look for (e.g., 'icon-format-bold')
 */
export async function verifyFormattingButtonExists(formattingBar: Locator, iconClass: string): Promise<void> {
    const button = formattingBar.locator(`button i.${iconClass}`);
    await expect(button).toBeVisible();
}

/**
 * Waits for the link bubble menu to appear
 * @param page - Playwright page object
 * @param timeout - Optional timeout in milliseconds (default: 5000)
 * @returns The link bubble menu locator
 */
export async function waitForLinkBubbleMenu(page: Page, timeout: number = ELEMENT_TIMEOUT): Promise<Locator> {
    const bubbleMenu = page.locator('[data-testid="link-bubble-menu"]');
    await bubbleMenu.waitFor({state: 'visible', timeout});
    return bubbleMenu;
}

/**
 * Positions cursor inside a link in the editor using keyboard navigation.
 * This works by selecting the link text and then collapsing the selection.
 * @param page - Playwright page object
 * @param editor - The editor locator
 */
export async function positionCursorInLink(page: Page, editor: Locator): Promise<void> {
    // Click directly on the link element to position cursor inside it
    // This triggers the mousedown handler which properly positions the cursor
    const linkElement = editor.locator('a').first();
    await linkElement.click();
    await page.waitForTimeout(SHORT_WAIT);
}

/**
 * Creates a link from the currently selected text in the editor
 * @param page - Playwright page object
 * @param targetPageName - Name of the page to link to
 */
export async function createLinkFromSelection(page: Page, targetPageName: string): Promise<void> {
    // Open link modal with Ctrl+L
    await pressModifierKey(page, 'l');

    const linkModal = page.locator('[data-testid="page-link-modal"]').first();
    await expect(linkModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // Search for target page
    const searchInput = linkModal.locator('input[id="page-search-input"]');
    await searchInput.fill(targetPageName);

    // Select the target page
    await linkModal.locator(`text="${targetPageName}"`).first().click();

    // Click Insert Link button
    await linkModal.locator('button:has-text("Insert Link")').click();

    // Wait for modal to close
    await expect(linkModal).not.toBeVisible();
    await page.waitForTimeout(SHORT_WAIT);
}

/**
 * Common setup: creates page, navigates to it, clicks edit
 * @param page - Playwright page object
 * @param pageTitle - Title of the page to create
 * @param pageContent - Optional initial content for the page
 * @returns Object containing page node and editor locators
 */
export async function setupPageInEditMode(
    page: Page,
    pageTitle: string,
    pageContent?: string,
): Promise<{pageNode: Locator; editor: Locator}> {
    await createPageThroughUI(page, pageTitle, pageContent || '');
    await waitForPageInHierarchy(page, pageTitle);
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]').first();
    const pageNode = hierarchyPanel.getByRole('button', {name: pageTitle, exact: true});
    await pageNode.click();
    await clickPageEditButton(page);
    const editor = page.locator('.tiptap.ProseMirror');
    await editor.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    return {pageNode, editor};
}

/**
 * Types text in the editor and waits for it to appear
 * Gets the editor, waits for it to be ready, then types the text
 * @param page - Playwright page object
 * @param text - Text to type
 */
export async function typeInEditor(page: Page, text: string): Promise<void> {
    const editor = await getEditorAndWait(page);
    await editor.click();
    await editor.type(text);
    await page.waitForTimeout(SHORT_WAIT * 0.6);
}

/**
 * Verifies that a specific element type exists in the editor with optional text
 * @param editor - The editor locator
 * @param tagName - HTML tag name to check (e.g., 'h1', 'ul', 'blockquote')
 * @param expectedText - Optional text that should be inside the element
 */
export async function verifyEditorElement(editor: Locator, tagName: string, expectedText?: string): Promise<void> {
    const element = editor.locator(tagName);
    await expect(element).toBeVisible();
    if (expectedText) {
        await expect(element).toHaveText(expectedText);
    }
}

/**
 * Clicks the edit button to enter edit mode for a page
 * @param page - Playwright page object
 */
export async function clickPageEditButton(page: Page): Promise<void> {
    const editButton = page.locator('[data-testid="wiki-page-edit-button"]').first();
    await editButton.click();
    await page.waitForTimeout(SHORT_WAIT * 0.6);
}

/**
 * Gets the TipTap editor locator and waits for it to be visible
 * @param page - Playwright page object
 * @returns The editor locator
 */
export async function getEditorAndWait(page: Page): Promise<Locator> {
    const editor = page.locator('.ProseMirror').first();
    await editor.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    return editor;
}

/**
 * Clicks a filter button in the page-level RHS comment filters
 * @param page - Playwright page object
 * @param rhs - Wiki RHS locator
 * @param filterType - Type of filter to click ('all', 'open', 'resolved')
 */
export async function clickCommentFilter(
    page: Page,
    rhs: Locator,
    filterType: 'all' | 'open' | 'resolved',
): Promise<void> {
    const filterBtn = rhs.locator(`[data-testid="filter-${filterType}"]`).first();
    await expect(filterBtn).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await filterBtn.click();
    await page.waitForTimeout(SHORT_WAIT);
}

/**
 * Verifies that the comments empty state is shown with expected text
 * @param rhs - Wiki RHS locator
 * @param expectedText - Expected text in the empty state
 */
export async function verifyCommentsEmptyState(rhs: Locator, expectedText: string): Promise<void> {
    const emptyState = rhs.locator('.WikiPageThreadViewer__empty').first();
    await expect(emptyState).toBeVisible({timeout: WEBSOCKET_WAIT});
    await expect(emptyState).toContainText(expectedText);
}

/**
 * Gets the first thread item in the RHS and verifies it's visible
 * @param rhs - Wiki RHS locator
 * @returns The thread item locator
 */
export async function getThreadItemAndVerify(rhs: Locator): Promise<Locator> {
    const threadItem = rhs.locator('.WikiPageThreadViewer__thread-item').first();
    await expect(threadItem).toBeVisible({timeout: ELEMENT_TIMEOUT});
    return threadItem;
}

/**
 * Gets the AI rewrite button locator
 * @param page - Playwright page object
 * @returns The AI rewrite button locator
 */
export function getAIRewriteButton(page: Page): Locator {
    return page.locator('[data-testid="ai-rewrite-button"]');
}

/**
 * Opens the AI rewrite menu by clicking the AI button
 * @param page - Playwright page object
 * @returns The rewrite menu locator
 */
export async function openAIRewriteMenu(page: Page): Promise<Locator> {
    const aiButton = getAIRewriteButton(page);
    await aiButton.click();
    await page.waitForTimeout(SHORT_WAIT);
    const menu = page.locator('[data-testid="rewrite-menu"]');
    await menu.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    return menu;
}

/**
 * Closes the AI rewrite menu by clicking backdrop
 * Waits for backdrop to be fully removed before continuing
 * @param page - Playwright page object
 */
export async function closeAIRewriteMenu(page: Page): Promise<void> {
    const backdrop = page.locator('#backdropForMenuComponent').first();
    const backdropVisible = await backdrop.isVisible().catch(() => false);
    if (backdropVisible) {
        await backdrop.click({force: true});
        await page.waitForTimeout(SHORT_WAIT * 0.6);
        await backdrop.waitFor({state: 'detached', timeout: ELEMENT_TIMEOUT}).catch(() => {});
    } else {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(SHORT_WAIT * 0.6);
    }
}

/**
 * Waits for any backdrop to disappear (used after menu closures)
 * @param page - Playwright page object
 * @param timeout - Maximum time to wait in milliseconds
 */
export async function waitForBackdropDisappear(page: Page, timeout: number = ELEMENT_TIMEOUT): Promise<void> {
    const backdrop = page.locator('.MuiBackdrop-root, #backdropForMenuComponent').first();
    await backdrop.waitFor({state: 'hidden', timeout}).catch(() => {
        // Backdrop might already be gone
    });
}

/**
 * Checks if AI plugin is available by verifying AI button appears in formatting bar
 * The AI button only appears when agents are configured
 * @param page - Playwright page object
 * @returns True if AI plugin is available
 */
export async function checkAIPluginAvailability(page: Page): Promise<boolean> {
    const editor = await getEditorAndWait(page);
    await editor.click();
    await page.keyboard.type('test');
    await selectTextInEditor(page);
    const aiButton = getAIRewriteButton(page);
    const isVisible = await aiButton.isVisible().catch(() => false);
    await page.keyboard.press('Backspace');
    return isVisible;
}

/**
 * Gets the page actions menu button in the wiki header
 * @param page - Playwright page object
 * @returns The page actions menu button locator
 */
export function getPageActionsMenuButton(page: Page): Locator {
    return page.locator('[data-testid="wiki-page-more-actions"]');
}

/**
 * Gets the AI Tools submenu item in the page actions menu
 * @param page - Playwright page object
 * @returns The AI Tools submenu locator
 */
export function getAIToolsSubmenu(page: Page): Locator {
    return page.locator('[data-testid="page-context-menu-ai-tools"]');
}

/**
 * Gets the AI Tools dropdown button locator (now in page actions menu)
 * @param page - Playwright page object
 * @returns The page actions menu button (entry point for AI tools)
 * @deprecated Use getPageActionsMenuButton and getAIToolsSubmenu instead
 */
export function getAIToolsDropdown(page: Page): Locator {
    return getPageActionsMenuButton(page);
}

/**
 * Gets the "Proofread page" button from the AI Tools submenu
 * @param page - Playwright page object
 * @returns The proofread page button locator
 */
export function getAIToolsProofreadButton(page: Page): Locator {
    return page.locator('[data-testid="page-context-menu-ai-proofread"]');
}

/**
 * Gets the "Translate page" button from the AI Tools submenu
 * @param page - Playwright page object
 * @returns The translate page button locator
 */
export function getAIToolsTranslateButton(page: Page): Locator {
    return page.locator('[data-testid="page-context-menu-ai-translate"]');
}

/**
 * Opens the page actions menu and navigates to the AI Tools submenu
 * @param page - Playwright page object
 */
export async function openAIToolsMenu(page: Page): Promise<void> {
    const menuButton = getPageActionsMenuButton(page);
    await menuButton.click();
    await page.waitForTimeout(SHORT_WAIT);
    const aiSubmenu = getAIToolsSubmenu(page);
    await aiSubmenu.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    await aiSubmenu.hover();
    await page.waitForTimeout(SHORT_WAIT);
}

/**
 * Opens the AI Tools submenu and clicks the proofread button
 * @param page - Playwright page object
 */
export async function triggerProofread(page: Page): Promise<void> {
    await openAIToolsMenu(page);
    const proofreadButton = getAIToolsProofreadButton(page);
    await proofreadButton.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    await proofreadButton.click();
}

/**
 * Checks if AI Tools are available in the page actions menu
 * Opens the menu and checks for the AI submenu
 * @param page - Playwright page object
 * @returns True if AI Tools submenu is visible
 */
export async function isAIToolsDropdownVisible(page: Page): Promise<boolean> {
    try {
        const menuButton = getPageActionsMenuButton(page);
        const isMenuButtonVisible = await menuButton.isVisible().catch(() => false);
        if (!isMenuButtonVisible) {
            return false;
        }
        await menuButton.click();
        await page.waitForTimeout(SHORT_WAIT);
        const aiSubmenu = getAIToolsSubmenu(page);
        const isVisible = await aiSubmenu.isVisible().catch(() => false);
        // Close the menu by pressing Escape
        await page.keyboard.press('Escape');
        return isVisible;
    } catch {
        return false;
    }
}

/**
 * Checks if the AI plugin (mattermost-ai) is actually running on the server.
 * This checks the actual server state, not just the test configuration.
 * @param adminClient - Admin client to check plugin statuses
 * @returns True if AI plugin is installed and running on the server
 */
export async function isAIPluginRunning(adminClient: Client4): Promise<boolean> {
    try {
        const statuses = await adminClient.getPluginStatuses();
        const aiPluginStatus = statuses.find(
            (s: {plugin_id: string; state: number}) => s.plugin_id === 'mattermost-ai',
        );

        if (!aiPluginStatus) {
            return false;
        }

        // Plugin state 2 = Running (from server/public/model/plugin_status.go)
        return aiPluginStatus.state === 2;
    } catch {
        return false;
    }
}

/**
 * Opens the Bookmarks tab/dropdown in the channel tabs bar
 * This is needed because bookmarks are displayed in a separate tab/dropdown, not always visible
 * @param page - Playwright page object
 * @param timeout - Maximum time to wait for bookmarks tab to appear (default 10000ms)
 * @returns The bookmarks container locator
 */
export async function openBookmarksTab(page: Page, timeout: number = HIERARCHY_TIMEOUT): Promise<Locator> {
    // Wait for the Bookmarks tab to appear (may take time after bookmark creation)
    const bookmarksTab = page.getByRole('button', {name: /Bookmarks/});
    await bookmarksTab.waitFor({state: 'visible', timeout});
    await bookmarksTab.click();
    await page.waitForTimeout(SHORT_WAIT);

    const bookmarksMenu = page.locator('[id$="-menu"]').filter({hasText: /.+/});
    await expect(bookmarksMenu).toBeVisible();
    return bookmarksMenu;
}

/**
 * Verifies a bookmark with the specified name exists in the bookmarks dropdown menu
 * Opens the bookmarks menu if not already open and checks for the bookmark
 * @param page - Playwright page object
 * @param bookmarkName - The name/title of the bookmark to verify
 * @returns The bookmark locator
 */
export async function verifyBookmarkExists(page: Page, bookmarkName: string): Promise<Locator> {
    const bookmarksMenu = await openBookmarksTab(page);
    const bookmark = bookmarksMenu.getByRole('menuitem').filter({hasText: bookmarkName});
    await expect(bookmark).toBeVisible();
    return bookmark;
}

/**
 * Verifies a bookmark does not exist in the bookmarks tab
 * If the bookmarks tab doesn't exist (no bookmarks in channel), that's considered a pass
 * @param page - Playwright page object
 * @param bookmarkName - The name/title of the bookmark to verify is not present
 */
export async function verifyBookmarkNotExists(page: Page, bookmarkName: string): Promise<void> {
    // Check if Bookmarks tab exists
    const bookmarksTab = page.getByRole('button', {name: /Bookmarks/});
    const tabExists = await bookmarksTab.isVisible().catch(() => false);

    if (!tabExists) {
        // No bookmarks tab means no bookmarks at all, which is valid
        return;
    }

    // Open bookmarks and verify the specific bookmark is not present
    const bookmarksContainer = await openBookmarksTab(page);
    const bookmark = bookmarksContainer.getByRole('link', {name: bookmarkName});
    await expect(bookmark).not.toBeVisible();
}

// ============================================================================
// Channel Tab Helpers
// ============================================================================

/**
 * Switches to the Messages tab in the channel header
 * If no Messages tab exists (not in wiki view), this is a no-op
 * @param page - Playwright page object
 * @param timeout - Maximum time to wait for the tab (default: 2000ms)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function switchToMessagesTab(page: Page, timeout: number = WEBSOCKET_WAIT): Promise<void> {
    const messagesTab = page.locator('#channelHeaderDescription').getByRole('button', {name: 'Messages'});
    const isVisible = await messagesTab.isVisible().catch(() => false);

    if (isVisible) {
        await messagesTab.click();
        await page.waitForTimeout(SHORT_WAIT);
    }
    // If not visible, we're probably already in messages view or not in wiki
}

/**
 * Switches to a wiki tab by name
 * Uses a more flexible approach to find the wiki tab
 * @param page - Playwright page object
 * @param wikiName - Name of the wiki to switch to (can be partial match)
 * @param timeout - Maximum time to wait for the tab (default: 10000ms)
 */
export async function switchToWikiTab(
    page: Page,
    wikiName: string,
    timeout: number = HIERARCHY_TIMEOUT,
): Promise<void> {
    // Try exact match first with 'tab' role
    let wikiTab = page.getByRole('tab', {name: wikiName}).first();
    const isVisible = await wikiTab.isVisible().catch(() => false);

    // If not found with exact name, try regex pattern for case-insensitive match
    if (!isVisible) {
        wikiTab = page.getByRole('tab', {name: new RegExp(wikiName, 'i')}).first();
    }

    await wikiTab.waitFor({state: 'visible', timeout});
    await wikiTab.click();
    await page.waitForTimeout(SHORT_WAIT);
}

// ============================================================================
// Post Action Menu Helpers
// ============================================================================

/**
 * Opens the AI actions menu for a specific post
 * @param page - Playwright page object
 * @param postId - ID of the post to interact with
 * @returns The AI actions menu button locator
 */
export async function openAIActionsMenu(page: Page, postId: string): Promise<Locator> {
    const postLocator = page.locator(`#post_${postId}`);
    await expect(postLocator).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await postLocator.hover();

    const aiActionsButton = postLocator.getByRole('button', {name: 'AI Actions'});
    await expect(aiActionsButton).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await aiActionsButton.click();
    await page.waitForTimeout(SHORT_WAIT);

    return aiActionsButton;
}

/**
 * Clicks a specific item in the AI actions menu
 * @param page - Playwright page object
 * @param menuItemName - Name of the menu item to click (e.g., "Summarize to Page")
 */
export async function clickAIActionsMenuItem(page: Page, menuItemName: string): Promise<void> {
    const menuItem = page.getByRole('button', {name: new RegExp(menuItemName, 'i')});
    await expect(menuItem).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await menuItem.click();
}

/**
 * Creates posts in a channel for testing AI summarization
 * @param adminClient - Admin client for API calls
 * @param channelId - ID of the channel to create posts in
 * @param rootMessage - The root message to create
 * @param replies - Array of reply messages
 * @returns The root post object
 */
export async function createPostsForSummarization(
    adminClient: any,
    channelId: string,
    rootMessage: string,
    replies: string[],
): Promise<any> {
    const rootPost = await adminClient.createPost({
        channel_id: channelId,
        message: rootMessage,
    });

    for (const reply of replies) {
        await adminClient.createPost({
            channel_id: channelId,
            message: reply,
            root_id: rootPost.id,
        });
    }

    return rootPost;
}

/**
 * Verifies that a page appears in the hierarchy panel
 * @param page - Playwright page object
 * @param pageTitle - Title of the page to verify
 * @param timeout - Maximum time to wait for the page (default: 10000ms)
 */
export async function verifyPageInHierarchy(
    page: Page,
    pageTitle: string,
    timeout: number = HIERARCHY_TIMEOUT,
): Promise<Locator> {
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');
    await expect(hierarchyPanel).toBeVisible();

    const pageLink = hierarchyPanel.getByText(pageTitle);
    await expect(pageLink).toBeVisible({timeout});

    return pageLink;
}

/**
 * Gets a page tree node by title from the hierarchy panel
 * @param page - Playwright page object
 * @param pageTitle - Title of the page to find
 * @returns The page tree node locator
 */
export function getPageTreeNodeByTitle(page: Page, pageTitle: string): Locator {
    const hierarchyPanel = getHierarchyPanel(page);
    return hierarchyPanel.locator('[data-testid="page-tree-node"]').filter({hasText: pageTitle});
}

/**
 * Expands a page tree node in the hierarchy panel by clicking its expand button (chevron)
 * This is different from clicking the title which navigates to the page
 * @param page - Playwright page object
 * @param pageTitle - Title of the page to expand
 * @param timeout - Optional timeout in milliseconds (default: WEBSOCKET_WAIT)
 */
export async function expandPageTreeNode(
    page: Page,
    pageTitle: string,
    timeout: number = WEBSOCKET_WAIT,
): Promise<void> {
    const pageNode = getPageTreeNodeByTitle(page, pageTitle).first();
    await expect(pageNode).toBeVisible({timeout});

    const expandButton = pageNode.locator('[data-testid="page-tree-node-expand-button"]');
    await expect(expandButton).toBeVisible({timeout});

    // Check if the node is already expanded (chevron-down icon)
    const isAlreadyExpanded = (await pageNode.locator('.icon-chevron-down').count()) > 0;
    if (isAlreadyExpanded) {
        return;
    }

    // Click to expand
    await expandButton.click();

    // Wait for the expand animation - the icon should change from chevron-right to chevron-down
    await expect(pageNode.locator('.icon-chevron-down')).toBeVisible({timeout});
}

/**
 * Opens the three-dot menu for a page in the hierarchy panel by page title
 * @param page - Playwright page object
 * @param pageTitle - Title of the page
 * @returns The context menu locator
 */
export async function openPageTreeNodeMenuByTitle(page: Page, pageTitle: string): Promise<Locator> {
    const pageNode = getPageTreeNodeByTitle(page, pageTitle);
    await pageNode.hover();

    const threeDotButton = pageNode.locator('[data-testid="page-tree-node-menu-button"]');
    await threeDotButton.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    await threeDotButton.click();

    const contextMenu = getPageActionsMenuLocator(page);
    await contextMenu.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

    return contextMenu;
}

/**
 * Opens the version history modal for a page by page title
 * @param page - Playwright page object
 * @param pageTitle - Title of the page
 * @returns The version history modal locator
 */
export async function openVersionHistoryModal(page: Page, pageTitle: string): Promise<Locator> {
    // # Open page three-dot menu
    await openPageTreeNodeMenuByTitle(page, pageTitle);

    // # Click "Version history" menu item
    const versionHistoryMenuItem = page.getByText('Version history', {exact: true});
    await versionHistoryMenuItem.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    await versionHistoryMenuItem.click();

    // # Wait for and return version history modal
    const versionModal = page.locator('.page-version-history-modal');
    await versionModal.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

    return versionModal;
}

/**
 * Gets the version history modal if it's open
 * @param page - Playwright page object
 * @returns The version history modal locator
 */
export function getVersionHistoryModal(page: Page): Locator {
    return page.locator('.page-version-history-modal');
}

/**
 * Gets all version history items from the modal
 * @param page - Playwright page object
 * @returns Locator for all history items
 */
export function getVersionHistoryItems(page: Page): Locator {
    const modal = getVersionHistoryModal(page);
    return modal.locator('.edit-post-history__container');
}

/**
 * Verifies the version history modal displays correct information
 * @param page - Playwright page object
 * @param pageTitle - Expected page title in modal header
 * @param expectedVersionCount - Expected number of historical versions
 */
export async function verifyVersionHistoryModal(page: Page, pageTitle: string, expectedVersionCount: number) {
    const versionModal = getVersionHistoryModal(page);
    await expect(versionModal).toBeVisible();

    // * Verify modal title contains page name
    const modalHeader = versionModal.locator('.GenericModal__header');
    await expect(modalHeader).toContainText(pageTitle);

    // * Verify expected number of historical versions
    const historyItems = getVersionHistoryItems(page);
    await expect(historyItems).toHaveCount(expectedVersionCount, {timeout: ELEMENT_TIMEOUT});
}

/**
 * Clicks the restore button for a specific version in the version history modal
 * @param page - Playwright page object
 * @param versionIndex - Index of the version to restore (0 = most recent historical version)
 */
export async function clickRestoreVersion(page: Page, versionIndex: number): Promise<void> {
    const historyItems = getVersionHistoryItems(page);
    const targetVersion = historyItems.nth(versionIndex);

    // # Wait for the version item to be visible
    await targetVersion.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

    // # Click the restore button (it's always visible, not part of collapsed content)
    const restoreButton = targetVersion.locator('button.restore-icon');
    await restoreButton.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    await restoreButton.click();
}

/**
 * Confirms the restore action in the restore post modal
 * @param page - Playwright page object
 */
export async function confirmRestoreVersion(page: Page): Promise<void> {
    // # Wait for restore modal to appear
    const restoreModal = page.locator('#restorePostModal');
    await restoreModal.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

    // # Click the confirm button in the modal
    const confirmButton = restoreModal.locator('button').filter({hasText: 'Confirm'});
    await confirmButton.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    await confirmButton.click();

    // # Wait for modal to close promptly after user action
    await restoreModal.waitFor({state: 'hidden', timeout: MODAL_CLOSE_TIMEOUT});
}

/**
 * Restores a specific version from the version history modal
 * @param page - Playwright page object
 * @param versionIndex - Index of the version to restore (0 = most recent historical version)
 */
export async function restorePageVersion(page: Page, versionIndex: number): Promise<void> {
    await clickRestoreVersion(page, versionIndex);
    await confirmRestoreVersion(page);

    // # Wait for the restore to complete and modal to close
    await page.waitForTimeout(EDITOR_LOAD_WAIT);
}

/**
 * Gets the content text from a specific version in the version history modal
 * @param page - Playwright page object
 * @param versionIndex - Index of the version (0 = most recent)
 * @returns The text content of the version
 */
export async function getVersionContent(page: Page, versionIndex: number): Promise<string> {
    const historyItems = getVersionHistoryItems(page);
    const targetVersion = historyItems.nth(versionIndex);

    // # Expand the version item if collapsed
    const toggleButton = targetVersion.locator('.toggleCollapseButton');
    const isExpanded = await targetVersion
        .locator('.edit-post-history__content_container')
        .isVisible()
        .catch(() => false);

    if (!isExpanded) {
        await toggleButton.click();
        await page.waitForTimeout(SHORT_WAIT);
    }

    // # Get the content text
    const contentContainer = targetVersion.locator('.edit-post-history__content_container .post__body');
    return (await contentContainer.textContent()) || '';
}

/**
 * Appends content to the editor while in edit mode (does not click edit button)
 * Useful for adding content when already editing a page
 * @param page - Playwright page object
 * @param newContent - Content to append
 */
export async function appendContentInEditor(page: Page, newContent: string) {
    const editor = page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();
    await editor.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    await editor.click();

    // Move to end
    await page.keyboard.press('End');

    // Type new content
    await editor.type(newContent);
}

/**
 * Temporarily grants additional permissions to a role and returns a cleanup function.
 * The cleanup function should be called at the end of the test to restore original permissions.
 *
 * @param adminClient - Admin client to use for API calls
 * @param roleName - Name of the role to modify (e.g., 'channel_user')
 * @param permissions - Array of permission strings to add to the role
 * @returns Cleanup function that restores original permissions
 *
 * @example
 * // Page permissions: create_page, read_page, edit_page, delete_own_page, delete_page
 * // Wiki permissions: use manage_public_channel_properties, manage_private_channel_properties
 * const restorePermissions = await withRolePermissions(adminClient, 'channel_user', [
 *     'edit_page',
 *     'manage_public_channel_properties',
 * ]);
 *
 * // ... test code that needs the permissions ...
 *
 * // Restore original permissions at test end
 * await restorePermissions();
 */
export async function withRolePermissions(
    adminClient: Client4,
    roleName: string,
    permissions: string[],
): Promise<() => Promise<void>> {
    const role = await adminClient.getRoleByName(roleName);
    const originalPermissions = [...role.permissions];

    await adminClient.patchRole(role.id, {
        permissions: [...role.permissions, ...permissions],
    });

    return async () => {
        await adminClient.patchRole(role.id, {
            permissions: originalPermissions,
        });
    };
}

/**
 * Sets up WebSocket event logging for debugging multi-user real-time scenarios
 * Intercepts both raw WebSocket messages AND Redux dispatch to capture events at both levels
 * @param page - Playwright page object
 * @param eventFilters - Array of strings to filter action types (default: PAGE, POST, WIKI, RECEIVED, DELETED, REMOVED, RENAMED)
 */
export async function setupWebSocketEventLogging(
    page: Page,
    eventFilters: string[] = ['PAGE', 'POST', 'WIKI', 'RECEIVED', 'DELETED', 'REMOVED', 'RENAMED'],
) {
    /* eslint-disable prefer-rest-params */
    await page.evaluate((filters) => {
        (window as any).wsEvents = [];
        (window as any).allActions = [];
        (window as any).rawWebSocketMessages = [];

        // Intercept raw WebSocket messages at the WebSocketClient level
        const webSocketClient = (window as any).WebSocketClient;
        if (webSocketClient && webSocketClient.prototype) {
            const originalHandleEvent = webSocketClient.prototype.handleEvent;
            if (originalHandleEvent) {
                webSocketClient.prototype.handleEvent = function (msg: any) {
                    if (msg && msg.event) {
                        const event = String(msg.event).toUpperCase();
                        if (
                            event.includes('PAGE') ||
                            event.includes('POST') ||
                            event.includes('WIKI') ||
                            event.includes('DELETED')
                        ) {
                            (window as any).rawWebSocketMessages.push({
                                event: msg.event,
                                data: msg.data,
                                time: Date.now(),
                            });
                        }
                    }
                    return originalHandleEvent.apply(this, arguments);
                };
            }
        }

        // Intercept Redux dispatch
        const originalDispatch = (window as any).store?.dispatch;
        if (originalDispatch) {
            (window as any).store.dispatch = function (action: any) {
                if (action && action.type) {
                    (window as any).allActions.push({type: action.type, time: Date.now()});
                    const type = String(action.type).toUpperCase();
                    if (filters.some((filter: string) => type.includes(filter))) {
                        (window as any).wsEvents.push({type: action.type, data: action.data, time: Date.now()});
                    }
                }
                return originalDispatch.apply(this, arguments);
            };
        }
    }, eventFilters);
    /* eslint-enable prefer-rest-params */
}

/**
 * Retrieves captured WebSocket events and prints debug information
 * @param page - Playwright page object
 * @param testName - Name of the test for debug output
 * @returns Array of captured WebSocket events
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getWebSocketEvents(page: Page, testName: string = 'Test'): Promise<any[]> {
    const wsEvents = await page.evaluate(() => (window as any).wsEvents || []);
    return wsEvents;
}

/**
 * Verifies that a page is NOT visible in the hierarchy panel
 * @param page - Playwright page object
 * @param pageTitle - Title of the page that should not be visible
 * @param timeout - Timeout for the check (default: ELEMENT_TIMEOUT)
 */
export async function verifyPageNotInHierarchy(page: Page, pageTitle: string, timeout: number = ELEMENT_TIMEOUT) {
    const hierarchyPanel = getHierarchyPanel(page);
    const pageNode = hierarchyPanel.locator('[data-testid="page-tree-node"]').filter({hasText: pageTitle});
    await expect(pageNode).not.toBeVisible({timeout});
}

/**
 * Selects a user from the mention dropdown after typing @username
 * @param page - Playwright page object
 * @param username - Username to select (without @ symbol)
 */
export async function selectMentionFromDropdown(page: Page, username: string): Promise<void> {
    // Wait for mention dropdown to appear
    const mentionDropdown = page.locator('.tiptap-mention-popup').first();
    await expect(mentionDropdown).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // Select the user from dropdown
    const userOption = page.locator(`[data-testid="mentionSuggestion_${username}"]`).first();
    await expect(userOption).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await userOption.click();
}

/**
 * Logs in as a user and navigates to a channel, waiting for the page to be fully loaded
 * This is a common pattern used in most pages tests
 *
 * @param pw - Playwright wrapper with testBrowser
 * @param user - User profile to login as
 * @param teamName - Team name to navigate to
 * @param channelName - Channel name to navigate to
 * @returns The page and channelsPage objects for further interactions
 */
export async function loginAndNavigateToChannel(
    pw: any,
    user: any,
    teamName: string,
    channelName: string,
): Promise<{page: Page; channelsPage: any}> {
    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(teamName, channelName);
    await page.waitForLoadState('networkidle');
    await channelsPage.toBeVisible();
    return {page, channelsPage};
}

/**
 * Interface for shared pages setup from test fixtures
 */
export interface SharedPagesSetup {
    team: Team;
    user: UserProfile;
    adminClient: Client4;
}

/**
 * Complete setup for a test that needs a wiki page in edit mode.
 * Combines login, navigation, wiki creation, and page creation into one call.
 * @param pw - Playwright extended object from test fixture
 * @param sharedPagesSetup - Shared setup containing team, user, and adminClient
 * @param wikiNamePrefix - Prefix for the wiki name (timestamp will be appended)
 * @param pageTitle - Title for the new page
 * @param channelName - Optional channel name (defaults to 'town-square')
 * @returns Object containing page and editor locator
 */
export async function setupWikiPageInEditMode(
    pw: any,
    sharedPagesSetup: SharedPagesSetup,
    wikiNamePrefix: string,
    pageTitle: string,
    channelName: string = 'town-square',
): Promise<{page: Page; editor: Locator}> {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, channelName);
    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    await createWikiThroughUI(page, uniqueName(wikiNamePrefix));
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, pageTitle);
    const editor = await getEditorAndWait(page);

    return {page, editor};
}

/**
 * Inserts a block via slash command and returns the block locator.
 * Waits for the block to be visible before returning.
 * @param page - Playwright page object
 * @param editor - Editor locator
 * @param menuItem - The menu item text to click (e.g., 'Callout', 'Code block')
 * @param blockSelector - CSS selector for the block element (e.g., '.callout', '.code-block')
 * @param query - Optional query to filter the slash menu
 * @returns Locator for the inserted block
 */
export async function insertBlockViaSlashCommand(
    page: Page,
    editor: Locator,
    menuItem: string,
    blockSelector: string,
    query?: string,
): Promise<Locator> {
    await insertViaSlashCommand(page, menuItem, query);
    const block = editor.locator(blockSelector);
    await expect(block).toBeVisible({timeout: ELEMENT_TIMEOUT});
    return block;
}

/**
 * Clicks inside a block element and types text.
 * Useful for blocks where the cursor isn't automatically positioned inside after insertion.
 * @param page - Playwright page object
 * @param block - Locator for the block element
 * @param text - Text to type inside the block
 */
export async function typeInsideBlock(page: Page, block: Locator, text: string): Promise<void> {
    await block.click();
    await page.keyboard.type(text);
}

/**
 * Verifies common block attributes (data-type, role, aria-label, class).
 * Only checks attributes that are provided in the options.
 * @param block - Locator for the block element
 * @param options - Object containing expected attribute values
 */
export async function verifyBlockAttributes(
    block: Locator,
    options: {
        dataType?: string;
        role?: string;
        ariaLabel?: string;
        classPattern?: RegExp;
    },
): Promise<void> {
    if (options.dataType) {
        await expect(block).toHaveAttribute('data-type', options.dataType);
    }
    if (options.role) {
        await expect(block).toHaveAttribute('role', options.role);
    }
    if (options.ariaLabel) {
        await expect(block).toHaveAttribute('aria-label', options.ariaLabel);
    }
    if (options.classPattern) {
        await expect(block).toHaveClass(options.classPattern);
    }
}

// ============================================================================
// Resilience Test Helpers
// ============================================================================

/**
 * Performs rapid clicks on an element for stress testing
 * @param locator - Element to click rapidly
 * @param times - Number of times to click
 * @param delayMs - Optional delay between clicks (default: 50ms)
 */
export async function rapidClick(locator: Locator, times: number, delayMs: number = 50): Promise<void> {
    for (let i = 0; i < times; i++) {
        await locator.click({force: true});
        if (delayMs > 0) {
            await locator.page().waitForTimeout(delayMs);
        }
    }
}

/**
 * Performs undo action using platform-aware keyboard shortcut
 * @param page - Playwright page object
 */
export async function undoAction(page: Page): Promise<void> {
    await pressModifierKey(page, 'z');
    await page.waitForTimeout(UI_MICRO_WAIT * 2);
}

/**
 * Performs redo action using platform-aware keyboard shortcut
 * @param page - Playwright page object
 */
export async function redoAction(page: Page): Promise<void> {
    const isMac = process.platform === 'darwin';
    if (isMac) {
        await page.keyboard.press('Meta+Shift+z');
    } else {
        await page.keyboard.press('Control+y');
    }
    await page.waitForTimeout(UI_MICRO_WAIT * 2);
}

/**
 * Verifies that text in editor has specific formatting via HTML tag
 * @param editor - The editor locator
 * @param tag - HTML tag to check for (e.g., 'strong', 'em', 's')
 * @param text - Text that should have the formatting
 */
export async function verifyTextHasFormatting(editor: Locator, tag: string, text: string): Promise<void> {
    const element = editor.locator(`${tag}:has-text("${text}")`);
    await expect(element).toBeVisible({timeout: ELEMENT_TIMEOUT});
}

/**
 * Verifies that text in editor does NOT have specific formatting
 * @param editor - The editor locator
 * @param tag - HTML tag to check is absent (e.g., 'strong', 'em', 's')
 * @param text - Text that should NOT have the formatting
 */
export async function verifyTextNoFormatting(editor: Locator, tag: string, text: string): Promise<void> {
    const element = editor.locator(`${tag}:has-text("${text}")`);
    await expect(element).not.toBeVisible({timeout: ELEMENT_TIMEOUT});
}

/**
 * Clicks a formatting button by its icon class
 * @param page - Playwright page object
 * @param iconClass - Icon class (e.g., 'icon-format-bold')
 */
export async function clickFormattingButtonByIcon(page: Page, iconClass: string): Promise<void> {
    const formattingBar = await waitForFormattingBar(page);
    const button = formattingBar.locator(`button:has(i.${iconClass})`);
    await button.click();
    await page.waitForTimeout(UI_MICRO_WAIT);
}
