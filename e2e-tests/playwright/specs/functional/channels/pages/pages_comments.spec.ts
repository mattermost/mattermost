// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';
import {
    createWikiThroughUI,
    createPageThroughUI,
    createTestChannel,
    createTestUserInChannel,
    getNewPageButton,
    fillCreatePageModal,
    ensurePanelOpen,
    enterEditMode,
    selectTextInEditor,
    openInlineCommentModal,
    fillAndSubmitCommentModal,
    verifyCommentMarkerVisible,
    clickCommentMarkerAndOpenRHS,
    verifyWikiRHSContent,
    addInlineCommentInEditMode,
    addInlineCommentAndVerify,
    toggleCommentResolution,
    deleteCommentFromRHS,
    publishPage,
    addReplyToCommentThread,
    openWikiRHSViaToggleButton,
    switchToWikiRHSTab,
    createWikiAndPage,
    setupPageWithComment,
    closeWikiRHS,
    clickCommentFilter,
    verifyCommentsEmptyState,
    getThreadItemAndVerify,
    getEditor,
    waitForFormattingBar,
    pressModifierKey,
    openPostDotMenu,
    navigateToChannelFromWiki,
    uniqueName,
    loginAndNavigateToChannel,
    navigateToPage,
    ELEMENT_TIMEOUT,
    WEBSOCKET_WAIT,
    HIERARCHY_TIMEOUT,
    SHORT_WAIT,
} from './test_helpers';

/**
 * @objective Verify inline comment creation on selected text
 */
test('creates inline comment on selected text', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    await createWikiAndPage(page, uniqueName('Comment Wiki'), 'Test Page', 'This is important text');

    // # Enter edit mode
    await enterEditMode(page);

    // # Select text and add inline comment
    await selectTextInEditor(page);
    const commentModal = await openInlineCommentModal(page);
    await fillAndSubmitCommentModal(page, commentModal, 'This needs clarification');

    // # Publish page
    await publishPage(page);

    // * Verify comment marker visible and click to open RHS
    const commentMarker = await verifyCommentMarkerVisible(page);
    const rhs = await clickCommentMarkerAndOpenRHS(page, commentMarker);

    // * Verify comment thread contains the anchor text and comment message
    await verifyWikiRHSContent(page, rhs, ['This is important text', 'This needs clarification']);
});

/**
 * @objective Verify reply threading in inline comments
 */
test('replies to inline comment thread', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and page through UI
    await createWikiAndPage(
        page,
        uniqueName('Reply Wiki'),
        'Discussion Page',
        'This feature needs discussion about implementation details',
    );

    // # Add initial comment
    await enterEditMode(page);
    await addInlineCommentInEditMode(page, 'Should we use approach A or B?');

    // # Publish the page
    await publishPage(page);

    // # Verify marker exists and click to open RHS
    const commentMarker = await verifyCommentMarkerVisible(page);
    const rhs = await clickCommentMarkerAndOpenRHS(page, commentMarker);

    // # Add reply
    await addReplyToCommentThread(page, rhs, 'I think approach B is better');

    // * Verify reply appears
    await expect(rhs).toContainText('I think approach B is better');
});

/**
 * @objective Verify resolve/unresolve comment functionality
 */
test('resolves and unresolves inline comment', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Setup: Create wiki, page, add comment, and publish
    const {marker} = await setupPageWithComment(
        page,
        uniqueName('Resolve Wiki'),
        'Review Page',
        'This section needs review by team lead',
        'Reviewed and approved',
    );

    // # Click marker to open RHS
    const rhs = await clickCommentMarkerAndOpenRHS(page, marker ?? undefined);

    // # Resolve the comment
    await toggleCommentResolution(page, rhs);

    // * Verify comment marker highlight disappears from editor when resolved
    // The mark still exists but .comment-anchor-active class (which shows highlight) is removed
    const highlight = page.locator('.comment-anchor-active').first();
    await expect(highlight).not.toBeVisible({timeout: WEBSOCKET_WAIT});

    // # Unresolve the comment
    await toggleCommentResolution(page, rhs);

    // * Verify highlight reappears in editor when unresolved
    // The .comment-anchor-active class is re-added via decorations
    const highlightAfterUnresolve = page.locator('.comment-anchor-active').first();
    await expect(highlightAfterUnresolve).toBeVisible({timeout: WEBSOCKET_WAIT});
});

/**
 * @objective Verify navigation between multiple comments
 */
test('navigates between multiple inline comments', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Multi Comment Wiki'));

    // # Create page with multiple paragraphs through UI
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Multi-Comment Page');

    const editor = getEditor(page);
    await editor.click();
    await editor.type('Section 1 needs work.');
    await editor.press('Enter');
    await editor.type('Section 2 looks good.');
    await editor.press('Enter');
    await editor.type('Section 3 needs clarification.');

    await publishPage(page);

    // # Enter edit mode and add both inline comments
    await enterEditMode(page);

    // Add first comment
    await addInlineCommentInEditMode(page, 'Comment on section 1', 'Section 1 needs work');

    // Close RHS if it opened after first comment
    await closeWikiRHS(page).catch(() => {}); // Ignore error if already closed

    // Add second comment
    await addInlineCommentInEditMode(page, 'Comment on section 2', 'Section 2 looks good');

    // Close RHS after second comment before publishing
    await closeWikiRHS(page).catch(() => {}); // Ignore error if already closed

    // # Publish page with both comments
    await publishPage(page);

    // * Verify both comment markers exist AND inline comments are loaded from API.
    // Use `[id^="ic-"]` so we target the outer mark spans only — the
    // `comment-anchor-active` class is also re-applied by a nested decoration span,
    // so a `.comment-anchor-active` selector would double-count each marker.
    const activeMarkers = page.locator('[id^="ic-"].comment-anchor');
    await expect(async () => {
        const markerCount = await activeMarkers.count();
        expect(markerCount).toBeGreaterThanOrEqual(2);
    }).toPass({timeout: ELEMENT_TIMEOUT});

    // * Verify each marker is clickable and opens RHS
    const marker1 = activeMarkers.nth(0);
    const marker2 = activeMarkers.nth(1);

    await marker1.click();
    const rhs = page.locator('[data-testid="wiki-rhs"]');
    await expect(rhs).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await expect(rhs).toContainText('Comment on section 1');

    await marker2.click();
    await expect(rhs).toContainText('Comment on section 2', {timeout: ELEMENT_TIMEOUT});
});

/**
 * @objective Verify multiple comment markers display correctly
 */
test('displays multiple inline comment markers distinctly', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Markers Wiki'));

    // # Create page with multiple paragraphs through UI
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Design Doc');

    const editor = getEditor(page);
    await editor.click();
    await editor.type('The UI design uses primary color blue.');
    await editor.press('Enter');
    await editor.type('It also uses secondary color green.');

    await publishPage(page);

    // # Enter edit mode and add both inline comments
    await enterEditMode(page);

    // Add first comment
    await addInlineCommentInEditMode(page, 'Comment on primary color', 'primary color blue');

    // Close RHS if it opened after first comment
    await closeWikiRHS(page).catch(() => {}); // Ignore error if already closed

    // Add second comment
    await addInlineCommentInEditMode(page, 'Comment on secondary color', 'secondary color green');

    // Close RHS after second comment before publishing
    await closeWikiRHS(page).catch(() => {}); // Ignore error if already closed

    // # Publish page with both comments
    await publishPage(page);

    // * Verify both comment markers exist
    const commentMarkers = page.locator('[id^="ic-"], .comment-anchor');
    await expect(async () => {
        const markerCount = await commentMarkers.count();
        expect(markerCount).toBeGreaterThanOrEqual(2);
    }).toPass({timeout: ELEMENT_TIMEOUT});

    // * Verify each marker is visible and has an ID
    const marker1 = commentMarkers.nth(0);
    const marker2 = commentMarkers.nth(1);

    await expect(marker1).toBeVisible();
    await expect(marker2).toBeVisible();

    // * Verify each marker has a unique ID attribute (format: ic-<uuid>)
    const marker1Id = await marker1.getAttribute('id');
    const marker2Id = await marker2.getAttribute('id');

    expect(marker1Id).toBeTruthy();
    expect(marker1Id).toMatch(/^ic-/);
    expect(marker2Id).toBeTruthy();
    expect(marker2Id).toMatch(/^ic-/);
    expect(marker1Id).not.toBe(marker2Id);

    // * Verify each marker is clickable
    await marker1.click();
    const rhs = page.locator('[data-testid="wiki-rhs"]');
    await expect(rhs).toBeVisible({timeout: ELEMENT_TIMEOUT});

    await marker2.click();
    await expect(rhs).toBeVisible({timeout: ELEMENT_TIMEOUT});
});

/**
 * @objective Verify inline comment position preservation after inserting text before comment
 *
 * @precondition
 * Tests that when text is inserted BEFORE the commented text, the highlight
 * still correctly points to the original commented text (not shifted text)
 */
test(
    'preserves inline comment position after inserting text before comment',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // Use distinctive text that won't be confused with added prefix
        const originalText = 'The quick brown fox jumps over the lazy dog';
        const commentText = 'This is interesting';

        // # Create wiki and page through UI
        await createWikiAndPage(page, uniqueName('Edit Preserve Wiki'), 'Editable Page', originalText);

        // # Add inline comment on the original text
        await enterEditMode(page);
        await addInlineCommentInEditMode(page, commentText);
        await publishPage(page);

        // * Verify comment marker exists
        await verifyCommentMarkerVisible(page);

        // # Edit page - add text BEFORE the commented section
        await enterEditMode(page);
        const editor = getEditor(page);
        await editor.click();
        // Use Ctrl/Meta+Home to reliably go to document start
        await pressModifierKey(page, 'Home');
        await page.keyboard.type('Prefix: ');

        await publishPage(page);

        // * Verify marker still exists after edit (re-fetch since DOM was refreshed)
        const commentMarker = await verifyCommentMarkerVisible(page);

        // * Verify the highlight is on the CORRECT text by clicking marker and checking RHS
        // The RHS should show the original anchor text, not "Prefix" or shifted text
        const rhs = await clickCommentMarkerAndOpenRHS(page, commentMarker);

        // * Verify the anchor text in RHS matches what was originally commented on
        // The anchor box should contain the original text, not "Prefix:" or other shifted content
        await verifyWikiRHSContent(page, rhs, [originalText, commentText]);

        // * Additionally verify the highlighted text in editor matches original
        // Get the text content of the comment anchor span
        const highlightedText = await page.locator('[id^="ic-"], .comment-anchor').first().textContent();
        expect(highlightedText).toContain('The quick brown fox');
    },
);

/**
 * @objective Verify inline comment position preservation after deleting text before comment
 *
 * @precondition
 * Tests that when text is deleted BEFORE the commented text, the highlight
 * still correctly points to the original commented text (not shifted text)
 */
test(
    'preserves inline comment position after deleting text before comment',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // Use text with a prefix that will be deleted
        const prefixText = 'DELETE THIS: ';
        const commentedText = 'The quick brown fox jumps over the lazy dog';
        const fullText = prefixText + commentedText;
        const commentText = 'This is interesting';

        // # Create wiki and page through UI with prefix text
        await createWikiAndPage(page, uniqueName('Delete Edit Wiki'), 'Editable Page', fullText);

        // # Add inline comment on the text AFTER the prefix (the part we want to keep)
        await enterEditMode(page);
        await addInlineCommentInEditMode(page, commentText, commentedText);
        await publishPage(page);

        // * Verify comment marker exists
        await verifyCommentMarkerVisible(page);

        // # Edit page - delete the prefix text BEFORE the commented section
        await enterEditMode(page);
        const editor = getEditor(page);
        await editor.click();
        // Use Ctrl/Meta+Home to reliably go to document start
        await pressModifierKey(page, 'Home');

        // Select and delete the prefix text
        for (let i = 0; i < prefixText.length; i++) {
            await page.keyboard.press('Shift+ArrowRight');
        }
        await page.keyboard.press('Delete');

        await publishPage(page);

        // * Verify marker still exists after edit (re-fetch since DOM was refreshed)
        const commentMarker = await verifyCommentMarkerVisible(page);

        // * Verify the highlight is on the CORRECT text by clicking marker and checking RHS
        const rhs = await clickCommentMarkerAndOpenRHS(page, commentMarker);

        // * Verify the anchor text in RHS matches what was originally commented on
        await verifyWikiRHSContent(page, rhs, [commentedText, commentText]);

        // * Additionally verify the highlighted text in editor matches original
        const highlightedText = await page.locator('[id^="ic-"], .comment-anchor').first().textContent();
        expect(highlightedText).toContain('The quick brown fox');
    },
);

/**
 * @objective Verify inline comment deletion
 */
test('deletes inline comment and removes marker', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and page through UI
    await createWikiAndPage(page, uniqueName('Delete Comment Wiki'), 'Page With Comment', 'This text has a comment');

    // # Add inline comment using reusable helpers
    await enterEditMode(page);
    await addInlineCommentInEditMode(page, 'This needs review');

    // # Publish page with inline comment
    await publishPage(page);

    // # Verify marker exists and open RHS
    const commentMarker = await verifyCommentMarkerVisible(page);
    const rhs = await clickCommentMarkerAndOpenRHS(page, commentMarker);

    // # Delete comment from RHS
    await deleteCommentFromRHS(page, rhs);

    // * Verify marker removed
    await expect(commentMarker).not.toBeVisible();
});

/**
 * @objective Verify clicking comment marker opens RHS with comment thread
 */
test('clicks inline comment marker to open RHS', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'), 'O', [user.id]);

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and page with inline comment
    await createWikiAndPage(page, uniqueName('RHS Wiki'), 'Product Specs', 'The performance metrics need review');

    // # Add inline comment (publishes page and verifies marker)
    await enterEditMode(page);
    await addInlineCommentAndVerify(page, 'Needs review', undefined, true);

    // # Reload page to ensure clean state (RHS closed)
    await page.reload();
    await page.waitForLoadState('networkidle');

    // * Verify RHS is closed after reload
    const rhs = page.locator('[data-testid="wiki-rhs"]');
    await expect(rhs).not.toBeVisible();

    // # Click comment marker to open RHS
    const commentMarker = await verifyCommentMarkerVisible(page);
    await commentMarker.click();

    // * Verify RHS opens
    await expect(rhs).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify RHS header shows "Thread" (single comment thread view, not full page tabs)
    const rhsHeader = rhs.locator('[data-testid="wiki-rhs-header-title"]');
    await expect(rhsHeader).toBeVisible();

    // * Verify comment content is displayed in RHS
    await expect(rhs).toContainText('Needs review');

    // * Verify comment marker is highlighted
    const markerClass = await commentMarker.getAttribute('class');
    expect(markerClass).toBeTruthy();
});

/**
 * @objective Verify inline comment highlight persists after navigating away and back
 */
test(
    'inline comment highlight persists after navigating away and back',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

        const {page, channelsPage} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki and page with content (createWikiAndPage publishes automatically)
        await createWikiAndPage(
            page,
            uniqueName('Navigation Wiki'),
            'Page with comment',
            'This text will have a comment',
        );
        await page.waitForTimeout(SHORT_WAIT);

        // # In view mode, select text and add inline comment using the view mode toolbar
        await selectTextInEditor(page);
        const addCommentButton = page.locator('[data-testid="inline-comment-add-button"]');
        await expect(addCommentButton).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await addCommentButton.click();

        // Wait for wiki RHS to open with the new comment view
        const wikiRhs = page.locator('[data-testid="wiki-rhs"]');
        await expect(wikiRhs).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // Wait for the create comment component in the RHS
        const createComment = page.locator('[data-testid="comment-create"]');
        await expect(createComment).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await fillAndSubmitCommentModal(page, createComment, 'Persistent comment');

        // * Verify marker is visible before navigation
        await verifyCommentMarkerVisible(page);

        // # Navigate away to town-square
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Navigate back to the wiki channel and open the page
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();
        const wikiTab = page.locator('[role="tab"]').filter({hasText: 'Navigation Wiki'});
        await wikiTab.click();
        await ensurePanelOpen(page);
        const pageNode = page.locator('[data-testid="page-tree-node"]').filter({hasText: 'Page with comment'});
        await pageNode.click();
        await expect(page.locator('.ProseMirror').first()).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // * Verify inline comment marker is still visible after navigation
        await verifyCommentMarkerVisible(page);
    },
);

/**
 * @objective Verify clicking same comment marker again closes RHS (toggle)
 */
test('clicks active comment marker to close RHS', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and page through UI
    await createWikiAndPage(page, uniqueName('Toggle RHS Wiki'), 'Design Doc', 'The color scheme needs adjustment');

    // # Add inline comment
    await enterEditMode(page);
    await addInlineCommentAndVerify(page, 'Needs review', undefined, true);

    // # Verify comment marker exists
    const commentMarker = await verifyCommentMarkerVisible(page);

    // # Click marker to open RHS
    const rhs = await clickCommentMarkerAndOpenRHS(page, commentMarker);

    // # Click same marker again
    await commentMarker.click();

    // * Verify RHS closes
    await expect(rhs).not.toBeVisible();
});

/**
 * @objective Verify closing RHS via close button
 */
test('closes RHS via close button', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'), 'O', [user.id]);

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and page through UI
    await createWikiAndPage(
        page,
        uniqueName('Close RHS Wiki'),
        'Requirements',
        'Security requirements must be defined',
    );

    // # Add inline comment
    await enterEditMode(page);
    await addInlineCommentAndVerify(page, 'Needs review', undefined, true);

    // # Verify comment marker exists and click to open RHS
    const commentMarker = await verifyCommentMarkerVisible(page);
    await clickCommentMarkerAndOpenRHS(page, commentMarker);

    // # Close RHS via close button
    await closeWikiRHS(page);

    // * Verify comment marker still visible after RHS closes
    await expect(commentMarker).toBeVisible();
});

/**
 * @objective Verify switching between multiple comment threads
 */
test('switches between multiple comment threads in RHS', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'), 'O', [user.id]);

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Multi Thread Wiki'));

    // # Create page with multiple paragraphs through UI
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Architecture');

    const editor = getEditor(page);
    await editor.click();
    await editor.type('The frontend uses React for the UI.');
    await editor.press('Enter');
    await editor.type('The backend uses Node.js for the API.');

    await publishPage(page);

    // # Enter edit mode and add both inline comments
    await enterEditMode(page);

    // Add first comment
    await addInlineCommentInEditMode(page, 'Comment on frontend', 'frontend uses React');

    // Close RHS if it opened after first comment
    await closeWikiRHS(page).catch(() => {}); // Ignore error if already closed

    // Add second comment
    await addInlineCommentInEditMode(page, 'Comment on backend', 'backend uses Node.js');

    // Close RHS after second comment before publishing
    await closeWikiRHS(page).catch(() => {}); // Ignore error if already closed

    // # Publish page with both comments
    await publishPage(page);

    // * Verify both comment markers exist
    const commentMarkers = page.locator('[id^="ic-"], .comment-anchor');
    await expect(async () => {
        const markerCount = await commentMarkers.count();
        expect(markerCount).toBeGreaterThanOrEqual(2);
    }).toPass({timeout: ELEMENT_TIMEOUT});

    const rhs = page.locator('[data-testid="wiki-rhs"]');

    // # Click first marker
    await commentMarkers.nth(0).click();
    await expect(rhs).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify first comment content loads
    await expect(rhs).toContainText('frontend uses React', {timeout: ELEMENT_TIMEOUT});

    // * Capture first comment content
    const firstContent = await rhs.textContent();

    // # Click second marker
    await commentMarkers.nth(1).click();

    // * Verify content changed to second comment
    await expect(rhs).toContainText('backend uses Node.js', {timeout: ELEMENT_TIMEOUT});
    const secondContent = await rhs.textContent();

    // * Verify contents are different
    expect(firstContent).not.toEqual(secondContent);
});

/**
 * @objective Verify switching between Page Comments and All Threads tabs
 */
test('switches between Page Comments and All Threads tabs in RHS', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and pages through UI
    await createWikiAndPage(page, uniqueName('Tab Switch Wiki'), 'First Page', 'Content for first page');

    // # Add inline comment
    await enterEditMode(page);
    await addInlineCommentAndVerify(page, 'Needs review', undefined, true);

    // # Reload page and open RHS via toggle comments button (not marker) to show tabs
    await page.reload();
    await page.waitForLoadState('networkidle');

    const rhs = await openWikiRHSViaToggleButton(page);

    // * Verify Page Comments tab is visible — scope to role=tab so we don't strict-mode-match
    //   the RHS header text or the tabpanel name which both contain "Comments".
    const pageCommentsTab = rhs.getByRole('tab', {name: 'Comments'});
    await expect(pageCommentsTab).toBeVisible();

    // * Verify page title shows on Page Comments tab
    const pageTitle = rhs.locator('[data-testid="wiki-rhs-page-title"]');
    await expect(pageTitle).toBeVisible();
    await expect(pageTitle).toContainText('First Page');

    // * Verify Page Comments content is displayed initially
    const commentsContent = rhs.locator('[data-testid="wiki-rhs-comments-content"]');
    await expect(commentsContent).toBeVisible();

    // # Switch to All Threads tab
    await switchToWikiRHSTab(page, rhs, 'Page Threads');

    // * Verify page title is hidden on All Threads tab
    await expect(pageTitle).not.toBeVisible();

    // * Verify All Threads content area is displayed
    const allThreadsContent = rhs.locator('[data-testid="wiki-rhs-all-threads-content"]');
    await expect(allThreadsContent).toBeVisible();

    // # Switch back to Page Comments tab
    await switchToWikiRHSTab(page, rhs, 'Comments');

    // * Verify page title shows again
    await expect(pageTitle).toBeVisible();

    // * Verify Page Comments content area is displayed again
    await expect(commentsContent).toBeVisible();
});

/**
 * @objective Verify All Threads tab shows threads from multiple pages
 */
test('displays all threads from multiple pages in All Threads tab', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'), 'O', [user.id]);

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('All Threads Wiki'));

    // # Create first page with inline comment
    await createPageThroughUI(page, 'Architecture Page', 'Frontend architecture needs review');
    await enterEditMode(page);
    await addInlineCommentAndVerify(page, 'First page comment', undefined, true);

    // # Create second page with inline comment
    await createPageThroughUI(page, 'Backend Page', 'Backend design needs discussion');
    await enterEditMode(page);
    await addInlineCommentAndVerify(page, 'Second page comment', undefined, true);

    // # Reload page and open RHS via toggle comments button to show tabs
    await page.reload();
    await page.waitForLoadState('networkidle');

    const rhs = await openWikiRHSViaToggleButton(page);

    // # Switch to All Threads tab
    await switchToWikiRHSTab(page, rhs, 'Page Threads');

    // * Verify All Threads tab content is displayed
    const allThreadsContent = rhs.locator('[data-testid="wiki-rhs-all-threads-content"]');
    await expect(allThreadsContent).toBeVisible();

    // * Verify threads list is visible (not empty state since we created comments)
    const threadsList = allThreadsContent.locator('[data-testid="wiki-rhs-all-threads"]');
    await expect(threadsList).toBeVisible();

    // * Verify threads are grouped by page
    const pageGroups = threadsList.locator('.WikiRHS__page-thread-group');
    const groupCount = await pageGroups.count();
    expect(groupCount).toBeGreaterThanOrEqual(2); // Should have at least 2 pages with threads

    // * Verify threads from both pages are present
    await expect(threadsList).toContainText('Architecture Page');
    await expect(threadsList).toContainText('Backend Page');
});

/**
 * @objective Verify that when multiple inline comments exist on different parts of a page, each comment displays its correct anchor text in the wiki RHS
 */
test(
    'displays correct anchor text for each inline comment in wiki RHS',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki and page through UI
        await createWikiAndPage(
            page,
            uniqueName('Anchor Test Wiki'),
            'Multiple Anchors Test',
            'First section with unique content. Second section with different content. Third section with more content.',
        );

        // # Enter edit mode and add first inline comment
        await enterEditMode(page);
        await addInlineCommentInEditMode(page, 'Comment on first section');

        // # Add second inline comment
        const editor = getEditor(page);
        await editor.click();
        await selectTextInEditor(page);
        const commentModal = await openInlineCommentModal(page);
        await fillAndSubmitCommentModal(page, commentModal, 'Comment on second section');

        // # Publish the page
        await publishPage(page);

        // # Check if inline comment markers exist
        const commentMarkers = page.locator('[id^="ic-"], .comment-anchor');
        const markerCount = await commentMarkers.count();

        // Inline comment was created above; assert it is visible rather than silently skipping.
        expect(markerCount).toBeGreaterThanOrEqual(1);

        // # Click first marker to open RHS
        await commentMarkers.nth(0).click();

        // # Verify RHS opened
        const wikiRHS = page.locator('[data-testid="wiki-rhs"]');
        await expect(wikiRHS).toBeVisible({timeout: ELEMENT_TIMEOUT});
        // * Verify anchor text context is displayed in RHS
        const anchorContext = wikiRHS.locator('.inline-comment-anchor-box');
        await expect(anchorContext).toBeVisible({timeout: WEBSOCKET_WAIT});
        // * Verify it contains some text from the page
        const contextText = await anchorContext.first().textContent();
        expect(contextText).toBeTruthy();

        // # If multiple markers exist, test navigation between them
        if (markerCount >= 2) {
            await commentMarkers.nth(1).click();

            // * Verify anchor context updates
            await expect(anchorContext).toBeVisible({timeout: WEBSOCKET_WAIT});
            const secondContextText = await anchorContext.first().textContent();
            expect(secondContextText).toBeTruthy();
        }
    },
);

/**
 * @objective Verify inline comment from formatting bar displays correct anchor text during editing
 */
test(
    'creates inline comment from formatting bar with correct anchor text',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki and page through UI
        await createWikiThroughUI(page, uniqueName('Format Bar Wiki'));

        const newPageButton = getNewPageButton(page);
        await newPageButton.click();
        await fillCreatePageModal(page, 'Test Page');

        // # Type content in the editor
        const editor = getEditor(page);
        await editor.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
        await editor.click();
        await editor.type('important information');

        // # Publish the page first (inline comments only work on published pages, not new drafts)
        await publishPage(page);

        // # Enter edit mode and add inline comment
        await enterEditMode(page);
        await addInlineCommentInEditMode(page, 'This section needs review');

        // * Verify RHS opened automatically and contains correct content
        const rhs = page.locator('[data-testid="wiki-rhs"]');
        await verifyWikiRHSContent(page, rhs, ['important information', 'This section needs review']);

        // * Verify it does NOT show the generic "Comment thread" text
        const rhsText = await rhs.textContent();
        expect(rhsText).not.toContain('Comment thread');

        // # Publish the page again to save the comment
        await publishPage(page);

        // * Verify comment marker is visible and click to verify RHS still works
        const commentMarker = await verifyCommentMarkerVisible(page);
        await commentMarker.click();

        // * Verify RHS still shows the comment with correct anchor text after publishing
        await expect(rhs).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await verifyWikiRHSContent(page, rhs, ['important information']);
        const rhsTextAfterPublish = await rhs.textContent();
        expect(rhsTextAfterPublish).not.toContain('Comment thread');
    },
);

/**
 * @objective Verify that when multiple inline comments exist on different parts of a page, each thread displays its correct anchor text in the global Threads view
 */
test(
    'displays correct anchor text for each thread in global Threads view',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki through UI
        await createWikiThroughUI(page, uniqueName('Threads Anchor Test Wiki'));

        // # Create a page with three distinct text sections
        await ensurePanelOpen(page);
        const newPageButton = getNewPageButton(page);
        await newPageButton.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
        await newPageButton.click();
        await fillCreatePageModal(page, 'Global Threads Anchors Test');

        const editor = getEditor(page);
        await editor.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
        await editor.click();

        // Type content with Enter keys for proper paragraph separation
        await editor.type('Alpha section text here.');
        await page.keyboard.press('Enter');
        await page.keyboard.press('Enter');
        await editor.type('Beta section text here.');
        await page.keyboard.press('Enter');
        await page.keyboard.press('Enter');
        await editor.type('Gamma section text here.');

        // # Publish the page first (required before adding inline comments)
        await publishPage(page);

        // # Now edit to add first inline comment
        await enterEditMode(page);
        await addInlineCommentInEditMode(page, 'Comment on alpha', 'Alpha section text here.');
        await publishPage(page);

        // # Edit page again to add second comment
        await enterEditMode(page);
        await addInlineCommentInEditMode(page, 'Comment on beta', 'Beta section text here.');
        await publishPage(page);

        // # Navigate to global Threads view
        const threadsLink = page.locator('a[href*="/threads"]').first();
        await expect(threadsLink).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await threadsLink.click();
        await page.waitForLoadState('networkidle');

        // * Verify Threads view is visible
        const threadsView = page.locator('.ThreadList');
        await expect(threadsView).toBeVisible({timeout: ELEMENT_TIMEOUT});
        // # Get all thread items
        const threadItems = threadsView.locator('.ThreadItem');
        const threadCount = await threadItems.count();

        expect(threadCount).toBeGreaterThan(0);

        // # Find thread items for our page (they should have "Commented on the page:" text)
        const pageThreads = threadItems.filter({hasText: 'Commented on the page:'});
        const pageThreadCount = await pageThreads.count();
        expect(pageThreadCount).toBeGreaterThanOrEqual(1);

        // * Verify first thread shows anchor text
        const firstThread = pageThreads.nth(0);
        const firstThreadText = await firstThread.textContent();
        expect(firstThreadText).toBeTruthy();

        // # If multiple threads exist, verify the second one
        if (pageThreadCount >= 2) {
            const secondThread = pageThreads.nth(1);
            const secondThreadText = await secondThread.textContent();
            expect(secondThreadText).toBeTruthy();
        }

        // # Click into first thread — page comment threads navigate to the wiki page, not ThreadPane
        await firstThread.click();
        await page.waitForLoadState('networkidle');

        // * Verify URL navigated to the wiki page
        await expect(page).toHaveURL(/\/wiki\//, {timeout: ELEMENT_TIMEOUT});

        // # Click the comment marker to open the wiki comment RHS
        const commentMarker = await verifyCommentMarkerVisible(page);
        const rhs = await clickCommentMarkerAndOpenRHS(page, commentMarker);

        // * Verify the wiki RHS shows inline comment anchor box with text
        const firstPaneAnchor = rhs.locator('.inline-comment-anchor-box');
        await expect(firstPaneAnchor).toBeVisible({timeout: WEBSOCKET_WAIT});
        const anchorText = await firstPaneAnchor.first().textContent();
        expect(anchorText).toBeTruthy();
    },
);

/**
 * @objective Verify back button in thread view returns to comments tab view
 */
test(
    'navigates back from thread view to comments tabs using back button',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Setup: Create wiki, page, add comment, and publish using helper
        const {marker} = await setupPageWithComment(
            page,
            uniqueName('Back Button Wiki'),
            'Back Button Test Page',
            'This text has a comment for testing back navigation',
            'Test comment for back button',
        );

        // # Click marker to open thread view in RHS using helper
        const rhs = await clickCommentMarkerAndOpenRHS(page, marker ?? undefined);

        // * Verify RHS is in thread view (header shows "Comment Thread")
        const rhsHeader = rhs.locator('[data-testid="wiki-rhs-header-title"]');
        await expect(rhsHeader).toHaveText('Comment Thread');

        // * Verify back button is visible in thread view
        const backButton = rhs.locator('[data-testid="wiki-rhs-back-button"]');
        await expect(backButton).toBeVisible();

        // * Verify tabs are NOT visible in thread view — scope by role=tab to avoid
        //   strict-mode collisions with the RHS header / tabpanel name.
        const pageCommentsTab = rhs.getByRole('tab', {name: 'Comments'});
        await expect(pageCommentsTab).not.toBeVisible();

        // # Click back button to return to comments tabs view
        await backButton.click();

        // * Verify RHS header now shows "Comments" (tabs view)
        await expect(rhsHeader).toHaveText('Comments', {timeout: ELEMENT_TIMEOUT});

        // * Verify back button is no longer visible
        await expect(backButton).not.toBeVisible();

        // * Verify tabs are now visible
        await expect(pageCommentsTab).toBeVisible();
        const allThreadsTab = rhs.getByRole('tab', {name: 'Page Threads'});
        await expect(allThreadsTab).toBeVisible();
    },
);

/**
 * @objective Verify back button returns to the same tab that was active before opening thread
 */
test('back button returns to previously active tab', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Setup: Create wiki, page, add comment, and publish using helper
    await setupPageWithComment(
        page,
        uniqueName('Tab Preserve Wiki'),
        'Tab Preserve Test Page',
        'This text has a comment',
        'Test comment',
    );

    // # Reload and open RHS via toggle button (shows tabs) using helper
    await page.reload();
    await page.waitForLoadState('networkidle');
    const rhs = await openWikiRHSViaToggleButton(page);

    // # Switch to All Threads tab using helper
    await switchToWikiRHSTab(page, rhs, 'Page Threads');

    // * Verify All Threads tab is active
    const allThreadsContent = rhs.locator('[data-testid="wiki-rhs-all-threads-content"]');
    await expect(allThreadsContent).toBeVisible();

    // # Click on a thread to open thread view
    const threadItem = allThreadsContent.locator('.WikiRHS__thread-item').first();
    await expect(threadItem).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await threadItem.click();

    // * Verify we're in thread view
    const rhsHeader = rhs.locator('[data-testid="wiki-rhs-header-title"]');
    await expect(rhsHeader).toHaveText('Comment Thread', {timeout: ELEMENT_TIMEOUT});

    // # Click back button
    const backButton = rhs.locator('[data-testid="wiki-rhs-back-button"]');
    await backButton.click();

    // * Verify we're back to tabs view with All Threads still active
    await expect(rhsHeader).toHaveText('Comments', {timeout: ELEMENT_TIMEOUT});
    await expect(allThreadsContent).toBeVisible();
});

/**
 * @objective Verify inline comment can be resolved and unresolve with filter functionality
 */
test('resolves and unresolves inline comment with filters', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Setup: Create wiki, page, add comment, and publish
    const {marker} = await setupPageWithComment(
        page,
        uniqueName('Resolution Wiki'),
        'Resolution Page',
        'This text needs review',
        'This needs clarification',
    );

    // # Click marker to open RHS (opens thread-level view)
    const threadRhs = await clickCommentMarkerAndOpenRHS(page, marker ?? undefined);

    // # Resolve the comment
    await toggleCommentResolution(page, threadRhs);

    // # Close the thread view and open page-level "Page Comments" RHS
    await closeWikiRHS(page);

    // # Open page-level RHS with "Page Comments" tab (where filters exist)
    const pageRhs = await openWikiRHSViaToggleButton(page);

    // # Test filter: Click "Resolved" filter to see resolved comments
    await clickCommentFilter(page, pageRhs, 'resolved');

    // * Verify thread is visible in resolved filter
    const threadItem = await getThreadItemAndVerify(pageRhs);

    // # Click "Open" filter
    await clickCommentFilter(page, pageRhs, 'open');

    // * Verify thread not visible in open filter (or empty state shown)
    await verifyCommentsEmptyState(pageRhs, 'No Open comments');

    // # Switch back to "All" filter
    await clickCommentFilter(page, pageRhs, 'all');

    // # Click on thread to open thread view and unresolve
    await threadItem.click();

    // * Verify thread view opens
    const rhsHeader = threadRhs.locator('[data-testid="wiki-rhs-header-title"]');
    await expect(rhsHeader).toHaveText('Comment Thread', {timeout: ELEMENT_TIMEOUT});

    // # Unresolve the comment
    await toggleCommentResolution(page, threadRhs);

    // # Close thread view and reopen page-level filters
    await closeWikiRHS(page);

    // # Reopen page-level RHS
    await openWikiRHSViaToggleButton(page);

    // * Verify thread no longer appears in resolved filter after unresolving
    await clickCommentFilter(page, pageRhs, 'resolved');
    await verifyCommentsEmptyState(pageRhs, 'No Resolved comments');
});

/**
 * @objective Verify that inline comments cannot be created on new pages in creation mode (initial draft)
 *
 * @precondition
 * Page must be a new draft that has never been published (creation mode)
 */
test(
    'does not allow inline comments on new pages in creation mode',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki through UI
        await createWikiThroughUI(page, uniqueName('Creation Mode Wiki'));

        // # Start creating a new page (but don't publish it)
        const newPageButton = getNewPageButton(page);
        await newPageButton.click();
        await fillCreatePageModal(page, 'New Draft Page');

        // # Type content in the editor
        const editor = getEditor(page);
        await editor.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
        await editor.click();
        await editor.type('This is draft content that should not have comments');

        // # Select text in editor to trigger the formatting bar
        await selectTextInEditor(page);

        // # Wait for the formatting bar bubble to appear
        const formattingBarBubble = await waitForFormattingBar(page);

        // * Verify the inline comment button is NOT visible in the formatting bar for new drafts
        const inlineCommentButton = formattingBarBubble.locator(
            'button[title="Add Comment"], [data-testid="inline-comment-submit"]',
        );
        await expect(inlineCommentButton).not.toBeVisible();

        // * Verify the comments toggle button is NOT visible in the header for new drafts
        const commentsToggleButton = page.locator('[data-testid="wiki-page-toggle-comments"]');
        await expect(commentsToggleButton).not.toBeVisible();
    },
);

/**
 * @objective Verify that inline comments become available after publishing a new page
 *
 * @precondition
 * Page starts as new draft and gets published
 */
test('enables inline comments after publishing a new page', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Publish Enable Wiki'));

    // # Start creating a new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Page To Publish');

    // # Type content in the editor
    const editor = getEditor(page);
    await editor.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    await editor.click();
    await editor.type('This content will be commentable after publish');

    // # Publish the page
    await publishPage(page);

    // * Verify the comments toggle button IS visible after publishing
    const commentsToggleButton = page.locator('[data-testid="wiki-page-toggle-comments"]');
    await expect(commentsToggleButton).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Enter edit mode to check formatting bar
    await enterEditMode(page);

    // # Select text in editor to trigger the formatting bar
    await selectTextInEditor(page);

    // # Wait for the formatting bar bubble to appear
    const formattingBarBubble = await waitForFormattingBar(page);

    // * Verify the inline comment button IS visible after publishing (now editing an existing page)
    const inlineCommentButton = formattingBarBubble.locator(
        'button[title="Add Comment"], [data-testid="inline-comment-submit"]',
    );
    await expect(inlineCommentButton).toBeVisible();
});

/**
 * @objective Verify that inline comment anchor remains highlighted after entering edit mode
 *
 * @precondition
 * Page has an existing inline comment with anchor
 */
test(
    'inline comment anchor remains highlighted after entering edit mode',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Setup: Create wiki, page, add comment, and publish
        const {marker} = await setupPageWithComment(
            page,
            uniqueName('Edit Mode Highlight Wiki'),
            'Highlight Test Page',
            'This text has a comment that should remain highlighted in edit mode',
            'Test comment for edit mode',
        );

        // * Verify comment marker is visible and the active highlight is rendered in view mode.
        //   The decoration plugin applies `comment-anchor-active` via a nested decoration
        //   span inside the outer mark element, so query the class directly rather than
        //   reading attributes off the outer `[id^="ic-"]` mark.
        await expect(marker!).toBeVisible();
        const viewModeHighlight = page.locator('.comment-anchor-active').first();
        await expect(viewModeHighlight).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Enter edit mode
        await enterEditMode(page);

        // # Wait for editor to fully load
        const editor = getEditor(page);
        await editor.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

        // * Verify the comment anchor is still visible in edit mode
        const editModeMarker = page.locator('[id^="ic-"], .comment-anchor').first();
        await expect(editModeMarker).toBeVisible({timeout: HIERARCHY_TIMEOUT});

        // * Verify the active highlight is still rendered in edit mode.
        //   This is the critical assertion — the active decoration must reattach
        //   after the editor remounts in edit mode.
        const editModeHighlight = page.locator('.comment-anchor-active').first();
        await expect(editModeHighlight).toBeVisible({timeout: HIERARCHY_TIMEOUT});
    },
);

/**
 * @objective Verify that other channel members see inline comments in the channel feed
 *
 * @precondition
 * Two users have access to the same channel
 * User1 creates an inline comment on a page
 */
test('other channel members see inline comments in the wiki view', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user: user1, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    // # Create user2 and add to channel
    const {user: user2} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

    // # User1 logs in and creates wiki with page
    const {page: page1} = await loginAndNavigateToChannel(pw, user1, team.name, channel.name);

    // # Create wiki and page
    const wiki = await createWikiThroughUI(page1, uniqueName('Channel Feed Wiki'));
    const pageTitle = uniqueName('Channel Feed Page');
    const pageContent = 'This content will have an inline comment visible to other users';
    const pageResult = await createPageThroughUI(page1, pageTitle, pageContent);

    // # User1 adds an inline comment
    await enterEditMode(page1);
    const commentText = uniqueName('Inline comment visible to other users');
    await addInlineCommentInEditMode(page1, commentText);
    await publishPage(page1);

    // * Verify comment marker is visible for user1
    await verifyCommentMarkerVisible(page1);

    // # User2 logs in and navigates to the same wiki page
    const {page: page2} = await pw.testBrowser.login(user2);
    await navigateToPage(page2, pw.url, team.name, wiki.id, pageResult.id);

    // * Verify User2 sees the comment marker on the page
    await verifyCommentMarkerVisible(page2);

    // * Verify User2 can open the wiki RHS and see the comment in Page Comments list
    const rhs = await openWikiRHSViaToggleButton(page2);
    await switchToWikiRHSTab(page2, rhs, 'Comments');
    await verifyWikiRHSContent(page2, rhs, [commentText]);

    // # Cleanup
    await page2.close();
});

/**
 * @objective Verify no "loading" anomaly in channel feed for page comments (Bug A14)
 *
 * @precondition
 * page_commented_on.tsx returns null while pagePost is loading, causing the parent
 * post view to render a generic "commented on someone's message loading" fallback.
 * A proper skeleton/placeholder referencing "page" should appear instead.
 */
test(
    'shows deterministic placeholder not loading anomaly for page comment in channel feed',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

        const {page, channelsPage} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki and page through UI
        await createWikiAndPage(
            page,
            uniqueName('A14 Bug Wiki'),
            'A14 Bug Page',
            'This page will receive an inline comment',
        );

        // # Add an inline comment and publish so it appears in the channel feed
        await enterEditMode(page);
        await addInlineCommentInEditMode(page, 'A14 test inline comment');
        await publishPage(page);

        // # Navigate to the backing channel so the channel feed is visible. We probe the
        //   feed as posts paint — the A14 anomaly is a transient state during the page
        //   fetch, so we cannot wait for networkidle (that would skip past the window
        //   we're testing).
        await navigateToChannelFromWiki(page, channelsPage, team.name, channel.name);

        // # Wait only until the first post element is attached to the DOM. Polling the
        //   anomaly assertion below covers the brief window where `pagePost` is still
        //   loading — if `page_commented_on.tsx` returned `null` here, the parent
        //   renderer would fill the slot with "commented on someone's message loading"
        //   and the assertion would catch it.
        await page
            .locator('.post, [data-testid="postView"]')
            .first()
            .waitFor({state: 'attached', timeout: ELEMENT_TIMEOUT});

        // * Assert: no post in the channel feed shows "loading" near a "commented on" post
        // This catches the A14 anomaly where page_commented_on.tsx returns null during load
        await expect(async () => {
            const loadingAnomalyPosts = page
                .locator('.post, [data-testid="postView"]')
                .filter({hasText: /commented on/i})
                .filter({hasText: /loading/i});
            await expect(loadingAnomalyPosts).toHaveCount(0);
        }).toPass({timeout: ELEMENT_TIMEOUT});

        // * Assert: any "commented on" text visible in the feed references "page" or "comment", not a generic fallback
        const commentedOnPosts = page
            .locator('.PostBody, .post-message__text, .post-message')
            .filter({hasText: /commented on/i});
        const count = await commentedOnPosts.count();
        for (let i = 0; i < count; i++) {
            const text = await commentedOnPosts.nth(i).innerText();
            expect(text.toLowerCase()).not.toMatch(/someone.s message loading/i);
        }
    },
);

/**
 * @objective Verify page comment 3-dot menu does not expose channel-message options (Bug B2)
 *
 * @precondition
 * dot_menu.tsx showFollowPost/showSave/showPin have no isPageComment guard,
 * causing Pin/Save/Follow options to appear on page comment posts.
 */
test(
    'page comment 3-dot menu does not show pin save or follow options',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki and page with an inline comment, then click the marker to open
        //   the per-thread RHS view (only this view renders the page-comment Post component
        //   that exposes the 3-dot menu — the page-level Comments tab shows thread cards).
        const {marker} = await setupPageWithComment(
            page,
            uniqueName('B2 Wiki'),
            'B2 Page',
            'B2 page content',
            'B2 comment text',
        );
        const rhs = await clickCommentMarkerAndOpenRHS(page, marker ?? undefined);

        // # Hover the comment post to reveal the 3-dot menu and open it
        await openPostDotMenu(page, rhs);

        // * Assert: "Pin to channel" is not visible in the menu. The menu items use the
        //   ids `pin_post_{postId}` / `save_post_{postId}` / `follow_post_{postId}` — match
        //   them by id prefix rather than by guessed data-testid attributes.
        await expect(page.locator('[id^="pin_post_"], [id^="unpin_post_"]')).not.toBeVisible();

        // * Assert: "Save message" is not visible in the menu
        await expect(page.locator('[id^="save_post_"], [id^="unsave_post_"]')).not.toBeVisible();

        // * Assert: "Follow message" is not visible in the menu
        await expect(page.locator('[id^="follow_post_thread_"], [id^="unfollow_post_thread_"]')).not.toBeVisible();
    },
);

/**
 * @objective Verify comment list panel defaults to "Open" filter not "All" (Bug B3)
 *
 * @precondition
 * wiki_page_thread_viewer.tsx useState('all') sets the default to "All",
 * causing resolved comments to appear immediately with no way to filter them out.
 *
 * Note: B3 and B5 are coupled — B3 without B5 leaves resolved comments unreachable.
 */
test('comment list panel defaults to Open filter not All', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and page with an inline comment
    await setupPageWithComment(page, uniqueName('B3 Wiki'), 'B3 Page', 'B3 page content', 'B3 comment text');
    const rhs = await openWikiRHSViaToggleButton(page);

    // # Open wiki RHS and switch to Page Comments tab
    await switchToWikiRHSTab(page, rhs, 'Comments');

    // * Assert: the "Open" filter button is active by default
    const openFilter = page.locator('button:text("Open"), [data-testid="filter-open"]').first();
    await expect(openFilter).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await expect(openFilter).toHaveClass(/active/);

    // * Assert: the "All" filter button is NOT the active one
    const allFilter = page.locator('button:text("All"), [data-testid="filter-all"]').first();
    await expect(allFilter).not.toHaveClass(/active/);
});

/**
 * @objective Verify "All" filter shows open comments above resolved ones (Bug B4)
 *
 * @precondition
 * wiki_page_thread_viewer.tsx has no stable sort; resolved items mix chronologically
 * with open comments under the "All" filter instead of appearing below them.
 */
test('all filter shows open comments above resolved ones', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and page
    await createWikiAndPage(page, uniqueName('B4 Bug Wiki'), 'B4 Bug Page', 'This page will have two inline comments');

    // # Add comment A (will be resolved)
    await enterEditMode(page);
    await addInlineCommentInEditMode(page, 'B4 comment A - will be resolved');
    await publishPage(page);

    // # Enter edit mode again to add comment B (will stay open)
    await enterEditMode(page);
    await addInlineCommentInEditMode(page, 'B4 comment B - stays open');
    await publishPage(page);

    // # Open wiki RHS and switch to Page Comments tab
    const rhs = await openWikiRHSViaToggleButton(page);
    await switchToWikiRHSTab(page, rhs, 'Comments');

    // # Enter the per-thread view to access the resolve action (not available from the cards list).
    const firstThread = rhs.locator('.WikiPageThreadViewer__thread-item').first();
    await expect(firstThread).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await firstThread.click();
    await toggleCommentResolution(page, rhs);
    const backButton = rhs.locator('[data-testid="wiki-rhs-back-button"]');
    await backButton.click();

    // # Switch to "All" filter to see both open and resolved comments
    await clickCommentFilter(page, rhs, 'all');
    await page.waitForTimeout(SHORT_WAIT);

    // * Assert: open comment appears above the resolved comment in the list
    const openComment = rhs.locator('.WikiPageThreadViewer__thread-item:not(.resolved)').first();
    const resolvedComment = rhs.locator('.WikiPageThreadViewer__thread-item.resolved').first();
    await expect(openComment).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await expect(resolvedComment).toBeVisible({timeout: ELEMENT_TIMEOUT});

    const [openIdx, resolvedIdx] = await rhs.evaluate((container) => {
        const items = Array.from(container.querySelectorAll('.WikiPageThreadViewer__thread-item'));
        return [
            items.findIndex((el) => !el.classList.contains('resolved')),
            items.findIndex((el) => el.classList.contains('resolved')),
        ];
    });
    expect(openIdx).toBeGreaterThanOrEqual(0);
    expect(resolvedIdx).toBeGreaterThanOrEqual(0);
    expect(openIdx).toBeLessThan(resolvedIdx);
});

/**
 * @objective Verify a toast or confirmation appears after resolving a comment (Bug B6)
 *
 * @precondition
 * dot_menu.tsx resolve/unresolve action dispatches with no user feedback,
 * leaving the user uncertain whether the resolve action succeeded.
 */
test('shows toast or confirmation after resolving a comment', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and page with an inline comment
    await setupPageWithComment(page, uniqueName('B6 Wiki'), 'B6 Page', 'B6 page content', 'B6 comment text');
    const rhs = await openWikiRHSViaToggleButton(page);

    // # Open wiki RHS and switch to Page Comments tab
    await switchToWikiRHSTab(page, rhs, 'Comments');

    // # Enter the per-thread view, then resolve via the post-action-bar quick action.
    const firstThread = rhs.locator('.WikiPageThreadViewer__thread-item').first();
    await expect(firstThread).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await firstThread.click();
    const commentPost = page.locator('.post, [data-testid="postView"]').first();
    await commentPost.hover();
    await page.locator('.post-menu [data-testid^="resolve-comment-"]').first().click();

    // * Assert: a toast/confirmation referencing the resolved state appears (B6).
    const confirmation = page.locator('.info-toast').first();
    await expect(confirmation).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await expect(confirmation).toContainText(/comment resolved/i);
});

/**
 * @objective Verify inline comment popover has a sufficient minimum width (Bug B9)
 *
 * @precondition
 * The inline comment popover is too narrow, causing it to blend into the page
 * background and be visually indistinguishable from surrounding content.
 */
test('inline comment popover has sufficient minimum width', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and page
    await createWikiAndPage(
        page,
        uniqueName('B9 Bug Wiki'),
        'B9 Bug Page',
        'Select this text to add an inline comment',
    );

    // # Enter edit mode so the inline comment popover can appear
    await enterEditMode(page);
    await expect(page.locator('.ProseMirror').first()).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Select text in the editor to trigger the inline comment popover
    await selectTextInEditor(page);

    // * Assert: the formatting-bar bubble (edit-mode selection popover) is visible and wide enough.
    const popover = page.locator('.formatting-bar-bubble').first();
    await expect(popover).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // @visual — take a screenshot for visual review of contrast/sizing
    const width = await popover.evaluate((el) => el.clientWidth);
    expect(width).toBeGreaterThanOrEqual(200);
});

/**
 * @objective Verify the comment RHS header reads "Comment Thread" not just "Thread" (Bug B13)
 *
 * @precondition
 * wiki_rhs.tsx defaultMessage is 'Thread' instead of 'Comment Thread',
 * causing the header label to be ambiguous and inconsistent with the feature.
 */
test('comment rhs header shows Comment Thread not Thread', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and page with an inline comment
    await setupPageWithComment(page, uniqueName('B13 Wiki'), 'B13 Page', 'B13 page content', 'B13 comment text');

    // # Click the comment marker to open the RHS thread view
    await clickCommentMarkerAndOpenRHS(page);
    await page.waitForTimeout(SHORT_WAIT);

    // * Assert: the RHS header contains "Comment Thread"
    const rhsHeader = page
        .locator(
            '[data-testid="wiki-rhs-header-title"], [data-testid="wiki-rhs-title"], .wiki-rhs-header, .sidebar-right__title',
        )
        .first();
    await expect(rhsHeader).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await expect(rhsHeader).toContainText('Comment Thread');

    // * Assert: the header does not display only the word "Thread" with nothing else
    const headerText = await rhsHeader.innerText();
    expect(headerText.trim()).not.toBe('Thread');
});

/**
 * @objective Verify the comment input autofocuses when the comment view opens (Bug B15)
 *
 * @precondition
 * wiki_rhs/wiki_new_comment_view.tsx textarea has no autoFocus prop,
 * causing users to manually click the input before typing a comment.
 */
test('comment input autofocuses when comment view opens', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and page (createWikiAndPage publishes — no separate publishPage call needed)
    await createWikiAndPage(
        page,
        uniqueName('B15 Bug Wiki'),
        'B15 Bug Page',
        'This page will test comment input autofocus',
    );

    // # Enter edit mode, select text, and click "Add comment" to open the comment input
    await enterEditMode(page);
    await expect(page.locator('.ProseMirror').first()).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await selectTextInEditor(page);
    await openInlineCommentModal(page);

    // * Assert: the comment textarea/input has focus immediately without any manual click
    const commentInput = page.locator('#wiki-new-comment-textbox');
    await expect(commentInput).toBeFocused({timeout: ELEMENT_TIMEOUT});
});

/**
 * @objective Verify inline comment highlight persists after comment RHS opens (Bug A18)
 *
 * @precondition
 * onCommentClick reference changes when RHS opens (reads isWikiRhsOpen via ref),
 * causing the extensions useMemo to recompute and reinitialize TipTap — dropping
 * the active ProseMirror selection/highlight.
 *
 * Fix (not yet applied): Wrap onCommentClick in a stable ref before passing it
 * to the extensions useMemo.
 *
 * NOTE: This test will fail until onCommentClick is wrapped in a stable ref so that opening
 * the RHS does not cause TipTap to reinitialize and drop the active ProseMirror selection.
 */
test('inline comment highlight persists after comment RHS opens', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and page (createWikiAndPage publishes — no separate publishPage call needed)
    await createWikiAndPage(
        page,
        uniqueName('A18 Bug Wiki'),
        'A18 Bug Page',
        'Select this text to verify highlight persistence',
    );

    // # Enter edit mode so the TipTap editor is active
    await enterEditMode(page);
    await expect(page.locator('.ProseMirror').first()).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Select text in the editor to trigger the inline comment popover
    await selectTextInEditor(page);

    // # Click the Add comment button to open the inline comment popover (and trigger RHS open)
    await openInlineCommentModal(page);

    // * Assert: the pending-anchor decoration is rendered in the editor. The native
    //   browser selection gets dropped when focus moves to the RHS comment textbox
    //   (B15 autofocus), so A18 preserves *visual* context via the
    //   `.comment-anchor-pending` decoration emitted by comment_highlight_plugin once
    //   `pendingInlineAnchor` is in Redux.
    const pendingHighlight = page.locator('.ProseMirror .comment-anchor-pending');
    await expect(pendingHighlight).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * And verify the RHS new-comment view also echoes the anchor text in its
    //   blockquote — both surfaces confirm the user knows what they're commenting on.
    const anchorBlockquote = page.locator('#wiki-new-comment-anchor');
    await expect(anchorBlockquote).toBeVisible({timeout: ELEMENT_TIMEOUT});
    const anchorText = await anchorBlockquote.innerText();
    expect(
        anchorText.trim().length,
        'Pending anchor text should be displayed in the RHS new-comment view',
    ).toBeGreaterThan(0);
});

/**
 * @objective Verify first inline comment persists anchor text as thread header not message body (Bug A19)
 *
 * @precondition
 * submitPageComment in create_page_comment.ts:69-93 — when focusedInlineCommentId is set
 * (from a previously clicked comment) AND pendingInlineAnchor is set, the function routes
 * to createPageCommentReply instead of createPageCommentAction, losing the anchor.
 *
 * Fix (not yet applied): Check pendingInlineAnchor before focusedInlineCommentId
 * in the condition order.
 *
 * NOTE: This test will fail until create_page_comment.ts checks pendingInlineAnchor before
 * focusedInlineCommentId, so a new anchor comment is not incorrectly routed to createPageCommentReply.
 */
test(
    'first inline comment persists anchor text as thread header not message body',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki and page with TWO paragraphs so the existing comment and the new
        //   comment can anchor on distinct text. Triple-clicking the SAME marked paragraph
        //   fires the editor's comment-click handler and reopens the existing thread before
        //   the new anchor can be submitted, defeating the test's intent.
        //
        //   Note: the page must be PUBLISHED before adding the inline comment — the
        //   formatting-bar bubble exposes "Add Comment" only when editing an existing
        //   page (isExistingPage=true), not in the initial-draft flow.
        const firstParagraph = 'A19 first paragraph for existing comment';
        const secondParagraph = 'A19 second paragraph for new comment';
        await createWikiThroughUI(page, uniqueName('A19 Bug Wiki'));
        await createPageThroughUI(page, 'A19 Bug Page', firstParagraph);

        // # Enter edit mode (now editing an existing page) and append the second paragraph
        await enterEditMode(page);
        const editor = getEditor(page);
        await editor.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
        await editor.click();
        await editor.press('Control+End');
        await editor.press('Enter');
        await editor.type(secondParagraph);
        // Give the editor a moment to register the appended paragraph before the
        // formatting-bar selection flow runs.
        await page.waitForTimeout(SHORT_WAIT);

        // # Add existing comment anchored on the FIRST paragraph and publish
        const existingCommentText = 'A19 existing comment to set focusedInlineCommentId';
        await addInlineCommentInEditMode(page, existingCommentText, firstParagraph);
        await publishPage(page);
        await verifyCommentMarkerVisible(page);

        // # Click the existing comment marker to set focusedInlineCommentId
        await clickCommentMarkerAndOpenRHS(page);
        await page.waitForTimeout(SHORT_WAIT);

        // # Capture pre-fix state: existing thread count and existing thread reply count
        const beforeState = await page.evaluate(() => {
            const state = (window as unknown as {store: {getState: () => unknown}}).store.getState() as {
                entities: {posts: {posts: Record<string, {id: string; type: string; root_id: string}>}};
                views: {wikiRhs: {focusedInlineCommentId: string | null}};
            };
            const posts = state.entities.posts.posts;
            // Inline-comment "threads" are page_comment posts at the root (root_id === '').
            // Replies have root_id pointing at the parent comment.
            const threadIds = Object.values(posts)
                .filter((p) => p.type === 'page_comment' && p.root_id === '')
                .map((p) => p.id);
            const focusedId = state.views.wikiRhs.focusedInlineCommentId;
            return {threadCount: threadIds.length, existingThreadIds: threadIds, focusedInlineCommentId: focusedId};
        });
        expect(
            beforeState.focusedInlineCommentId,
            'focusedInlineCommentId must be set after clicking existing comment',
        ).not.toBeNull();
        const existingThreadId = beforeState.existingThreadIds[0];

        // # Capture existing thread reply count for non-mutation assertion
        const oldThreadReplyCountBefore = await page.evaluate((threadId) => {
            const state = (window as unknown as {store: {getState: () => unknown}}).store.getState() as {
                entities: {posts: {posts: Record<string, {root_id: string}>}};
            };
            return Object.values(state.entities.posts.posts).filter((p) => p.root_id === threadId).length;
        }, existingThreadId);

        // # Enter edit mode and select the SECOND paragraph (fresh, unmarked text)
        //   so the new anchor is independent of the existing comment's mark.
        await enterEditMode(page);
        await expect(page.locator('.ProseMirror').first()).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await selectTextInEditor(page, secondParagraph);

        // # Submit a new comment on the new selection
        const newAnchorCommentText = 'A19 new comment on new selection';
        const createComment = await openInlineCommentModal(page);
        await fillAndSubmitCommentModal(page, createComment, newAnchorCommentText);

        // Wait for the new comment to appear in the RHS — this ensures the API response has
        // been processed and Redux state updated before we evaluate thread counts.
        await expect(page.locator('[data-testid="wiki-rhs"]')).toContainText(newAnchorCommentText, {
            timeout: WEBSOCKET_WAIT,
        });

        // * Assertion 1: a NEW thread was created (thread count incremented by 1).
        //   Poll because the `receivedNewPost` dispatch that populates `posts.posts`
        //   runs after `RECEIVED_PAGE_COMMENT` (which is what the RHS text wait above
        //   observes), so the two stores converge slightly out of phase.
        let afterState!: {threadCount: number; focusedInlineCommentId: string | null};
        await expect(async () => {
            afterState = await page.evaluate(() => {
                const state = (window as unknown as {store: {getState: () => unknown}}).store.getState() as {
                    entities: {
                        posts: {posts: Record<string, {id: string; type: string; root_id: string; message: string}>};
                    };
                    views: {wikiRhs: {focusedInlineCommentId: string | null}};
                };
                const posts = state.entities.posts.posts;
                const threadIds = Object.values(posts)
                    .filter((p) => p.type === 'page_comment' && p.root_id === '')
                    .map((p) => p.id);
                return {
                    threadCount: threadIds.length,
                    focusedInlineCommentId: state.views.wikiRhs.focusedInlineCommentId,
                };
            });
            expect(afterState.threadCount, 'A new thread must be created — count should increment by 1').toBe(
                beforeState.threadCount + 1,
            );
        }).toPass({timeout: WEBSOCKET_WAIT});

        // * Assertion 2: anchor banner is visible as thread context (not embedded in body)
        const threadHeader = page
            .locator('.inline-comment-anchor-banner, .inline-comment-anchor-box, .inline-comment-anchor-text')
            .first();
        await expect(threadHeader).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // * Assertion 3: comment body contains the typed comment text. The anchor text
        // is rendered separately as a banner, not embedded in the body.
        const commentBody = page
            .locator('.PageCommentedOn__message, .post-message__text, [data-testid="comment-message"]')
            .first();
        await expect(commentBody).toContainText(newAnchorCommentText, {timeout: ELEMENT_TIMEOUT});

        // * Assertion 4: old thread is unchanged — reply count did NOT increment
        const oldThreadReplyCountAfter = await page.evaluate((threadId) => {
            const state = (window as unknown as {store: {getState: () => unknown}}).store.getState() as {
                entities: {posts: {posts: Record<string, {root_id: string}>}};
            };
            return Object.values(state.entities.posts.posts).filter((p) => p.root_id === threadId).length;
        }, existingThreadId);
        expect(oldThreadReplyCountAfter, 'Previously-viewed thread must not receive the new comment as a reply').toBe(
            oldThreadReplyCountBefore,
        );

        // * Assertion 5: Redux focusedInlineCommentId no longer points to the OLD (stale) thread ID.
        // It may be null or the newly-created comment ID — both indicate the stale state was cleared.
        expect(
            afterState.focusedInlineCommentId,
            'focusedInlineCommentId must not still point to the stale (previously-viewed) thread',
        ).not.toBe(existingThreadId);
    },
);

/**
 * @objective Verify page comment shows resolve icon button in post action bar outside 3-dot menu (Bug B7)
 *
 * @precondition
 * dot_menu.tsx:766 — Resolve is a Menu.Item inside the overflow menu.
 * There is no quick-action resolve button directly in the post action bar.
 *
 * Fix (not yet applied): Add a CheckCircleOutlineIcon button directly in the
 * post action bar when isPageComment is true.
 *
 * NOTE: This test will fail until a CheckCircleOutlineIcon quick-action button is added
 * directly to the post action bar when isPageComment is true (currently Resolve is buried in the 3-dot menu).
 */
test(
    'page comment shows resolve icon button in post action bar outside 3-dot menu',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki and page with an inline comment, then publish
        await setupPageWithComment(page, uniqueName('B7 Wiki'), 'B7 Page', 'B7 page content', 'B7 comment text');

        // # Open the comment thread in RHS
        await clickCommentMarkerAndOpenRHS(page);
        await page.waitForTimeout(SHORT_WAIT);

        // # Hover the comment post to reveal the post action bar
        const commentPost = page.locator('.post, [data-testid="postView"]').first();
        await commentPost.hover();
        await page.waitForTimeout(SHORT_WAIT);

        // * Assert: a resolve icon button is visible OUTSIDE the 3-dot menu, in the
        //   post action bar (`.post-menu` row alongside reactions / dot menu).
        const resolveButton = page.locator('.post-menu [data-testid^="resolve-comment-"]').first();
        await expect(resolveButton).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // * Assert: the resolve button is NOT only inside the dropdown menu (the
        //   `resolve_comment_{postId}` id is reserved for the Menu.Item — distinct from
        //   the action-bar testid prefix above).
        const resolveInsideDropdown = page
            .locator('.dropdown-menu [id^="resolve_comment_"], .dropdown-menu [id^="unresolve_comment_"]')
            .first();
        await expect(resolveInsideDropdown).not.toBeVisible();

        // # Click the resolve button and assert the comment transitions to resolved state.
        //   The button toggles class `post-menu__item--resolved` and swaps the icon when
        //   `post.props.comment_resolved` becomes true (see page_comment_resolve_icon.tsx).
        await resolveButton.click();
        await expect(resolveButton).toHaveClass(/post-menu__item--resolved/, {timeout: ELEMENT_TIMEOUT});
    },
);
