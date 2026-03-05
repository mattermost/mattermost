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
    expect(menuItemsTexts).toHaveLength(9);
    expect(menuItemsTexts).toEqual([
        'User details',
        'Email',
        'Member since',
        'Last login',
        'Last activity',
        'Last post',
        'Days active',
        'Messages posted',
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
