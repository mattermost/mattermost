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

        // # Create wiki and page through UI
        await createWikiThroughUI(page, `Test Wiki ${await pw.random.id()}`);
        await createPageThroughUI(page, 'Test Page', 'Test content');
        await page.waitForTimeout(EDITOR_LOAD_WAIT);
        await ensurePanelOpen(page);

        // # Open Move Page modal for the first time
        let moveModal = await openMovePageModal(page, 'Test Page');

        // * Verify Move modal is visible
        await expect(moveModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Cancel the modal
        const cancelButton = moveModal.getByRole('button', {name: 'Cancel'});
        await cancelButton.click();

        // * Verify modal is closed
        await expect(moveModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Open Move Page modal again
        moveModal = await openMovePageModal(page, 'Test Page');

        // * Verify modal can be reopened after cancel
        await expect(moveModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Cancel the modal again
        await moveModal.getByRole('button', {name: 'Cancel'}).click();

        // * Verify modal is closed
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

        // # Create wiki and page through UI
        await createWikiThroughUI(page, `Test Wiki ${await pw.random.id()}`);
        await createPageThroughUI(page, 'Page To Delete', 'Content');
        await page.waitForTimeout(EDITOR_LOAD_WAIT);
        await ensurePanelOpen(page);

        // # Open page context menu and click delete
        let contextMenu = await openPageContextMenu(page, 'Page To Delete');
        await contextMenu.locator('[data-testid="page-context-menu-delete"]').click();
        let deleteModal = page.getByRole('dialog', {name: /Delete/i});

        // * Verify Delete modal is visible
        await expect(deleteModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Cancel the modal via close or cancel button
        const closeButton = deleteModal.locator('button[aria-label="Close"], button:has-text("Cancel")').first();
        await closeButton.click();

        // * Verify modal is closed
        await expect(deleteModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Open page context menu and click delete again
        contextMenu = await openPageContextMenu(page, 'Page To Delete');
        await contextMenu.locator('[data-testid="page-context-menu-delete"]').click();
        deleteModal = page.getByRole('dialog', {name: /Delete/i});

        // * Verify modal can be reopened after cancel
        await expect(deleteModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Cancel the modal again
        await deleteModal.locator('button[aria-label="Close"], button:has-text("Cancel")').first().click();

        // * Verify modal is closed
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

        // # Create wiki and page through UI
        await createWikiThroughUI(page, `Test Wiki ${await pw.random.id()}`);
        await createPageThroughUI(page, 'Page To Rename', 'Content');
        await page.waitForTimeout(EDITOR_LOAD_WAIT);
        await ensurePanelOpen(page);

        // # Open page context menu and click rename
        let contextMenu = await openPageContextMenu(page, 'Page To Rename');
        await contextMenu.locator('[data-testid="page-context-menu-rename"]').click();
        let renameModal = page.getByRole('dialog', {name: /Rename/i});

        // * Verify Rename modal is visible
        await expect(renameModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Cancel the modal
        const cancelButton = renameModal.locator('button:has-text("Cancel")').first();
        await cancelButton.click();

        // * Verify modal is closed
        await expect(renameModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Open page context menu and click rename again
        contextMenu = await openPageContextMenu(page, 'Page To Rename');
        await contextMenu.locator('[data-testid="page-context-menu-rename"]').click();
        renameModal = page.getByRole('dialog', {name: /Rename/i});

        // * Verify modal can be reopened after cancel
        await expect(renameModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Cancel the modal again
        await renameModal.locator('button:has-text("Cancel")').first().click();

        // * Verify modal is closed
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

        // # Create wiki through UI
        await createWikiThroughUI(page, `Test Wiki ${await pw.random.id()}`);
        await page.waitForTimeout(EDITOR_LOAD_WAIT);
        await ensurePanelOpen(page);

        // # Click New Page button to open Create modal
        const newPageButton = getNewPageButton(page);
        await newPageButton.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
        await newPageButton.click();
        let createModal = page.getByRole('dialog', {name: /Create|New Page/i});

        // * Verify Create modal is visible
        await expect(createModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Cancel the modal
        const cancelButton = createModal.locator('button:has-text("Cancel")').first();
        await cancelButton.click();

        // * Verify modal is closed
        await expect(createModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Click New Page button again
        await newPageButton.click();
        createModal = page.getByRole('dialog', {name: /Create|New Page/i});

        // * Verify modal can be reopened after cancel
        await expect(createModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Cancel the modal again
        await createModal.locator('button:has-text("Cancel")').first().click();

        // * Verify modal is closed
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

        // # Create wiki and page through UI
        await createWikiThroughUI(page, `Test Wiki ${await pw.random.id()}`);
        await createPageThroughUI(page, 'Page With History', 'Content');
        await page.waitForTimeout(EDITOR_LOAD_WAIT);
        await ensurePanelOpen(page);

        // # Open page context menu and check for version history option
        let contextMenu = await openPageContextMenu(page, 'Page With History');
        const versionHistoryItem = contextMenu.locator('[data-testid="page-context-menu-version-history"]');

        // Skip if version history not available (e.g., for drafts)
        if ((await versionHistoryItem.count()) === 0) {
            test.skip();
            return;
        }

        // # Click version history menu item
        await versionHistoryItem.click();
        let versionModal = page.locator('.page-version-history-modal, [data-testid="version-history-modal"]').first();

        // * Verify Version History modal is visible
        await expect(versionModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Close the modal
        const closeButton = versionModal.locator('button[aria-label="Close"], .close-button').first();
        await closeButton.click();

        // * Verify modal is closed
        await expect(versionModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Open page context menu and click version history again
        contextMenu = await openPageContextMenu(page, 'Page With History');
        await contextMenu.locator('[data-testid="page-context-menu-version-history"]').click();
        versionModal = page.locator('.page-version-history-modal, [data-testid="version-history-modal"]').first();

        // * Verify modal can be reopened after close
        await expect(versionModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Close the modal again
        await versionModal.locator('button[aria-label="Close"], .close-button').first().click();

        // * Verify modal is closed
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

        // # Create wiki through UI
        const wikiName = `Wiki To Rename ${await pw.random.id()}`;
        await createWikiThroughUI(page, wikiName);
        await page.waitForTimeout(EDITOR_LOAD_WAIT);

        // # Open wiki tab menu and click rename
        await openWikiTabMenu(page, wikiName);
        await clickWikiTabMenuItem(page, 'wiki-tab-rename');
        let renameModal = page.getByRole('dialog', {name: /Rename/i});

        // * Verify Wiki Rename modal is visible
        await expect(renameModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Cancel the modal
        await renameModal.locator('button:has-text("Cancel")').first().click();

        // * Verify modal is closed
        await expect(renameModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Open wiki tab menu and click rename again
        await openWikiTabMenu(page, wikiName);
        await clickWikiTabMenuItem(page, 'wiki-tab-rename');
        renameModal = page.getByRole('dialog', {name: /Rename/i});

        // * Verify modal can be reopened after cancel
        await expect(renameModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Cancel the modal again
        await renameModal.locator('button:has-text("Cancel")').first().click();

        // * Verify modal is closed
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

        // # Create wiki through UI
        const wikiName = `Wiki To Delete ${await pw.random.id()}`;
        await createWikiThroughUI(page, wikiName);
        await page.waitForTimeout(EDITOR_LOAD_WAIT);

        // # Open wiki tab menu and click delete
        await openWikiTabMenu(page, wikiName);
        await clickWikiTabMenuItem(page, 'wiki-tab-delete');
        let deleteModal = page.getByRole('dialog', {name: /Delete/i});

        // * Verify Wiki Delete modal is visible
        await expect(deleteModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Cancel the modal
        await deleteModal.locator('button:has-text("Cancel")').first().click();

        // * Verify modal is closed
        await expect(deleteModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Open wiki tab menu and click delete again
        await openWikiTabMenu(page, wikiName);
        await clickWikiTabMenuItem(page, 'wiki-tab-delete');
        deleteModal = page.getByRole('dialog', {name: /Delete/i});

        // * Verify modal can be reopened after cancel
        await expect(deleteModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Cancel the modal again
        await deleteModal.locator('button:has-text("Cancel")').first().click();

        // * Verify modal is closed
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

        // # Create wiki through UI
        const wikiName = `Wiki To Move ${await pw.random.id()}`;
        await createWikiThroughUI(page, wikiName);
        await page.waitForTimeout(EDITOR_LOAD_WAIT);

        // # Open wiki tab menu and check for move option
        await openWikiTabMenu(page, wikiName);

        // Skip if move option is not available
        const moveItem = page.locator('#wiki-tab-move');
        if ((await moveItem.count()) === 0) {
            test.skip();
            return;
        }

        // # Click move menu item
        await clickWikiTabMenuItem(page, 'wiki-tab-move');
        let moveModal = page.getByRole('dialog', {name: /Move/i});

        // * Verify Wiki Move modal is visible
        await expect(moveModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Cancel the modal
        await moveModal.locator('button:has-text("Cancel")').first().click();

        // * Verify modal is closed
        await expect(moveModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Open wiki tab menu and click move again
        await openWikiTabMenu(page, wikiName);
        await clickWikiTabMenuItem(page, 'wiki-tab-move');
        moveModal = page.getByRole('dialog', {name: /Move/i});

        // * Verify modal can be reopened after cancel
        await expect(moveModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Cancel the modal again
        await moveModal.locator('button:has-text("Cancel")').first().click();

        // * Verify modal is closed
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

        // # Create wiki and parent page through UI
        await createWikiThroughUI(page, `Test Wiki ${await pw.random.id()}`);
        await createPageThroughUI(page, 'Parent Page', 'Content');
        await page.waitForTimeout(EDITOR_LOAD_WAIT);
        await ensurePanelOpen(page);

        // # Open page context menu and click new child
        let contextMenu = await openPageContextMenu(page, 'Parent Page');
        await contextMenu.locator('[data-testid="page-context-menu-new-child"]').click();
        let createModal = page.getByRole('dialog', {name: /Create/i});

        // * Verify Create Child Page modal is visible
        await expect(createModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Cancel the modal
        await createModal.locator('button:has-text("Cancel")').first().click();

        // * Verify modal is closed
        await expect(createModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Open page context menu and click new child again
        contextMenu = await openPageContextMenu(page, 'Parent Page');
        await contextMenu.locator('[data-testid="page-context-menu-new-child"]').click();
        createModal = page.getByRole('dialog', {name: /Create/i});

        // * Verify modal can be reopened after cancel
        await expect(createModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Cancel the modal again
        await createModal.locator('button:has-text("Cancel")').first().click();

        // * Verify modal is closed
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

        // # Create wiki and page through UI
        await createWikiThroughUI(page, `Test Wiki ${await pw.random.id()}`);
        await createPageThroughUI(page, 'Multi Modal Test', 'Content');
        await page.waitForTimeout(EDITOR_LOAD_WAIT);
        await ensurePanelOpen(page);

        // # Open Move modal
        const moveModal = await openMovePageModal(page, 'Multi Modal Test');

        // * Verify Move modal is visible
        await expect(moveModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Cancel Move modal
        await moveModal.getByRole('button', {name: 'Cancel'}).click();

        // * Verify Move modal is closed
        await expect(moveModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Open Rename modal via context menu
        let contextMenu = await openPageContextMenu(page, 'Multi Modal Test');
        await contextMenu.locator('[data-testid="page-context-menu-rename"]').click();
        const renameModal = page.getByRole('dialog', {name: /Rename/i});

        // * Verify Rename modal is visible
        await expect(renameModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Cancel Rename modal
        await renameModal.locator('button:has-text("Cancel")').first().click();

        // * Verify Rename modal is closed
        await expect(renameModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Open Delete modal via context menu
        contextMenu = await openPageContextMenu(page, 'Multi Modal Test');
        await contextMenu.locator('[data-testid="page-context-menu-delete"]').click();
        const deleteModal = page.getByRole('dialog', {name: /Delete/i});

        // * Verify Delete modal is visible
        await expect(deleteModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Cancel Delete modal
        await deleteModal.locator('button[aria-label="Close"], button:has-text("Cancel")').first().click();

        // * Verify Delete modal is closed
        await expect(deleteModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Open Move modal again to verify no cross-modal interference
        const moveModal2 = await openMovePageModal(page, 'Multi Modal Test');

        // * Verify Move modal can be reopened after using other modals
        await expect(moveModal2).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Cancel the modal
        await moveModal2.getByRole('button', {name: 'Cancel'}).click();

        // * Verify modal is closed
        await expect(moveModal2).not.toBeVisible({timeout: ELEMENT_TIMEOUT});
    });
});
