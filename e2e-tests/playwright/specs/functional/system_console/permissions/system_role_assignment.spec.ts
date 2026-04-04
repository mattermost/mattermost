// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

test(
    'Assigning a user to system_shared_channel_manager persists after page reload',
    {tag: ['@smoke', '@system_console']},
    async ({pw}) => {
        const {adminUser, adminClient, user} = await pw.initSetup();

        // Login as admin and navigate to System Console
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await systemConsolePage.goto();

        // Navigate to Delegated Granular Administration
        await systemConsolePage.sidebar.delegatedGranularAdministration.click();
        await systemConsolePage.delegatedGranularAdministration.toBeVisible();

        // Click Edit on Shared Channel Manager role
        await systemConsolePage.delegatedGranularAdministration.adminRolesPanel.sharedChannelManager.clickEdit();
        await systemConsolePage.delegatedGranularAdministration.systemRoles.toBeVisible();

        // Click "Add People" to open the modal
        await systemConsolePage.delegatedGranularAdministration.systemRoles.assignedPeoplePanel.clickAddPeople();

        // Interact with the Add Users modal
        const modal = systemConsolePage.page.locator('#addUsersToRoleModal');
        await expect(modal).toBeVisible();

        // Search for the test user
        const searchInput = modal.getByPlaceholder('Search for people');
        await searchInput.fill(user.username);

        // Wait for search results and click the user row
        const userRow = modal.locator('.more-modal__row').filter({hasText: user.username});
        await expect(userRow).toBeVisible();
        await userRow.click();

        // Click the Add button in the modal
        const addButton = modal.locator('button').filter({hasText: 'Add'});
        await addButton.click();

        // The user should now appear in the Assigned People panel with a "New" tag
        const assignedPanel = systemConsolePage.delegatedGranularAdministration.systemRoles.assignedPeoplePanel;
        const assignedUserRow = assignedPanel.getUserRowByUsername(user.username);
        await assignedUserRow.toBeVisible();

        // Save the role assignment
        await systemConsolePage.delegatedGranularAdministration.systemRoles.save();

        // Wait for redirect back to system_roles list
        await systemConsolePage.page.waitForURL('**/admin_console/user_management/system_roles');

        // Navigate back to the Shared Channel Manager role
        await systemConsolePage.delegatedGranularAdministration.adminRolesPanel.sharedChannelManager.clickEdit();
        await systemConsolePage.delegatedGranularAdministration.systemRoles.toBeVisible();

        // Verify the user persists in the Assigned People panel
        const persistedUserRow = systemConsolePage.delegatedGranularAdministration.systemRoles.assignedPeoplePanel.getUserRowByUsername(user.username);
        await persistedUserRow.toBeVisible();

        // Also verify via API that the user has the role
        const updatedUser = await adminClient.getUser(user.id);
        expect(updatedUser.roles).toContain('system_shared_channel_manager');
    },
);

test(
    'Assigning a user to system_secure_connection_manager persists after page reload',
    {tag: ['@smoke', '@system_console']},
    async ({pw}) => {
        const {adminUser, adminClient, user} = await pw.initSetup();

        // Login as admin and navigate to System Console
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await systemConsolePage.goto();

        // Navigate to Delegated Granular Administration
        await systemConsolePage.sidebar.delegatedGranularAdministration.click();
        await systemConsolePage.delegatedGranularAdministration.toBeVisible();

        // Click Edit on Secure Connection Manager role
        await systemConsolePage.delegatedGranularAdministration.adminRolesPanel.secureConnectionManager.clickEdit();
        await systemConsolePage.delegatedGranularAdministration.systemRoles.toBeVisible();

        // Click "Add People" to open the modal
        await systemConsolePage.delegatedGranularAdministration.systemRoles.assignedPeoplePanel.clickAddPeople();

        // Interact with the Add Users modal
        const modal = systemConsolePage.page.locator('#addUsersToRoleModal');
        await expect(modal).toBeVisible();

        // Search for the test user
        const searchInput = modal.getByPlaceholder('Search for people');
        await searchInput.fill(user.username);

        // Wait for search results and click the user row
        const userRow = modal.locator('.more-modal__row').filter({hasText: user.username});
        await expect(userRow).toBeVisible();
        await userRow.click();

        // Click the Add button in the modal
        const addButton = modal.locator('button').filter({hasText: 'Add'});
        await addButton.click();

        // The user should now appear in the Assigned People panel with a "New" tag
        const assignedPanel = systemConsolePage.delegatedGranularAdministration.systemRoles.assignedPeoplePanel;
        const assignedUserRow = assignedPanel.getUserRowByUsername(user.username);
        await assignedUserRow.toBeVisible();

        // Save the role assignment
        await systemConsolePage.delegatedGranularAdministration.systemRoles.save();

        // Wait for redirect back to system_roles list
        await systemConsolePage.page.waitForURL('**/admin_console/user_management/system_roles');

        // Navigate back to the Secure Connection Manager role
        await systemConsolePage.delegatedGranularAdministration.adminRolesPanel.secureConnectionManager.clickEdit();
        await systemConsolePage.delegatedGranularAdministration.systemRoles.toBeVisible();

        // Verify the user persists in the Assigned People panel
        const persistedUserRow = systemConsolePage.delegatedGranularAdministration.systemRoles.assignedPeoplePanel.getUserRowByUsername(user.username);
        await persistedUserRow.toBeVisible();

        // Also verify via API that the user has the role
        const updatedUser = await adminClient.getUser(user.id);
        expect(updatedUser.roles).toContain('system_secure_connection_manager');
    },
);
