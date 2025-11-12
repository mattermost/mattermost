// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';

import {createWikiThroughUI, createPageThroughUI, createChildPageThroughContextMenu, createTestChannel, fillCreatePageModal, buildWikiPageUrl} from './test_helpers';

/**
 * @objective Verify breadcrumb navigation displays correct page hierarchy
 */
test('displays breadcrumb navigation for nested pages', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Breadcrumb Wiki ${pw.random.id()}`);

    // # Create page hierarchy: Grandparent -> Parent -> Child through UI
    const grandparent = await createPageThroughUI(page, 'Grandparent Page', 'Grandparent content');

    const parent = await createChildPageThroughContextMenu(page, grandparent.id!, 'Parent Page', 'Parent content');

    const child = await createChildPageThroughContextMenu(page, parent.id!, 'Child Page', 'Child content');

    // * Verify breadcrumb shows full hierarchy
    const breadcrumb = page.locator('[data-testid="breadcrumb"], .breadcrumb').first();
    await expect(breadcrumb).toBeVisible({timeout: 3000});
    const breadcrumbText = await breadcrumb.textContent();

    // * Verify all ancestors in correct order
    expect(breadcrumbText).toContain('Grandparent Page');
    expect(breadcrumbText).toContain('Parent Page');
    expect(breadcrumbText).toContain('Child Page');

    // * Verify order is correct (Grandparent before Parent before Child)
    const grandparentIndex = breadcrumbText!.indexOf('Grandparent Page');
    const parentIndex = breadcrumbText!.indexOf('Parent Page');
    const childIndex = breadcrumbText!.indexOf('Child Page');

    expect(grandparentIndex).toBeLessThan(parentIndex);
    expect(parentIndex).toBeLessThan(childIndex);

    // # Click grandparent in breadcrumb
    const grandparentLink = breadcrumb.locator('text="Grandparent Page"').first();
    await expect(grandparentLink).toBeVisible();
    await grandparentLink.click();
    await page.waitForLoadState('networkidle');

    // * Verify navigated to grandparent page
    const currentUrl = page.url();
    expect(currentUrl).toContain(grandparent.id);
});

/**
 * @objective Verify breadcrumb navigation displays correctly through full UI flow
 */
test('displays page breadcrumbs', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wikiName = `Breadcrumb Wiki ${pw.random.id()}`;
    await createWikiThroughUI(page, wikiName);

    // # Create parent and child pages through UI
    const parentPage = await createPageThroughUI(page, 'Parent Page', 'Parent content');
    await createChildPageThroughContextMenu(page, parentPage.id!, 'Child Page', 'Child content');

    // * Verify breadcrumb is visible
    const breadcrumb = page.locator('[data-testid="breadcrumb"]');
    await expect(breadcrumb).toBeVisible();

    // * Verify breadcrumb contains wiki title
    await expect(breadcrumb).toContainText(wikiName);

    // * Verify breadcrumb contains parent page
    await expect(breadcrumb).toContainText('Parent Page');

    // * Verify breadcrumb contains current page
    await expect(breadcrumb).toContainText('Child Page');
});

/**
 * @objective Verify clicking breadcrumb links navigates to correct pages through full UI flow
 */
test('navigates using breadcrumbs', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wikiName = `Nav Wiki ${pw.random.id()}`;
    const wiki = await createWikiThroughUI(page, wikiName);

    // # Create parent and child pages through UI
    const parentPage = await createPageThroughUI(page, 'Parent Page', 'Parent content');
    await createChildPageThroughContextMenu(page, parentPage.id!, 'Child Page', 'Child content');

    // # Click parent page link in breadcrumb
    const breadcrumb = page.locator('[data-testid="breadcrumb"]');
    const parentLink = breadcrumb.getByRole('link', {name: 'Parent Page'});
    await parentLink.click();
    await page.waitForLoadState('networkidle');

    // * Verify navigated to parent page
    const pageContent = page.locator('[data-testid="page-viewer-content"]');
    await expect(pageContent).toContainText('Parent content', {timeout: 15000});

    // * Verify wiki name is displayed in breadcrumb but not clickable
    const wikiNameElement = breadcrumb.locator('.PageBreadcrumb__wiki-name');
    await expect(wikiNameElement).toBeVisible();
    await expect(wikiNameElement).toContainText(wikiName);
});

/**
 * @objective Verify breadcrumb navigation shows correct path for draft
 */
test('displays breadcrumbs for draft of child page', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki and parent page through UI
    const wiki = await createWikiThroughUI(page, `Breadcrumb Wiki ${pw.random.id()}`);
    const parentPage = await createPageThroughUI(page, 'Parent Page', 'Parent content');

    // # Create child page draft via context menu
    const parentNode = page.locator(`[data-testid="page-tree-node"][data-page-id="${parentPage.id}"]`);
    const menuButton = parentNode.locator('[data-testid="page-tree-node-menu-button"]');
    await menuButton.click();

    const addChildButton = page.locator('[data-testid="page-context-menu-new-child"]').first();
    await addChildButton.click();

    await fillCreatePageModal(page, 'Child Draft');

    await page.waitForTimeout(1000); // Wait for editor to load

    const editor = page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();
    await editor.waitFor({state: 'visible', timeout: 5000});
    await editor.click();
    await editor.type('Child content');

    await page.waitForTimeout(2000);

    // * Verify breadcrumb shows parent → draft
    // Wait for draft to be fully saved and breadcrumb to update
    await expect(async () => {
        const breadcrumb = page.locator('[data-testid="breadcrumb"]');
        const breadcrumbText = await breadcrumb.textContent();
        expect(breadcrumbText).toContain('Parent Page');
        expect(breadcrumbText).toMatch(/Child Draft|Untitled/);
    }).toPass({timeout: 10000});
});

/**
 * @objective Verify URL routing correctly navigates to pages
 */
test('navigates to correct page via URL routing', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki and page through UI
    const wiki = await createWikiThroughUI(page, `URL Routing Wiki ${pw.random.id()}`);
    const testPage = await createPageThroughUI(page, 'URL Test Page', 'URL routing test content');

    // * Verify correct page is displayed
    const pageContent = page.locator('[data-testid="page-viewer-content"]');
    await expect(pageContent).toBeVisible({timeout: 5000});
    await expect(pageContent).toContainText('URL routing test content');

    // * Verify URL is correct
    const currentUrl = page.url();
    expect(currentUrl).toContain(wiki.id);
    expect(currentUrl).toContain(testPage.id);

    // * Verify page title is displayed
    const pageTitle = page.locator('[data-testid="page-viewer-title"]');
    await expect(pageTitle).toBeVisible();
    await expect(pageTitle).toContainText('URL Test Page');
});

/**
 * @objective Verify deep links to specific pages work correctly
 */
test('opens page from deep link shared externally', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki and page through UI
    const wiki = await createWikiThroughUI(page, `Deep Link Wiki ${pw.random.id()}`);
    const deepLinkPage = await createPageThroughUI(page, 'Deep Link Page', 'Deep link test content');

    // # Construct deep link URL using helper
    const deepLinkUrl = buildWikiPageUrl(pw.url, team.name, channel.id, wiki.id, deepLinkPage.id);

    // # Open deep link (simulating external link)
    await page.goto(deepLinkUrl);
    await page.waitForLoadState('networkidle');

    // * Verify page loaded correctly
    const pageContent = page.locator('[data-testid="page-viewer-content"]');
    await expect(pageContent).toBeVisible({timeout: 5000});
    await expect(pageContent).toContainText('Deep link test content');

    // * Verify URL matches deep link
    const currentUrl = page.url();
    expect(currentUrl).toContain(deepLinkPage.id);

    // * Verify page is accessible (not showing error)
    const errorMessage = page.locator('text=/error|not found|access denied/i').first();
    await expect(errorMessage).not.toBeVisible({timeout: 2000});
});

/**
 * @objective Verify browser back/forward navigation works correctly
 */
test('maintains page state with browser back and forward buttons', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki and 3 pages through UI
    const wiki = await createWikiThroughUI(page, `Navigation Wiki ${pw.random.id()}`);
    const page1 = await createPageThroughUI(page, 'First Page', 'First page content');
    const page2 = await createPageThroughUI(page, 'Second Page', 'Second page content');
    const page3 = await createPageThroughUI(page, 'Third Page', 'Third page content');

    // # Navigate to page1 using hierarchy panel
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');
    const page1Node = hierarchyPanel.locator('text="First Page"').first();
    await page1Node.click();
    await page.waitForLoadState('networkidle');

    // * Verify page1 content
    let pageContent = page.locator('[data-testid="page-viewer-content"]');
    await expect(pageContent).toBeVisible({timeout: 5000});
    await expect(pageContent).toContainText('First page content');

    // # Navigate to page2 using hierarchy panel
    const page2Node = hierarchyPanel.locator('text="Second Page"').first();
    await page2Node.click();
    await page.waitForLoadState('networkidle');

    // * Verify page2 content
    await expect(pageContent).toBeVisible();
    await expect(pageContent).toContainText('Second page content');

    // # Navigate to page3 using hierarchy panel
    const page3Node = hierarchyPanel.locator('text="Third Page"').first();
    await page3Node.click();
    await page.waitForLoadState('networkidle');

    // * Verify page3 content
    await expect(pageContent).toBeVisible();
    await expect(pageContent).toContainText('Third page content');

    // # Click browser back button
    await page.goBack();
    await page.waitForLoadState('networkidle');

    // * Verify back to page2
    let currentUrl = page.url();
    expect(currentUrl).toContain(page2.id);
    await expect(pageContent).toBeVisible();
    await expect(pageContent).toContainText('Second page content');

    // # Click browser back button again
    await page.goBack();
    await page.waitForLoadState('networkidle');

    // * Verify back to page1
    currentUrl = page.url();
    expect(currentUrl).toContain(page1.id);
    await expect(pageContent).toBeVisible();
    await expect(pageContent).toContainText('First page content');

    // # Click browser forward button
    await page.goForward();
    await page.waitForLoadState('networkidle');

    // * Verify forward to page2
    currentUrl = page.url();
    expect(currentUrl).toContain(page2.id);
    await expect(pageContent).toBeVisible();
    await expect(pageContent).toContainText('Second page content');
});

/**
 * @objective Verify 404 handling for non-existent pages
 */
test('displays 404 error for non-existent page', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `404 Test Wiki ${pw.random.id()}`);

    // # Navigate to non-existent page ID
    const nonExistentPageId = 'nonexistent123456789';
    await page.goto(buildWikiPageUrl(pw.url, team.name, channel.id, wiki.id, nonExistentPageId));
    await page.waitForLoadState('networkidle');

    // * Verify either error message shown OR redirected away from nonexistent page
    const errorMessage = page.locator('text=/not found|page.*not.*exist|404/i').first();
    const currentUrl = page.url();

    const isRedirected = !currentUrl.includes(nonExistentPageId);

    // If not redirected, we expect an error message.
    if (!isRedirected) {
        await expect(errorMessage).toBeVisible({timeout: 5000});
    }
});

/**
 * @objective Verify page refresh preserves current page state
 */
test('preserves page content after browser refresh', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Refresh Test Wiki ${pw.random.id()}`);

    // # Create page with simple content
    await createPageThroughUI(page, 'Refresh Test Page', 'Content that should persist after refresh');

    // * Verify page was created and is visible
    const pageContent = page.locator('[data-testid="page-viewer-content"]');
    await expect(pageContent).toBeVisible();
    await expect(pageContent).toContainText('Content that should persist after refresh');

    // # Get current URL before refresh
    const urlBeforeRefresh = page.url();

    // # Refresh page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // * Verify URL unchanged after refresh
    const urlAfterRefresh = page.url();
    expect(urlAfterRefresh).toBe(urlBeforeRefresh);

    // * Verify page content persists after refresh
    await expect(pageContent).toBeVisible({timeout: 10000});
    await expect(pageContent).toContainText('Content that should persist after refresh');

    // * Verify page title persists after refresh
    const pageTitle = page.locator('[data-testid="page-viewer-title"]').first();
    await expect(pageTitle).toBeVisible({timeout: 5000});
    await expect(pageTitle).toContainText('Refresh Test Page');
});

/**
 * @objective Verify fullscreen mode allows toggling and viewing comments
 */
test('toggles fullscreen mode and accesses comments', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Fullscreen Wiki ${pw.random.id()}`);

    // # Create page with content
    const testPage = await createPageThroughUI(page, 'Fullscreen Test Page', 'This is fullscreen test content');

    // * Verify page is visible
    const pageContent = page.locator('[data-testid="page-viewer-content"]');
    await expect(pageContent).toBeVisible({timeout: 5000});
    await expect(pageContent).toContainText('This is fullscreen test content');

    // * Verify hierarchy panel is visible initially
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');
    await expect(hierarchyPanel).toBeVisible({timeout: 3000});

    // # Click fullscreen button
    const fullscreenButton = page.locator('[data-testid="wiki-page-fullscreen-button"]');
    await expect(fullscreenButton).toBeVisible({timeout: 3000});
    await fullscreenButton.click();
    await page.waitForTimeout(500);

    // * Verify hierarchy panel is hidden in fullscreen
    await expect(hierarchyPanel).not.toBeVisible({timeout: 2000});

    // * Verify body has fullscreen-mode class
    const bodyClassList = await page.evaluate(() => document.body.className);
    expect(bodyClassList).toContain('fullscreen-mode');

    // * Verify page content is still visible
    await expect(pageContent).toBeVisible();
    await expect(pageContent).toContainText('This is fullscreen test content');

    // # Toggle comments in fullscreen mode
    const toggleCommentsButton = page.locator('[data-testid="wiki-page-toggle-comments"]');
    await expect(toggleCommentsButton).toBeVisible({timeout: 3000});
    await toggleCommentsButton.click();
    await page.waitForTimeout(500);

    // * Verify RHS (comments panel) is visible
    const rhs = page.locator('#sidebar-right, .sidebar-right').first();
    await expect(rhs).toBeVisible({timeout: 3000});

    // * Verify RHS is positioned correctly in fullscreen
    const rhsBox = await rhs.boundingBox();
    expect(rhsBox).not.toBeNull();
    if (rhsBox) {
        expect(rhsBox.x).toBeGreaterThan(0);
    }

    // # Exit fullscreen using button
    await fullscreenButton.click();
    await page.waitForTimeout(500);

    // * Verify hierarchy panel is visible again
    await expect(hierarchyPanel).toBeVisible({timeout: 3000});

    // * Verify body no longer has fullscreen-mode class
    const bodyClassListAfter = await page.evaluate(() => document.body.className);
    expect(bodyClassListAfter).not.toContain('fullscreen-mode');

    // # Test Escape key to exit fullscreen
    await fullscreenButton.click();
    await page.waitForTimeout(500);

    // * Verify in fullscreen mode
    const bodyClassListFullscreen = await page.evaluate(() => document.body.className);
    expect(bodyClassListFullscreen).toContain('fullscreen-mode');

    // # Press Escape key
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // * Verify exited fullscreen
    const bodyClassListEscaped = await page.evaluate(() => document.body.className);
    expect(bodyClassListEscaped).not.toContain('fullscreen-mode');
});
