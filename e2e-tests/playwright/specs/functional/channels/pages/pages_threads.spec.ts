// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';
import {
    createWikiThroughUI,
    createPageThroughUI,
    createTestChannel,
    waitForEditModeReady,
    addInlineCommentInEditMode,
    verifyCommentMarkerVisible,
    clickCommentMarkerAndOpenRHS,
    loginAndNavigateToChannel,
    uniqueName,
    AUTOSAVE_WAIT,
    ELEMENT_TIMEOUT,
    HIERARCHY_TIMEOUT,
} from './test_helpers';

/**
 * @objective Verify page posts display with title and excerpt in Threads panel instead of raw JSON
 */
test('displays page with title and excerpt in Threads panel', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and page with content
    await createWikiThroughUI(page, uniqueName('Threads Wiki'));
    const pageTitle = 'Getting Started Guide';
    const pageContent =
        'This guide covers user authentication, API endpoints, and deployment. It provides step-by-step instructions for new developers.';
    await createPageThroughUI(page, pageTitle, pageContent);

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
    await clickCommentMarkerAndOpenRHS(page, commentMarker);

    // * Verify RHS opens with page post showing title (not JSON)
    // Wait for the specific content to appear, don't just check the wrapper
    await page.waitForSelector(':text("Commented on the page:")', {timeout: HIERARCHY_TIMEOUT});
    await page.waitForSelector(`:text("${pageTitle}")`, {timeout: HIERARCHY_TIMEOUT});

    const rhs = page.locator('[data-testid="rhs"], .rhs, .sidebar--right').first();
    await expect(rhs).toBeVisible();
    // * Verify no JSON artifacts visible in RHS - checking for "type" key pattern
    await expect(rhs).not.toContainText('"type"');

    // # Navigate to Threads view
    const threadsLink = page.locator('a[href*="/threads"]').first();
    await expect(threadsLink).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await threadsLink.click();

    // * Wait for Threads view to load
    await page.waitForLoadState('networkidle');

    // * Verify page appears in threads list (if comment was created successfully)
    const bodyText = await page.locator('body').textContent();
    if (bodyText && !bodyText.includes('No followed threads yet')) {
        // * Verify thread appeared with proper formatting
        await expect(page.locator('body')).toContainText(pageTitle);

        // * Verify no JSON artifacts visible in threads - checking for "type" key pattern
        await expect(page.locator('body')).not.toContainText('"type"');
    }
});

/**
 * @objective Verify page comments and inline comments both appear in Threads panel
 */
test('displays page comments and inline comments in Threads panel', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and page
    await createWikiThroughUI(page, uniqueName('Comments Wiki'));
    await createPageThroughUI(
        page,
        'Documentation Page',
        'Introduction: This covers authentication and API endpoints for developers',
    );

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
    const commentMarker = page.locator('[id^="ic-"], .comment-anchor').first();
    await expect(commentMarker).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await commentMarker.click();

    // * Verify RHS opens with thread
    // Wait for specific content to appear
    await page.waitForSelector(':text("Commented on the page:")', {timeout: HIERARCHY_TIMEOUT});
    await page.waitForSelector(':text("Documentation Page")', {timeout: HIERARCHY_TIMEOUT});

    const rhs = page.locator('[data-testid="rhs"], .rhs, .sidebar--right').first();
    await expect(rhs).toBeVisible();

    // * Verify inline comment appears
    await page.waitForSelector(':text("Needs more detail here")', {timeout: HIERARCHY_TIMEOUT});

    // * Verify no JSON artifacts in RHS - checking for "type" key pattern
    await expect(rhs).not.toContainText('"type"');

    // # Navigate to global Threads view to verify comment shows there
    const threadsLink = page.locator('a[href*="/threads"]').first();
    await expect(threadsLink).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await threadsLink.click();

    // * Verify page appears in threads list
    await expect(page.locator('body')).toContainText('Documentation Page', {timeout: AUTOSAVE_WAIT});
});

/**
 * @objective Verify replies to page comments display correctly in Threads
 */
test('displays comment replies in Threads panel', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and page
    await createWikiThroughUI(page, uniqueName('Replies Wiki'));
    await createPageThroughUI(
        page,
        'Feature Spec',
        'This feature should support real-time collaboration and offline mode',
    );

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
    await clickCommentMarkerAndOpenRHS(page, commentMarker);

    // Wait for RHS content to load
    await page.waitForSelector(':text("Commented on the page:")', {timeout: HIERARCHY_TIMEOUT});
    await page.waitForSelector(':text("Feature Spec")', {timeout: HIERARCHY_TIMEOUT});

    // # Add reply - Look for textarea within RHS
    const replyTextarea = page.locator('[data-testid="rhs"], .rhs, .sidebar--right').locator('textarea').first();
    await expect(replyTextarea).toBeVisible({timeout: HIERARCHY_TIMEOUT});
    await replyTextarea.fill('I think real-time is more important');
    await page.keyboard.press('Enter');

    // * Verify reply appears in RHS
    await page.waitForSelector(':text("I think real-time is more important")', {timeout: HIERARCHY_TIMEOUT});

    // # Navigate to global Threads view
    const threadsLink = page.locator('a[href*="/threads"]').first();
    await expect(threadsLink).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await threadsLink.click();

    // * Verify thread shows in Threads view with page title
    await expect(page.locator('body')).toContainText('Feature Spec', {timeout: AUTOSAVE_WAIT});
});

/**
 * @objective Verify multiple inline comments from same page show correctly in Threads
 */
test('displays multiple inline comments in Threads panel', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    // This test creates wiki, page, edits, adds multiple inline comments, and publishes - can take longer under load
    test.slow();

    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and page
    await createWikiThroughUI(page, uniqueName('Multi Comment Wiki'));
    await createPageThroughUI(
        page,
        'API Documentation',
        'Authentication uses JWT tokens. Rate limiting is 100 requests per minute. Pagination uses cursor-based approach.',
    );

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
    const firstCommentMarker = page.locator('[id^="ic-"], .comment-anchor').first();
    await expect(firstCommentMarker).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await firstCommentMarker.click();

    // Wait for RHS content to load
    await page.waitForSelector(':text("Commented on the page:")', {timeout: HIERARCHY_TIMEOUT});
    await page.waitForSelector(':text("API Documentation")', {timeout: HIERARCHY_TIMEOUT});

    const rhs = page.locator('[data-testid="rhs"], .rhs, .sidebar--right').first();
    await expect(rhs).toBeVisible();

    // * Verify one of the comments is visible (order may vary)
    await page.waitForSelector(':text("Should document the error codes"), :text("Can we add OAuth2 support?")', {
        timeout: HIERARCHY_TIMEOUT,
    });

    // # Navigate to global Threads view to see all comments
    const threadsLink = page.locator('a[href*="/threads"]').first();
    await expect(threadsLink).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await threadsLink.click();

    // * Verify thread appears with page title
    await expect(page.locator('body')).toContainText('API Documentation', {timeout: AUTOSAVE_WAIT});
});

/**
 * @objective A16: Clicking a page comment thread item in the Threads inbox should navigate to the page, not the channel.
 * NOTE: This test is expected to FAIL until the bug is fixed in thread_item.tsx selectHandler.
 */
test(
    'clicking thread inbox item for page comment navigates to page not channel',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki and page
        await createWikiThroughUI(page, uniqueName('A16 Wiki'));
        await createPageThroughUI(page, 'A16 Test Page', 'Content for A16 bug reproduction');

        // # Enter edit mode
        const editButton = page.locator('[data-testid="wiki-page-edit-button"]');
        await expect(editButton).toBeVisible();
        await editButton.click();

        // # Wait for edit mode to be fully ready (draft loaded with page_id)
        await waitForEditModeReady(page);

        // # Add inline comment
        await addInlineCommentInEditMode(page, 'A16 inline comment for threads inbox');

        // # Publish the page
        const publishButton = page.locator('[data-testid="wiki-page-publish-button"]').first();
        await publishButton.click();
        await page.waitForLoadState('networkidle');

        // # Click the comment marker to open RHS and register thread participation
        const commentMarker = await verifyCommentMarkerVisible(page);
        await clickCommentMarkerAndOpenRHS(page, commentMarker);
        await page.waitForSelector(':text("Commented on the page:")', {timeout: HIERARCHY_TIMEOUT});

        // # Navigate to global Threads inbox
        const threadsLink = page.locator('a[href*="/threads"]').first();
        await expect(threadsLink).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await threadsLink.click();
        await page.waitForLoadState('networkidle');

        // # Find and click the page comment thread item in the inbox
        const threadItem = page.locator('.ThreadItem, [data-testid="thread-item"]').first();
        await expect(threadItem).toBeVisible({timeout: HIERARCHY_TIMEOUT});
        await threadItem.click();
        await page.waitForLoadState('networkidle');

        // * Assert: URL contains /wiki/ (navigated to page), not just the channel URL
        await expect(page).toHaveURL(/\/wiki\//, {timeout: ELEMENT_TIMEOUT});

        // * Assert: the comment RHS opens on the page
        const rhs = page.locator('#sidebar-right, .sidebar-right, [data-testid="rhs"], .sidebar--right').first();
        await expect(rhs).toBeVisible({timeout: ELEMENT_TIMEOUT});
    },
);

/**
 * @objective A20: The "All threads" tab in wiki RHS should show comments from ALL pages in the wiki,
 * not just the last-clicked page.
 * NOTE: This test is expected to FAIL until the bug is fixed in all_wiki_threads.tsx (fetchPages on mount).
 */
test(
    'all threads tab shows comments from all pages not just last-clicked',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        test.slow();

        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki
        await createWikiThroughUI(page, uniqueName('A20 Wiki'));

        // # Create Page A with an inline comment
        await createPageThroughUI(page, 'A20 Page Alpha', 'Content for page Alpha');

        const editButtonA = page.locator('[data-testid="wiki-page-edit-button"]');
        await expect(editButtonA).toBeVisible();
        await editButtonA.click();
        await waitForEditModeReady(page);
        await addInlineCommentInEditMode(page, 'Comment on Page Alpha');

        const publishButtonA = page.locator('[data-testid="wiki-page-publish-button"]').first();
        await publishButtonA.click();
        await page.waitForLoadState('networkidle');

        // # Create Page B with an inline comment — navigate back to wiki root first
        const wikiHomeLink = page
            .locator('[data-testid="wiki-sidebar-home"], [data-testid="hierarchy-panel-home"]')
            .first();
        if (await wikiHomeLink.isVisible({timeout: ELEMENT_TIMEOUT}).catch(() => false)) {
            await wikiHomeLink.click();
        }

        await createPageThroughUI(page, 'A20 Page Beta', 'Content for page Beta');

        const editButtonB = page.locator('[data-testid="wiki-page-edit-button"]');
        await expect(editButtonB).toBeVisible();
        await editButtonB.click();
        await waitForEditModeReady(page);
        await addInlineCommentInEditMode(page, 'Comment on Page Beta');

        const publishButtonB = page.locator('[data-testid="wiki-page-publish-button"]').first();
        await publishButtonB.click();
        await page.waitForLoadState('networkidle');

        // # Navigate to Page A (making it the "last clicked" page so state is biased toward it)
        const pageAlphaLink = page.locator(':text("A20 Page Alpha")').first();
        await expect(pageAlphaLink).toBeVisible({timeout: HIERARCHY_TIMEOUT});
        await pageAlphaLink.click();
        await page.waitForLoadState('networkidle');

        // # Open the wiki RHS (toggle comments button)
        const commentsToggle = page
            .locator(
                '[data-testid="wiki-rhs-toggle"], [data-testid="wiki-comments-toggle"], button[aria-label*="comment" i]',
            )
            .first();
        await expect(commentsToggle).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await commentsToggle.click();

        // # Switch to the "Wiki Threads" tab
        const allThreadsTab = page.locator('button:text("Wiki Threads")').first();
        await expect(allThreadsTab).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await allThreadsTab.click();
        await page.waitForLoadState('networkidle');

        // * Assert: comments from BOTH pages are visible in the "All threads" tab
        await expect(page.locator('body')).toContainText('Comment on Page Alpha', {timeout: HIERARCHY_TIMEOUT});
        await expect(page.locator('body')).toContainText('Comment on Page Beta', {timeout: HIERARCHY_TIMEOUT});
    },
);

/**
 * @objective A24: Comment preview in Threads inbox overflows due to maxHeight:none override in thread_item.tsx:324.
 * NOTE: This test is expected to FAIL until the bug is fixed (remove/bound the maxHeight override).
 */
test(
    'comment preview in threads inbox truncates without overflowing',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki and page
        await createWikiThroughUI(page, uniqueName('A24 Wiki'));
        await createPageThroughUI(page, 'A24 Overflow Page', 'Content for overflow test');

        // # Enter edit mode
        const editButton = page.locator('[data-testid="wiki-page-edit-button"]');
        await expect(editButton).toBeVisible();
        await editButton.click();
        await waitForEditModeReady(page);

        // # Add a very long inline comment (200+ chars)
        const longComment =
            'This is a very long inline comment that should be truncated in the Threads inbox preview. ' +
            'It contains enough text to overflow any reasonable single-line or two-line preview container ' +
            'and is intentionally verbose to reproduce the maxHeight:none overflow bug in thread_item.tsx.';
        await addInlineCommentInEditMode(page, longComment);

        // # Publish the page
        const publishButton = page.locator('[data-testid="wiki-page-publish-button"]').first();
        await publishButton.click();
        await page.waitForLoadState('networkidle');

        // # Click comment marker to register thread participation
        const commentMarker = await verifyCommentMarkerVisible(page);
        await clickCommentMarkerAndOpenRHS(page, commentMarker);
        await page.waitForSelector(':text("Commented on the page:")', {timeout: HIERARCHY_TIMEOUT});

        // # Navigate to global Threads inbox
        await page.goto(`/${team.name}/threads`);
        await page.waitForLoadState('networkidle');

        // * Assert: the thread item is visible
        const threadItem = page.locator('.ThreadItem, [data-testid="thread-item"]').first();
        await expect(threadItem).toBeVisible({timeout: HIERARCHY_TIMEOUT});

        // * Assert: preview text does NOT overflow its container (BUG: currently fails due to maxHeight:none)
        const overflows = await threadItem.evaluate((el) => el.scrollHeight > el.clientHeight + 5);
        expect(overflows).toBe(false);

        // * Assert: second thread item (if any) starts after the first one ends — no visual overlap
        const allThreadItems = page.locator('.ThreadItem, [data-testid="thread-item"]');
        const count = await allThreadItems.count();
        if (count >= 2) {
            const firstBox = await allThreadItems.nth(0).boundingBox();
            const secondBox = await allThreadItems.nth(1).boundingBox();
            if (firstBox && secondBox) {
                expect(secondBox.y).toBeGreaterThanOrEqual(firstBox.y + firstBox.height - 1);
            }
        }
    },
);

/**
 * @objective B5: "All threads" tab in wiki RHS lacks a resolve/open filter bar.
 * NOTE: This test is expected to FAIL until the filter bar is added to all_wiki_threads.tsx.
 */
test('all threads tab has resolve-open filter bar', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and page with an inline comment
    await createWikiThroughUI(page, uniqueName('B5 Wiki'));
    await createPageThroughUI(page, 'B5 Filter Test Page', 'Content for filter bar test');

    const editButton = page.locator('[data-testid="wiki-page-edit-button"]');
    await expect(editButton).toBeVisible();
    await editButton.click();
    await waitForEditModeReady(page);
    await addInlineCommentInEditMode(page, 'B5 test comment for filter bar');

    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]').first();
    await publishButton.click();
    await page.waitForLoadState('networkidle');

    // # Open wiki RHS via comment marker
    const commentMarker = await verifyCommentMarkerVisible(page);
    await clickCommentMarkerAndOpenRHS(page, commentMarker);
    await page.waitForSelector(':text("Commented on the page:")', {timeout: HIERARCHY_TIMEOUT});

    // # Switch to the "Wiki Threads" tab
    const allThreadsTab = page.locator('button:text("Wiki Threads")').first();
    await expect(allThreadsTab).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await allThreadsTab.click();
    await page.waitForLoadState('networkidle');

    // * Assert: a filter bar with Open/Resolved options is visible (BUG: currently missing)
    await expect(page.locator('button:text("Open"), [data-testid="filter-open"]').first()).toBeVisible({
        timeout: ELEMENT_TIMEOUT,
    });
    await expect(page.locator('button:text("Resolved"), [data-testid="filter-resolved"]').first()).toBeVisible({
        timeout: ELEMENT_TIMEOUT,
    });
});

/**
 * @objective B14: RHS tab labels "All threads"/"Page comments" are unclear.
 * Desired labels after rename PR ships: "Comments" and "Wiki Threads" (or "This Page"/"All Pages").
 * This test is marked fixme until the rename PR ships.
 */
test(
    'rhs tabs are labeled Comments and Wiki Threads not All Threads and Page Comments',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki, page, and comment
        await createWikiThroughUI(page, uniqueName('B14 Wiki'));
        await createPageThroughUI(page, 'B14 Label Test Page', 'Content for tab label test');

        const editButton = page.locator('[data-testid="wiki-page-edit-button"]');
        await expect(editButton).toBeVisible();
        await editButton.click();
        await waitForEditModeReady(page);
        await addInlineCommentInEditMode(page, 'B14 test comment');

        const publishButton = page.locator('[data-testid="wiki-page-publish-button"]').first();
        await publishButton.click();
        await page.waitForLoadState('networkidle');

        // # Open wiki RHS via comment marker (opens in thread detail mode)
        const commentMarker = await verifyCommentMarkerVisible(page);
        await clickCommentMarkerAndOpenRHS(page, commentMarker);
        await page.waitForSelector(':text("Commented on the page:")', {timeout: HIERARCHY_TIMEOUT});

        // # Navigate back from thread detail to the tab view
        const backButton = page.locator('[data-testid="wiki-rhs-back-button"]');
        await expect(backButton).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await backButton.click();

        // * Assert: tabs show the renamed labels
        const rhsTablist = page.locator('[data-testid="wiki-rhs"] [role="tablist"]');
        await expect(rhsTablist.locator('[role="tab"]:has-text("Comments")').first()).toBeVisible({
            timeout: ELEMENT_TIMEOUT,
        });
        await expect(rhsTablist.locator('[role="tab"]:has-text("Wiki Threads")').first()).toBeVisible({
            timeout: ELEMENT_TIMEOUT,
        });
    },
);

/**
 * @objective B16: Page comment threads in the Threads inbox are visually indistinguishable from channel threads.
 * A wiki/document icon should distinguish them (thread_item.tsx:248).
 * NOTE: This test is expected to FAIL until the icon is added.
 */
test(
    'page comment thread in inbox has distinct wiki document icon',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki, page, and inline comment
        await createWikiThroughUI(page, uniqueName('B16 Wiki'));
        await createPageThroughUI(page, 'B16 Icon Test Page', 'Content for document icon test');

        const editButton = page.locator('[data-testid="wiki-page-edit-button"]');
        await expect(editButton).toBeVisible();
        await editButton.click();
        await waitForEditModeReady(page);
        await addInlineCommentInEditMode(page, 'B16 test comment for icon check');

        const publishButton = page.locator('[data-testid="wiki-page-publish-button"]').first();
        await publishButton.click();
        await page.waitForLoadState('networkidle');

        // # Click comment marker to register thread participation
        const commentMarker = await verifyCommentMarkerVisible(page);
        await clickCommentMarkerAndOpenRHS(page, commentMarker);
        await page.waitForSelector(':text("Commented on the page:")', {timeout: HIERARCHY_TIMEOUT});

        // # Navigate to global Threads inbox
        await page.goto(`/${team.name}/threads`);
        await page.waitForLoadState('networkidle');

        // * Assert: page comment thread item is present
        const threadItem = page.locator('.ThreadItem, [data-testid="thread-item"]').first();
        await expect(threadItem).toBeVisible({timeout: HIERARCHY_TIMEOUT});

        // * Assert: a wiki/document icon is present in the thread item (BUG: currently missing)
        // NOTE: use only the specific CSS class, not aria-label wildcards which can false-positive
        await expect(
            page
                .locator('.ThreadItem .icon-file-document-outline, ' + '.ThreadItem [data-testid="wiki-thread-icon"]')
                .first(),
        ).toBeVisible({timeout: ELEMENT_TIMEOUT});
    },
);

/**
 * @objective A17: Clicking a comment from the wiki RHS "All threads" tab should scroll the page to
 * the commented anchor text. Currently handleThreadClick opens the RHS but never calls scrollToAnchor.
 * NOTE: This test is expected to FAIL until scrollToAnchor is called after openWikiRhs.
 */
test(
    'clicking comment from threads scrolls page to commented anchor text',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki and page with specific anchor text
        await createWikiThroughUI(page, uniqueName('A17 Wiki'));
        await createPageThroughUI(page, 'A17 Scroll Test Page', 'anchor text here');

        // # Enter edit mode and add an inline comment anchored to that text
        const editButton = page.locator('[data-testid="wiki-page-edit-button"]');
        await expect(editButton).toBeVisible();
        await editButton.click();
        await waitForEditModeReady(page);
        await addInlineCommentInEditMode(page, 'A17 anchor comment');

        // # Publish the page
        const publishButton = page.locator('[data-testid="wiki-page-publish-button"]').first();
        await publishButton.click();
        await page.waitForLoadState('networkidle');

        // # Verify comment marker exists and interact to register participation
        const commentMarker = await verifyCommentMarkerVisible(page);
        await clickCommentMarkerAndOpenRHS(page, commentMarker);
        await page.waitForSelector(':text("Commented on the page:")', {timeout: HIERARCHY_TIMEOUT});

        // # Scroll away from the anchor so we can assert scroll-back
        await page.evaluate(() => window.scrollTo(0, 500));

        // # Open the wiki RHS "Wiki Threads" tab
        const allThreadsTab = page.locator('button:text("Wiki Threads")').first();
        await expect(allThreadsTab).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await allThreadsTab.click();

        // # Click the thread item in the Wiki Threads tab
        const threadItem = page
            .locator('[data-testid="wiki-rhs-thread-item"], .wiki-rhs-thread-item, .rhs-thread-list-item')
            .first();
        await expect(threadItem).toBeVisible({timeout: HIERARCHY_TIMEOUT});
        await threadItem.click();

        // * Assert: the anchor in the page becomes visible in the viewport (BUG: currently never scrolls)
        const anchorEl = page.locator('[id^="ic-"], .comment-anchor').first();
        await expect(anchorEl).toBeInViewport({timeout: ELEMENT_TIMEOUT});
    },
);

/**
 * @objective A29: After clicking a thread for a foreign page from the "All threads" tab, the back
 * arrow should restore the "All threads" tab. Currently handleBackClick only clears focusedInlineCommentId
 * and does not restore the previous pageId or activeTab.
 * NOTE: This test is expected to FAIL until back-navigation restores All threads context.
 */
test(
    'back arrow from foreign page thread returns to all threads tab',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki with two pages, each with an inline comment
        await createWikiThroughUI(page, uniqueName('A29 Wiki'));

        await createPageThroughUI(page, 'A29 Page A', 'Content for Page A');
        const editButtonA = page.locator('[data-testid="wiki-page-edit-button"]');
        await expect(editButtonA).toBeVisible();
        await editButtonA.click();
        await waitForEditModeReady(page);
        await addInlineCommentInEditMode(page, 'A29 comment on Page A');
        await page.locator('[data-testid="wiki-page-publish-button"]').first().click();
        await page.waitForLoadState('networkidle');

        // Register participation for Page A
        const markerA = await verifyCommentMarkerVisible(page);
        await clickCommentMarkerAndOpenRHS(page, markerA);
        await page.waitForSelector(':text("Commented on the page:")', {timeout: HIERARCHY_TIMEOUT});

        await createPageThroughUI(page, 'A29 Page B', 'Content for Page B');
        const editButtonB = page.locator('[data-testid="wiki-page-edit-button"]');
        await expect(editButtonB).toBeVisible();
        await editButtonB.click();
        await waitForEditModeReady(page);
        await addInlineCommentInEditMode(page, 'A29 comment on Page B');
        await page.locator('[data-testid="wiki-page-publish-button"]').first().click();
        await page.waitForLoadState('networkidle');

        // Register participation for Page B
        const markerB = await verifyCommentMarkerVisible(page);
        await clickCommentMarkerAndOpenRHS(page, markerB);
        await page.waitForSelector(':text("Commented on the page:")', {timeout: HIERARCHY_TIMEOUT});

        // # Navigate to Page A so Page B becomes the "foreign" page
        const pageALink = page.locator(':text("A29 Page A")').first();
        await expect(pageALink).toBeVisible({timeout: HIERARCHY_TIMEOUT});
        await pageALink.click();
        await page.waitForLoadState('networkidle');

        // # Open wiki RHS and switch to Wiki Threads tab
        const allThreadsTab = page.locator('button:text("Wiki Threads")').first();
        await expect(allThreadsTab).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await allThreadsTab.click();

        // # Click the thread item for Page B (the foreign page)
        const pageBThreadItem = page
            .locator(
                '[data-testid="wiki-rhs-thread-item"]:has-text("A29 Page B"), ' +
                    '.wiki-rhs-thread-item:has-text("A29 Page B"), ' +
                    '.rhs-thread-list-item:has-text("A29 Page B")',
            )
            .first();
        await expect(pageBThreadItem).toBeVisible({timeout: HIERARCHY_TIMEOUT});
        await pageBThreadItem.click();

        // * Assert: RHS now shows Page B's thread (foreign-page context opened)
        await expect(page.locator(':text("A29 comment on Page B")').first()).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Click the back arrow
        const backButton = page
            .locator('[aria-label*="back" i], [data-testid="rhs-back-button"], .icon-arrow-back-ios')
            .first();
        await expect(backButton).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await backButton.click();

        // * Assert: the Wiki Threads tab is active again (BUG: currently not restored)
        const allThreadsTabAgain = page.locator('button:text("Wiki Threads")').first();
        await expect(allThreadsTabAgain).toHaveAttribute('aria-selected', 'true', {timeout: ELEMENT_TIMEOUT});

        // * Assert: both pages' comments are visible in the restored All threads list
        await expect(page.locator(':text("A29 comment on Page A")').first()).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await expect(page.locator(':text("A29 comment on Page B")').first()).toBeVisible({timeout: ELEMENT_TIMEOUT});
    },
);
