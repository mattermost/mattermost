// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';
import {
    createDraftThroughUI,
    createPageThroughUI,
    createTestChannel,
    createWikiThroughUI,
    getPageActionsMenuLocator,
    loginAndNavigateToChannel,
    openPageContextMenu,
    uniqueName,
} from './test_helpers';

/**
 * @objective Verify Export to PDF menu option appears for published pages
 */
test('shows PDF export option for published page', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and page through UI
    await createWikiThroughUI(page, uniqueName('Test Wiki'));
    const testPage = await createPageThroughUI(page, 'Test Page', 'Test content for PDF export');

    // # Open page context menu
    await openPageContextMenu(page, testPage.id!);

    // * Verify Export to PDF menu option appears
    const exportPdfOption = page.locator('[data-testid="page-context-menu-export-pdf"]');
    await expect(exportPdfOption).toBeVisible();

    // * Verify Export to PDF has correct label
    await expect(exportPdfOption).toContainText('Export to PDF');
});

/**
 * @objective Verify Export to PDF menu option appears for draft pages
 */
test('shows PDF export option for draft page', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and draft through UI
    await createWikiThroughUI(page, uniqueName('Test Wiki'));
    const draft = await createDraftThroughUI(page, 'Draft Page', 'Draft content');

    // # Open page context menu for draft
    await openPageContextMenu(page, draft.id);

    // * Verify Export to PDF menu option appears for draft
    const exportPdfOption = page.locator('[data-testid="page-context-menu-export-pdf"]');
    await expect(exportPdfOption).toBeVisible();
});

/**
 * @objective Verify clicking Export to PDF triggers browser print dialog
 */
test('triggers print dialog when Export to PDF is clicked', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and page through UI
    await createWikiThroughUI(page, uniqueName('Test Wiki'));
    const testPage = await createPageThroughUI(page, 'Test Page', 'Test content for PDF export');

    // # Setup window.print() spy
    let printCalled = false;
    await page.evaluate(() => {
        (window as any).originalPrint = window.print;
        window.print = () => {
            (window as any).printCalled = true;
        };
    });

    // # Open page context menu and click Export to PDF
    await openPageContextMenu(page, testPage.id!);
    const exportPdfOption = page.locator('[data-testid="page-context-menu-export-pdf"]');
    await exportPdfOption.click();

    // * Wait for window.print() to be called (deterministic polling)
    await page.waitForFunction(() => (window as any).printCalled === true, {timeout: 5000});

    // * Verify window.print() was called
    printCalled = await page.evaluate(() => (window as any).printCalled);
    expect(printCalled).toBe(true);

    // * Verify context menu closed after clicking
    const contextMenu = getPageActionsMenuLocator(page);
    await expect(contextMenu).not.toBeVisible();
});

/**
 * @objective Verify PDF export menu option position in context menu
 */
test('positions PDF export option after Duplicate page', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and page through UI
    await createWikiThroughUI(page, uniqueName('Test Wiki'));
    const testPage = await createPageThroughUI(page, 'Test Page', 'Test content for PDF export');

    // # Open page context menu
    await openPageContextMenu(page, testPage.id!);

    // * Verify menu items appear in correct order
    const contextMenu2 = getPageActionsMenuLocator(page);
    const menuItems = contextMenu2.locator('li[role="menuitem"]');

    // Get all menu item labels
    const labels = await menuItems.evaluateAll((items) => items.map((item) => item.textContent?.trim() || ''));

    // * Verify Duplicate page comes before Export to PDF
    const duplicateIndex = labels.indexOf('Duplicate page');
    const exportPdfIndex = labels.indexOf('Export to PDF');

    expect(duplicateIndex).toBeGreaterThanOrEqual(0);
    expect(exportPdfIndex).toBeGreaterThanOrEqual(0);
    expect(exportPdfIndex).toBeGreaterThan(duplicateIndex);
});
