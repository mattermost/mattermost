// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@e2e-support/test_fixture';
import {createRandomTeam, createRandomUser} from '@e2e-support/server';

test('MM-T5521-7 Should be able to filter users with team filter', async ({pw, pages}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Log in as admin
    const {page} = await pw.testBrowser.login(adminUser);

    // # Create a team with a user
    const team1 = await adminClient.createTeam(createRandomTeam());
    const user1 = await adminClient.createUser(createRandomUser(), '', '');
    await adminClient.addToTeam(team1.id, user1.id);

    // # Create another team with a user
    const team2 = await adminClient.createTeam(createRandomTeam());
    const user2 = await adminClient.createUser(createRandomUser(), '', '');
    await adminClient.addToTeam(team2.id, user2.id);

    // # Visit system console
    const systemConsolePage = new pages.SystemConsolePage(page);
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // # Go to Users section
    await systemConsolePage.sidebar.goToItem('Users');
    await systemConsolePage.systemUsers.toBeVisible();

    // # Open the filter's popover
    await systemConsolePage.systemUsers.openFilterPopover();
    await systemConsolePage.systemUsersFilterPopover.toBeVisible();

    // # Enter the team name of the first user and select it
    await systemConsolePage.systemUsersFilterPopover.searchInTeamMenu(team1.display_name);
    await systemConsolePage.systemUsersFilterPopover.teamMenuInput.press('Enter');

    // # Save the filter and close the popover
    await systemConsolePage.systemUsersFilterPopover.save();
    await systemConsolePage.systemUsersFilterPopover.close();
    await systemConsolePage.systemUsers.isLoadingComplete();

    // * Verify that the user corresponding to the first team is visible as team-1 filter was applied
    await systemConsolePage.systemUsers.verifyRowWithTextIsFound(user1.email);

    // * Verify that the user corresponding to the second team is not visible as team-2 filter was not applied
    await systemConsolePage.systemUsers.verifyRowWithTextIsNotFound(user2.email);
});

test('MM-T5521-8 Should be able to filter users with role filter', async ({pw, pages}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Log in as admin
    const {page} = await pw.testBrowser.login(adminUser);

    // # Create a guest user
    const guestUser = await adminClient.createUser(createRandomUser(), '', '');
    await adminClient.updateUserRoles(guestUser.id, 'system_guest');

    // # Create a regular user
    const regularUser = await adminClient.createUser(createRandomUser(), '', '');

    // # Visit system console
    const systemConsolePage = new pages.SystemConsolePage(page);
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // # Go to Users section
    await systemConsolePage.sidebar.goToItem('Users');
    await systemConsolePage.systemUsers.toBeVisible();

    // # Open the filter popover
    await systemConsolePage.systemUsers.openFilterPopover();
    await systemConsolePage.systemUsersFilterPopover.toBeVisible();

    // # Open the role filter in the popover
    await systemConsolePage.systemUsersFilterPopover.openRoleMenu();
    await systemConsolePage.systemUsersRoleMenu.toBeVisible();

    // # Select the Guest role from the role filter
    await systemConsolePage.systemUsersRoleMenu.clickMenuItem('Guest');
    await systemConsolePage.systemUsersRoleMenu.close();

    // # Save the filter and close the popover
    await systemConsolePage.systemUsersFilterPopover.save();
    await systemConsolePage.systemUsersFilterPopover.close();
    await systemConsolePage.systemUsers.isLoadingComplete();

    // # Search for the guest user with the filter already applied
    await systemConsolePage.systemUsers.enterSearchText(guestUser.email);

    // * Verify that guest user is visible as a 'Guest' role filter was applied
    await systemConsolePage.systemUsers.verifyRowWithTextIsFound(guestUser.email);

    // # Search for the regular user with the filter already applied
    await systemConsolePage.systemUsers.enterSearchText(regularUser.email);

    // * Verify that regular user is not visible as 'Guest' role filter was applied
    await systemConsolePage.systemUsers.verifyRowWithTextIsFound('No data');
});

test('MM-T5521-9 Should be able to filter users with status filter', async ({pw, pages}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Log in as admin
    const {page} = await pw.testBrowser.login(adminUser);

    // # Create a user and then deactivate it
    const deactivatedUser = await adminClient.createUser(createRandomUser(), '', '');
    await adminClient.updateUserActive(deactivatedUser.id, false);

    // # Create a regular user
    const regularUser = await adminClient.createUser(createRandomUser(), '', '');

    // # Visit system console
    const systemConsolePage = new pages.SystemConsolePage(page);
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // # Go to Users section
    await systemConsolePage.sidebar.goToItem('Users');
    await systemConsolePage.systemUsers.toBeVisible();

    // # Open the filter popover
    await systemConsolePage.systemUsers.openFilterPopover();
    await systemConsolePage.systemUsersFilterPopover.toBeVisible();

    // # Open the status filter in the popover
    await systemConsolePage.systemUsersFilterPopover.openStatusMenu();
    await systemConsolePage.systemUsersStatusMenu.toBeVisible();
    await systemConsolePage.systemUsers.isLoadingComplete();

    // # Select the Deactivated users from the status filter
    await systemConsolePage.systemUsersStatusMenu.clickMenuItem('Deactivated users');
    await systemConsolePage.systemUsersStatusMenu.close();

    // # Save the filter and close the popover
    await systemConsolePage.systemUsersFilterPopover.save();
    await systemConsolePage.systemUsersFilterPopover.close();

    // # Search for the deactivated user with the filter already applied
    await systemConsolePage.systemUsers.enterSearchText(deactivatedUser.email);

    // * Verify that deactivated user is visible as a 'Deactivated' status filter was applied
    await systemConsolePage.systemUsers.verifyRowWithTextIsFound(deactivatedUser.email);

    // # Search for the regular user with the filter already applied
    await systemConsolePage.systemUsers.enterSearchText(regularUser.email);

    // * Verify that regular user is not visible as 'Deactivated' status filter was applied
    await systemConsolePage.systemUsers.verifyRowWithTextIsFound('No data');
});
