// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {type App, expect, openSystemUsers, searchSystemUsers, test, Msg} from '@mattermost/playwright-lib';

/** Opens the filters popover. */
async function openFilters(app: App) {
    await app.admin.users.filters.container.click();
    await expect(app.admin.users.filtersPopover.applyButton).toBeVisible();
    return app.admin.users.filters;
}

/** Picks a value in one of the filters' dropdowns (opened by clicking it). */
async function pick(
    dropdown: App['admin']['users']['filters']['role'] | App['admin']['users']['filters']['status'],
    label: string,
) {
    await dropdown.controlButton.clickTo(dropdown.menu.option(0));
    await (await dropdown.menu.optionList.itemWith({text: label})).select();
    await expect(dropdown.controlButton).toHaveText(label);
}

/** Applies the filters, which closes the popover. */
async function apply(app: App) {
    await app.admin.users.filtersPopover.applyButton.click();
    await expect(app.admin.users.filtersPopover.applyButton).not.toBeVisible();
}

test('MM-T5521-7 Should be able to filter users with team filter', async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    // # Create a team with a user
    const team1 = await adminClient.createTeam(await pw.random.team());
    const user1 = await adminClient.createUser(await pw.random.user(), '', '');
    await adminClient.addToTeam(team1.id, user1.id);

    // # Create another team with a user
    const team2 = await adminClient.createTeam(await pw.random.team());
    const user2 = await adminClient.createUser(await pw.random.user(), '', '');
    await adminClient.addToTeam(team2.id, user2.id);

    // # Open System Console > Users
    const app = await openSystemUsers(pw, adminUser);

    // # Open the filter's popover
    const filters = await openFilters(app);

    // # Enter the team name of the first user and select it
    await filters.team.inputCombobox.fill(team1.display_name);
    await filters.team.option(team1.id).select();
    await expect(filters.team).toContainText(team1.display_name);

    // # Save the filter and close the popover
    await apply(app);

    // * Verify that the user corresponding to the first team is visible as team-1 filter was applied
    await expect(app.admin.users.table.row(user1.id).cell('emailColumn')).toHaveText(user1.email);
    await expect(app.admin.users.table.row(user1.id).cell('emailColumn')).toBeVisible();

    // * Verify that the user corresponding to the second team is not visible as team-2 filter was not applied
    await expect(app.admin.users.table.row(user2.id)).toHaveCount(0);
});

test('MM-T5521-8 Should be able to filter users with role filter', async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    // # Create a guest user
    const guestUser = await adminClient.createUser(await pw.random.user(), '', '');
    await adminClient.updateUserRoles(guestUser.id, 'system_guest');

    // # Create a regular user
    const regularUser = await adminClient.createUser(await pw.random.user(), '', '');

    // # Open System Console > Users
    const app = await openSystemUsers(pw, adminUser);

    // # Open the filter popover
    const filters = await openFilters(app);

    // # Open the role filter in the popover and select Guest
    await pick(filters.role, 'Guests (all)');

    // # Save the filter and close the popover
    await apply(app);

    // # Search for the guest user with the filter already applied
    await searchSystemUsers(app, guestUser.email, guestUser);

    // * Verify that guest user is visible as a 'Guest' role filter was applied
    await expect(app.admin.users.table.row(guestUser.id).cell('emailColumn')).toHaveText(guestUser.email);
    await expect(app.admin.users.table.row(guestUser.id).cell('emailColumn')).toBeVisible();

    // # Search for the regular user with the filter already applied
    await app.admin.users.search.container.fill(regularUser.email);

    // * Verify that regular user is not visible as 'Guest' role filter was applied
    await expect(app.admin.users.table.noDataText).toHaveMessage(Msg.adminConsole.list.table.genericNoData);
    await expect(app.admin.users.table.noDataText).toBeVisible();

    await expect(app.admin.users.table.row(regularUser.id)).toHaveCount(0);
});

test('MM-T5521-9 Should be able to filter users with status filter', async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    // # Create a user and then deactivate it
    const deactivatedUser = await adminClient.createUser(await pw.random.user(), '', '');
    await adminClient.updateUserActive(deactivatedUser.id, false);

    // # Create a regular user
    const regularUser = await adminClient.createUser(await pw.random.user(), '', '');

    // # Open System Console > Users
    const app = await openSystemUsers(pw, adminUser);

    // # Open the filter popover
    const filters = await openFilters(app);

    // # Open the status filter in the popover and select Deactivated users
    await pick(filters.status, 'Deactivated users');

    // # Save the filter and close the popover
    await apply(app);

    // # Search for the deactivated user with the filter already applied
    await searchSystemUsers(app, deactivatedUser.email, deactivatedUser);

    // * Verify that deactivated user is visible as a 'Deactivated' status filter was applied
    await expect(app.admin.users.table.row(deactivatedUser.id).cell('emailColumn')).toHaveText(deactivatedUser.email);
    await expect(app.admin.users.table.row(deactivatedUser.id).cell('emailColumn')).toBeVisible();

    // # Search for the regular user with the filter already applied
    await app.admin.users.search.container.fill(regularUser.email);

    // * Verify that regular user is not visible as 'Deactivated' status filter was applied
    await expect(app.admin.users.table.noDataText).toHaveMessage(Msg.adminConsole.list.table.genericNoData);
    await expect(app.admin.users.table.noDataText).toBeVisible();

    await expect(app.admin.users.table.row(regularUser.id)).toHaveCount(0);
});

/**
 * @objective Verify that the role filter dropdown shows all guest filter variants
 */
test('displays all guest filter variants in the role filter dropdown', {tag: '@system_users'}, async ({pw}) => {
    const {adminUser} = await pw.initSetup();

    // # Open System Console > Users
    const app = await openSystemUsers(pw, adminUser);

    // # Open the filter popover
    const filters = await openFilters(app);

    // # Open the role filter menu
    await filters.role.controlButton.clickTo(filters.role.menu.option(0));

    // * Verify all 6 role filter options are present
    const roleOptions = filters.role.menu.optionList.locator;
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

        // # Open System Console > Users

        const app = await openSystemUsers(pw, adminUser);

        // # Open the filter popover and filter by single-channel guests
        const filters = await openFilters(app);
        await pick(filters.role, 'Guests in a single channel');
        await apply(app);

        // # Search for the guest user
        await searchSystemUsers(app, guestUser.email, guestUser);

        // * Verify the single-channel guest is visible
        await expect(app.admin.users.table.row(guestUser.id).cell('emailColumn')).toHaveText(guestUser.email);
        await expect(app.admin.users.table.row(guestUser.id).cell('emailColumn')).toBeVisible();
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

        // # Open System Console > Users

        const app = await openSystemUsers(pw, adminUser);

        // # Open the filter popover and filter by multi-channel guests
        const filters = await openFilters(app);
        await pick(filters.role, 'Guests in multiple channels');
        await apply(app);

        // # Search for the multi-channel guest
        await searchSystemUsers(app, multiChannelGuest.email, multiChannelGuest);

        // * Verify the multi-channel guest is visible
        await expect(app.admin.users.table.row(multiChannelGuest.id).cell('emailColumn')).toHaveText(
            multiChannelGuest.email,
        );
        await expect(app.admin.users.table.row(multiChannelGuest.id).cell('emailColumn')).toBeVisible();

        // # Search for the single-channel guest
        await app.admin.users.search.container.fill(singleChannelGuest.email);

        // * Verify the single-channel guest is NOT visible
        await expect(app.admin.users.table.noDataText).toHaveMessage(Msg.adminConsole.list.table.genericNoData);
        await expect(app.admin.users.table.noDataText).toBeVisible();

        await expect(app.admin.users.table.row(singleChannelGuest.id)).toHaveCount(0);
    },
);
