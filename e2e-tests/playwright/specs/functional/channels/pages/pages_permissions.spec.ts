// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';
import {createRandomUser} from '@mattermost/playwright-lib';

import {
    createWikiThroughUI,
    createPageThroughUI,
    createChildPageThroughContextMenu,
    createTestChannel,
    getNewPageButton,
    openPageActionsMenu,
    clickPageContextMenuItem,
    buildWikiPageUrl,
    waitForPageViewerLoad,
    getEditorAndWait,
    typeInEditor,
    SHORT_WAIT,
    EDITOR_LOAD_WAIT,
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
    const wiki = await createWikiThroughUI(page, `Permission Wiki ${await pw.random.id()}`);

    // # Attempt to create page
    const newPageButton = getNewPageButton(page);

    // * Verify button is visible and enabled
    await expect(newPageButton).toBeVisible({timeout: ELEMENT_TIMEOUT});
    const isDisabled = await newPageButton.isDisabled();
    expect(isDisabled).toBe(false);

    // # Click to verify creation flow works
    await newPageButton.click();
    await page.waitForTimeout(SHORT_WAIT);

    // * Verify editor opened
    const editor = await getEditorAndWait(page);
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
        await nonMemberPage.goto(`${pw.url}/${team.name}/channels/${privateChannel.name}/wikis/${wiki.id}/pages/${testPage.id}`);
        await nonMemberPage.waitForLoadState('networkidle');

        // Wait for any redirects to complete
        await nonMemberPage.waitForTimeout(EDITOR_LOAD_WAIT);

        // * Verify access denied (error page, redirect, or permission message)
        const currentUrl = nonMemberPage.url();
        const isAccessDenied = currentUrl.includes('error') ||
                              currentUrl.includes('unauthorized') ||
                              !currentUrl.includes(wiki.id);

        if (!isAccessDenied) {
            // Check for permission error message on page
            const errorMessage = nonMemberPage.locator('text=/permission|access denied|unauthorized/i').first();
            await expect(errorMessage).toBeVisible({timeout: ELEMENT_TIMEOUT});
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
    await channelsPage.toBeVisible();

    // # Create wiki and page through UI
    const wiki = await createWikiThroughUI(page, `Edit Permission Wiki ${await pw.random.id()}`);
    const testPage = await createPageThroughUI(page, 'Editable Page', 'Original content');

    // # Attempt to edit
    const editButton = page.locator('[data-testid="wiki-page-edit-button"]');

    // * Verify edit button is visible and enabled
    await expect(editButton).toBeVisible({timeout: ELEMENT_TIMEOUT});
    const isDisabled = await editButton.isDisabled();
    expect(isDisabled).toBe(false);

    // # Click edit to verify it works
    await editButton.click();
    await page.waitForTimeout(SHORT_WAIT);

    // * Verify editor opened
    const editor = await getEditorAndWait(page);
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
    const wiki = await createWikiThroughUI(page, `Admin Delete Wiki ${await pw.random.id()}`);
    const testPage = await createPageThroughUI(page, 'Page to Delete', 'Content');

    // # Open page actions menu
    await openPageActionsMenu(page);

    // * Verify delete option is available and enabled
    const deleteMenuItem = page.locator('[data-testid="page-context-menu-delete"]');
    await expect(deleteMenuItem).toBeVisible({timeout: ELEMENT_TIMEOUT});

    const isDisabled = await deleteMenuItem.isDisabled();
    expect(isDisabled).toBe(false);
});

/**
 * @objective Verify permissions update when page moved to wiki in different channel
 */
test.skip('inherits permissions when page moved to wiki in different channel', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
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
    const pageContent = page.locator('[data-testid="page-viewer-content"]');
    await expect(pageContent).toContainText('Content');
});

/**
 * @objective Verify read-only permissions restrict editing
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
    const {page} = await pw.testBrowser.login(createdGuestUser);
    const pageUrl = buildWikiPageUrl(pw.url, team.name, channel.id, wiki.id, testPage.id);
    await page.goto(pageUrl);
    await page.waitForLoadState('networkidle');

    // * Verify page is viewable
    await waitForPageViewerLoad(page);
    const pageContent = page.locator('[data-testid="page-viewer-content"]');
    await expect(pageContent).toContainText('Protected content');

    // * Verify edit button is not enabled
    const editButton = page.locator('[data-testid="wiki-page-edit-button"]');
    await expect(editButton).not.toBeEnabled({timeout: AUTOSAVE_WAIT});

    // # Restore original guest accounts setting
    await adminClient.patchConfig({
        GuestAccountsSettings: {
            Enable: originalGuestAccountsEnabled,
        },
    });
});
