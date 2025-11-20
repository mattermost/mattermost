// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';

import {
    createPageThroughUI,
    createTestChannel,
    createWikiThroughUI,
    editPageThroughUI,
    ensurePanelOpen,
    getPageTreeNodeByTitle,
    getVersionHistoryItems,
    getVersionHistoryModal,
    openVersionHistoryModal,
    verifyVersionHistoryModal,
} from './test_helpers';

/**
 * @objective Verify page version history tracks edits and displays historical versions
 */
test('shows page version history after multiple edits', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki and page through UI
    await createWikiThroughUI(page, `History Wiki ${pw.random.id()}`);
    await createPageThroughUI(page, 'Version Test Page', 'Original content v1');

    // # Make first edit
    await editPageThroughUI(page, '\n\nEdited content v2');
    await page.waitForTimeout(2000); // Wait for Redux store to update

    // # Make second edit
    await editPageThroughUI(page, '\n\nFinal content v3');
    await page.waitForTimeout(2000); // Wait for Redux store to update

    // # Wait for page to be updated in Redux store (visible in tree)
    const pageNode = getPageTreeNodeByTitle(page, 'Version Test Page');
    await pageNode.waitFor({state: 'visible', timeout: 5000});

    // # Additional wait to ensure Redux state is fully updated after edits
    await page.waitForTimeout(1000);

    // # Open version history modal
    await openVersionHistoryModal(page, 'Version Test Page');

    // * Verify version history modal displays correctly (2 historical versions, current version excluded)
    await verifyVersionHistoryModal(page, 'Version Test Page', 2);
});

/**
 * @objective Verify non-author users can view version history of pages
 */
test('allows non-author to view page version history', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    // # User 1 creates page
    const {page: page1, channelsPage: channelsPage1} = await pw.testBrowser.login(user);
    await channelsPage1.goto(team.name, channel.name);

    const wiki = await createWikiThroughUI(page1, `Shared Wiki ${pw.random.id()}`);
    const createdPage = await createPageThroughUI(page1, 'Shared Page', 'Content by user 1');

    // # Edit page to create version history
    await editPageThroughUI(page1, '\n\nEdited by user 1');
    await page1.waitForTimeout(1500); // Wait for auto-save

    // # User 2 (non-author) opens the same wiki and page
    const user2 = pw.random.user('user2');
    const {id: user2Id} = await adminClient.createUser(user2, '', '');
    await adminClient.addToTeam(team.id, user2Id);
    await adminClient.addToChannel(user2Id, channel.id);

    // Close user1 page after user2 is set up
    await page1.close();

    const {page: page2} = await pw.testBrowser.login(user2);

    // # Navigate directly to the wiki page URL
    const wikiPageUrl = `${pw.url}/${team.name}/wiki/${channel.id}/${wiki.id}/${createdPage.id}`;
    await page2.goto(wikiPageUrl);
    await page2.waitForLoadState('networkidle');

    // # Wait for wiki view to load first
    await page2.waitForSelector('[data-testid="wiki-view"]', {state: 'visible', timeout: 15000});

    // # Ensure hierarchy panel is open
    await ensurePanelOpen(page2);

    // # Open version history as non-author
    await openVersionHistoryModal(page2, 'Shared Page');

    // * Verify non-author can see version history (1 historical version, current version excluded)
    const versionModal = getVersionHistoryModal(page2);
    await expect(versionModal).toBeVisible();

    const historyItems = getVersionHistoryItems(page2);
    await expect(historyItems).toHaveCount(1, {timeout: 5000});
});

/**
 * @objective Verify page version history limits to 10 versions
 */
test('enforces 10-version limit in page history', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki and page through UI
    await createWikiThroughUI(page, `Version Limit Wiki ${pw.random.id()}`);
    await createPageThroughUI(page, 'Version Limit Test', 'Original version');

    // # Make 14 edits (total 15 versions including original)
    for (let i = 1; i <= 14; i++) {
        await editPageThroughUI(page, `\n\nEdit ${i}`);
        await page.waitForTimeout(500); // Small delay between edits
    }

    // # Wait for all edits to be saved
    await page.waitForTimeout(2000);

    // # Open version history modal
    await openVersionHistoryModal(page, 'Version Limit Test');

    // * Verify only 10 versions are displayed (not all 15)
    const versionModal = getVersionHistoryModal(page);
    await expect(versionModal).toBeVisible();

    const historyItems = getVersionHistoryItems(page);
    await expect(historyItems).toHaveCount(10, {timeout: 5000});
});

/**
 * @objective Verify version history modal displays edit timestamps and authors
 *
 * @precondition
 * Version history shows when edits were made but does not yet support full content restoration
 */
test('views version history modal with edit timestamps', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki and page through UI
    await createWikiThroughUI(page, `Version History Wiki ${pw.random.id()}`);
    await createPageThroughUI(page, 'Version History Page', 'Version 1 content');

    // # Make first edit
    await editPageThroughUI(page, '\n\nVersion 2 content');
    await page.waitForTimeout(2000); // Wait for Redux store to update

    // # Make second edit
    await editPageThroughUI(page, '\n\nVersion 3 content');
    await page.waitForTimeout(2000); // Wait for Redux store to update

    // # Wait for page to be updated in Redux store (visible in tree)
    const pageNode = getPageTreeNodeByTitle(page, 'Version History Page');
    await pageNode.waitFor({state: 'visible', timeout: 5000});

    // # Additional wait to ensure Redux state is fully updated after edits
    await page.waitForTimeout(1000);

    // # Open version history modal
    await openVersionHistoryModal(page, 'Version History Page');

    // * Verify version history modal displays correctly (2 historical versions, current version excluded)
    await verifyVersionHistoryModal(page, 'Version History Page', 2);
});
