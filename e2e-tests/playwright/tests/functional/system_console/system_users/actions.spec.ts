// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TestBrowser} from '@e2e-support//browser_context';
import {Client, createRandomTeam, createRandomUser} from '@e2e-support/server';
import {expect, test} from '@e2e-support/test_fixture';
import {getRandomId} from '@e2e-support/util';
import {UserProfile} from '@mattermost/types/users';

/**
 * Setup a new random user, and search for it such that it's the first row in the list
 * @param pw
 * @param pages
 * @returns A function to get the refreshed user, and the System Console page for navigation
 */
async function setupAndGetRandomUser(pw: {
    testBrowser: TestBrowser;
    initSetup: () => Promise<{adminUser: UserProfile | null; adminClient: Client}>;
}) {
    const {adminUser, adminClient} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Log in as admin
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Create a random user to edit for
    const user = await adminClient.createUser(createRandomUser(), '', '');
    const team = await adminClient.createTeam(createRandomTeam());
    await adminClient.addToTeam(team.id, user.id);

    // # Visit system console
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // # Go to Users section
    await systemConsolePage.sidebar.goToItem('Users');
    await systemConsolePage.systemUsers.toBeVisible();

    // # Search for user-1
    await systemConsolePage.systemUsers.enterSearchText(user.email);
    const userRow = await systemConsolePage.systemUsers.getNthRow(1);
    await userRow.getByText(user.email).waitFor();
    const innerText = await userRow.innerText();
    expect(innerText).toContain(user.email);

    return {getUser: () => adminClient.getUser(user.id), systemConsolePage};
}

test('MM-T5520-1 should activate and deactivate users', async ({pw}) => {
    const {getUser, systemConsolePage} = await setupAndGetRandomUser(pw);

    // # Open menu and deactivate the user
    await systemConsolePage.systemUsers.actionMenuButtons[0].click();
    const deactivate = await systemConsolePage.systemUsersActionMenus[0].getMenuItem('Deactivate');
    await deactivate.click();

    // # Press confirm on the modal
    await systemConsolePage.confirmModal.confirm();

    // * Verify user is deactivated
    const firstRow = await systemConsolePage.systemUsers.getNthRow(1);
    await firstRow.getByText('Deactivated').waitFor();
    expect(await firstRow.innerText()).toContain('Deactivated');
    expect((await getUser()).delete_at).toBeGreaterThan(0);

    // # Open menu and reactivate the user
    await systemConsolePage.systemUsers.actionMenuButtons[0].click();
    const activate = await systemConsolePage.systemUsersActionMenus[0].getMenuItem('Activate');
    await activate.click();

    // * Verify user is activated
    await firstRow.getByText('Member').waitFor();
    expect(await firstRow.innerText()).toContain('Member');
});

test('MM-T5520-2 should change user roles', async ({pw}) => {
    const {getUser, systemConsolePage} = await setupAndGetRandomUser(pw);

    // # Open menu and click Manage roles
    await systemConsolePage.systemUsers.actionMenuButtons[0].click();
    let manageRoles = await systemConsolePage.systemUsersActionMenus[0].getMenuItem('Manage roles');
    await manageRoles.click();

    // # Change to System Admin and click Save
    const systemAdmin = systemConsolePage.page.locator('input[name="systemadmin"]');
    await systemAdmin.waitFor();
    await systemAdmin.click();
    systemConsolePage.saveRoleChange();

    // * Verify that the modal closed and no error showed
    await systemAdmin.waitFor({state: 'detached'});

    // * Verify that the role was updated
    const firstRow = await systemConsolePage.systemUsers.getNthRow(1);
    expect(await firstRow.innerText()).toContain('System Admin');
    expect((await getUser()).roles).toContain('system_admin');

    // # Open menu and click Manage roles
    await systemConsolePage.systemUsers.actionMenuButtons[0].click();
    manageRoles = await systemConsolePage.systemUsersActionMenus[0].getMenuItem('Manage roles');
    await manageRoles.click();

    // # Change to Member and click Save
    const systemMember = systemConsolePage.page.locator('input[name="systemmember"]');
    await systemMember.waitFor();
    await systemMember.click();
    await systemConsolePage.saveRoleChange();

    // * Verify that the modal closed and no error showed
    await systemMember.waitFor({state: 'detached'});

    // * Verify that the role was updated
    expect(await firstRow.innerText()).toContain('Member');
    expect((await getUser()).roles).toContain('system_user');
});

test('MM-T5520-3 should be able to manage teams', async ({pw}) => {
    const {systemConsolePage} = await setupAndGetRandomUser(pw);

    // # Open menu and click Manage teams
    await systemConsolePage.systemUsers.actionMenuButtons[0].click();
    const manageTeams = await systemConsolePage.systemUsersActionMenus[0].getMenuItem('Manage teams');
    await manageTeams.click();

    // # Click Make Team Admin
    const team = systemConsolePage.page.locator('div.manage-teams__team');
    const teamDropdown = team.locator('div.MenuWrapper');
    await teamDropdown.click();
    const makeTeamAdmin = teamDropdown.getByText('Make Team Admin');
    await makeTeamAdmin.click();

    // * Verify role is updated
    expect(await team.innerText()).toContain('Team Admin');

    // # Change back to Team Member
    await teamDropdown.click();
    const makeTeamMember = teamDropdown.getByText('Make Team Member');
    await makeTeamMember.click();

    // * Verify role is updated
    expect(await team.innerText()).toContain('Team Member');

    // # Click Remove From Team
    await teamDropdown.click();
    const removeFromTeam = teamDropdown.getByText('Remove From Team');
    await removeFromTeam.click();

    // * The team should be detached
    await team.waitFor({state: 'detached'});
    expect(team).not.toBeVisible();
});

test('MM-T5520-4 should reset the users password', async ({pw}) => {
    const {systemConsolePage} = await setupAndGetRandomUser(pw);

    // # Open menu and click Reset Password
    await systemConsolePage.systemUsers.actionMenuButtons[0].click();
    const resetPassword = await systemConsolePage.systemUsersActionMenus[0].getMenuItem('Reset password');
    await resetPassword.click();

    // # Enter a random password and click Save
    const passwordInput = systemConsolePage.page.locator('input[type="password"]');
    await passwordInput.fill(getRandomId());
    await systemConsolePage.clickResetButton();

    // * Verify that the modal closed and no error showed
    await passwordInput.waitFor({state: 'detached'});
});

test('MM-T5520-5 should change the users email', async ({pw}) => {
    const {getUser, systemConsolePage} = await setupAndGetRandomUser(pw);
    const newEmail = `${getRandomId()}@example.com`;

    // # Open menu and click Update Email
    await systemConsolePage.systemUsers.actionMenuButtons[0].click();
    const updateEmail = await systemConsolePage.systemUsersActionMenus[0].getMenuItem('Update email');
    await updateEmail.click();

    // # Enter a random password and click Save
    const emailInput = await systemConsolePage.page.locator('input[type="email"]');
    await emailInput.fill(newEmail);
    await systemConsolePage.clickResetButton();

    // * Verify that the modal closed
    await emailInput.waitFor({state: 'detached'});

    // * Verify that the email updated
    const firstRow = await systemConsolePage.systemUsers.getNthRow(1);
    expect(await firstRow.innerText()).toContain(newEmail);
    expect((await getUser()).email).toEqual(newEmail);
});

test('MM-T5520-6 should revoke sessions', async ({pw}) => {
    const {systemConsolePage} = await setupAndGetRandomUser(pw);

    // # Open menu and revoke sessions
    await systemConsolePage.systemUsers.actionMenuButtons[0].click();
    const removeSessions = await systemConsolePage.systemUsersActionMenus[0].getMenuItem('Remove sessions');
    await removeSessions.click();

    // # Press confirm on the modal
    await systemConsolePage.confirmModal.confirm();

    const firstRow = await systemConsolePage.systemUsers.getNthRow(1);
    expect(await firstRow.innerHTML()).not.toContain('class="error"');
});
