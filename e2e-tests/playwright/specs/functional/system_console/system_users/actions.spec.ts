// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {type PlaywrightExtended, expect, test} from '@mattermost/playwright-lib';

test('MM-T5520-1 should activate and deactivate users', async ({pw}) => {
    const {getUser, systemConsolePage} = await setupAndGetRandomUser(pw);

    const userRow = systemConsolePage.users.usersTable.getRowByIndex(0);

    // # Open menu and deactivate the user
    const actionMenu = await userRow.openActionMenu();
    await actionMenu.clickDeactivate();

    // # Press confirm on the modal
    await systemConsolePage.users.confirmModal.confirm();

    // * Verify user is deactivated
    await expect(userRow.container.getByText('Deactivated')).toBeVisible();
    expect((await getUser()).delete_at).toBeGreaterThan(0);

    // # Open menu and reactivate the user
    const actionMenu2 = await userRow.openActionMenu();
    await actionMenu2.clickActivate();

    // * Verify user is activated
    await expect(userRow.container.getByText('Member')).toBeVisible();
});

test('MM-T5520-2 should change user roles', async ({pw}) => {
    const {getUser, systemConsolePage} = await setupAndGetRandomUser(pw);

    const userRow = systemConsolePage.users.usersTable.getRowByIndex(0);

    // # Open menu and click Manage roles
    const actionMenu = await userRow.openActionMenu();
    await actionMenu.clickManageRoles();

    // # Change to System Admin and click Save
    const systemAdmin = systemConsolePage.page.locator('input[name="systemadmin"]');
    await systemAdmin.waitFor();
    await systemAdmin.click();
    await systemConsolePage.users.manageRolesModal.save();

    // * Verify that the role was updated
    await expect(userRow.container.getByText('System Admin')).toBeVisible();
    expect((await getUser()).roles).toContain('system_admin');

    // # Open menu and click Manage roles
    const actionMenu2 = await userRow.openActionMenu();
    await actionMenu2.clickManageRoles();

    // # Change to Member and click Save
    const systemMember = systemConsolePage.page.locator('input[name="systemmember"]');
    await systemMember.waitFor();
    await systemMember.click();
    await systemConsolePage.users.manageRolesModal.save();

    // * Verify that the role was updated
    await expect(userRow.container.getByText('Member')).toBeVisible();
    expect((await getUser()).roles).toContain('system_user');
});

test('MM-T5520-3 should be able to manage teams', async ({pw}) => {
    const {systemConsolePage} = await setupAndGetRandomUser(pw);

    const userRow = systemConsolePage.users.usersTable.getRowByIndex(0);

    // # Open menu and click Manage teams
    const actionMenu = await userRow.openActionMenu();
    await actionMenu.clickManageTeams();

    // # Click Make Team Admin
    const team = systemConsolePage.page.locator('div.manage-teams__team');
    const teamDropdown = team.locator('div.MenuWrapper');
    await teamDropdown.click();
    const makeTeamAdmin = teamDropdown.getByText('Make Team Admin');
    await makeTeamAdmin.click();

    // * Verify role is updated
    await expect(team.getByText('Team Admin')).toBeVisible();

    // # Change back to Team Member
    await teamDropdown.click();
    const makeTeamMember = teamDropdown.getByText('Make Team Member');
    await makeTeamMember.click();

    // * Verify role is updated
    await expect(team.getByText('Team Member')).toBeVisible();

    // # Click Remove From Team
    await teamDropdown.click();
    const removeFromTeam = teamDropdown.getByText('Remove From Team');
    await removeFromTeam.click();

    // * The team should be detached
    await team.waitFor({state: 'detached'});
    await expect(team).not.toBeVisible();
});

test('MM-T5520-4 should reset the users password', async ({pw}) => {
    const {systemConsolePage} = await setupAndGetRandomUser(pw);

    const userRow = systemConsolePage.users.usersTable.getRowByIndex(0);

    // # Open menu and click Reset Password
    const actionMenu = await userRow.openActionMenu();
    await actionMenu.clickResetPassword();

    // # Enter a random password and click Reset
    await systemConsolePage.users.resetPasswordModal.fillPassword(await pw.random.id());
    await systemConsolePage.users.resetPasswordModal.reset();
});

test('MM-T5520-5 should change the users email', async ({pw}) => {
    const {getUser, systemConsolePage} = await setupAndGetRandomUser(pw);
    const newEmail = `${await pw.random.id()}@example.com`;

    const userRow = systemConsolePage.users.usersTable.getRowByIndex(0);

    // # Open menu and click Update Email
    const actionMenu = await userRow.openActionMenu();
    await actionMenu.clickUpdateEmail();

    // # Enter new email and click Update
    await systemConsolePage.users.updateEmailModal.fillEmail(newEmail);
    await systemConsolePage.users.updateEmailModal.update();

    // * Verify that the email updated
    await expect(userRow.container.getByText(newEmail)).toBeVisible();
    expect((await getUser()).email).toEqual(newEmail);
});

test('MM-T5520-6 should revoke sessions', async ({pw}) => {
    const {systemConsolePage} = await setupAndGetRandomUser(pw);

    const userRow = systemConsolePage.users.usersTable.getRowByIndex(0);

    // # Open menu and revoke sessions
    const actionMenu = await userRow.openActionMenu();
    await actionMenu.clickRevokeSessions();

    // # Press confirm on the modal
    await systemConsolePage.users.confirmModal.confirm();

    // * Verify no error is displayed
    await expect(userRow.container.locator('.error')).not.toBeVisible();
});

/**
 * Setup a new random user, and search for it such that it's the first row in the list
 * @param pw
 * @returns A function to get the refreshed user, and the System Console page for navigation
 */
async function setupAndGetRandomUser(pw: PlaywrightExtended) {
    const {adminUser, adminClient} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Log in as admin
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Create a random user to edit
    const user = await adminClient.createUser(await pw.random.user(), '', '');
    const team = await adminClient.createTeam(await pw.random.team());
    await adminClient.addToTeam(team.id, user.id);

    // # Visit system console
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // # Go to Users section
    await systemConsolePage.sidebar.users.click();
    await systemConsolePage.users.toBeVisible();

    // # Search for the user
    await systemConsolePage.users.searchUsers(user.email);

    // Wait for search results
    const userRow = systemConsolePage.users.usersTable.getRowByIndex(0);
    await expect(userRow.container.getByText(user.email)).toBeVisible();

    return {getUser: () => adminClient.getUser(user.id), systemConsolePage};
}
