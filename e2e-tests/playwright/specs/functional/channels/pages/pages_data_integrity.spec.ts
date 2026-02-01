// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';
import {
    createWikiThroughUI,
    createPageThroughUI,
    getEditor,
    getNewPageButton,
    getPageViewerContent,
    fillCreatePageModal,
    publishCurrentPage,
    getEditorAndWait,
    typeInEditor,
    getHierarchyPanel,
    loginAndNavigateToChannel,
    uniqueName,
    UI_MICRO_WAIT,
    EDITOR_LOAD_WAIT,
} from './test_helpers';

/**
 * @objective Verify XSS attempts in page content are sanitized
 *
 * @precondition
 * Pages/Wiki feature is enabled on the server
 */
test('sanitizes XSS attempts in page content', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('XSS Test Wiki'));

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'XSS Test Page');

    // # Attempt to inject script tag
    const xssAttempt = '<script>alert("XSS")</script>';
    await getEditorAndWait(page);
    await typeInEditor(page, xssAttempt);

    await publishCurrentPage(page);

    // * Verify page loads without crashing

    const pageContent = getPageViewerContent(page);
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
test('sanitizes XSS in page title', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('XSS Title Wiki'));

    // # Create new page with XSS attempt in title
    const xssTitle = '<img src=x onerror=alert("XSS")>';
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, xssTitle);

    await getEditorAndWait(page);
    await typeInEditor(page, 'Content here');

    await publishCurrentPage(page);

    // * Verify title is escaped in hierarchy panel
    const hierarchyPanel = getHierarchyPanel(page);
    const hierarchyHTML = await hierarchyPanel.innerHTML();

    // * Verify the img tag is escaped (not an actual HTML element)
    const hasActualImgTag = hierarchyHTML.includes('<img src=x');
    expect(hasActualImgTag).toBe(false);

    // * Verify content is escaped (< and > should be &lt; and &gt;)
    const hasEscapedImg = hierarchyHTML.includes('&lt;img') || hierarchyHTML.includes('&amp;lt;img');
    expect(hasEscapedImg).toBe(true);

    // * Verify no alert() executes (test would fail if XSS worked)
    // * Verify no broken image in hierarchy (no actual img element was created)
    const brokenImages = hierarchyPanel.locator('img[src="x"]');
    await expect(brokenImages).toHaveCount(0);
});

/**
 * @objective Verify SQL injection attempts in page search are prevented
 */
test('prevents SQL injection in page search', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and page through UI
    await createWikiThroughUI(page, uniqueName('SQL Test Wiki'));
    await createPageThroughUI(page, 'Normal Page', 'Normal content');

    // # Attempt SQL injection in search
    const sqlInjection = "' OR '1'='1' --";
    const searchInput = page.locator('[data-testid="pages-search-input"], [data-testid="search-input"]').first();

    await searchInput.fill(sqlInjection);
    await searchInput.press('Enter');

    // Wait for search to complete
    await page.waitForTimeout(EDITOR_LOAD_WAIT);

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
    const hierarchyPanel = getHierarchyPanel(page);
    await expect(hierarchyPanel).toBeVisible();
});

/**
 * @objective Verify page title length and special characters are validated
 */
test('validates page title length and special characters', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Validation Wiki'));

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Validation Test Page');

    // # Attempt very long title (>255 characters)
    const longTitle = 'A'.repeat(300);
    const titleInput = page.locator('[data-testid="wiki-page-title-input"]').first();
    await titleInput.fill(longTitle);

    await getEditorAndWait(page);
    await typeInEditor(page, 'Content');

    // # Try to publish
    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]').first();
    await publishButton.click();

    // * Verify validation error appears
    await page.waitForTimeout(EDITOR_LOAD_WAIT);

    // Check for error in announcement bar (backend validation shows here)
    const errorBanner = page.locator('[data-testid="announcement-bar"], .announcement-bar').first();
    const errorBannerVisible = await errorBanner.isVisible().catch(() => false);

    // Also check for inline error message
    const errorMessage = page.locator('[data-testid="title-error"], .error-message, .validation-error').first();
    const errorVisible = await errorMessage.isVisible().catch(() => false);

    if (errorBannerVisible || errorVisible) {
        const errorText = await (errorBannerVisible ? errorBanner : errorMessage).textContent();
        expect(errorText).toMatch(/length|character|255|too.*long/i);

        // Dismiss the error banner if it's visible
        if (errorBannerVisible) {
            const closeButton = errorBanner
                .locator('a[href="#"], button')
                .filter({hasText: /×|close|dismiss/i})
                .first();
            const closeVisible = await closeButton.isVisible().catch(() => false);
            if (closeVisible) {
                await closeButton.click();
                await page.waitForTimeout(UI_MICRO_WAIT * 3);
            }
        }
    }

    // * Verify publish is blocked (still in editor)
    const editorStillVisible = await getEditor(page).first().isVisible();
    expect(editorStillVisible).toBe(true);

    // # Test special characters that might break URLs
    await titleInput.clear();
    await page.waitForTimeout(UI_MICRO_WAIT);
    const specialCharTitle = 'Page / With \\ Slashes';
    await titleInput.fill(specialCharTitle);
    await page.waitForTimeout(UI_MICRO_WAIT * 3); // Wait for title to be saved

    await publishButton.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(EDITOR_LOAD_WAIT); // Additional wait for page render

    // * Verify either sanitized/encoded and published, or validation error shown
    const pageViewer = getPageViewerContent(page);
    const pageViewerVisible = await pageViewer.isVisible().catch(() => false);
    const editorStillVisibleAfterPublish = await page
        .locator('.ProseMirror')
        .first()
        .isVisible()
        .catch(() => false);

    if (pageViewerVisible) {
        // * Page published successfully - verify title handling
        const publishedTitle = page.locator('[data-testid="page-viewer-title"]');
        const titleText = await publishedTitle.textContent();

        // Title should exist and be visible (not null/empty)
        expect(titleText).toBeTruthy();

        // Verify title contains the core text
        expect(titleText).toMatch(/Page.*With.*Slashes/i);

        // * Verify URL is still functional despite special characters in title
        // The URL should be properly encoded, not broken by the slashes in the title
        const currentUrl = page.url();
        expect(currentUrl).toContain('/wiki/');

        // * Verify page viewer is accessible (doesn't crash with special char titles)
        await expect(pageViewer).toBeVisible();
    } else if (editorStillVisibleAfterPublish) {
        // * Validation error shown - verify error message exists
        const validationError = page
            .locator('[data-testid="title-error"], .error-message, .validation-error, [data-testid="announcement-bar"]')
            .first();
        const errorVisible = await validationError.isVisible().catch(() => false);

        expect(errorVisible).toBe(true);

        if (errorVisible) {
            const errorText = await validationError.textContent();
            // Error should mention invalid characters or title validation
            expect(errorText).toMatch(/invalid|character|title|slash/i);
        }
    } else {
        // * If neither state is visible, the page crashed - fail the test
        throw new Error('Page neither published nor showed validation error - possible crash');
    }
});

/**
 * NOTE: Test for malformed TipTap JSON moved to backend integration tests
 *
 * Malformed JSON cannot be created through normal UI flows and would require API calls
 * to test, which defeats the purpose of E2E testing. This edge case is now covered by
 * backend integration tests in server/channels/app/page_draft_test.go
 *
 * See: TestPublishPageDraftWithMalformedContent
 */
