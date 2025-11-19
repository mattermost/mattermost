// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';

import {
    buildWikiPageUrl,
    createWikiThroughUI,
    createPageThroughUI,
    enterEditMode,
    getEditorAndWait,
    publishPage,
    switchToWikiTab,
    verifyPageContentContains,
} from './test_helpers';

/**
 * @objective Verify concurrent edit conflict detection when two users edit same page
 *
 * @precondition
 * Pages/Wiki feature is enabled on the server
 */
test('detects concurrent edit conflict when two users edit same page', {tag: '@pages'}, async ({pw, context, sharedPagesSetup}) => {
    const {team, user: user1, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    // # User 1 creates wiki and page, publishes it
    const {page: page1, channelsPage: channelsPage1} = await pw.testBrowser.login(user1);

    // Setup console logging for User 1
    page1.on('console', (msg) => {
        console.log(`[USER1 CONSOLE ${msg.type()}]:`, msg.text());
    });
    page1.on('pageerror', (error) => {
        console.log(`[USER1 PAGE ERROR]:`, error.message);
    });
    page1.on('requestfailed', (request) => {
        console.log(`[USER1 REQUEST FAILED]:`, request.url(), 'Status:', request.failure()?.errorText);
    });
    page1.on('request', (request) => {
        const url = request.url();
        if (url.includes('/drafts/') || url.includes('/drafts')) {
            console.log(`[USER1 REQUEST]:`, request.method(), url);
        }
    });
    page1.on('response', async (response) => {
        const url = response.url();
        if (url.includes('/drafts/') || url.includes('/drafts')) {
            console.log(`[USER1 RESPONSE]:`, response.status(), response.request().method(), url);
            if (response.status() >= 400) {
                try {
                    const body = await response.text();
                    console.log(`[USER1 RESPONSE BODY]:`, body);
                } catch (e) {
                    // Ignore if we can't read the body
                }
            }
        }
    });

    await channelsPage1.goto(team.name, channel.name);
    await channelsPage1.toBeVisible();

    const wiki = await createWikiThroughUI(page1, `Test Wiki ${pw.random.id()}`);
    const pageTitle = 'Shared Document';
    const page = await createPageThroughUI(page1, pageTitle, 'Original content that will be edited by two users simultaneously');

    // # Click on "Shared Document" in the tree to ensure it's selected
    const hierarchyPanel = page1.locator('[data-testid="pages-hierarchy-panel"]');
    const sharedDocNode = hierarchyPanel.locator('[data-testid="page-tree-node"]').filter({hasText: pageTitle});
    await sharedDocNode.waitFor({state: 'visible', timeout: 5000});
    await sharedDocNode.click();

    // # Wait for page to fully load after clicking the node
    await page1.waitForLoadState('networkidle');
    await page1.waitForTimeout(1000);

    // # User 1 enters edit mode (editing the published page)
    await enterEditMode(page1);

    // # Create user2 and add to channel (using pw.random.user pattern)
    const user2 = pw.random.user('user2');
    const {id: user2Id} = await adminClient.createUser(user2, '', '');
    await adminClient.addToTeam(team.id, user2Id);
    await adminClient.addToChannel(user2Id, channel.id);

    const {page: user2Page, channelsPage: channelsPage2} = await pw.testBrowser.login(user2);

    // # Navigate directly to the wiki page URL
    const wikiPageUrl = `${pw.url}/${team.name}/wiki/${channel.id}/${wiki.id}/${page.id}`;
    await user2Page.goto(wikiPageUrl);
    await user2Page.waitForLoadState('networkidle');

    // # Wait for hierarchy panel to load
    const user2HierarchyPanel = user2Page.locator('[data-testid="pages-hierarchy-panel"]');
    await user2HierarchyPanel.waitFor({state: 'visible', timeout: 10000});

    // # Click on the page in hierarchy to open it
    const pageNode = user2HierarchyPanel.locator('[data-testid="page-tree-node"]').filter({hasText: pageTitle});
    await pageNode.waitFor({state: 'visible', timeout: 5000});
    await pageNode.click();

    // # Wait for page to load
    await user2Page.waitForTimeout(1000);

    // # User 2 enters edit mode
    await enterEditMode(user2Page);

    // # Verify User 1 is still in edit mode (should have editor visible)
    const user1Editor = page1.locator('.ProseMirror').first();
    await expect(user1Editor).toBeVisible({timeout: 5000});

    // # User 1 makes changes and publishes
    const editor1 = await getEditorAndWait(page1);
    await editor1.click();
    await editor1.pressSequentially(' - User 1 addition');
    await publishPage(page1);
    await page1.waitForTimeout(2000);

    // * Verify User 1's publish succeeds
    await page1.waitForLoadState('networkidle');
    const pageContent1 = page1.locator('[data-testid="page-content"], [data-testid="page-viewer"], .wiki-page-content').first();
    await expect(pageContent1).toContainText('User 1 addition');

    // # User 2 makes different changes and tries to publish
    const editor2 = await getEditorAndWait(user2Page);
    await editor2.click();
    await editor2.pressSequentially(' - User 2 addition');

    // Don't use publishPage helper since we expect a conflict modal, not view mode transition
    const publishButton2 = user2Page.locator('[data-testid="wiki-page-publish-button"]').first();
    await publishButton2.click();
    await user2Page.waitForLoadState('networkidle');

    // Wait a moment for React to render the modal
    await user2Page.waitForTimeout(1000);

    // * Verify conflict warning appears
    // Try multiple selectors to find the modal
    const conflictModal = user2Page.locator('.conflict-warning-modal, .modal:has-text("Page Was Modified")').first();

    // Wait for either the modal or check if publish succeeded (implementation-specific)
    await pw.waitUntil(
        async () => {
            return await conflictModal.isVisible();
        },
        {timeout: 10000},
    );

    // * Verify conflict message exists somewhere in the UI
    await expect(conflictModal).toBeVisible();
    await expect(conflictModal).toContainText(/conflict|modified|changed/i);

    // * Verify modal has action buttons (View Changes, Copy Content, Overwrite, Cancel)
    await expect(conflictModal.getByRole('button', {name: /View Changes/i})).toBeVisible();
    await expect(conflictModal.getByRole('button', {name: /Copy.*Content/i})).toBeVisible();
    await expect(conflictModal.getByRole('button', {name: /Overwrite/i})).toBeVisible();
    await expect(conflictModal.getByRole('button', {name: /Cancel/i})).toBeVisible();
});

/**
 * @objective Verify user can refresh editor to see latest changes during conflict
 */
test.skip('allows user to refresh and see latest changes during conflict', {tag: '@pages'}, async ({pw, context, sharedPagesSetup}) => {
    const {team, user: user1, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    // # User 1 creates wiki and page through UI
    const {page: page1} = await pw.testBrowser.login(user1);
    const {channelsPage} = await pw.testBrowser.login(user1, {page: page1});
    await channelsPage.goto(team.name, channel.name);

    const wiki = await createWikiThroughUI(page1, `Conflict Wiki ${pw.random.id()}`);
    const page = await createPageThroughUI(page1, 'Conflict Page', 'Base content here');

    // # Create user2 and add to channel
    const user2 = await adminClient.createUser({
        username: `testuser${pw.random.id()}`,
        email: `testuser${pw.random.id()}@example.com`,
        password: 'Password123!',
    }, '', '');
    user2.password = 'Password123!';

    await adminClient.addToTeam(team.id, user2.id);
    await adminClient.addToChannel(user2.id, channel.id);

    const editButton1 = page1.locator('[data-testid="wiki-page-edit-button"]').first();
    await expect(editButton1).toBeVisible();
    await editButton1.click();

    const user2Page = await context.newPage();
    await pw.testBrowser.login(user2, {page: user2Page});
    await user2Page.goto(`${pw.url}/${team.name}/channels/${channel.name}/wikis/${wiki.id}/pages/${page.id}`);
    await user2Page.waitForLoadState('networkidle');

    const editButton2 = user2Page.locator('[data-testid="wiki-page-edit-button"]').first();
    await expect(editButton2).toBeVisible();
    await editButton2.click();

    // # User 1 publishes first
    const editor1 = page1.locator('.ProseMirror').first();
    await editor1.click();
    await editor1.pressSequentially(' User 1 changes');

    const publishButton1 = page1.locator('[data-testid="wiki-page-publish-button"]').first();
    await publishButton1.click();
    await page1.waitForLoadState('networkidle');

    // # User 2 tries to publish
    const editor2 = user2Page.locator('.ProseMirror').first();
    await editor2.click();
    await editor2.pressSequentially(' User 2 changes');

    const publishButton2 = user2Page.locator('[data-testid="wiki-page-publish-button"]').first();
    await publishButton2.click();

    // # Look for refresh/reload option (implementation-specific)
    const refreshButton = user2Page.locator('button:has-text("Refresh"), button:has-text("Reload")').first();

    await expect(refreshButton).toBeVisible({timeout: 5000});
    await refreshButton.click();

    // * Verify User 2's editor reloads with User 1's changes
    await user2Page.waitForLoadState('networkidle');
    const editorContent2 = user2Page.locator('.ProseMirror').first();
    await expect(editorContent2).toContainText('User 1 changes');
});

/**
 * @objective Verify user can overwrite during conflict with confirmation
 */
test.skip('allows user to overwrite during conflict with confirmation', {tag: '@pages'}, async ({pw, context, sharedPagesSetup}) => {
    const {team, user: user1, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    // # User 1 creates wiki and page through UI
    const {page: page1} = await pw.testBrowser.login(user1);
    const {channelsPage} = await pw.testBrowser.login(user1, {page: page1});
    await channelsPage.goto(team.name, channel.name);

    const wiki = await createWikiThroughUI(page1, `Overwrite Wiki ${pw.random.id()}`);
    const page = await createPageThroughUI(page1, 'Overwrite Test', 'Original text');

    // # Create user2 and add to channel
    const user2 = await adminClient.createUser({
        username: `testuser${pw.random.id()}`,
        email: `testuser${pw.random.id()}@example.com`,
        password: 'Password123!',
    }, '', '');
    user2.password = 'Password123!';

    await adminClient.addToTeam(team.id, user2.id);
    await adminClient.addToChannel(user2.id, channel.id);

    const editButton1 = page1.locator('[data-testid="wiki-page-edit-button"]').first();
    await expect(editButton1).toBeVisible();
    await editButton1.click();

    const user2Page = await context.newPage();
    await pw.testBrowser.login(user2, {page: user2Page});
    await user2Page.goto(`${pw.url}/${team.name}/channels/${channel.name}/wikis/${wiki.id}/pages/${page.id}`);
    await user2Page.waitForLoadState('networkidle');

    const editButton2 = user2Page.locator('[data-testid="wiki-page-edit-button"]').first();
    await expect(editButton2).toBeVisible();
    await editButton2.click();

    // # User 1 publishes
    const editor1 = page1.locator('.ProseMirror').first();
    await editor1.click();
    await editor1.pressSequentially(' - Version A');

    const publishButton1 = page1.locator('[data-testid="wiki-page-publish-button"]').first();
    await publishButton1.click();
    await page1.waitForLoadState('networkidle');

    // # User 2 tries to overwrite
    const editor2 = user2Page.locator('.ProseMirror').first();
    await editor2.click();
    await editor2.pressSequentially(' - Version B');

    const publishButton2 = user2Page.locator('[data-testid="wiki-page-publish-button"]').first();
    await publishButton2.click();

    // # Look for overwrite button (implementation-specific)
    const overwriteButton = user2Page.locator('button:has-text("Overwrite"), button:has-text("Force")').first();

    await expect(overwriteButton).toBeVisible({timeout: 5000});
    await overwriteButton.click();

    // * Check for confirmation dialog
    const confirmButton = user2Page.locator('[data-testid="confirm-button"], button:has-text("Yes")').first();
    await expect(confirmButton).toBeVisible({timeout: 3000});
    await confirmButton.click();

    // * Verify User 2's version is saved
    await user2Page.waitForLoadState('networkidle');
    const pageContent = user2Page.locator('[data-testid="page-content"], [data-testid="page-viewer"], .wiki-page-content').first();
    await expect(pageContent).toContainText('Version B');
});

/**
 * @objective Verify visual indicator when another user is editing same page
 */
test.skip('shows visual indicator when another user is editing same page', {tag: '@pages'}, async ({pw, context, sharedPagesSetup}) => {
    const {team, user: user1, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    // # User 1 creates wiki and page through UI
    const {page: page1} = await pw.testBrowser.login(user1);
    const {channelsPage} = await pw.testBrowser.login(user1, {page: page1});
    await channelsPage.goto(team.name, channel.name);

    const wiki = await createWikiThroughUI(page1, `Collaborative Wiki ${pw.random.id()}`);
    const page = await createPageThroughUI(page1, 'Collaborative Page', 'Shared content');

    // # Create user2 and add to channel
    const user2 = await adminClient.createUser({
        username: `testuser${pw.random.id()}`,
        email: `testuser${pw.random.id()}@example.com`,
        password: 'Password123!',
    }, '', '');
    user2.password = 'Password123!';

    await adminClient.addToTeam(team.id, user2.id);
    await adminClient.addToChannel(user2.id, channel.id);

    const editButton1 = page1.locator('[data-testid="wiki-page-edit-button"]').first();
    await expect(editButton1).toBeVisible();
    await editButton1.click();

    // # User 2 views same page
    const user2Page = await context.newPage();
    await pw.testBrowser.login(user2, {page: user2Page});
    await user2Page.goto(`${pw.url}/${team.name}/channels/${channel.name}/wikis/${wiki.id}/pages/${page.id}`);
    await user2Page.waitForLoadState('networkidle');

    // * Verify User 2 sees "User 1 is editing" indicator (implementation-specific)
    const editingIndicator = user2Page.locator('[data-testid="editing-indicator"], .editing-indicator').first();

    // Check if indicator exists
    await expect(editingIndicator).toBeVisible({timeout: 5000});
    await expect(editingIndicator).toContainText(user1.username);

    // # User 2 clicks edit
    const editButton2 = user2Page.locator('[data-testid="wiki-page-edit-button"]').first();
    await expect(editButton2).toBeVisible();
    await editButton2.click();

    // * Verify warning appears (implementation-specific)
    const warningBanner = user2Page.locator('[data-testid="concurrent-edit-warning"], .warning, .alert').first();
    await expect(warningBanner).toBeVisible({timeout: 5000});
    await expect(warningBanner).toContainText(/editing|edit/i);
});

/**
 * @objective Verify system handles non-conflicting edits gracefully
 */
test.skip('preserves both users changes when merging non-conflicting edits', {tag: '@pages'}, async ({pw, context, sharedPagesSetup}) => {
    const {team, user: user1, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    // # User 1 creates wiki and page through UI
    const {page: page1} = await pw.testBrowser.login(user1);
    const {channelsPage} = await pw.testBrowser.login(user1, {page: page1});
    await channelsPage.goto(team.name, channel.name);

    const wiki = await createWikiThroughUI(page1, `Merge Wiki ${pw.random.id()}`);
    const page = await createPageThroughUI(page1, 'Merge Test', 'Section A content.\n\nSection B content.');

    // # Create user2 and add to channel
    const user2 = await adminClient.createUser({
        username: `testuser${pw.random.id()}`,
        email: `testuser${pw.random.id()}@example.com`,
        password: 'Password123!',
    }, '', '');
    user2.password = 'Password123!';

    await adminClient.addToTeam(team.id, user2.id);
    await adminClient.addToChannel(user2.id, channel.id);

    const editButton1 = page1.locator('[data-testid="wiki-page-edit-button"]').first();
    await expect(editButton1).toBeVisible();
    await editButton1.click();

    const user2Page = await context.newPage();
    await pw.testBrowser.login(user2, {page: user2Page});
    await user2Page.goto(`${pw.url}/${team.name}/channels/${channel.name}/wikis/${wiki.id}/pages/${page.id}`);
    await user2Page.waitForLoadState('networkidle');

    const editButton2 = user2Page.locator('[data-testid="wiki-page-edit-button"]').first();
    await expect(editButton2).toBeVisible();
    await editButton2.click();

    // # User 1 edits Section A
    const editor1 = page1.locator('.ProseMirror').first();
    await editor1.click();

    // Select and replace "Section A content"
    await page1.keyboard.press('Control+A'); // Select all
    await page1.keyboard.type('Section A modified by User 1\n\nSection B content.');

    const publishButton1 = page1.locator('[data-testid="wiki-page-publish-button"]').first();
    await publishButton1.click();
    await page1.waitForLoadState('networkidle');

    // # User 2 tries to edit Section B (different section)
    const editor2 = user2Page.locator('.ProseMirror').first();
    await editor2.click();

    // Replace content with modified Section B
    await user2Page.keyboard.press('Control+A');
    await user2Page.keyboard.type('Section A content.\n\nSection B modified by User 2');

    const publishButton2 = user2Page.locator('[data-testid="wiki-page-publish-button"]').first();
    await publishButton2.click();

    // * Implementation-specific: Either both changes are preserved (intelligent merging)
    // OR User 2 sees conflict (simple conflict detection)
    // This test documents the expected behavior
    await user2Page.waitForLoadState('networkidle');
});

/**
 * @objective Verify unsaved draft warning when same user opens page in two sessions
 *
 * @precondition
 * Pages/Wiki feature is enabled on the server
 */
test('shows unsaved draft modal when same user edits in two sessions', {tag: '@pages'}, async ({pw, context, sharedPagesSetup}) => {
    const {team, user: user1, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    // # Session 1: Create wiki and page
    const {page: session1, channelsPage: channelsPage1} = await pw.testBrowser.login(user1);
    await channelsPage1.goto(team.name, channel.name);
    await channelsPage1.toBeVisible();

    const wiki = await createWikiThroughUI(session1, `Test Wiki ${pw.random.id()}`);
    const pageTitle = 'Test Page';
    const originalContent = 'Original published content';
    const createdPage = await createPageThroughUI(session1, pageTitle, originalContent);

    // # Session 1: Enter edit mode and modify draft
    await enterEditMode(session1);
    const editor1 = await getEditorAndWait(session1);
    await editor1.click();
    await editor1.fill('Modified draft content from session 1');
    await session1.waitForTimeout(1500); // Wait for auto-save

    // # Session 2: Same user opens page in new browser context (simulates new tab/window)
    const {page: session2} = await pw.testBrowser.login(user1);
    const wikiPageUrl = `${pw.url}/${team.name}/wiki/${channel.id}/${wiki.id}/${createdPage.id}`;
    await session2.goto(wikiPageUrl);
    await session2.waitForLoadState('networkidle');

    // * Verify Session 2 sees published content
    const viewerContent = session2.locator('[data-testid="page-viewer-content"]');
    await viewerContent.waitFor({state: 'visible', timeout: 10000});
    await expect(viewerContent).toContainText(originalContent);

    // # Session 2: Click Edit - should show unsaved draft modal
    const editButton = session2.locator('[data-testid="wiki-page-edit-button"]').first();
    await editButton.click();

    // * Verify unsaved draft modal appears
    const modal = session2.locator('.modal-content');
    await expect(modal).toBeVisible({timeout: 5000});
    await expect(modal).toContainText('Unsaved Draft Exists');
    await expect(modal).toContainText('You have an unsaved draft for this page');

    // * Verify modal has all three buttons
    const resumeButton = session2.locator('[data-testid="unsaved-draft-modal-resume-button"]');
    const discardButton = session2.locator('[data-testid="unsaved-draft-modal-discard-button"]');
    const cancelButton = session2.locator('[data-testid="unsaved-draft-modal-cancel-button"]');

    await expect(resumeButton).toBeVisible();
    await expect(discardButton).toBeVisible();
    await expect(cancelButton).toBeVisible();

    await session2.close();
});

/**
 * @objective Verify Resume Draft button loads existing draft content in second session
 */
test('Resume Draft button loads draft from first session', {tag: '@pages'}, async ({pw, context, sharedPagesSetup}) => {
    const {team, user: user1, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    // # Session 1: Create, publish, and create draft
    const {page: session1, channelsPage: channelsPage1} = await pw.testBrowser.login(user1);
    await channelsPage1.goto(team.name, channel.name);
    await channelsPage1.toBeVisible();

    const wiki = await createWikiThroughUI(session1, `Test Wiki ${pw.random.id()}`);
    const pageTitle = 'Resume Test Page';
    const originalContent = 'Original content';
    const createdPage = await createPageThroughUI(session1, pageTitle, originalContent);

    await enterEditMode(session1);
    const editor1 = await getEditorAndWait(session1);
    const draftContent = 'Unsaved draft content from session 1';
    await editor1.click();
    await editor1.fill(draftContent);
    await session1.waitForTimeout(1500); // Wait for auto-save

    // # Session 2: Open page and click Edit
    const {page: session2} = await pw.testBrowser.login(user1);
    const wikiPageUrl = `${pw.url}/${team.name}/wiki/${channel.id}/${wiki.id}/${createdPage.id}`;
    await session2.goto(wikiPageUrl);
    await session2.waitForLoadState('networkidle');

    const editButton = session2.locator('[data-testid="wiki-page-edit-button"]').first();
    await editButton.click();

    const modal = session2.locator('.modal-content');
    await expect(modal).toBeVisible({timeout: 5000});

    // # Click Resume Draft button
    const resumeButton = session2.locator('[data-testid="unsaved-draft-modal-resume-button"]');
    await resumeButton.click();

    // * Verify modal closes
    await expect(modal).not.toBeVisible();

    // * Verify we're in edit mode with draft content from session 1
    const publishButton = session2.locator('[data-testid="wiki-page-publish-button"]').first();
    await expect(publishButton).toBeVisible();

    const editor2 = await getEditorAndWait(session2);
    await expect(editor2).toContainText(draftContent);

    await session2.close();
});

/**
 * @objective Verify Discard Draft button creates new draft from published content
 */
test('Discard Draft button starts fresh draft in second session', {tag: '@pages'}, async ({pw, context, sharedPagesSetup}) => {
    const {team, user: user1, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    // # Session 1: Create draft
    const {page: session1, channelsPage: channelsPage1} = await pw.testBrowser.login(user1);
    await channelsPage1.goto(team.name, channel.name);
    await channelsPage1.toBeVisible();

    const wiki = await createWikiThroughUI(session1, `Test Wiki ${pw.random.id()}`);
    const pageTitle = 'Discard Test Page';
    const publishedContent = 'Published content';
    const createdPage = await createPageThroughUI(session1, pageTitle, publishedContent);

    await enterEditMode(session1);
    const editor1 = await getEditorAndWait(session1);
    await editor1.click();
    await editor1.fill('Unsaved draft that will be discarded');
    await session1.waitForTimeout(1500); // Wait for auto-save

    // # Session 2: Open and discard draft
    const {page: session2} = await pw.testBrowser.login(user1);
    const wikiPageUrl = `${pw.url}/${team.name}/wiki/${channel.id}/${wiki.id}/${createdPage.id}`;
    await session2.goto(wikiPageUrl);
    await session2.waitForLoadState('networkidle');

    const editButton = session2.locator('[data-testid="wiki-page-edit-button"]').first();
    await editButton.click();

    const modal = session2.locator('.modal-content');
    await expect(modal).toBeVisible({timeout: 5000});

    // # Click Discard Draft button
    const discardButton = session2.locator('[data-testid="unsaved-draft-modal-discard-button"]');
    await discardButton.click();

    // * Verify modal closes
    await expect(modal).not.toBeVisible();

    // * Verify we're in edit mode with published content (discarded old draft)
    const publishButton = session2.locator('[data-testid="wiki-page-publish-button"]').first();
    await expect(publishButton).toBeVisible();

    const editor2 = await getEditorAndWait(session2);
    await expect(editor2).toContainText(publishedContent);

    await session2.close();
});

/**
 * @objective Verify Cancel button closes modal and stays on published page
 */
test('Cancel button closes unsaved draft modal', {tag: '@pages'}, async ({pw, context, sharedPagesSetup}) => {
    const {team, user: user1, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    // # Session 1: Create draft
    const {page: session1, channelsPage: channelsPage1} = await pw.testBrowser.login(user1);
    await channelsPage1.goto(team.name, channel.name);
    await channelsPage1.toBeVisible();

    const wiki = await createWikiThroughUI(session1, `Test Wiki ${pw.random.id()}`);
    const pageTitle = 'Cancel Test Page';
    const publishedContent = 'Published content';
    const createdPage = await createPageThroughUI(session1, pageTitle, publishedContent);

    await enterEditMode(session1);
    const editor1 = await getEditorAndWait(session1);
    await editor1.click();
    await editor1.fill('Unsaved draft content');
    await session1.waitForTimeout(1500); // Wait for auto-save

    // # Session 2: Open and cancel
    const {page: session2} = await pw.testBrowser.login(user1);
    const wikiPageUrl = `${pw.url}/${team.name}/wiki/${channel.id}/${wiki.id}/${createdPage.id}`;
    await session2.goto(wikiPageUrl);
    await session2.waitForLoadState('networkidle');

    const viewerContent = session2.locator('[data-testid="page-viewer-content"]');
    await viewerContent.waitFor({state: 'visible', timeout: 10000});

    const editButton = session2.locator('[data-testid="wiki-page-edit-button"]').first();
    await editButton.click();

    const modal = session2.locator('.modal-content');
    await expect(modal).toBeVisible({timeout: 5000});

    // # Click Cancel button
    const cancelButton = session2.locator('[data-testid="unsaved-draft-modal-cancel-button"]');
    await cancelButton.click();

    // * Verify modal closes
    await expect(modal).not.toBeVisible();

    // * Verify we're still viewing the published page (not in edit mode)
    await expect(viewerContent).toBeVisible();
    await expect(viewerContent).toContainText(publishedContent);

    // * Verify Edit button is still visible (not in edit mode)
    await expect(editButton).toBeVisible();

    await session2.close();
});

/**
 * @objective Verify last-write-wins behavior when manually resolving concurrent edit conflicts via Overwrite
 */
test('applies last-write-wins when saving concurrent edits from multiple tabs', {tag: '@pages'}, async ({pw, context, sharedPagesSetup}) => {
    const {team, user: user1, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    // # User 1: Create wiki and page, then enter edit mode
    const {page: page1, channelsPage: channelsPage1} = await pw.testBrowser.login(user1);
    await channelsPage1.goto(team.name, channel.name);
    await channelsPage1.toBeVisible();

    const wiki = await createWikiThroughUI(page1, `Concurrent Wiki ${pw.random.id()}`);
    const testPage = await createPageThroughUI(page1, 'Concurrent Edit Page', 'Original content');

    // Setup console monitoring for User 1 EARLY to catch openPageInEditMode
    page1.on('console', (msg) => {
        const text = msg.text();
        if (text.includes('openPageInEditMode') || text.includes('baseline') || text.includes('original_page_update_at')) {
            console.log(`[USER1 EARLY CONSOLE ${msg.type()}]:`, text);
        }
    });

    // # User 1: Enter edit mode and make changes (but don't save yet)
    await enterEditMode(page1);
    const editor1 = await getEditorAndWait(page1);
    await editor1.click();
    await page1.keyboard.press('End');
    await editor1.pressSequentially(' - User 1 edit');

    // # Create user2 FIRST (before granting permissions)
    const user2 = pw.random.user('user2');
    const {id: user2Id} = await adminClient.createUser(user2, '', '');
    await adminClient.addToTeam(team.id, user2Id);
    await adminClient.addToChannel(user2Id, channel.id);

    // # Grant page and wiki edit permissions to channel_user role AFTER user is created
    // Note: edit_others_page permissions are needed for User 2 to edit User 1's page
    const channelUserRole = await adminClient.getRoleByName('channel_user');
    await adminClient.patchRole(channelUserRole.id, {
        permissions: [
            ...channelUserRole.permissions,
            'edit_page_public_channel',
            'edit_page_private_channel',
            'edit_others_page_public_channel',
            'edit_others_page_private_channel',
            'edit_wiki_public_channel',
            'edit_wiki_private_channel',
        ],
    });

    // Wait a moment for permission changes to propagate
    await page1.waitForTimeout(1000);

    // # User 2: Login and navigate to the same page
    const {page: page2, channelsPage: channelsPage2} = await pw.testBrowser.login(user2);

    // Setup console monitoring for User 2
    page2.on('console', (msg) => {
        const text = msg.text();
        console.log(`[USER2 CONSOLE ${msg.type()}]:`, text);
    });

    const wikiPageUrl = `${pw.url}/${team.name}/wiki/${channel.id}/${wiki.id}/${testPage.id}`;
    await page2.goto(wikiPageUrl);
    await page2.waitForLoadState('networkidle');

    // # User 2: Enter edit mode
    await enterEditMode(page2);

    // # User 2: Make different changes
    const editor2 = await getEditorAndWait(page2);
    await expect(editor2).toContainText('Original content', {timeout: 5000});
    await editor2.click();
    await page2.keyboard.press('End');
    await editor2.pressSequentially(' - User 2 edit');

    // # Wait for autosave
    await page2.waitForTimeout(2000);

    // * Verify User 2 editor has the expected content before publishing
    await expect(editor2).toContainText('Original content');
    await expect(editor2).toContainText('User 2 edit');

    // # User 2: Click publish button
    const publishButton2 = page2.locator('[data-testid="wiki-page-publish-button"]').first();
    await publishButton2.click();
    await page2.waitForLoadState('networkidle', {timeout: 10000});
    await page2.waitForTimeout(1000);

    // # Check if conflict modal appeared and handle it
    const conflictModal2 = page2.locator('.conflict-warning-modal, .modal:has-text("Page Was Modified")').first();
    const hasConflict = await conflictModal2.isVisible({timeout: 2000}).catch(() => false);

    if (hasConflict) {
        const overwriteButton2 = conflictModal2.getByRole('button', {name: /Overwrite/i});
        await overwriteButton2.click();
        await page2.waitForLoadState('networkidle');
    }

    // * Verify User 2's content was saved via UI
    const pageViewer2 = page2.locator('[data-testid="page-viewer-content"]');
    await expect(pageViewer2).toBeVisible({timeout: 10000});
    await expect(pageViewer2).toContainText('User 2 edit');
    await expect(pageViewer2).toContainText('Original content');

    // # User 1: Wait a bit, then try to publish (should show conflict modal)
    await page1.waitForTimeout(1000);

    // # User 1: Click publish (will show conflict modal since User 2 already saved)
    const publishButton1 = page1.locator('[data-testid="wiki-page-publish-button"]').first();
    await publishButton1.click();
    await page1.waitForLoadState('networkidle');
    await page1.waitForTimeout(1000);

    // # Handle conflict modal - click "Overwrite" to apply last-write-wins
    const conflictModal = page1.locator('.conflict-warning-modal, .modal:has-text("Page Was Modified")').first();

    await expect(conflictModal).toBeVisible({timeout: 10000});
    const overwriteButton = conflictModal.getByRole('button', {name: /Overwrite/i});
    await overwriteButton.click();

    // # Wait for page to transition to view mode after overwrite
    await page1.waitForLoadState('networkidle');
    const pageViewer1 = page1.locator('[data-testid="page-viewer-content"]');
    await expect(pageViewer1).toBeVisible({timeout: 5000});

    // * Verify User 1's content (last write via overwrite) is what persisted
    await expect(pageViewer1).toContainText('User 1 edit');
    await expect(pageViewer1).toContainText('Original content');
    await expect(pageViewer1).not.toContainText('User 2 edit');

    // * Verify via User 2's view - refresh and check that User 1's content is now visible
    await page2.reload();
    await page2.waitForLoadState('networkidle');
    const pageViewer2After = page2.locator('[data-testid="page-viewer-content"]');
    await expect(pageViewer2After).toBeVisible({timeout: 5000});
    await expect(pageViewer2After).toContainText('User 1 edit');
    await expect(pageViewer2After).not.toContainText('User 2 edit');

    await page2.close();
});
