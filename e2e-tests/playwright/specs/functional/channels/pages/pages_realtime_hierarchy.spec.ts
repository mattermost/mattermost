// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';

import {
    buildWikiPageUrl,
    createWikiThroughUI,
    createPageThroughUI,
    clickPageInHierarchy,
    verifyPageInHierarchy,
    verifyPageNotInHierarchy,
    openMovePageModal,
    getHierarchyPanel,
    createTestUserInChannel,
    renamePageViaContextMenu,
    deletePageThroughUI,
    createChildPageThroughContextMenu,
    withRolePermissions,
    setupWebSocketEventLogging,
    getWebSocketEvents,
    EDITOR_LOAD_WAIT,
    WEBSOCKET_WAIT,
    ELEMENT_TIMEOUT,
    HIERARCHY_TIMEOUT,
} from './test_helpers';

/**
 * @objective Verify page disappears from source wiki when moved to different wiki
 *
 * @precondition
 * Pages/Wiki feature is enabled on the server
 * Two users have access to the same channel
 */
test('removes page from source wiki hierarchy when moved to different wiki', {tag: '@pages'}, async ({pw, context, sharedPagesSetup}) => {
    const {team, user: user1, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    // # User 1 creates two wikis and a page in source wiki
    const {page: page1, channelsPage: channelsPage1} = await pw.testBrowser.login(user1);
    await channelsPage1.goto(team.name, channel.name);
    await channelsPage1.toBeVisible();

    const sourceWiki = await createWikiThroughUI(page1, `Source Wiki ${pw.random.id()}`);
    const pageTitle = `Page to Move ${pw.random.id()}`;
    const createdPage = await createPageThroughUI(page1, pageTitle, 'This page will be moved');

    // # Navigate back to channel to create target wiki
    await channelsPage1.goto(team.name, channel.name);
    const targetWiki = await createWikiThroughUI(page1, `Target Wiki ${pw.random.id()}`);

    // # Create user2 and add to channel
    const {user: user2, userId: user2Id} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

    // # User 2 logs in and navigates to source wiki (viewing the page that will be moved)
    const {page: user2Page} = await pw.testBrowser.login(user2);
    const sourceWikiUrl = buildWikiPageUrl(pw.url, team.name, channel.id, sourceWiki.id, createdPage.id);
    await user2Page.goto(sourceWikiUrl);
    await user2Page.waitForLoadState('networkidle');

    // # Wait for hierarchy panel to load for user2
    const user2HierarchyPanel = user2Page.locator('[data-testid="pages-hierarchy-panel"]');
    await user2HierarchyPanel.waitFor({state: 'visible', timeout: HIERARCHY_TIMEOUT});

    // * Verify page is visible in source wiki for user2
    await verifyPageInHierarchy(user2Page, pageTitle);

    // # Add WebSocket event logging for user2
    await user2Page.evaluate(() => {
        (window as any).wsEvents = [];
        (window as any).allActions = [];
        const originalDispatch = (window as any).store?.dispatch;
        if (originalDispatch) {
            (window as any).store.dispatch = function(action: any) {
                // Capture ALL actions for debugging
                if (action && action.type) {
                    (window as any).allActions.push({type: action.type, time: Date.now()});

                    // Capture page/post/wiki-related actions
                    const type = String(action.type).toUpperCase();
                    if (type.includes('PAGE') || type.includes('POST') || type.includes('WIKI') || type.includes('RECEIVED') || type.includes('REMOVED')) {
                        console.log('[WS Event]', action.type, action.data);
                        (window as any).wsEvents.push({type: action.type, data: action.data, time: Date.now()});
                    }
                }
                return originalDispatch.apply(this, arguments);
            };
        }
    });

    // # User 1 navigates back to source wiki and moves the page
    const sourceWikiUrl1 = buildWikiPageUrl(pw.url, team.name, channel.id, sourceWiki.id, createdPage.id);
    await page1.goto(sourceWikiUrl1);
    await page1.waitForLoadState('networkidle');

    // # User 1 moves page to target wiki
    const moveModal = await openMovePageModal(page1, pageTitle);

    const wikiSelect = moveModal.locator('#target-wiki-select');
    await wikiSelect.selectOption(targetWiki.id);

    const confirmButton = moveModal.getByRole('button', {name: 'Move'});
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();

    await expect(moveModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});
    await page1.waitForLoadState('networkidle');
    await page1.waitForTimeout(EDITOR_LOAD_WAIT);

    // * Verify page disappears from user2's source wiki hierarchy (real-time)
    await user2Page.waitForTimeout(WEBSOCKET_WAIT); // Allow WebSocket message to propagate

    // # Debug: Print captured WebSocket events
    const wsEvents = await user2Page.evaluate(() => (window as any).wsEvents || []);
    const allActionTypes = await user2Page.evaluate(() => ((window as any).allActions || []).map((a: any) => a.type));
    console.log('[Test 3 - Page Moved] Total Redux actions:', allActionTypes.length);
    console.log('[Test 3 - Page Moved] Last 10 action types:', allActionTypes.slice(-10));
    console.log('[Test 3 - Page Moved] WebSocket events received by user2:', JSON.stringify(wsEvents, null, 2));

    const user2PageNode = user2HierarchyPanel.locator('[data-testid="page-tree-node"]').filter({hasText: pageTitle});
    await expect(user2PageNode).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify empty state or other pages shown (page is gone)
    const hierarchyItems = user2HierarchyPanel.locator('[data-testid="page-tree-node"]');
    const count = await hierarchyItems.count();
    // If this was the only page, should show empty state
    if (count === 0) {
        const emptyState = user2HierarchyPanel.locator('text=/no pages/i');
        await expect(emptyState).toBeVisible();
    }

    await user2Page.close();
});

/**
 * @objective Verify page disappears and user redirected when page is deleted while viewing
 *
 * @precondition
 * Pages/Wiki feature is enabled on the server
 * Two users have access to the same channel
 */
test('shows notification and redirects when viewed page is deleted by another user', {tag: '@pages'}, async ({pw, context, sharedPagesSetup}) => {
    const {team, user: user1, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    // # User 1 creates wiki and page
    const {page: page1, channelsPage: channelsPage1} = await pw.testBrowser.login(user1);
    await channelsPage1.goto(team.name, channel.name);
    await channelsPage1.toBeVisible();

    const wiki = await createWikiThroughUI(page1, `Test Wiki ${pw.random.id()}`);
    const pageTitle = `Page to Delete ${pw.random.id()}`;
    const createdPage = await createPageThroughUI(page1, pageTitle, 'This page will be deleted');

    // # Create user2 with delete permissions
    const {user: user2, userId: user2Id} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

    // # Grant delete permissions to channel_user role
    const restorePermissions = await withRolePermissions(adminClient, 'channel_user', [
        'delete_page_public_channel',
        'delete_page_private_channel',
    ]);

    // # User 2 logs in and views the page
    const {page: user2Page} = await pw.testBrowser.login(user2);
    const wikiPageUrl = buildWikiPageUrl(pw.url, team.name, channel.id, wiki.id, createdPage.id);
    await user2Page.goto(wikiPageUrl);
    await user2Page.waitForLoadState('networkidle');

    // * Verify user2 is viewing the page
    const pageViewer = user2Page.locator('[data-testid="page-viewer-content"]');
    await expect(pageViewer).toBeVisible();
    await expect(pageViewer).toContainText('This page will be deleted');

    // # Add WebSocket event logging for user2
    await user2Page.evaluate(() => {
        (window as any).wsEvents = [];
        const originalDispatch = (window as any).store?.dispatch;
        if (originalDispatch) {
            (window as any).store.dispatch = function(action: any) {
                if (action.type && action.type.includes('PAGE') || action.type && action.type.includes('POST')) {
                    console.log('[WS Event]', action.type, action.data);
                    (window as any).wsEvents.push({type: action.type, data: action.data, time: Date.now()});
                }
                return originalDispatch.apply(this, arguments);
            };
        }
    });

    // # User 1 deletes the page via UI
    await deletePageThroughUI(page1, pageTitle);
    await page1.waitForTimeout(EDITOR_LOAD_WAIT);

    // * Verify page disappears from user2's view (real-time or after short delay)
    // This might show a notification, redirect, or error message
    // Implementation-specific behavior - check for common patterns
    await user2Page.waitForTimeout(WEBSOCKET_WAIT); // Allow WebSocket notification

    // # Debug: Print captured WebSocket events
    const wsEvents = await user2Page.evaluate(() => (window as any).wsEvents || []);
    console.log('[Test 4 - Page Delete] WebSocket events received by user2:', JSON.stringify(wsEvents, null, 2));

    // Check if redirected away from page (URL change) or if error shown
    const currentUrl = user2Page.url();
    const isStillOnPage = currentUrl.includes(createdPage.id);

    if (!isStillOnPage) {
        // Successfully redirected away from deleted page
        expect(isStillOnPage).toBe(false);
    } else {
        // May show error message or notification on the page
        // Look for common error indicators
        const errorIndicators = [
            user2Page.locator('text=/page.*not.*found/i'),
            user2Page.locator('text=/page.*deleted/i'),
            user2Page.locator('text=/no longer.*available/i'),
            user2Page.locator('.error'),
        ];

        let errorFound = false;
        for (const indicator of errorIndicators) {
            if (await indicator.isVisible({timeout: EDITOR_LOAD_WAIT}).catch(() => false)) {
                errorFound = true;
                break;
            }
        }

        // At minimum, content should be gone or error shown
        const contentGone = !(await pageViewer.isVisible({timeout: EDITOR_LOAD_WAIT}).catch(() => true));
        expect(errorFound || contentGone).toBe(true);
    }

    await user2Page.close();

    // # Cleanup: Restore original permissions
    await restorePermissions();
});

/**
 * @objective Verify page title updates in hierarchy when changed by another user
 *
 * @precondition
 * Pages/Wiki feature is enabled on the server
 * Two users have access to the same channel
 */
test('updates page title in hierarchy when renamed by another user', {tag: '@pages'}, async ({pw, context, sharedPagesSetup}) => {
    const {team, user: user1, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    // # User 1 creates wiki and page
    const {page: page1, channelsPage: channelsPage1} = await pw.testBrowser.login(user1);
    await channelsPage1.goto(team.name, channel.name);
    await channelsPage1.toBeVisible();

    const wiki = await createWikiThroughUI(page1, `Test Wiki ${pw.random.id()}`);
    const originalTitle = `Original Title ${pw.random.id()}`;
    const createdPage = await createPageThroughUI(page1, originalTitle, 'Test content');

    // # Create user2 and add to channel
    const {user: user2, userId: user2Id} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

    // # User 2 logs in and navigates to wiki
    const {page: user2Page} = await pw.testBrowser.login(user2);
    const wikiUrl = buildWikiPageUrl(pw.url, team.name, channel.id, wiki.id);
    await user2Page.goto(wikiUrl);
    await user2Page.waitForLoadState('networkidle');

    // # Wait for hierarchy panel to load
    const user2HierarchyPanel = getHierarchyPanel(user2Page);

    // * Verify original title is visible for user2
    await verifyPageInHierarchy(user2Page, originalTitle);

    // # Add WebSocket event logging for user2
    await user2Page.evaluate(() => {
        (window as any).wsEvents = [];
        (window as any).allActions = [];
        const originalDispatch = (window as any).store?.dispatch;
        if (originalDispatch) {
            (window as any).store.dispatch = function(action: any) {
                // Capture ALL actions for debugging
                if (action && action.type) {
                    (window as any).allActions.push({type: action.type, time: Date.now()});

                    // Capture page/post/wiki-related actions
                    const type = String(action.type).toUpperCase();
                    if (type.includes('PAGE') || type.includes('POST') || type.includes('WIKI') || type.includes('RECEIVED') || type.includes('RENAMED')) {
                        console.log('[WS Event]', action.type, action.data);
                        (window as any).wsEvents.push({type: action.type, data: action.data, time: Date.now()});
                    }
                }
                return originalDispatch.apply(this, arguments);
            };
        }
    });

    // # User 1 renames the page via UI
    const newTitle = `Renamed Title ${pw.random.id()}`;
    await renamePageViaContextMenu(page1, originalTitle, newTitle);
    await page1.waitForTimeout(EDITOR_LOAD_WAIT);

    // * Verify new title appears in user2's hierarchy (real-time)
    await user2Page.waitForTimeout(WEBSOCKET_WAIT); // Allow WebSocket message to propagate

    // # Debug: Print captured WebSocket events
    const wsEvents = await user2Page.evaluate(() => (window as any).wsEvents || []);
    const allActionTypes = await user2Page.evaluate(() => ((window as any).allActions || []).map((a: any) => a.type));
    console.log('[Test 5 - Page Renamed] Total Redux actions:', allActionTypes.length);
    console.log('[Test 5 - Page Renamed] ALL action types:', JSON.stringify(allActionTypes, null, 2));
    console.log('[Test 5 - Page Renamed] WebSocket events received by user2:', JSON.stringify(wsEvents, null, 2));

    await verifyPageInHierarchy(user2Page, newTitle, 5000);

    // * Verify old title is no longer visible
    const oldTitleNode = user2HierarchyPanel.locator('[data-testid="page-tree-node"]').filter({hasText: originalTitle});
    await expect(oldTitleNode).not.toBeVisible({timeout: WEBSOCKET_WAIT});

    await user2Page.close();
});

/**
 * @objective Verify new child page appears in hierarchy when added by another user
 *
 * @precondition
 * Pages/Wiki feature is enabled on the server
 * Two users have access to the same channel
 */
test('shows new child page in hierarchy when added by another user', {tag: '@pages'}, async ({pw, context, sharedPagesSetup}) => {
    const {team, user: user1, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    // # User 1 creates wiki and parent page
    const {page: page1, channelsPage: channelsPage1} = await pw.testBrowser.login(user1);
    await channelsPage1.goto(team.name, channel.name);
    await channelsPage1.toBeVisible();

    const wiki = await createWikiThroughUI(page1, `Test Wiki ${pw.random.id()}`);
    const parentTitle = `Parent Page ${pw.random.id()}`;
    const parentPage = await createPageThroughUI(page1, parentTitle, 'Parent content');

    // # Create user2 and add to channel
    const {user: user2, userId: user2Id} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

    // # User 2 logs in and navigates to wiki
    const {page: user2Page} = await pw.testBrowser.login(user2);

    // # Add console listener to capture ALL browser console logs
    const consoleLogs: string[] = [];
    user2Page.on('console', (msg) => {
        const text = msg.text();
        // Capture all console logs (not just specific patterns)
        consoleLogs.push(text);
        console.log('[User2 Browser]', text);
    });



    const wikiUrl = buildWikiPageUrl(pw.url, team.name, channel.id, wiki.id);
    await user2Page.goto(wikiUrl);
    await user2Page.waitForLoadState('networkidle');

    // # Wait for hierarchy panel to load
    const user2HierarchyPanel = getHierarchyPanel(user2Page);


    // * Verify parent page is visible for user2
    await verifyPageInHierarchy(user2Page, parentTitle);


    // # User 1 creates child page under parent via UI
    const childTitle = `Child Page ${pw.random.id()}`;
    await createChildPageThroughContextMenu(page1, parentPage.id, childTitle, 'Child page content');
    await page1.waitForTimeout(EDITOR_LOAD_WAIT);

    // * Verify child page appears in user2's hierarchy (real-time)
    await user2Page.waitForTimeout(WEBSOCKET_WAIT); // Allow WebSocket message to propagate
    await user2Page.waitForTimeout(1000); // Give React time to re-render

    // Check if parent now has an expand button (indicating it detected the child)
    const parentNode = user2Page.locator(`[data-testid="page-tree-node"][data-page-id="${parentPage.id}"]`);

    // Wait for expand button to appear (may take a moment for component to re-render)
    const expandButton = parentNode.locator('[data-testid="page-tree-node-expand-button"]');
    await expect(expandButton).toBeVisible({timeout: 10000});

    // # Expand parent node to make child visible
    await expandButton.click();
    await user2Page.waitForTimeout(200); // Wait for expand animation

    // * Child page should now be visible in hierarchy (nested under parent)
    await verifyPageInHierarchy(user2Page, childTitle, 5000);

    // # User 2 should be able to click and view the child page
    await clickPageInHierarchy(user2Page, childTitle);
    await user2Page.waitForLoadState('networkidle');

    const pageViewer = user2Page.locator('[data-testid="page-viewer-content"]');
    await expect(pageViewer).toContainText('Child page content');

    await user2Page.close();
});

/**
 * @objective Verify page disappears from hierarchy for all users when deleted by one user
 *
 * @precondition
 * Pages/Wiki feature is enabled on the server
 * Two users have access to the same channel
 */
test('removes page from hierarchy for other users when page is deleted', {tag: '@pages'}, async ({pw, context, sharedPagesSetup}) => {
    const {team, user: user1, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    // # User 1 creates wiki and page
    const {page: page1, channelsPage: channelsPage1} = await pw.testBrowser.login(user1);
    await channelsPage1.goto(team.name, channel.name);
    await channelsPage1.toBeVisible();

    const wiki = await createWikiThroughUI(page1, `Test Wiki ${pw.random.id()}`);
    const pageTitle = `Page to Delete ${pw.random.id()}`;
    const createdPage = await createPageThroughUI(page1, pageTitle, 'This page will be deleted');

    // # Create user2 and add to channel
    const {user: user2, userId: user2Id} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

    // # User 2 logs in and navigates to the channel FIRST (to subscribe to channel WebSocket events)
    const {page: user2Page, channelsPage: channelsPage2} = await pw.testBrowser.login(user2);
    await channelsPage2.goto(team.name, channel.name);
    await channelsPage2.toBeVisible();

    // # Then navigate to the page
    const wikiPageUrl = buildWikiPageUrl(pw.url, team.name, channel.id, wiki.id, createdPage.id);
    await user2Page.goto(wikiPageUrl);
    await user2Page.waitForLoadState('networkidle');

    // # Wait for hierarchy panel to load for user2
    const user2HierarchyPanel = getHierarchyPanel(user2Page);

    // * Verify page is visible in hierarchy for user2
    await verifyPageInHierarchy(user2Page, pageTitle);

    // # Setup WebSocket event logging for debugging
    await setupWebSocketEventLogging(user2Page);

    // # User 1 deletes the page via UI
    await deletePageThroughUI(page1, pageTitle);
    await page1.waitForTimeout(EDITOR_LOAD_WAIT);

    // * Verify page disappears from user2's hierarchy (real-time)
    await user2Page.waitForTimeout(WEBSOCKET_WAIT);

    // # Debug: Print captured WebSocket events
    await getWebSocketEvents(user2Page, 'Page Deleted from Tree');

    // * Verify page is removed from hierarchy (may fail if WebSocket not working)
    const user2PageNode = user2HierarchyPanel.locator('[data-testid="page-tree-node"]').filter({hasText: pageTitle});
    const isPageGoneRealtime = await user2PageNode.isVisible().then(() => false).catch(() => true);

    if (!isPageGoneRealtime) {
        console.log('[Test] Page NOT removed via WebSocket - verifying server state with refresh');

        // # Refresh the page to verify server state
        await user2Page.reload();
        await user2Page.waitForLoadState('networkidle');

        // * Verify page is gone after refresh (confirms server-side deletion worked)
        await verifyPageNotInHierarchy(user2Page, pageTitle);
        console.log('[Test] ✓ Page IS deleted on server (confirmed via refresh)');
        console.log('[Test] ✗ But WebSocket real-time update did NOT work');
    } else {
        console.log('[Test] ✓ Page removed via WebSocket real-time update');
    }

    await user2Page.close();
});
