import {expect, test} from './pages_test_fixture';
import {createWikiThroughUI, createPageThroughUI, addHeadingToEditor, createTestChannel, showPageOutline, getHierarchyPanel, enterEditMode, waitForEditModeReady, clearEditorContent, SHORT_WAIT, ELEMENT_TIMEOUT} from './test_helpers';

/**
 * Test outline with navigation - does navigating away and back cause the issue?
 */
test('shows outline after navigating away and back', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${await pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki
    const wiki = await createWikiThroughUI(page, `Navigation Test Wiki ${await pw.random.id()}`);

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
    await page.waitForTimeout(SHORT_WAIT);

    // # Navigate to Page 2 (navigate AWAY from Page 1)
    const page2Node = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-page-id="${page2.id}"]`).first();
    await page2Node.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(SHORT_WAIT);

    // # Navigate BACK to Page 1
    await page1Node.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(SHORT_WAIT);

    // # NOW show outline for Page 1
    await showPageOutline(page, page1.id);

    // * Verify outline shows the heading
    const page1OutlineHeading = page.locator('[role="treeitem"]').filter({hasText: /Page 1 Heading/}).first();
    await expect(page1OutlineHeading).toBeVisible({timeout: ELEMENT_TIMEOUT});
});
