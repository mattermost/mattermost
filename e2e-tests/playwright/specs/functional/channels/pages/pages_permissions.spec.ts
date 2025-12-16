// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createRandomUser} from '@mattermost/playwright-lib';

// Use testWithRegularUser for permission tests to properly test the permission system.
// Regular users are needed because admin users bypass all permission checks.
import {expect, testWithRegularUser as test} from './pages_test_fixture';
import {
    buildChannelPageUrl,
    createWikiThroughUI,
    createPageThroughUI,
    createTestChannel,
    getNewPageButton,
    getPageViewerContent,
    openPageActionsMenu,
    clickPageContextMenuItem,
    buildWikiPageUrl,
    waitForPageViewerLoad,
    getEditorAndWait,
    AUTOSAVE_WAIT,
    ELEMENT_TIMEOUT,
} from './test_helpers';

/**
 * @objective Verify channel member can create page
 */
test('allows channel member to create page', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki through UI
    await createWikiThroughUI(page, `Permission Wiki ${await pw.random.id()}`);

    // # Attempt to create page
    const newPageButton = getNewPageButton(page);

    // * Verify button is visible and enabled
    await expect(newPageButton).toBeVisible({timeout: ELEMENT_TIMEOUT});
    const isDisabled = await newPageButton.isDisabled();
    expect(isDisabled).toBe(false);

    // # Click to verify creation flow works
    await newPageButton.click();

    // * Verify editor opened
    await getEditorAndWait(page);
});

/**
 * @objective Verify non-member cannot view wiki
 */
test('prevents non-member from viewing wiki', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;

    // # Create a private channel (non-members will not have access)
    const privateChannel = await createTestChannel(adminClient, team.id, 'private-wiki-test', 'P');

    // # Add first user to the private channel
    await adminClient.addToChannel(user.id, privateChannel.id);

    try {
        const {page: userPage, channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, privateChannel.name);

        // # Create wiki and page through UI
        const wiki = await createWikiThroughUI(userPage, `Private Wiki ${await pw.random.id()}`);
        const testPage = await createPageThroughUI(userPage, 'Private Page', 'Private content');

        // # Create user NOT in channel (using MM pattern)
        const nonMemberUser = await createRandomUser('nonmember');
        const createdNonMember = await adminClient.createUser(nonMemberUser, '', '');
        createdNonMember.password = nonMemberUser.password;
        await adminClient.addToTeam(team.id, createdNonMember.id);

        // # Login as non-member and attempt to navigate to wiki
        const {page: nonMemberPage, channelsPage: nonMemberChannelsPage} = await pw.testBrowser.login(createdNonMember);

        // Wait for login to complete by navigating to a valid page first
        await nonMemberChannelsPage.goto(team.name, 'town-square');
        await nonMemberChannelsPage.toBeVisible();

        // Now attempt to navigate to the private channel wiki
        await nonMemberPage.goto(buildChannelPageUrl(pw.url, team.name, privateChannel.name, wiki.id, testPage.id));
        await nonMemberPage.waitForLoadState('networkidle');

        // * Verify access denied - user should NOT see the wiki content
        // The system should either redirect the user away from the wiki page,
        // or show an error state. Either way, the wiki content should not be accessible.

        // Wait for navigation/error handling to complete
        await nonMemberPage.waitForTimeout(2000);

        // Check that user was redirected away from the wiki page (URL no longer contains wiki.id)
        const currentUrl = nonMemberPage.url();
        const wasRedirectedAway = !currentUrl.includes(wiki.id);

        if (wasRedirectedAway) {
            // User was redirected - this is the expected behavior for access denial
            expect(wasRedirectedAway).toBe(true);
        } else {
            // If not redirected, verify error message is displayed
            const errorMessage = nonMemberPage.locator('[data-testid="error-page"], [data-testid="access-denied"]');
            await expect(errorMessage).toBeVisible({timeout: ELEMENT_TIMEOUT});
        }

        // Additionally verify the page content is NOT visible (regardless of URL)
        // Use not.toBeVisible() instead of not.toContainText() because when properly denied access,
        // the page-viewer-content element doesn't exist at all (user is redirected away)
        const pageContent = getPageViewerContent(nonMemberPage);
        await expect(pageContent).not.toBeVisible({timeout: ELEMENT_TIMEOUT});
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
    await channelsPage.toBeVisible();

    // # Create wiki and page through UI
    await createWikiThroughUI(page, `Edit Permission Wiki ${await pw.random.id()}`);
    await createPageThroughUI(page, 'Editable Page', 'Original content');

    // # Attempt to edit
    const editButton = page.locator('[data-testid="wiki-page-edit-button"]');

    // * Verify edit button is visible and enabled
    await expect(editButton).toBeVisible({timeout: ELEMENT_TIMEOUT});
    const isDisabled = await editButton.isDisabled();
    expect(isDisabled).toBe(false);

    // # Click edit to verify it works
    await editButton.click();

    // * Verify editor opened
    await getEditorAndWait(page);
});

/**
 * @objective Verify channel admin can delete any page
 */
test('allows channel admin to delete any page', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    // # Create admin user
    const adminUser = await createRandomUser('admin');
    const createdAdminUser = await adminClient.createUser(adminUser, '', '');
    createdAdminUser.password = adminUser.password;
    await adminClient.addToTeam(team.id, createdAdminUser.id);
    await adminClient.addToChannel(createdAdminUser.id, channel.id);
    await adminClient.updateChannelMemberRoles(channel.id, createdAdminUser.id, 'channel_admin channel_user');

    const {page, channelsPage} = await pw.testBrowser.login(createdAdminUser);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page through UI
    await createWikiThroughUI(page, `Admin Delete Wiki ${await pw.random.id()}`);
    const createdPage = await createPageThroughUI(page, 'Page to Delete', 'Content');

    // # Open page actions menu
    await openPageActionsMenu(page);

    // * Verify delete option is available and enabled
    const deleteMenuItem = page.locator('[data-testid="page-context-menu-delete"]');
    await expect(deleteMenuItem).toBeVisible({timeout: ELEMENT_TIMEOUT});

    const isDisabled = await deleteMenuItem.isDisabled();
    expect(isDisabled).toBe(false);

    // # Click delete menu item
    await deleteMenuItem.click();

    // # Handle confirmation modal
    const confirmModal = page.getByRole('dialog', {name: /Delete|Confirm/i});
    await expect(confirmModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

    const confirmButton = confirmModal.locator('[data-testid="delete-button"], [data-testid="confirm-button"]').first();
    await confirmButton.click();

    // * Verify modal closes
    await expect(confirmModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify page no longer appears in hierarchy
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');
    const deletedPageNode = hierarchyPanel.locator(`[data-testid="page-tree-node"][data-page-id="${createdPage.id}"]`);
    await expect(deletedPageNode).not.toBeVisible({timeout: ELEMENT_TIMEOUT});
});

/**
 * @objective Verify permissions update when page moved to wiki in different channel
 */
test.skip(
    'inherits permissions when page moved to wiki in different channel',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        // SKIPPED: This test attempts to move pages between wikis in different channels,
        // but the current architecture only supports moving pages between wikis within
        // the same channel. The move modal uses Client4.getChannelWikis(channelId) which
        // only returns wikis for the current channel, not across all channels in the team.
        // There is no API endpoint for getting all team wikis to enable cross-channel moves.
        //
        // To make this test work, we would need to:
        // 1. Add a backend API endpoint to get all wikis across channels in a team
        // 2. Update the move modal to use this new endpoint
        // 3. Update permission checks to handle cross-channel wiki moves
        //
        // The test scenario itself is valid, but requires architectural changes to support.

        const {team, user, adminClient} = sharedPagesSetup;

        // # Create two channels
        const channel1 = await adminClient.createChannel({
            team_id: team.id,
            name: `channel1-${await pw.random.id()}`,
            display_name: `Channel 1 ${await pw.random.id()}`,
            type: 'O',
        });
        await adminClient.addToChannel(user.id, channel1.id);

        const channel2 = await adminClient.createChannel({
            team_id: team.id,
            name: `channel2-${await pw.random.id()}`,
            display_name: `Channel 2 ${await pw.random.id()}`,
            type: 'O',
        });
        await adminClient.addToChannel(user.id, channel2.id);

        const {page, channelsPage} = await pw.testBrowser.login(user);

        // # Create wiki1 and page in channel1 through UI
        await channelsPage.goto(team.name, channel1.name);
        const wiki1 = await createWikiThroughUI(page, `Wiki 1 ${await pw.random.id()}`);
        const testPage = await createPageThroughUI(page, 'Page to Move', 'Content');

        // # Create wiki2 in channel2 through UI
        await channelsPage.goto(team.name, channel2.name);
        const wiki2 = await createWikiThroughUI(page, `Wiki 2 ${await pw.random.id()}`);

        // # Navigate back to the page in wiki1
        const pageUrl = buildWikiPageUrl(pw.url, team.name, channel1.id, wiki1.id, testPage.id);
        await page.goto(pageUrl);
        await page.waitForLoadState('networkidle');
        await waitForPageViewerLoad(page);

        // # Open page actions menu and click Move
        await openPageActionsMenu(page);
        await clickPageContextMenuItem(page, 'move');

        // # Select wiki2 in move modal
        const moveModal = page.getByRole('dialog', {name: /Move/i});
        await expect(moveModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

        const wikiSelect = moveModal.locator('#target-wiki-select');
        await wikiSelect.selectOption(wiki2.id);

        const confirmButton = moveModal.getByRole('button', {name: /Move|Confirm/i});
        await confirmButton.click();

        await page.waitForLoadState('networkidle');

        // * Verify page now accessible via wiki2/channel2 permissions
        const movedPageUrl = buildWikiPageUrl(pw.url, team.name, channel2.id, wiki2.id, testPage.id);
        await page.goto(movedPageUrl);
        await page.waitForLoadState('networkidle');

        // * Verify page content is accessible
        await waitForPageViewerLoad(page);
        const pageContent = getPageViewerContent(page);
        await expect(pageContent).toContainText('Content');
    },
);

/**
 * @objective Verify read-only permissions restrict editing
 *
 * @precondition License must support guest accounts (Professional or Enterprise)
 */
test('restricts page actions based on channel permissions', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    // # Enable guest accounts
    const config = await adminClient.getConfig();
    const originalGuestAccountsEnabled = config.GuestAccountsSettings?.Enable;
    await adminClient.patchConfig({
        GuestAccountsSettings: {
            Enable: true,
        },
    });

    // # Create wiki and page as regular user first
    const {page: userPage, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    const wiki = await createWikiThroughUI(userPage, `Readonly Wiki ${await pw.random.id()}`);
    const testPage = await createPageThroughUI(userPage, 'Protected Page', 'Protected content');

    // # Create guest user with read-only access
    const guestUser = await createRandomUser('guest');
    const createdGuestUser = await adminClient.createUser(guestUser, '', '');
    createdGuestUser.password = guestUser.password;
    await adminClient.demoteUserToGuest(createdGuestUser.id);
    await adminClient.addToTeam(team.id, createdGuestUser.id);
    await adminClient.addToChannel(createdGuestUser.id, channel.id);

    // # Login as guest and navigate to the page
    const {page: guestPage} = await pw.testBrowser.login(createdGuestUser);
    const pageUrl = buildWikiPageUrl(pw.url, team.name, channel.id, wiki.id, testPage.id);
    await guestPage.goto(pageUrl);
    await guestPage.waitForLoadState('networkidle');

    // * Verify page is viewable
    await waitForPageViewerLoad(guestPage);
    const pageContent = getPageViewerContent(guestPage);
    await expect(pageContent).toContainText('Protected content');

    // * Verify edit button is not enabled
    const editButton = guestPage.locator('[data-testid="wiki-page-edit-button"]');
    await expect(editButton).not.toBeEnabled({timeout: AUTOSAVE_WAIT});

    // # Restore original guest accounts setting
    await adminClient.patchConfig({
        GuestAccountsSettings: {
            Enable: originalGuestAccountsEnabled,
        },
    });
});
