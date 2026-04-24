// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that the Channel count column displays a numeric value for a user with known channel memberships
 *
 * @precondition
 * A guest user exists with exactly two channel memberships
 */
test(
    'displays numeric channel count value when Channel count column is enabled',
    {tag: '@system_users'},
    async ({pw}) => {
        const {adminUser, adminClient, team} = await pw.initSetup();

        if (!adminUser) {
            throw new Error('Failed to create admin user');
        }

        // # Create two channels
        const ch1Name = `count-ch1-${pw.random.id()}`;
        const channel1 = await adminClient.createChannel({
            team_id: team.id,
            name: ch1Name.toLowerCase().replace(/[^a-z0-9-]/g, ''),
            display_name: ch1Name,
            type: 'O',
        });

        const ch2Name = `count-ch2-${pw.random.id()}`;
        const channel2 = await adminClient.createChannel({
            team_id: team.id,
            name: ch2Name.toLowerCase().replace(/[^a-z0-9-]/g, ''),
            display_name: ch2Name,
            type: 'O',
        });

        // # Create a guest user and add to exactly two channels
        const guestUser = await adminClient.createUser(await pw.random.user(), '', '');
        await adminClient.updateUserRoles(guestUser.id, 'system_guest');
        await adminClient.addToTeam(team.id, guestUser.id);
        await adminClient.addToChannel(guestUser.id, channel1.id);
        await adminClient.addToChannel(guestUser.id, channel2.id);

        // # Log in as admin
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);

        // # Visit system console
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();

        // # Go to Users section
        await systemConsolePage.sidebar.users.click();
        await systemConsolePage.users.toBeVisible();

        // # Enable Channel count column
        const columnToggleMenu = await systemConsolePage.users.openColumnToggleMenu();
        await columnToggleMenu.clickMenuItem('Channel count');
        await columnToggleMenu.close();

        // * Verify Channel count column header is visible
        await expect(
            systemConsolePage.users.container.getByRole('columnheader', {name: 'Channel count'}),
        ).toBeVisible();

        // # Search for the guest user
        await systemConsolePage.users.searchUsers(guestUser.email);
        await systemConsolePage.users.isLoadingComplete();

        // * Verify the Channel count cell displays the expected numeric value
        const firstRow = systemConsolePage.users.container.locator('tbody tr').first();
        const channelCountCell = firstRow.locator('.channelCountColumn');
        await expect(channelCountCell).toHaveText('2');
    },
);

/**
 * @objective Verify that the Channel count column can be toggled on and off
 */
test('toggles Channel count column visibility on and off', {tag: '@system_users'}, async ({pw}) => {
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

    // # Open the column toggle menu and enable Channel count
    let columnToggleMenu = await systemConsolePage.users.openColumnToggleMenu();
    await columnToggleMenu.clickMenuItem('Channel count');
    await columnToggleMenu.close();

    // * Verify Channel count column header is visible
    await expect(systemConsolePage.users.container.getByRole('columnheader', {name: 'Channel count'})).toBeVisible();

    // # Open column toggle menu again and disable Channel count
    columnToggleMenu = await systemConsolePage.users.openColumnToggleMenu();
    await columnToggleMenu.clickMenuItem('Channel count');
    await columnToggleMenu.close();

    // * Verify Channel count column header is hidden
    await expect(
        systemConsolePage.users.container.getByRole('columnheader', {name: 'Channel count'}),
    ).not.toBeVisible();
});
