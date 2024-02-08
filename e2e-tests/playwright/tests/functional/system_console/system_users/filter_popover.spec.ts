// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@playwright/test';

import {test} from '@e2e-support/test_fixture';
import {createRandomTeam, createRandomUser} from '@e2e-support/server';

test('MM-X The team filter should correctly apply the filter', async ({pw, pages}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Log in as admin
    const {page} = await pw.testBrowser.login(adminUser);

    const userAndItsTeam = [];

    // # Create 2 team to filter
    for (let i = 0; i < 2; i++) {
        // # Create a team
        const team = await adminClient.createTeam(createRandomTeam());

        // # Create a user corresponding to the team
        const user = await adminClient.createUser(createRandomUser(), '', '');

        // # Add the user to the team
        await adminClient.addToTeam(team.id, user.id);

        userAndItsTeam.push({user, team});
    }

    // # Visit system console
    const systemConsolePage = new pages.SystemConsolePage(page);
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // # Go to Users section
    await systemConsolePage.sidebar.goToItem('Users');
    await systemConsolePage.systemUsers.toBeVisible();

    // # Open the filter menu
    await systemConsolePage.systemUsers.openFilterPopover();
    await systemConsolePage.systemUsersFilterPopover.toBeVisible();

    // # Enter the team name of the first user
    await systemConsolePage.systemUsersFilterPopover.searchInTeamMenu(userAndItsTeam[0].team.display_name);
    await systemConsolePage.systemUsersFilterPopover.teamMenuInput.press('Enter');

    // # Save the filter and close the popover
    await systemConsolePage.systemUsersFilterPopover.save();
    await systemConsolePage.systemUsersFilterPopover.close();
    await systemConsolePage.systemUsers.isLoadingComplete();

    // * Verify that the user corresponding to the first team is visible as its filter was applied
    expect(systemConsolePage.systemUsers.container.getByText(userAndItsTeam[0].user.email)).toBeVisible();

    // * Verify that the user corresponding to the second team is not visible as its filter was not applied
    expect(systemConsolePage.systemUsers.container.getByText(userAndItsTeam[1].user.email)).not.toBeVisible();
});

test('MM-X The role filter should correctly apply the filter', async ({pw, pages}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Log in as admin
    const {page} = await pw.testBrowser.login(adminUser);

    // # Create a guest user
    const guestUser = await adminClient.createUser(createRandomUser(), '', '');
    await adminClient.updateUserRoles(guestUser.id, 'system_guest');

    // # And a regular user
    const regularUser = await adminClient.createUser(createRandomUser(), '', '');

    // # Visit system console
    const systemConsolePage = new pages.SystemConsolePage(page);
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // # Go to Users section
    await systemConsolePage.sidebar.goToItem('Users');
    await systemConsolePage.systemUsers.toBeVisible();

    // # Open the filter menu
    await systemConsolePage.systemUsers.openFilterPopover();
    await systemConsolePage.systemUsersFilterPopover.toBeVisible();

    // # Open the role filter
    await systemConsolePage.systemUsersFilterPopover.openRoleMenu();
    await systemConsolePage.systemUsersRoleMenu.toBeVisible();

    // # Select the Guest role
    await systemConsolePage.systemUsersRoleMenu.clickMenuItem('Guest');
    await systemConsolePage.systemUsersRoleMenu.close();

    // # Save the filter and close the popover
    await systemConsolePage.systemUsersFilterPopover.save();
    await systemConsolePage.systemUsersFilterPopover.close();
    await systemConsolePage.systemUsers.isLoadingComplete();

    // # Search for the guest user with the filter applied
    await systemConsolePage.systemUsers.enterSearchText(guestUser.email);
    await systemConsolePage.systemUsers.container.getByText(guestUser.email).waitFor();

    // * Verify that guest user is visible as a guest filter was applied
    expect(systemConsolePage.systemUsers.container.getByText(guestUser.email)).toBeVisible();

    // # Search for the regular user with the filter applied
    await systemConsolePage.systemUsers.enterSearchText(regularUser.email);

    // * Verify that regular user is not visible as member filter was not applied
    expect(systemConsolePage.systemUsers.container.getByText(regularUser.email)).not.toBeVisible();
});

test('MM-X The status filter should correctly apply the filter', async ({pw, pages}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Log in as admin
    const {page} = await pw.testBrowser.login(adminUser);

    // # Create a user and deactivate it
    const deactivatedUser = await adminClient.createUser(createRandomUser(), '', '');
    adminClient.updateUserActive(deactivatedUser.id, false);

    // # Create a regular user
    const regularUser = await adminClient.createUser(createRandomUser(), '', '');

    // # Visit system console
    const systemConsolePage = new pages.SystemConsolePage(page);
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // # Go to Users section
    await systemConsolePage.sidebar.goToItem('Users');
    await systemConsolePage.systemUsers.toBeVisible();

    // # Open the filter menu
    await systemConsolePage.systemUsers.openFilterPopover();
    await systemConsolePage.systemUsersFilterPopover.toBeVisible();

    // # Open the status filter
    await systemConsolePage.systemUsersFilterPopover.openStatusMenu();
    await systemConsolePage.systemUsersStatusMenu.toBeVisible();
    await systemConsolePage.systemUsers.isLoadingComplete();

    // # Select the Deactivated users status
    await systemConsolePage.systemUsersStatusMenu.clickMenuItem('Deactivated users');
    await systemConsolePage.systemUsersStatusMenu.close();

    // # Save the filter and close the popover
    await systemConsolePage.systemUsersFilterPopover.save();
    await systemConsolePage.systemUsersFilterPopover.close();

    // # Search for the deactivated user with the filter applied
    await systemConsolePage.systemUsers.enterSearchText(deactivatedUser.email);
    await systemConsolePage.systemUsers.container.getByText(deactivatedUser.email).waitFor();

    // * Verify that deactivated user is visible as a deactivated filter was applied
    expect(systemConsolePage.systemUsers.container.getByText(deactivatedUser.email)).toBeVisible();

    // # Search for the regular user with the filter applied
    await systemConsolePage.systemUsers.enterSearchText(regularUser.email);

    // * Verify that regular user is not visible as active filter was not applied
    expect(systemConsolePage.systemUsers.container.getByText(regularUser.email)).not.toBeVisible();
});
