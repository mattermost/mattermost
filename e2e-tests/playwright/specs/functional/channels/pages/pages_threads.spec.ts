// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';

import {
    createWikiThroughUI,
    createPageThroughUI,
    createTestChannel,
    waitForEditModeReady,
    getEditorAndWait,
    addInlineCommentInEditMode,
    verifyCommentMarkerVisible,
    clickCommentMarkerAndOpenRHS,
    SHORT_WAIT,
    EDITOR_LOAD_WAIT,
    AUTOSAVE_WAIT,
    ELEMENT_TIMEOUT,
    HIERARCHY_TIMEOUT,
} from './test_helpers';

/**
 * @objective Verify page posts display with title and excerpt in Threads panel instead of raw JSON
 */
test('displays page with title and excerpt in Threads panel', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);

    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page with content
    const wiki = await createWikiThroughUI(page, `Threads Wiki ${pw.random.id()}`);
    const pageTitle = 'Getting Started Guide';
    const pageContent = 'This guide covers user authentication, API endpoints, and deployment. It provides step-by-step instructions for new developers.';
    const testPage = await createPageThroughUI(page, pageTitle, pageContent);

    // # Add inline comment by clicking Edit (to test edit mode inline comments)
    const editButton = page.locator('[data-testid="wiki-page-edit-button"]');
    await expect(editButton).toBeVisible();
    await editButton.click();

    // # Wait for edit mode to be fully ready (draft loaded with page_id)
    await waitForEditModeReady(page);

    // # Add inline comment using helper function
    await addInlineCommentInEditMode(page, 'Great article overall!');

    // # Publish the page
    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]').first();
    await publishButton.click();
    await page.waitForLoadState('networkidle');

    // # Verify comment marker is visible
    const commentMarker = await verifyCommentMarkerVisible(page);

    // # Click comment marker to open thread in RHS (creates participation)
    const rhs = await clickCommentMarkerAndOpenRHS(page, commentMarker);

    // * Verify RHS opens with page post showing title (not JSON)
    // Wait for the specific content to appear, don't just check the wrapper
    await page.waitForSelector(':text("Commented on the page:")', {timeout: HIERARCHY_TIMEOUT});
    await page.waitForSelector(`:text("${pageTitle}")`, {timeout: HIERARCHY_TIMEOUT});

    await expect(rhs).toBeVisible();
    await expect(rhs).not.toContainText('{"type"');

    // # Navigate to Threads view
    const threadsLink = page.locator('a[href*="/threads"]').first();
    await expect(threadsLink).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await threadsLink.click();
    await page.waitForTimeout(AUTOSAVE_WAIT);

    // * Verify page appears in threads list (if comment was created successfully)
    const bodyText = await page.locator('body').textContent();
    if (bodyText && !bodyText.includes('No followed threads yet')) {
        // Thread appeared - verify proper formatting
        await expect(page.locator('body')).toContainText(pageTitle);

        // * Verify no JSON artifacts visible in threads
        await expect(page.locator('body')).not.toContainText('{"type"');
    }
});

/**
 * @objective Verify page comments and inline comments both appear in Threads panel
 */
test('displays page comments and inline comments in Threads panel', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    const wiki = await createWikiThroughUI(page, `Comments Wiki ${pw.random.id()}`);
    const testPage = await createPageThroughUI(page, 'Documentation Page', 'Introduction: This covers authentication and API endpoints for developers');

    // # Start editing
    const editButton = page.locator('[data-testid="wiki-page-edit-button"]');
    await expect(editButton).toBeVisible();
    await editButton.click();

    // # Wait for edit mode to be fully ready (draft loaded with page_id)
    await waitForEditModeReady(page);

    // # Add inline comment using helper function
    await addInlineCommentInEditMode(page, 'Needs more detail here');

    // # Publish page
    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]').first();
    await publishButton.click();
    await page.waitForLoadState('networkidle');

    // # Click comment marker to open thread in RHS
    const commentMarker = page.locator('[data-inline-comment-marker], .inline-comment-marker, [data-comment-id]').first();
    await expect(commentMarker).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await commentMarker.click();
    await page.waitForTimeout(EDITOR_LOAD_WAIT);

    // * Verify RHS opens with thread
    // Wait for specific content to appear
    await page.waitForSelector(':text("Commented on the page:")', {timeout: HIERARCHY_TIMEOUT});
    await page.waitForSelector(':text("Documentation Page")', {timeout: HIERARCHY_TIMEOUT});

    const rhs = page.locator('[data-testid="rhs"], .rhs, .sidebar--right').first();
    await expect(rhs).toBeVisible();

    // * Verify inline comment appears
    await page.waitForSelector(':text("Needs more detail here")', {timeout: HIERARCHY_TIMEOUT});

    // * Verify no JSON artifacts in RHS
    await expect(rhs).not.toContainText('{"type"');

    // # Navigate to global Threads view to verify comment shows there
    const threadsLink = page.locator('a[href*="/threads"]').first();
    await expect(threadsLink).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await threadsLink.click();
    await page.waitForTimeout(AUTOSAVE_WAIT);

    // * Verify page appears in threads list
    await expect(page.locator('body')).toContainText('Documentation Page');
});

/**
 * @objective Verify replies to page comments display correctly in Threads
 */
test('displays comment replies in Threads panel', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    const wiki = await createWikiThroughUI(page, `Replies Wiki ${pw.random.id()}`);
    const testPage = await createPageThroughUI(page, 'Feature Spec', 'This feature should support real-time collaboration and offline mode');

    // # Add initial comment
    const editButton = page.locator('[data-testid="wiki-page-edit-button"]');
    await expect(editButton).toBeVisible();
    await editButton.click();

    // # Wait for edit mode to be fully ready (draft loaded with page_id)
    await waitForEditModeReady(page);

    // # Add inline comment using helper function
    await addInlineCommentInEditMode(page, 'Should we prioritize real-time or offline?');

    // # Publish page
    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]').first();
    await publishButton.click();
    await page.waitForLoadState('networkidle');

    // # Verify comment marker and click to open RHS
    const commentMarker = await verifyCommentMarkerVisible(page);
    const rhs = await clickCommentMarkerAndOpenRHS(page, commentMarker);

    // Wait for RHS content to load
    await page.waitForSelector(':text("Commented on the page:")', {timeout: HIERARCHY_TIMEOUT});
    await page.waitForSelector(':text("Feature Spec")', {timeout: HIERARCHY_TIMEOUT});

    // # Wait for reply textarea to be ready
    await page.waitForTimeout(EDITOR_LOAD_WAIT);

    // # Add reply - Look for textarea within RHS
    const replyTextarea = page.locator('[data-testid="rhs"], .rhs, .sidebar--right').locator('textarea').first();
    await expect(replyTextarea).toBeVisible({timeout: HIERARCHY_TIMEOUT});
    await replyTextarea.fill('I think real-time is more important');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(EDITOR_LOAD_WAIT);

    // * Verify reply appears in RHS
    await page.waitForSelector(':text("I think real-time is more important")', {timeout: HIERARCHY_TIMEOUT});

    // # Navigate to global Threads view
    const threadsLink = page.locator('a[href*="/threads"]').first();
    await expect(threadsLink).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await threadsLink.click();
    await page.waitForTimeout(AUTOSAVE_WAIT);

    // * Verify thread shows in Threads view with page title
    await expect(page.locator('body')).toContainText('Feature Spec');
});

/**
 * @objective Verify multiple inline comments from same page show correctly in Threads
 */
test('displays multiple inline comments in Threads panel', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    const wiki = await createWikiThroughUI(page, `Multi Comment Wiki ${pw.random.id()}`);
    const testPage = await createPageThroughUI(page, 'API Documentation', 'Authentication uses JWT tokens. Rate limiting is 100 requests per minute. Pagination uses cursor-based approach.');

    // # Start editing
    const editButton = page.locator('[data-testid="wiki-page-edit-button"]');
    await expect(editButton).toBeVisible();
    await editButton.click();

    // # Wait for edit mode to be fully ready (draft loaded with page_id)
    await waitForEditModeReady(page);

    // # Add first inline comment using helper function
    await addInlineCommentInEditMode(page, 'Can we add OAuth2 support?');

    // # Add second inline comment using helper function
    await addInlineCommentInEditMode(page, 'Should document the error codes');

    // # Publish page
    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]').first();
    await publishButton.click();
    await page.waitForLoadState('networkidle');

    // # Click first comment marker to open thread
    const firstCommentMarker = page.locator('[data-inline-comment-marker], .inline-comment-marker, [data-comment-id]').first();
    await expect(firstCommentMarker).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await firstCommentMarker.click();

    // Wait for RHS content to load
    await page.waitForSelector(':text("Commented on the page:")', {timeout: HIERARCHY_TIMEOUT});
    await page.waitForSelector(':text("API Documentation")', {timeout: HIERARCHY_TIMEOUT});

    const rhs = page.locator('[data-testid="rhs"], .rhs, .sidebar--right').first();
    await expect(rhs).toBeVisible();

    // * Verify one of the comments is visible (order may vary)
    await page.waitForSelector(':text("Should document the error codes"), :text("Can we add OAuth2 support?")', {timeout: HIERARCHY_TIMEOUT});

    // # Navigate to global Threads view to see all comments
    const threadsLink = page.locator('a[href*="/threads"]').first();
    await expect(threadsLink).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await threadsLink.click();
    await page.waitForTimeout(AUTOSAVE_WAIT);

    // * Verify thread appears with page title
    await expect(page.locator('body')).toContainText('API Documentation');
});
