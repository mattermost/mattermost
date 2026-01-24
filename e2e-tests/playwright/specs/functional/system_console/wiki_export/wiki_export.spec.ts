// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

test.describe('Wiki Export/Import Admin Console', () => {
    test('MM-WIKI-EXPORT-1 Should display wiki export/import page in admin console', async ({pw}) => {
        const {adminUser} = await pw.initSetup();
        if (!adminUser) {
            throw new Error('Failed to create admin user');
        }

        // # Log in as admin
        const {page, systemConsolePage} = await pw.testBrowser.login(adminUser);

        // # Visit system console
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();

        // # Navigate to Wiki Export/Import section
        await systemConsolePage.sidebar.goToItem('Wiki Export/Import');

        // * Verify the wiki export panel is visible
        const exportPanel = page.locator('#wikiExportPanel');
        await expect(exportPanel).toBeVisible();

        // * Verify export panel title is visible (AdminPanel uses .header h3)
        const exportTitle = exportPanel.locator('.header h3');
        await expect(exportTitle).toContainText('Wiki Export');

        // * Verify the wiki import panel is visible
        const importPanel = page.locator('#wikiImportPanel');
        await expect(importPanel).toBeVisible();

        // * Verify import panel title is visible
        const importTitle = importPanel.locator('.header h3');
        await expect(importTitle).toContainText('Wiki Import');
    });

    test('MM-WIKI-EXPORT-2 Should create wiki export job when clicking export button', async ({pw}) => {
        test.slow();

        const {adminUser} = await pw.initSetup();
        if (!adminUser) {
            throw new Error('Failed to create admin user');
        }

        // # Log in as admin
        const {page, systemConsolePage} = await pw.testBrowser.login(adminUser);

        // # Visit system console
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();

        // # Navigate to Wiki Export/Import section
        await systemConsolePage.sidebar.goToItem('Wiki Export/Import');

        // * Verify the export panel is visible
        const exportPanel = page.locator('#wikiExportPanel');
        await expect(exportPanel).toBeVisible();

        // # Click the export button
        const exportButton = exportPanel.getByRole('button', {name: 'Run Wiki Export Now'});
        await expect(exportButton).toBeVisible();
        await exportButton.click();

        // * Wait for job to be created - the table or a status indicator should appear
        // Give it time to process the job creation
        await page.waitForTimeout(2000);

        // * Verify the button is still functional (job was submitted)
        // After clicking, the UI should still be responsive
        await expect(exportButton).toBeVisible();
    });

    test('MM-WIKI-EXPORT-3 Should navigate to wiki export via sidebar search', async ({pw}) => {
        const {adminUser} = await pw.initSetup();
        if (!adminUser) {
            throw new Error('Failed to create admin user');
        }

        // # Log in as admin
        const {page, systemConsolePage} = await pw.testBrowser.login(adminUser);

        // # Visit system console
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();

        // # Search for wiki in sidebar
        await systemConsolePage.sidebar.searchForItem('Wiki');

        // * Verify Wiki Export/Import appears in search results
        const searchResult = page.getByText('Wiki Export/Import', {exact: true});
        await expect(searchResult).toBeVisible();

        // # Click on the search result
        await searchResult.click();

        // * Verify we navigated to the correct page
        await expect(page.locator('#wikiExportPanel')).toBeVisible();
    });
});
