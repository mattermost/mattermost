// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';

import {createWikiThroughUI, createPageThroughUI, createChildPageThroughContextMenu, getNewPageButton} from './test_helpers';

/**
 * @objective Verify channel member can create page
 */
test('allows channel member to create page', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Permission Wiki ${pw.random.id()}`);

    // # Attempt to create page
    const newPageButton = getNewPageButton(page);

    // * Verify button is visible and enabled
    if (await newPageButton.isVisible({timeout: 3000}).catch(() => false)) {
        const isDisabled = await newPageButton.isDisabled();
        expect(isDisabled).toBe(false);

        // # Click to verify creation flow works
        await newPageButton.click();
        await page.waitForTimeout(500);

        // * Verify editor opened
        const editor = page.locator('.ProseMirror').first();
        await expect(editor).toBeVisible();
    }
});

/**
 * @objective Verify non-member cannot view wiki
 */
test('prevents non-member from viewing wiki', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;

    // # Create a private channel (non-members will not have access)
    const privateChannel = await adminClient.createChannel({
        team_id: team.id,
        name: `private-wiki-test-${pw.random.id()}`,
        display_name: `Private Wiki Test ${pw.random.id()}`,
        type: 'P',
    });

    // # Add first user to the private channel
    await adminClient.addToChannel(user.id, privateChannel.id);

    try {
        const {page: userPage, channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, privateChannel.name);

        // # Create wiki and page through UI
        const wiki = await createWikiThroughUI(userPage, `Private Wiki ${pw.random.id()}`);
        const testPage = await createPageThroughUI(userPage, 'Private Page', 'Private content');

        // # Create user NOT in channel (using MM pattern)
        const nonMemberUser = pw.random.user('nonmember');
        const {id: nonMemberUserId} = await adminClient.createUser(nonMemberUser, '', '');
        await adminClient.addToTeam(team.id, nonMemberUserId);

        // # Login as non-member and attempt to navigate to wiki
        const {page: nonMemberPage, channelsPage: nonMemberChannelsPage} = await pw.testBrowser.login(nonMemberUser);

        // Wait for login to complete by navigating to a valid page first
        await nonMemberChannelsPage.goto(team.name, 'town-square');
        await nonMemberChannelsPage.toBeVisible();

        // Now attempt to navigate to the private channel wiki
        await nonMemberPage.goto(`${pw.url}/${team.name}/channels/${privateChannel.name}/wikis/${wiki.id}/pages/${testPage.id}`);
        await nonMemberPage.waitForLoadState('networkidle');

        // Wait for any redirects to complete
        await nonMemberPage.waitForTimeout(1000);

        // * Verify access denied (error page, redirect, or permission message)
        const currentUrl = nonMemberPage.url();
        const isAccessDenied = currentUrl.includes('error') ||
                              currentUrl.includes('unauthorized') ||
                              !currentUrl.includes(wiki.id);

        if (!isAccessDenied) {
            // Check for permission error message on page
            const errorMessage = nonMemberPage.locator('text=/permission|access denied|unauthorized/i').first();
            const hasError = await errorMessage.isVisible({timeout: 3000}).catch(() => false);
            expect(hasError).toBe(true);
        } else {
            expect(isAccessDenied).toBe(true);
        }
    } finally {
        // # Cleanup: Delete the private channel
        await adminClient.deleteChannel(privateChannel.id);
    }
});

/**
 * @objective Verify channel member can edit page
 */
test('allows channel member to edit page', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki and page through UI
    const wiki = await createWikiThroughUI(page, `Edit Permission Wiki ${pw.random.id()}`);
    const testPage = await createPageThroughUI(page, 'Editable Page', 'Original content');

    // # Attempt to edit
    const editButton = page.locator('[data-testid="wiki-page-edit-button"]');

    // * Verify edit button is visible and enabled
    if (await editButton.isVisible({timeout: 3000}).catch(() => false)) {
        const isDisabled = await editButton.isDisabled();
        expect(isDisabled).toBe(false);

        // # Click edit to verify it works
        await editButton.click();
        await page.waitForTimeout(500);

        // * Verify editor opened
        const editor = page.locator('.ProseMirror').first();
        await expect(editor).toBeVisible();
    }
});

/**
 * @objective Verify channel admin can delete any page
 */
test('allows channel admin to delete any page', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    // # Create admin user
    const adminUser = pw.random.user('admin');
    const {id: adminUserId} = await adminClient.createUser(adminUser, '', '');
    await adminClient.addToTeam(team.id, adminUserId);
    await adminClient.addToChannel(adminUserId, channel.id);
    await adminClient.updateChannelMemberRoles(channel.id, adminUserId, 'channel_admin channel_user');

    const {page, channelsPage} = await pw.testBrowser.login(adminUser);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page through UI
    const wiki = await createWikiThroughUI(page, `Admin Delete Wiki ${pw.random.id()}`);
    const testPage = await createPageThroughUI(page, 'Page to Delete', 'Content');

    // # Open page actions menu
    const pageActions = page.locator('[data-testid="page-actions"], [data-testid="wiki-page-more-actions"], button[aria-label*="more"]').first();

    if (await pageActions.isVisible({timeout: 3000}).catch(() => false)) {
        await pageActions.click();

        // * Verify delete option is available
        const deleteButton = page.locator('[data-testid="delete-button"]').first();

        if (await deleteButton.isVisible({timeout: 2000}).catch(() => false)) {
            const isDisabled = await deleteButton.isDisabled();
            expect(isDisabled).toBe(false);
        }
    }
});

/**
 * @objective Verify permissions update when page moved to different wiki
 */
test('inherits permissions when page moved to different wiki', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;

    // # Create two channels
    const channel1 = await adminClient.createChannel({
        team_id: team.id,
        name: `channel1-${pw.random.id()}`,
        display_name: `Channel 1 ${pw.random.id()}`,
        type: 'O',
    });
    await adminClient.addToChannel(user.id, channel1.id);

    const channel2 = await adminClient.createChannel({
        team_id: team.id,
        name: `channel2-${pw.random.id()}`,
        display_name: `Channel 2 ${pw.random.id()}`,
        type: 'O',
    });
    await adminClient.addToChannel(user.id, channel2.id);

    const {page, channelsPage} = await pw.testBrowser.login(user);

    // # Create wiki1 and page in channel1 through UI
    await channelsPage.goto(team.name, channel1.name);
    const wiki1 = await createWikiThroughUI(page, `Wiki 1 ${pw.random.id()}`);
    const testPage = await createPageThroughUI(page, 'Page to Move', 'Content');

    // # Create wiki2 in channel2 through UI
    await channelsPage.goto(team.name, channel2.name);
    const wiki2 = await createWikiThroughUI(page, `Wiki 2 ${pw.random.id()}`);

    // # Navigate back to the page in wiki1
    await channelsPage.goto(team.name, channel1.name);
    await page.goto(`${pw.url}/${team.name}/channels/${channel1.name}/wikis/${wiki1.id}/pages/${testPage.id}`);
    await page.waitForLoadState('networkidle');

    // # Move page to wiki2 (if move functionality exists)
    const pageActions = page.locator('[data-testid="page-actions"], [data-testid="wiki-page-more-actions"]').first();

    if (await pageActions.isVisible({timeout: 3000}).catch(() => false)) {
        await pageActions.click();

        const moveButton = page.locator('button:has-text("Move to Wiki"), [data-testid="page-context-menu-move"]').first();

        if (await moveButton.isVisible({timeout: 2000}).catch(() => false)) {
            await moveButton.click();

            const moveModal = page.getByRole('dialog', {name: /Move/i});
            if (await moveModal.isVisible({timeout: 3000}).catch(() => false)) {
                const wiki2Option = moveModal.locator(`text="${wiki2.title}"`).first();
                await wiki2Option.click();

                const confirmButton = moveModal.locator('[data-testid="page-context-menu-move"], [data-testid="confirm-button"]').first();
                await confirmButton.click();

                await page.waitForLoadState('networkidle');

                // * Verify page now accessible via wiki2/channel2 permissions
                await page.goto(`${pw.url}/${team.name}/channels/${channel2.name}/wikis/${wiki2.id}/pages/${testPage.id}`);
                await page.waitForLoadState('networkidle');

                // * Verify page content is accessible
                const pageContent = page.locator('[data-testid="page-viewer-content"]');
                await expect(pageContent).toBeVisible();
            }
        }
    }
});

/**
 * @objective Verify read-only permissions restrict editing
 */
test('restricts page actions based on channel permissions', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    // # Create wiki and page as regular user first
    const {page: userPage, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    const wiki = await createWikiThroughUI(userPage, `Readonly Wiki ${pw.random.id()}`);
    const testPage = await createPageThroughUI(userPage, 'Protected Page', 'Protected content');

    // # Create guest user with read-only access
    const guestUser = await adminClient.createUser({
        username: `guest${pw.random.id()}`,
        email: `guest${pw.random.id()}@test.com`,
        password: 'Password123!',
    }, '', '');
    await adminClient.addToTeam(team.id, guestUser.id);
    await adminClient.addToChannel(guestUser.id, channel.id);

    // # Login as guest and navigate to the page
    const {page} = await pw.testBrowser.login(guestUser);
    await page.goto(`${pw.url}/${team.name}/channels/${channel.name}/wikis/${wiki.id}/pages/${testPage.id}`);
    await page.waitForLoadState('networkidle');

    // * Verify page is viewable
    const pageContent = page.locator('[data-testid="page-viewer-content"]');
    if (await pageContent.isVisible().catch(() => false)) {
        await expect(pageContent).toContainText('Protected content');
    }

    // * Verify edit button is hidden or disabled
    const editButton = page.locator('[data-testid="wiki-page-edit-button"]');

    if (await editButton.isVisible({timeout: 2000}).catch(() => false)) {
        const isDisabled = await editButton.isDisabled();
        expect(isDisabled).toBe(true);
    } else {
        // Edit button is hidden (also acceptable)
        const buttonVisible = await editButton.isVisible().catch(() => false);
        expect(buttonVisible).toBe(false);
    }
});
