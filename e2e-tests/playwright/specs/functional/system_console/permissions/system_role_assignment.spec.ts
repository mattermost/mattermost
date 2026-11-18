// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {settle, Api, systemConsolePath, expect, test, type App} from '@mattermost/playwright-lib';

const SYSTEM_ROLES_PATH = systemConsolePath('user_management/system_roles');

/** Opens System Console > Delegated Granular Administration and the role's page. */
async function openRole(app: App, roleId: Parameters<App['admin']['roles']['row']>[0]) {
    await app.page.goto(SYSTEM_ROLES_PATH);
    await app.admin.roles.row(roleId).editLink.click();
    await expect(app.admin.role.nameText).toBeVisible();
    return app.admin.role;
}

const roleCases = [{roleId: 'system_shared_channel_manager'}] as const;

for (const {roleId} of roleCases) {
    test(
        `Assigning a user to ${roleId} persists after page reload`,
        {tag: ['@smoke', '@system_console']},
        async ({pw}) => {
            const {adminUser, adminClient, user} = await pw.initSetup();

            // # Log in as admin and open the role
            const {app} = await pw.testBrowser.login(adminUser);
            let role = await openRole(app, roleId);

            // # Add People: search for the test user, pick them, and add
            const {users} = await role.addPeopleButton.clickTo(app.addUsersToRoleModal);
            await users.searchCombobox.focus();
            await users.searchCombobox.type(user.username);
            await users.results.user(user).click();
            await expect(users.remove(user.id)).toBeVisible();
            await users.saveButton.click();

            // * The user shows in the role's assigned people
            await expect(role.users.row(user.id)).toBeVisible();

            // # Save the role assignment, which returns to the roles list
            await settle(role.savePanel.saveButton, {wait: Api.UpdateUserRoles}).click();
            await expect(app.page).toHavePath(SYSTEM_ROLES_PATH);

            // * Reopened, the role still lists the user
            role = await openRole(app, roleId);
            await expect(role.users.row(user.id)).toBeVisible();

            // * The server has the role on the user
            const updatedUser = await adminClient.getUser(user.id);
            expect(updatedUser.roles).toContain(roleId);
        },
    );
}
