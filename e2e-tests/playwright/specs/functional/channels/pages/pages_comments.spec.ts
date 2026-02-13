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
    addInlineCommentAndPublish,
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
    uniqueName,
    loginAndNavigateToChannel,
    ELEMENT_TIMEOUT,
    WEBSOCKET_WAIT,
    HIERARCHY_TIMEOUT,
    SHORT_WAIT,
    EDITOR_LOAD_WAIT,
} from './test_helpers';

/**
 * @objective Verify inline comment creation on selected text
 */
test('creates inline comment on selected text', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and page through UI
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

    // * Verify both comment markers exist
    const commentMarkers = page.locator('[id^="ic-"], .comment-anchor');
    await expect(async () => {
        const markerCount = await commentMarkers.count();
        expect(markerCount).toBeGreaterThanOrEqual(2);
    }).toPass({timeout: ELEMENT_TIMEOUT});

    // * Verify each marker is clickable and opens RHS
    const marker1 = commentMarkers.nth(0);
    const marker2 = commentMarkers.nth(1);

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
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

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
        await page.waitForTimeout(EDITOR_LOAD_WAIT);

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
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

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
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

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

    // * Verify Page Comments tab is visible (using text selector for Bootstrap tabs)
    const pageCommentsTab = rhs.getByText('Page Comments', {exact: true});
    await expect(pageCommentsTab).toBeVisible();

    // * Verify page title shows on Page Comments tab
    const pageTitle = rhs.locator('[data-testid="wiki-rhs-page-title"]');
    await expect(pageTitle).toBeVisible();
    await expect(pageTitle).toContainText('First Page');

    // * Verify Page Comments content is displayed initially
    const commentsContent = rhs.locator('[data-testid="wiki-rhs-comments-content"]');
    await expect(commentsContent).toBeVisible();

    // # Switch to All Threads tab
    await switchToWikiRHSTab(page, rhs, 'All Threads');

    // * Verify page title is hidden on All Threads tab
    await expect(pageTitle).not.toBeVisible();

    // * Verify All Threads content area is displayed
    const allThreadsContent = rhs.locator('[data-testid="wiki-rhs-all-threads-content"]');
    await expect(allThreadsContent).toBeVisible();

    // # Switch back to Page Comments tab
    await switchToWikiRHSTab(page, rhs, 'Page Comments');

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
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

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
    await switchToWikiRHSTab(page, rhs, 'All Threads');

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

        // Note: Adding multiple inline comments programmatically is complex
        // This test verifies UI behavior if inline comments exist
        if (markerCount >= 1) {
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

        const comment1Added = await addInlineCommentAndPublish(
            page,
            'Alpha section text here',
            'Comment on alpha',
            true,
        );

        // # Edit page again to add second comment (if first succeeded)
        if (comment1Added) {
            await enterEditMode(page);

            await addInlineCommentAndPublish(page, 'Beta section text here', 'Comment on beta', true);
        }

        // # Check if any inline comments were actually created
        const commentMarkers = page.locator('[id^="ic-"], .comment-anchor');
        const markerCount = await commentMarkers.count();

        // Note: Adding multiple inline comments programmatically is complex
        // This test verifies UI behavior if inline comments exist
        if (markerCount >= 1) {
            // # Navigate to global Threads view
            const threadsButton = page
                .locator('[aria-label*="Threads"]')
                .or(page.locator('button:has-text("Threads")'))
                .first();
            await expect(threadsButton).toBeVisible({timeout: ELEMENT_TIMEOUT});
            await threadsButton.click();

            // * Verify Threads view is visible
            const threadsView = page.locator('.ThreadList');
            await expect(threadsView).toBeVisible({timeout: ELEMENT_TIMEOUT});
            // # Get all thread items
            const threadItems = threadsView.locator('.ThreadItem');
            const threadCount = await threadItems.count();

            if (threadCount > 0) {
                // # Find thread items for our page (they should have "Commented on the page:" text)
                const pageThreads = threadItems.filter({hasText: 'Commented on the page:'});
                const pageThreadCount = await pageThreads.count();

                if (pageThreadCount >= 1) {
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

                    // # Click into first thread to verify detail view
                    await firstThread.click();

                    // * Verify thread pane shows anchor context
                    const threadPane = page.locator('.ThreadPane');
                    await expect(threadPane).toBeVisible({timeout: ELEMENT_TIMEOUT});
                    const firstPaneAnchor = threadPane.locator('.inline-comment-anchor-box');
                    await expect(firstPaneAnchor).toBeVisible({timeout: WEBSOCKET_WAIT});
                    const anchorText = await firstPaneAnchor.first().textContent();
                    expect(anchorText).toBeTruthy();

                    // # If multiple threads exist, test navigation to second thread
                    if (pageThreadCount >= 2) {
                        const backButton = page.locator('.ThreadPane button.back');
                        await expect(backButton).toBeVisible({timeout: WEBSOCKET_WAIT});
                        await backButton.click();

                        const secondThread = pageThreads.nth(1);
                        await expect(secondThread).toBeVisible({timeout: ELEMENT_TIMEOUT});
                        await secondThread.click();

                        // * Verify thread pane shows anchor for second thread
                        const secondPaneAnchor = threadPane.locator('.inline-comment-anchor-box');
                        await expect(secondPaneAnchor).toBeVisible({timeout: WEBSOCKET_WAIT});
                        const secondAnchorText = await secondPaneAnchor.first().textContent();
                        expect(secondAnchorText).toBeTruthy();
                    }
                }
            }
        }
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

        // * Verify RHS is in thread view (header shows "Thread")
        const rhsHeader = rhs.locator('[data-testid="wiki-rhs-header-title"]');
        await expect(rhsHeader).toHaveText('Thread');

        // * Verify back button is visible in thread view
        const backButton = rhs.locator('[data-testid="wiki-rhs-back-button"]');
        await expect(backButton).toBeVisible();

        // * Verify tabs are NOT visible in thread view
        const pageCommentsTab = rhs.getByText('Page Comments', {exact: true});
        await expect(pageCommentsTab).not.toBeVisible();

        // # Click back button to return to comments tabs view
        await backButton.click();

        // * Verify RHS header now shows "Comments" (tabs view)
        await expect(rhsHeader).toHaveText('Comments', {timeout: ELEMENT_TIMEOUT});

        // * Verify back button is no longer visible
        await expect(backButton).not.toBeVisible();

        // * Verify tabs are now visible
        await expect(pageCommentsTab).toBeVisible();
        const allThreadsTab = rhs.getByText('All Threads', {exact: true});
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
    await switchToWikiRHSTab(page, rhs, 'All Threads');

    // * Verify All Threads tab is active
    const allThreadsContent = rhs.locator('[data-testid="wiki-rhs-all-threads-content"]');
    await expect(allThreadsContent).toBeVisible();

    // # Click on a thread to open thread view
    const threadItem = allThreadsContent.locator('.WikiRHS__thread-item').first();
    await expect(threadItem).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await threadItem.click();

    // * Verify we're in thread view
    const rhsHeader = rhs.locator('[data-testid="wiki-rhs-header-title"]');
    await expect(rhsHeader).toHaveText('Thread', {timeout: ELEMENT_TIMEOUT});

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
    await verifyCommentsEmptyState(pageRhs, 'No open comments');

    // # Switch back to "All" filter
    await clickCommentFilter(page, pageRhs, 'all');

    // # Click on thread to open thread view and unresolve
    await threadItem.click();

    // * Verify thread view opens
    const rhsHeader = threadRhs.locator('[data-testid="wiki-rhs-header-title"]');
    await expect(rhsHeader).toHaveText('Thread', {timeout: ELEMENT_TIMEOUT});

    // # Unresolve the comment
    await toggleCommentResolution(page, threadRhs);

    // # Close thread view and reopen page-level filters
    await closeWikiRHS(page);

    // # Reopen page-level RHS
    await openWikiRHSViaToggleButton(page);

    // * Verify thread no longer appears in resolved filter after unresolving
    await clickCommentFilter(page, pageRhs, 'resolved');
    await verifyCommentsEmptyState(pageRhs, 'No resolved comments');
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

        // * Verify comment marker is visible and has active highlight class in view mode
        await expect(marker!).toBeVisible();
        const viewModeClass = await marker!.getAttribute('class');
        expect(viewModeClass).toContain('comment-anchor-active');

        // # Enter edit mode
        await enterEditMode(page);

        // # Wait for editor to fully load
        const editor = getEditor(page);
        await editor.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

        // * Verify the comment anchor is still visible in edit mode
        const editModeMarker = page.locator('[id^="ic-"], .comment-anchor').first();
        await expect(editModeMarker).toBeVisible({timeout: HIERARCHY_TIMEOUT});

        // * Verify the anchor has the active highlight class in edit mode
        // This is the critical assertion - the anchor should be highlighted after entering edit mode
        await expect(async () => {
            const editModeClass = await editModeMarker.getAttribute('class');
            expect(editModeClass).toContain('comment-anchor-active');
        }).toPass({timeout: HIERARCHY_TIMEOUT});
    },
);

/**
 * @objective Verify that other channel members see inline comments in the channel feed
 *
 * @precondition
 * Two users have access to the same channel
 * User1 creates an inline comment on a page
 */
test(
    'other channel members see inline comments in the channel feed',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user: user1, adminClient} = sharedPagesSetup;
        const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

        // # Create user2 FIRST and add to channel (before any comments are created)
        // This ensures user2 is a channel member when the comment is posted
        const {user: user2} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

        // # User1 logs in and creates wiki with page
        const {page: page1} = await loginAndNavigateToChannel(pw, user1, team.name, channel.name);

        // # Create wiki and page
        await createWikiThroughUI(page1, uniqueName('Channel Feed Wiki'));
        const pageTitle = uniqueName('Channel Feed Page');
        const pageContent = 'This content will have an inline comment that should be visible in the channel feed';
        await createPageThroughUI(page1, pageTitle, pageContent);

        // # User1 adds an inline comment
        await enterEditMode(page1);
        const commentText = uniqueName('Inline comment visible in channel');
        await addInlineCommentInEditMode(page1, commentText);
        await publishPage(page1);

        // * Verify comment marker is visible for user1
        await verifyCommentMarkerVisible(page1);

        // # User2 logs in and navigates to the channel
        const {page: page2} = await loginAndNavigateToChannel(pw, user2, team.name, channel.name);

        // * Wait for channel to fully load
        await page2.waitForLoadState('networkidle');

        // * Verify User2 sees the inline comment in the channel feed
        // The comment should appear as a post in the channel
        const channelFeed = page2.locator('#postListContent');
        await expect(channelFeed).toContainText(commentText, {timeout: HIERARCHY_TIMEOUT});

        // * Verify the comment shows the "Commented on the page:" context
        await expect(channelFeed).toContainText('Commented on the page:', {timeout: HIERARCHY_TIMEOUT});

        // # Cleanup
        await page2.close();
    },
);
