// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@playwright/test';

import {test} from '@e2e-support/test_fixture';

test('MM-T5523-3 Should list the column names with checkboxes in the correct order', async ({pw, pages}) => {
    const {adminUser} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Log in as admin
    const {page} = await pw.testBrowser.login(adminUser);

    // # Visit system console
    const systemConsolePage = new pages.SystemConsolePage(page);
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // # Go to Users section
    await systemConsolePage.sidebar.goToItem('Users');
    await systemConsolePage.systemUsers.toBeVisible();

    // # Open the column toggle menu
    await systemConsolePage.systemUsers.openColumnToggleMenu();
    await systemConsolePage.systemUsersColumnToggleMenu.toBeVisible();

    // # Get all the menu items
    const menuItems = await systemConsolePage.systemUsersColumnToggleMenu.getAllMenuItems();
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

test('MM-T5523-4 Should allow certain columns to be checked and others to be disabled', async ({pw, pages}) => {
    const {adminUser} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Log in as admin
    const {page} = await pw.testBrowser.login(adminUser);

    // # Visit system console
    const systemConsolePage = new pages.SystemConsolePage(page);
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // # Go to Users section
    await systemConsolePage.sidebar.goToItem('Users');
    await systemConsolePage.systemUsers.toBeVisible();

    // # Open the column toggle menu
    await systemConsolePage.systemUsers.openColumnToggleMenu();
    await systemConsolePage.systemUsersColumnToggleMenu.toBeVisible();

    // * Verify that 'Display Name' is disabled
    const displayNameMenuItem = await systemConsolePage.systemUsersColumnToggleMenu.getMenuItem('User details');
    expect(displayNameMenuItem).toBeDisabled();

    // * Verify that 'Actions' is disabled
    const actionsMenuItem = await systemConsolePage.systemUsersColumnToggleMenu.getMenuItem('Actions');
    expect(actionsMenuItem).toBeDisabled();

    // * Verify that 'Email' however is enabled
    const emailMenuItem = await systemConsolePage.systemUsersColumnToggleMenu.getMenuItem('Email');
    expect(emailMenuItem).not.toBeDisabled();
});

test('MM-T5523-5 Should show/hide the columns which are toggled on/off', async ({pw, pages}) => {
    const {adminUser} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Log in as admin
    const {page} = await pw.testBrowser.login(adminUser);

    // # Visit system console
    const systemConsolePage = new pages.SystemConsolePage(page);
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // # Go to Users section
    await systemConsolePage.sidebar.goToItem('Users');
    await systemConsolePage.systemUsers.toBeVisible();

    // # Open the column toggle menu
    await systemConsolePage.systemUsers.openColumnToggleMenu();
    await systemConsolePage.systemUsersColumnToggleMenu.toBeVisible();

    // # Uncheck the Email and Last login columns to hide them
    await systemConsolePage.systemUsersColumnToggleMenu.clickMenuItem('Email');
    await systemConsolePage.systemUsersColumnToggleMenu.clickMenuItem('Last login');

    // * Close the column toggle menu
    await systemConsolePage.systemUsersColumnToggleMenu.close();

    // * Verify that Email column and Last login column are hidden
    expect(await systemConsolePage.systemUsers.doesColumnExist('Email')).toBe(false);
    expect(await systemConsolePage.systemUsers.doesColumnExist('Last login')).toBe(false);

    // # Now open the column toggle menu again
    await systemConsolePage.systemUsers.openColumnToggleMenu();

    // # Check the Email column to show it
    await systemConsolePage.systemUsersColumnToggleMenu.clickMenuItem('Email');

    // * Close the column toggle menu
    await systemConsolePage.systemUsersColumnToggleMenu.close();

    // * Verify that Email column is now shown
    expect(await systemConsolePage.systemUsers.doesColumnExist('Email')).toBe(true);

    // * Verify that however Last login column is still hidden as we did not check it on
    expect(await systemConsolePage.systemUsers.doesColumnExist('Last login')).toBe(false);
});
