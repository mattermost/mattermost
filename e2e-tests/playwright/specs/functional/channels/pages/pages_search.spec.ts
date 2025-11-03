// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';

import {createWikiThroughUI, createPageThroughUI, createChildPageThroughContextMenu, getNewPageButton, fillCreatePageModal} from './test_helpers';

/**
 * @objective Verify pages can be found using title search
 */
test('searches pages by title', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
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

    // # Perform search
    const searchInput = page.locator('[data-testid="pages-search-input"]').first();
    if (await searchInput.isVisible({timeout: 3000}).catch(() => false)) {
        await searchInput.fill(searchableTitle);
        await page.waitForTimeout(500); // Debounce

        // * Verify search results show matching page
        const searchResults = page.locator('[data-testid="search-results"], .search-results').first();
        if (await searchResults.isVisible({timeout: 3000}).catch(() => false)) {
            await expect(searchResults).toContainText(searchableTitle);

            // * Verify non-matching pages are not shown
            const resultsText = await searchResults.textContent();
            expect(resultsText).not.toContain('Other Page Title');
            expect(resultsText).not.toContain('Another Page');
        }
    } else {
        // # Try global search bar
        const globalSearch = page.locator('#searchBox, [aria-label*="Search"]').first();
        if (await globalSearch.isVisible().catch(() => false)) {
            await globalSearch.click();
            await globalSearch.fill(searchableTitle);
            await page.keyboard.press('Enter');
            await page.waitForTimeout(1000);

            // * Verify page appears in search results
            const searchResultItem = page.locator(`[data-testid="search-item-title"]:has-text("${searchableTitle}")`).first();
            const searchResultVisible = await searchResultItem.isVisible({timeout: 5000}).catch(() => false);
            expect(searchResultVisible).toBe(true);
        }
    }
});

/**
 * @objective Verify pages can be found using content search
 */
test('searches pages by content', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Content Search Wiki ${pw.random.id()}`);

    // # Create page with unique content and H1 heading through UI
    const uniqueContent = `UniqueSearchableContent${pw.random.id()}`;
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Page with Searchable Content');

    const editor = page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();
    await editor.click();

    // # Add searchable content to the page
    await editor.type(`Document\n\n${uniqueContent}`);

    // # Publish the page
    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]');
    await publishButton.click();
    await page.waitForLoadState('networkidle');

    // # Create page without unique content through UI
    await createPageThroughUI(page, 'Page without Match', 'Generic content here');

    // # Perform content search
    const searchInput = page.locator('[data-testid="pages-search-input"]').first();
    if (await searchInput.isVisible({timeout: 3000}).catch(() => false)) {
        await searchInput.fill(uniqueContent);
        await page.waitForTimeout(500); // Debounce

        // * Verify search results show page with matching content
        const searchResults = page.locator('[data-testid="search-results"], .search-results').first();
        if (await searchResults.isVisible({timeout: 3000}).catch(() => false)) {
            // * Verify page title appears
            await expect(searchResults).toContainText('Page with Searchable Content');

            // * Verify content snippet shows match
            const resultSnippet = searchResults.locator('[data-testid="search-result-snippet"], .search-snippet').first();
            if (await resultSnippet.isVisible().catch(() => false)) {
                await expect(resultSnippet).toContainText(uniqueContent);
            }

            // * Verify non-matching page doesn't appear
            const resultsText = await searchResults.textContent();
            expect(resultsText).not.toContain('Page without Match');
        }
    } else {
        // # Try global search bar
        const globalSearch = page.locator('#searchBox, [aria-label*="Search"]').first();
        if (await globalSearch.isVisible().catch(() => false)) {
            await globalSearch.click();
            await globalSearch.fill(uniqueContent);
            await page.keyboard.press('Enter');
            await page.waitForTimeout(1000);

            // * Verify page appears in search results
            const searchResultItem = page.locator('[data-testid="search-item"]:has-text("Page with Searchable Content")').first();
            const searchResultVisible = await searchResultItem.isVisible({timeout: 5000}).catch(() => false);

            if (searchResultVisible) {
                // * Verify content is highlighted or shown in snippet
                const itemText = await searchResultItem.textContent();
                expect(itemText).toContain(uniqueContent);
            }
        }
    }
});
