// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Tests for verifying that all wiki/pages modals can be reopened after being closed.
 * This is a regression test suite for the modal reopening bug where modals would
 * only open once and then fail to open again.
 */

import {expect, test} from './pages_test_fixture';
import {
    createWikiThroughUI,
    createPageThroughUI,
    createTestChannel,
    ensurePanelOpen,
    getHierarchyPanel,
    getNewPageButton,
    getPageActionsMenuLocator,
    openMovePageModal,
    openWikiTabMenu,
    clickWikiTabMenuItem,
    EDITOR_LOAD_WAIT,
    ELEMENT_TIMEOUT,
} from './test_helpers';

/**
 * Helper to open page context menu for a specific page
 */
async function openPageContextMenu(page: import('@playwright/test').Page, pageTitle: string) {
    const hierarchyPanel = getHierarchyPanel(page);
    const pageNode = hierarchyPanel.locator('[data-testid="page-tree-node"]').filter({hasText: pageTitle}).first();
    await pageNode.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    await pageNode.hover();
    const menuButton = pageNode.locator('[data-testid="page-tree-node-menu-button"]').first();
    await menuButton.click();
    const contextMenu = getPageActionsMenuLocator(page);
    await expect(contextMenu).toBeVisible({timeout: ELEMENT_TIMEOUT});
    return contextMenu;
}

test.describe('Wiki/Pages Modal Reopening', () => {
    /**
     * @objective Verify Move Page modal can be opened, cancelled, and reopened
     */
    test('Move Page modal can be reopened after cancel', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await createTestChannel(adminClient, team.id, `Modal Test ${await pw.random.id()}`);

        const {page, channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        await createWikiThroughUI(page, `Test Wiki ${await pw.random.id()}`);
        await createPageThroughUI(page, 'Test Page', 'Test content');
        await page.waitForTimeout(EDITOR_LOAD_WAIT);
        await ensurePanelOpen(page);

        // First open
        let moveModal = await openMovePageModal(page, 'Test Page');
        await expect(moveModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // Cancel
        const cancelButton = moveModal.getByRole('button', {name: 'Cancel'});
        await cancelButton.click();
        await expect(moveModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

        // Second open - this was failing before the fix
        moveModal = await openMovePageModal(page, 'Test Page');
        await expect(moveModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // Cancel again
        await moveModal.getByRole('button', {name: 'Cancel'}).click();
        await expect(moveModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});
    });

    /**
     * @objective Verify Delete Page modal can be opened, cancelled, and reopened
     */
    test('Delete Page modal can be reopened after cancel', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await createTestChannel(adminClient, team.id, `Modal Test ${await pw.random.id()}`);

        const {page, channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        await createWikiThroughUI(page, `Test Wiki ${await pw.random.id()}`);
        await createPageThroughUI(page, 'Page To Delete', 'Content');
        await page.waitForTimeout(EDITOR_LOAD_WAIT);
        await ensurePanelOpen(page);

        // First open
        let contextMenu = await openPageContextMenu(page, 'Page To Delete');
        await contextMenu.locator('[data-testid="page-context-menu-delete"]').click();
        let deleteModal = page.getByRole('dialog', {name: /Delete/i});
        await expect(deleteModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // Cancel via close button or cancel button
        const closeButton = deleteModal.locator('button[aria-label="Close"], button:has-text("Cancel")').first();
        await closeButton.click();
        await expect(deleteModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

        // Second open
        contextMenu = await openPageContextMenu(page, 'Page To Delete');
        await contextMenu.locator('[data-testid="page-context-menu-delete"]').click();
        deleteModal = page.getByRole('dialog', {name: /Delete/i});
        await expect(deleteModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // Cancel again
        await deleteModal.locator('button[aria-label="Close"], button:has-text("Cancel")').first().click();
        await expect(deleteModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});
    });

    /**
     * @objective Verify Rename Page modal can be opened, cancelled, and reopened
     */
    test('Rename Page modal can be reopened after cancel', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await createTestChannel(adminClient, team.id, `Modal Test ${await pw.random.id()}`);

        const {page, channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        await createWikiThroughUI(page, `Test Wiki ${await pw.random.id()}`);
        await createPageThroughUI(page, 'Page To Rename', 'Content');
        await page.waitForTimeout(EDITOR_LOAD_WAIT);
        await ensurePanelOpen(page);

        // First open
        let contextMenu = await openPageContextMenu(page, 'Page To Rename');
        await contextMenu.locator('[data-testid="page-context-menu-rename"]').click();
        let renameModal = page.getByRole('dialog', {name: /Rename/i});
        await expect(renameModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // Cancel
        const cancelButton = renameModal.locator('button:has-text("Cancel")').first();
        await cancelButton.click();
        await expect(renameModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

        // Second open
        contextMenu = await openPageContextMenu(page, 'Page To Rename');
        await contextMenu.locator('[data-testid="page-context-menu-rename"]').click();
        renameModal = page.getByRole('dialog', {name: /Rename/i});
        await expect(renameModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // Cancel again
        await renameModal.locator('button:has-text("Cancel")').first().click();
        await expect(renameModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});
    });

    /**
     * @objective Verify Create Page modal can be opened, cancelled, and reopened
     */
    test('Create Page modal can be reopened after cancel', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await createTestChannel(adminClient, team.id, `Modal Test ${await pw.random.id()}`);

        const {page, channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        await createWikiThroughUI(page, `Test Wiki ${await pw.random.id()}`);
        await page.waitForTimeout(EDITOR_LOAD_WAIT);
        await ensurePanelOpen(page);

        // First open - via New Page button in pages panel
        const newPageButton = getNewPageButton(page);
        await newPageButton.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
        await newPageButton.click();
        let createModal = page.getByRole('dialog', {name: /Create|New Page/i});
        await expect(createModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // Cancel
        const cancelButton = createModal.locator('button:has-text("Cancel")').first();
        await cancelButton.click();
        await expect(createModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

        // Second open
        await newPageButton.click();
        createModal = page.getByRole('dialog', {name: /Create|New Page/i});
        await expect(createModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // Cancel again
        await createModal.locator('button:has-text("Cancel")').first().click();
        await expect(createModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});
    });

    /**
     * @objective Verify Version History modal can be opened, closed, and reopened
     */
    test('Version History modal can be reopened after close', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await createTestChannel(adminClient, team.id, `Modal Test ${await pw.random.id()}`);

        const {page, channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        await createWikiThroughUI(page, `Test Wiki ${await pw.random.id()}`);
        await createPageThroughUI(page, 'Page With History', 'Content');
        await page.waitForTimeout(EDITOR_LOAD_WAIT);
        await ensurePanelOpen(page);

        // First open
        let contextMenu = await openPageContextMenu(page, 'Page With History');
        const versionHistoryItem = contextMenu.locator('[data-testid="page-context-menu-version-history"]');

        // Skip if version history not available (e.g., for drafts)
        if ((await versionHistoryItem.count()) === 0) {
            test.skip();
            return;
        }

        await versionHistoryItem.click();
        let versionModal = page.locator('.page-version-history-modal, [data-testid="version-history-modal"]').first();
        await expect(versionModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // Close
        const closeButton = versionModal.locator('button[aria-label="Close"], .close-button').first();
        await closeButton.click();
        await expect(versionModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

        // Second open
        contextMenu = await openPageContextMenu(page, 'Page With History');
        await contextMenu.locator('[data-testid="page-context-menu-version-history"]').click();
        versionModal = page.locator('.page-version-history-modal, [data-testid="version-history-modal"]').first();
        await expect(versionModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // Close again
        await versionModal.locator('button[aria-label="Close"], .close-button').first().click();
        await expect(versionModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});
    });

    /**
     * @objective Verify Wiki Rename modal can be opened, cancelled, and reopened
     */
    test('Wiki Rename modal can be reopened after cancel', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await createTestChannel(adminClient, team.id, `Modal Test ${await pw.random.id()}`);

        const {page, channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        const wikiName = `Wiki To Rename ${await pw.random.id()}`;
        await createWikiThroughUI(page, wikiName);
        await page.waitForTimeout(EDITOR_LOAD_WAIT);

        // First open
        await openWikiTabMenu(page, wikiName);
        await clickWikiTabMenuItem(page, 'wiki-tab-rename');
        let renameModal = page.getByRole('dialog', {name: /Rename/i});
        await expect(renameModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // Cancel
        await renameModal.locator('button:has-text("Cancel")').first().click();
        await expect(renameModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

        // Second open
        await openWikiTabMenu(page, wikiName);
        await clickWikiTabMenuItem(page, 'wiki-tab-rename');
        renameModal = page.getByRole('dialog', {name: /Rename/i});
        await expect(renameModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // Cancel again
        await renameModal.locator('button:has-text("Cancel")').first().click();
        await expect(renameModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});
    });

    /**
     * @objective Verify Wiki Delete modal can be opened, cancelled, and reopened
     */
    test('Wiki Delete modal can be reopened after cancel', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await createTestChannel(adminClient, team.id, `Modal Test ${await pw.random.id()}`);

        const {page, channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        const wikiName = `Wiki To Delete ${await pw.random.id()}`;
        await createWikiThroughUI(page, wikiName);
        await page.waitForTimeout(EDITOR_LOAD_WAIT);

        // First open
        await openWikiTabMenu(page, wikiName);
        await clickWikiTabMenuItem(page, 'wiki-tab-delete');
        let deleteModal = page.getByRole('dialog', {name: /Delete/i});
        await expect(deleteModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // Cancel
        await deleteModal.locator('button:has-text("Cancel")').first().click();
        await expect(deleteModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

        // Second open
        await openWikiTabMenu(page, wikiName);
        await clickWikiTabMenuItem(page, 'wiki-tab-delete');
        deleteModal = page.getByRole('dialog', {name: /Delete/i});
        await expect(deleteModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // Cancel again
        await deleteModal.locator('button:has-text("Cancel")').first().click();
        await expect(deleteModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});
    });

    /**
     * @objective Verify Wiki Move modal can be opened, cancelled, and reopened
     */
    test('Wiki Move modal can be reopened after cancel', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await createTestChannel(adminClient, team.id, `Modal Test ${await pw.random.id()}`);

        const {page, channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        const wikiName = `Wiki To Move ${await pw.random.id()}`;
        await createWikiThroughUI(page, wikiName);
        await page.waitForTimeout(EDITOR_LOAD_WAIT);

        // First open - try to open wiki menu and click move
        await openWikiTabMenu(page, wikiName);

        // Check if move option is available
        const moveItem = page.locator('#wiki-tab-move');
        if ((await moveItem.count()) === 0) {
            test.skip();
            return;
        }

        await clickWikiTabMenuItem(page, 'wiki-tab-move');
        let moveModal = page.getByRole('dialog', {name: /Move/i});
        await expect(moveModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // Cancel
        await moveModal.locator('button:has-text("Cancel")').first().click();
        await expect(moveModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

        // Second open
        await openWikiTabMenu(page, wikiName);
        await clickWikiTabMenuItem(page, 'wiki-tab-move');
        moveModal = page.getByRole('dialog', {name: /Move/i});
        await expect(moveModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // Cancel again
        await moveModal.locator('button:has-text("Cancel")').first().click();
        await expect(moveModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});
    });

    /**
     * @objective Verify Create Child Page modal can be opened, cancelled, and reopened
     */
    test('Create Child Page modal can be reopened after cancel', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await createTestChannel(adminClient, team.id, `Modal Test ${await pw.random.id()}`);

        const {page, channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        await createWikiThroughUI(page, `Test Wiki ${await pw.random.id()}`);
        await createPageThroughUI(page, 'Parent Page', 'Content');
        await page.waitForTimeout(EDITOR_LOAD_WAIT);
        await ensurePanelOpen(page);

        // First open
        let contextMenu = await openPageContextMenu(page, 'Parent Page');
        await contextMenu.locator('[data-testid="page-context-menu-new-child"]').click();
        let createModal = page.getByRole('dialog', {name: /Create/i});
        await expect(createModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // Cancel
        await createModal.locator('button:has-text("Cancel")').first().click();
        await expect(createModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

        // Second open
        contextMenu = await openPageContextMenu(page, 'Parent Page');
        await contextMenu.locator('[data-testid="page-context-menu-new-child"]').click();
        createModal = page.getByRole('dialog', {name: /Create/i});
        await expect(createModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // Cancel again
        await createModal.locator('button:has-text("Cancel")').first().click();
        await expect(createModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});
    });

    /**
     * @objective Verify multiple different modals can be opened in sequence
     */
    test('multiple different modals can be opened in sequence', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await createTestChannel(adminClient, team.id, `Modal Test ${await pw.random.id()}`);

        const {page, channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        await createWikiThroughUI(page, `Test Wiki ${await pw.random.id()}`);
        await createPageThroughUI(page, 'Multi Modal Test', 'Content');
        await page.waitForTimeout(EDITOR_LOAD_WAIT);
        await ensurePanelOpen(page);

        // Open Move modal, cancel
        const moveModal = await openMovePageModal(page, 'Multi Modal Test');
        await expect(moveModal).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await moveModal.getByRole('button', {name: 'Cancel'}).click();
        await expect(moveModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

        // Open Rename modal, cancel
        let contextMenu = await openPageContextMenu(page, 'Multi Modal Test');
        await contextMenu.locator('[data-testid="page-context-menu-rename"]').click();
        const renameModal = page.getByRole('dialog', {name: /Rename/i});
        await expect(renameModal).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await renameModal.locator('button:has-text("Cancel")').first().click();
        await expect(renameModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

        // Open Delete modal, cancel
        contextMenu = await openPageContextMenu(page, 'Multi Modal Test');
        await contextMenu.locator('[data-testid="page-context-menu-delete"]').click();
        const deleteModal = page.getByRole('dialog', {name: /Delete/i});
        await expect(deleteModal).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await deleteModal.locator('button[aria-label="Close"], button:has-text("Cancel")').first().click();
        await expect(deleteModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

        // Now open Move modal again - verifies no cross-modal interference
        const moveModal2 = await openMovePageModal(page, 'Multi Modal Test');
        await expect(moveModal2).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await moveModal2.getByRole('button', {name: 'Cancel'}).click();
        await expect(moveModal2).not.toBeVisible({timeout: ELEMENT_TIMEOUT});
    });
});
