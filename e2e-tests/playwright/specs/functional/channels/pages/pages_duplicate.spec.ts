// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';
import {
    createWikiThroughUI,
    createPageThroughUI,
    createChildPageThroughContextMenu,
    createTestChannel,
    ensurePanelOpen,
    getPageViewerContent,
    waitForPageInHierarchy,
    waitForDuplicatedPageInHierarchy,
    duplicatePageThroughUI,
    EDITOR_LOAD_WAIT,
    AUTOSAVE_WAIT,
} from './test_helpers';

/**
 * @objective Verify page duplication creates a copy with default "Copy of [title]" naming at same level
 */
test('duplicates page to same wiki with default title', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${await pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);

    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and original page through UI
    await createWikiThroughUI(page, `Duplicate Wiki ${await pw.random.id()}`);
    const originalPage = await createPageThroughUI(page, 'Original Page', 'Original content here');

    // # Wait for page to be fully committed to database
    await page.waitForTimeout(EDITOR_LOAD_WAIT);

    // # Ensure panel is open
    await ensurePanelOpen(page);

    // # Duplicate the page using context menu (immediate action, no modal)
    await duplicatePageThroughUI(page, originalPage.id);

    // * Verify duplicated page appears in hierarchy with "Copy of" prefix
    const duplicateNode = await waitForDuplicatedPageInHierarchy(page, 'Copy of Original Page');

    // # Click on duplicated page to view it
    await duplicateNode.click();
    await page.waitForLoadState('networkidle');

    // * Verify duplicated page content is the same as original
    const pageContent = getPageViewerContent(page);
    await expect(pageContent).toContainText('Original content here');
});

/**
 * @objective Verify page duplication places duplicate at same level as source (inherits parent)
 */
test('duplicates child page at same level as source', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${await pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and parent page
    await createWikiThroughUI(page, `Hierarchy Wiki ${await pw.random.id()}`);
    const parentPage = await createPageThroughUI(page, 'Parent Page', 'Parent content');

    // # Create a child page under the parent
    const childPage = await createChildPageThroughContextMenu(page, parentPage.id!, 'Child Page', 'Child content');

    // # Ensure hierarchy panel is open
    await ensurePanelOpen(page);

    // # Wait for child page to appear in hierarchy
    await waitForPageInHierarchy(page, 'Child Page', 15000);

    // # Duplicate the child page (immediate action)
    await duplicatePageThroughUI(page, childPage.id);

    // * Verify duplicated page appears as sibling under same parent
    const duplicateChild = await waitForDuplicatedPageInHierarchy(page, 'Copy of Child Page');

    // # Click on duplicated child page
    await duplicateChild.click();
    await page.waitForLoadState('networkidle');

    // * Verify content is copied
    const pageContent = getPageViewerContent(page);
    await expect(pageContent).toContainText('Child content');
});

/**
 * @objective Verify page content is duplicated correctly
 */
test('duplicates page content correctly', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${await pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page with content
    await createWikiThroughUI(page, `Content Wiki ${await pw.random.id()}`);
    const contentPage = await createPageThroughUI(
        page,
        'Content Page',
        'This is the original page content with some text.',
    );

    // # Wait for page to be fully committed to database
    await page.waitForTimeout(AUTOSAVE_WAIT);

    // # Ensure panel is open
    await ensurePanelOpen(page);

    // # Duplicate the page (immediate action)
    await duplicatePageThroughUI(page, contentPage.id);

    // # Wait for duplicated page to appear and click on it
    const duplicateNode = await waitForDuplicatedPageInHierarchy(page, 'Copy of Content Page');
    await duplicateNode.click();
    await page.waitForLoadState('networkidle');

    // * Verify content is duplicated
    const pageContent = getPageViewerContent(page);
    await expect(pageContent).toContainText('This is the original page content with some text.');
});

/**
 * @objective Verify page duplication maintains hierarchy structure by placing duplicates at same level
 */
test('duplicates root page at root level', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${await pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and root-level pages
    await createWikiThroughUI(page, `Root Level Wiki ${await pw.random.id()}`);
    const rootPage1 = await createPageThroughUI(page, 'Root Page 1', 'First root content');
    await createPageThroughUI(page, 'Root Page 2', 'Second root content');

    // # Ensure panel is open
    await ensurePanelOpen(page);

    // # Duplicate the first root page
    await duplicatePageThroughUI(page, rootPage1.id);

    // * Verify duplicated page appears at root level
    const duplicateNode = await waitForDuplicatedPageInHierarchy(page, 'Copy of Root Page 1');

    // # Click on duplicated page
    await duplicateNode.click();
    await page.waitForLoadState('networkidle');

    // * Verify content is copied
    const pageContent = getPageViewerContent(page);
    await expect(pageContent).toContainText('First root content');
});
