// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

const roleCases = [
    {accessor: 'sharedChannelManager' as const, roleId: 'system_shared_channel_manager'},
    {accessor: 'secureConnectionManager' as const, roleId: 'system_secure_connection_manager'},
];

for (const {accessor, roleId} of roleCases) {
    test(
        `Assigning a user to ${roleId} persists after page reload`,
        {tag: ['@smoke', '@system_console']},
        async ({pw}) => {
            const {adminUser, adminClient, user} = await pw.initSetup();

            // Login as admin and navigate to System Console
            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            await systemConsolePage.goto();

            // Navigate to Delegated Granular Administration
            await systemConsolePage.sidebar.delegatedGranularAdministration.click();
            await systemConsolePage.delegatedGranularAdministration.toBeVisible();

            // Click Edit on the role
            await systemConsolePage.delegatedGranularAdministration.adminRolesPanel[accessor].clickEdit();
            await systemConsolePage.delegatedGranularAdministration.systemRoles.toBeVisible();

            // Click "Add People" to open the modal
            await systemConsolePage.delegatedGranularAdministration.systemRoles.assignedPeoplePanel.clickAddPeople();

            // Interact with the Add Users modal
            const modal = systemConsolePage.page.locator('#addUsersToRoleModal');
            await expect(modal).toBeVisible();

            // Search for the test user using react-select's combobox input
            const searchInput = modal.getByRole('combobox', {name: 'Search for people'});
            await searchInput.click();
            await searchInput.pressSequentially(user.username, {delay: 50});

            // Wait for search results and click the user row
            const userRow = modal.locator('.more-modal__row').filter({hasText: user.username});
            await expect(userRow).toBeVisible();
            await userRow.click();

            // Click the Add button in the modal
            await modal.locator('#saveItems').click();

            // The user should now appear in the Assigned People panel
            const assignedPanel = systemConsolePage.delegatedGranularAdministration.systemRoles.assignedPeoplePanel;
            const assignedUserRow = assignedPanel.getUserRowByUsername(user.username);
            await assignedUserRow.toBeVisible();

            // Save the role assignment
            await systemConsolePage.delegatedGranularAdministration.systemRoles.save();

            // Wait for redirect back to system_roles list
            await systemConsolePage.page.waitForURL('**/admin_console/user_management/system_roles');

            // Navigate back to the role
            await systemConsolePage.delegatedGranularAdministration.adminRolesPanel[accessor].clickEdit();
            await systemConsolePage.delegatedGranularAdministration.systemRoles.toBeVisible();

            // Verify the user persists in the Assigned People panel
            const persistedUserRow =
                systemConsolePage.delegatedGranularAdministration.systemRoles.assignedPeoplePanel.getUserRowByUsername(
                    user.username,
                );
            await persistedUserRow.toBeVisible();

            // Also verify via API that the user has the role
            const updatedUser = await adminClient.getUser(user.id);
            expect(updatedUser.roles).toContain(roleId);
        },
    );
}
