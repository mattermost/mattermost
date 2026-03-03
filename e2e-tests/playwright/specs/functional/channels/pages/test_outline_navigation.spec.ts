// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';
import {
    createWikiThroughUI,
    createPageThroughUI,
    addHeadingToEditor,
    createTestChannel,
    showPageOutline,
    getHierarchyPanel,
    enterEditMode,
    waitForEditModeReady,
    clearEditorContent,
    loginAndNavigateToChannel,
    uniqueName,
    ELEMENT_TIMEOUT,
} from './test_helpers';

/**
 * @objective Verify page outline displays correctly after navigating away and back to the page
 */
test('shows outline after navigating away and back', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki
    await createWikiThroughUI(page, uniqueName('Navigation Test Wiki'));

    // # Create TWO pages
    const page1 = await createPageThroughUI(page, 'Page 1 with Headings', ' ');
    const page2 = await createPageThroughUI(page, 'Page 2', ' ');

    const hierarchyPanel = getHierarchyPanel(page);

    // # Edit and publish Page 1
    const page1Node = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-page-id="${page1.id}"]`).first();
    await page1Node.click();
    await page.waitForLoadState('networkidle');

    // # Enter edit mode using helper
    await enterEditMode(page);
    await waitForEditModeReady(page);

    // # Clear existing content and add heading
    await clearEditorContent(page);
    await addHeadingToEditor(page, 1, 'Page 1 Heading');

    // # Publish the page
    const publishButton1 = page.locator('[data-testid="wiki-page-publish-button"]');
    await publishButton1.click();
    await page.waitForLoadState('networkidle');

    // # Navigate to Page 2 (navigate AWAY from Page 1)
    const page2Node = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-page-id="${page2.id}"]`).first();
    await expect(page2Node).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await page2Node.click();
    await page.waitForLoadState('networkidle');

    // # Navigate BACK to Page 1
    await expect(page1Node).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await page1Node.click();
    await page.waitForLoadState('networkidle');

    // # NOW show outline for Page 1
    await showPageOutline(page, page1.id);

    // * Verify outline shows the heading
    const page1OutlineHeading = page
        .locator('[role="treeitem"]')
        .filter({hasText: /Page 1 Heading/})
        .first();
    await expect(page1OutlineHeading).toBeVisible({timeout: ELEMENT_TIMEOUT});
});
