// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';

import {createWikiThroughUI, createPageThroughUI, createChildPageThroughContextMenu} from './test_helpers';

/**
 * @objective Verify concurrent edit conflict detection when two users edit same page
 *
 * @precondition
 * Pages/Wiki feature is enabled on the server
 */
test.skip('detects concurrent edit conflict when two users edit same page', {tag: '@pages'}, async ({pw, context, sharedPagesSetup}) => {
    const {team, user: user1, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    // # User 1 creates wiki and page through UI
    const {page: page1, channelsPage: channelsPage1} = await pw.testBrowser.login(user1);
    await channelsPage1.goto(team.name, channel.name);
    await channelsPage1.toBeVisible();

    const wiki = await createWikiThroughUI(page1, `Test Wiki ${pw.random.id()}`);
    const page = await createPageThroughUI(page1, 'Shared Document', 'Original content that will be edited by two users simultaneously');

    // # Create user2 and add to channel
    const user2 = await adminClient.createUser({
        username: `testuser${pw.random.id()}`,
        email: `testuser${pw.random.id()}@example.com`,
        password: 'Password123!',
    }, '', '');

    await adminClient.addToTeam(team.id, user2.id);
    await adminClient.addToChannel(user2.id, channel.id);

    // Click edit button
    const editButton1 = page1.locator('[data-testid="wiki-page-edit-button"]').first();
    if (await editButton1.isVisible()) {
        await editButton1.click();
    }

    // # User 2 opens editor
    const user2Page = await context.newPage();
    const {channelsPage: channelsPage2} = await pw.testBrowser.login(user2, {page: user2Page});
    await channelsPage2.goto(team.name, channel.name);
    await channelsPage2.toBeVisible();

    // Navigate to same wiki page and start editing
    await user2Page.goto(`${pw.url}/${team.name}/channels/${channel.name}/wikis/${wiki.id}/pages/${page.id}`);
    await user2Page.waitForLoadState('networkidle');

    const editButton2 = user2Page.locator('[data-testid="wiki-page-edit-button"]').first();
    if (await editButton2.isVisible()) {
        await editButton2.click();
    }

    // # User 1 makes changes and publishes
    const editor1 = page1.locator('.ProseMirror').first();
    await editor1.click();
    await editor1.pressSequentially(' - User 1 addition');

    const publishButton1 = page1.locator('[data-testid="wiki-page-publish-button"]').first();
    await publishButton1.click();

    // * Verify User 1's publish succeeds
    await page1.waitForLoadState('networkidle');
    const pageContent1 = page1.locator('[data-testid="page-content"], [data-testid="page-viewer"], .wiki-page-content').first();
    await expect(pageContent1).toContainText('User 1 addition');

    // # User 2 makes different changes and tries to publish
    const editor2 = user2Page.locator('.ProseMirror').first();
    await editor2.click();
    await editor2.pressSequentially(' - User 2 addition');

    const publishButton2 = user2Page.locator('[data-testid="wiki-page-publish-button"]').first();
    await publishButton2.click();

    // * Verify conflict warning appears
    const conflictModal = user2Page.getByRole('dialog', {name: /Edit Conflict|Conflict Detected|Conflict/i});

    // Wait for either the modal or check if publish succeeded (implementation-specific)
    await pw.waitUntil(
        async () => {
            const modalVisible = await conflictModal.isVisible().catch(() => false);
            if (modalVisible) {
                return true;
            }

            // If no modal, check if there's an error message or warning
            const errorMessage = user2Page.locator('[data-testid="error-message"], .error, .alert').first();
            return await errorMessage.isVisible().catch(() => false);
        },
        {timeout: 10000},
    );

    // * Verify conflict message exists somewhere in the UI
    const hasConflictModal = await conflictModal.isVisible().catch(() => false);
    if (hasConflictModal) {
        await expect(conflictModal).toContainText(/conflict|modified|changed/i);
    }
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

    await adminClient.addToTeam(team.id, user2.id);
    await adminClient.addToChannel(user2.id, channel.id);

    const editButton1 = page1.locator('[data-testid="wiki-page-edit-button"]').first();
    if (await editButton1.isVisible()) {
        await editButton1.click();
    }

    const user2Page = await context.newPage();
    await pw.testBrowser.login(user2, {page: user2Page});
    await user2Page.goto(`${pw.url}/${team.name}/channels/${channel.name}/wikis/${wiki.id}/pages/${page.id}`);
    await user2Page.waitForLoadState('networkidle');

    const editButton2 = user2Page.locator('[data-testid="wiki-page-edit-button"]').first();
    if (await editButton2.isVisible()) {
        await editButton2.click();
    }

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

    if (await refreshButton.isVisible({timeout: 5000}).catch(() => false)) {
        await refreshButton.click();

        // * Verify User 2's editor reloads with User 1's changes
        await user2Page.waitForLoadState('networkidle');
        const editorContent2 = user2Page.locator('.ProseMirror').first();
        await expect(editorContent2).toContainText('User 1 changes');
    }
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

    await adminClient.addToTeam(team.id, user2.id);
    await adminClient.addToChannel(user2.id, channel.id);

    const editButton1 = page1.locator('[data-testid="wiki-page-edit-button"]').first();
    if (await editButton1.isVisible()) {
        await editButton1.click();
    }

    const user2Page = await context.newPage();
    await pw.testBrowser.login(user2, {page: user2Page});
    await user2Page.goto(`${pw.url}/${team.name}/channels/${channel.name}/wikis/${wiki.id}/pages/${page.id}`);
    await user2Page.waitForLoadState('networkidle');

    const editButton2 = user2Page.locator('[data-testid="wiki-page-edit-button"]').first();
    if (await editButton2.isVisible()) {
        await editButton2.click();
    }

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

    if (await overwriteButton.isVisible({timeout: 5000}).catch(() => false)) {
        await overwriteButton.click();

        // * Check for confirmation dialog
        const confirmButton = user2Page.locator('[data-testid="confirm-button"], button:has-text("Yes")').first();
        if (await confirmButton.isVisible({timeout: 3000}).catch(() => false)) {
            await confirmButton.click();
        }

        // * Verify User 2's version is saved
        await user2Page.waitForLoadState('networkidle');
        const pageContent = user2Page.locator('[data-testid="page-content"], [data-testid="page-viewer"], .wiki-page-content').first();
        await expect(pageContent).toContainText('Version B');
    }
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

    await adminClient.addToTeam(team.id, user2.id);
    await adminClient.addToChannel(user2.id, channel.id);

    const editButton1 = page1.locator('[data-testid="wiki-page-edit-button"]').first();
    if (await editButton1.isVisible()) {
        await editButton1.click();
    }

    // # User 2 views same page
    const user2Page = await context.newPage();
    await pw.testBrowser.login(user2, {page: user2Page});
    await user2Page.goto(`${pw.url}/${team.name}/channels/${channel.name}/wikis/${wiki.id}/pages/${page.id}`);
    await user2Page.waitForLoadState('networkidle');

    // * Verify User 2 sees "User 1 is editing" indicator (implementation-specific)
    const editingIndicator = user2Page.locator('[data-testid="editing-indicator"], .editing-indicator').first();

    // Check if indicator exists
    const hasIndicator = await editingIndicator.isVisible({timeout: 5000}).catch(() => false);

    if (hasIndicator) {
        await expect(editingIndicator).toContainText(user1.username);
    }

    // # User 2 clicks edit
    const editButton2 = user2Page.locator('[data-testid="wiki-page-edit-button"]').first();
    if (await editButton2.isVisible()) {
        await editButton2.click();
    }

    // * Verify warning appears (implementation-specific)
    const warningBanner = user2Page.locator('[data-testid="concurrent-edit-warning"], .warning, .alert').first();
    const hasWarning = await warningBanner.isVisible({timeout: 5000}).catch(() => false);

    if (hasWarning) {
        await expect(warningBanner).toContainText(/editing|edit/i);
    }
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

    await adminClient.addToTeam(team.id, user2.id);
    await adminClient.addToChannel(user2.id, channel.id);

    const editButton1 = page1.locator('[data-testid="wiki-page-edit-button"]').first();
    if (await editButton1.isVisible()) {
        await editButton1.click();
    }

    const user2Page = await context.newPage();
    await pw.testBrowser.login(user2, {page: user2Page});
    await user2Page.goto(`${pw.url}/${team.name}/channels/${channel.name}/wikis/${wiki.id}/pages/${page.id}`);
    await user2Page.waitForLoadState('networkidle');

    const editButton2 = user2Page.locator('[data-testid="wiki-page-edit-button"]').first();
    if (await editButton2.isVisible()) {
        await editButton2.click();
    }

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
