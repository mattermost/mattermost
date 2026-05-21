// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';
import {
    createWikiThroughUI,
    createTestChannel,
    createPageThroughUI,
    createChildPageThroughContextMenu,
    waitForPageInHierarchy,
    getWikiTab,
    waitForWikiViewLoad,
    getAllWikiTabs,
    renameWikiThroughModal,
    deleteWikiThroughModalConfirmation,
    navigateToChannelFromWiki,
    verifyWikiNameInBreadcrumb,
    verifyNavigatedToWiki,
    extractWikiIdFromUrl,
    verifyWikiDeleted,
    waitForWikiTab,
    openWikiByTab,
    linkWikiToChannel,
    unlinkWikiFromChannel,
    getHierarchyPanel,
    getPageViewerContent,
    getBreadcrumb,
    getBreadcrumbLinks,
    verifyBreadcrumbContains,
    verifyPageContentContains,
    uniqueName,
    loginAndNavigateToChannel,
    EDITOR_LOAD_WAIT,
    ELEMENT_TIMEOUT,
    WEBSOCKET_WAIT,
    WIKI_VIEW_TIMEOUT,
} from './test_helpers';

/**
 * @objective Verify wiki can be renamed through channel tab bar menu
 *
 * @precondition
 * Wiki tab must exist in channel tab bar
 */
test('renames wiki through channel tab bar menu', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, 'Test Channel');

    const {page, channelsPage} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    const originalWikiName = uniqueName('Original Wiki');
    const newWikiName = uniqueName('Renamed Wiki');

    // # Create wiki through channel tab bar UI
    await createWikiThroughUI(page, originalWikiName);

    // * Verify wiki created and navigated to wiki view
    await verifyNavigatedToWiki(page);

    // # Navigate back to channel
    await navigateToChannelFromWiki(page, channelsPage, team.name, channel.name);

    // # Wait for wiki tab to be visible and rename it
    await waitForWikiTab(page, originalWikiName);
    await renameWikiThroughModal(page, originalWikiName, newWikiName);

    // * Verify wiki tab displays new name in channel tab bar
    await expect(getWikiTab(page, newWikiName)).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Click on renamed wiki tab to open it
    await openWikiByTab(page, newWikiName);

    // * Verify navigated to wiki with updated name and wiki name appears in breadcrumb
    await verifyNavigatedToWiki(page);
    await verifyWikiNameInBreadcrumb(page, newWikiName);
});

/**
 * @objective Verify wiki is deleted when wiki tab is deleted
 *
 * @precondition
 * Wiki tab must exist in channel tab bar
 */
test('deletes wiki when wiki tab is deleted', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, 'Test Channel');

    const {page, channelsPage} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    const wikiName = uniqueName('Delete Test Wiki');

    // # Create wiki through channel tab bar UI
    await createWikiThroughUI(page, wikiName);

    // * Verify wiki created and navigated to wiki view
    await verifyNavigatedToWiki(page);

    // # Extract wiki ID from URL for later verification
    const wikiId = extractWikiIdFromUrl(page);
    expect(wikiId).toBeTruthy();

    // # Navigate back to channel
    await navigateToChannelFromWiki(page, channelsPage, team.name, channel.name);

    // # Wait for wiki tab to be visible
    const wikiTab = await waitForWikiTab(page, wikiName);

    // # Delete wiki through tab menu with confirmation
    await deleteWikiThroughModalConfirmation(page, wikiName);

    // * Verify wiki tab is removed from channel tab bar
    await expect(wikiTab).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify navigated back to channel (not wiki)
    await expect(page).toHaveURL(new RegExp(`/${team.name}/channels/${channel.name}`));

    // # Try to navigate to the deleted wiki URL directly and verify it's inaccessible
    if (wikiId) {
        await page.goto(`/${team.name}/wiki/${wikiId}`);
        await verifyWikiDeleted(page, channel.name);
    }
});

/**
 * @objective Verify wiki rename updates wiki tab and wiki title simultaneously
 *
 * @precondition
 * Wiki tab must exist in channel tab bar
 */
test('updates both wiki tab and wiki title when renamed', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, 'Test Channel');

    const {page, channelsPage} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    const originalName = uniqueName('Sync Test Wiki');
    const updatedName = uniqueName('Updated Sync Wiki');

    // # Create wiki through channel tab bar UI
    await createWikiThroughUI(page, originalName);

    // * Verify navigated to wiki
    await verifyNavigatedToWiki(page);

    // # Navigate back to channel to rename through wiki tab
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();
    await page.waitForLoadState('networkidle');

    // # Wait for wiki tab to be visible and rename through wiki tab menu
    const wikiTab = getWikiTab(page, originalName);
    await wikiTab.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

    await renameWikiThroughModal(page, originalName, updatedName);

    // * Verify wiki tab updated
    const updatedTab = getWikiTab(page, updatedName);
    await expect(updatedTab).toBeVisible();

    // # Click on renamed wiki tab to verify wiki title also updated
    await updatedTab.click();

    // * Verify navigated to wiki
    await verifyNavigatedToWiki(page);

    // * Verify wiki name is displayed in breadcrumb
    const breadcrumb = getBreadcrumb(page);
    await expect(breadcrumb).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await expect(breadcrumb).toContainText(updatedName);
});

/**
 * @objective Verify deleting wiki tab navigates user away from wiki view
 *
 * @precondition
 * User must be viewing wiki when wiki tab is deleted
 */
test(
    'navigates to channel when deleting wiki tab while viewing wiki',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await createTestChannel(adminClient, team.id, 'Test Channel');

        const {page, channelsPage} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        const wikiName = uniqueName('Nav Test Wiki');

        // # Create wiki and stay in wiki view
        await createWikiThroughUI(page, wikiName);

        // * Verify in wiki view
        await verifyNavigatedToWiki(page);

        // # Navigate to channel to delete wiki tab
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();
        await page.waitForLoadState('networkidle');

        // # Wait for wiki tab to be visible
        const wikiTab = getWikiTab(page, wikiName);
        await wikiTab.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

        await deleteWikiThroughModalConfirmation(page, wikiName);

        // * Verify navigated to channel (not wiki)
        await expect(page).toHaveURL(new RegExp(`/${team.name}/channels/${channel.name}`));
    },
);

/**
 * @objective Verify breadcrumbs and navigation work after wiki rename
 *
 * @precondition
 * Wiki must have pages and hierarchy before rename
 */
test('maintains breadcrumb navigation after wiki rename', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    test.slow();
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, 'Test Channel');

    const {page, channelsPage} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    const originalWikiName = uniqueName('Original Navigation Wiki');
    const newWikiName = uniqueName('Renamed Navigation Wiki');

    // # Create wiki with pages
    await createWikiThroughUI(page, originalWikiName);

    // # Create parent page
    const parentPage = await createPageThroughUI(page, 'Parent Page', 'Parent content');

    // # Create child page
    await createChildPageThroughContextMenu(page, parentPage.id, 'Child Page', 'Child content');

    // * Verify child page is visible with content
    const childPageContent = getPageViewerContent(page);
    await expect(childPageContent).toContainText('Child content');

    // # Navigate back to channel to rename wiki
    await navigateToChannelFromWiki(page, channelsPage, team.name, channel.name);

    // # Wait for wiki tab to be visible and rename wiki through wiki tab menu
    await waitForWikiTab(page, originalWikiName);
    await renameWikiThroughModal(page, originalWikiName, newWikiName);

    // # Click on renamed wiki tab
    await openWikiByTab(page, newWikiName);

    // * Verify navigated to wiki
    await verifyNavigatedToWiki(page);

    // # Wait for wiki view to load
    await waitForWikiViewLoad(page);

    // # Wait for auto-selection to complete (URL will include pageId or draftId)
    // Wiki view automatically selects first page/draft when navigating to wiki root.
    // URL shape: /:team/wiki/:wikiId/(:pageId|drafts/:draftId)[?from=...]
    await page.waitForURL(/\/wiki\/[a-z0-9]{26}\/(?:drafts\/)?[a-z0-9]{26}/, {timeout: WIKI_VIEW_TIMEOUT});

    // # Wait for pages to load in hierarchy panel
    await waitForPageInHierarchy(page, 'Parent Page', 15000);

    // # Expand parent node to make child visible
    const hierarchyPanel = getHierarchyPanel(page);
    const parentNode = hierarchyPanel
        .locator('[data-testid="page-tree-node"]')
        .filter({hasText: 'Parent Page'})
        .first();
    const expandButton = parentNode.locator('[data-testid="page-tree-node-expand-button"]');

    // Check if parent has children and is collapsed (expand button visible)
    await expect(expandButton).toBeVisible({timeout: WEBSOCKET_WAIT});
    await expandButton.click();

    // # Wait for child page to become visible after expansion
    await waitForPageInHierarchy(page, 'Child Page', 10000);

    // # Navigate to child page through hierarchy panel
    const childPageNode = hierarchyPanel.getByRole('button', {name: 'Go to Child Page', exact: true});
    await childPageNode.click();

    // * Verify navigated to child page
    await expect(childPageContent).toContainText('Child content');

    // * Verify breadcrumb navigation exists and shows page hierarchy
    const breadcrumb = getBreadcrumb(page);
    await expect(breadcrumb).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await verifyBreadcrumbContains(page, 'Parent Page');
    await verifyBreadcrumbContains(page, 'Child Page');

    // # Click on parent in breadcrumb to navigate back
    const parentBreadcrumbLink = getBreadcrumbLinks(page).filter({hasText: 'Parent Page'}).first();
    await expect(parentBreadcrumbLink).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await parentBreadcrumbLink.click();

    // * Verify navigated back to parent page
    await expect(childPageContent).toContainText('Parent content');

    // # Navigate to child again through hierarchy panel
    await childPageNode.click();

    // * Verify child page still accessible after navigating via breadcrumb
    await expect(childPageContent).toContainText('Child content');
});

/**
 * @objective Verify hierarchy panel updates correctly after wiki rename
 *
 * @precondition
 * Wiki must have multiple pages in hierarchy
 */
test('updates hierarchy panel after wiki rename', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    test.slow();
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, 'Test Channel', 'O', [user.id]);

    const {page, channelsPage} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    const originalWikiName = uniqueName('Original Hierarchy Wiki');
    const newWikiName = uniqueName('Renamed Hierarchy Wiki');

    // # Create wiki with multiple pages
    await createWikiThroughUI(page, originalWikiName);

    await createPageThroughUI(page, 'Page A', 'Content A');
    await createPageThroughUI(page, 'Page B', 'Content B');
    await createPageThroughUI(page, 'Page C', 'Content C');

    // * Verify all pages appear in hierarchy panel
    const hierarchyPanel = getHierarchyPanel(page);
    await expect(hierarchyPanel.getByRole('button', {name: 'Page A'}).first()).toBeVisible();
    await expect(hierarchyPanel.getByRole('button', {name: 'Page B'}).first()).toBeVisible();
    await expect(hierarchyPanel.getByRole('button', {name: 'Page C'}).first()).toBeVisible();

    // # Navigate to channel and rename wiki
    await navigateToChannelFromWiki(page, channelsPage, team.name, channel.name);

    // # Wait for wiki tab to be visible and rename wiki
    await waitForWikiTab(page, originalWikiName);
    await renameWikiThroughModal(page, originalWikiName, newWikiName);

    // # Click on renamed wiki
    await openWikiByTab(page, newWikiName);
    await verifyNavigatedToWiki(page);

    // # Wait for wiki view to load
    await waitForWikiViewLoad(page);

    // # Wait for pages to load in hierarchy panel with longer timeout
    await waitForPageInHierarchy(page, 'Page A', 15000);
    await waitForPageInHierarchy(page, 'Page B', 15000);
    await waitForPageInHierarchy(page, 'Page C', 15000);

    // * Verify hierarchy panel still shows all pages
    await expect(hierarchyPanel.getByRole('button', {name: 'Page A'}).first()).toBeVisible();
    await expect(hierarchyPanel.getByRole('button', {name: 'Page B'}).first()).toBeVisible();
    await expect(hierarchyPanel.getByRole('button', {name: 'Page C'}).first()).toBeVisible();

    // # Navigate to each page through hierarchy to verify navigation works
    // Click the title button specifically to select Page B
    await hierarchyPanel.locator('[data-testid="page-tree-node-title"]', {hasText: 'Page B'}).click();
    await verifyPageContentContains(page, 'Content B');

    await hierarchyPanel.locator('[data-testid="page-tree-node-title"]', {hasText: 'Page C'}).click();
    await verifyPageContentContains(page, 'Content C');

    await hierarchyPanel.locator('[data-testid="page-tree-node-title"]', {hasText: 'Page A'}).click();
    await verifyPageContentContains(page, 'Content A');
});

/**
 * @objective Verify child pages are inaccessible after parent wiki deletion
 *
 * @precondition
 * Wiki must have parent and child pages
 */
test('makes all child pages inaccessible after wiki deletion', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, 'Test Channel');

    const {page, channelsPage} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    const wikiName = uniqueName('Deletion Test Wiki');

    // # Create wiki with hierarchy
    await createWikiThroughUI(page, wikiName);

    const parentPage = await createPageThroughUI(page, 'Parent to Delete', 'Parent content');
    await createChildPageThroughContextMenu(page, parentPage.id, 'Child to Delete', 'Child content');

    // # Store page URLs before deletion
    const childUrl = page.url();

    // # Navigate back to channel and delete wiki
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();
    await page.waitForLoadState('networkidle');

    // # Wait for wiki tab to be visible
    const wikiTab = getWikiTab(page, wikiName);
    await wikiTab.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

    await deleteWikiThroughModalConfirmation(page, wikiName);

    // * Verify wiki tab removed
    await expect(wikiTab).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Try to navigate directly to child page URL
    await page.goto(childUrl);
    await page.waitForLoadState('networkidle');

    // * Wait for redirect or error to appear (redirect happens in React after page load)
    await page.waitForTimeout(EDITOR_LOAD_WAIT);

    // * Verify child page is not accessible (404, error, or redirect)
    const errorLocator = page.locator("text=/not found|error|doesn't exist/i");
    const isRedirected = page.url().includes('/channels/' + channel.name) || !page.url().includes('/wiki/');

    // Either we see an error message or we're redirected away from wiki
    if (!isRedirected) {
        await expect(errorLocator).toBeVisible({timeout: EDITOR_LOAD_WAIT});
    } else {
        expect(isRedirected).toBeTruthy();
    }
});

/**
 * @objective Verify wiki can be linked to multiple channels
 *
 * @precondition
 * Two channels must exist in the same team
 */
test('links and unlinks wiki from channels', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const sourceChannel = await createTestChannel(adminClient, team.id, 'Source Channel');
    const targetChannel = await createTestChannel(adminClient, team.id, 'Target Channel');

    // # Add user to both channels
    await adminClient.addToChannel(user.id, sourceChannel.id);
    await adminClient.addToChannel(user.id, targetChannel.id);

    const {page, channelsPage} = await loginAndNavigateToChannel(pw, user, team.name, sourceChannel.name);

    const wikiName = uniqueName('Wiki to Link');

    // # Create wiki in source channel
    await createWikiThroughUI(page, wikiName);

    // * Verify wiki created
    await verifyNavigatedToWiki(page);

    // # Get wiki ID from URL
    const wikiUrl = page.url();
    const wikiIdMatch = wikiUrl.match(/\/wiki\/([a-z0-9]{26})/);
    const wikiId = wikiIdMatch ? wikiIdMatch[1] : null;
    expect(wikiId).toBeTruthy();

    // # Navigate back to source channel using tab click
    await navigateToChannelFromWiki(page, channelsPage, team.name, sourceChannel.name);

    // # Wait for wiki tab to be visible in source channel
    const sourceWikiTab = getWikiTab(page, wikiName);
    await sourceWikiTab.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

    // # Link wiki to target channel via API
    await linkWikiToChannel(adminClient, targetChannel.id, wikiId!);

    // # Refresh to see the new link
    await page.reload();
    await page.waitForLoadState('networkidle');

    // # Navigate to target channel
    await channelsPage.goto(team.name, targetChannel.name);
    await page.waitForLoadState('networkidle');

    // * Verify wiki tab appears in target channel
    const targetWikiTab = getWikiTab(page, wikiName);
    await expect(targetWikiTab).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify wiki tab count is exactly one in target channel
    const targetWikiTabs = getAllWikiTabs(page);
    await expect(targetWikiTabs).toHaveCount(1, {timeout: ELEMENT_TIMEOUT});

    // # Click on wiki tab to verify it opens
    await targetWikiTab.click();

    // * Verify navigated to wiki view
    await verifyNavigatedToWiki(page);

    // * Verify wiki loads successfully
    await waitForWikiViewLoad(page);

    // # Navigate back to source channel
    await navigateToChannelFromWiki(page, channelsPage, team.name, sourceChannel.name);

    // # Unlink wiki from source channel via API
    await unlinkWikiFromChannel(adminClient, sourceChannel.id, wikiId!);

    // # Refresh to see the unlink
    await page.reload();
    await page.waitForLoadState('networkidle');

    // * Verify wiki tab no longer exists in source channel
    await expect(sourceWikiTab).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify wiki tab count is zero in source channel
    const sourceWikiTabs = getAllWikiTabs(page);
    await expect(sourceWikiTabs).toHaveCount(0, {timeout: ELEMENT_TIMEOUT});

    // # Navigate back to target channel to verify wiki still there
    await channelsPage.goto(team.name, targetChannel.name);
    await page.waitForLoadState('networkidle');

    // * Verify wiki tab still appears in target channel
    await expect(targetWikiTab).toBeVisible({timeout: ELEMENT_TIMEOUT});
});

/**
 * @objective Verify inline comments remain accessible when wiki is linked to another channel
 *
 * @precondition
 * Two channels must exist in the same team
 */
test(
    'inline comments remain accessible after linking wiki to another channel',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const sourceChannel = await createTestChannel(adminClient, team.id, 'Source Channel');
        const targetChannel = await createTestChannel(adminClient, team.id, 'Target Channel');

        // # Add user to both channels
        await adminClient.addToChannel(user.id, sourceChannel.id);
        await adminClient.addToChannel(user.id, targetChannel.id);

        const {page, channelsPage} = await loginAndNavigateToChannel(pw, user, team.name, sourceChannel.name);

        const wikiName = uniqueName('Wiki with Comments');

        // # Create wiki in source channel
        await createWikiThroughUI(page, wikiName);

        // * Verify wiki created
        await verifyNavigatedToWiki(page);

        // # Create a page in the wiki through UI
        const pageName = uniqueName('Test Page');
        await createPageThroughUI(page, pageName);
        await page.waitForLoadState('networkidle');

        // # Extract page ID from URL
        const pageUrl = page.url();
        const pageIdMatch = pageUrl.match(/\/([^/]+)$/);
        const pageId = pageIdMatch ? pageIdMatch[1] : null;
        expect(pageId).toBeTruthy();

        // # Get wiki ID from URL
        const wikiUrl = page.url();
        const wikiIdMatch = wikiUrl.match(/\/wiki\/([a-z0-9]{26})/);
        const wikiId = wikiIdMatch ? wikiIdMatch[1] : null;
        expect(wikiId).toBeTruthy();

        // # Create inline comment using API (inline comments have empty RootId and page_id in Props)
        const inlineCommentText = uniqueName('Inline comment');
        const inlineComment = await adminClient.createPost({
            channel_id: sourceChannel.id,
            message: inlineCommentText,
            type: 'page_comment',
            root_id: '',
            props: {
                page_id: pageId,
            },
        });

        // * Verify inline comment was created in source channel
        expect(inlineComment.channel_id).toBe(sourceChannel.id);
        expect(inlineComment.root_id).toBe('');
        expect(inlineComment.props.page_id).toBe(pageId);

        // # Navigate back to source channel
        await navigateToChannelFromWiki(page, channelsPage, team.name, sourceChannel.name);

        // # Link wiki to target channel via API
        await linkWikiToChannel(adminClient, targetChannel.id, wikiId!);

        // # Refresh to see the new link
        await page.reload();
        await page.waitForLoadState('networkidle');

        // # Navigate to target channel
        await channelsPage.goto(team.name, targetChannel.name);
        await page.waitForLoadState('networkidle');

        // # Click on wiki tab in target channel
        const targetWikiTab = getWikiTab(page, wikiName);
        await targetWikiTab.click();
        await page.waitForLoadState('networkidle');

        // * Verify wiki opens in target channel
        await verifyNavigatedToWiki(page);
        await waitForWikiViewLoad(page);

        // # Open the page we created
        await page.locator('[data-testid="page-tree-node-title"]', {hasText: pageName}).click();
        await page.waitForLoadState('networkidle');

        // * Verify page loads successfully
        await verifyNavigatedToWiki(page);

        // # Fetch inline comments for the page to verify the comment is still accessible
        // Note: page_comment posts are not served by GET /api/v4/posts/{id} (wiki domain exclusion),
        // so we use the page comments API instead.
        const pageComments = await adminClient.getPageComments(wikiId!, pageId!);
        const accessibleComment = pageComments.find((c) => c.id === inlineComment.id);

        // * Verify inline comment still exists
        expect(accessibleComment).toBeDefined();

        // * Verify inline comment still has empty RootId
        expect(accessibleComment!.root_id).toBe('');

        // * Verify inline comment still has page_id in Props
        expect(accessibleComment!.props.page_id).toBe(pageId);

        // * Verify inline comment message is unchanged
        expect(accessibleComment!.message).toBe(inlineCommentText);
    },
);

/**
 * @objective Verify the "add wiki" entry point has a meaningful label identifying it as "Add wiki"
 * @jira_ticket MM-A30
 */
test(
    'add wiki button has visible label or tooltip identifying it as Add wiki',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;

        // # Create a fresh channel that has no wiki yet
        const channelName = uniqueName('no-wiki-channel');
        const channel = await createTestChannel(adminClient, team.id, channelName);

        // # Navigate to the channel
        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Locate the button/tab that adds a wiki to a channel with no wiki yet
        const addWikiButton = page.locator('#add-tab-content').first();

        // * Verify the add-wiki entry point is visible and mentions "wiki" via accessible name or text
        await expect(addWikiButton).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await expect(addWikiButton).toHaveAccessibleName(/wiki/i);
    },
);
