// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';
import {
    buildChannelPageUrl,
    buildWikiPageUrl,
    createWikiThroughUI,
    createPageThroughUI,
    enterEditMode,
    getEditor,
    getEditorAndWait,
    getHierarchyPanel,
    getPageTreeNodeByTitle,
    getPageViewerContent,
    loginAndNavigateToChannel,
    publishPage,
    createTestUserInChannel,
    selectAllText,
    uniqueName,
    withRolePermissions,
    SHORT_WAIT,
    EDITOR_LOAD_WAIT,
    AUTOSAVE_WAIT,
    WEBSOCKET_WAIT,
    ELEMENT_TIMEOUT,
    HIERARCHY_TIMEOUT,
} from './test_helpers';

/**
 * @objective Verify User 2 sees notification when User 1 publishes while User 2 is editing
 *
 * @precondition
 * Pages/Wiki feature is enabled on the server
 */
test.skip(
    'shows notification when another user publishes while editing',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user: user1, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        // # User 1 creates wiki and page
        const {page: page1} = await loginAndNavigateToChannel(pw, user1, team.name, channel.name);

        const wiki = await createWikiThroughUI(page1, uniqueName('Test Wiki'));
        const pageTitle = 'Notification Test Page';
        const testPage = await createPageThroughUI(page1, pageTitle, 'Original content');

        // # Create user2 and add to channel
        const {user: user2} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

        const {page: user2Page} = await pw.testBrowser.login(user2);

        // # User 2 navigates to page and enters edit mode
        const wikiPageUrl = buildWikiPageUrl(pw.url, team.name, channel.id, wiki.id, testPage.id);
        await user2Page.goto(wikiPageUrl);
        await user2Page.waitForLoadState('networkidle');

        const user2HierarchyPanel = getHierarchyPanel(user2Page);
        await user2HierarchyPanel.waitFor({state: 'visible', timeout: HIERARCHY_TIMEOUT});

        const pageNode = getPageTreeNodeByTitle(user2Page, pageTitle);
        await pageNode.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
        await pageNode.click();
        await user2Page.waitForTimeout(EDITOR_LOAD_WAIT);

        await enterEditMode(user2Page);
        const editor2 = await getEditorAndWait(user2Page);

        // # User 2 starts making changes (but doesn't publish yet)
        await editor2.click();
        await editor2.pressSequentially(' - User 2 is typing...');

        // # User 1 enters edit mode and publishes
        const pageNode1 = getPageTreeNodeByTitle(page1, pageTitle);
        await pageNode1.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
        await pageNode1.click();
        await page1.waitForLoadState('networkidle');
        await page1.waitForTimeout(EDITOR_LOAD_WAIT);

        await enterEditMode(page1);
        const editor1 = await getEditorAndWait(page1);
        await editor1.click();
        await editor1.pressSequentially(' - User 1 published changes');
        await publishPage(page1);
        await page1.waitForTimeout(AUTOSAVE_WAIT);

        // * Verify User 1's publish succeeded
        const pageContent1 = getPageViewerContent(page1);
        await expect(pageContent1).toContainText('User 1 published changes');

        // * Verify User 2 sees a notification/banner that page was modified
        // This could be a toast notification, banner, or indicator
        const notification = user2Page
            .locator('.page-modified-notification, .toast, [role="alert"], .alert, .banner')
            .first();
        await expect(notification).toBeVisible({timeout: HIERARCHY_TIMEOUT});
        await expect(notification).toContainText(/modified|updated|changed|published/i);

        // * Verify User 2 is still in edit mode (not kicked out)
        const publishButton2 = user2Page.locator('[data-testid="wiki-page-publish-button"]').first();
        await expect(publishButton2).toBeVisible();

        // * Verify User 2's draft changes are still preserved
        await expect(editor2).toContainText('User 2 is typing');

        await user2Page.close();
    },
);

/**
 * @objective Verify user can refresh editor to see latest changes during conflict
 */
test.skip(
    'allows user to refresh and see latest changes during conflict',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user: user1, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        // # User 1 creates wiki and page through UI
        const {page: page1} = await loginAndNavigateToChannel(pw, user1, team.name, channel.name);

        const wiki = await createWikiThroughUI(page1, uniqueName('Conflict Wiki'));
        const testPage = await createPageThroughUI(page1, 'Conflict Page', 'Base content here');

        // # Create user2 and add to channel
        const {user: user2} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

        const editButton1 = page1.locator('[data-testid="wiki-page-edit-button"]').first();
        await expect(editButton1).toBeVisible();
        await editButton1.click();

        const {page: user2Page} = await pw.testBrowser.login(user2);
        await user2Page.goto(buildChannelPageUrl(pw.url, team.name, channel.name, wiki.id, testPage.id));
        await user2Page.waitForLoadState('networkidle');

        const editButton2 = user2Page.locator('[data-testid="wiki-page-edit-button"]').first();
        await expect(editButton2).toBeVisible();
        await editButton2.click();

        // # User 1 publishes first
        const editor1 = getEditor(page1);
        await editor1.click();
        await editor1.pressSequentially(' User 1 changes');

        const publishButton1 = page1.locator('[data-testid="wiki-page-publish-button"]').first();
        await publishButton1.click();
        await page1.waitForLoadState('networkidle');

        // # User 2 tries to publish
        const editor2 = getEditor(user2Page);
        await editor2.click();
        await editor2.pressSequentially(' User 2 changes');

        const publishButton2 = user2Page.locator('[data-testid="wiki-page-publish-button"]').first();
        await publishButton2.click();

        // # Look for refresh/reload option (implementation-specific)
        const refreshButton = user2Page.locator('button:has-text("Refresh"), button:has-text("Reload")').first();

        await expect(refreshButton).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await refreshButton.click();

        // * Verify User 2's editor reloads with User 1's changes
        await user2Page.waitForLoadState('networkidle');
        const editorContent2 = getEditor(user2Page);
        await expect(editorContent2).toContainText('User 1 changes');
    },
);

/**
 * @objective Verify user can overwrite during conflict with confirmation
 */
test.skip(
    'allows user to overwrite during conflict with confirmation',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user: user1, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        // # User 1 creates wiki and page through UI
        const {page: page1} = await loginAndNavigateToChannel(pw, user1, team.name, channel.name);

        const wiki = await createWikiThroughUI(page1, uniqueName('Overwrite Wiki'));
        const testPage = await createPageThroughUI(page1, 'Overwrite Test', 'Original text');

        // # Create user2 and add to channel
        const {user: user2} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

        const editButton1 = page1.locator('[data-testid="wiki-page-edit-button"]').first();
        await expect(editButton1).toBeVisible();
        await editButton1.click();

        const {page: user2Page} = await pw.testBrowser.login(user2);
        await user2Page.goto(buildChannelPageUrl(pw.url, team.name, channel.name, wiki.id, testPage.id));
        await user2Page.waitForLoadState('networkidle');

        const editButton2 = user2Page.locator('[data-testid="wiki-page-edit-button"]').first();
        await expect(editButton2).toBeVisible();
        await editButton2.click();

        // # User 1 publishes
        const editor1 = getEditor(page1);
        await editor1.click();
        await editor1.pressSequentially(' - Version A');

        const publishButton1 = page1.locator('[data-testid="wiki-page-publish-button"]').first();
        await publishButton1.click();
        await page1.waitForLoadState('networkidle');

        // # User 2 tries to overwrite
        const editor2 = getEditor(user2Page);
        await editor2.click();
        await editor2.pressSequentially(' - Version B');

        const publishButton2 = user2Page.locator('[data-testid="wiki-page-publish-button"]').first();
        await publishButton2.click();

        // # Look for overwrite button (implementation-specific)
        const overwriteButton = user2Page.locator('button:has-text("Overwrite"), button:has-text("Force")').first();

        await expect(overwriteButton).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await overwriteButton.click();

        // * Check for confirmation dialog
        const confirmButton = user2Page.locator('[data-testid="confirm-button"], button:has-text("Yes")').first();
        await expect(confirmButton).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await confirmButton.click();

        // * Verify User 2's version is saved
        await user2Page.waitForLoadState('networkidle');
        const pageContent = user2Page
            .locator('[data-testid="page-content"], [data-testid="page-viewer"], .wiki-page-content')
            .first();
        await expect(pageContent).toContainText('Version B');
    },
);

/**
 * @objective Verify visual indicator when another user is editing same page
 */
test.skip(
    'shows visual indicator when another user is editing same page',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user: user1, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        // # User 1 creates wiki and page through UI
        const {page: page1} = await loginAndNavigateToChannel(pw, user1, team.name, channel.name);

        const wiki = await createWikiThroughUI(page1, uniqueName('Collaborative Wiki'));
        const testPage = await createPageThroughUI(page1, 'Collaborative Page', 'Shared content');

        // # Create user2 and add to channel
        const {user: user2} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

        const editButton1 = page1.locator('[data-testid="wiki-page-edit-button"]').first();
        await expect(editButton1).toBeVisible();
        await editButton1.click();

        // # User 2 views same page
        const {page: user2Page} = await pw.testBrowser.login(user2);
        await user2Page.goto(buildChannelPageUrl(pw.url, team.name, channel.name, wiki.id, testPage.id));
        await user2Page.waitForLoadState('networkidle');

        // * Verify User 2 sees "User 1 is editing" indicator (implementation-specific)
        const editingIndicator = user2Page.locator('[data-testid="editing-indicator"], .editing-indicator').first();

        // Check if indicator exists
        await expect(editingIndicator).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await expect(editingIndicator).toContainText(user1.username);

        // # User 2 clicks edit
        const editButton2 = user2Page.locator('[data-testid="wiki-page-edit-button"]').first();
        await expect(editButton2).toBeVisible();
        await editButton2.click();

        // * Verify warning appears (implementation-specific)
        const warningBanner = user2Page.locator('[data-testid="concurrent-edit-warning"], .warning, .alert').first();
        await expect(warningBanner).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await expect(warningBanner).toContainText(/editing|edit/i);
    },
);

/**
 * @objective Verify system handles non-conflicting edits gracefully
 *
 * @precondition
 * Intelligent merging is implemented (currently not available - this test documents expected behavior)
 */
test.skip(
    'preserves both users changes when merging non-conflicting edits',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        // SKIPPED: This test documents expected behavior for intelligent merging of non-conflicting edits.
        // Currently, the system uses simple conflict detection (version-based) which shows a conflict
        // modal even when edits are in different sections. Intelligent merging would require:
        // 1. Diff-based conflict detection at the section/paragraph level
        // 2. Automatic merging when changes don't overlap
        // This test should be unskipped when intelligent merging is implemented.

        const {team, user: user1, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        // # User 1 creates wiki and page through UI
        const {page: page1} = await loginAndNavigateToChannel(pw, user1, team.name, channel.name);

        const wiki = await createWikiThroughUI(page1, uniqueName('Merge Wiki'));
        const testPage = await createPageThroughUI(page1, 'Merge Test', 'Section A content.\n\nSection B content.');

        // # Create user2 and add to channel
        const {user: user2} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

        const editButton1 = page1.locator('[data-testid="wiki-page-edit-button"]').first();
        await expect(editButton1).toBeVisible();
        await editButton1.click();

        const {page: user2Page} = await pw.testBrowser.login(user2);
        await user2Page.goto(buildChannelPageUrl(pw.url, team.name, channel.name, wiki.id, testPage.id));
        await user2Page.waitForLoadState('networkidle');

        const editButton2 = user2Page.locator('[data-testid="wiki-page-edit-button"]').first();
        await expect(editButton2).toBeVisible();
        await editButton2.click();

        // # User 1 edits Section A
        const editor1 = getEditor(page1);
        await editor1.click();

        // Select and replace "Section A content"
        await selectAllText(page1);
        await page1.keyboard.type('Section A modified by User 1\n\nSection B content.');

        const publishButton1 = page1.locator('[data-testid="wiki-page-publish-button"]').first();
        await publishButton1.click();
        await page1.waitForLoadState('networkidle');

        // # User 2 tries to edit Section B (different section)
        const editor2 = getEditor(user2Page);
        await editor2.click();

        // Replace content with modified Section B
        await selectAllText(user2Page);
        await user2Page.keyboard.type('Section A content.\n\nSection B modified by User 2');

        const publishButton2 = user2Page.locator('[data-testid="wiki-page-publish-button"]').first();
        await publishButton2.click();
        await user2Page.waitForLoadState('networkidle');
        await user2Page.waitForTimeout(EDITOR_LOAD_WAIT);

        // * With intelligent merging: Both changes should be preserved
        // Check if conflict modal appears (current behavior) or changes merged (expected behavior)
        const conflictModal = user2Page.locator('.conflict-warning-modal, .modal:has-text("Page conflict")').first();
        const hasConflict = await conflictModal.isVisible({timeout: WEBSOCKET_WAIT}).catch(() => false);

        if (hasConflict) {
            // Current behavior: Simple conflict detection shows conflict modal
            // User 2 should choose to overwrite to save their changes
            const overwriteOption = conflictModal
                .locator('button.conflict-option')
                .filter({hasText: 'Overwrite published version'});
            await overwriteOption.click();
            const overwriteButton = conflictModal.getByRole('button', {name: /Overwrite page/i});
            await overwriteButton.click();
            await user2Page.waitForLoadState('networkidle');
        }

        // * Verify User 2's content was saved
        const pageViewer2 = getPageViewerContent(user2Page);
        await expect(pageViewer2).toBeVisible({timeout: HIERARCHY_TIMEOUT});
        await expect(pageViewer2).toContainText('Section B modified by User 2');

        // * Verify via API that the page was saved (authoritative check)
        const serverPage = await adminClient.getPage(wiki.id, testPage.id);
        expect(serverPage.message).toContain('Section B modified by User 2');

        // Note: With simple conflict detection, User 1's changes may be lost
        // With intelligent merging, both changes would be preserved:
        // expect(serverPage.message).toContain('Section A modified by User 1');
        // expect(serverPage.message).toContain('Section B modified by User 2');

        await user2Page.close();
    },
);

/**
 * @objective Verify first-write-wins behavior when concurrent edits occur from multiple tabs
 */
test(
    'applies first-write-wins when saving concurrent edits from multiple tabs',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user: user1, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        // # User 1: Create wiki and page, then enter edit mode
        const {page: page1} = await loginAndNavigateToChannel(pw, user1, team.name, channel.name);

        const wiki = await createWikiThroughUI(page1, uniqueName('Concurrent Wiki'));
        const testPage = await createPageThroughUI(page1, 'Concurrent Edit Page', 'Original content');

        // # User 1: Enter edit mode and make changes (but don't save yet)
        await enterEditMode(page1);
        const editor1 = await getEditorAndWait(page1);
        await editor1.click();
        await page1.keyboard.press('End');
        await editor1.pressSequentially(' - User 1 edit');

        // # Create user2 FIRST (before granting permissions)
        const {user: user2} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

        // # Grant page edit and wiki (channel properties) permissions to channel_user role AFTER user is created
        // Wiki operations now use manage_*_channel_properties permissions
        const restorePermissions = await withRolePermissions(adminClient, 'channel_user', [
            'edit_page',
            'manage_public_channel_properties',
            'manage_private_channel_properties',
        ]);

        // Wait a moment for permission changes to propagate
        await page1.waitForTimeout(EDITOR_LOAD_WAIT);

        // # User 2: Login and navigate to the same page
        const {page: page2} = await pw.testBrowser.login(user2);

        const wikiPageUrl = buildWikiPageUrl(pw.url, team.name, channel.id, wiki.id, testPage.id);
        await page2.goto(wikiPageUrl);
        await page2.waitForLoadState('networkidle');

        // # User 2: Enter edit mode
        await enterEditMode(page2);

        // # User 2: Make different changes
        const editor2 = await getEditorAndWait(page2);
        const user2InitialContent = await editor2.textContent();
        // User 2 should see the original published content, not User 1's draft
        expect(user2InitialContent).toBe('Original content');
        await editor2.click();
        await page2.keyboard.press('End');
        await editor2.pressSequentially(' - User 2 edit');

        // # Wait for autosave
        await page2.waitForTimeout(WEBSOCKET_WAIT);

        // * Verify User 2 editor has the expected content before publishing
        await expect(editor2).toContainText('Original content');
        await expect(editor2).toContainText('User 2 edit');

        // # User 2: Click publish button
        const publishButton2 = page2.locator('[data-testid="wiki-page-publish-button"]').first();
        await publishButton2.click();
        await page2.waitForLoadState('networkidle', {timeout: HIERARCHY_TIMEOUT});
        await page2.waitForTimeout(EDITOR_LOAD_WAIT);

        // # Check if conflict modal appeared and handle it
        const conflictModal2 = page2.locator('.conflict-warning-modal, .modal:has-text("Page conflict")').first();
        const hasConflict = await conflictModal2.isVisible({timeout: WEBSOCKET_WAIT}).catch(() => false);

        if (hasConflict) {
            // Select "Overwrite published version" option
            const overwriteOption2 = conflictModal2
                .locator('button.conflict-option')
                .filter({hasText: 'Overwrite published version'});
            await overwriteOption2.click();
            // Confirm by clicking "Overwrite page" button
            const overwriteButton2 = conflictModal2.getByRole('button', {name: /Overwrite page/i});
            await overwriteButton2.click();
            await page2.waitForLoadState('networkidle');
        }

        // * Verify User 2's content was saved via UI (first write wins)
        const pageViewer2 = getPageViewerContent(page2);
        await expect(pageViewer2).toBeVisible({timeout: HIERARCHY_TIMEOUT});
        await expect(pageViewer2).toContainText('User 2 edit');
        await expect(pageViewer2).toContainText('Original content');

        // # User 1: Wait a bit, then try to publish (should show conflict modal)
        await page1.waitForTimeout(EDITOR_LOAD_WAIT);

        // # User 1: Click publish (will show conflict modal since User 2 already saved)
        const publishButton1 = page1.locator('[data-testid="wiki-page-publish-button"]').first();
        await publishButton1.click();
        await page1.waitForLoadState('networkidle');
        await page1.waitForTimeout(EDITOR_LOAD_WAIT);

        // * Verify conflict modal appears for User 1 (first-write-wins prevents automatic overwrite)
        const conflictModal = page1.locator('.conflict-warning-modal, .modal:has-text("Page conflict")').first();
        await expect(conflictModal).toBeVisible({timeout: HIERARCHY_TIMEOUT});

        // # User 1: Click Back to editing to preserve first-write-wins behavior
        const cancelButton = conflictModal.getByRole('button', {name: /Back to editing/i});
        await cancelButton.click();
        await page1.waitForTimeout(SHORT_WAIT);

        // * Verify modal closes
        await expect(conflictModal).not.toBeVisible();

        // * Verify User 1 is still in edit mode after canceling with their unsaved changes
        const publishButtonStillVisible = page1.locator('[data-testid="wiki-page-publish-button"]').first();
        await expect(publishButtonStillVisible).toBeVisible();
        const editor1After = await getEditorAndWait(page1);
        await expect(editor1After).toContainText('User 1 edit');

        // * Verify the server has User 2's content (first-write-wins) via API
        // This is the authoritative check - UI caching issues don't affect this
        const serverPage = await adminClient.getPage(wiki.id, testPage.id);
        expect(serverPage.message).toContain('User 2 edit');
        expect(serverPage.message).toContain('Original content');
        expect(serverPage.message).not.toContain('User 1 edit');

        // * Verify via User 2's view - User 2's content remains unchanged
        await page2.reload();
        await page2.waitForLoadState('networkidle');
        const pageViewer2After = getPageViewerContent(page2);
        await expect(pageViewer2After).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await expect(pageViewer2After).toContainText('User 2 edit');
        await expect(pageViewer2After).not.toContainText('User 1 edit');

        await page2.close();

        // # Cleanup: Restore original permissions
        await restorePermissions();
    },
);

/**
 * @objective Verify explicit overwrite with confirmation when user chooses to override first-write-wins
 */
test(
    'allows explicit overwrite after confirmation when user overrides first-write-wins',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user: user1, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        // # User 1: Create wiki and page, then enter edit mode
        const {page: page1} = await loginAndNavigateToChannel(pw, user1, team.name, channel.name);

        const wiki = await createWikiThroughUI(page1, uniqueName('Overwrite Wiki'));
        const testPage = await createPageThroughUI(page1, 'Overwrite Test Page', 'Original content');

        // # User 1: Enter edit mode and make changes (but don't save yet)
        await enterEditMode(page1);
        const editor1 = await getEditorAndWait(page1);
        await editor1.click();
        await page1.keyboard.press('End');
        await editor1.pressSequentially(' - User 1 edit');

        // # Create user2 with permissions
        const {user: user2} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

        // Grant page edit and wiki (channel properties) permissions
        // Wiki operations now use manage_*_channel_properties permissions
        const restorePermissions = await withRolePermissions(adminClient, 'channel_user', [
            'edit_page',
            'manage_public_channel_properties',
            'manage_private_channel_properties',
        ]);

        await page1.waitForTimeout(EDITOR_LOAD_WAIT);

        // # User 2: Login and navigate to the same page
        const {page: page2} = await pw.testBrowser.login(user2);

        const wikiPageUrl = buildWikiPageUrl(pw.url, team.name, channel.id, wiki.id, testPage.id);
        await page2.goto(wikiPageUrl);
        await page2.waitForLoadState('networkidle');

        // # User 2: Enter edit mode
        await enterEditMode(page2);

        // # User 2: Make different changes
        const editor2 = await getEditorAndWait(page2);
        await expect(editor2).toContainText('Original content', {timeout: ELEMENT_TIMEOUT});
        await editor2.click();
        await page2.keyboard.press('End');
        await editor2.pressSequentially(' - User 2 edit');

        // # User 2: Publish (first write wins)
        await page2.waitForTimeout(WEBSOCKET_WAIT);
        const publishButton2 = page2.locator('[data-testid="wiki-page-publish-button"]').first();
        await publishButton2.click();
        await page2.waitForLoadState('networkidle', {timeout: HIERARCHY_TIMEOUT});

        // # Handle conflict modal if it appears for User 2
        const conflictModal2 = page2.locator('.conflict-warning-modal, .modal:has-text("Page conflict")').first();
        const hasConflict = await conflictModal2.isVisible({timeout: WEBSOCKET_WAIT}).catch(() => false);
        if (hasConflict) {
            // Select "Overwrite published version" option
            const overwriteOption2 = conflictModal2
                .locator('button.conflict-option')
                .filter({hasText: 'Overwrite published version'});
            await overwriteOption2.click();
            // Confirm by clicking "Overwrite page" button
            const overwriteButton2 = conflictModal2.getByRole('button', {name: /Overwrite page/i});
            await overwriteButton2.click();
            await page2.waitForLoadState('networkidle');
        }

        // * Verify User 2's content was saved (first write)
        const pageViewer2 = getPageViewerContent(page2);
        await expect(pageViewer2).toBeVisible({timeout: HIERARCHY_TIMEOUT});
        await expect(pageViewer2).toContainText('User 2 edit');

        // # User 1: Try to publish (should show conflict modal)
        await page1.waitForTimeout(EDITOR_LOAD_WAIT);
        const publishButton1 = page1.locator('[data-testid="wiki-page-publish-button"]').first();
        await publishButton1.click();
        await page1.waitForLoadState('networkidle');
        await page1.waitForTimeout(EDITOR_LOAD_WAIT);

        // * Verify conflict modal appears for User 1
        const conflictModal = page1.locator('[data-testid="conflict-warning-modal"]').first();
        await expect(conflictModal).toBeVisible({timeout: HIERARCHY_TIMEOUT});

        // # User 1: Select "Overwrite published version" option
        const overwriteOption = conflictModal
            .locator('button.conflict-option')
            .filter({hasText: 'Overwrite published version'});
        await overwriteOption.click();
        await page1.waitForTimeout(SHORT_WAIT);

        // * Verify "Overwrite page" button is now visible (red button)
        const overwriteButton = conflictModal.getByRole('button', {name: /Overwrite page/i});
        await expect(overwriteButton).toBeVisible();

        // # User 1: Click Overwrite page to confirm
        await overwriteButton.click();

        // * Verify User 1's content now replaces User 2's (escape hatch worked)
        await page1.waitForLoadState('networkidle');
        const pageViewer1 = getPageViewerContent(page1);
        await expect(pageViewer1).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await expect(pageViewer1).toContainText('User 1 edit');
        await expect(pageViewer1).toContainText('Original content');
        await expect(pageViewer1).not.toContainText('User 2 edit');

        // * Verify via User 2's view - User 1's content now visible
        await page2.reload();
        await page2.waitForLoadState('networkidle');
        const pageViewer2After = getPageViewerContent(page2);
        await expect(pageViewer2After).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await expect(pageViewer2After).toContainText('User 1 edit');
        await expect(pageViewer2After).not.toContainText('User 2 edit');

        await page2.close();

        // # Cleanup: Restore original permissions
        await restorePermissions();
    },
);

/**
 * @objective Verify View Changes button shows diff between versions during conflict
 *
 * @precondition
 * Pages/Wiki feature is enabled on the server
 */
/**
 * @objective Verify that clicking "View Their Changes" in the conflict modal opens the published page in a new tab
 *
 * @precondition
 * Two users are editing the same page concurrently
 * User 1 publishes first, creating a conflict for User 2
 */
test.skip(
    'opens published page in new tab when View Changes clicked during conflict',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        // SKIPPED: window.open() with _blank is blocked by browser security in automated tests.
        // The functionality is implemented (see handleConflictViewChanges in hooks.ts) but cannot
        // be reliably tested in Playwright. Manual testing confirms this works correctly.
        const {team, user: user1, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        // # User 1 creates wiki and page
        const {page: page1} = await loginAndNavigateToChannel(pw, user1, team.name, channel.name);

        const wiki = await createWikiThroughUI(page1, uniqueName('Test Wiki'));
        const pageTitle = 'Conflict Test Page';
        const originalContent = 'Original content that both users will modify';
        const createdPage = await createPageThroughUI(page1, pageTitle, originalContent);

        // # User 1 enters edit mode
        const pageNode = getPageTreeNodeByTitle(page1, pageTitle);
        await pageNode.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
        await pageNode.click();
        await page1.waitForLoadState('networkidle');
        await page1.waitForTimeout(EDITOR_LOAD_WAIT);
        await enterEditMode(page1);

        // # Create user2 and add to channel
        const {user: user2} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

        const {page: user2Page} = await pw.testBrowser.login(user2);

        // # User 2 navigates to page and enters edit mode
        const wikiPageUrl = buildWikiPageUrl(pw.url, team.name, channel.id, wiki.id, createdPage.id);
        await user2Page.goto(wikiPageUrl);
        await user2Page.waitForLoadState('networkidle');

        const user2HierarchyPanel = getHierarchyPanel(user2Page);
        await user2HierarchyPanel.waitFor({state: 'visible', timeout: HIERARCHY_TIMEOUT});

        const pageNode2 = getPageTreeNodeByTitle(user2Page, pageTitle);
        await pageNode2.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
        await pageNode2.click();
        await user2Page.waitForTimeout(EDITOR_LOAD_WAIT);
        await enterEditMode(user2Page);

        // # User 1 makes changes and publishes
        const editor1 = await getEditorAndWait(page1);
        await editor1.click();
        await editor1.pressSequentially(' - User 1 version');
        await publishPage(page1);
        await page1.waitForTimeout(AUTOSAVE_WAIT);

        // # User 2 makes different changes and tries to publish
        const editor2 = await getEditorAndWait(user2Page);
        await editor2.click();
        await editor2.pressSequentially(' - User 2 version');

        const publishButton2 = user2Page.locator('[data-testid="wiki-page-publish-button"]').first();
        await publishButton2.click();
        await user2Page.waitForLoadState('networkidle');
        await user2Page.waitForTimeout(EDITOR_LOAD_WAIT);

        // * Verify conflict modal appears
        const conflictModal = user2Page.locator('.conflict-warning-modal, .modal:has-text("Page conflict")').first();
        await pw.waitUntil(
            async () => {
                return await conflictModal.isVisible();
            },
            {timeout: HIERARCHY_TIMEOUT},
        );

        // # Click View Their Changes button and wait for new tab
        const viewChangesButton = conflictModal.getByRole('button', {name: /View.*Changes/i});
        const [newPage] = await Promise.all([user2Page.context().waitForEvent('page'), viewChangesButton.click()]);

        // * Verify new tab opens and loads
        await newPage.waitForLoadState('networkidle');

        // * Verify the new tab shows the published content (User 1's version)
        const newPageViewer = getPageViewerContent(newPage);
        await expect(newPageViewer).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await expect(newPageViewer).toContainText('User 1 version');
        await expect(newPageViewer).not.toContainText('User 2 version');

        // * Verify original tab still has conflict modal visible and editor with User 2's draft
        await expect(conflictModal).toBeVisible();
        const user2Editor = await getEditorAndWait(user2Page);
        await expect(user2Editor).toContainText('User 2 version');

        await newPage.close();
        await user2Page.close();
    },
);

/**
 * @objective Verify Continue editing option keeps user in edit mode with their draft
 *
 * @precondition
 * Pages/Wiki feature is enabled on the server
 */
test(
    'continues editing draft when Continue editing option selected during conflict',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user: user1, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        // # User 1 creates wiki and page
        const {page: page1} = await loginAndNavigateToChannel(pw, user1, team.name, channel.name);

        const wiki = await createWikiThroughUI(page1, uniqueName('Test Wiki'));
        const pageTitle = 'Continue Editing Test';
        const originalContent = 'Original content';
        const createdPage = await createPageThroughUI(page1, pageTitle, originalContent);

        // # User 1 enters edit mode
        const pageNode = getPageTreeNodeByTitle(page1, pageTitle);
        await pageNode.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
        await pageNode.click();
        await page1.waitForLoadState('networkidle');
        await page1.waitForTimeout(EDITOR_LOAD_WAIT);
        await enterEditMode(page1);

        // # Create user2 and add to channel
        const {user: user2} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

        const {page: user2Page} = await pw.testBrowser.login(user2);

        // # User 2 navigates to page and enters edit mode
        const wikiPageUrl = buildWikiPageUrl(pw.url, team.name, channel.id, wiki.id, createdPage.id);
        await user2Page.goto(wikiPageUrl);
        await user2Page.waitForLoadState('networkidle');

        const user2HierarchyPanel = getHierarchyPanel(user2Page);
        await user2HierarchyPanel.waitFor({state: 'visible', timeout: HIERARCHY_TIMEOUT});

        const pageNode2 = getPageTreeNodeByTitle(user2Page, pageTitle);
        await pageNode2.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
        await pageNode2.click();
        await user2Page.waitForTimeout(EDITOR_LOAD_WAIT);
        await enterEditMode(user2Page);

        // # User 1 makes changes and publishes
        const editor1 = await getEditorAndWait(page1);
        await editor1.click();
        await editor1.pressSequentially(' - User 1 changes');
        await publishPage(page1);
        await page1.waitForTimeout(AUTOSAVE_WAIT);

        // # User 2 makes different changes
        const editor2 = await getEditorAndWait(user2Page);
        await editor2.click();
        // Use clear() and pressSequentially to ensure TipTap detects changes
        await editor2.clear();
        await editor2.pressSequentially('User 2 unique changes');
        // Wait for autosave to complete
        await user2Page.waitForTimeout(AUTOSAVE_WAIT);

        const publishButton2 = user2Page.locator('[data-testid="wiki-page-publish-button"]').first();
        await publishButton2.click();
        await user2Page.waitForLoadState('networkidle');
        await user2Page.waitForTimeout(EDITOR_LOAD_WAIT);

        // * Verify conflict modal appears
        const conflictModal = user2Page.locator('.conflict-warning-modal, .modal:has-text("Page conflict")').first();
        await pw.waitUntil(
            async () => {
                return await conflictModal.isVisible();
            },
            {timeout: HIERARCHY_TIMEOUT},
        );

        // # Select "Continue editing my draft" option
        const continueOption = conflictModal
            .locator('button.conflict-option')
            .filter({hasText: 'Continue editing my draft'});
        await continueOption.click();
        await user2Page.waitForTimeout(SHORT_WAIT);

        // # Click "Continue editing" confirm button (exact match to avoid matching the option)
        const continueButton = conflictModal.getByRole('button', {name: 'Continue editing', exact: true});
        await continueButton.click();
        await user2Page.waitForTimeout(SHORT_WAIT);

        // * Verify modal closes
        await expect(conflictModal).not.toBeVisible();

        // * Verify still in edit mode with changes preserved
        const publishButtonStillVisible = user2Page.locator('[data-testid="wiki-page-publish-button"]').first();
        await expect(publishButtonStillVisible).toBeVisible();

        // * Verify User 2's changes are still in editor
        const editorAfter = await getEditorAndWait(user2Page);
        await expect(editorAfter).toContainText('User 2 unique changes');

        await user2Page.close();
    },
);

/**
 * @objective Verify Back to editing button closes conflict modal and keeps user in edit mode
 *
 * @precondition
 * Pages/Wiki feature is enabled on the server
 */
test(
    'stays in edit mode when Back to editing clicked in conflict modal',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user: user1, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        // # User 1 creates wiki and page
        const {page: page1} = await loginAndNavigateToChannel(pw, user1, team.name, channel.name);

        const wiki = await createWikiThroughUI(page1, uniqueName('Test Wiki'));
        const pageTitle = 'Back to Editing Test';
        const originalContent = 'Original content to be edited';
        const createdPage = await createPageThroughUI(page1, pageTitle, originalContent);

        // # User 1 enters edit mode
        const pageNode = getPageTreeNodeByTitle(page1, pageTitle);
        await pageNode.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
        await pageNode.click();
        await page1.waitForLoadState('networkidle');
        await page1.waitForTimeout(EDITOR_LOAD_WAIT);
        await enterEditMode(page1);

        // # Create user2 and add to channel
        const {user: user2} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

        const {page: user2Page} = await pw.testBrowser.login(user2);

        // # User 2 navigates to page and enters edit mode
        const wikiPageUrl = buildWikiPageUrl(pw.url, team.name, channel.id, wiki.id, createdPage.id);
        await user2Page.goto(wikiPageUrl);
        await user2Page.waitForLoadState('networkidle');

        const user2HierarchyPanel = getHierarchyPanel(user2Page);
        await user2HierarchyPanel.waitFor({state: 'visible', timeout: HIERARCHY_TIMEOUT});

        const pageNode2 = getPageTreeNodeByTitle(user2Page, pageTitle);
        await pageNode2.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
        await pageNode2.click();
        await user2Page.waitForTimeout(EDITOR_LOAD_WAIT);
        await enterEditMode(user2Page);

        // # User 1 makes changes and publishes
        const editor1 = await getEditorAndWait(page1);
        await editor1.click();
        await editor1.pressSequentially(' - User 1 edit');
        await publishPage(page1);
        await page1.waitForTimeout(AUTOSAVE_WAIT);

        // # User 2 makes different changes
        const user2Changes = 'User 2 changes to preserve';
        const editor2 = await getEditorAndWait(user2Page);
        await editor2.click();
        // Use pressSequentially instead of fill() to ensure TipTap detects the change
        await editor2.clear();
        await editor2.pressSequentially(user2Changes);
        // Wait for autosave to complete (500ms debounce + buffer)
        await user2Page.waitForTimeout(AUTOSAVE_WAIT);

        const publishButton2 = user2Page.locator('[data-testid="wiki-page-publish-button"]').first();
        await publishButton2.click();
        await user2Page.waitForLoadState('networkidle');
        await user2Page.waitForTimeout(EDITOR_LOAD_WAIT);

        // * Verify conflict modal appears
        const conflictModal = user2Page.locator('.conflict-warning-modal, .modal:has-text("Page conflict")').first();
        await pw.waitUntil(
            async () => {
                return await conflictModal.isVisible();
            },
            {timeout: HIERARCHY_TIMEOUT},
        );

        // # Click "Back to editing" button
        const backButton = conflictModal.getByRole('button', {name: /Back to editing/i});
        await backButton.click();
        await user2Page.waitForTimeout(SHORT_WAIT);

        // * Verify modal closes
        await expect(conflictModal).not.toBeVisible();

        // * Verify still in edit mode with changes preserved
        const publishButtonStillVisible = user2Page.locator('[data-testid="wiki-page-publish-button"]').first();
        await expect(publishButtonStillVisible).toBeVisible();

        // * Verify User 2's changes are still in editor
        const editorAfter = await getEditorAndWait(user2Page);
        await expect(editorAfter).toContainText('User 2 changes to preserve');

        // # User can continue editing
        await editorAfter.click();
        await editorAfter.pressSequentially(' - additional changes');
        await expect(editorAfter).toContainText('additional changes');

        await user2Page.close();
    },
);
