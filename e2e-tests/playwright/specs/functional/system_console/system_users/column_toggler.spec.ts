// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

test('MM-T5523-3 Should list the column names with checkboxes in the correct order', async ({pw}) => {
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

    // # Open the column toggle menu
    const columnToggleMenu = await systemConsolePage.users.openColumnToggleMenu();

    // # Get all the menu items
    const menuItems = columnToggleMenu.getAllMenuItems();
    const menuItemsTexts = await menuItems.allInnerTexts();

    // * Verify menu items exists in the correct order
    expect(menuItemsTexts).toHaveLength(10);
    expect(menuItemsTexts).toEqual([
        'User details',
        'Email',
        'Member since',
        'Last login',
        'Last activity',
        'Last post',
        'Days active',
        'Messages posted',
        'Channel count',
        'Actions',
    ]);
});

test('MM-T5523-4 Should allow certain columns to be checked and others to be disabled', async ({pw}) => {
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

    // # Open the column toggle menu
    const columnToggleMenu = await systemConsolePage.users.openColumnToggleMenu();

    // * Verify that 'Display Name' is disabled
    const displayNameMenuItem = await columnToggleMenu.getMenuItem('User details');
    expect(displayNameMenuItem).toBeDisabled();

    // * Verify that 'Actions' is disabled
    const actionsMenuItem = await columnToggleMenu.getMenuItem('Actions');
    expect(actionsMenuItem).toBeDisabled();

    // * Verify that 'Email' however is enabled
    const emailMenuItem = await columnToggleMenu.getMenuItem('Email');
    expect(emailMenuItem).not.toBeDisabled();
});

test('MM-T5523-5 Should show/hide the columns which are toggled on/off', async ({pw}) => {
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

    // # Open the column toggle menu
    let columnToggleMenu = await systemConsolePage.users.openColumnToggleMenu();

    // # Uncheck the Email and Last login columns to hide them
    await columnToggleMenu.clickMenuItem('Email');
    await columnToggleMenu.clickMenuItem('Last login');

    // * Close the column toggle menu
    await columnToggleMenu.close();

    // * Verify that Email column and Last login column are hidden
    await expect(systemConsolePage.users.container.getByRole('columnheader', {name: 'Email'})).not.toBeVisible();
    await expect(systemConsolePage.users.container.getByRole('columnheader', {name: 'Last login'})).not.toBeVisible();

    // # Now open the column toggle menu again
    columnToggleMenu = await systemConsolePage.users.openColumnToggleMenu();

    // # Check the Email column to show it
    await columnToggleMenu.clickMenuItem('Email');

    // * Close the column toggle menu
    await columnToggleMenu.close();

    // * Verify that Email column is now shown
    await expect(systemConsolePage.users.container.getByRole('columnheader', {name: 'Email'})).toBeVisible();

    // * Verify that however Last login column is still hidden as we did not check it on
    await expect(systemConsolePage.users.container.getByRole('columnheader', {name: 'Last login'})).not.toBeVisible();
});

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
