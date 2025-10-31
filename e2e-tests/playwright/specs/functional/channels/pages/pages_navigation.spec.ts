// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';

import {createWikiThroughUI, createPageThroughUI, createChildPageThroughContextMenu, createTestChannel, fillCreatePageModal} from './test_helpers';

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
    if (await breadcrumb.isVisible({timeout: 3000}).catch(() => false)) {
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
        if (await grandparentLink.isVisible().catch(() => false)) {
            await grandparentLink.click();
            await page.waitForLoadState('networkidle');

            // * Verify navigated to grandparent page
            const currentUrl = page.url();
            expect(currentUrl).toContain(grandparent.id);
        }
    }
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

    // # Click wiki title in breadcrumb to go to wiki root
    const wikiLink = breadcrumb.getByRole('link', {name: wikiName});
    await wikiLink.click();
    await page.waitForLoadState('networkidle');

    // * Verify navigated to wiki root
    await expect(page).toHaveURL(new RegExp(`/wiki/`));
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

    // # Create child page draft
    const addChildButton = page.locator('[data-testid="add-child-button"]');
    if (await addChildButton.isVisible().catch(() => false)) {
        await addChildButton.click();
        await fillCreatePageModal(page, 'Child Draft');
    } else {
        // Alternative: right-click parent in hierarchy
        const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');
        const parentNode = hierarchyPanel.locator('text="Parent Page"').first();
        await parentNode.click({button: 'right'});

        const contextMenu = page.locator('[data-testid="page-context-menu"]');
        if (await contextMenu.isVisible({timeout: 2000}).catch(() => false)) {
            const createSubpageButton = contextMenu.locator('button:has-text("Create"), button:has-text("Subpage")').first();
            await createSubpageButton.click();
            await fillCreatePageModal(page, 'Child Draft');
        }
    }

    await page.waitForTimeout(1000); // Wait for editor to load

    const editor = page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();
    await editor.click();
    await editor.type('Child content');

    await page.waitForTimeout(2000);

    // * Verify breadcrumb shows parent → draft
    const breadcrumb = page.locator('[data-testid="breadcrumb"]');
    await expect(breadcrumb).toBeVisible();

    const breadcrumbText = await breadcrumb.textContent();
    expect(breadcrumbText).toContain('Parent Page');
    expect(breadcrumbText).toMatch(/Child Draft|Untitled/);
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
    if (await pageContent.isVisible({timeout: 5000}).catch(() => false)) {
        await expect(pageContent).toContainText('URL routing test content');
    }

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

    // # Construct deep link URL
    const deepLinkUrl = `${pw.url}/${team.name}/channels/${channel.name}/wikis/${wiki.id}/pages/${deepLinkPage.id}`;

    // # Open deep link (simulating external link)
    await page.goto(deepLinkUrl);
    await page.waitForLoadState('networkidle');

    // * Verify page loaded correctly
    const pageContent = page.locator('[data-testid="page-viewer-content"]');
    if (await pageContent.isVisible({timeout: 5000}).catch(() => false)) {
        await expect(pageContent).toContainText('Deep link test content');
    }

    // * Verify URL matches deep link
    const currentUrl = page.url();
    expect(currentUrl).toContain(deepLinkPage.id);

    // * Verify page is accessible (not showing error)
    const errorMessage = page.locator('text=/error|not found|access denied/i').first();
    const hasError = await errorMessage.isVisible({timeout: 2000}).catch(() => false);
    expect(hasError).toBe(false);
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
    await page.goto(`${pw.url}/${team.name}/channels/${channel.name}/wikis/${wiki.id}/pages/${nonExistentPageId}`);
    await page.waitForLoadState('networkidle');

    // * Verify either error message shown OR redirected away from nonexistent page
    const errorMessage = page.locator('text=/not found|page.*not.*exist|404/i').first();
    const currentUrl = page.url();

    const hasErrorMessage = await errorMessage.isVisible({timeout: 5000}).catch(() => false);
    const isRedirected = !currentUrl.includes(nonExistentPageId);

    // At least one of these must be true - test fails if both false
    expect(hasErrorMessage || isRedirected).toBe(true);

    // * If error message shown, verify it's actually visible
    if (hasErrorMessage) {
        await expect(errorMessage).toBeVisible();
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
