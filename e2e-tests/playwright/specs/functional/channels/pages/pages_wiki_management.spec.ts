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
    openWikiTabMenu,
    clickWikiTabMenuItem,
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
    moveWikiToChannel,
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
    HIERARCHY_TIMEOUT,
    WEBSOCKET_WAIT,
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
        await page.goto(`/${team.name}/wiki/${channel.id}/${wikiId}`);
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
    await expect(page).toHaveURL(/\/wiki\/[^/]+\/[^/]+/);

    // # Navigate back to channel to rename through wiki tab
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();
    await page.waitForLoadState('networkidle');

    // # Wait for wiki tab to be visible and rename through wiki tab menu
    const wikiTab = getWikiTab(page, originalName);
    await wikiTab.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

    await openWikiTabMenu(page, originalName);
    await clickWikiTabMenuItem(page, 'wiki-tab-rename');

    const renameModal = page.getByRole('dialog');
    const titleInput = renameModal.locator('#text-input-modal-input');
    await titleInput.clear();
    await titleInput.fill(updatedName);
    await renameModal.getByRole('button', {name: /rename/i}).click();
    await renameModal.waitFor({state: 'hidden', timeout: ELEMENT_TIMEOUT});

    // * Verify wiki tab updated
    const updatedTab = getWikiTab(page, updatedName);
    await expect(updatedTab).toBeVisible();

    // # Click on renamed wiki tab to verify wiki title also updated
    await updatedTab.click();

    // * Verify navigated to wiki
    await expect(page).toHaveURL(/\/wiki\/[^/]+\/[^/]+/);

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
        await expect(page).toHaveURL(/\/wiki\/[^/]+\/[^/]+/);

        // # Navigate to channel to delete wiki tab
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();
        await page.waitForLoadState('networkidle');

        // # Wait for wiki tab to be visible
        const wikiTab = getWikiTab(page, wikiName);
        await wikiTab.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

        await openWikiTabMenu(page, wikiName);
        await clickWikiTabMenuItem(page, 'wiki-tab-delete');

        const confirmModal = page.getByRole('dialog');
        await confirmModal.getByRole('button', {name: /delete|yes/i}).click();
        await confirmModal.waitFor({state: 'hidden', timeout: ELEMENT_TIMEOUT});

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
    // Wiki view automatically selects first page/draft when navigating to wiki root
    await page.waitForURL(/\/wiki\/[^/]+\/[^/]+\/[^/]+/, {timeout: HIERARCHY_TIMEOUT});

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
    const childPageNode = hierarchyPanel.getByRole('button', {name: 'Child Page', exact: true});
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
    const channel = await createTestChannel(adminClient, team.id, 'Test Channel');

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

    await openWikiTabMenu(page, wikiName);
    await clickWikiTabMenuItem(page, 'wiki-tab-delete');

    const confirmModal = page.getByRole('dialog');
    await confirmModal.getByRole('button', {name: /delete|yes/i}).click();
    await confirmModal.waitFor({state: 'hidden', timeout: ELEMENT_TIMEOUT});

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
 * @objective Verify wiki can be moved to another channel in the same team
 *
 * @precondition
 * Two channels must exist in the same team
 */
test('moves wiki to another channel through wiki tab menu', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const sourceChannel = await createTestChannel(adminClient, team.id, 'Source Channel');
    const targetChannel = await createTestChannel(adminClient, team.id, 'Target Channel');

    // # Add user to both channels so they appear in the move dropdown
    await adminClient.addToChannel(user.id, sourceChannel.id);
    await adminClient.addToChannel(user.id, targetChannel.id);

    const {page, channelsPage} = await loginAndNavigateToChannel(pw, user, team.name, sourceChannel.name);

    const wikiName = uniqueName('Wiki to Move');

    // # Create wiki in source channel
    await createWikiThroughUI(page, wikiName);

    // * Verify wiki created
    await expect(page).toHaveURL(/\/wiki\/[^/]+\/[^/]+/);

    // # Navigate back to source channel
    await channelsPage.goto(team.name, sourceChannel.name);
    await page.waitForLoadState('networkidle');

    // # Wait for wiki tab to be visible in source channel
    const sourceWikiTab = getWikiTab(page, wikiName);
    await sourceWikiTab.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

    // # Open wiki tab menu
    await openWikiTabMenu(page, wikiName);

    // # Click "Move wiki" in the dropdown menu
    await clickWikiTabMenuItem(page, 'wiki-tab-move');

    // # Wait for move modal to appear
    const moveModal = page.getByRole('dialog');
    await moveModal.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

    // # Wait for channel select to be populated with options
    const channelSelect = moveModal.locator('#target-channel-select');
    await channelSelect.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

    // # Wait for at least 2 options (placeholder + target channel)
    await page.waitForFunction(
        (selectId) => {
            const select = document.querySelector(`#${selectId}`) as HTMLSelectElement;
            return select && select.options.length > 1;
        },
        'target-channel-select',
        {timeout: ELEMENT_TIMEOUT},
    );

    // # Select target channel from dropdown by value
    await channelSelect.selectOption({value: targetChannel.id});

    // # Click Move Wiki button
    const moveButton = moveModal.getByRole('button', {name: /move wiki/i});
    await moveButton.click();

    // # Wait for modal to close
    await moveModal.waitFor({state: 'hidden', timeout: ELEMENT_TIMEOUT});

    // # Wait for network requests to complete after wiki move
    await page.waitForLoadState('networkidle');

    // * Verify wiki tab no longer exists in source channel
    await expect(sourceWikiTab).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify wiki tab count is zero in source channel (explicit count check)
    const sourceWikiTabs = getAllWikiTabs(page);
    await expect(sourceWikiTabs).toHaveCount(0, {timeout: ELEMENT_TIMEOUT});

    // # Navigate to target channel
    await channelsPage.goto(team.name, targetChannel.name);
    await page.waitForLoadState('networkidle');

    // * Verify wiki tab now appears in target channel
    const targetWikiTab = getWikiTab(page, wikiName);
    await expect(targetWikiTab).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify wiki tab count is exactly one in target channel (explicit count check)
    const targetWikiTabs = getAllWikiTabs(page);
    await expect(targetWikiTabs).toHaveCount(1, {timeout: ELEMENT_TIMEOUT});

    // # Click on wiki tab to open it
    await targetWikiTab.click();

    // * Verify navigated to wiki view
    await expect(page).toHaveURL(/\/wiki\/[^/]+\/[^/]+/);

    // * Verify wiki loads successfully
    await waitForWikiViewLoad(page);
});

/**
 * @objective Verify inline comments are migrated when wiki is moved to another channel
 *
 * @precondition
 * Two channels must exist in the same team
 */
test(
    'migrates inline comments when moving wiki to another channel',
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
        await expect(page).toHaveURL(/\/wiki\/[^/]+\/[^/]+/);

        // # Create a page in the wiki through UI
        const pageName = uniqueName('Test Page');
        await createPageThroughUI(page, pageName);
        await page.waitForLoadState('networkidle');

        // # Extract page ID from URL
        const pageUrl = page.url();
        const pageIdMatch = pageUrl.match(/\/([^/]+)$/);
        const pageId = pageIdMatch ? pageIdMatch[1] : null;
        expect(pageId).toBeTruthy();

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

        // # Navigate back to source channel to move the wiki
        await channelsPage.goto(team.name, sourceChannel.name);
        await page.waitForLoadState('networkidle');

        // # Move wiki to target channel using helper
        await moveWikiToChannel(page, wikiName, targetChannel.id);

        // # Fetch the inline comment again to verify it was migrated
        const movedComment = await adminClient.getPost(inlineComment.id);

        // * Verify inline comment now belongs to target channel
        expect(movedComment.channel_id).toBe(targetChannel.id);

        // * Verify inline comment still has empty RootId
        expect(movedComment.root_id).toBe('');

        // * Verify inline comment still has page_id in Props
        expect(movedComment.props.page_id).toBe(pageId);

        // * Verify inline comment message is unchanged
        expect(movedComment.message).toBe(inlineCommentText);
    },
);
