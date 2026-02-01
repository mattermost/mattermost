// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';
import {
    buildWikiPageUrl,
    createWikiThroughUI,
    createPageThroughUI,
    createTestChannel,
    createTestUserInChannel,
    createChildPageThroughContextMenu,
    renameWikiThroughModal,
    renamePageViaContextMenu,
    moveWikiToChannel,
    openMovePageModal,
    getWikiTab,
    getBreadcrumb,
    getPageViewerContent,
    verifyPageInHierarchy,
    setupWebSocketEventLogging,
    getWebSocketEvents,
    waitForWikiTab,
    uniqueName,
    loginAndNavigateToChannel,
    EDITOR_LOAD_WAIT,
    ELEMENT_TIMEOUT,
    HIERARCHY_TIMEOUT,
    WEBSOCKET_WAIT,
    SHORT_WAIT,
} from './test_helpers';

/**
 * @objective Verify wiki tab name updates in real-time for other users when wiki is renamed
 *
 * @precondition
 * Pages/Wiki feature is enabled on the server
 * Two users have access to the same channel
 */
test(
    'updates wiki tab name in real-time for other users when wiki is renamed',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user: user1, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        // # User 1 creates wiki
        const {page: page1, channelsPage: channelsPage1} = await loginAndNavigateToChannel(
            pw,
            user1,
            team.name,
            channel.name,
        );

        const originalWikiName = uniqueName('Original Wiki');
        await createWikiThroughUI(page1, originalWikiName);

        // # Navigate back to channel view
        await channelsPage1.goto(team.name, channel.name);
        await page1.waitForLoadState('networkidle');

        // # Create user2 and add to channel
        const {user: user2} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

        // # User 2 logs in and navigates to channel (should see wiki tab)
        const {page: user2Page} = await loginAndNavigateToChannel(pw, user2, team.name, channel.name);

        // * Verify wiki tab is visible for user2 with original name
        const originalWikiTab = getWikiTab(user2Page, originalWikiName);
        await expect(originalWikiTab).toBeVisible({timeout: HIERARCHY_TIMEOUT});

        // # Setup WebSocket event logging for user2
        await setupWebSocketEventLogging(user2Page);

        // # User 1 renames the wiki via tab menu
        const newWikiName = uniqueName('Renamed Wiki');
        await waitForWikiTab(page1, originalWikiName);
        await renameWikiThroughModal(page1, originalWikiName, newWikiName);

        // * Verify rename succeeded for user1
        await expect(getWikiTab(page1, newWikiName)).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // * Wait for WebSocket event to propagate to user2
        await user2Page.waitForTimeout(WEBSOCKET_WAIT);

        // # Debug: Print captured WebSocket events
        await getWebSocketEvents(user2Page, 'Wiki Renamed');

        // * Verify wiki tab shows new name for user2 (real-time without refresh)
        const renamedWikiTab = getWikiTab(user2Page, newWikiName);
        await expect(renamedWikiTab).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // * Verify old name tab is gone
        await expect(originalWikiTab).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

        await user2Page.close();
    },
);

/**
 * @objective Verify wiki tab disappears and appears in correct channels for other users when wiki is moved
 *
 * @precondition
 * Pages/Wiki feature is enabled on the server
 * Two users have access to both source and target channels
 */
test(
    'updates wiki tab location in real-time for other users when wiki is moved between channels',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user: user1, adminClient} = sharedPagesSetup;

        // # Create source and target channels
        const sourceChannel = await createTestChannel(adminClient, team.id, 'Source Channel');
        const targetChannel = await createTestChannel(adminClient, team.id, 'Target Channel');

        // # Add user1 to both channels
        await adminClient.addToChannel(user1.id, sourceChannel.id);
        await adminClient.addToChannel(user1.id, targetChannel.id);

        // # User 1 creates wiki in source channel
        const {page: page1, channelsPage: channelsPage1} = await loginAndNavigateToChannel(
            pw,
            user1,
            team.name,
            sourceChannel.name,
        );

        const wikiName = uniqueName('Wiki to Move');
        await createWikiThroughUI(page1, wikiName);

        // # Navigate back to source channel
        await channelsPage1.goto(team.name, sourceChannel.name);
        await page1.waitForLoadState('networkidle');

        // # Create user2 and add to both channels
        const {user: user2} = await createTestUserInChannel(pw, adminClient, team, sourceChannel, 'user2');
        await adminClient.addToChannel(user2.id, targetChannel.id);

        // # User 2 logs in and navigates to source channel (should see wiki tab)
        const {page: user2Page, channelsPage: channelsPage2} = await loginAndNavigateToChannel(
            pw,
            user2,
            team.name,
            sourceChannel.name,
        );

        // * Verify wiki tab is visible for user2 in source channel
        const sourceWikiTab = getWikiTab(user2Page, wikiName);
        await expect(sourceWikiTab).toBeVisible({timeout: HIERARCHY_TIMEOUT});

        // # Setup WebSocket event logging for user2
        await setupWebSocketEventLogging(user2Page);

        // # User 1 moves wiki to target channel
        await waitForWikiTab(page1, wikiName);
        await moveWikiToChannel(page1, wikiName, targetChannel.id);

        // * Verify wiki disappeared from source channel for user1
        await expect(getWikiTab(page1, wikiName)).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

        // * Wait for WebSocket event to propagate to user2
        await user2Page.waitForTimeout(WEBSOCKET_WAIT);

        // # Debug: Print captured WebSocket events
        await getWebSocketEvents(user2Page, 'Wiki Moved');

        // * Verify wiki tab disappeared from source channel for user2 (real-time)
        await expect(sourceWikiTab).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # User 2 navigates to target channel
        await channelsPage2.goto(team.name, targetChannel.name);
        await user2Page.waitForLoadState('networkidle');

        // * Verify wiki tab appears in target channel for user2
        const targetWikiTab = getWikiTab(user2Page, wikiName);
        await expect(targetWikiTab).toBeVisible({timeout: HIERARCHY_TIMEOUT});

        await user2Page.close();
    },
);

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
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

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
        const childPageUrl = buildWikiPageUrl(pw.url, team.name, channel.id, wiki.id, childPage.id);
        await user2Page.goto(childPageUrl);
        await user2Page.waitForLoadState('networkidle');

        // * Verify user2 sees breadcrumb with parent page name
        const user2Breadcrumb = getBreadcrumb(user2Page);
        await expect(user2Breadcrumb).toContainText(parentTitle, {timeout: HIERARCHY_TIMEOUT});

        // # Setup WebSocket event logging for user2
        await setupWebSocketEventLogging(user2Page);

        // # User 1 renames the parent page
        const newParentTitle = uniqueName('Renamed Parent');
        // Navigate to wiki to see hierarchy
        const wikiUrl = buildWikiPageUrl(pw.url, team.name, channel.id, wiki.id);
        await page1.goto(wikiUrl);
        await page1.waitForLoadState('networkidle');

        // Wait for hierarchy to load
        await verifyPageInHierarchy(page1, parentTitle, HIERARCHY_TIMEOUT);

        // Rename via context menu helper
        await renamePageViaContextMenu(page1, parentTitle, newParentTitle);

        // * Wait for rename to complete for user1
        await verifyPageInHierarchy(page1, newParentTitle, HIERARCHY_TIMEOUT);

        // * Wait for WebSocket event to propagate to user2
        await user2Page.waitForTimeout(WEBSOCKET_WAIT);

        // # Debug: Print captured WebSocket events
        await getWebSocketEvents(user2Page, 'Parent Page Renamed');

        // * Verify user2's breadcrumb updated with new parent name (real-time)
        await expect(user2Breadcrumb).toContainText(newParentTitle, {timeout: ELEMENT_TIMEOUT});

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
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

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
        const childPageUrl = buildWikiPageUrl(pw.url, team.name, channel.id, wiki.id, childPage.id);
        await user2Page.goto(childPageUrl);
        await user2Page.waitForLoadState('networkidle');
        await user2Page.waitForTimeout(SHORT_WAIT);

        // * Verify user2 sees the child page content
        const pageContent = getPageViewerContent(user2Page);
        await expect(pageContent).toContainText('Child content', {timeout: HIERARCHY_TIMEOUT});

        // # Setup WebSocket event logging for user2
        await setupWebSocketEventLogging(user2Page);

        // # User 1 moves the child page to be under newParent using API
        // This is more reliable than UI and tests the WebSocket broadcast
        await adminClient.updatePageParent(wiki.id, childPage.id!, newParent.id!);

        // * Wait for WebSocket event to propagate to user2
        await user2Page.waitForTimeout(WEBSOCKET_WAIT);

        // # Debug: Print captured WebSocket events
        await getWebSocketEvents(user2Page, 'Page Moved to New Parent');

        // * Verify user2 can still see the page content (page should remain accessible)
        await expect(pageContent).toContainText('Child content', {timeout: ELEMENT_TIMEOUT});

        // * Verify breadcrumb updated to show new parent
        const user2Breadcrumb = getBreadcrumb(user2Page);
        await expect(user2Breadcrumb).toContainText(newParentTitle, {timeout: ELEMENT_TIMEOUT});

        await user2Page.close();
    },
);

/**
 * @objective Verify user is redirected when viewing wiki that is moved to channel they don't have access to
 *
 * @precondition
 * Pages/Wiki feature is enabled on the server
 * User has access to source channel but not target channel
 */
test(
    'redirects user when wiki is moved to channel they cannot access',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user: user1, adminClient} = sharedPagesSetup;

        // # Create source channel (public) and target channel (private)
        const sourceChannel = await createTestChannel(adminClient, team.id, 'Public Source', 'O');
        const targetChannel = await createTestChannel(adminClient, team.id, 'Private Target', 'P');

        // # Add user1 to both channels
        await adminClient.addToChannel(user1.id, sourceChannel.id);
        await adminClient.addToChannel(user1.id, targetChannel.id);

        // # User 1 creates wiki in source channel with a page
        const {page: page1, channelsPage: channelsPage1} = await loginAndNavigateToChannel(
            pw,
            user1,
            team.name,
            sourceChannel.name,
        );

        const wikiName = uniqueName('Access Test Wiki');
        const wiki = await createWikiThroughUI(page1, wikiName);
        const testPage = await createPageThroughUI(page1, uniqueName('Test Page'), 'Test content');

        // # Create user2 and add ONLY to source channel (not target)
        const {user: user2} = await createTestUserInChannel(pw, adminClient, team, sourceChannel, 'user2');

        // # User 2 logs in and navigates to the wiki page
        const {page: user2Page} = await pw.testBrowser.login(user2);
        const wikiPageUrl = buildWikiPageUrl(pw.url, team.name, sourceChannel.id, wiki.id, testPage.id);
        await user2Page.goto(wikiPageUrl);
        await user2Page.waitForLoadState('networkidle');
        await user2Page.waitForTimeout(SHORT_WAIT);

        // * Verify user2 can view the page
        const pageContent = getPageViewerContent(user2Page);
        await expect(pageContent).toContainText('Test content', {timeout: HIERARCHY_TIMEOUT});

        // # Setup WebSocket event logging for user2
        await setupWebSocketEventLogging(user2Page);

        // # User 1 moves wiki to private target channel (user2 doesn't have access)
        await channelsPage1.goto(team.name, sourceChannel.name);
        await page1.waitForLoadState('networkidle');
        await waitForWikiTab(page1, wikiName);
        await moveWikiToChannel(page1, wikiName, targetChannel.id);

        // * Wait for WebSocket event to propagate to user2
        await user2Page.waitForTimeout(WEBSOCKET_WAIT);

        // # Debug: Print captured WebSocket events
        await getWebSocketEvents(user2Page, 'Wiki Moved to Inaccessible Channel');

        // * Verify user2 is redirected or shown access denied
        // Check for redirect or error state
        const currentUrl = user2Page.url();
        const isStillInWiki = currentUrl.includes(`/wiki/${sourceChannel.id}/${wiki.id}`);

        if (isStillInWiki) {
            // Look for access denied or error indicators
            const errorIndicators = [
                user2Page.locator('text=/access.*denied/i'),
                user2Page.locator('text=/permission/i'),
                user2Page.locator('text=/not.*found/i'),
                user2Page.locator('text=/cannot.*access/i'),
                user2Page.locator('.error'),
            ];

            let errorFound = false;
            for (const indicator of errorIndicators) {
                if (await indicator.isVisible({timeout: EDITOR_LOAD_WAIT}).catch(() => false)) {
                    errorFound = true;
                    break;
                }
            }

            // If no immediate error, reload and verify access is denied
            if (!errorFound) {
                await user2Page.reload();
                await user2Page.waitForLoadState('networkidle');

                // After reload, should be redirected or show error
                const urlAfterReload = user2Page.url();
                const redirectedAfterReload = !urlAfterReload.includes(`/wiki/${sourceChannel.id}/${wiki.id}`);
                expect(redirectedAfterReload).toBe(true);
            }
        } else {
            // Successfully redirected away from wiki
            expect(isStillInWiki).toBe(false);
        }

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
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

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
        const sourceWikiPageUrl = buildWikiPageUrl(pw.url, team.name, channel.id, sourceWiki.id, createdPage.id);
        await user2Page.goto(sourceWikiPageUrl);
        await user2Page.waitForLoadState('networkidle');
        await user2Page.waitForTimeout(SHORT_WAIT);

        // * Verify user2 sees the page content
        const pageContent = getPageViewerContent(user2Page);
        await expect(pageContent).toContainText('This page will be moved between wikis', {timeout: HIERARCHY_TIMEOUT});

        // # Setup WebSocket event logging for user2
        await setupWebSocketEventLogging(user2Page);

        // # User 1 moves the page to target wiki
        const page1WikiPageUrl = buildWikiPageUrl(pw.url, team.name, channel.id, sourceWiki.id, createdPage.id);
        await page1.goto(page1WikiPageUrl);
        await page1.waitForLoadState('networkidle');

        const moveModal = await openMovePageModal(page1, pageTitle);

        const wikiSelect = moveModal.locator('#target-wiki-select');
        await wikiSelect.selectOption(targetWiki.id);

        const confirmButton = moveModal.getByRole('button', {name: /Move|Confirm/i});
        await confirmButton.click();
        await expect(moveModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

        // * Wait for WebSocket event to propagate to user2
        await user2Page.waitForTimeout(WEBSOCKET_WAIT);

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
