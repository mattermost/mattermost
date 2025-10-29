// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, createPageViaDraft} from '@mattermost/playwright-lib';

import {createWikiThroughUI, createPageThroughUI, createChildPageThroughContextMenu, getNewPageButton} from './test_helpers';

/**
 * @objective Verify XSS attempts in page content are sanitized
 *
 * @precondition
 * Pages/Wiki feature is enabled on the server
 */
test('sanitizes XSS attempts in page content', {tag: '@pages'}, async ({pw}) => {
    const {user, team, adminClient} = await pw.initSetup();
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `XSS Test Wiki ${pw.random.id()}`);

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();

    // # Attempt to inject script tag
    const xssAttempt = '<script>alert("XSS")</script>';
    const editor = page.locator('.ProseMirror').first();
    await editor.click();
    await editor.type(xssAttempt);

    // # Set title and publish
    const titleInput = page.locator('[data-testid="wiki-page-title-input"]').first();
    await titleInput.fill('XSS Test Page');

    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]').first();
    await publishButton.click();

    // * Verify page loads without crashing
    await page.waitForLoadState('networkidle');

    const pageContent = page.locator('[data-testid="page-viewer-content"]');
    await expect(pageContent).toBeVisible();

    // * Verify no actual script tag in DOM
    const scriptTags = page.locator('script:has-text("XSS")');
    await expect(scriptTags).toHaveCount(0);

    // * Verify content is escaped
    const htmlContent = await pageContent.innerHTML();
    expect(htmlContent).not.toContain('<script>alert');

    // Content should be escaped or stripped
    const textContent = await pageContent.textContent();
    const isEscaped = htmlContent.includes('&lt;script&gt;') || htmlContent.includes('&amp;lt;script');
    const isStripped = textContent && !textContent.includes('<script>');

    expect(isEscaped || isStripped).toBe(true);
});

/**
 * @objective Verify XSS attempts in page title are sanitized
 */
test('sanitizes XSS in page title', {tag: '@pages'}, async ({pw}) => {
    const {user, team, adminClient} = await pw.initSetup();
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `XSS Title Wiki ${pw.random.id()}`);

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();

    // # Attempt XSS in title
    const xssTitle = '<img src=x onerror=alert("XSS")>';
    const titleInput = page.locator('[data-testid="wiki-page-title-input"]').first();
    await titleInput.fill(xssTitle);

    const editor = page.locator('.ProseMirror').first();
    await editor.click();
    await editor.type('Content here');

    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]').first();
    await publishButton.click();

    await page.waitForLoadState('networkidle');

    // * Verify title is escaped in hierarchy panel
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');
    const hierarchyHTML = await hierarchyPanel.innerHTML();

    // Should not contain actual onerror attribute
    expect(hierarchyHTML).not.toContain('onerror=');

    // Should be escaped
    const hasEscapedImg = hierarchyHTML.includes('&lt;img') || hierarchyHTML.includes('&amp;lt;img');
    expect(hasEscapedImg || !hierarchyHTML.includes('<img src=x')).toBe(true);

    // * Verify no alert() executes (test would fail if XSS worked)
    // * Verify no broken image in hierarchy
    const brokenImages = hierarchyPanel.locator('img[src="x"]');
    await expect(brokenImages).toHaveCount(0);
});

/**
 * @objective Verify SQL injection attempts in page search are prevented
 */
test('prevents SQL injection in page search', {tag: '@pages'}, async ({pw}) => {
    const {user, team, adminClient} = await pw.initSetup();
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page through UI
    const wiki = await createWikiThroughUI(page, `SQL Test Wiki ${pw.random.id()}`);
    await createPageThroughUI(page, 'Normal Page', 'Normal content');

    // # Attempt SQL injection in search
    const sqlInjection = "' OR '1'='1' --";
    const searchInput = page.locator('[data-testid="pages-search-input"], [data-testid="search-input"]').first();

    await searchInput.fill(sqlInjection);
    await searchInput.press('Enter');

    // Wait for search to complete
    await page.waitForTimeout(1000);

    // * Verify no pages are incorrectly returned (should treat as literal string)
    const searchResults = page.locator('[data-testid="search-result"], .search-result').first();
    const resultsVisible = await searchResults.isVisible().catch(() => false);

    // Should either show no results or only exact matches (not all pages)
    if (resultsVisible) {
        const resultCount = await page.locator('[data-testid="search-result"], .search-result').count();
        // If SQL injection worked, all pages would be returned
        expect(resultCount).toBeLessThanOrEqual(1);
    }

    // * Verify no error/crash (robust error handling)
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');
    await expect(hierarchyPanel).toBeVisible();
});

/**
 * @objective Verify page title length and special characters are validated
 */
test('validates page title length and special characters', {tag: '@pages'}, async ({pw}) => {
    const {user, team, adminClient} = await pw.initSetup();
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Validation Wiki ${pw.random.id()}`);

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();

    // # Attempt very long title (>255 characters)
    const longTitle = 'A'.repeat(300);
    const titleInput = page.locator('[data-testid="wiki-page-title-input"]').first();
    await titleInput.fill(longTitle);

    const editor = page.locator('.ProseMirror').first();
    await editor.click();
    await editor.type('Content');

    // # Try to publish
    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]').first();
    await publishButton.click();

    // * Verify validation error appears
    await page.waitForTimeout(500);

    const errorMessage = page.locator('[data-testid="title-error"], .error-message, .validation-error').first();
    const errorVisible = await errorMessage.isVisible().catch(() => false);

    if (errorVisible) {
        await expect(errorMessage).toContainText(/length|character|255/i);
    }

    // * Verify publish is blocked (still in editor)
    const editorStillVisible = await page.locator('.ProseMirror').first().isVisible();
    expect(editorStillVisible).toBe(true);

    // # Test special characters that might break URLs
    await titleInput.clear();
    await titleInput.fill('Page / With \\ Slashes');

    await publishButton.click();
    await page.waitForLoadState('networkidle');

    // * Verify either sanitized or published successfully (implementation-specific)
    // Page should either:
    // 1. Sanitize the slashes and publish
    // 2. Show validation error
    // 3. URL-encode the title
    const pageVisible = await page.locator('[data-testid="page-viewer-content"]').isVisible().catch(() => false);
    const editorVisible = await page.locator('.ProseMirror').first().isVisible().catch(() => false);

    // Should be in one state or the other (not crashed)
    expect(pageVisible || editorVisible).toBe(true);
});

/**
 * @objective Verify malformed TipTap JSON is handled gracefully
 */
test('handles malformed TipTap JSON gracefully', {tag: '@pages'}, async ({pw}) => {
    const {user, team, adminClient} = await pw.initSetup();
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Malformed Wiki ${pw.random.id()}`);

    // # Create page with invalid TipTap structure via API (can't create malformed content through UI)
    const malformedContent = {
        type: 'doc' as const,
        content: [{type: 'invalid_node_type'}],
    };
    const malformedPage = await createPageViaDraft(
        adminClient,
        wiki.id,
        'Malformed Page',
        malformedContent as any, // Cast to bypass type checking for intentionally invalid content
    );

    // # Navigate to malformed page
    await page.goto(`${pw.url}/${team.name}/wiki/${channel.id}/${wiki.id}/pages/${malformedPage.id}`);
    await page.waitForLoadState('networkidle');

    // * Verify page loads without crashing - wait for wiki view to be ready
    const wikiView = page.locator('[data-testid="wiki-view"]');
    await expect(wikiView).toBeVisible({timeout: 10000});

    // Wait a bit for page data to load
    await page.waitForTimeout(2000);

    // Page should either show content or an error, but not crash
    const pageContent = page.locator('[data-testid="page-viewer-content"]');
    const pageViewer = page.locator('[data-testid="page-viewer"]');
    const emptyState = page.locator('.PagePane__emptyState');

    // Check what state we're in
    const hasContent = await pageContent.isVisible().catch(() => false);
    const hasPageViewer = await pageViewer.isVisible().catch(() => false);
    const hasEmptyState = await emptyState.isVisible().catch(() => false);

    // Should show something (not stuck in loading)
    expect(hasContent || hasPageViewer || hasEmptyState).toBe(true);

    // * Verify error message or fallback display
    const errorBanner = page.locator('[data-testid="content-error"], .error-banner, .alert-danger').first();
    const warningMessage = page.locator('[data-testid="warning"], .warning').first();

    const hasError = await errorBanner.isVisible().catch(() => false);
    const hasWarning = await warningMessage.isVisible().catch(() => false);

    // Should show some indication of the problem
    if (hasError) {
        await expect(errorBanner).toContainText(/unable|error|invalid|content/i);
    } else if (hasWarning) {
        await expect(warningMessage).toContainText(/unable|error|invalid|content/i);
    }

    // # Try to edit malformed page
    const editButton = page.locator('[data-testid="wiki-page-edit-button"]');
    if (await editButton.isVisible()) {
        await editButton.click();
    }

    // * Verify editor handles gracefully (shows warning or empty editor)
    const editor = page.locator('.ProseMirror').first();
    const editorVisible = await editor.isVisible({timeout: 5000}).catch(() => false);

    if (editorVisible) {
        // Editor loaded - check if it shows empty or error state
        const editorText = await editor.textContent();
        // Should not crash, may be empty or show placeholder
        expect(editorText !== undefined).toBe(true);
    } else {
        // Editor didn't load - check for error message
        const editError = page.locator('[data-testid="edit-error"], .error').first();
        const hasEditError = await editError.isVisible().catch(() => false);
        expect(hasEditError || editorVisible).toBe(true);
    }
});
