// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    Api,
    expect,
    openSystemUsers,
    searchSystemUsers,
    settle,
    test,
    type PlaywrightExtended,
} from '@mattermost/playwright-lib';

test('MM-T5520-1 should activate and deactivate users', async ({pw}) => {
    const {app, getUser, row} = await setupAndGetRandomUser(pw);

    // # Open menu and deactivate the user, confirming the dialog
    await row.actionsButton.clickTo(app.adminUserActionsMenu.deactivateMenuItem);
    const confirm = await app.adminUserActionsMenu.deactivateMenuItem.clickTo(app.admin.users.deactivateModal);
    await settle(confirm.confirmButton, {wait: Api.UpdateUserActive}).click();

    // * Verify user is deactivated
    await expect(row).toContainText('Deactivated');
    await expect.poll(async () => (await getUser()).delete_at).toBeGreaterThan(0);

    // # Open menu and reactivate the user
    await row.actionsButton.clickTo(app.adminUserActionsMenu.activateMenuItem);
    await settle(app.adminUserActionsMenu.activateMenuItem, {wait: Api.UpdateUserActive}).click();

    // * Verify user is activated
    await expect(row).toContainText('Member');
    await expect(row).not.toContainText('Deactivated');
});

test('MM-T5520-2 should change user roles', async ({pw}) => {
    const {app, getUser, row} = await setupAndGetRandomUser(pw);

    // # Open menu and click Manage roles
    await row.actionsButton.clickTo(app.adminUserActionsMenu.manageRolesMenuItem);
    let roles = await app.adminUserActionsMenu.manageRolesMenuItem.clickTo(app.manageRolesModal);

    // # Change to System Admin and click Save
    await roles.systemAdminRadio.check();
    await expect(roles.systemAdminRadio).toBeChecked();
    await settle(roles.saveButton, {wait: Api.UpdateUserRoles}).click();

    // * Verify that the role was updated
    await expect(row).toContainText('System Admin');
    await expect.poll(async () => (await getUser()).roles).toContain('system_admin');

    // # Open menu and click Manage roles
    await row.actionsButton.clickTo(app.adminUserActionsMenu.manageRolesMenuItem);
    roles = await app.adminUserActionsMenu.manageRolesMenuItem.clickTo(app.manageRolesModal);

    // # Change to Member and click Save
    await roles.memberRadio.check();
    await expect(roles.memberRadio).toBeChecked();
    await settle(roles.saveButton, {wait: Api.UpdateUserRoles}).click();

    // * Verify that the role was updated
    await expect(row).toContainText('Member');
    await expect(row).not.toContainText('System Admin');
    await expect.poll(async () => (await getUser()).roles).toContain('system_user');
});

test('MM-T5520-3 should be able to manage teams', async ({pw}) => {
    const {app, row, team} = await setupAndGetRandomUser(pw);

    // # Open menu and click Manage teams
    await row.actionsButton.clickTo(app.adminUserActionsMenu.manageTeamsMenuItem);
    await app.adminUserActionsMenu.manageTeamsMenuItem.clickTo(app.manageTeamsModal);
    const teamRow = app.manageTeamsModal.team(team);

    // # Open the role dropdown and click Make Team Admin
    await expect(teamRow.roleButton).toHaveText('Team Member');
    await teamRow.roleButton.clickTo(app.manageTeamsRoleMenu.removeMenuItem);
    await settle(app.manageTeamsRoleMenu.makeAdminMenuItem, {wait: Api.UpdateTeamMemberSchemeRoles}).click();

    // * Verify role is updated
    await expect(teamRow.roleButton).toHaveText('Team Admin');

    // # Change back to Team Member
    await teamRow.roleButton.clickTo(app.manageTeamsRoleMenu.removeMenuItem);
    await settle(app.manageTeamsRoleMenu.makeMemberMenuItem, {wait: Api.UpdateTeamMemberSchemeRoles}).click();

    // * Verify role is updated
    await expect(teamRow.roleButton).toHaveText('Team Member');

    // # Click Remove from Team
    await teamRow.roleButton.clickTo(app.manageTeamsRoleMenu.removeMenuItem);
    await settle(app.manageTeamsRoleMenu.removeMenuItem, {wait: Api.RemoveTeamMember}).click();

    // * The team row is gone
    await expect(teamRow).toHaveCount(0);
});

test('MM-T5520-4 should reset the users password', async ({pw}) => {
    const {app, row} = await setupAndGetRandomUser(pw);

    // # Open menu and click Reset Password
    await row.actionsButton.clickTo(app.adminUserActionsMenu.resetPasswordMenuItem);
    const modal = await app.adminUserActionsMenu.resetPasswordMenuItem.clickTo(app.resetPasswordModal);

    // # Enter a random password and click Reset
    await modal.newPassword.container.fill(pw.newTestPassword());
    await settle(modal.confirmButton, {wait: Api.UpdateUserPassword}).click();

    // * The dialog closes
    await expect(modal.newPassword.container).not.toBeVisible();
});

test('MM-T5520-5 should change the users email', async ({pw}) => {
    const {app, getUser, row} = await setupAndGetRandomUser(pw);
    const newEmail = `${pw.random.id()}@example.com`;

    // # Open menu and click Update Email
    await row.actionsButton.clickTo(app.adminUserActionsMenu.updateEmailMenuItem);
    const modal = await app.adminUserActionsMenu.updateEmailMenuItem.clickTo(app.admin.users.resetEmailModal);

    // # Enter new email and click Update
    await modal.newEmail.container.fill(newEmail);
    await settle(modal.confirmButton, {wait: Api.PatchUser}).click();

    // * Verify that the email updated
    await expect(row.cell('emailColumn')).toHaveText(newEmail);
    await expect.poll(async () => (await getUser()).email).toEqual(newEmail);
});

test('MM-T5520-6 should revoke sessions', async ({pw}) => {
    const {app, row} = await setupAndGetRandomUser(pw);

    // # Open menu and revoke sessions, confirming the dialog
    await row.actionsButton.clickTo(app.adminUserActionsMenu.revokeSessionsMenuItem);
    const confirm = await app.adminUserActionsMenu.revokeSessionsMenuItem.clickTo(app.admin.users.revokeSessionsModal);
    await settle(confirm.confirmButton, {wait: Api.RevokeAllSessions}).click();
    await expect(confirm.confirmButton).not.toBeVisible();

    // * Verify no error is displayed
    await expect(row).toBeVisible();
    await expect(row.errorText).not.toBeVisible();
});

/**
 * Sets up a new random user in a new team, and searches the System Console's users for it.
 * @returns The app, the user's row, a function to get the refreshed user, and the team
 */
async function setupAndGetRandomUser(pw: PlaywrightExtended) {
    const {adminUser, adminClient} = await pw.initSetup();

    // # Create a random user to edit
    const user = await adminClient.createUser(await pw.random.user(), '', '');
    const team = await adminClient.createTeam(await pw.random.team());
    await adminClient.addToTeam(team.id, user.id);

    // # Log in as admin, open System Console > Users and search for the user
    const app = await openSystemUsers(pw, adminUser);
    await searchSystemUsers(app, user.email, user);
    const row = app.admin.users.table.row(user.id);
    await expect(row.cell('emailColumn')).toHaveText(user.email);

    return {app, getUser: () => adminClient.getUser(user.id), row, team};
}
