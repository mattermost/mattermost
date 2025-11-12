import {expect, test} from './pages_test_fixture';
import {createWikiThroughUI, createPageThroughUI, addHeadingToEditor, createTestChannel, showPageOutline, getHierarchyPanel} from './test_helpers';

/**
 * Minimal test to isolate the outline visibility issue
 */
test('MINIMAL: shows outline after publishing page with heading', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki
    const wiki = await createWikiThroughUI(page, `Minimal Test Wiki ${pw.random.id()}`);

    // # Create page with empty content
    const page1 = await createPageThroughUI(page, 'Test Page', ' ');

    const hierarchyPanel = getHierarchyPanel(page);
    const page1Node = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-page-id="${page1.id}"]`).first();

    // # Click the page to open it
    await page1Node.click();
    await page.waitForLoadState('networkidle');

    // # Click Edit button
    const editButton = page.locator('[data-testid="wiki-page-edit-button"], button:has-text("Edit")').first();
    await editButton.click();
    await page.waitForTimeout(500);

    // # Add heading to the page
    const editor = page.locator('.ProseMirror').first();
    await editor.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await addHeadingToEditor(page, 1, 'Test Heading');

    // # Publish the page
    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]');
    await publishButton.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000); // Wait for Redux to update

    // # Show outline for the page
    await showPageOutline(page, page1.id);

    // * Verify the heading appears in the outline
    const outlineHeading = page.locator('[role="treeitem"]').filter({hasText: /Test Heading/}).first();
    await expect(outlineHeading).toBeVisible({timeout: 5000});
});
