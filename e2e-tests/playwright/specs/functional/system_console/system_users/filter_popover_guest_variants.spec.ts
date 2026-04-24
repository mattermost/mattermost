// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

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
