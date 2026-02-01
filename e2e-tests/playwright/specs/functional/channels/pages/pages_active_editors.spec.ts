// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';
import {
    buildChannelUrl,
    buildWikiPageUrl,
    createWikiThroughUI,
    createTestChannel,
    getEditor,
    getEditorAndWait,
    getPageViewerContent,
    typeInEditor,
    fillCreatePageModal,
    getNewPageButton,
    clickPageInHierarchy,
    enterEditMode,
    publishPage,
    navigateToPage,
    deletePageDraft,
    createTestUserInChannel,
    createMultipleTestUsersInChannel,
    waitForActiveEditorsIndicator,
    loginAndNavigateToChannel,
    uniqueName,
    AUTOSAVE_WAIT,
    WEBSOCKET_WAIT,
    HIERARCHY_TIMEOUT,
} from './test_helpers';

/**
 * @objective Verify active editors indicator displays when another user edits the same page
 */
test('shows active editor when another user edits page', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'), 'O', [user.id]);

    // # Create a second user
    const {user: user2} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

    // # User 1 logs in and creates a wiki with a page
    const {page: page1} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    const wiki = await createWikiThroughUI(page1, uniqueName('Active Editors Wiki'));

    const newPageButton = getNewPageButton(page1);
    await newPageButton.click();
    await fillCreatePageModal(page1, 'Shared Page');

    // # Wait for editor to appear
    await getEditorAndWait(page1);
    await typeInEditor(page1, 'Initial content');

    // # Wait for draft to save
    await page1.waitForTimeout(WEBSOCKET_WAIT);

    // # Publish the page
    await publishPage(page1);

    // # Get page ID from URL
    const pageUrl = page1.url();
    const pageId = pageUrl.split('/').pop();

    // Verify all URL components are valid
    if (!pageId || !wiki.id || !channel.id || !team.name) {
        throw new Error(
            `Missing URL components: pageId=${pageId}, wikiId=${wiki.id}, channelId=${channel.id}, teamName=${team.name}`,
        );
    }

    // # User 2 logs in and navigates directly to the wiki page
    const {page: page2} = await loginAndNavigateToChannel(pw, user2, team.name, channel.name);

    // Navigate to the specific page
    await navigateToPage(page2, pw.url, team.name, channel.id, wiki.id, pageId!);

    // # Start editing the page
    await enterEditMode(page2);

    await getEditorAndWait(page2);
    await typeInEditor(page2, ' User 2 editing');

    // # Wait for draft to save
    await page2.waitForTimeout(AUTOSAVE_WAIT);

    // * User 1 should see active editors indicator showing User 2
    const activeEditorsIndicator = await waitForActiveEditorsIndicator(page1, {expectedText: '1 person editing'});

    // * Verify User 2's avatar is displayed
    const avatar = activeEditorsIndicator.locator(`[data-testid*="avatar"]`);
    await expect(avatar).toBeVisible();

    await page2.close();
});

/**
 * @objective Verify active editors indicator shows multiple editors
 */
test('displays multiple active editors with avatars and count', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'), 'O', [user.id]);

    // # Create two additional users
    const {user: user2} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');
    const {user: user3} = await createTestUserInChannel(pw, adminClient, team, channel, 'user3');

    // # User 1 logs in and creates a wiki with a page
    const {page: page1} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    const wiki = await createWikiThroughUI(page1, uniqueName('Multi Editor Wiki'));

    const newPageButton = getNewPageButton(page1);
    await newPageButton.click();
    await fillCreatePageModal(page1, 'Multi Editor Page');

    await getEditorAndWait(page1);
    await typeInEditor(page1, 'Initial content');
    await page1.waitForTimeout(WEBSOCKET_WAIT);

    // # Publish the page
    await publishPage(page1);

    // # Get page ID from URL
    const pageUrl = page1.url();
    const pageId = pageUrl.split('/').pop();

    // # User 2 logs in and starts editing
    const {page: page2} = await pw.testBrowser.login(user2);
    await navigateToPage(page2, pw.url, team.name, channel.id, wiki.id, pageId!);

    await enterEditMode(page2);

    await getEditorAndWait(page2);
    await typeInEditor(page2, ' User 2 content');
    await page2.waitForTimeout(AUTOSAVE_WAIT);

    // # User 3 logs in and starts editing
    const {page: page3} = await pw.testBrowser.login(user3);
    await navigateToPage(page3, pw.url, team.name, channel.id, wiki.id, pageId!);

    await enterEditMode(page3);

    await getEditorAndWait(page3);
    await typeInEditor(page3, ' User 3 content');

    // # Both users type again to ensure they're both active at the same time
    await typeInEditor(page2, '!');
    await typeInEditor(page3, '!');
    await page3.waitForTimeout(AUTOSAVE_WAIT);

    // * User 1 should see active editors indicator showing both users
    const activeEditorsIndicator = await waitForActiveEditorsIndicator(page1, {expectedText: '2 people editing'});

    // * Verify multiple avatars are displayed
    const avatars = activeEditorsIndicator.locator('[data-testid*="avatar"]');
    await expect(avatars).toHaveCount(2);

    await page2.close();
    await page3.close();
});

/**
 * @objective Verify active editors indicator disappears when editors stop editing
 */
test('removes editor from indicator when draft is deleted', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'), 'O', [user.id]);

    // # Create a second user
    const {user: user2} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

    // # User 1 creates a page
    const {page: page1} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    const wiki = await createWikiThroughUI(page1, uniqueName('Editor Removal Wiki'));

    const newPageButton = getNewPageButton(page1);
    await newPageButton.click();
    await fillCreatePageModal(page1, 'Removal Test Page');

    await getEditorAndWait(page1);
    await typeInEditor(page1, 'Initial content');
    await page1.waitForTimeout(WEBSOCKET_WAIT);

    // # Publish the page
    await publishPage(page1);

    // # Get page ID from URL
    const pageUrl = page1.url();
    const pageId = pageUrl.split('/').pop();

    // # User 2 starts editing
    const {page: page2} = await loginAndNavigateToChannel(pw, user2, team.name, channel.name);

    await navigateToPage(page2, pw.url, team.name, channel.id, wiki.id, pageId!);

    await enterEditMode(page2);

    await getEditorAndWait(page2);
    await typeInEditor(page2, ' User 2 content');
    await page2.waitForTimeout(AUTOSAVE_WAIT);

    // * User 1 should see active editors indicator
    const activeEditorsIndicator = await waitForActiveEditorsIndicator(page1);

    // # User 2 deletes the draft through the UI
    await deletePageDraft(page2, pageId!);

    // * Active editors indicator should disappear for User 1
    await expect(activeEditorsIndicator).not.toBeVisible({timeout: HIERARCHY_TIMEOUT});

    await page2.close();
});

/**
 * @objective Verify active editors indicator does not show current user
 */
test('does not show current user in active editors list', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'), 'O', [user.id]);

    // # User logs in and creates a draft
    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    await createWikiThroughUI(page, uniqueName('Self Edit Wiki'));

    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Self Edit Page');

    await getEditorAndWait(page);
    await typeInEditor(page, 'User editing their own draft');
    await page.waitForTimeout(AUTOSAVE_WAIT);

    // * Active editors indicator should not be visible
    const activeEditorsIndicator = page.locator('.active-editors-indicator');
    await expect(activeEditorsIndicator).not.toBeVisible();
});

/**
 * @objective Verify active editors indicator shows correct count with overflow
 */
test('displays overflow count when more than 3 editors', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    test.slow();
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'), 'O', [user.id]);

    // # Create 4 additional users
    const userResults = await createMultipleTestUsersInChannel(pw, adminClient, team, channel, 4, 'user');
    const users = userResults.map((result) => result.user);

    // # User 1 creates a page
    const {page: page1} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    const wiki = await createWikiThroughUI(page1, uniqueName('Overflow Wiki'));

    const newPageButton = getNewPageButton(page1);
    await newPageButton.click();
    await fillCreatePageModal(page1, 'Overflow Page');

    await getEditorAndWait(page1);
    await typeInEditor(page1, 'Initial content');
    await page1.waitForTimeout(WEBSOCKET_WAIT);

    // # Publish the page
    await publishPage(page1);

    // # Get page ID from URL
    const pageUrl = page1.url();
    const pageId = pageUrl.split('/').pop();

    // # All 4 users start editing
    const pages = [];
    for (let i = 0; i < 4; i++) {
        const {page: userPage} = await pw.testBrowser.login(users[i]);
        const wikiPageUrl = buildWikiPageUrl(pw.url, team.name, channel.id, wiki.id, pageId);
        await userPage.goto(wikiPageUrl);
        await userPage.waitForLoadState('networkidle');

        const pageViewer = getPageViewerContent(userPage);
        await pageViewer.waitFor({state: 'visible', timeout: HIERARCHY_TIMEOUT});

        await enterEditMode(userPage);

        await getEditorAndWait(userPage);
        await typeInEditor(userPage, ` User ${i} content`);

        pages.push(userPage);
    }

    // # All users type again to ensure they're all active at the same time
    for (const p of pages) {
        await typeInEditor(p, '!');
    }
    await pages[3].waitForTimeout(AUTOSAVE_WAIT);

    // * User 1 should see active editors indicator with overflow (4 people editing)
    const activeEditorsIndicator = await waitForActiveEditorsIndicator(page1, {expectedText: '4 people editing'});

    // * Verify only 3 avatars are shown (max visible)
    const avatars = activeEditorsIndicator.locator('[data-testid*="avatar"]');
    await expect(avatars).toHaveCount(3);

    // * Verify overflow indicator shows +1
    const overflowIndicator = activeEditorsIndicator.locator('.active-editors-indicator__more');
    await expect(overflowIndicator).toBeVisible();
    await expect(overflowIndicator).toContainText('+1');

    // # Cleanup
    for (const p of pages) {
        await p.close();
    }
});

/**
 * @objective Verify active editors indicator updates immediately when user navigates away without deleting draft
 *
 * Note: This test is skipped because full page navigation (page.goto) cannot reliably send
 * authenticated requests during beforeunload. The system relies on 5-minute stale cleanup for this case.
 * React Router navigation (test below) works correctly with immediate cleanup.
 */
test.skip('removes editor from indicator when user navigates away', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'), 'O', [user.id]);

    // # Create a second user
    const {user: user2} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

    // # User 1 creates a page
    const {page: page1} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    const wiki = await createWikiThroughUI(page1, uniqueName('Navigate Away Wiki'));

    const newPageButton = getNewPageButton(page1);
    await newPageButton.click();
    await fillCreatePageModal(page1, 'Navigate Away Page');

    await getEditorAndWait(page1);
    await typeInEditor(page1, 'Initial content');
    await page1.waitForTimeout(WEBSOCKET_WAIT);

    // # Publish the page
    await publishPage(page1);

    // # Get page ID from URL
    const pageUrl = page1.url();
    const pageId = pageUrl.split('/').pop();

    // # User 2 starts editing
    const {page: page2} = await loginAndNavigateToChannel(pw, user2, team.name, channel.name);

    await navigateToPage(page2, pw.url, team.name, channel.id, wiki.id, pageId!);

    await enterEditMode(page2);

    await getEditorAndWait(page2);
    await typeInEditor(page2, ' User 2 editing');
    await page2.waitForTimeout(AUTOSAVE_WAIT);

    // * User 1 should see active editors indicator
    const activeEditorsIndicator = await waitForActiveEditorsIndicator(page1, {expectedText: '1 person editing'});

    // # User 2 navigates away WITHOUT deleting draft (draft persists)
    await page2.goto(buildChannelUrl(pw.url, team.name, channel.name));
    await page2.waitForTimeout(WEBSOCKET_WAIT);

    // * Active editors indicator should disappear immediately for User 1
    // Note: Client sends PAGE_EDITOR_STOPPED via beforeunload handler (sendBeacon for page navigations)
    await expect(activeEditorsIndicator).not.toBeVisible({timeout: HIERARCHY_TIMEOUT});

    // # Verify draft still exists for User 2 (can resume editing)
    await navigateToPage(page2, pw.url, team.name, channel.id, wiki.id, pageId!);

    // # Click Edit button to resume editing the draft
    await enterEditMode(page2);

    // * Editor should show existing draft content when returning
    const editorContent = getEditor(page2);
    await expect(editorContent).toContainText('User 2 editing');

    await page2.close();
});

/**
 * @objective Verify active editors indicator persists while user continues editing
 *
 * This test catches regressions where the indicator briefly appears then disappears
 * due to incorrect cleanup behavior (e.g., useEffect cleanup running on state changes
 * instead of only on component unmount).
 */
test(
    'active editors indicator persists while user continues editing',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'), 'O', [user.id]);

        // # Create a second user
        const {user: user2} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

        // # User 1 logs in and creates a wiki with a page
        const {page: page1} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        const wiki = await createWikiThroughUI(page1, uniqueName('Persistence Wiki'));

        const newPageButton = getNewPageButton(page1);
        await newPageButton.click();
        await fillCreatePageModal(page1, 'Persistence Test Page');

        // # Wait for editor to appear
        await getEditorAndWait(page1);
        await typeInEditor(page1, 'Initial content');

        // # Wait for draft to save
        await page1.waitForTimeout(WEBSOCKET_WAIT);

        // # Publish the page
        await publishPage(page1);

        // # Get page ID from URL
        const pageUrl = page1.url();
        const pageId = pageUrl.split('/').pop();

        // # User 2 logs in and navigates directly to the wiki page
        const {page: page2} = await loginAndNavigateToChannel(pw, user2, team.name, channel.name);

        await navigateToPage(page2, pw.url, team.name, channel.id, wiki.id, pageId!);

        // # Start editing the page
        await enterEditMode(page2);

        await getEditorAndWait(page2);
        await typeInEditor(page2, ' User 2 editing');

        // # Wait for draft to save
        await page2.waitForTimeout(AUTOSAVE_WAIT);

        // * User 1 should see active editors indicator showing User 2
        const activeEditorsIndicator = await waitForActiveEditorsIndicator(page1, {expectedText: '1 person editing'});

        // # KEY TEST: User 2 continues typing multiple times, triggering state updates and autosaves
        // This catches the bug where useEffect cleanup runs on every dependency change
        for (let i = 0; i < 5; i++) {
            await typeInEditor(page2, ` more text ${i}`);
            await page2.waitForTimeout(AUTOSAVE_WAIT);

            // * CRITICAL: Indicator should STILL be visible after each autosave cycle
            // With the bug, this would fail because cleanup incorrectly sends PAGE_EDITOR_STOPPED
            await expect(activeEditorsIndicator).toBeVisible();
            await expect(activeEditorsIndicator).toContainText('1 person editing');
        }

        // * Final verification: indicator is still visible after all editing cycles
        await expect(activeEditorsIndicator).toBeVisible();

        await page2.close();
    },
);

/**
 * @objective Verify active editors are removed when navigating to a different page within the wiki
 */
test('removes editor when navigating to different wiki page', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    test.slow();
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'), 'O', [user.id]);

    // # Create a second user
    const {user: user2} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

    // # User 1 creates a wiki with two pages
    const {page: page1} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    const wiki = await createWikiThroughUI(page1, uniqueName('Wiki Navigation Test'));

    // # Create first page
    const newPageButton1 = getNewPageButton(page1);
    await newPageButton1.click();
    await fillCreatePageModal(page1, 'Page A');
    await getEditorAndWait(page1);
    await typeInEditor(page1, 'Content for Page A');
    await page1.waitForTimeout(WEBSOCKET_WAIT);
    await publishPage(page1);

    const pageAUrl = page1.url();
    const pageAId = pageAUrl.split('/').pop();

    // # Create second page
    const newPageButton2 = getNewPageButton(page1);
    await newPageButton2.click();
    await fillCreatePageModal(page1, 'Page B');
    await getEditorAndWait(page1);
    await typeInEditor(page1, 'Content for Page B');
    await page1.waitForTimeout(WEBSOCKET_WAIT);
    await publishPage(page1);

    // Page B is created, but we don't need to capture its ID

    // # User 1 navigates to Page A and waits there
    await navigateToPage(page1, pw.url, team.name, channel.id, wiki.id, pageAId!);

    // # User 2 starts editing Page A
    const {page: page2} = await loginAndNavigateToChannel(pw, user2, team.name, channel.name);

    await navigateToPage(page2, pw.url, team.name, channel.id, wiki.id, pageAId!);
    await enterEditMode(page2);

    await getEditorAndWait(page2);
    await typeInEditor(page2, ' User 2 editing Page A');

    // # Type again to ensure User 2 is seen as active
    await typeInEditor(page2, '!');
    await page2.waitForTimeout(AUTOSAVE_WAIT);

    // * User 1 should see User 2 in active editors on Page A (via real-time WebSocket)
    const activeEditorsIndicatorA = await waitForActiveEditorsIndicator(page1, {expectedText: '1 person editing'});

    // # User 2 navigates to Page B (different page in same wiki)
    await clickPageInHierarchy(page2, 'Page B');
    await page2.waitForTimeout(WEBSOCKET_WAIT);

    // * User 1 should no longer see User 2 in active editors on Page A
    await expect(activeEditorsIndicatorA).not.toBeVisible({timeout: HIERARCHY_TIMEOUT});

    // # User 2 starts editing Page B
    await enterEditMode(page2);
    await getEditorAndWait(page2);
    await typeInEditor(page2, ' User 2 editing Page B');

    // # Type again to ensure User 2 is seen as active
    await typeInEditor(page2, '!');
    await page2.waitForTimeout(AUTOSAVE_WAIT);

    // * User 1 navigates to Page B and sees User 2 there
    await clickPageInHierarchy(page1, 'Page B');
    await waitForActiveEditorsIndicator(page1, {expectedText: '1 person editing'});

    await page2.close();
});
