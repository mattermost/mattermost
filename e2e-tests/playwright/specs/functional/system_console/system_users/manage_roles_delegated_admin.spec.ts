// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {UserProfile} from '@mattermost/types/users';

import type {SystemConsolePage} from '@mattermost/playwright-lib';
import {expect, test} from '@mattermost/playwright-lib';

/**
 * Delegated (granular) administration roles surfaced in the Manage Roles modal.
 * Mirrors DELEGATED_ROLE_NAMES in the manage_roles_modal component.
 */
const USER_MANAGER_ROLE = 'system_user_manager';
const USER_MANAGER_LABEL = 'User Manager';
const SYSTEM_MANAGER_ROLE = 'system_manager';
const SYSTEM_MANAGER_LABEL = 'System Manager';

/**
 * Open the Manage Roles modal for the given user from System Console > User Management > Users.
 */
async function openManageRolesModal(systemConsolePage: SystemConsolePage, user: UserProfile) {
    await systemConsolePage.goto();
    await systemConsolePage.sidebar.users.click();
    await systemConsolePage.users.toBeVisible();

    await systemConsolePage.users.searchUsers(user.email);
    const userRow = systemConsolePage.users.usersTable.getRowByIndex(0);
    await expect(userRow.container.getByText(user.email)).toBeVisible();

    const actionMenu = await userRow.openActionMenu();
    await actionMenu.clickManageRoles();

    const {manageRolesModal} = systemConsolePage.users;
    await manageRolesModal.toBeVisible();
    return manageRolesModal;
}

/**
 * Skip when the server license does not enable delegated granular administration.
 * The feature requires an Enterprise/Enterprise Advanced license with the LDAP Groups
 * feature and is not available on the Entry SKU (see utils/license_utils.ts).
 */
async function skipIfNoDelegatedAdminLicense(adminClient: Client4) {
    const license = await adminClient.getClientLicenseOld();
    test.skip(
        license.IsLicensed !== 'true' || license.LDAPGroups !== 'true' || license.SkuShortName === 'entry',
        'Skipping test - server not licensed for delegated granular administration',
    );
}

/**
 * @objective Verify a delegated administration role can be granted from the Manage Roles modal and persists.
 */
test(
    'grants a delegated administration role from the Manage Roles modal',
    {tag: ['@system_console', '@user_management']},
    async ({pw}) => {
        const {adminUser, adminClient, user} = await pw.initSetup();
        await skipIfNoDelegatedAdminLicense(adminClient);

        // # Login as admin and open the Manage Roles modal for a regular user
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const manageRolesModal = await openManageRolesModal(systemConsolePage, user);

        // * Verify the Delegated Administration Roles section is shown for a regular member
        await expect(manageRolesModal.delegatedRolesTitle).toBeVisible();

        // # Grant the User Manager role and save
        const userManagerCheckbox = manageRolesModal.getDelegatedRoleCheckbox(USER_MANAGER_LABEL);
        await expect(userManagerCheckbox).not.toBeChecked();
        await userManagerCheckbox.check();
        await manageRolesModal.save();

        // * Verify the role was persisted via the API
        const updatedUser = await adminClient.getUser(user.id);
        expect(updatedUser.roles).toContain(USER_MANAGER_ROLE);
    },
);

/**
 * @objective Verify the modal pre-selects delegated administration roles the user already has.
 */
test(
    'pre-selects delegated administration roles the user already has',
    {tag: ['@system_console', '@user_management']},
    async ({pw}) => {
        const {adminUser, adminClient, user} = await pw.initSetup();
        await skipIfNoDelegatedAdminLicense(adminClient);

        // # Grant the System Manager role to the user up front
        await adminClient.updateUserRoles(user.id, `system_user ${SYSTEM_MANAGER_ROLE}`);

        // # Login as admin and open the Manage Roles modal for that user
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const manageRolesModal = await openManageRolesModal(systemConsolePage, user);

        // * Verify the already-granted role is pre-checked and others are not
        await expect(manageRolesModal.getDelegatedRoleCheckbox(SYSTEM_MANAGER_LABEL)).toBeChecked();
        await expect(manageRolesModal.getDelegatedRoleCheckbox(USER_MANAGER_LABEL)).not.toBeChecked();
    },
);

/**
 * @objective Verify the Delegated Administration Roles section is hidden when System Admin is selected.
 */
test(
    'hides the delegated administration roles section when System Admin is selected',
    {tag: ['@system_console', '@user_management']},
    async ({pw}) => {
        const {adminUser, adminClient, user} = await pw.initSetup();
        await skipIfNoDelegatedAdminLicense(adminClient);

        // # Login as admin and open the Manage Roles modal for a regular user
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const manageRolesModal = await openManageRolesModal(systemConsolePage, user);

        // * Verify the section is initially visible for a member
        await expect(manageRolesModal.delegatedRolesTitle).toBeVisible();

        // # Promote the account to System Admin within the modal
        await manageRolesModal.systemAdminRadio.check();

        // * Verify the delegated roles section is hidden since System Admins already have full access
        await expect(manageRolesModal.delegatedRolesTitle).not.toBeVisible();
    },
);
