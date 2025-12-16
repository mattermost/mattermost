// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';
import {
    createTestChannel,
    createWikiThroughUI,
    createPageThroughUI,
    getNewPageButton,
    fillCreatePageModal,
    publishCurrentPage,
    getEditorAndWait,
    typeInEditor,
    renamePageViaContextMenu,
    enterEditMode,
    getBreadcrumb,
    SHORT_WAIT,
    EDITOR_LOAD_WAIT,
} from './test_helpers';

/**
 * @objective Verify renaming a new draft page (never published) preserves content
 *
 * @precondition
 * Pages/Wiki feature is enabled on the server
 */
test('renames new draft page and preserves content', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Rename Draft Channel ${await pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki through UI
    await createWikiThroughUI(page, `Rename Draft Wiki ${await pw.random.id()}`);

    // # Create new draft page with specific content
    const originalTitle = 'Draft Page Original Title';
    const pageContent = 'This is the original content that should be preserved after rename';
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, originalTitle);

    // # Type content in the editor
    await getEditorAndWait(page);
    await typeInEditor(page, pageContent);

    // # Wait for autosave to complete
    await page.waitForTimeout(EDITOR_LOAD_WAIT);

    // # Rename the draft via context menu
    const newTitle = 'Draft Page Renamed Title';
    await renamePageViaContextMenu(page, originalTitle, newTitle);

    // * Verify title is updated in hierarchy
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');
    await expect(hierarchyPanel).toContainText(newTitle);
    await expect(hierarchyPanel).not.toContainText(originalTitle);

    // * Verify content is still preserved in the editor
    const editor = page.locator('.ProseMirror');
    await expect(editor).toContainText(pageContent);

    // # Publish the page to verify content was preserved through rename
    await publishCurrentPage(page);

    // * Verify published page shows the new title and original content
    const pageViewer = page.locator('[data-testid="page-viewer-content"]');
    await expect(pageViewer).toBeVisible();
    await expect(pageViewer).toContainText(pageContent);

    const pageTitle = page.locator('[data-testid="page-viewer-title"]');
    await expect(pageTitle).toContainText(newTitle);
});

/**
 * @objective Verify renaming a published page preserves content
 */
test('renames published page and preserves content', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Rename Published Channel ${await pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki through UI
    await createWikiThroughUI(page, `Rename Published Wiki ${await pw.random.id()}`);

    // # Create and publish a page with specific content
    const originalTitle = 'Published Page Original Title';
    const pageContent = 'This published content must be preserved after rename';
    await createPageThroughUI(page, originalTitle, pageContent);

    // * Verify page is published and content is visible
    const pageViewer = page.locator('[data-testid="page-viewer-content"]');
    await expect(pageViewer).toContainText(pageContent);

    // # Rename the published page via context menu
    const newTitle = 'Published Page Renamed Title';
    await renamePageViaContextMenu(page, originalTitle, newTitle);

    // * Verify title is updated in hierarchy
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');
    await expect(hierarchyPanel).toContainText(newTitle);
    await expect(hierarchyPanel).not.toContainText(originalTitle);

    // * Verify page viewer still shows the content (not replaced with title)
    await expect(pageViewer).toContainText(pageContent);
    await expect(pageViewer).not.toContainText(newTitle);

    // * Verify the title in the viewer is updated
    const pageTitleElement = page.locator('[data-testid="page-viewer-title"]');
    await expect(pageTitleElement).toContainText(newTitle);
});

/**
 * @objective Verify renaming a page while in edit mode (draft of existing page) preserves content
 */
test('renames page during edit mode and preserves content', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Rename Edit Mode Channel ${await pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki through UI
    await createWikiThroughUI(page, `Rename Edit Mode Wiki ${await pw.random.id()}`);

    // # Create and publish a page
    const originalTitle = 'Edit Mode Page Original';
    const originalContent = 'Original published content';
    await createPageThroughUI(page, originalTitle, originalContent);

    // # Enter edit mode (without publishing)
    await enterEditMode(page);

    // # Get editor locator and add new content
    const editor = page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();
    await editor.click();
    await page.keyboard.press('End');

    // # Add new content
    const additionalContent = ' with additional edits';
    await editor.type(additionalContent);

    // # Wait for autosave
    await page.waitForTimeout(EDITOR_LOAD_WAIT);

    // # Rename the page while in edit mode
    const newTitle = 'Edit Mode Page Renamed';
    await renamePageViaContextMenu(page, originalTitle, newTitle);

    // * Verify title is updated in breadcrumb (hierarchy may not refresh immediately)
    const breadcrumb = getBreadcrumb(page);
    await expect(breadcrumb).toContainText(newTitle);

    // * Verify editor still contains the content (original + additional)
    // Re-locate editor since state may have changed
    const editorAfterRename = page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();
    await expect(editorAfterRename).toContainText(originalContent);
    await expect(editorAfterRename).toContainText(additionalContent.trim());

    // # Publish the edited page (use Publish button - shows "Update" for existing pages)
    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]');
    await publishButton.click();
    await page.waitForLoadState('networkidle');

    // * Verify published page has new title and all content preserved
    const pageViewer = page.locator('[data-testid="page-viewer-content"]');
    await expect(pageViewer).toBeVisible();
    await expect(pageViewer).toContainText(originalContent);
    await expect(pageViewer).toContainText(additionalContent.trim());

    const pageTitleElement = page.locator('[data-testid="page-viewer-title"]');
    await expect(pageTitleElement).toContainText(newTitle);
});

/**
 * @objective Verify renaming with complex content (multiple paragraphs, formatting) preserves all content
 */
test('renames page with complex content and preserves formatting', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Rename Complex Channel ${await pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki through UI
    await createWikiThroughUI(page, `Rename Complex Wiki ${await pw.random.id()}`);

    // # Create new page with complex content
    const originalTitle = 'Complex Content Page';
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, originalTitle);

    // # Add complex content with multiple paragraphs
    await getEditorAndWait(page);
    const paragraph1 = 'First paragraph with important information.';
    const paragraph2 = 'Second paragraph contains different data.';
    const paragraph3 = 'Third paragraph has conclusions.';

    await typeInEditor(page, paragraph1);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await typeInEditor(page, paragraph2);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await typeInEditor(page, paragraph3);

    // # Wait for autosave
    await page.waitForTimeout(EDITOR_LOAD_WAIT);

    // # Rename the page
    const newTitle = 'Complex Content Page Renamed';
    await renamePageViaContextMenu(page, originalTitle, newTitle);

    // * Verify all paragraphs are still in the editor
    const editor = page.locator('.ProseMirror');
    await expect(editor).toContainText(paragraph1);
    await expect(editor).toContainText(paragraph2);
    await expect(editor).toContainText(paragraph3);

    // # Publish and verify
    await publishCurrentPage(page);

    const pageViewer = page.locator('[data-testid="page-viewer-content"]');
    await expect(pageViewer).toContainText(paragraph1);
    await expect(pageViewer).toContainText(paragraph2);
    await expect(pageViewer).toContainText(paragraph3);

    // * Verify content is NOT the title (regression check for the bug)
    await expect(pageViewer).not.toContainText(newTitle);
});

/**
 * @objective Verify multiple consecutive renames preserve content
 */
test('multiple consecutive renames preserve content', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Multi Rename Channel ${await pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki through UI
    await createWikiThroughUI(page, `Multi Rename Wiki ${await pw.random.id()}`);

    // # Create page with content
    const originalTitle = 'Multi Rename Page';
    const pageContent = 'Content that survives multiple renames';
    await createPageThroughUI(page, originalTitle, pageContent);

    // # Perform multiple consecutive renames
    const rename1 = 'First Rename';
    const rename2 = 'Second Rename';
    const rename3 = 'Third Rename';

    await renamePageViaContextMenu(page, originalTitle, rename1);
    await page.waitForTimeout(SHORT_WAIT);

    await renamePageViaContextMenu(page, rename1, rename2);
    await page.waitForTimeout(SHORT_WAIT);

    await renamePageViaContextMenu(page, rename2, rename3);
    await page.waitForTimeout(SHORT_WAIT);

    // * Verify final title is correct
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');
    await expect(hierarchyPanel).toContainText(rename3);

    // * Verify content is still preserved after all renames
    const pageViewer = page.locator('[data-testid="page-viewer-content"]');
    await expect(pageViewer).toContainText(pageContent);

    // * Verify content is NOT any of the titles
    await expect(pageViewer).not.toContainText(originalTitle);
    await expect(pageViewer).not.toContainText(rename1);
    await expect(pageViewer).not.toContainText(rename2);
    await expect(pageViewer).not.toContainText(rename3);
});

/**
 * @objective Verify content length is preserved after rename (regression test for content replaced by title)
 */
test('verifies content is not replaced with title after rename', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Content Preserve Channel ${await pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki through UI
    await createWikiThroughUI(page, `Content Preserve Wiki ${await pw.random.id()}`);

    // # Create page with long content that is distinctly longer than any title
    const originalTitle = 'Short Title';
    const longContent =
        'This is a very long piece of content that spans multiple sentences. ' +
        'It contains detailed information about the topic at hand. ' +
        'The purpose of this long content is to verify that after a rename operation, ' +
        'the full content is preserved and not accidentally replaced with the much shorter title. ' +
        'If the content were replaced with the title, this entire paragraph would be lost.';

    await createPageThroughUI(page, originalTitle, longContent);

    // # Rename the page
    const newTitle = 'New Short Title';
    await renamePageViaContextMenu(page, originalTitle, newTitle);

    // * Get the page content after rename
    const pageViewer = page.locator('[data-testid="page-viewer-content"]');
    const contentText = await pageViewer.textContent();

    // * Verify content length is significantly longer than title (content should not be replaced by title)
    expect(contentText!.length).toBeGreaterThan(newTitle.length * 3);

    // * Verify content contains the original text, not the title
    expect(contentText).toContain('very long piece of content');
    expect(contentText).toContain('multiple sentences');
    expect(contentText).toContain('accidentally replaced');
});
