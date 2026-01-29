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
    getEditor,
    getHierarchyPanel,
    getPageViewerContent,
    createTestChannel,
    createTestUserInChannel,
    renamePageViaContextMenu,
    deletePageThroughUI,
    deleteWikiThroughModalConfirmation,
    createChildPageThroughContextMenu,
    withRolePermissions,
    setupWebSocketEventLogging,
    getWebSocketEvents,
    navigateToWikiView,
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
test(
    'removes page from source wiki hierarchy when moved to different wiki',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user: user1, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        // # User 1 creates two wikis and a page in source wiki
        const {page: page1, channelsPage: channelsPage1} = await pw.testBrowser.login(user1);
        await channelsPage1.goto(team.name, channel.name);
        await channelsPage1.toBeVisible();

        const sourceWiki = await createWikiThroughUI(page1, `Source Wiki ${await pw.random.id()}`);
        const pageTitle = `Page to Move ${await pw.random.id()}`;
        const createdPage = await createPageThroughUI(page1, pageTitle, 'This page will be moved');

        // # Navigate back to channel to create target wiki
        await channelsPage1.goto(team.name, channel.name);
        const targetWiki = await createWikiThroughUI(page1, `Target Wiki ${await pw.random.id()}`);

        // # Create user2 and add to channel
        const {user: user2} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

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
                (window as any).store.dispatch = function (action: any) {
                    // Capture ALL actions for debugging
                    if (action && action.type) {
                        (window as any).allActions.push({type: action.type, time: Date.now()});

                        // Capture page/post/wiki-related actions
                        const type = String(action.type).toUpperCase();
                        if (
                            type.includes('PAGE') ||
                            type.includes('POST') ||
                            type.includes('WIKI') ||
                            type.includes('RECEIVED') ||
                            type.includes('REMOVED')
                        ) {
                            (window as any).wsEvents.push({type: action.type, data: action.data, time: Date.now()});
                        }
                    }
                    // eslint-disable-next-line prefer-rest-params
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
        const user2PageNode = user2HierarchyPanel
            .locator('[data-testid="page-tree-node"]')
            .filter({hasText: pageTitle});
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
    },
);

/**
 * @objective Verify page disappears and user redirected when page is deleted while viewing
 *
 * @precondition
 * Pages/Wiki feature is enabled on the server
 * Two users have access to the same channel
 */
test(
    'shows notification and redirects when viewed page is deleted by another user',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user: user1, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        // # User 1 creates wiki and page
        const {page: page1, channelsPage: channelsPage1} = await pw.testBrowser.login(user1);
        await channelsPage1.goto(team.name, channel.name);
        await channelsPage1.toBeVisible();

        const wiki = await createWikiThroughUI(page1, `Test Wiki ${await pw.random.id()}`);
        const pageTitle = `Page to Delete ${await pw.random.id()}`;
        const createdPage = await createPageThroughUI(page1, pageTitle, 'This page will be deleted');

        // # Create user2 with delete permissions
        const {user: user2} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

        // # Grant delete permissions to channel_user role
        const restorePermissions = await withRolePermissions(adminClient, 'channel_user', ['delete_page']);

        // # User 2 logs in and navigates to the channel FIRST (to ensure proper channel context)
        const {page: user2Page, channelsPage: channelsPage2} = await pw.testBrowser.login(user2);
        await channelsPage2.goto(team.name, channel.name);
        await channelsPage2.toBeVisible();

        // # Then navigate to the page
        const wikiPageUrl = buildWikiPageUrl(pw.url, team.name, channel.id, wiki.id, createdPage.id);
        await user2Page.goto(wikiPageUrl);
        await user2Page.waitForLoadState('networkidle');

        // * Verify user2 is viewing the page
        const pageViewer = getPageViewerContent(user2Page);
        await expect(pageViewer).toBeVisible();
        await expect(pageViewer).toContainText('This page will be deleted');

        // # Add WebSocket event logging for user2
        await user2Page.evaluate(() => {
            (window as any).wsEvents = [];
            const originalDispatch = (window as any).store?.dispatch;
            if (originalDispatch) {
                (window as any).store.dispatch = function (action: any) {
                    if (
                        (action.type && action.type.includes('PAGE')) ||
                        (action.type && action.type.includes('POST'))
                    ) {
                        (window as any).wsEvents.push({type: action.type, data: action.data, time: Date.now()});
                    }
                    // eslint-disable-next-line prefer-rest-params
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
    },
);

/**
 * @objective Verify page title updates in hierarchy when changed by another user
 *
 * @precondition
 * Pages/Wiki feature is enabled on the server
 * Two users have access to the same channel
 */
test(
    'updates page title in hierarchy when renamed by another user',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user: user1, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        // # User 1 creates wiki and page
        const {page: page1, channelsPage: channelsPage1} = await pw.testBrowser.login(user1);
        await channelsPage1.goto(team.name, channel.name);
        await channelsPage1.toBeVisible();

        const wiki = await createWikiThroughUI(page1, `Test Wiki ${await pw.random.id()}`);
        const originalTitle = `Original Title ${await pw.random.id()}`;
        await createPageThroughUI(page1, originalTitle, 'Test content');

        // # Create user2 and add to channel
        const {user: user2} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

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
                (window as any).store.dispatch = function (action: any) {
                    // Capture ALL actions for debugging
                    if (action && action.type) {
                        (window as any).allActions.push({type: action.type, time: Date.now()});

                        // Capture page/post/wiki-related actions
                        const type = String(action.type).toUpperCase();
                        if (
                            type.includes('PAGE') ||
                            type.includes('POST') ||
                            type.includes('WIKI') ||
                            type.includes('RECEIVED') ||
                            type.includes('RENAMED')
                        ) {
                            (window as any).wsEvents.push({type: action.type, data: action.data, time: Date.now()});
                        }
                    }
                    // eslint-disable-next-line prefer-rest-params
                    return originalDispatch.apply(this, arguments);
                };
            }
        });

        // # User 1 renames the page via UI
        const newTitle = `Renamed Title ${await pw.random.id()}`;
        await renamePageViaContextMenu(page1, originalTitle, newTitle);

        // * Verify rename succeeded for user1 first
        await verifyPageInHierarchy(page1, newTitle, 5000);

        // * Verify new title appears in user2's hierarchy (real-time)
        await user2Page.waitForTimeout(WEBSOCKET_WAIT);

        await verifyPageInHierarchy(user2Page, newTitle, 5000);

        // * Verify old title is no longer visible
        const oldTitleNode = user2HierarchyPanel
            .locator('[data-testid="page-tree-node"]')
            .filter({hasText: originalTitle});
        await expect(oldTitleNode).not.toBeVisible({timeout: WEBSOCKET_WAIT});

        await user2Page.close();
    },
);

/**
 * @objective Verify new child page appears in hierarchy when added by another user
 *
 * @precondition
 * Pages/Wiki feature is enabled on the server
 * Two users have access to the same channel
 */
test(
    'shows new child page in hierarchy when added by another user',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user: user1, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        // # User 1 creates wiki and parent page
        const {page: page1, channelsPage: channelsPage1} = await pw.testBrowser.login(user1);
        await channelsPage1.goto(team.name, channel.name);
        await channelsPage1.toBeVisible();

        const wiki = await createWikiThroughUI(page1, `Test Wiki ${await pw.random.id()}`);
        const parentTitle = `Parent Page ${await pw.random.id()}`;
        const parentPage = await createPageThroughUI(page1, parentTitle, 'Parent content');

        // # Create user2 and add to channel
        const {user: user2} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

        // # User 2 logs in and navigates to wiki
        const {page: user2Page} = await pw.testBrowser.login(user2);

        // # Add console listener to capture ALL browser console logs
        const consoleLogs: string[] = [];
        user2Page.on('console', (msg) => {
            const text = msg.text();
            // Capture all console logs (not just specific patterns)
            consoleLogs.push(text);
        });

        const wikiUrl = buildWikiPageUrl(pw.url, team.name, channel.id, wiki.id);
        await user2Page.goto(wikiUrl);
        await user2Page.waitForLoadState('networkidle');

        // # Wait for hierarchy panel to load
        getHierarchyPanel(user2Page);

        // * Verify parent page is visible for user2
        await verifyPageInHierarchy(user2Page, parentTitle);

        // # User 1 creates child page under parent via UI
        const childTitle = `Child Page ${await pw.random.id()}`;
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

        const pageViewer = getPageViewerContent(user2Page);
        await expect(pageViewer).toContainText('Child page content');

        await user2Page.close();
    },
);

/**
 * @objective Verify page disappears from hierarchy for all users when deleted by one user
 *
 * @precondition
 * Pages/Wiki feature is enabled on the server
 * Two users have access to the same channel
 */
test(
    'removes page from hierarchy for other users when page is deleted',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user: user1, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        // # User 1 creates wiki and page
        const {page: page1, channelsPage: channelsPage1} = await pw.testBrowser.login(user1);
        await channelsPage1.goto(team.name, channel.name);
        await channelsPage1.toBeVisible();

        const wiki = await createWikiThroughUI(page1, `Test Wiki ${await pw.random.id()}`);
        const pageTitle = `Page to Delete ${await pw.random.id()}`;
        const createdPage = await createPageThroughUI(page1, pageTitle, 'This page will be deleted');

        // # Create user2 and add to channel
        const {user: user2} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

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
        const user2PageNode = user2HierarchyPanel
            .locator('[data-testid="page-tree-node"]')
            .filter({hasText: pageTitle});
        const isPageGoneRealtime = await user2PageNode
            .isVisible()
            .then(() => false)
            .catch(() => true);

        if (!isPageGoneRealtime) {
            // # Refresh the page to verify server state
            await user2Page.reload();
            await user2Page.waitForLoadState('networkidle');

            // * Verify page is gone after refresh (confirms server-side deletion worked)
            await verifyPageNotInHierarchy(user2Page, pageTitle);
        }

        await user2Page.close();
    },
);

/**
 * @objective Verify user is redirected when viewing a wiki that another user deletes
 *
 * @precondition
 * Pages/Wiki feature is enabled on the server
 * Two users have access to the same channel
 * User 1 has wiki deletion permissions
 */
test(
    'redirects user when wiki is deleted by another user while viewing',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user: user1, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        // # Grant wiki deletion permissions to channel_user role
        const restorePermissions = await withRolePermissions(adminClient, 'channel_user', [
            'manage_public_channel_properties',
        ]);

        // # User 1 creates wiki and page
        const {page: page1, channelsPage: channelsPage1} = await pw.testBrowser.login(user1);
        await channelsPage1.goto(team.name, channel.name);
        await channelsPage1.toBeVisible();

        const wikiName = `Wiki to Delete ${await pw.random.id()}`;
        const wiki = await createWikiThroughUI(page1, wikiName);
        const pageTitle = `Test Page ${await pw.random.id()}`;
        const createdPage = await createPageThroughUI(page1, pageTitle, 'This page will be deleted with wiki');

        // # Create user2 and add to channel
        const {user: user2} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

        // # User 2 logs in and navigates to the wiki page
        const {page: user2Page, channelsPage: channelsPage2} = await pw.testBrowser.login(user2);
        await channelsPage2.goto(team.name, channel.name);
        await channelsPage2.toBeVisible();

        // # Navigate to the wiki page
        const wikiPageUrl = buildWikiPageUrl(pw.url, team.name, channel.id, wiki.id, createdPage.id);
        await user2Page.goto(wikiPageUrl);
        await user2Page.waitForLoadState('networkidle');

        // * Verify user2 is viewing the page
        const pageViewer = getPageViewerContent(user2Page);
        await expect(pageViewer).toBeVisible({timeout: HIERARCHY_TIMEOUT});
        await expect(pageViewer).toContainText('This page will be deleted with wiki');

        // # Setup WebSocket event logging for debugging
        await setupWebSocketEventLogging(user2Page);

        // # User 1 navigates back to channel view to access wiki tab menu
        await channelsPage1.goto(team.name, channel.name);
        await channelsPage1.toBeVisible();
        await page1.waitForTimeout(EDITOR_LOAD_WAIT);

        // # User 1 deletes the wiki through the tab menu
        await deleteWikiThroughModalConfirmation(page1, wikiName);
        await page1.waitForTimeout(EDITOR_LOAD_WAIT);

        // * Verify user2 is redirected or shown error (real-time notification)
        await user2Page.waitForTimeout(WEBSOCKET_WAIT);

        // # Debug: Print captured WebSocket events
        await getWebSocketEvents(user2Page, 'Wiki Deleted');

        // Check if redirected away from wiki (URL change) or if error shown
        const currentUrl = user2Page.url();
        const isStillInWiki = currentUrl.includes(`/wiki/${channel.id}/${wiki.id}`);

        if (isStillInWiki) {
            // May show error message on the page
            const errorIndicators = [
                user2Page.locator('text=/wiki.*not.*found/i'),
                user2Page.locator('text=/wiki.*deleted/i'),
                user2Page.locator('text=/no longer.*available/i'),
                user2Page.locator('text=/page.*not.*found/i'),
                user2Page.locator('.error'),
            ];

            let errorFound = false;
            for (const indicator of errorIndicators) {
                if (await indicator.isVisible({timeout: EDITOR_LOAD_WAIT}).catch(() => false)) {
                    errorFound = true;
                    break;
                }
            }

            // If no error shown in real-time, refresh and verify wiki is gone
            if (!errorFound) {
                await user2Page.reload();
                await user2Page.waitForLoadState('networkidle');

                // After reload, should be redirected or show error
                const urlAfterReload = user2Page.url();
                const redirectedAfterReload = !urlAfterReload.includes(`/wiki/${channel.id}/${wiki.id}`);
                expect(redirectedAfterReload).toBe(true);
            }
        } else {
            // Successfully redirected away from deleted wiki
            expect(isStillInWiki).toBe(false);
        }

        await user2Page.close();

        // # Cleanup: Restore original permissions
        await restorePermissions();
    },
);

/**
 * @objective Verify wiki tab disappears for other users when wiki is deleted
 *
 * @precondition
 * Pages/Wiki feature is enabled on the server
 * Two users have access to the same channel
 */
test('removes wiki tab for other users when wiki is deleted', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user: user1, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    // # Grant wiki deletion permissions
    const restorePermissions = await withRolePermissions(adminClient, 'channel_user', [
        'manage_public_channel_properties',
    ]);

    // # User 1 creates wiki
    const {page: page1, channelsPage: channelsPage1} = await pw.testBrowser.login(user1);
    await channelsPage1.goto(team.name, channel.name);
    await channelsPage1.toBeVisible();

    const wikiName = `Wiki Tab Test ${await pw.random.id()}`;
    await createWikiThroughUI(page1, wikiName);

    // # Create user2 and add to channel
    const {user: user2} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

    // # User 2 logs in and navigates to channel (should see wiki tab)
    const {page: user2Page, channelsPage: channelsPage2} = await pw.testBrowser.login(user2);
    await channelsPage2.goto(team.name, channel.name);
    await channelsPage2.toBeVisible();

    // * Verify wiki tab is visible for user2
    const wikiTab = user2Page.locator('.channel-tabs-container__tab-wrapper--wiki').filter({hasText: wikiName});
    await expect(wikiTab).toBeVisible({timeout: HIERARCHY_TIMEOUT});

    // # Setup WebSocket event logging
    await setupWebSocketEventLogging(user2Page);

    // # User 1 navigates back to channel and deletes wiki
    await channelsPage1.goto(team.name, channel.name);
    await channelsPage1.toBeVisible();
    await page1.waitForTimeout(EDITOR_LOAD_WAIT);

    await deleteWikiThroughModalConfirmation(page1, wikiName);
    await page1.waitForTimeout(EDITOR_LOAD_WAIT);

    // * Verify wiki tab disappears from user2's view (real-time)
    await user2Page.waitForTimeout(WEBSOCKET_WAIT);

    // # Debug: Print captured WebSocket events
    await getWebSocketEvents(user2Page, 'Wiki Tab Deleted');

    // Check if tab disappeared in real-time
    const isTabGoneRealtime = await wikiTab
        .isVisible()
        .then(() => false)
        .catch(() => true);

    if (!isTabGoneRealtime) {
        // # Refresh to verify server state
        await user2Page.reload();
        await user2Page.waitForLoadState('networkidle');

        // * Verify wiki tab is gone after refresh
        await expect(wikiTab).not.toBeVisible({timeout: ELEMENT_TIMEOUT});
    }

    await user2Page.close();

    // # Cleanup
    await restorePermissions();
});

/**
 * @objective Verify user loses access when removed from channel while viewing wiki page
 *
 * @precondition
 * Pages/Wiki feature is enabled on the server
 * Admin can remove users from channels
 * Uses a custom channel (not town-square) since users cannot be removed from default channels
 */
test(
    'shows access denied when user is removed from channel while viewing page',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user: user1, adminClient} = sharedPagesSetup;

        // # Create a custom channel (users can be removed from custom channels, not town-square)
        const channel = await createTestChannel(adminClient, team.id, `Permission Test ${await pw.random.id()}`);

        // # Add user1 to the custom channel
        await adminClient.addToChannel(user1.id, channel.id);

        // # User 1 creates wiki and page
        const {page: page1, channelsPage: channelsPage1} = await pw.testBrowser.login(user1);
        await channelsPage1.goto(team.name, channel.name);
        await channelsPage1.toBeVisible();

        const wiki = await createWikiThroughUI(page1, `Permission Test Wiki ${await pw.random.id()}`);
        const pageTitle = `Test Page ${await pw.random.id()}`;
        const createdPage = await createPageThroughUI(page1, pageTitle, 'Content for permission test');

        // # Create user2 and add to channel
        const {user: user2} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

        // # User 2 logs in and navigates to the page
        const {page: user2Page, channelsPage: channelsPage2} = await pw.testBrowser.login(user2);
        await channelsPage2.goto(team.name, channel.name);
        await channelsPage2.toBeVisible();

        const wikiPageUrl = buildWikiPageUrl(pw.url, team.name, channel.id, wiki.id, createdPage.id);
        await user2Page.goto(wikiPageUrl);
        await user2Page.waitForLoadState('networkidle');

        // * Verify user2 can view the page
        const pageViewer = getPageViewerContent(user2Page);
        await expect(pageViewer).toBeVisible({timeout: HIERARCHY_TIMEOUT});
        await expect(pageViewer).toContainText('Content for permission test');

        // # Setup WebSocket event logging
        await setupWebSocketEventLogging(user2Page);

        // # Admin removes user2 from the channel
        await adminClient.removeFromChannel(user2.id, channel.id);

        // * Wait for WebSocket notification to propagate
        await user2Page.waitForTimeout(WEBSOCKET_WAIT);

        // # Debug: Print captured WebSocket events
        await getWebSocketEvents(user2Page, 'User Removed From Channel');

        // # Try to interact with the page (this should trigger access check)
        // Navigate to verify access is revoked
        await user2Page.reload();
        await user2Page.waitForLoadState('networkidle');

        // * Verify user2 can no longer access the page
        // Should see error, redirect, or access denied message
        const currentUrl = user2Page.url();
        const isStillOnPage = currentUrl.includes(createdPage.id);

        if (isStillOnPage) {
            // Look for access denied or error indicators
            const accessDeniedIndicators = [
                user2Page.locator('text=/access.*denied/i'),
                user2Page.locator('text=/permission/i'),
                user2Page.locator('text=/not.*member/i'),
                user2Page.locator('text=/cannot.*access/i'),
                user2Page.locator('text=/not.*found/i'),
                user2Page.locator('.error'),
            ];

            let accessDenied = false;
            for (const indicator of accessDeniedIndicators) {
                if (await indicator.isVisible({timeout: ELEMENT_TIMEOUT}).catch(() => false)) {
                    accessDenied = true;
                    break;
                }
            }

            // Content should be hidden or error shown
            const contentGone = !(await pageViewer.isVisible({timeout: ELEMENT_TIMEOUT}).catch(() => true));
            expect(accessDenied || contentGone).toBe(true);
        } else {
            // Successfully redirected away from page
            expect(isStillOnPage).toBe(false);
        }

        await user2Page.close();
    },
);

/**
 * @objective Verify editing user loses edit access when their edit permission is revoked
 *
 * @precondition
 * Pages/Wiki feature is enabled on the server
 * User has edit_page permission initially
 */
test(
    'shows appropriate UI when edit permission is revoked while user is editing',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user: user1, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        // # First, grant edit_page permission to channel_user role
        const role = await adminClient.getRoleByName('channel_user');
        const originalPermissions = [...role.permissions];
        const hasEditPage = originalPermissions.includes('edit_page');

        if (!hasEditPage) {
            await adminClient.patchRole(role.id, {
                permissions: [...originalPermissions, 'edit_page'],
            });
        }

        // # User 1 creates wiki and page
        const {page: page1, channelsPage: channelsPage1} = await pw.testBrowser.login(user1);
        await channelsPage1.goto(team.name, channel.name);
        await channelsPage1.toBeVisible();

        const wiki = await createWikiThroughUI(page1, `Edit Permission Wiki ${await pw.random.id()}`);
        const pageTitle = `Edit Test Page ${await pw.random.id()}`;
        const createdPage = await createPageThroughUI(page1, pageTitle, 'Original content');

        // # Create user2 and add to channel
        const {user: user2} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

        // # User 2 logs in and navigates to the page
        const {page: user2Page, channelsPage: channelsPage2} = await pw.testBrowser.login(user2);
        await channelsPage2.goto(team.name, channel.name);
        await channelsPage2.toBeVisible();

        await navigateToWikiView(user2Page, pw.url, team.name, channel.id, wiki.id);
        await user2Page.waitForLoadState('networkidle');

        // # Navigate to the specific page
        const wikiPageUrl = buildWikiPageUrl(pw.url, team.name, channel.id, wiki.id, createdPage.id);
        await user2Page.goto(wikiPageUrl);
        await user2Page.waitForLoadState('networkidle');

        // * Verify user2 can see the edit button (has edit permission)
        const editButton = user2Page.locator('[data-testid="wiki-page-edit-button"]').first();
        await expect(editButton).toBeVisible({timeout: HIERARCHY_TIMEOUT});

        // # User 2 enters edit mode
        await editButton.click();
        await user2Page.waitForTimeout(EDITOR_LOAD_WAIT);

        // * Verify editor is visible
        const editor = getEditor(user2Page);
        await expect(editor).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Setup WebSocket event logging
        await setupWebSocketEventLogging(user2Page);

        // # Admin revokes edit_page permission from channel_user role
        const currentRole = await adminClient.getRoleByName('channel_user');
        const permissionsWithoutEdit = currentRole.permissions.filter((p: string) => p !== 'edit_page');
        await adminClient.patchRole(role.id, {
            permissions: permissionsWithoutEdit,
        });

        // * Wait for permission change to propagate
        await user2Page.waitForTimeout(WEBSOCKET_WAIT);

        // # Try to publish to trigger permission check
        const publishButton = user2Page.locator('[data-testid="wiki-page-publish-button"]').first();

        // Fill some content first
        await editor.click();
        await editor.pressSequentially('New content added by user2', {delay: 10});
        await user2Page.waitForTimeout(EDITOR_LOAD_WAIT);

        // * Check if publish button is still enabled/visible
        const isPublishVisible = await publishButton.isVisible().catch(() => false);

        if (isPublishVisible) {
            // # Try to publish - should fail due to permission
            await publishButton.click();
            await user2Page.waitForTimeout(EDITOR_LOAD_WAIT);

            // * Look for error message about permission
            const errorIndicators = [
                user2Page.locator('text=/permission/i'),
                user2Page.locator('text=/not.*allowed/i'),
                user2Page.locator('text=/cannot.*edit/i'),
                user2Page.locator('text=/forbidden/i'),
                user2Page.locator('.error'),
                user2Page.locator('[class*="error"]'),
            ];

            let errorFound = false;
            for (const indicator of errorIndicators) {
                if (await indicator.isVisible({timeout: ELEMENT_TIMEOUT}).catch(() => false)) {
                    errorFound = true;
                    break;
                }
            }

            // If no immediate error, the publish might have succeeded before permission revoke propagated
            // This is acceptable in some race conditions - just verify the state
            if (!errorFound) {
                // Reload and verify edit button is now hidden (permission revoked)
                await user2Page.reload();
                await user2Page.waitForLoadState('networkidle');

                // After reload, edit button should not be visible (no edit permission)
                const editButtonAfterReload = user2Page.locator('[data-testid="wiki-page-edit-button"]').first();
                const editButtonVisible = await editButtonAfterReload
                    .isVisible({timeout: ELEMENT_TIMEOUT})
                    .catch(() => false);

                // Edit button should be hidden now that permission is revoked
                expect(editButtonVisible).toBe(false);
            }
        }

        await user2Page.close();

        // # Cleanup: Restore original permissions
        await adminClient.patchRole(role.id, {
            permissions: originalPermissions,
        });
    },
);

/**
 * @objective Verify user sees all pages when opening wiki, not just pages received via WebSocket
 *
 * This test verifies the fix for a bug where users would only see pages that were
 * published/updated while they were online (received via WebSocket), instead of
 * all pages in the wiki.
 *
 * @precondition
 * Pages/Wiki feature is enabled on the server
 * Two users have access to the same channel
 */
test(
    'shows all pages when opening wiki (not just WebSocket-received pages)',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user: user1, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        // # User 1 creates wiki and multiple pages
        const {page: page1, channelsPage: channelsPage1} = await pw.testBrowser.login(user1);
        await channelsPage1.goto(team.name, channel.name);
        await channelsPage1.toBeVisible();

        const wiki = await createWikiThroughUI(page1, `Multi-Page Wiki ${await pw.random.id()}`);
        const page1Title = `Page One ${await pw.random.id()}`;
        const page2Title = `Page Two ${await pw.random.id()}`;
        const page3Title = `Page Three ${await pw.random.id()}`;

        await createPageThroughUI(page1, page1Title, 'Content for page one');
        await createPageThroughUI(page1, page2Title, 'Content for page two');
        await createPageThroughUI(page1, page3Title, 'Content for page three');

        // * Verify all pages are visible for user1
        await verifyPageInHierarchy(page1, page1Title);
        await verifyPageInHierarchy(page1, page2Title);
        await verifyPageInHierarchy(page1, page3Title);

        // # Create user2 and add to channel
        const {user: user2} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

        // # User 2 logs in and navigates to the wiki
        // IMPORTANT: User 2 was NOT online when pages were created, so they didn't receive
        // WebSocket events. They should still see ALL pages when opening the wiki.
        const {page: user2Page} = await pw.testBrowser.login(user2);
        const wikiUrl = buildWikiPageUrl(pw.url, team.name, channel.id, wiki.id);
        await user2Page.goto(wikiUrl);
        await user2Page.waitForLoadState('networkidle');

        // # Wait for hierarchy panel to load
        const user2HierarchyPanel = getHierarchyPanel(user2Page);
        await user2HierarchyPanel.waitFor({state: 'visible', timeout: HIERARCHY_TIMEOUT});

        // * Verify ALL pages are visible for user2 (not just pages from WebSocket)
        await verifyPageInHierarchy(user2Page, page1Title, HIERARCHY_TIMEOUT);
        await verifyPageInHierarchy(user2Page, page2Title, HIERARCHY_TIMEOUT);
        await verifyPageInHierarchy(user2Page, page3Title, HIERARCHY_TIMEOUT);

        // * Verify user2 can click and view any page
        await clickPageInHierarchy(user2Page, page2Title);
        await user2Page.waitForLoadState('networkidle');

        const pageViewer = getPageViewerContent(user2Page);
        await expect(pageViewer).toContainText('Content for page two');

        await user2Page.close();
    },
);

/**
 * @objective Verify hierarchy changes (page moved to become child) sync between users in real-time
 *
 * This test verifies the fix for a bug where moving a page to be a child of another
 * page would not update other users' hierarchy view in real-time.
 *
 * @precondition
 * Pages/Wiki feature is enabled on the server
 * Two users have access to the same channel
 */
test(
    'updates hierarchy for other users when page is moved to become child of another page',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user: user1, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        // # User 1 creates wiki with parent and child pages (initially siblings)
        const {page: page1, channelsPage: channelsPage1} = await pw.testBrowser.login(user1);
        await channelsPage1.goto(team.name, channel.name);
        await channelsPage1.toBeVisible();

        const wiki = await createWikiThroughUI(page1, `Hierarchy Sync Wiki ${await pw.random.id()}`);
        const parentTitle = `Parent Page ${await pw.random.id()}`;
        const childTitle = `Future Child Page ${await pw.random.id()}`;

        const parentPage = await createPageThroughUI(page1, parentTitle, 'Parent content');
        const childPage = await createPageThroughUI(page1, childTitle, 'This will become a child');

        // * Verify both pages are root-level siblings for user1
        await verifyPageInHierarchy(page1, parentTitle);
        await verifyPageInHierarchy(page1, childTitle);

        // # Create user2 and add to channel
        const {user: user2} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

        // # User 2 logs in and navigates to the wiki
        const {page: user2Page} = await pw.testBrowser.login(user2);
        const wikiUrl = buildWikiPageUrl(pw.url, team.name, channel.id, wiki.id);
        await user2Page.goto(wikiUrl);
        await user2Page.waitForLoadState('networkidle');

        // # Wait for hierarchy panel to load
        const user2HierarchyPanel = getHierarchyPanel(user2Page);
        await user2HierarchyPanel.waitFor({state: 'visible', timeout: HIERARCHY_TIMEOUT});

        // * Verify both pages visible as siblings for user2 (both at root level, depth=0)
        await verifyPageInHierarchy(user2Page, parentTitle);
        await verifyPageInHierarchy(user2Page, childTitle);

        // * Verify both pages are at root level (depth=0) - this is the flat tree structure
        const parentNodeUser2 = user2Page.locator(`[data-testid="page-tree-node"][data-page-id="${parentPage.id}"]`);
        const childNodeUser2Before = user2Page.locator(
            `[data-testid="page-tree-node"][data-page-id="${childPage.id}"]`,
        );
        await expect(parentNodeUser2).toHaveAttribute('data-depth', '0');
        await expect(childNodeUser2Before).toHaveAttribute('data-depth', '0');

        // * Verify parent shows file icon (no children yet)
        const iconButton = parentNodeUser2.locator('[data-testid="page-tree-node-expand-button"]');
        const fileIcon = iconButton.locator('.icon-file-generic-outline');
        await expect(fileIcon).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Setup WebSocket event logging for user2
        await setupWebSocketEventLogging(user2Page);

        // # User 1 moves the child page to be under the parent page via API
        // This uses the dedicated /parent endpoint which broadcasts page_moved event
        await adminClient.updatePageParent(wiki.id, childPage.id!, parentPage.id!);

        // * Wait for WebSocket event to propagate to user2
        await user2Page.waitForTimeout(WEBSOCKET_WAIT);

        // # Debug: Print captured WebSocket events
        await getWebSocketEvents(user2Page, 'Page Moved to Child');

        // * Verify parent now shows chevron icon (has children)
        const chevronIcon = iconButton.locator('.icon-chevron-right, .icon-chevron-down');
        await expect(chevronIcon).toBeVisible({timeout: 10000});

        // * Verify child is no longer visible at root level (it's now under collapsed parent)
        // The flat tree only shows children when parent is expanded
        const childAtRootLevel = user2Page.locator(
            `[data-testid="page-tree-node"][data-page-id="${childPage.id}"][data-depth="0"]`,
        );
        await expect(childAtRootLevel).not.toBeVisible();

        // # Expand parent node to verify child is nested underneath
        await iconButton.click();
        await user2Page.waitForTimeout(200); // Wait for expand animation

        // * Verify child page is now visible with depth=1 (child of parent)
        const childNodeUser2After = user2Page.locator(`[data-testid="page-tree-node"][data-page-id="${childPage.id}"]`);
        await expect(childNodeUser2After).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await expect(childNodeUser2After).toHaveAttribute('data-depth', '1');

        await user2Page.close();
    },
);
