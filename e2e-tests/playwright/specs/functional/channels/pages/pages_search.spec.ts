// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';

import {createWikiThroughUI, createPageThroughUI, createChildPageThroughContextMenu, getNewPageButton, fillCreatePageModal, publishCurrentPage, getEditorAndWait, typeInEditor, SHORT_WAIT, EDITOR_LOAD_WAIT, ELEMENT_TIMEOUT} from './test_helpers';

/**
 * @objective Verify pages can be found using wiki tree panel search by title
 */
test('searches pages by title in wiki tree panel', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Search Wiki ${pw.random.id()}`);

    // # Create multiple pages with different titles through UI
    const searchableTitle = `UniqueSearchableTitle${pw.random.id()}`;
    await createPageThroughUI(page, searchableTitle, 'Some content');
    await createPageThroughUI(page, 'Other Page Title', 'Different content');
    await createPageThroughUI(page, 'Another Page', 'More content');

    // # Perform search in wiki tree panel
    const searchInput = page.locator('[data-testid="pages-search-input"]').first();
    await expect(searchInput).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await searchInput.fill(searchableTitle);
    await page.waitForTimeout(SHORT_WAIT); // Debounce

    // * Verify filtered tree shows matching page
    const treeContainer = page.locator('[data-testid="pages-hierarchy-tree"]').first();
    await expect(treeContainer).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await expect(treeContainer).toContainText(searchableTitle);

    // * Verify non-matching pages are not shown in filtered tree
    const resultsText = await treeContainer.textContent();
    expect(resultsText).not.toContain('Other Page Title');
    expect(resultsText).not.toContain('Another Page');
});

/**
 * @objective Verify wiki tree panel search only filters by title, not content
 * @note Wiki tree panel search is designed to filter the page hierarchy by title only.
 * For content search, users should use the global Mattermost search.
 */
test('wiki tree panel search filters by title only', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Tree Filter Wiki ${pw.random.id()}`);

    // # Create page with specific title and different content
    const pageTitle = 'Engineering Documentation';
    const uniqueContent = `UniqueInternalContent${pw.random.id()}`;
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, pageTitle);

    const editor = await getEditorAndWait(page);
    await editor.click();
    await page.keyboard.type(`Document\n\n${uniqueContent}`);

    // # Publish the page
    await publishCurrentPage(page);

    // # Create another page
    await createPageThroughUI(page, 'Marketing Plans', 'Different content');

    // # Search by title - should find the page
    const searchInput = page.locator('[data-testid="pages-search-input"]').first();
    await expect(searchInput).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await searchInput.fill('Engineering');
    await page.waitForTimeout(SHORT_WAIT); // Debounce

    const treeContainer = page.locator('[data-testid="pages-hierarchy-tree"]').first();
    await expect(treeContainer).toBeVisible({timeout: ELEMENT_TIMEOUT});
    // * Verify page found by title
    await expect(treeContainer).toContainText('Engineering Documentation');

    // # Clear and search by content - should NOT find the page (tree search is title-only)
    await searchInput.clear();
    await searchInput.fill(uniqueContent);
    await page.waitForTimeout(SHORT_WAIT); // Debounce

    // * Verify no pages found (content not searchable in tree panel)
    await expect(treeContainer).toContainText('No pages found');
});

/**
 * @objective Verify pages can be found using global Mattermost search by title
 */
test('searches pages by title using global search', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Global Search Wiki ${pw.random.id()}`);

    // # Create page with unique title through UI
    const searchableTitle = `GlobalSearchableTitle${pw.random.id()}`;
    await createPageThroughUI(page, searchableTitle, 'Test content for global search');

    // # Wait for page to be indexed (pages need to be saved to PageContents for search)
    await page.waitForTimeout(EDITOR_LOAD_WAIT);

    // # Perform global search
    await channelsPage.globalHeader.openSearch();
    const {searchInput} = channelsPage.searchBox;
    await searchInput.fill(searchableTitle);
    await searchInput.press('Enter');

    // # Wait for search results to appear in RHS
    await page.waitForTimeout(EDITOR_LOAD_WAIT);
    await channelsPage.sidebarRight.toBeVisible();

    // * Verify search results contain the page title
    await channelsPage.sidebarRight.toContainText(searchableTitle);
});

/**
 * @objective Verify pages can be found using global Mattermost search by content
 */
test('searches pages by content using global search', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Content Global Search Wiki ${pw.random.id()}`);

    // # Create page with unique content through UI
    const uniqueContent = `GlobalSearchContent${pw.random.id()}`;
    const pageTitle = 'Page for Global Content Search';
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, pageTitle);

    const editor = await getEditorAndWait(page);
    await editor.click();
    await page.keyboard.type(`Test Document\n\n${uniqueContent}`);

    // # Publish the page
    await publishCurrentPage(page);

    // # Wait for page to be indexed
    await page.waitForTimeout(EDITOR_LOAD_WAIT);

    // # Perform global search for content
    await channelsPage.globalHeader.openSearch();
    const {searchInput} = channelsPage.searchBox;
    await searchInput.fill(uniqueContent);
    await searchInput.press('Enter');

    // # Wait for search results to appear in RHS
    await page.waitForTimeout(EDITOR_LOAD_WAIT);
    await channelsPage.sidebarRight.toBeVisible();

    // * Verify search results contain the page title and content preview
    await channelsPage.sidebarRight.toContainText(pageTitle);
    await channelsPage.sidebarRight.toContainText(uniqueContent);
});
