// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createPageViaDraft, makeClient} from '@mattermost/playwright-lib';

import {expect, test} from './pages_test_fixture';
import {
    createWikiThroughUI,
    createTestChannel,
    createPageThroughUI,
    createChildPageThroughContextMenu,
    waitForPageInHierarchy,
    openMovePageModal,
    getHierarchyPanel,
    getPageViewerContent,
    clickPageInHierarchy,
    openWikiByTab,
    moveWikiToChannel,
    waitForWikiTab,
    verifyBreadcrumbContains,
    expandPageTreeNode,
    createPageContent,
    createRichPageContent,
    uniqueName,
    ELEMENT_TIMEOUT,
    HIERARCHY_TIMEOUT,
    SHORT_WAIT,
} from './test_helpers';

/**
 * @objective Verify page can be moved between wikis in the same channel
 *
 * @precondition
 * Channel must have two wikis
 */
test('moves page between wikis in same channel', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await page.waitForLoadState('networkidle');

    // # Create first wiki with a page
    const wiki1Name = uniqueName('Source Wiki');
    await createWikiThroughUI(page, wiki1Name);
    await createPageThroughUI(page, 'Page to Move', 'Content to be moved');

    // # Navigate back to channel and create second wiki
    await channelsPage.goto(team.name, channel.name);
    await page.waitForLoadState('networkidle');
    const wiki2Name = uniqueName('Target Wiki');
    const wiki2 = await createWikiThroughUI(page, wiki2Name);

    // # Navigate back to first wiki
    await channelsPage.goto(team.name, channel.name);
    await page.waitForLoadState('networkidle');
    await waitForWikiTab(page, wiki1Name);
    await openWikiByTab(page, wiki1Name);
    await waitForPageInHierarchy(page, 'Page to Move', HIERARCHY_TIMEOUT);

    // # Open move modal for the page
    const moveModal = await openMovePageModal(page, 'Page to Move');

    // # Select target wiki
    const wikiSelect = moveModal.locator('#target-wiki-select');
    await wikiSelect.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    await wikiSelect.selectOption(wiki2.id);

    // # Confirm move
    const confirmButton = moveModal.getByRole('button', {name: /Move|Confirm/i});
    await confirmButton.click();

    // # Wait for move to complete
    await expect(moveModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});
    await page.waitForLoadState('networkidle');

    // * Verify page is no longer in source wiki
    await channelsPage.goto(team.name, channel.name);
    await page.waitForLoadState('networkidle');
    await openWikiByTab(page, wiki1Name);
    await page.waitForTimeout(SHORT_WAIT);

    const hierarchyPanel = getHierarchyPanel(page);
    const sourcePageNode = hierarchyPanel.locator('[data-testid="page-tree-node"]').filter({hasText: 'Page to Move'});
    await expect(sourcePageNode).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify page is now in target wiki
    await channelsPage.goto(team.name, channel.name);
    await page.waitForLoadState('networkidle');
    await openWikiByTab(page, wiki2Name);
    await waitForPageInHierarchy(page, 'Page to Move', HIERARCHY_TIMEOUT);

    // * Click on page and verify content
    await clickPageInHierarchy(page, 'Page to Move');
    const pageContent = getPageViewerContent(page);
    await expect(pageContent).toContainText('Content to be moved', {timeout: ELEMENT_TIMEOUT});
});

/**
 * @objective Verify page with children can be moved between wikis (children follow)
 *
 * @precondition
 * Channel must have two wikis, source wiki has parent with children
 */
test('moves page with children between wikis', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await page.waitForLoadState('networkidle');

    // # Create first wiki with parent and children using API for reliability
    const wiki1Name = uniqueName('Source Wiki');
    const wiki1 = await createWikiThroughUI(page, wiki1Name);

    // # Create parent and child via API
    const {client} = await makeClient(user);
    const parentContent = createPageContent('Parent content');
    const parentPage = await createPageViaDraft(client, wiki1.id, 'Parent Page', parentContent);

    const childContent = createPageContent('Child content');
    await createPageViaDraft(client, wiki1.id, 'Child Page', childContent, parentPage.id);

    // # Navigate back to channel and create second wiki
    await channelsPage.goto(team.name, channel.name);
    await page.waitForLoadState('networkidle');
    const wiki2Name = uniqueName('Target Wiki');
    const wiki2 = await createWikiThroughUI(page, wiki2Name);

    // # Navigate back to first wiki
    await channelsPage.goto(team.name, channel.name);
    await page.waitForLoadState('networkidle');
    await waitForWikiTab(page, wiki1Name);
    await openWikiByTab(page, wiki1Name);
    await waitForPageInHierarchy(page, 'Parent Page', HIERARCHY_TIMEOUT);

    // # Open move modal for parent page
    const moveModal = await openMovePageModal(page, 'Parent Page');

    // # Select target wiki
    const wikiSelect = moveModal.locator('#target-wiki-select');
    await wikiSelect.selectOption(wiki2.id);

    // # Confirm move
    const confirmButton = moveModal.getByRole('button', {name: /Move|Confirm/i});
    await confirmButton.click();
    await expect(moveModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});
    await page.waitForLoadState('networkidle');

    // * Verify parent and child are in target wiki
    await channelsPage.goto(team.name, channel.name);
    await page.waitForLoadState('networkidle');
    await openWikiByTab(page, wiki2Name);
    await waitForPageInHierarchy(page, 'Parent Page', HIERARCHY_TIMEOUT);

    // # Expand parent to see child
    await expandPageTreeNode(page, 'Parent Page');
    await page.waitForTimeout(SHORT_WAIT);

    // * Verify child page is visible
    await waitForPageInHierarchy(page, 'Child Page', HIERARCHY_TIMEOUT);

    // * Click on child and verify content
    await clickPageInHierarchy(page, 'Child Page');
    const pageContent = getPageViewerContent(page);
    await expect(pageContent).toContainText('Child content', {timeout: ELEMENT_TIMEOUT});
});

/**
 * @objective Verify page can be duplicated to another wiki in same channel
 *
 * @precondition
 * Channel must have two wikis
 */
test('duplicates page to another wiki via API', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await page.waitForLoadState('networkidle');

    // # Create first wiki with a page
    const wiki1Name = uniqueName('Source Wiki');
    const wiki1 = await createWikiThroughUI(page, wiki1Name);
    const originalPage = await createPageThroughUI(page, 'Original Page', 'Original content');

    // # Navigate back to channel and create second wiki
    await channelsPage.goto(team.name, channel.name);
    await page.waitForLoadState('networkidle');
    const wiki2Name = uniqueName('Target Wiki');
    const wiki2 = await createWikiThroughUI(page, wiki2Name);

    // # Create client and duplicate page via API
    const {client} = await makeClient(user);
    await client.duplicatePage(wiki1.id, originalPage.id, wiki2.id, 'Duplicated Page');

    // # Refresh and verify duplicate is in target wiki
    await page.reload();
    await page.waitForLoadState('networkidle');

    // * Verify duplicated page is in target wiki
    await waitForPageInHierarchy(page, 'Duplicated Page', HIERARCHY_TIMEOUT);

    // * Click on duplicated page and verify content
    await clickPageInHierarchy(page, 'Duplicated Page');
    const pageContent = getPageViewerContent(page);
    await expect(pageContent).toContainText('Original content', {timeout: ELEMENT_TIMEOUT});

    // * Verify original still exists in source wiki
    await channelsPage.goto(team.name, channel.name);
    await page.waitForLoadState('networkidle');
    await openWikiByTab(page, wiki1Name);
    await waitForPageInHierarchy(page, 'Original Page', HIERARCHY_TIMEOUT);
});

/**
 * @objective Verify wiki can be moved to a different channel in the same team
 *
 * @precondition
 * Team must have two channels
 */
test('moves wiki to different channel in same team', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;

    // # Create two channels and add user to both (user must be member for channel to appear in dropdown)
    const sourceChannel = await createTestChannel(adminClient, team.id, 'Source Channel', 'O', [user.id]);
    const targetChannel = await createTestChannel(adminClient, team.id, 'Target Channel', 'O', [user.id]);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, sourceChannel.name);
    await page.waitForLoadState('networkidle');

    // # Create wiki with pages
    const wikiName = uniqueName('Movable Wiki');
    await createWikiThroughUI(page, wikiName);
    await createPageThroughUI(page, 'Page A', 'Content A');
    await createPageThroughUI(page, 'Page B', 'Content B');

    // # Navigate to channel view to access wiki tab menu
    await channelsPage.goto(team.name, sourceChannel.name);
    await page.waitForLoadState('networkidle');
    await waitForWikiTab(page, wikiName);

    // # Move wiki to target channel
    await moveWikiToChannel(page, wikiName, targetChannel.id);

    // * Verify wiki tab is no longer in source channel
    await page.waitForTimeout(SHORT_WAIT);
    const sourceWikiTab = page.locator('.channel-tabs-container').locator(`text="${wikiName}"`);
    await expect(sourceWikiTab).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Navigate to target channel and verify wiki exists
    await channelsPage.goto(team.name, targetChannel.name);
    await page.waitForLoadState('networkidle');
    await waitForWikiTab(page, wikiName);

    // * Open wiki and verify pages are present
    await openWikiByTab(page, wikiName);
    await waitForPageInHierarchy(page, 'Page A', HIERARCHY_TIMEOUT);
    await waitForPageInHierarchy(page, 'Page B', HIERARCHY_TIMEOUT);

    // * Verify page content is accessible
    await clickPageInHierarchy(page, 'Page A');
    const pageContent = getPageViewerContent(page);
    await expect(pageContent).toContainText('Content A', {timeout: ELEMENT_TIMEOUT});
});

/**
 * @objective Verify moved wiki with hierarchy maintains parent-child relationships
 *
 * @precondition
 * Wiki must have nested page structure before moving
 */
test(
    'preserves page hierarchy when wiki is moved to different channel',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;

        // # Create two channels and add user to both (user must be member for channel to appear in dropdown)
        const sourceChannel = await createTestChannel(adminClient, team.id, 'Source Channel', 'O', [user.id]);
        const targetChannel = await createTestChannel(adminClient, team.id, 'Target Channel', 'O', [user.id]);

        const {page, channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, sourceChannel.name);
        await page.waitForLoadState('networkidle');

        // # Create wiki with nested page structure using UI actions
        const wikiName = uniqueName('Nested Wiki');
        await createWikiThroughUI(page, wikiName);
        const parentPage = await createPageThroughUI(page, 'Parent', 'Parent content');
        const childPage = await createChildPageThroughContextMenu(page, parentPage.id, 'Child', 'Child content');
        await createChildPageThroughContextMenu(page, childPage.id, 'Grandchild', 'Grandchild content');

        // # Navigate to channel view
        await channelsPage.goto(team.name, sourceChannel.name);
        await page.waitForLoadState('networkidle');
        await waitForWikiTab(page, wikiName);

        // # Move wiki to target channel
        await moveWikiToChannel(page, wikiName, targetChannel.id);

        // * Navigate to target channel and open wiki
        await channelsPage.goto(team.name, targetChannel.name);
        await page.waitForLoadState('networkidle');
        await waitForWikiTab(page, wikiName);
        await openWikiByTab(page, wikiName);

        // * Verify parent page is visible
        await waitForPageInHierarchy(page, 'Parent', HIERARCHY_TIMEOUT);

        // # Expand parent to see child
        await expandPageTreeNode(page, 'Parent');
        await page.waitForTimeout(SHORT_WAIT);

        // * Verify child is visible
        await waitForPageInHierarchy(page, 'Child', HIERARCHY_TIMEOUT);

        // # Expand child to see grandchild
        await expandPageTreeNode(page, 'Child');
        await page.waitForTimeout(SHORT_WAIT);

        // * Verify grandchild is visible
        await waitForPageInHierarchy(page, 'Grandchild', HIERARCHY_TIMEOUT);

        // * Click on grandchild and verify content
        await clickPageInHierarchy(page, 'Grandchild');
        const pageContent = getPageViewerContent(page);
        await expect(pageContent).toContainText('Grandchild content', {timeout: ELEMENT_TIMEOUT});

        // * Verify breadcrumb shows correct hierarchy
        await verifyBreadcrumbContains(page, 'Parent');
        await verifyBreadcrumbContains(page, 'Child');
    },
);

/**
 * @objective Verify page move between wikis updates breadcrumb correctly
 *
 * @precondition
 * Channel must have two wikis with different structures
 */
test('updates breadcrumb after moving page between wikis', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await page.waitForLoadState('networkidle');

    // # Create first wiki
    const wiki1Name = uniqueName('Wiki One');
    await createWikiThroughUI(page, wiki1Name);
    await createPageThroughUI(page, 'Moving Page', 'Moving content');

    // # Navigate back and create second wiki with a parent page
    await channelsPage.goto(team.name, channel.name);
    await page.waitForLoadState('networkidle');
    const wiki2Name = uniqueName('Wiki Two');
    const wiki2 = await createWikiThroughUI(page, wiki2Name);
    const targetParent = await createPageThroughUI(page, 'Target Parent', 'Target parent content');

    // # Navigate back to first wiki
    await channelsPage.goto(team.name, channel.name);
    await page.waitForLoadState('networkidle');
    await openWikiByTab(page, wiki1Name);
    await waitForPageInHierarchy(page, 'Moving Page', HIERARCHY_TIMEOUT);

    // # Open move modal
    const moveModal = await openMovePageModal(page, 'Moving Page');

    // # Select target wiki
    const wikiSelect = moveModal.locator('#target-wiki-select');
    await wikiSelect.selectOption(wiki2.id);

    // # Wait for parent options to load
    await page.waitForTimeout(SHORT_WAIT);

    // # Select target parent (if parent selection is available)
    const parentSelect = moveModal.locator('#target-parent-select');
    if (await parentSelect.isVisible()) {
        await parentSelect.selectOption(targetParent.id);
    }

    // # Confirm move
    const confirmButton = moveModal.getByRole('button', {name: /Move|Confirm/i});
    await confirmButton.click();
    await expect(moveModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});
    await page.waitForLoadState('networkidle');

    // * Navigate to target wiki and verify page is there
    await channelsPage.goto(team.name, channel.name);
    await page.waitForLoadState('networkidle');
    await openWikiByTab(page, wiki2Name);

    // # Expand target parent if needed
    const parentNode = page.locator('[data-testid="page-tree-node"]').filter({hasText: 'Target Parent'}).first();
    const expandButton = parentNode.locator('[data-testid="expand-collapse-button"]');
    if (await expandButton.isVisible()) {
        await expandButton.click();
        await page.waitForTimeout(SHORT_WAIT);
    }

    // * Verify moved page is visible (may be under parent or at root)
    await waitForPageInHierarchy(page, 'Moving Page', HIERARCHY_TIMEOUT);

    // * Click and verify breadcrumb shows wiki name
    await clickPageInHierarchy(page, 'Moving Page');
    await verifyBreadcrumbContains(page, wiki2Name);
});

/**
 * @objective Verify cross-wiki page duplication preserves page content formatting
 *
 * @precondition
 * Source wiki must have page with formatted content
 */
test('preserves content formatting when duplicating across wikis', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    test.slow();
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await page.waitForLoadState('networkidle');

    // # Create first wiki with formatted content
    const wiki1Name = uniqueName('Source Wiki');
    const wiki1 = await createWikiThroughUI(page, wiki1Name);

    // # Create page with rich content via API
    const {client} = await makeClient(user);
    const richContent = createRichPageContent('Main Heading', 'Regular paragraph text.', [
        'Bullet item 1',
        'Bullet item 2',
    ]);
    const originalPage = await createPageViaDraft(client, wiki1.id, 'Formatted Page', richContent);

    // # Create second wiki
    await channelsPage.goto(team.name, channel.name);
    await page.waitForLoadState('networkidle');
    const wiki2Name = uniqueName('Target Wiki');
    const wiki2 = await createWikiThroughUI(page, wiki2Name);

    // # Duplicate page to second wiki via API
    await client.duplicatePage(wiki1.id, originalPage.id, wiki2.id, 'Copied Formatted Page');

    // # Refresh to see the duplicated page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // * Verify duplicated page is in target wiki
    await waitForPageInHierarchy(page, 'Copied Formatted Page', HIERARCHY_TIMEOUT);

    // * Click on duplicated page
    await clickPageInHierarchy(page, 'Copied Formatted Page');
    const pageContent = getPageViewerContent(page);

    // * Verify formatted content is preserved
    await expect(pageContent).toContainText('Main Heading', {timeout: ELEMENT_TIMEOUT});
    await expect(pageContent).toContainText('Regular paragraph text', {timeout: ELEMENT_TIMEOUT});
    await expect(pageContent).toContainText('Bullet item 1', {timeout: ELEMENT_TIMEOUT});
    await expect(pageContent).toContainText('Bullet item 2', {timeout: ELEMENT_TIMEOUT});

    // * Verify heading is rendered as h1
    const heading = pageContent.locator('h1').filter({hasText: 'Main Heading'});
    await expect(heading).toBeVisible({timeout: ELEMENT_TIMEOUT});
});
