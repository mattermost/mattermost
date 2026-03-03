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
    EDITOR_LOAD_WAIT,
} from './test_helpers';

/**
 * @objective Verify page outline displays heading after publishing a page with heading content
 */
test('MINIMAL: shows outline after publishing page with heading', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki
    await createWikiThroughUI(page, uniqueName('Minimal Test Wiki'));

    // # Create page with empty content
    const page1 = await createPageThroughUI(page, 'Test Page', ' ');

    const hierarchyPanel = getHierarchyPanel(page);
    const page1Node = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-page-id="${page1.id}"]`).first();

    // # Click the page to open it
    await page1Node.click();
    await page.waitForLoadState('networkidle');

    // # Enter edit mode using helper
    await enterEditMode(page);
    await waitForEditModeReady(page);

    // # Clear existing content and add heading
    await clearEditorContent(page);
    await addHeadingToEditor(page, 1, 'Test Heading');

    // # Publish the page
    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]');
    await publishButton.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(EDITOR_LOAD_WAIT);

    // # Show outline for the page
    await showPageOutline(page, page1.id);

    // * Verify the heading appears in the outline
    const outlineHeading = page
        .locator('[role="treeitem"]')
        .filter({hasText: /Test Heading/})
        .first();
    await expect(outlineHeading).toBeVisible({timeout: ELEMENT_TIMEOUT});
});
