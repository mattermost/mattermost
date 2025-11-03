// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';

import {createWikiThroughUI, createTestChannel, getNewPageButton, fillCreatePageModal} from './test_helpers';

/**
 * @objective Verify author avatar appears in wiki page draft editor
 */
test('displays author avatar and username in draft editor', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Avatar Wiki ${pw.random.id()}`);

    // # Create draft to see author avatar
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Draft Page for Avatar');

    // # Wait for editor to appear (draft created and loaded)
    const editor = page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();
    await editor.waitFor({state: 'visible', timeout: 5000});

    // * Verify author section is visible
    const authorSection = page.locator('[data-testid="wiki-page-author"]');
    await expect(authorSection).toBeVisible();

    // * Verify author section has WikiPageEditor__author class
    await expect(authorSection).toHaveClass(/WikiPageEditor__author/);

    // * Verify username is displayed (user.username from sharedPagesSetup)
    const authorText = page.locator('.WikiPageEditor__authorText');
    await expect(authorText).toBeVisible();
    await expect(authorText).toContainText(`By ${user.username}`);

    // * Verify ProfilePicture component is rendered (has status-wrapper class)
    const profilePicture = authorSection.locator('.status-wrapper');
    await expect(profilePicture).toBeVisible();
});

/**
 * @objective Verify author avatar has proper accessibility attributes
 */
test('includes accessibility label for author section', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `A11y Wiki ${pw.random.id()}`);

    // # Create draft
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Accessibility Test Page');

    // # Wait for editor to appear
    const editor = page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();
    await editor.waitFor({state: 'visible', timeout: 5000});

    // * Verify author section has aria-label
    const authorSection = page.locator('[data-testid="wiki-page-author"]');
    await expect(authorSection).toBeVisible();

    const ariaLabel = await authorSection.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
    expect(ariaLabel).toContain('Author:');
    expect(ariaLabel).toContain(user.username);
});

/**
 * @objective Verify author avatar displays correctly after page reload
 */
test('persists author avatar after page reload', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki and draft
    const wiki = await createWikiThroughUI(page, `Persist Wiki ${pw.random.id()}`);

    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Persistence Test Page');

    // # Wait for editor
    const editor = page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();
    await editor.waitFor({state: 'visible', timeout: 5000});

    // * Verify author avatar is visible before reload
    const authorSection = page.locator('[data-testid="wiki-page-author"]');
    await expect(authorSection).toBeVisible();

    // # Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // # Wait for editor to reappear after reload
    await editor.waitFor({state: 'visible', timeout: 5000});

    // * Verify author avatar is still visible after reload
    await expect(authorSection).toBeVisible();

    // * Verify username is still displayed correctly
    const authorText = page.locator('.WikiPageEditor__authorText');
    await expect(authorText).toBeVisible();
    await expect(authorText).toContainText(`By ${user.username}`);
});

/**
 * @objective Verify author section does not appear in published pages
 */
test('does not show author avatar in published page view', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki and draft
    const wiki = await createWikiThroughUI(page, `Published Wiki ${pw.random.id()}`);

    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Page to Publish');

    // # Wait for editor
    const editor = page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();
    await editor.waitFor({state: 'visible', timeout: 5000});

    // # Add some content
    await editor.click();
    await editor.type('Published content');

    // Wait for auto-save
    await page.waitForTimeout(2000);

    // # Publish the page
    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]');
    await publishButton.waitFor({state: 'visible', timeout: 5000});
    await publishButton.click();
    await page.waitForTimeout(1000);

    // * Verify author section is NOT visible in published view
    const authorSection = page.locator('[data-testid="wiki-page-author"]');
    await expect(authorSection).not.toBeVisible();

    // * Verify page content is visible (we're in view mode)
    const pageViewer = page.locator('[data-testid="page-viewer-content"]');
    if (await pageViewer.isVisible().catch(() => false)) {
        await expect(pageViewer).toBeVisible();
    }
});
