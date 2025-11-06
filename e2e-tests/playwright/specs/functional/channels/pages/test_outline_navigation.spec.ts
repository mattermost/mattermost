import {expect, test} from './pages_test_fixture';
import {createWikiThroughUI, createPageThroughUI, addHeadingToEditor, createTestChannel} from './test_helpers';

/**
 * Test outline with navigation - does navigating away and back cause the issue?
 */
test('shows outline after navigating away and back', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki
    const wiki = await createWikiThroughUI(page, `Navigation Test Wiki ${pw.random.id()}`);

    // # Create TWO pages
    const page1 = await createPageThroughUI(page, 'Page 1 with Headings', ' ');
    const page2 = await createPageThroughUI(page, 'Page 2', ' ');

    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');

    // # Edit and publish Page 1
    const page1Node = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-page-id="${page1.id}"]`).first();
    await page1Node.click();
    await page.waitForLoadState('networkidle');

    const editButton1 = page.locator('[data-testid="wiki-page-edit-button"], button:has-text("Edit")').first();
    await editButton1.click();
    await page.waitForTimeout(500);

    const editor1 = page.locator('.ProseMirror').first();
    await editor1.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await addHeadingToEditor(page, 1, 'Page 1 Heading');

    const publishButton1 = page.locator('[data-testid="wiki-page-publish-button"]');
    await publishButton1.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // # Navigate to Page 2 (navigate AWAY from Page 1)
    const page2Node = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-page-id="${page2.id}"]`).first();
    await page2Node.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // # Navigate BACK to Page 1
    await page1Node.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // # NOW show outline for Page 1
    const menuButton1 = page1Node.locator('[data-testid="page-tree-node-menu-button"]').first();
    await menuButton1.click();

    const contextMenu1 = page.locator('[data-testid="page-context-menu"]');
    await expect(contextMenu1).toBeVisible({timeout: 3000});

    const showOutlineButton = contextMenu1.locator('button:has-text("Show outline")').first();
    await expect(showOutlineButton).toBeVisible({timeout: 3000});
    await showOutlineButton.click();

    await page.waitForTimeout(2000);

    // * Verify outline shows the heading
    const page1OutlineHeading = page.locator('[role="treeitem"]').filter({hasText: /Page 1 Heading/}).first();
    await expect(page1OutlineHeading).toBeVisible({timeout: 5000});
});
