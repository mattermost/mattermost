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
    await filterPopover.filterByTeam(team1.display_name);

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
    await filterPopover.filterByRole('Guests (all)');

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
    await filterPopover.filterByStatus('Deactivated users');

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

/**
 * @objective Verify that the role filter dropdown shows all guest filter variants
 */
test('displays all guest filter variants in the role filter dropdown', {tag: '@system_users'}, async ({pw}) => {
    const {adminUser} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Log in as admin
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Visit system console
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // # Go to Users section
    await systemConsolePage.sidebar.users.click();
    await systemConsolePage.users.toBeVisible();

    // # Open the filter popover
    const filterPopover = await systemConsolePage.users.openFilterPopover();

    // # Open the role filter menu
    await filterPopover.openRoleMenu();

    // * Verify all 6 role filter options are present
    const roleOptions = filterPopover.container.getByRole('option');
    const roleTexts = await roleOptions.allInnerTexts();

    expect(roleTexts).toEqual([
        'Any',
        'System Admin',
        'Member',
        'Guests (all)',
        'Guests in a single channel',
        'Guests in multiple channels',
    ]);
});

/**
 * @objective Verify that filtering by single-channel guest filter returns only guests with exactly one channel membership
 *
 * @precondition
 * A guest user exists with exactly one channel membership
 */
test(
    'filters users by single-channel guest filter and shows only single-channel guests',
    {tag: '@system_users'},
    async ({pw}) => {
        const {adminUser, adminClient, team} = await pw.initSetup();

        if (!adminUser) {
            throw new Error('Failed to create admin user');
        }

        // # Create a channel
        const channelName = `guest-ch-${pw.random.id()}`;
        const channel = await adminClient.createChannel({
            team_id: team.id,
            name: channelName.toLowerCase().replace(/[^a-z0-9-]/g, ''),
            display_name: channelName,
            type: 'O',
        });

        // # Create a guest user and add to exactly one channel
        const guestUser = await adminClient.createUser(await pw.random.user(), '', '');
        await adminClient.updateUserRoles(guestUser.id, 'system_guest');
        await adminClient.addToTeam(team.id, guestUser.id);
        await adminClient.addToChannel(guestUser.id, channel.id);

        // # Log in as admin
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);

        // # Visit system console
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();

        // # Go to Users section
        await systemConsolePage.sidebar.users.click();
        await systemConsolePage.users.toBeVisible();

        // # Open the filter popover and filter by single-channel guests
        const filterPopover = await systemConsolePage.users.openFilterPopover();
        await filterPopover.filterByRole('Guests in a single channel');
        await filterPopover.save();
        await systemConsolePage.users.isLoadingComplete();

        // # Search for the guest user
        await systemConsolePage.users.searchUsers(guestUser.email);

        // * Verify the single-channel guest is visible
        await expect(systemConsolePage.users.container.getByText(guestUser.email)).toBeVisible();
    },
);

/**
 * @objective Verify that filtering by multi-channel guest filter returns only guests with more than one channel membership
 *
 * @precondition
 * A guest user exists with two channel memberships and another with one
 */
test(
    'filters users by multi-channel guest filter and excludes single-channel guests',
    {tag: '@system_users'},
    async ({pw}) => {
        const {adminUser, adminClient, team} = await pw.initSetup();

        if (!adminUser) {
            throw new Error('Failed to create admin user');
        }

        // # Create two channels
        const ch1Name = `guest-multi-1-${pw.random.id()}`;
        const channel1 = await adminClient.createChannel({
            team_id: team.id,
            name: ch1Name.toLowerCase().replace(/[^a-z0-9-]/g, ''),
            display_name: ch1Name,
            type: 'O',
        });

        const ch2Name = `guest-multi-2-${pw.random.id()}`;
        const channel2 = await adminClient.createChannel({
            team_id: team.id,
            name: ch2Name.toLowerCase().replace(/[^a-z0-9-]/g, ''),
            display_name: ch2Name,
            type: 'O',
        });

        // # Create a guest user with 2 channel memberships
        const multiChannelGuest = await adminClient.createUser(await pw.random.user(), '', '');
        await adminClient.updateUserRoles(multiChannelGuest.id, 'system_guest');
        await adminClient.addToTeam(team.id, multiChannelGuest.id);
        await adminClient.addToChannel(multiChannelGuest.id, channel1.id);
        await adminClient.addToChannel(multiChannelGuest.id, channel2.id);

        // # Create a guest user with only 1 channel membership
        const singleChannelGuest = await adminClient.createUser(await pw.random.user(), '', '');
        await adminClient.updateUserRoles(singleChannelGuest.id, 'system_guest');
        await adminClient.addToTeam(team.id, singleChannelGuest.id);
        await adminClient.addToChannel(singleChannelGuest.id, channel1.id);

        // # Log in as admin
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);

        // # Visit system console
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();

        // # Go to Users section
        await systemConsolePage.sidebar.users.click();
        await systemConsolePage.users.toBeVisible();

        // # Open the filter popover and filter by multi-channel guests
        const filterPopover = await systemConsolePage.users.openFilterPopover();
        await filterPopover.filterByRole('Guests in multiple channels');
        await filterPopover.save();
        await systemConsolePage.users.isLoadingComplete();

        // # Search for the multi-channel guest
        await systemConsolePage.users.searchUsers(multiChannelGuest.email);

        // * Verify the multi-channel guest is visible
        await expect(systemConsolePage.users.container.getByText(multiChannelGuest.email)).toBeVisible();

        // # Search for the single-channel guest
        await systemConsolePage.users.searchUsers(singleChannelGuest.email);

        // * Verify the single-channel guest is NOT visible
        await expect(systemConsolePage.users.container.getByText('No data')).toBeVisible();
    },
);
