// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';
import {
    buildWikiPageUrl,
    createTestChannel,
    createWikiThroughUI,
    createPageThroughUI,
    createTestUserInChannel,
    createChildPageThroughContextMenu,
    renamePageViaContextMenu,
    openMovePageModal,
    getBreadcrumb,
    getPageViewerContent,
    verifyPageInHierarchy,
    setupWebSocketEventLogging,
    getWebSocketEvents,
    uniqueName,
    loginAndNavigateToChannel,
    EDITOR_LOAD_WAIT,
    ELEMENT_TIMEOUT,
    HIERARCHY_TIMEOUT,
} from './test_helpers';

/**
 * @objective Verify breadcrumb updates in real-time when ancestor page is renamed
 *
 * @precondition
 * Pages/Wiki feature is enabled on the server
 * Two users viewing the same page hierarchy
 */
test(
    'updates breadcrumb in real-time when ancestor page is renamed',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user: user1, adminClient} = sharedPagesSetup;
        const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'), 'O', [user1.id]);

        // # User 1 creates wiki with parent/child hierarchy
        const {page: page1} = await loginAndNavigateToChannel(pw, user1, team.name, channel.name);

        const wiki = await createWikiThroughUI(page1, uniqueName('Breadcrumb Test Wiki'));
        const parentTitle = uniqueName('Parent Page');
        const parentPage = await createPageThroughUI(page1, parentTitle, 'Parent content');
        const childTitle = uniqueName('Child Page');
        const childPage = await createChildPageThroughContextMenu(page1, parentPage.id, childTitle, 'Child content');

        // # Create user2 and add to channel
        const {user: user2} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

        // # User 2 logs in and navigates directly to the child page
        const {page: user2Page} = await pw.testBrowser.login(user2);
        const childPageUrl = buildWikiPageUrl(pw.url, team.name, wiki.id, childPage.id, channel.id);
        await user2Page.goto(childPageUrl);
        await user2Page.waitForLoadState('networkidle');

        // * Verify user2 sees breadcrumb with parent page name
        const user2Breadcrumb = getBreadcrumb(user2Page);
        await expect(user2Breadcrumb).toContainText(parentTitle, {timeout: HIERARCHY_TIMEOUT});

        // # Setup WebSocket event logging for user2
        await setupWebSocketEventLogging(user2Page);

        // # User 1 renames the parent page via API (mirrors the API-driven movePage flow
        //   used later in this file). The UI inline-rename path stages a draft and the
        //   subsequent publish is fragile in this multi-user scenario; the API hits
        //   UpdatePage directly which emits `WebsocketEventPageTitleUpdated` — exactly
        //   the WS path the test is meant to exercise on user2's side.
        const newParentTitle = uniqueName('Renamed Parent');
        await adminClient.updatePage(wiki.id, parentPage.id!, newParentTitle);

        // # Debug: Print captured WebSocket events
        await getWebSocketEvents(user2Page, 'Parent Page Renamed');

        // * Verify user2's breadcrumb updated with new parent name (real-time)
        await expect(user2Breadcrumb).toContainText(newParentTitle, {timeout: HIERARCHY_TIMEOUT});

        // * Verify old parent name is no longer in breadcrumb
        await expect(user2Breadcrumb).not.toContainText(parentTitle);

        await user2Page.close();
    },
);

/**
 * @objective Verify user viewing page is handled gracefully when page is moved to different parent
 *
 * @precondition
 * Pages/Wiki feature is enabled on the server
 * Page has nested hierarchy
 */
test(
    'handles URL gracefully when viewed page is moved to different parent',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user: user1, adminClient} = sharedPagesSetup;
        const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'), 'O', [user1.id]);

        // # User 1 creates wiki with multiple pages
        const {page: page1} = await loginAndNavigateToChannel(pw, user1, team.name, channel.name);

        const wiki = await createWikiThroughUI(page1, uniqueName('Move Parent Test Wiki'));
        const originalParentTitle = uniqueName('Original Parent');
        const originalParent = await createPageThroughUI(page1, originalParentTitle, 'Original parent content');
        const newParentTitle = uniqueName('New Parent');
        const newParent = await createPageThroughUI(page1, newParentTitle, 'New parent content');
        const childTitle = uniqueName('Child Page');
        const childPage = await createChildPageThroughContextMenu(
            page1,
            originalParent.id,
            childTitle,
            'Child content',
        );

        // # Create user2 and add to channel
        const {user: user2} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

        // # User 2 logs in and navigates directly to the child page
        const {page: user2Page} = await pw.testBrowser.login(user2);
        const childPageUrl = buildWikiPageUrl(pw.url, team.name, wiki.id, childPage.id, channel.id);
        await user2Page.goto(childPageUrl);
        await user2Page.waitForLoadState('networkidle');

        // * Verify user2 sees the child page content
        const pageContent = getPageViewerContent(user2Page);
        await expect(pageContent).toContainText('Child content', {timeout: HIERARCHY_TIMEOUT});

        // # Setup WebSocket event logging for user2
        await setupWebSocketEventLogging(user2Page);

        // # User 1 moves the child page to be under newParent using API
        // This is more reliable than UI and tests the WebSocket broadcast
        await adminClient.movePage(wiki.id, childPage.id!, newParent.id!);

        // * Wait for WebSocket event to propagate to user2
        // # Debug: Print captured WebSocket events
        await getWebSocketEvents(user2Page, 'Page Moved to New Parent');

        // * Verify user2 can still see the page content (page should remain accessible)
        await expect(pageContent).toContainText('Child content', {timeout: HIERARCHY_TIMEOUT});

        // * Verify breadcrumb updated to show new parent
        const user2Breadcrumb = getBreadcrumb(user2Page);
        await expect(user2Breadcrumb).toContainText(newParentTitle, {timeout: HIERARCHY_TIMEOUT});

        await user2Page.close();
    },
);

/**
 * @objective Verify user viewing wiki page sees real-time update when page is moved between wikis
 *
 * @precondition
 * Pages/Wiki feature is enabled on the server
 * Channel has two wikis
 */
test(
    'handles page viewing when page is moved to different wiki by another user',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user: user1, adminClient} = sharedPagesSetup;
        const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'), 'O', [user1.id]);

        // # User 1 creates two wikis and a page in first wiki
        const {page: page1, channelsPage: channelsPage1} = await loginAndNavigateToChannel(
            pw,
            user1,
            team.name,
            channel.name,
        );

        const sourceWiki = await createWikiThroughUI(page1, uniqueName('Source Wiki'));
        const pageTitle = uniqueName('Page to Move');
        const createdPage = await createPageThroughUI(page1, pageTitle, 'This page will be moved between wikis');

        // # Navigate back to channel to create target wiki
        await channelsPage1.goto(team.name, channel.name);
        const targetWiki = await createWikiThroughUI(page1, uniqueName('Target Wiki'));

        // # Create user2 and add to channel
        const {user: user2} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

        // # User 2 logs in and navigates to the page in source wiki
        const {page: user2Page} = await pw.testBrowser.login(user2);
        const sourceWikiPageUrl = buildWikiPageUrl(pw.url, team.name, sourceWiki.id, createdPage.id, channel.id);
        await user2Page.goto(sourceWikiPageUrl);
        await user2Page.waitForLoadState('networkidle');

        // * Verify user2 sees the page content
        const pageContent = getPageViewerContent(user2Page);
        await expect(pageContent).toContainText('This page will be moved between wikis', {timeout: HIERARCHY_TIMEOUT});

        // # Setup WebSocket event logging for user2
        await setupWebSocketEventLogging(user2Page);

        // # User 1 moves the page to target wiki
        const page1WikiPageUrl = buildWikiPageUrl(pw.url, team.name, sourceWiki.id, createdPage.id, channel.id);
        await page1.goto(page1WikiPageUrl);
        await page1.waitForLoadState('networkidle');

        const moveModal = await openMovePageModal(page1, pageTitle);

        const wikiSelect = moveModal.locator('#target-wiki-select');
        await wikiSelect.selectOption(targetWiki.id);

        const confirmButton = moveModal.getByRole('button', {name: /Move|Confirm/i});
        await confirmButton.click();
        await expect(moveModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Debug: Print captured WebSocket events
        await getWebSocketEvents(user2Page, 'Page Moved Between Wikis');

        // * Verify user2's view is updated appropriately
        // Option 1: User is redirected to the new location
        // Option 2: User sees a notification that page was moved
        // Option 3: User sees error/not found message

        // Check current URL
        const currentUrl = user2Page.url();
        const isAtNewLocation = currentUrl.includes(targetWiki.id);
        const isAtOldLocation = currentUrl.includes(sourceWiki.id);

        if (isAtNewLocation) {
            // User was redirected to new wiki - verify content still visible
            await expect(pageContent).toContainText('This page will be moved between wikis', {
                timeout: ELEMENT_TIMEOUT,
            });
        } else if (isAtOldLocation) {
            // User is still at old URL - check for notification or error
            const movedNotification = user2Page.locator('text=/moved/i');
            const errorMessage = user2Page.locator('text=/not.*found/i');

            const hasNotification = await movedNotification.isVisible({timeout: EDITOR_LOAD_WAIT}).catch(() => false);
            const hasError = await errorMessage.isVisible({timeout: EDITOR_LOAD_WAIT}).catch(() => false);

            // At minimum, user should be notified somehow
            // If no notification, reload and verify behavior
            if (!hasNotification && !hasError) {
                await user2Page.reload();
                await user2Page.waitForLoadState('networkidle');

                // After reload of old URL, should show error or redirect
                const urlAfterReload = user2Page.url();
                const wasRedirected = urlAfterReload.includes(targetWiki.id) || !urlAfterReload.includes(sourceWiki.id);
                expect(wasRedirected).toBe(true);
            }
        }

        await user2Page.close();
    },
);
