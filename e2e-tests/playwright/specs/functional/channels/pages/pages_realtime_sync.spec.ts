// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';

import {
    createWikiThroughUI,
    createPageThroughUI,
    createTestChannel,
    navigateToWikiView,
    navigateToPage,
    openMovePageModal,
    getHierarchyPanel,
    createTestUserInChannel,
    clickPageInHierarchy,
    enterEditMode,
    getEditorAndWait,
    typeInEditor,
    clearEditorContent,
    verifyPageContentContains,
    SHORT_WAIT,
    EDITOR_LOAD_WAIT,
    AUTOSAVE_WAIT,
    ELEMENT_TIMEOUT,
    HIERARCHY_TIMEOUT,
} from './test_helpers';

/**
 * @objective Verify that pages appear in real-time for all users when published to a wiki
 *
 * @precondition
 * Pages/Wiki feature is enabled on the server
 * Two users have access to the same channel
 */
test('shows newly published page in hierarchy panel for other users without refresh', {tag: '@pages'}, async ({pw, context, sharedPagesSetup}) => {
    const {team, user: user1, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    // # User 1 creates wiki
    const {page: page1, channelsPage: channelsPage1} = await pw.testBrowser.login(user1);
    await channelsPage1.goto(team.name, channel.name);
    await channelsPage1.toBeVisible();

    const wiki = await createWikiThroughUI(page1, `Test Wiki ${pw.random.id()}`);

    // # Create user2 and add to channel
    const {user: user2, userId: user2Id} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

    // # User 2 logs in and navigates to the same wiki
    const {page: user2Page, channelsPage: channelsPage2} = await pw.testBrowser.login(user2);
    await navigateToWikiView(user2Page, pw.url, team.name, channel.id, wiki.id);

    // # Wait for hierarchy panel to load for user2
    const user2HierarchyPanel = getHierarchyPanel(user2Page);

    // * Verify hierarchy panel is empty (no pages yet)
    const emptyState = user2HierarchyPanel.locator('text="No pages yet"');
    await expect(emptyState).toBeVisible();

    // # User 1 creates and publishes a new page
    const pageTitle = `New Page ${pw.random.id()}`;
    await createPageThroughUI(page1, pageTitle, 'This is a test page created by user 1');

    // # Wait for page to be published
    await page1.waitForLoadState('networkidle');
    await page1.waitForTimeout(EDITOR_LOAD_WAIT);

    // * Verify the new page appears in user2's hierarchy panel WITHOUT refresh
    const user2PageNode = user2HierarchyPanel.locator('[data-testid="page-tree-node"]').filter({hasText: pageTitle});
    await expect(user2PageNode).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify user2 can click on the page and view it
    await user2PageNode.click();
    await user2Page.waitForLoadState('networkidle');
    const pageContent = user2Page.locator('[data-testid="page-viewer-content"]');
    await expect(pageContent).toContainText('This is a test page created by user 1');
});

/**
 * @objective Verify that moved pages appear in target wiki for other users without refresh
 *
 * @precondition
 * Pages/Wiki feature is enabled on the server
 * Two users have access to the same channel
 */
test('shows moved page in target wiki hierarchy for other users without refresh', {tag: '@pages'}, async ({pw, context, sharedPagesSetup}) => {
    const {team, user: user1, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    // # User 1 creates two wikis and a page in the first wiki
    const {page: page1, channelsPage: channelsPage1} = await pw.testBrowser.login(user1);
    await channelsPage1.goto(team.name, channel.name);
    await channelsPage1.toBeVisible();

    const sourceWiki = await createWikiThroughUI(page1, `Source Wiki ${pw.random.id()}`);
    const pageTitle = `Page to Move ${pw.random.id()}`;
    const createdPage = await createPageThroughUI(page1, pageTitle, 'This page will be moved');

    // # Navigate back to channel to create second wiki
    await channelsPage1.goto(team.name, channel.name);
    const targetWiki = await createWikiThroughUI(page1, `Target Wiki ${pw.random.id()}`);

    // # Create user2 and add to channel
    const {user: user2, userId: user2Id} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

    // # User 2 logs in and navigates to the target wiki
    const {page: user2Page} = await pw.testBrowser.login(user2);
    await navigateToWikiView(user2Page, pw.url, team.name, channel.id, targetWiki.id);

    // # Wait for hierarchy panel to load for user2
    const user2HierarchyPanel = getHierarchyPanel(user2Page);

    // * Verify target wiki is empty
    const emptyState = user2HierarchyPanel.locator('text="No pages yet"');
    await expect(emptyState).toBeVisible();

    // # User 1 navigates back to source wiki to move the page
    await navigateToWikiView(page1, pw.url, team.name, channel.id, sourceWiki.id);

    // # User 1 moves page to target wiki using helper
    const moveModal = await openMovePageModal(page1, pageTitle);

    // # Select target wiki from dropdown
    const wikiSelect = moveModal.locator('#target-wiki-select');
    await wikiSelect.selectOption(targetWiki.id);

    // # Confirm move
    const confirmButton = moveModal.getByRole('button', {name: 'Move'});
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();

    // # Wait for modal to close
    await expect(moveModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});
    await page1.waitForLoadState('networkidle');
    await page1.waitForTimeout(EDITOR_LOAD_WAIT);

    // * Verify the moved page appears in user2's target wiki hierarchy WITHOUT refresh
    const user2PageNode = user2HierarchyPanel.locator('[data-testid="page-tree-node"]').filter({hasText: pageTitle});
    await expect(user2PageNode).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify user2 can click on the page and view it
    await user2PageNode.click();
    await user2Page.waitForLoadState('networkidle');
    const pageContent = user2Page.locator('[data-testid="page-viewer-content"]');
    await expect(pageContent).toContainText('This page will be moved');
});

/**
 * @objective Verify viewing user sees page update in real-time when another user publishes
 *
 * @precondition
 * Pages/Wiki feature is enabled on the server
 * Two users have access to the same channel
 */
test('updates page content in real-time when another user publishes', {tag: '@pages'}, async ({pw, context, sharedPagesSetup}) => {
    const {team, user: user1, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    // # User 1 creates wiki and publishes a page
    const {page: page1, channelsPage: channelsPage1} = await pw.testBrowser.login(user1);
    await channelsPage1.goto(team.name, channel.name);
    await channelsPage1.toBeVisible();

    const wiki = await createWikiThroughUI(page1, `Test Wiki ${pw.random.id()}`);
    const pageTitle = `Realtime Update Test ${pw.random.id()}`;
    const originalContent = 'Original version 1';
    const createdPage = await createPageThroughUI(page1, pageTitle, originalContent);

    // # Create user2 and add to channel
    const {user: user2, userId: user2Id} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

    // # User 2 logs in and navigates to the page (viewing mode)
    const {page: user2Page} = await pw.testBrowser.login(user2);
    const wikiPageUrl = `${pw.url}/${team.name}/wiki/${channel.id}/${wiki.id}/${createdPage.id}`;
    await user2Page.goto(wikiPageUrl);
    await user2Page.waitForLoadState('networkidle');

    // * Verify User 2 sees original content
    const user2PageContent = user2Page.locator('[data-testid="page-viewer-content"]');
    await expect(user2PageContent).toBeVisible({timeout: HIERARCHY_TIMEOUT});
    await expect(user2PageContent).toContainText(originalContent);

    // # User 1 navigates back to the page
    const hierarchyPanel1 = page1.locator('[data-testid="pages-hierarchy-panel"]');
    const pageNode1 = hierarchyPanel1.locator('[data-testid="page-tree-node"]').filter({hasText: pageTitle});
    await pageNode1.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    await pageNode1.click();
    await page1.waitForLoadState('networkidle');
    await page1.waitForTimeout(EDITOR_LOAD_WAIT);

    // # User 1 edits and publishes new content
    const editButton1 = page1.locator('[data-testid="wiki-page-edit-button"]').first();
    await editButton1.click();

    const editor1 = page1.locator('.ProseMirror').first();
    await editor1.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    await editor1.click();
    const updatedContent = 'Updated version 2 - changed by User 1';
    await editor1.fill(updatedContent);

    const publishButton1 = page1.locator('[data-testid="wiki-page-publish-button"]').first();
    await publishButton1.click();
    await page1.waitForLoadState('networkidle');
    await page1.waitForTimeout(AUTOSAVE_WAIT);

    // * Verify User 2 sees the updated content WITHOUT refreshing the page
    await expect(user2PageContent).toContainText(updatedContent, {timeout: HIERARCHY_TIMEOUT});
    await expect(user2PageContent).not.toContainText(originalContent);

    await user2Page.close();
});

/**
 * @objective Verify page content updates in real-time for passive viewers through multiple edit cycles
 *
 * @precondition
 * Pages/Wiki feature is enabled on the server
 * Two users have access to the same channel
 */
test('shows updated content without refresh when page is modified multiple times', {tag: '@pages'}, async ({pw, context, sharedPagesSetup}) => {
    const {team, user: user1, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    // # User 1 creates wiki and publishes a page
    const {page: page1, channelsPage: channelsPage1} = await pw.testBrowser.login(user1);
    await channelsPage1.goto(team.name, channel.name);
    await channelsPage1.toBeVisible();

    const wiki = await createWikiThroughUI(page1, `Multi-Edit Wiki ${pw.random.id()}`);
    const pageTitle = `Multi-Edit Page ${pw.random.id()}`;
    const version1 = 'Version 1 content';
    const createdPage = await createPageThroughUI(page1, pageTitle, version1);

    // # Create user2 and add to channel
    const {user: user2, userId: user2Id} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

    // # User 2 logs in and views the page
    const {page: user2Page} = await pw.testBrowser.login(user2);
    const wikiPageUrl = `${pw.url}/${team.name}/wiki/${channel.id}/${wiki.id}/${createdPage.id}`;
    await user2Page.goto(wikiPageUrl);
    await user2Page.waitForLoadState('networkidle');

    const user2PageContent = user2Page.locator('[data-testid="page-viewer-content"]');
    await expect(user2PageContent).toBeVisible({timeout: HIERARCHY_TIMEOUT});
    await expect(user2PageContent).toContainText(version1);

    // # User 1 makes first edit
    const hierarchyPanel1 = page1.locator('[data-testid="pages-hierarchy-panel"]');
    const pageNode1 = hierarchyPanel1.locator('[data-testid="page-tree-node"]').filter({hasText: pageTitle});
    await pageNode1.click();
    await page1.waitForLoadState('networkidle');

    const editButton1 = page1.locator('[data-testid="wiki-page-edit-button"]').first();
    await editButton1.click();

    const editor1 = page1.locator('.ProseMirror').first();
    await editor1.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    await editor1.click();

    const version2 = 'Version 2 - first update';
    await editor1.fill(version2);

    const publishButton1 = page1.locator('[data-testid="wiki-page-publish-button"]').first();
    await publishButton1.click();
    await page1.waitForLoadState('networkidle');
    await page1.waitForTimeout(AUTOSAVE_WAIT);

    // * Verify User 2 sees version 2 without refresh
    await expect(user2PageContent).toContainText(version2, {timeout: HIERARCHY_TIMEOUT});
    await expect(user2PageContent).not.toContainText(version1);

    // # User 1 makes second edit
    const editButton2 = page1.locator('[data-testid="wiki-page-edit-button"]').first();
    await editButton2.click();

    const editor2 = page1.locator('.ProseMirror').first();
    await editor2.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    await editor2.click();

    const version3 = 'Version 3 - second update';
    await editor2.fill(version3);

    const publishButton2 = page1.locator('[data-testid="wiki-page-publish-button"]').first();
    await publishButton2.click();
    await page1.waitForLoadState('networkidle');
    await page1.waitForTimeout(AUTOSAVE_WAIT);

    // * Verify User 2 sees version 3 without refresh
    await expect(user2PageContent).toContainText(version3, {timeout: HIERARCHY_TIMEOUT});
    await expect(user2PageContent).not.toContainText(version2);

    // * Verify page URL hasn't changed (no navigation occurred)
    expect(user2Page.url()).toContain(createdPage.id);

    await user2Page.close();
});

/**
 * @objective Verify user sees published version when navigating back after another user publishes
 *
 * @precondition
 * Pages/Wiki feature is enabled on the server
 * Two users have access to the same channel
 */
test('shows published version when navigating back after external publish', {tag: '@pages'}, async ({pw, context, sharedPagesSetup}) => {
    const {team, user: user1, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    // # User 1 creates wiki with two pages
    const {page: page1, channelsPage: channelsPage1} = await pw.testBrowser.login(user1);
    await channelsPage1.goto(team.name, channel.name);
    await channelsPage1.toBeVisible();

    const wiki = await createWikiThroughUI(page1, `Nav Test Wiki ${pw.random.id()}`);
    const pageATitle = `Page A ${pw.random.id()}`;
    const pageBTitle = `Page B ${pw.random.id()}`;
    const pageA = await createPageThroughUI(page1, pageATitle, 'Page A original content');
    const pageB = await createPageThroughUI(page1, pageBTitle, 'Page B content');

    // # Create user2 and add to channel
    const {user: user2, userId: user2Id} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

    // # User 2 logs in and views Page A
    const {page: user2Page} = await pw.testBrowser.login(user2);
    const pageAUrl = `${pw.url}/${team.name}/wiki/${channel.id}/${wiki.id}/${pageA.id}`;
    await user2Page.goto(pageAUrl);
    await user2Page.waitForLoadState('networkidle');

    const user2PageContent = user2Page.locator('[data-testid="page-viewer-content"]');
    await expect(user2PageContent).toContainText('Page A original content');

    // # User 2 navigates to Page B
    const user2HierarchyPanel = user2Page.locator('[data-testid="pages-hierarchy-panel"]');
    const pageBNode = user2HierarchyPanel.locator('[data-testid="page-tree-node"]').filter({hasText: pageBTitle});
    await pageBNode.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    await pageBNode.click();
    await user2Page.waitForLoadState('networkidle');

    // * Verify User 2 now viewing Page B
    await expect(user2PageContent).toContainText('Page B content');

    // # While User 2 is on Page B, User 1 edits and publishes Page A
    const hierarchyPanel1 = page1.locator('[data-testid="pages-hierarchy-panel"]');
    const pageANode1 = hierarchyPanel1.locator('[data-testid="page-tree-node"]').filter({hasText: pageATitle});
    await pageANode1.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    await pageANode1.click();
    await page1.waitForLoadState('networkidle');
    await page1.waitForTimeout(EDITOR_LOAD_WAIT);

    const editButton1 = page1.locator('[data-testid="wiki-page-edit-button"]').first();
    await editButton1.click();

    const editor1 = page1.locator('.ProseMirror').first();
    await editor1.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    await editor1.click();
    const updatedContent = 'Page A UPDATED by User 1';
    await editor1.fill(updatedContent);

    const publishButton1 = page1.locator('[data-testid="wiki-page-publish-button"]').first();
    await publishButton1.click();
    await page1.waitForLoadState('networkidle');
    await page1.waitForTimeout(AUTOSAVE_WAIT);

    // # User 2 navigates back to Page A (using hierarchy panel)
    const pageANode2 = user2HierarchyPanel.locator('[data-testid="page-tree-node"]').filter({hasText: pageATitle});
    await pageANode2.click();
    await user2Page.waitForLoadState('networkidle');
    await user2Page.waitForTimeout(EDITOR_LOAD_WAIT);

    // * Verify User 2 sees the PUBLISHED version (no draft modal, no old content)
    await expect(user2PageContent).toContainText(updatedContent, {timeout: HIERARCHY_TIMEOUT});
    await expect(user2PageContent).not.toContainText('Page A original content');

    // * Verify no draft modal appeared (Confluence approach - seamless navigation)
    const draftModal = user2Page.locator('.modal-content, [data-testid="unsaved-draft-modal"]');
    await expect(draftModal).not.toBeVisible();

    // * Verify User 2 is in view mode (not edit mode)
    const editButton2 = user2Page.locator('[data-testid="wiki-page-edit-button"]').first();
    await expect(editButton2).toBeVisible();

    await user2Page.close();
});

/**
 * @objective Verify both users see consistent state when navigating to different page and back
 *
 * @precondition
 * Pages/Wiki feature is enabled on the server
 * Two users have access to the same channel
 */
test('shows consistent state when both users navigate away and return to same page', {tag: '@pages'}, async ({pw, context, sharedPagesSetup}) => {
    const {team, user: user1, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    // # User 1 creates wiki with three pages
    const {page: page1, channelsPage: channelsPage1} = await pw.testBrowser.login(user1);
    await channelsPage1.goto(team.name, channel.name);
    await channelsPage1.toBeVisible();

    const wiki = await createWikiThroughUI(page1, `Navigation Wiki ${pw.random.id()}`);
    const pageATitle = `Page A ${pw.random.id()}`;
    const pageBTitle = `Page B ${pw.random.id()}`;
    const pageCTitle = `Page C ${pw.random.id()}`;

    const pageA = await createPageThroughUI(page1, pageATitle, 'Page A content - version 1');
    const pageB = await createPageThroughUI(page1, pageBTitle, 'Page B content');
    const pageC = await createPageThroughUI(page1, pageCTitle, 'Page C content');

    // # Create user2 and user3, add both to channel
    const {user: user2, userId: user2Id} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');
    const {user: user3, userId: user3Id} = await createTestUserInChannel(pw, adminClient, team, channel, 'user3');

    // # All three users start on Page A
    const pageAUrl = `${pw.url}/${team.name}/wiki/${channel.id}/${wiki.id}/${pageA.id}`;
    await page1.goto(pageAUrl);
    await page1.waitForLoadState('networkidle');

    const {page: user2Page} = await pw.testBrowser.login(user2);
    await user2Page.goto(pageAUrl);
    await user2Page.waitForLoadState('networkidle');

    const {page: user3Page} = await pw.testBrowser.login(user3);
    await user3Page.goto(pageAUrl);
    await user3Page.waitForLoadState('networkidle');

    // * Verify all three see Page A version 1
    const page1Content = page1.locator('[data-testid="page-viewer-content"]');
    const user2PageContent = user2Page.locator('[data-testid="page-viewer-content"]');
    const user3PageContent = user3Page.locator('[data-testid="page-viewer-content"]');
    await expect(page1Content).toContainText('Page A content - version 1');
    await expect(user2PageContent).toContainText('Page A content - version 1');
    await expect(user3PageContent).toContainText('Page A content - version 1');

    // # User 1 and User 2 navigate to Page B (User 3 STAYS on Page A)
    const hierarchyPanel1 = page1.locator('[data-testid="pages-hierarchy-panel"]');
    const pageBNode1 = hierarchyPanel1.locator('[data-testid="page-tree-node"]').filter({hasText: pageBTitle});
    await pageBNode1.click();
    await page1.waitForLoadState('networkidle');

    const user2HierarchyPanel = user2Page.locator('[data-testid="pages-hierarchy-panel"]');
    const pageBNode2 = user2HierarchyPanel.locator('[data-testid="page-tree-node"]').filter({hasText: pageBTitle});
    await pageBNode2.click();
    await user2Page.waitForLoadState('networkidle');

    // * Verify User 1 and User 2 see Page B
    await expect(page1Content).toContainText('Page B content');
    await expect(user2PageContent).toContainText('Page B content');

    // * Verify User 3 still sees Page A
    await expect(user3PageContent).toContainText('Page A content - version 1');

    // # User 1 navigates to Page C (User 2 stays on Page B, User 3 stays on Page A)
    const pageCNode1 = hierarchyPanel1.locator('[data-testid="page-tree-node"]').filter({hasText: pageCTitle});
    await pageCNode1.click();
    await page1.waitForLoadState('networkidle');

    // Publish a new version of Page A via API (simulates another user/session publishing edits)
    // Step 1: Get current page to retrieve update_at timestamp
    const currentPageA = await adminClient.getPost(pageA.id);

    // Step 2: Create a draft for editing the existing page
    const draftId = `draft-${Date.now()}`;
    const newContent = JSON.stringify({
        type: 'doc',
        content: [{
            type: 'paragraph',
            content: [{type: 'text', text: 'Page A content - version 2 (edited)'}],
        }],
    });

    await adminClient.savePageDraft(
        wiki.id,
        draftId,
        newContent,
        pageATitle,
        pageA.id, // pageId - indicates this is editing an existing page
    );

    // Step 3: Publish the draft with base_update_at to avoid conflict detection
    await adminClient.publishPageDraft(
        wiki.id,
        draftId,
        '', // parentId
        pageATitle,
        'version 2 edited', // searchText
        newContent,
        undefined, // pageStatus
        undefined, // force
        currentPageA.update_at, // base_update_at - prevents conflict warning
    );

    await page1.waitForTimeout(EDITOR_LOAD_WAIT); // Allow WebSocket event to propagate

    // * Verify User 3 (who stayed on Page A) receives the update via WebSocket
    await expect(user3PageContent).toContainText('version 2 (edited)', {timeout: HIERARCHY_TIMEOUT});

    // # User 1 and User 2 navigate back to Page A
    const pageANode1 = hierarchyPanel1.locator('[data-testid="page-tree-node"]').filter({hasText: pageATitle});
    await pageANode1.click();
    await page1.waitForLoadState('networkidle');
    await page1.waitForTimeout(SHORT_WAIT);

    const pageANode2 = user2HierarchyPanel.locator('[data-testid="page-tree-node"]').filter({hasText: pageATitle});
    await pageANode2.click();
    await user2Page.waitForLoadState('networkidle');
    await user2Page.waitForTimeout(SHORT_WAIT);

    // * Verify all three users see the SAME updated version (consistent state)
    await expect(page1Content).toContainText('version 2 (edited)', {timeout: HIERARCHY_TIMEOUT});
    await expect(page1Content).not.toContainText('version 1');

    await expect(user2PageContent).toContainText('version 2 (edited)', {timeout: HIERARCHY_TIMEOUT});
    await expect(user2PageContent).not.toContainText('version 1');

    await expect(user3PageContent).toContainText('version 2 (edited)', {timeout: HIERARCHY_TIMEOUT});
    await expect(user3PageContent).not.toContainText('version 1');

    // * Verify all users see the same page URL (same resource)
    expect(page1.url()).toContain(pageA.id);
    expect(user2Page.url()).toContain(pageA.id);
    expect(user3Page.url()).toContain(pageA.id);

    await user2Page.close();
    await user3Page.close();
});

/**
 * @objective Verify that users editing a page (with unsaved drafts) are protected from external page updates
 *
 * @precondition
 * Pages/Wiki feature is enabled on the server
 * Multiple users have access to the same channel
 */
test('protects active drafts from being overwritten by external page publishes', {tag: '@pages'}, async ({pw, context, sharedPagesSetup}) => {
    const {team, user: user1, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    // # User 1 creates a wiki and a page
    const {page: page1, channelsPage: channelsPage1} = await pw.testBrowser.login(user1);
    await channelsPage1.goto(team.name, channel.name);
    await channelsPage1.toBeVisible();

    const wiki = await createWikiThroughUI(page1, `Draft Protection Wiki ${pw.random.id()}`);
    const pageTitle = `Test Page ${pw.random.id()}`;
    const originalContent = 'Original published content';

    const testPage = await createPageThroughUI(page1, pageTitle, originalContent);

    // # Create user2 who will edit the page
    const {user: user2} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');
    const {page: user2Page} = await pw.testBrowser.login(user2);

    // # User 2 navigates to the page and enters edit mode
    await navigateToPage(user2Page, pw.url, team.name, channel.id, wiki.id, testPage.id);
    await enterEditMode(user2Page);

    // # User 2 makes draft changes (not yet published)
    const user2Editor = await getEditorAndWait(user2Page);
    await typeInEditor(user2Page, 'User 2 draft changes - not yet published');
    await user2Page.waitForTimeout(AUTOSAVE_WAIT); // Wait for draft autosave

    // * Verify User 2 sees their draft content in the editor
    const user2EditorContent = await user2Editor.textContent();
    expect(user2EditorContent).toContain('User 2 draft changes');

    // # Meanwhile, User 1 publishes an update to the same page via API
    // First get current page to retrieve update_at timestamp
    const currentPage = await adminClient.getPost(testPage.id);

    const draftId = `draft-${Date.now()}`;
    const externalUpdateContent = JSON.stringify({
        type: 'doc',
        content: [{
            type: 'paragraph',
            content: [{type: 'text', text: 'External update by User 1 - published version 2'}],
        }],
    });

    await adminClient.savePageDraft(wiki.id, draftId, externalUpdateContent, pageTitle, testPage.id);
    await adminClient.publishPageDraft(
        wiki.id,
        draftId,
        '',
        pageTitle,
        'external update',
        externalUpdateContent,
        undefined, // pageStatus
        undefined, // force
        currentPage.update_at, // base_update_at - prevents conflict warning
    );

    await user2Page.waitForTimeout(EDITOR_LOAD_WAIT); // Allow WebSocket event to propagate

    // * Verify User 2's draft content is NOT overwritten (draft isolation)
    const user2EditorAfter = await user2Editor.textContent();
    expect(user2EditorAfter).toContain('User 2 draft changes');
    expect(user2EditorAfter).not.toContain('External update by User 1');

    // # User 1 views the page (not editing) - should see the published version
    await navigateToPage(page1, pw.url, team.name, channel.id, wiki.id, testPage.id);
    await verifyPageContentContains(page1, 'External update by User 1');
    const page1Content = page1.locator('[data-testid="page-viewer-content"]');
    const page1Text = await page1Content.textContent();
    expect(page1Text).not.toContain('User 2 draft changes');

    // # Test scenario 2: User 3 clicks "Edit" on the updated page
    const {user: user3} = await createTestUserInChannel(pw, adminClient, team, channel, 'user3');
    const {page: user3Page} = await pw.testBrowser.login(user3);

    await navigateToPage(user3Page, pw.url, team.name, channel.id, wiki.id, testPage.id);
    await enterEditMode(user3Page);

    // * Verify User 3 starts editing from the latest PUBLISHED version (not User 2's draft)
    const user3Editor = await getEditorAndWait(user3Page);
    const user3InitialContent = await user3Editor.textContent();
    expect(user3InitialContent).toContain('External update by User 1');
    expect(user3InitialContent).not.toContain('User 2 draft changes');

    // # User 3 makes their own draft changes
    await clearEditorContent(user3Page);
    await typeInEditor(user3Page, 'User 3 draft changes on top of published v2');
    await user3Page.waitForTimeout(AUTOSAVE_WAIT);

    // # Another external publish happens (version 3)
    // Get the latest page state (after version 2 was published)
    const currentPageV2 = await adminClient.getPost(testPage.id);

    const draft3Id = `draft-${Date.now()}-v3`;
    const version3Content = JSON.stringify({
        type: 'doc',
        content: [{
            type: 'paragraph',
            content: [{type: 'text', text: 'Version 3 published by admin'}],
        }],
    });

    await adminClient.savePageDraft(wiki.id, draft3Id, version3Content, pageTitle, testPage.id);
    await adminClient.publishPageDraft(
        wiki.id,
        draft3Id,
        '',
        pageTitle,
        'version 3',
        version3Content,
        undefined, // pageStatus
        undefined, // force
        currentPageV2.update_at, // base_update_at - prevents conflict warning
    );

    await user3Page.waitForTimeout(EDITOR_LOAD_WAIT);

    // * Verify BOTH User 2 and User 3 still have their drafts intact (not overwritten by v3)
    const user2EditorAfterV3 = await user2Editor.textContent();
    expect(user2EditorAfterV3).toContain('User 2 draft changes');
    expect(user2EditorAfterV3).not.toContain('Version 3 published by admin');

    const user3EditorAfterV3 = await user3Editor.textContent();
    expect(user3EditorAfterV3).toContain('User 3 draft changes');
    expect(user3EditorAfterV3).not.toContain('Version 3 published by admin');

    // * Verify a viewer (User 1) sees the latest published version (v3)
    await page1.reload();
    await page1.waitForLoadState('networkidle');
    await verifyPageContentContains(page1, 'Version 3 published by admin');
    const page1ContentFinal = await page1.locator('[data-testid="page-viewer-content"]').textContent();
    expect(page1ContentFinal).not.toContain('User 2 draft changes');
    expect(page1ContentFinal).not.toContain('User 3 draft changes');

    await user2Page.close();
    await user3Page.close();
});
