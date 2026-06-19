// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';
import {
    buildWikiPageUrl,
    createTestChannel,
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
    WEBSOCKET_WAIT,
    ELEMENT_TIMEOUT,
    HIERARCHY_TIMEOUT,
    waitForAutoSave,
    getPublishButton,
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
        const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'), 'O', [user1.id]);

        // # User 1 creates wiki and page
        const {page: page1} = await loginAndNavigateToChannel(pw, user1, team.name, channel.name);

        const wiki = await createWikiThroughUI(page1, uniqueName('Test Wiki'));
        const pageTitle = 'Notification Test Page';
        const testPage = await createPageThroughUI(page1, pageTitle, 'Original content');

        // # Create user2 and add to channel
        const {user: user2} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

        const {page: user2Page} = await pw.testBrowser.login(user2);

        // # User 2 navigates to page and enters edit mode
        const wikiPageUrl = buildWikiPageUrl(pw.url, team.name, wiki.id, testPage.id, channel.id);
        await user2Page.goto(wikiPageUrl);
        await user2Page.waitForLoadState('networkidle');

        const user2HierarchyPanel = getHierarchyPanel(user2Page);
        await user2HierarchyPanel.waitFor({state: 'visible', timeout: HIERARCHY_TIMEOUT});

        const pageNode = getPageTreeNodeByTitle(user2Page, pageTitle);
        await pageNode.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
        await pageNode.click();
        await expect(getPageViewerContent(user2Page)).toBeVisible({timeout: ELEMENT_TIMEOUT});

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
        await expect(getPageViewerContent(page1)).toBeVisible({timeout: ELEMENT_TIMEOUT});

        await enterEditMode(page1);
        const editor1 = await getEditorAndWait(page1);
        await editor1.click();
        await editor1.pressSequentially(' - User 1 published changes');
        await publishPage(page1);

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
        const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'), 'O', [user1.id]);

        // # User 1 creates wiki and page through UI
        const {page: page1} = await loginAndNavigateToChannel(pw, user1, team.name, channel.name);

        const wiki = await createWikiThroughUI(page1, uniqueName('Conflict Wiki'));
        const testPage = await createPageThroughUI(page1, 'Conflict Page', 'Base content here');

        // # Create user2 and add to channel
        const {user: user2} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

        await enterEditMode(page1);

        const {page: user2Page} = await pw.testBrowser.login(user2);
        await user2Page.goto(buildWikiPageUrl(pw.url, team.name, wiki.id, testPage.id, channel.id));
        await user2Page.waitForLoadState('networkidle');

        await enterEditMode(user2Page);

        // # User 1 publishes first
        const editor1 = await getEditorAndWait(page1);
        await editor1.click();
        await editor1.pressSequentially(' User 1 changes');

        const publishButton1 = getPublishButton(page1);
        await publishButton1.click();
        await page1.waitForLoadState('networkidle');

        // # User 2 tries to publish
        const editor2 = await getEditorAndWait(user2Page);
        await editor2.click();
        await editor2.pressSequentially(' User 2 changes');

        const publishButton2 = getPublishButton(user2Page);
        await publishButton2.click();

        // # Look for refresh/reload option (implementation-specific)
        const refreshButton = user2Page.locator('button:has-text("Refresh"), button:has-text("Reload")').first();

        await expect(refreshButton).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await refreshButton.click();

        // * Verify User 2's editor reloads with User 1's changes
        await user2Page.waitForLoadState('networkidle');
        const editorContent2 = await getEditorAndWait(user2Page);
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
        const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'), 'O', [user1.id]);

        // # User 1 creates wiki and page through UI
        const {page: page1} = await loginAndNavigateToChannel(pw, user1, team.name, channel.name);

        const wiki = await createWikiThroughUI(page1, uniqueName('Overwrite Wiki'));
        const testPage = await createPageThroughUI(page1, 'Overwrite Test', 'Original text');

        // # Create user2 and add to channel
        const {user: user2} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

        await enterEditMode(page1);

        const {page: user2Page} = await pw.testBrowser.login(user2);
        await user2Page.goto(buildWikiPageUrl(pw.url, team.name, wiki.id, testPage.id, channel.id));
        await user2Page.waitForLoadState('networkidle');

        await enterEditMode(user2Page);

        // # User 1 publishes
        const editor1 = await getEditorAndWait(page1);
        await editor1.click();
        await editor1.pressSequentially(' - Version A');

        const publishButton1 = getPublishButton(page1);
        await publishButton1.click();
        await page1.waitForLoadState('networkidle');

        // # User 2 tries to overwrite
        const editor2 = await getEditorAndWait(user2Page);
        await editor2.click();
        await editor2.pressSequentially(' - Version B');

        const publishButton2 = getPublishButton(user2Page);
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
        const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'), 'O', [user1.id]);

        // # User 1 creates wiki and page through UI
        const {page: page1} = await loginAndNavigateToChannel(pw, user1, team.name, channel.name);

        const wiki = await createWikiThroughUI(page1, uniqueName('Collaborative Wiki'));
        const testPage = await createPageThroughUI(page1, 'Collaborative Page', 'Shared content');

        // # Create user2 and add to channel
        const {user: user2} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

        await enterEditMode(page1);

        // # User 2 views same page
        const {page: user2Page} = await pw.testBrowser.login(user2);
        await user2Page.goto(buildWikiPageUrl(pw.url, team.name, wiki.id, testPage.id, channel.id));
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
        const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'), 'O', [user1.id]);

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
        await user2Page.goto(buildWikiPageUrl(pw.url, team.name, wiki.id, testPage.id, channel.id));
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

        // * With intelligent merging: Both changes should be preserved
        // Check if conflict modal appears (current behavior) or changes merged (expected behavior)
        const conflictModal = user2Page.locator('[data-testid="conflict-warning-modal"]').first();
        const hasConflict = await conflictModal.isVisible({timeout: WEBSOCKET_WAIT}).catch(() => false);

        if (hasConflict) {
            // Current behavior: Simple conflict detection shows conflict modal
            // User 2 should choose to overwrite to save their changes
            const overwriteOption = conflictModal.getByRole('button', {name: 'Overwrite published version'});
            await overwriteOption.click();
            const overwriteButton = conflictModal.getByRole('button', {name: 'Overwrite now', exact: true});
            await overwriteButton.click();
            await user2Page.waitForLoadState('networkidle');
        }

        // * Verify User 2's content was saved
        const pageViewer2 = getPageViewerContent(user2Page);
        await expect(pageViewer2).toBeVisible({timeout: HIERARCHY_TIMEOUT});
        await expect(pageViewer2).toContainText('Section B modified by User 2');

        // * Verify via API that the page was saved (authoritative check)
        const serverPage = await adminClient.getPage(wiki.id, testPage.id);
        expect(serverPage.body).toContain('Section B modified by User 2');

        // Note: With simple conflict detection, User 1's changes may be lost
        // With intelligent merging, both changes would be preserved:
        // expect(serverPage.body).toContain('Section A modified by User 1');
        // expect(serverPage.body).toContain('Section B modified by User 2');

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
        const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'), 'O', [user1.id]);

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

        // Wait for permission changes to propagate
        await page1.waitForLoadState('networkidle');

        // # User 2: Login and navigate to the same page
        const {page: page2} = await pw.testBrowser.login(user2);

        const wikiPageUrl = buildWikiPageUrl(pw.url, team.name, wiki.id, testPage.id, channel.id);
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
        await waitForAutoSave(page2);

        // * Verify User 2 editor has the expected content before publishing
        await expect(editor2).toContainText('Original content');
        await expect(editor2).toContainText('User 2 edit');

        // # User 2: Click publish button
        const publishButton2 = page2.locator('[data-testid="wiki-page-publish-button"]').first();
        await publishButton2.click();
        await page2.waitForLoadState('networkidle', {timeout: HIERARCHY_TIMEOUT});

        // # Check if conflict modal appeared and handle it
        const conflictModal2 = page2.locator('[data-testid="conflict-warning-modal"]').first();
        const hasConflict = await conflictModal2.isVisible({timeout: WEBSOCKET_WAIT}).catch(() => false);

        if (hasConflict) {
            // Select "Overwrite published version" option
            const overwriteOption2 = conflictModal2.getByRole('button', {name: 'Overwrite published version'});
            await overwriteOption2.click();
            // Confirm by clicking "Overwrite now" button
            const overwriteButton2 = conflictModal2.getByRole('button', {name: 'Overwrite now', exact: true});
            await overwriteButton2.click();
            await page2.waitForLoadState('networkidle');
        }

        // * Verify User 2's content was saved via UI (first write wins)
        const pageViewer2 = getPageViewerContent(page2);
        await expect(pageViewer2).toBeVisible({timeout: HIERARCHY_TIMEOUT});
        await expect(pageViewer2).toContainText('User 2 edit');
        await expect(pageViewer2).toContainText('Original content');

        // # User 1: Click publish (will show conflict modal since User 2 already saved)
        const publishButton1 = page1.locator('[data-testid="wiki-page-publish-button"]').first();
        await publishButton1.click();
        await page1.waitForLoadState('networkidle');

        // * Verify conflict modal appears for User 1 (first-write-wins prevents automatic overwrite)
        const conflictModal = page1.locator('[data-testid="conflict-warning-modal"]').first();
        await expect(conflictModal).toBeVisible({timeout: HIERARCHY_TIMEOUT});

        // # User 1: Choose "Continue editing my draft" to preserve first-write-wins behavior
        //   (no destructive action — modal closes and user1 stays in edit mode with their draft)
        const continueOption = conflictModal.getByRole('button', {name: 'Continue editing my draft'});
        await continueOption.click();
        await page1.waitForTimeout(SHORT_WAIT);
        const continueConfirm = conflictModal.getByRole('button', {name: 'Continue editing', exact: true});
        await continueConfirm.click();
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
        expect(serverPage.body).toContain('User 2 edit');
        expect(serverPage.body).toContain('Original content');
        expect(serverPage.body).not.toContain('User 1 edit');

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
        const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'), 'O', [user1.id]);

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

        await page1.waitForLoadState('networkidle');

        // # User 2: Login and navigate to the same page
        const {page: page2} = await pw.testBrowser.login(user2);

        const wikiPageUrl = buildWikiPageUrl(pw.url, team.name, wiki.id, testPage.id, channel.id);
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
        await waitForAutoSave(page2);
        const publishButton2 = page2.locator('[data-testid="wiki-page-publish-button"]').first();
        await publishButton2.click();
        await page2.waitForLoadState('networkidle', {timeout: HIERARCHY_TIMEOUT});

        // # Handle conflict modal if it appears for User 2
        const conflictModal2 = page2.locator('[data-testid="conflict-warning-modal"]').first();
        const hasConflict = await conflictModal2.isVisible({timeout: WEBSOCKET_WAIT}).catch(() => false);
        if (hasConflict) {
            // Select "Overwrite published version" option
            const overwriteOption2 = conflictModal2.getByRole('button', {name: 'Overwrite published version'});
            await overwriteOption2.click();
            // Confirm by clicking "Overwrite now" button
            const overwriteButton2 = conflictModal2.getByRole('button', {name: 'Overwrite now', exact: true});
            await overwriteButton2.click();
            await page2.waitForLoadState('networkidle');
        }

        // * Verify User 2's content was saved (first write)
        const pageViewer2 = getPageViewerContent(page2);
        await expect(pageViewer2).toBeVisible({timeout: HIERARCHY_TIMEOUT});
        await expect(pageViewer2).toContainText('User 2 edit');

        // # User 1: Try to publish (should show conflict modal)
        const publishButton1 = page1.locator('[data-testid="wiki-page-publish-button"]').first();
        await publishButton1.click();
        await page1.waitForLoadState('networkidle');

        // * Verify conflict modal appears for User 1
        const conflictModal = page1.locator('[data-testid="conflict-warning-modal"]').first();
        await expect(conflictModal).toBeVisible({timeout: HIERARCHY_TIMEOUT});

        // # User 1: Select "Overwrite published version" option
        const overwriteOption = conflictModal.getByRole('button', {name: 'Overwrite published version'});
        await overwriteOption.click();
        await page1.waitForTimeout(SHORT_WAIT);

        // * Verify "Overwrite now" confirm button is now active (red/destructive)
        const overwriteButton = conflictModal.getByRole('button', {name: 'Overwrite now', exact: true});
        await expect(overwriteButton).toBeVisible();

        // # User 1: Click Overwrite now to confirm
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
        const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'), 'O', [user1.id]);

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
        await expect(getPageViewerContent(page1)).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await enterEditMode(page1);

        // # Create user2 and add to channel
        const {user: user2} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

        const {page: user2Page} = await pw.testBrowser.login(user2);

        // # User 2 navigates to page and enters edit mode
        const wikiPageUrl = buildWikiPageUrl(pw.url, team.name, wiki.id, createdPage.id, channel.id);
        await user2Page.goto(wikiPageUrl);
        await user2Page.waitForLoadState('networkidle');

        const user2HierarchyPanel = getHierarchyPanel(user2Page);
        await user2HierarchyPanel.waitFor({state: 'visible', timeout: HIERARCHY_TIMEOUT});

        const pageNode2 = getPageTreeNodeByTitle(user2Page, pageTitle);
        await pageNode2.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
        await pageNode2.click();
        await expect(getPageViewerContent(user2Page)).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await enterEditMode(user2Page);

        // # User 1 makes changes and publishes
        const editor1 = await getEditorAndWait(page1);
        await editor1.click();
        await editor1.pressSequentially(' - User 1 version');
        await publishPage(page1);

        // # User 2 makes different changes and tries to publish
        const editor2 = await getEditorAndWait(user2Page);
        await editor2.click();
        await editor2.pressSequentially(' - User 2 version');

        const publishButton2 = user2Page.locator('[data-testid="wiki-page-publish-button"]').first();
        await publishButton2.click();
        await user2Page.waitForLoadState('networkidle');

        // * Verify conflict modal appears
        const conflictModal = user2Page.locator('[data-testid="conflict-warning-modal"]').first();
        await expect(conflictModal).toBeVisible({timeout: HIERARCHY_TIMEOUT});

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
        const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'), 'O', [user1.id]);

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
        await expect(getPageViewerContent(page1)).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await enterEditMode(page1);

        // # Create user2 and add to channel
        const {user: user2} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

        const {page: user2Page} = await pw.testBrowser.login(user2);

        // # User 2 navigates to page and enters edit mode
        const wikiPageUrl = buildWikiPageUrl(pw.url, team.name, wiki.id, createdPage.id, channel.id);
        await user2Page.goto(wikiPageUrl);
        await user2Page.waitForLoadState('networkidle');

        const user2HierarchyPanel = getHierarchyPanel(user2Page);
        await user2HierarchyPanel.waitFor({state: 'visible', timeout: HIERARCHY_TIMEOUT});

        const pageNode2 = getPageTreeNodeByTitle(user2Page, pageTitle);
        await pageNode2.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
        await pageNode2.click();
        await expect(getPageViewerContent(user2Page)).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await enterEditMode(user2Page);

        // # User 1 makes changes and publishes
        const editor1 = await getEditorAndWait(page1);
        await editor1.click();
        await editor1.pressSequentially(' - User 1 changes');
        await publishPage(page1);

        // # User 2 makes different changes
        const editor2 = await getEditorAndWait(user2Page);
        await editor2.click();
        // Use clear() and pressSequentially to ensure TipTap detects changes
        await editor2.clear();
        await editor2.pressSequentially('User 2 unique changes');
        // Wait for autosave to complete
        await waitForAutoSave(user2Page);

        const publishButton2 = user2Page.locator('[data-testid="wiki-page-publish-button"]').first();
        await publishButton2.click();
        await user2Page.waitForLoadState('networkidle');

        // * Verify conflict modal appears
        const conflictModal = user2Page.locator('[data-testid="conflict-warning-modal"]').first();
        await expect(conflictModal).toBeVisible({timeout: HIERARCHY_TIMEOUT});

        // # Select "Continue editing my draft" option
        const continueOption = conflictModal.getByRole('button', {name: 'Continue editing my draft'});
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
        const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'), 'O', [user1.id]);

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
        await expect(getPageViewerContent(page1)).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await enterEditMode(page1);

        // # Create user2 and add to channel
        const {user: user2} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

        const {page: user2Page} = await pw.testBrowser.login(user2);

        // # User 2 navigates to page and enters edit mode
        const wikiPageUrl = buildWikiPageUrl(pw.url, team.name, wiki.id, createdPage.id, channel.id);
        await user2Page.goto(wikiPageUrl);
        await user2Page.waitForLoadState('networkidle');

        const user2HierarchyPanel = getHierarchyPanel(user2Page);
        await user2HierarchyPanel.waitFor({state: 'visible', timeout: HIERARCHY_TIMEOUT});

        const pageNode2 = getPageTreeNodeByTitle(user2Page, pageTitle);
        await pageNode2.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
        await pageNode2.click();
        await expect(getPageViewerContent(user2Page)).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await enterEditMode(user2Page);

        // # User 1 makes changes and publishes
        const editor1 = await getEditorAndWait(page1);
        await editor1.click();
        await editor1.pressSequentially(' - User 1 edit');
        await publishPage(page1);

        // # User 2 makes different changes
        const user2Changes = 'User 2 changes to preserve';
        const editor2 = await getEditorAndWait(user2Page);
        await editor2.click();
        // Use pressSequentially instead of fill() to ensure TipTap detects the change
        await editor2.clear();
        await editor2.pressSequentially(user2Changes);
        // Wait for autosave to complete (500ms debounce + buffer)
        await waitForAutoSave(user2Page);

        const publishButton2 = user2Page.locator('[data-testid="wiki-page-publish-button"]').first();
        await publishButton2.click();
        await user2Page.waitForLoadState('networkidle');

        // * Verify conflict modal appears
        const conflictModal = user2Page.locator('[data-testid="conflict-warning-modal"]').first();
        await expect(conflictModal).toBeVisible({timeout: HIERARCHY_TIMEOUT});

        // # Choose "Continue editing my draft" → "Continue editing" (semantic equivalent of
        //   the legacy "Back to editing" button — closes the modal without overwriting and
        //   keeps the user in edit mode with their unsaved draft intact).
        const continueOption = conflictModal.getByRole('button', {name: 'Continue editing my draft'});
        await continueOption.click();
        await user2Page.waitForTimeout(SHORT_WAIT);
        const continueConfirm = conflictModal.getByRole('button', {name: 'Continue editing', exact: true});
        await continueConfirm.click();
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

/**
 * @objective Verify "Continue editing" after conflict does not re-trigger conflict on next publish
 *
 * NOTE: This test will fail until onContinueEditing updates ORIGINAL_PAGE_EDIT_AT to
 * conflictPage.update_at in hooks.ts. Currently a no-op, so every subsequent publish
 * re-detects the same conflict.
 *
 * @precondition
 * Pages/Wiki feature is enabled on the server
 */
test(
    'continue editing after conflict does not re-trigger conflict on next publish',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user: user1, adminClient} = sharedPagesSetup;
        const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'), 'O', [user1.id]);

        // # User 1 creates wiki and page
        const {page: page1} = await loginAndNavigateToChannel(pw, user1, team.name, channel.name);

        const wiki = await createWikiThroughUI(page1, uniqueName('Test Wiki'));
        const pageTitle = 'Continue Editing Loop Test';
        const originalContent = 'Original content';
        const createdPage = await createPageThroughUI(page1, pageTitle, originalContent);

        // # User 1 enters edit mode (this sets the baseline for User 1 — original content)
        const pageNode1 = getPageTreeNodeByTitle(page1, pageTitle);
        await pageNode1.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
        await pageNode1.click();
        await page1.waitForLoadState('networkidle');
        await expect(getPageViewerContent(page1)).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await enterEditMode(page1);

        // # Create user2 and add to channel BEFORE User 1 publishes, so User 2 can enter
        //   edit mode against the same baseline. Otherwise User 2's baseline already includes
        //   User 1's publish and no conflict can occur.
        const {user: user2} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

        const {page: user2Page} = await pw.testBrowser.login(user2);

        // # User 2 navigates to page and enters edit mode (baseline = original content)
        const wikiPageUrl = buildWikiPageUrl(pw.url, team.name, wiki.id, createdPage.id, channel.id);
        await user2Page.goto(wikiPageUrl);
        await user2Page.waitForLoadState('networkidle');

        const user2HierarchyPanel = getHierarchyPanel(user2Page);
        await user2HierarchyPanel.waitFor({state: 'visible', timeout: HIERARCHY_TIMEOUT});

        const pageNode2 = getPageTreeNodeByTitle(user2Page, pageTitle);
        await pageNode2.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
        await pageNode2.click();
        await expect(getPageViewerContent(user2Page)).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await enterEditMode(user2Page);

        // # User 2 makes a different change first (and autosaves), so the draft is captured
        //   against the original baseline.
        const editor2 = await getEditorAndWait(user2Page);
        await editor2.click();
        await editor2.clear();
        await editor2.pressSequentially('User 2 draft changes');
        await waitForAutoSave(user2Page);

        // # NOW User 1 publishes, making User 2's baseline stale.
        const editor1 = await getEditorAndWait(page1);
        await editor1.click();
        await editor1.pressSequentially(' - User 1 changes');
        await publishPage(page1);

        // # User 2 tries to publish — should get conflict modal (User 1 already published)
        const publishButton2 = getPublishButton(user2Page);
        await publishButton2.click();
        await user2Page.waitForLoadState('networkidle');

        // * Verify conflict modal appears (first conflict)
        const conflictModal = user2Page.locator('[data-testid="conflict-warning-modal"]').first();
        await expect(conflictModal).toBeVisible({timeout: HIERARCHY_TIMEOUT});

        // # User 2 clicks "Continue editing my draft" option then confirms "Continue editing"
        const continueOption = conflictModal.getByRole('button', {name: 'Continue editing my draft'});
        await continueOption.click();
        await user2Page.waitForTimeout(SHORT_WAIT);

        const continueButton = conflictModal.getByRole('button', {name: 'Continue editing', exact: true});
        await continueButton.click();
        await user2Page.waitForTimeout(SHORT_WAIT);

        // * Verify modal closes and User 2 is still in edit mode
        await expect(conflictModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});
        await expect(publishButton2).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # User 2 immediately publishes again without making any new edits
        await publishButton2.click();
        await user2Page.waitForLoadState('networkidle');

        // * After fix: conflict modal should NOT reappear — ORIGINAL_PAGE_EDIT_AT was updated
        // by onContinueEditing to the conflicting page's update_at, so the baseline is now current.
        await expect(conflictModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

        await user2Page.close();
    },
);

/**
 * Helper: provoke a publish conflict between User A and User B on a shared page.
 * Returns User B's page (which has the conflict modal open) plus the published page text and the
 * draft text User B typed. Caller is responsible for closing userBPage.
 */
async function provokeConflict(
    pw: Parameters<Parameters<typeof test>[2]>[0]['pw'],
    sharedPagesSetup: Parameters<Parameters<typeof test>[2]>[0]['sharedPagesSetup'],
    opts: {userBDraftText: string; userAPublishedText: string; pageTitlePrefix: string},
) {
    const {team, user: user1, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'), 'O', [user1.id]);

    const {page: page1} = await loginAndNavigateToChannel(pw, user1, team.name, channel.name);

    const wiki = await createWikiThroughUI(page1, uniqueName('Test Wiki'));
    const pageTitle = uniqueName(opts.pageTitlePrefix);
    const createdPage = await createPageThroughUI(page1, pageTitle, 'Original content');

    const pageNode1 = getPageTreeNodeByTitle(page1, pageTitle);
    await pageNode1.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    await pageNode1.click();
    await page1.waitForLoadState('networkidle');
    await expect(getPageViewerContent(page1)).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await enterEditMode(page1);

    const {user: userB} = await createTestUserInChannel(pw, adminClient, team, channel, 'userb');
    const {page: userBPage} = await pw.testBrowser.login(userB);

    const wikiPageUrl = buildWikiPageUrl(pw.url, team.name, wiki.id, createdPage.id, channel.id);
    await userBPage.goto(wikiPageUrl);
    await userBPage.waitForLoadState('networkidle');

    const userBHierarchyPanel = getHierarchyPanel(userBPage);
    await userBHierarchyPanel.waitFor({state: 'visible', timeout: HIERARCHY_TIMEOUT});
    const pageNodeB = getPageTreeNodeByTitle(userBPage, pageTitle);
    await pageNodeB.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    await pageNodeB.click();
    await expect(getPageViewerContent(userBPage)).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await enterEditMode(userBPage);

    const editorB = await getEditorAndWait(userBPage);
    await editorB.click();
    // Select all + delete forces a content-change event so the editor's
    // latestContentRef gets updated to ""; a bare .clear() on a contenteditable
    // doesn't always propagate through TipTap's onUpdate hook, leaving the
    // ref stuck at the initial page content (breaks empty-draft tests).
    await userBPage.keyboard.press('ControlOrMeta+A');
    await userBPage.keyboard.press('Delete');
    if (opts.userBDraftText.length > 0) {
        await editorB.pressSequentially(opts.userBDraftText);
    }
    await waitForAutoSave(userBPage);

    const editor1 = await getEditorAndWait(page1);
    await editor1.click();
    await editor1.clear();
    await editor1.pressSequentially(opts.userAPublishedText);
    await publishPage(page1);

    const publishButtonB = getPublishButton(userBPage);
    await publishButtonB.click();
    await userBPage.waitForLoadState('networkidle');

    const conflictModal = userBPage.locator('[data-testid="conflict-warning-modal"]').first();
    await expect(conflictModal).toBeVisible({timeout: HIERARCHY_TIMEOUT});

    return {userBPage, page1, conflictModal, createdPage, wiki, channel};
}

/**
 * @objective A22 — Verify "Compare versions" (renamed from "Review and merge changes") transitions
 * the conflict modal to a diff-view state showing both versions simultaneously, without navigation.
 *
 * NOTE: Fails until conflict_warning_modal.tsx implements the two-step state machine per
 * plans/feedback-bugs-fix-plan.md A22. Currently the modal shows "Review and merge changes" and
 * the option calls history.push instead of transitioning state.
 */
test('A22: Compare versions transitions to diff-view inside modal', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {userBPage, conflictModal} = await provokeConflict(pw, sharedPagesSetup, {
        userAPublishedText: 'User A update',
        userBDraftText: 'User B draft text',
        pageTitlePrefix: 'A22 DiffView Page',
    });

    // * Assertion: option label is "Compare versions" (rename per A22 plan)
    const compareOption = conflictModal.getByRole('button', {name: 'Compare versions', exact: true});
    await expect(compareOption).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Transition to diff-view
    const urlBefore = userBPage.url();
    await compareOption.click();
    const confirmInOptionSelect = conflictModal.getByRole('button', {name: /Confirm|Next/i});
    if (await confirmInOptionSelect.isVisible()) {
        await confirmInOptionSelect.click();
    }
    await userBPage.waitForTimeout(SHORT_WAIT);

    // * Assertions: URL unchanged, modal remains visible, diff panel renders both versions
    await expect(userBPage).toHaveURL(urlBefore, {timeout: ELEMENT_TIMEOUT});
    await expect(conflictModal).toBeVisible({timeout: ELEMENT_TIMEOUT});
    const diffPanel = userBPage.locator('[data-testid="conflict-diff-panel"], .conflict-diff-panel').first();
    await expect(diffPanel).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await expect(diffPanel).toContainText('User B draft text');
    await expect(diffPanel).toContainText('User A update');

    // * Assertions: two scrollable panels with aria-label regions
    const draftRegion = userBPage.getByRole('region', {name: /Your draft/i});
    const publishedRegion = userBPage.getByRole('region', {name: /Published version/i});
    await expect(draftRegion).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await expect(publishedRegion).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Assertion: at least one paragraph in each pane has diff-highlight class (paragraph hash differs)
    const highlightedInDraft = draftRegion
        .locator('[class*="paragraph-diff"], [data-paragraph-changed="true"]')
        .first();
    const highlightedInPublished = publishedRegion
        .locator('[class*="paragraph-diff"], [data-paragraph-changed="true"]')
        .first();
    await expect(highlightedInDraft).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await expect(highlightedInPublished).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Assertion: three action buttons with concrete labels and subtitles
    await expect(conflictModal.getByRole('button', {name: /Overwrite published version/i})).toBeVisible();
    await expect(conflictModal.getByRole('button', {name: /Keep published version/i})).toBeVisible();
    await expect(conflictModal.getByRole('button', {name: /Back to my draft/i})).toBeVisible();
    await expect(conflictModal).toContainText(/Your version replaces the published page/i);
    await expect(conflictModal).toContainText(/The published version is kept; your draft is deleted/i);

    await userBPage.close();
});

/**
 * @objective A22 — Verify the option-select state cannot be dismissed by Escape, no X button is
 * rendered, and clicking outside the modal does not dismiss it.
 */
test(
    'A22: option-select state blocks Escape, X, and backdrop dismissal',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        // # Provoke a conflict so the option-select modal is shown
        const {userBPage, conflictModal} = await provokeConflict(pw, sharedPagesSetup, {
            userAPublishedText: 'User A update',
            userBDraftText: 'User B draft',
            pageTitlePrefix: 'A22 Dismiss Page',
        });

        // * Assertion: Escape does not dismiss
        await userBPage.keyboard.press('Escape');
        await userBPage.waitForTimeout(SHORT_WAIT);
        await expect(conflictModal).toBeVisible();

        // * Assertion: no close X button rendered
        const closeButton = conflictModal.locator('[aria-label="Close"], .close, .modal-close').first();
        await expect(closeButton).not.toBeVisible();

        // * Assertion: clicking the backdrop does not dismiss
        const viewport = userBPage.viewportSize();
        if (viewport) {
            await userBPage.mouse.click(5, 5);
            await userBPage.waitForTimeout(SHORT_WAIT);
            await expect(conflictModal).toBeVisible();
        }

        await userBPage.close();
    },
);

/**
 * @objective A22 — Verify identical draft+published content does NOT enter diff-view but instead
 * shows an inline notice and auto-closes within ~2 seconds.
 */
test('A22: identical content shows inline notice and auto-closes', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    // # Provoke a conflict where both drafts share identical content
    // Identical content: both User A and User B type the same text — the conflict still arises
    // (Update-At timestamp mismatch) but content hashes match.
    const sharedText = 'Shared identical content';
    const {userBPage, conflictModal} = await provokeConflict(pw, sharedPagesSetup, {
        userAPublishedText: sharedText,
        userBDraftText: sharedText,
        pageTitlePrefix: 'A22 Identical Page',
    });

    const compareOption = conflictModal.getByRole('button', {name: 'Compare versions', exact: true});
    await compareOption.click();
    const confirm = conflictModal.getByRole('button', {name: /Confirm|Next/i});
    if (await confirm.isVisible()) {
        await confirm.click();
    }

    // * Assertion: inline notice on option-select card, NO diff-view transition
    await expect(conflictModal).toContainText(/Your draft matches the published version\./i, {
        timeout: ELEMENT_TIMEOUT,
    });
    const diffPanel = userBPage.locator('[data-testid="conflict-diff-panel"], .conflict-diff-panel').first();
    await expect(diffPanel).not.toBeVisible();

    // * Assertion: modal auto-closes (2s timer + fade-out animation, allow 5s).
    await expect(conflictModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

    await userBPage.close();
});

/**
 * @objective A22 — Verify empty-content paths show explanatory text in the diff panes
 * rather than blank scrollable regions.
 */
test(
    'A22: empty draft shows "Your draft has no content." in left pane',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {userBPage, conflictModal} = await provokeConflict(pw, sharedPagesSetup, {
            userAPublishedText: 'Published version with content',
            userBDraftText: '',
            pageTitlePrefix: 'A22 Empty Draft Page',
        });

        const compareOption = conflictModal.getByRole('button', {name: 'Compare versions', exact: true});
        await compareOption.click();
        const confirm = conflictModal.getByRole('button', {name: /Confirm|Next/i});
        if (await confirm.isVisible()) {
            await confirm.click();
        }

        const draftRegion = userBPage.getByRole('region', {name: /Your draft/i});
        await expect(draftRegion).toContainText(/Your draft has no content\./i, {timeout: ELEMENT_TIMEOUT});

        await userBPage.close();
    },
);

/**
 * @objective A22 — Verify "Keep published version" enters an isDiscarding state with spinner,
 * disables all three buttons, and removes the modal from the Redux registry on success.
 */
test(
    'A22: Keep published version shows discarding state and removes modal from Redux on success',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {userBPage, conflictModal} = await provokeConflict(pw, sharedPagesSetup, {
            userAPublishedText: 'User A update',
            userBDraftText: 'User B draft',
            pageTitlePrefix: 'A22 Discard Success Page',
        });

        // # Slow down the discard endpoint so the "Discarding…" loading state stays
        //   long enough for the test to observe it; otherwise the optimistic-fast
        //   response closes the modal before we can poll.
        await userBPage.route(/\/api\/v4\/wikis\/[^/]+\/drafts\/[^/]+(\?|$)/, async (route) => {
            if (route.request().method() === 'DELETE') {
                await new Promise((resolve) => setTimeout(resolve, 1500));
            }
            await route.continue();
        });

        const compareOption = conflictModal.getByRole('button', {name: 'Compare versions', exact: true});
        await compareOption.click();
        const confirm = conflictModal.getByRole('button', {name: /Confirm|Next/i});
        if (await confirm.isVisible()) {
            await confirm.click();
        }

        const keepPublishedBtn = conflictModal.getByRole('button', {name: /Keep published version/i});
        const overwriteBtn = conflictModal.getByRole('button', {name: /Overwrite published version/i});
        const backBtn = conflictModal.getByRole('button', {name: /Back to my draft/i});

        await keepPublishedBtn.click();

        // * Assertion: button label transitions to "Discarding..." and shows a spinner
        await expect(conflictModal).toContainText(/Discarding/i, {timeout: ELEMENT_TIMEOUT});
        const spinner = conflictModal.locator('.fa-spinner, [class*="spinner"], [role="progressbar"]').first();
        await expect(spinner).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // * Assertion: all three buttons disabled while isDiscarding=true
        await expect(overwriteBtn).toBeDisabled();
        await expect(backBtn).toBeDisabled();

        // * Assertion: on success, modal is REMOVED from the Redux modal registry (not just hidden)
        await expect(conflictModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});
        const modalOpen = await userBPage.evaluate(() => {
            const state = (window as unknown as {store: {getState: () => unknown}}).store.getState() as {
                views: {modals: {modalState: Record<string, {open: boolean}>}};
            };
            return state.views.modals.modalState?.PAGE_CONFLICT_WARNING?.open ?? false;
        });
        expect(modalOpen, 'Modal must be removed from Redux registry on successful discard').toBe(false);

        await userBPage.close();
    },
);

/**
 * @objective A22 — Verify that when onDiscard rejects (e.g. server error), an inline error appears,
 * isDiscarding resets, the modal stays open, and "Back to my draft" becomes active again.
 */
test(
    'A22: Keep published version failure path shows inline error and resets state',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {userBPage, conflictModal} = await provokeConflict(pw, sharedPagesSetup, {
            userAPublishedText: 'User A update',
            userBDraftText: 'User B draft',
            pageTitlePrefix: 'A22 Discard Fail Page',
        });

        // # Mock the page-draft delete endpoint to fail. The actual URL is
        //   /api/v4/wikis/{wikiId}/drafts/{pageId}, not /api/v4/drafts.
        await userBPage.route(/\/api\/v4\/wikis\/[^/]+\/drafts\/[^/]+(\?|$)/, (route) => {
            if (route.request().method() === 'DELETE') {
                route.fulfill({status: 500, body: '{"message":"Forced failure"}'});
            } else {
                route.continue();
            }
        });

        const compareOption = conflictModal.getByRole('button', {name: 'Compare versions', exact: true});
        await compareOption.click();
        const confirm = conflictModal.getByRole('button', {name: /Confirm|Next/i});
        if (await confirm.isVisible()) {
            await confirm.click();
        }

        const keepPublishedBtn = conflictModal.getByRole('button', {name: /Keep published version/i});
        await keepPublishedBtn.click();

        // * Assertion: inline error appears, modal stays open
        await expect(conflictModal).toContainText(/Failed to discard draft\. Try again\./i, {timeout: ELEMENT_TIMEOUT});
        await expect(conflictModal).toBeVisible();

        // * Assertion: "Back to my draft" is re-enabled after failure
        const backBtn = conflictModal.getByRole('button', {name: /Back to my draft/i});
        await expect(backBtn).toBeEnabled({timeout: ELEMENT_TIMEOUT});

        await userBPage.close();
    },
);

/**
 * @objective A22 — Verify keyboard tab order in diff-view is:
 * Back button → left region → right region → action buttons.
 */
test('A22: diff-view keyboard tab order', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {userBPage, conflictModal} = await provokeConflict(pw, sharedPagesSetup, {
        userAPublishedText: 'User A update',
        userBDraftText: 'User B draft',
        pageTitlePrefix: 'A22 TabOrder Page',
    });

    const compareOption = conflictModal.getByRole('button', {name: 'Compare versions', exact: true});
    await compareOption.click();
    const confirm = conflictModal.getByRole('button', {name: /Confirm|Next/i});
    if (await confirm.isVisible()) {
        await confirm.click();
    }

    // # Focus the Back button explicitly as the starting point
    const backBtn = conflictModal.getByRole('button', {name: /Back to my draft/i});
    await backBtn.focus();

    // * Sequence of focused elements after consecutive Tab presses
    const focusedRoles: string[] = [];
    for (let i = 0; i < 4; i++) {
        await userBPage.keyboard.press('Tab');
        const role = await userBPage.evaluate(
            () => document.activeElement?.getAttribute('role') ?? document.activeElement?.tagName ?? '',
        );
        focusedRoles.push(role);
    }

    // First Tab → left region (role=region), second → right region, third+ → action buttons
    expect(focusedRoles[0]?.toLowerCase(), 'First Tab from Back must land on left region').toMatch(/region/i);
    expect(focusedRoles[1]?.toLowerCase(), 'Second Tab must land on right region').toMatch(/region/i);
    expect(focusedRoles[2]?.toLowerCase(), 'Third Tab must land on an action button').toMatch(/button/i);

    await userBPage.close();
});

/**
 * @objective A22 — Verify "Back to my draft" exits diff-view via onContinueEditing, and the
 * subsequent publish does NOT re-trigger the conflict modal (chain into A21).
 */
test(
    'A22: Back to my draft routes through onContinueEditing and clears stale baseline (A21 chain)',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {userBPage, conflictModal} = await provokeConflict(pw, sharedPagesSetup, {
            userAPublishedText: 'User A update',
            userBDraftText: 'User B draft',
            pageTitlePrefix: 'A22 BackChain Page',
        });

        const compareOption = conflictModal.getByRole('button', {name: 'Compare versions', exact: true});
        await compareOption.click();
        const confirm = conflictModal.getByRole('button', {name: /Confirm|Next/i});
        if (await confirm.isVisible()) {
            await confirm.click();
        }

        const backBtn = conflictModal.getByRole('button', {name: /Back to my draft/i});
        await backBtn.click();

        // * Modal closes, returning to the draft editor
        await expect(conflictModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Without further edits, publish again. A21's fix must already be in place — baseline
        // ORIGINAL_PAGE_EDIT_AT should now equal the published page's update_at, so no spurious conflict.
        const publishBtn = getPublishButton(userBPage);
        await publishBtn.click();
        await userBPage.waitForTimeout(WEBSOCKET_WAIT);

        await expect(conflictModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

        await userBPage.close();
    },
);
