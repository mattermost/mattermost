// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';

import {createWikiThroughUI, createTestChannel, createPageThroughUI, createChildPageThroughContextMenu, waitForPageInHierarchy, getWikiTab, openWikiTabMenu, clickWikiTabMenuItem, waitForWikiViewLoad} from './test_helpers';

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
    await expect(page).toHaveURL(/\/wiki\/[^/]+\/[^/]+/);

    // # Navigate back to channel
    await channelsPage.goto(team.name, channel.name);
    await page.waitForLoadState('networkidle');

    // # Wait for wiki tab to be visible
    const wikiTab = getWikiTab(page, originalWikiName);
    await wikiTab.waitFor({state: 'visible', timeout: 5000});

    // # Open wiki tab menu
    await openWikiTabMenu(page, originalWikiName);

    // # Click "Rename" in the dropdown menu
    await clickWikiTabMenuItem(page, 'wiki-tab-rename');

    // # Wait for rename modal to appear
    const renameModal = page.getByRole('dialog');
    await renameModal.waitFor({state: 'visible', timeout: 3000});

    // # Find the title input field
    const titleInput = renameModal.locator('#text-input-modal-input');

    // # Clear and type new wiki name
    await titleInput.clear();
    await titleInput.fill(newWikiName);

    // # Click Rename button
    const renameButton = renameModal.getByRole('button', {name: /rename/i});
    await renameButton.click();

    // # Wait for modal to close
    await renameModal.waitFor({state: 'hidden', timeout: 5000});

    // # Give React time to re-render with updated wiki list
    await page.waitForTimeout(1000);

    // * Verify wiki tab displays new name in channel tab bar
    const updatedTab = getWikiTab(page, newWikiName);
    await expect(updatedTab).toBeVisible({timeout: 5000});

    // # Click on renamed wiki tab to open it
    await updatedTab.click();

    // * Verify navigated to wiki with updated name
    await expect(page).toHaveURL(/\/wiki\/[^/]+\/[^/]+/);

    // * Verify wiki title is updated (check browser title or header if available)
    const wikiHeader = page.locator('[data-testid="wiki-header"]').first();
    if (await wikiHeader.isVisible({timeout: 2000}).catch(() => false)) {
        await expect(wikiHeader).toContainText(newWikiName);
    }
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
    const wiki = await createWikiThroughUI(page, wikiName);

    // * Verify wiki created and navigated to wiki view
    await expect(page).toHaveURL(/\/wiki\/[^/]+\/[^/]+/);

    // # Extract wiki ID from URL for later verification
    const wikiUrl = page.url();
    const wikiIdMatch = wikiUrl.match(/\/wiki\/[^/]+\/([^/?]+)/);
    const wikiId = wikiIdMatch ? wikiIdMatch[1] : null;
    expect(wikiId).toBeTruthy();

    // # Navigate back to channel
    await channelsPage.goto(team.name, channel.name);
    await page.waitForLoadState('networkidle');

    // # Wait for wiki tab to be visible
    const wikiTab = getWikiTab(page, wikiName);
    await wikiTab.waitFor({state: 'visible', timeout: 5000});

    // # Open wiki tab menu and click delete
    await openWikiTabMenu(page, wikiName);
    await clickWikiTabMenuItem(page, 'wiki-tab-delete');

    // # Wait for delete confirmation modal
    const confirmModal = page.getByRole('dialog');
    await confirmModal.waitFor({state: 'visible', timeout: 3000});

    // * Verify confirmation modal contains wiki name
    await expect(confirmModal).toContainText(wikiName);

    // # Click Delete/Confirm button
    const confirmButton = confirmModal.getByRole('button', {name: /delete|yes/i});
    await confirmButton.click();

    // # Wait for modal to close
    await confirmModal.waitFor({state: 'hidden', timeout: 5000});

    // * Verify wiki tab is removed from channel tab bar
    await expect(wikiTab).not.toBeVisible({timeout: 5000});

    // * Verify navigated back to channel (not wiki)
    await expect(page).toHaveURL(new RegExp(`/${team.name}/channels/${channel.name}`));

    // # Try to navigate to the deleted wiki URL directly
    if (wikiId) {
        await page.goto(`/${team.name}/wiki/${channel.id}/${wikiId}`);

        // Wait for redirect to complete
        await page.waitForLoadState('networkidle');

        // * Verify wiki is no longer accessible (404 or error page)
        const is404OrError = await page.locator('text=/not found|error|doesn\'t exist/i').isVisible({timeout: 5000}).catch(() => false);
        const isRedirectedToChannel = page.url().includes(`/channels/${channel.name}`);

        expect(is404OrError || isRedirectedToChannel).toBeTruthy();
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

    // * Verify wiki header shows updated name (if header element exists)
    const wikiHeader = page.locator('[data-testid="wiki-header"]').first();
    if (await wikiHeader.isVisible({timeout: 2000}).catch(() => false)) {
        await expect(wikiHeader).toContainText(updatedName);
    }
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
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');
    const parentNode = hierarchyPanel.locator('[data-testid="page-tree-node"]').filter({hasText: 'Parent Page'}).first();
    const expandButton = parentNode.locator('[data-testid="page-tree-node-expand-button"]');

    // Check if parent has children and is collapsed (expand button visible)
    const isExpandButtonVisible = await expandButton.isVisible({timeout: 2000}).catch(() => false);
    if (isExpandButtonVisible) {
        await expandButton.click();
    }

    // # Wait for child page to become visible after expansion
    await waitForPageInHierarchy(page, 'Child Page', 10000);

    // # Navigate to child page through hierarchy panel
    const childPageNode = hierarchyPanel.getByRole('button', {name: 'Child Page', exact: true});
    await childPageNode.click();

    // * Verify navigated to child page
    await expect(childPageContent).toContainText('Child content');

    // * Verify breadcrumb navigation exists and shows page hierarchy
    const breadcrumb = page.locator('[data-testid="page-breadcrumb"]').first();
    if (await breadcrumb.isVisible({timeout: 2000}).catch(() => false)) {
        await expect(breadcrumb).toContainText('Parent Page');
        await expect(breadcrumb).toContainText('Child Page');
    }

    // # Click on parent in breadcrumb to navigate back
    const parentBreadcrumbLink = page.locator('[data-testid="breadcrumb-link"]').filter({hasText: 'Parent Page'}).first();
    if (await parentBreadcrumbLink.isVisible({timeout: 2000}).catch(() => false)) {
        await parentBreadcrumbLink.click();

        // * Verify navigated back to parent page
        await expect(childPageContent).toContainText('Parent content');
    }

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
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');
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
    const isError = await page.locator('text=/not found|error|doesn\'t exist/i').isVisible({timeout: 1000}).catch(() => false);
    const isRedirected = page.url().includes('/channels/' + channel.name) || !page.url().includes('/wiki/');

    expect(isError || isRedirected).toBeTruthy();
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
