// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';

import {createWikiThroughUI, createTestChannel, createPageThroughUI, createChildPageThroughContextMenu, waitForPageInHierarchy, getWikiTab, openWikiTabMenu, clickWikiTabMenuItem, waitForWikiViewLoad, getAllWikiTabs, renameWikiThroughModal, deleteWikiThroughModalConfirmation, navigateToChannelFromWiki, verifyWikiNameInBreadcrumb, verifyNavigatedToWiki, extractWikiIdFromUrl, verifyWikiDeleted, waitForWikiTab, openWikiByTab, moveWikiToChannel, getHierarchyPanel} from './test_helpers';

/**
 * @objective Verify wiki can be renamed through channel tab bar menu
 *
 * @precondition
 * Wiki tab must exist in channel tab bar
 */
test('renames wiki through channel tab bar menu', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    const originalWikiName = `Original Wiki ${pw.random.id()}`;
    const newWikiName = `Renamed Wiki ${pw.random.id()}`;

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
    await expect(getWikiTab(page, newWikiName)).toBeVisible({timeout: 5000});

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
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    const wikiName = `Delete Test Wiki ${pw.random.id()}`;

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
    await expect(wikiTab).not.toBeVisible({timeout: 5000});

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
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    const originalName = `Sync Test Wiki ${pw.random.id()}`;
    const updatedName = `Updated Sync Wiki ${pw.random.id()}`;

    // # Create wiki through channel tab bar UI
    await createWikiThroughUI(page, originalName);

    // * Verify navigated to wiki
    await expect(page).toHaveURL(/\/wiki\/[^/]+\/[^/]+/);

    // # Navigate back to channel to rename through wiki tab
    await channelsPage.goto(team.name, channel.name);
    await page.waitForLoadState('networkidle');

    // # Wait for wiki tab to be visible and rename through wiki tab menu
    const wikiTab = getWikiTab(page, originalName);
    await wikiTab.waitFor({state: 'visible', timeout: 5000});

    await openWikiTabMenu(page, originalName);
    await clickWikiTabMenuItem(page, 'wiki-tab-rename');

    const renameModal = page.getByRole('dialog');
    const titleInput = renameModal.locator('#text-input-modal-input');
    await titleInput.clear();
    await titleInput.fill(updatedName);
    await renameModal.getByRole('button', {name: /rename/i}).click();
    await renameModal.waitFor({state: 'hidden', timeout: 5000});

    // * Verify wiki tab updated
    const updatedTab = getWikiTab(page, updatedName);
    await expect(updatedTab).toBeVisible();

    // # Click on renamed wiki tab to verify wiki title also updated
    await updatedTab.click();

    // * Verify navigated to wiki
    await expect(page).toHaveURL(/\/wiki\/[^/]+\/[^/]+/);

    // * Verify wiki name is displayed in breadcrumb
    const breadcrumb = page.locator('[data-testid="breadcrumb"]').first();
    await expect(breadcrumb).toBeVisible({timeout: 5000});
    await expect(breadcrumb).toContainText(updatedName);
});

/**
 * @objective Verify deleting wiki tab navigates user away from wiki view
 *
 * @precondition
 * User must be viewing wiki when wiki tab is deleted
 */
test('navigates to channel when deleting wiki tab while viewing wiki', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    const wikiName = `Nav Test Wiki ${pw.random.id()}`;

    // # Create wiki and stay in wiki view
    await createWikiThroughUI(page, wikiName);

    // * Verify in wiki view
    await expect(page).toHaveURL(/\/wiki\/[^/]+\/[^/]+/);

    // # Navigate to channel to delete wiki tab
    await channelsPage.goto(team.name, channel.name);
    await page.waitForLoadState('networkidle');

    // # Wait for wiki tab to be visible
    const wikiTab = getWikiTab(page, wikiName);
    await wikiTab.waitFor({state: 'visible', timeout: 5000});

    await openWikiTabMenu(page, wikiName);
    await clickWikiTabMenuItem(page, 'wiki-tab-delete');

    const confirmModal = page.getByRole('dialog');
    await confirmModal.getByRole('button', {name: /delete|yes/i}).click();
    await confirmModal.waitFor({state: 'hidden', timeout: 5000});

    // * Verify navigated to channel (not wiki)
    await expect(page).toHaveURL(new RegExp(`/${team.name}/channels/${channel.name}`));
});

/**
 * @objective Verify breadcrumbs and navigation work after wiki rename
 *
 * @precondition
 * Wiki must have pages and hierarchy before rename
 */
test('maintains breadcrumb navigation after wiki rename', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, 'Test Channel ' + pw.random.id());

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    const originalWikiName = 'Original Navigation Wiki ' + pw.random.id();
    const newWikiName = 'Renamed Navigation Wiki ' + pw.random.id();

    // # Create wiki with pages
    await createWikiThroughUI(page, originalWikiName);

    // # Create parent page
    const parentPage = await createPageThroughUI(page, 'Parent Page', 'Parent content');

    // # Create child page
    await createChildPageThroughContextMenu(page, parentPage.id, 'Child Page', 'Child content');

    // * Verify child page is visible with content
    const childPageContent = page.locator('[data-testid="page-viewer-content"]');
    await expect(childPageContent).toContainText('Child content');

    // # Navigate back to channel to rename wiki
    await channelsPage.goto(team.name, channel.name);
    await page.waitForLoadState('networkidle');

    // # Wait for wiki tab to be visible and rename wiki through wiki tab menu
    const wikiTab = getWikiTab(page, originalWikiName);
    await wikiTab.waitFor({state: 'visible', timeout: 5000});

    await openWikiTabMenu(page, originalWikiName);
    await clickWikiTabMenuItem(page, 'wiki-tab-rename');

    const renameModal = page.getByRole('dialog');
    const titleInput = renameModal.locator('#text-input-modal-input');
    await titleInput.clear();
    await titleInput.fill(newWikiName);
    await renameModal.getByRole('button', {name: /rename/i}).click();
    await renameModal.waitFor({state: 'hidden', timeout: 5000});

    // # Click on renamed wiki tab
    const updatedTab = getWikiTab(page, newWikiName);
    await updatedTab.click();
    await page.waitForLoadState('networkidle');

    // * Verify navigated to wiki
    await expect(page).toHaveURL(/\/wiki\/[^/]+\/[^/]+/);

    // # Wait for component to mount before checking visibility
    await page.waitForTimeout(2000);

    // # Wait for wiki view to load
    await waitForWikiViewLoad(page);

    // # Wait for auto-selection to complete (URL will include pageId or draftId)
    // Wiki view automatically selects first page/draft when navigating to wiki root
    await page.waitForURL(/\/wiki\/[^/]+\/[^/]+\/[^/]+/, {timeout: 10000});

    // # Wait additional time for pages to fully load after rename
    await page.waitForTimeout(2000);

    // # Wait for pages to load in hierarchy panel
    await waitForPageInHierarchy(page, 'Parent Page', 15000);

    // # Expand parent node to make child visible
    const hierarchyPanel = getHierarchyPanel(page);
    const parentNode = hierarchyPanel.locator('[data-testid="page-tree-node"]').filter({hasText: 'Parent Page'}).first();
    const expandButton = parentNode.locator('[data-testid="page-tree-node-expand-button"]');

    // Check if parent has children and is collapsed (expand button visible)
    await expect(expandButton).toBeVisible({timeout: 2000});
    await expandButton.click();

    // # Wait for child page to become visible after expansion
    await waitForPageInHierarchy(page, 'Child Page', 10000);

    // # Navigate to child page through hierarchy panel
    const childPageNode = hierarchyPanel.getByRole('button', {name: 'Child Page', exact: true});
    await childPageNode.click();

    // * Verify navigated to child page
    await expect(childPageContent).toContainText('Child content');

    // * Verify breadcrumb navigation exists and shows page hierarchy
    const breadcrumb = page.locator('[data-testid="breadcrumb"]').first();
    await expect(breadcrumb).toBeVisible({timeout: 5000});
    await expect(breadcrumb).toContainText('Parent Page');
    await expect(breadcrumb).toContainText('Child Page');

    // # Click on parent in breadcrumb to navigate back
    const parentBreadcrumbLink = breadcrumb.locator('.PageBreadcrumb__link').filter({hasText: 'Parent Page'}).first();
    await expect(parentBreadcrumbLink).toBeVisible({timeout: 5000});
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
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, 'Test Channel ' + pw.random.id());

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    const originalWikiName = 'Original Hierarchy Wiki ' + pw.random.id();
    const newWikiName = 'Renamed Hierarchy Wiki ' + pw.random.id();

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
    await channelsPage.goto(team.name, channel.name);
    await page.waitForLoadState('networkidle');

    // # Wait for wiki tab to be visible
    const wikiTab = getWikiTab(page, originalWikiName);
    await wikiTab.waitFor({state: 'visible', timeout: 5000});

    await openWikiTabMenu(page, originalWikiName);
    await clickWikiTabMenuItem(page, 'wiki-tab-rename');

    const renameModal = page.getByRole('dialog');
    const titleInput = renameModal.locator('#text-input-modal-input');
    await titleInput.clear();
    await titleInput.fill(newWikiName);
    await renameModal.getByRole('button', {name: /rename/i}).click();
    await renameModal.waitFor({state: 'hidden', timeout: 5000});

    // # Click on renamed wiki
    const updatedTab = getWikiTab(page, newWikiName);
    await updatedTab.click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/wiki\//);

    // # Wait for component to mount before checking visibility
    await page.waitForTimeout(2000);

    // # Wait for wiki view to load
    await waitForWikiViewLoad(page);

    // # Wait additional time for pages to fully load after rename
    await page.waitForTimeout(2000);

    // # Wait for pages to load in hierarchy panel with longer timeout
    await waitForPageInHierarchy(page, 'Page A', 15000);
    await waitForPageInHierarchy(page, 'Page B', 15000);
    await waitForPageInHierarchy(page, 'Page C', 15000);

    // * Verify hierarchy panel still shows all pages
    await expect(hierarchyPanel.getByRole('button', {name: 'Page A'}).first()).toBeVisible();
    await expect(hierarchyPanel.getByRole('button', {name: 'Page B'}).first()).toBeVisible();
    await expect(hierarchyPanel.getByRole('button', {name: 'Page C'}).first()).toBeVisible();

    // # Navigate to each page through hierarchy to verify navigation works
    const pageContent = page.locator('[data-testid="page-viewer-content"]');

    // Click the title button specifically to select Page B
    await hierarchyPanel.locator('[data-testid="page-tree-node-title"]', {hasText: 'Page B'}).click();
    await pageContent.waitFor({state: 'visible', timeout: 10000});
    await expect(pageContent).toContainText('Content B');

    await hierarchyPanel.locator('[data-testid="page-tree-node-title"]', {hasText: 'Page C'}).click();
    await pageContent.waitFor({state: 'visible', timeout: 10000});
    await expect(pageContent).toContainText('Content C');

    await hierarchyPanel.locator('[data-testid="page-tree-node-title"]', {hasText: 'Page A'}).click();
    await pageContent.waitFor({state: 'visible', timeout: 10000});
    await expect(pageContent).toContainText('Content A');
});

/**
 * @objective Verify child pages are inaccessible after parent wiki deletion
 *
 * @precondition
 * Wiki must have parent and child pages
 */
test('makes all child pages inaccessible after wiki deletion', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, 'Test Channel ' + pw.random.id());

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    const wikiName = 'Deletion Test Wiki ' + pw.random.id();

    // # Create wiki with hierarchy
    await createWikiThroughUI(page, wikiName);

    const parentPage = await createPageThroughUI(page, 'Parent to Delete', 'Parent content');
    const childPage = await createChildPageThroughContextMenu(page, parentPage.id, 'Child to Delete', 'Child content');

    // # Store page URLs before deletion
    const childUrl = page.url();

    // # Navigate back to channel and delete wiki
    await channelsPage.goto(team.name, channel.name);
    await page.waitForLoadState('networkidle');

    // # Wait for wiki tab to be visible
    const wikiTab = getWikiTab(page, wikiName);
    await wikiTab.waitFor({state: 'visible', timeout: 5000});

    await openWikiTabMenu(page, wikiName);
    await clickWikiTabMenuItem(page, 'wiki-tab-delete');

    const confirmModal = page.getByRole('dialog');
    await confirmModal.getByRole('button', {name: /delete|yes/i}).click();
    await confirmModal.waitFor({state: 'hidden', timeout: 5000});

    // * Verify wiki tab removed
    await expect(wikiTab).not.toBeVisible({timeout: 3000});

    // # Try to navigate directly to child page URL
    await page.goto(childUrl);
    await page.waitForLoadState('networkidle');

    // * Wait for redirect or error to appear (redirect happens in React after page load)
    await page.waitForTimeout(1000);

    // * Verify child page is not accessible (404, error, or redirect)
    const errorLocator = page.locator('text=/not found|error|doesn\'t exist/i');
    const isRedirected = page.url().includes('/channels/' + channel.name) || !page.url().includes('/wiki/');

    // Either we see an error message or we're redirected away from wiki
    if (!isRedirected) {
        await expect(errorLocator).toBeVisible({timeout: 1000});
    } else {
        expect(isRedirected).toBeTruthy();
    }
});

/**
 * Helper function to extract wiki ID from a wiki tab
 */
async function getWikiIdFromTab(page: any, wikiName: string): Promise<string | null> {
    const wikiTab = getWikiTab(page, wikiName);
    const testId = await wikiTab.getAttribute('data-testid').catch(() => null);
    if (testId) {
        const match = testId.match(/wiki-tab-(.+)/);
        return match ? match[1] : null;
    }
    return null;
}

/**
 * @objective Verify wiki can be moved to another channel in the same team
 *
 * @precondition
 * Two channels must exist in the same team
 */
test('moves wiki to another channel through wiki tab menu', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const sourceChannel = await createTestChannel(adminClient, team.id, `Source Channel ${pw.random.id()}`);
    const targetChannel = await createTestChannel(adminClient, team.id, `Target Channel ${pw.random.id()}`);

    // # Add user to both channels so they appear in the move dropdown
    await adminClient.addToChannel(user.id, sourceChannel.id);
    await adminClient.addToChannel(user.id, targetChannel.id);

    const {page, channelsPage} = await pw.testBrowser.login(user);

    // # Navigate to source channel
    await channelsPage.goto(team.name, sourceChannel.name);

    const wikiName = `Wiki to Move ${pw.random.id()}`;

    // # Create wiki in source channel
    await createWikiThroughUI(page, wikiName);

    // * Verify wiki created
    await expect(page).toHaveURL(/\/wiki\/[^/]+\/[^/]+/);

    // # Navigate back to source channel
    await channelsPage.goto(team.name, sourceChannel.name);
    await page.waitForLoadState('networkidle');

    // # Wait for wiki tab to be visible in source channel
    const sourceWikiTab = getWikiTab(page, wikiName);
    await sourceWikiTab.waitFor({state: 'visible', timeout: 5000});

    // # Open wiki tab menu
    await openWikiTabMenu(page, wikiName);

    // # Click "Move wiki" in the dropdown menu
    await clickWikiTabMenuItem(page, 'wiki-tab-move');

    // # Wait for move modal to appear
    const moveModal = page.getByRole('dialog');
    await moveModal.waitFor({state: 'visible', timeout: 3000});

    // # Wait for channel select to be populated with options
    const channelSelect = moveModal.locator('#target-channel-select');
    await channelSelect.waitFor({state: 'visible', timeout: 3000});

    // # Wait for at least 2 options (placeholder + target channel)
    await page.waitForFunction(
        (selectId) => {
            const select = document.querySelector(`#${selectId}`) as HTMLSelectElement;
            return select && select.options.length > 1;
        },
        'target-channel-select',
        {timeout: 5000},
    );

    // # Select target channel from dropdown by value
    await channelSelect.selectOption({value: targetChannel.id});

    // # Click Move Wiki button
    const moveButton = moveModal.getByRole('button', {name: /move wiki/i});
    await moveButton.click();

    // # Wait for modal to close
    await moveModal.waitFor({state: 'hidden', timeout: 5000});

    // # Wait for network requests to complete after wiki move
    await page.waitForLoadState('networkidle');

    // * Verify wiki tab no longer exists in source channel
    await expect(sourceWikiTab).not.toBeVisible({timeout: 5000});

    // * Verify wiki tab count is zero in source channel (explicit count check)
    const sourceWikiTabs = getAllWikiTabs(page);
    await expect(sourceWikiTabs).toHaveCount(0, {timeout: 5000});

    // # Navigate to target channel
    await channelsPage.goto(team.name, targetChannel.name);
    await page.waitForLoadState('networkidle');

    // * Verify wiki tab now appears in target channel
    const targetWikiTab = getWikiTab(page, wikiName);
    await expect(targetWikiTab).toBeVisible({timeout: 5000});

    // * Verify wiki tab count is exactly one in target channel (explicit count check)
    const targetWikiTabs = getAllWikiTabs(page);
    await expect(targetWikiTabs).toHaveCount(1, {timeout: 5000});

    // # Click on wiki tab to open it
    await targetWikiTab.click();

    // * Verify navigated to wiki view
    await expect(page).toHaveURL(/\/wiki\/[^/]+\/[^/]+/);

    // * Verify wiki loads successfully
    await waitForWikiViewLoad(page);
});
