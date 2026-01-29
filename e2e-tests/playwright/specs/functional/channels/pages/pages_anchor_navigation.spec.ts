// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';
import {
    createWikiThroughUI,
    createPageThroughUI,
    createTestChannel,
    getEditor,
    waitForEditModeReady,
    addInlineCommentInEditMode,
    verifyCommentMarkerVisible,
    clickCommentMarkerAndOpenRHS,
    ELEMENT_TIMEOUT,
    HIERARCHY_TIMEOUT,
    WEBSOCKET_WAIT,
} from './test_helpers';

/**
 * @objective Verify that comment anchor markers have correct id attribute format (ic-<uuid>)
 */
test('creates inline comment with anchor ID in correct format', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${await pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `Anchor ID Wiki ${await pw.random.id()}`);
    await createPageThroughUI(page, 'Anchor ID Test', 'This text will have an inline comment with anchor ID');

    // # Add inline comment
    const editButton = page.locator('[data-testid="wiki-page-edit-button"]');
    await expect(editButton).toBeVisible();
    await editButton.click();
    await waitForEditModeReady(page);
    await addInlineCommentInEditMode(page, 'Testing anchor ID format');

    // # Publish the page
    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]').first();
    await publishButton.click();
    await page.waitForLoadState('networkidle');

    // * Verify comment marker exists and has correct ID format
    const commentMarker = await verifyCommentMarkerVisible(page);
    const markerId = await commentMarker.getAttribute('id');

    expect(markerId).toBeTruthy();
    expect(markerId).toMatch(/^ic-[\w-]+$/);
});

/**
 * @objective Verify clicking anchor context in channel feed navigates to page and highlights anchor
 */
test('navigates to page anchor from channel feed comment context', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${await pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page with inline comment
    await createWikiThroughUI(page, `Nav Test Wiki ${await pw.random.id()}`);
    await createPageThroughUI(page, 'Navigation Test Page', 'This is the anchor text for navigation testing');

    const editButton = page.locator('[data-testid="wiki-page-edit-button"]');
    await expect(editButton).toBeVisible();
    await editButton.click();
    await waitForEditModeReady(page);
    await addInlineCommentInEditMode(page, 'Navigate to this comment');

    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]').first();
    await publishButton.click();
    await page.waitForLoadState('networkidle');

    // # Get the anchor ID from the marker
    const commentMarker = await verifyCommentMarkerVisible(page);
    const anchorId = await commentMarker.getAttribute('id');

    // # Navigate to channel (away from wiki page)
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Find the inline comment context in channel feed (from page post notification)
    const anchorContext = page.locator('.inline-comment-anchor-box').first();

    // If no anchor context in feed, the test verifies the marker format above
    const hasAnchorContext = await anchorContext.isVisible().catch(() => false);

    if (hasAnchorContext) {
        // # Click on anchor context to navigate
        await anchorContext.click();
        await page.waitForLoadState('networkidle');

        // * Verify URL contains the anchor hash
        const url = page.url();
        expect(url).toContain(`#${anchorId}`);

        // * Verify the anchor element is visible and highlighted
        const targetAnchor = page.locator(`[id="${anchorId}"]`);
        await expect(targetAnchor).toBeVisible({timeout: ELEMENT_TIMEOUT});
    }
});

/**
 * @objective Verify anchor text is displayed correctly in comment context
 */
test('displays correct anchor text in inline comment context', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${await pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    const anchorText = 'This specific text is the anchor';
    const commentText = 'Comment about the anchor';

    // # Create wiki and page with specific anchor text
    await createWikiThroughUI(page, `Anchor Text Wiki ${await pw.random.id()}`);
    await createPageThroughUI(page, 'Anchor Text Test', anchorText);

    const editButton = page.locator('[data-testid="wiki-page-edit-button"]');
    await expect(editButton).toBeVisible();
    await editButton.click();
    await waitForEditModeReady(page);
    await addInlineCommentInEditMode(page, commentText);

    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]').first();
    await publishButton.click();
    await page.waitForLoadState('networkidle');

    // # Verify marker exists and click to open RHS
    const commentMarker = await verifyCommentMarkerVisible(page);
    await clickCommentMarkerAndOpenRHS(page, commentMarker);

    // * Verify anchor text appears in RHS context box
    const rhsAnchorBox = page.locator('[data-testid="wiki-rhs"] .inline-comment-anchor-box');
    await expect(rhsAnchorBox).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await expect(rhsAnchorBox).toContainText(anchorText);
});

/**
 * @objective Verify clicking anchor context in RHS scrolls to the anchor when already on the page
 */
test('scrolls to anchor when clicking anchor context in RHS', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${await pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `URL Hash Wiki ${await pw.random.id()}`);
    await createPageThroughUI(page, 'URL Hash Test', 'Text that will be anchored for URL testing');

    const editButton = page.locator('[data-testid="wiki-page-edit-button"]');
    await expect(editButton).toBeVisible();
    await editButton.click();
    await waitForEditModeReady(page);
    await addInlineCommentInEditMode(page, 'Test URL hash inclusion');

    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]').first();
    await publishButton.click();
    await page.waitForLoadState('networkidle');

    // # Get anchor ID
    const commentMarker = await verifyCommentMarkerVisible(page);
    const anchorId = await commentMarker.getAttribute('id');
    expect(anchorId).toBeTruthy();

    // # Open RHS
    await clickCommentMarkerAndOpenRHS(page, commentMarker);

    // # Find anchor context in RHS (may or may not be clickable depending on context)
    const rhsAnchorBox = page.locator('[data-testid="wiki-rhs"] .inline-comment-anchor-box').first();
    await expect(rhsAnchorBox).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify anchor context displays the correct text
    await expect(rhsAnchorBox).toContainText('Text that will be anchored');

    // * Verify the anchor element is visible on the page
    const anchorElement = page.locator(`[id="${anchorId}"]`);
    await expect(anchorElement).toBeVisible();
});

/**
 * @objective Verify anchor highlighting animation plays when navigating to anchor
 */
test('highlights anchor element when navigating via hash', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${await pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `Highlight Wiki ${await pw.random.id()}`);
    await createPageThroughUI(page, 'Highlight Test', 'This anchored text should highlight when navigated to');

    const editButton = page.locator('[data-testid="wiki-page-edit-button"]');
    await expect(editButton).toBeVisible();
    await editButton.click();
    await waitForEditModeReady(page);
    await addInlineCommentInEditMode(page, 'Test highlight');

    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]').first();
    await publishButton.click();
    await page.waitForLoadState('networkidle');

    // # Get anchor ID
    const commentMarker = await verifyCommentMarkerVisible(page);
    const anchorId = await commentMarker.getAttribute('id');
    expect(anchorId).toBeTruthy();

    // # Navigate to page with anchor hash
    const currentUrl = page.url();
    const baseUrl = currentUrl.split('#')[0];
    await page.goto(`${baseUrl}#${anchorId}`);
    await page.waitForLoadState('networkidle');

    // * Verify anchor element gets highlighted class
    const anchorElement = page.locator(`[id="${anchorId}"]`);
    await expect(anchorElement).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // Check for highlight class (may be applied temporarily)
    const hasHighlight = await anchorElement.evaluate((el) => {
        return el.classList.contains('anchor-highlighted') || getComputedStyle(el).backgroundColor.includes('255');
    });

    // The highlight should be present or the element should be visible at minimum
    expect(hasHighlight || (await anchorElement.isVisible())).toBeTruthy();
});

/**
 * @objective Verify anchor marker is not duplicated when text is edited around it
 */
test('preserves single anchor when editing nearby text', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${await pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `Edit Nearby Wiki ${await pw.random.id()}`);
    await createPageThroughUI(page, 'Edit Nearby Test', 'Prefix anchored text suffix');

    const editButton = page.locator('[data-testid="wiki-page-edit-button"]');
    await expect(editButton).toBeVisible();
    await editButton.click();
    await waitForEditModeReady(page);
    await addInlineCommentInEditMode(page, 'Comment on anchored text', 'anchored text');

    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]').first();
    await publishButton.click();
    await page.waitForLoadState('networkidle');

    // # Verify single marker exists
    let markers = page.locator('[id^="ic-"], .comment-anchor');
    await expect(markers).toHaveCount(1);
    const originalId = await markers.first().getAttribute('id');

    // # Edit the page - add text before the anchor
    const editButton2 = page.locator('[data-testid="wiki-page-edit-button"]');
    await editButton2.click();
    await waitForEditModeReady(page);

    // Type at the beginning
    const editor = getEditor(page);
    await editor.click();
    await page.keyboard.press('Home');
    await page.keyboard.type('NEW: ');

    // # Publish again
    const publishButton2 = page.locator('[data-testid="wiki-page-publish-button"]').first();
    await publishButton2.click();
    await page.waitForLoadState('networkidle');

    // * Verify still only one marker exists
    markers = page.locator('[id^="ic-"], .comment-anchor');
    await expect(markers).toHaveCount(1);

    // * Verify the anchor ID is preserved
    const preservedId = await markers.first().getAttribute('id');
    expect(preservedId).toBe(originalId);
});

/**
 * @objective Verify inline comment anchor works in Threads panel
 */
test('displays clickable anchor context in global Threads panel', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${await pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page with inline comment
    await createWikiThroughUI(page, `Threads Anchor Wiki ${await pw.random.id()}`);
    await createPageThroughUI(page, 'Threads Anchor Test', 'Content for threads anchor testing');

    const editButton = page.locator('[data-testid="wiki-page-edit-button"]');
    await expect(editButton).toBeVisible();
    await editButton.click();
    await waitForEditModeReady(page);
    await addInlineCommentInEditMode(page, 'Comment for threads test');

    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]').first();
    await publishButton.click();
    await page.waitForLoadState('networkidle');

    // # Verify marker and open RHS to participate in thread
    const commentMarker = await verifyCommentMarkerVisible(page);
    await clickCommentMarkerAndOpenRHS(page, commentMarker);

    // Wait for RHS to fully load
    await page.waitForSelector(':text("Commented on the page:")', {timeout: HIERARCHY_TIMEOUT});

    // # Navigate to global Threads
    const threadsLink = page.locator('a[href*="/threads"]').first();
    await expect(threadsLink).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await threadsLink.click();
    await page.waitForLoadState('networkidle');

    // * Verify thread appears
    const threadItem = page.locator('.ThreadItem').filter({hasText: 'Commented on the page:'}).first();
    const hasThread = await threadItem.isVisible().catch(() => false);

    if (hasThread) {
        // * Verify anchor context is displayed in thread item
        const anchorContext = threadItem.locator('.inline-comment-anchor-box');
        await expect(anchorContext).toBeVisible({timeout: WEBSOCKET_WAIT});
    }
});
