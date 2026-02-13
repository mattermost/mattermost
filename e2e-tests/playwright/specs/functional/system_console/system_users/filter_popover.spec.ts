// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

test('MM-T5521-7 Should be able to filter users with team filter', async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Log in as admin
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Create a team with a user
    const team1 = await adminClient.createTeam(await pw.random.team());
    const user1 = await adminClient.createUser(await pw.random.user(), '', '');
    await adminClient.addToTeam(team1.id, user1.id);

    // # Create another team with a user
    const team2 = await adminClient.createTeam(await pw.random.team());
    const user2 = await adminClient.createUser(await pw.random.user(), '', '');
    await adminClient.addToTeam(team2.id, user2.id);

    // # Visit system console
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // # Go to Users section
    await systemConsolePage.sidebar.users.click();
    await systemConsolePage.users.toBeVisible();

    // # Open the filter's popover
    const filterPopover = await systemConsolePage.users.openFilterPopover();

    // # Enter the team name of the first user and select it
    await filterPopover.searchInTeamMenu(team1.display_name);
    await filterPopover.teamMenuInput.press('Enter');

    // # Save the filter and close the popover
    await filterPopover.save();
    await filterPopover.close();
    await systemConsolePage.users.isLoadingComplete();

    // * Verify that the user corresponding to the first team is visible as team-1 filter was applied
    await expect(systemConsolePage.users.container.getByText(user1.email)).toBeVisible();

    // * Verify that the user corresponding to the second team is not visible as team-2 filter was not applied
    await expect(systemConsolePage.users.container.getByText(user2.email)).not.toBeVisible();
});

test('MM-T5521-8 Should be able to filter users with role filter', async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Log in as admin
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Create a guest user
    const guestUser = await adminClient.createUser(await pw.random.user(), '', '');
    await adminClient.updateUserRoles(guestUser.id, 'system_guest');

    // # Create a regular user
    const regularUser = await adminClient.createUser(await pw.random.user(), '', '');

    // # Visit system console
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // # Go to Users section
    await systemConsolePage.sidebar.users.click();
    await systemConsolePage.users.toBeVisible();

    // # Open the filter popover
    const filterPopover = await systemConsolePage.users.openFilterPopover();

    // # Open the role filter in the popover and select Guest
    await filterPopover.openRoleMenu();
    // Wait for dropdown options and click on Guest
    const guestOption = systemConsolePage.page.getByText('Guest', {exact: true});
    await guestOption.waitFor();
    await guestOption.click();

    // # Save the filter and close the popover
    await filterPopover.save();
    await filterPopover.close();
    await systemConsolePage.users.isLoadingComplete();

    // # Search for the guest user with the filter already applied
    await systemConsolePage.users.searchUsers(guestUser.email);

    // * Verify that guest user is visible as a 'Guest' role filter was applied
    await expect(systemConsolePage.users.container.getByText(guestUser.email)).toBeVisible();

    // # Search for the regular user with the filter already applied
    await systemConsolePage.users.searchUsers(regularUser.email);

    // * Verify that regular user is not visible as 'Guest' role filter was applied
    await expect(systemConsolePage.users.container.getByText('No data')).toBeVisible();
});

test('MM-T5521-9 Should be able to filter users with status filter', async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Log in as admin
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Create a user and then deactivate it
    const deactivatedUser = await adminClient.createUser(await pw.random.user(), '', '');
    await adminClient.updateUserActive(deactivatedUser.id, false);

    // # Create a regular user
    const regularUser = await adminClient.createUser(await pw.random.user(), '', '');

    // # Visit system console
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // # Go to Users section
    await systemConsolePage.sidebar.users.click();
    await systemConsolePage.users.toBeVisible();

    // # Open the filter popover
    const filterPopover = await systemConsolePage.users.openFilterPopover();

    // # Open the status filter in the popover and select Deactivated users
    await filterPopover.openStatusMenu();
    // Wait for dropdown options and click on Deactivated users
    const deactivatedOption = systemConsolePage.page.getByText('Deactivated users', {exact: true});
    await deactivatedOption.waitFor();
    await deactivatedOption.click();

    // # Save the filter and close the popover
    await filterPopover.save();
    await filterPopover.close();

    // # Search for the deactivated user with the filter already applied
    await systemConsolePage.users.searchUsers(deactivatedUser.email);

    // * Verify that deactivated user is visible as a 'Deactivated' status filter was applied
    await expect(systemConsolePage.users.container.getByText(deactivatedUser.email)).toBeVisible();

    // # Search for the regular user with the filter already applied
    await systemConsolePage.users.searchUsers(regularUser.email);

    // * Verify that regular user is not visible as 'Deactivated' status filter was applied
    await expect(systemConsolePage.users.container.getByText('No data')).toBeVisible();
});
