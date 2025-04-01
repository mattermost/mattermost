// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

test('MM-T5523-1 Sortable columns should sort the list when clicked', async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Log in as admin
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Create 10 random users
    for (let i = 0; i < 10; i++) {
        await adminClient.createUser(pw.random.user(), '', '');
    }

    // # Visit system console
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // # Go to Users section
    await systemConsolePage.sidebar.goToItem('Users');
    await systemConsolePage.systemUsers.toBeVisible();

    // * Verify that 'Email' column has aria-sort attribute
    const userDetailsColumnHeader = await systemConsolePage.systemUsers.getColumnHeader('Email');
    expect(await userDetailsColumnHeader.isVisible()).toBe(true);
    expect(userDetailsColumnHeader).toHaveAttribute('aria-sort');

    // # Store the first row's email before sorting
    const firstRowWithoutSort = await systemConsolePage.systemUsers.getNthRow(1);
    const firstRowEmailWithoutSort = await firstRowWithoutSort.getByText(pw.simpleEmailRe).allInnerTexts();

    // # Click on the 'Email' column header to sort
    await systemConsolePage.systemUsers.clickSortOnColumn('Email');
    await systemConsolePage.systemUsers.isLoadingComplete();

    // # Store the first row's email after sorting
    const firstRowWithSort = await systemConsolePage.systemUsers.getNthRow(1);
    const firstRowEmailWithSort = await firstRowWithSort.getByText(pw.simpleEmailRe).allInnerTexts();

    // * Verify that the first row is now different
    expect(firstRowEmailWithoutSort).not.toBe(firstRowEmailWithSort);
});

test('MM-T5523-2 Non sortable columns should not sort the list when clicked', async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Log in as admin
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Create 10 random users
    for (let i = 0; i < 10; i++) {
        await adminClient.createUser(pw.random.user(), '', '');
    }

    // # Visit system console
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // # Go to Users section
    await systemConsolePage.sidebar.goToItem('Users');
    await systemConsolePage.systemUsers.toBeVisible();

    // * Verify that 'Last login' column does not have aria-sort attribute
    const userDetailsColumnHeader = await systemConsolePage.systemUsers.getColumnHeader('Last login');
    expect(await userDetailsColumnHeader.isVisible()).toBe(true);
    expect(userDetailsColumnHeader).not.toHaveAttribute('aria-sort');

    // # Store the first row's email without sorting
    const firstRowWithoutSort = await systemConsolePage.systemUsers.getNthRow(1);
    const firstRowEmailWithoutSort = await firstRowWithoutSort.getByText(pw.simpleEmailRe).allInnerTexts();

    // # Try to click on the 'Last login' column header to sort
    await systemConsolePage.systemUsers.clickSortOnColumn('Last login');

    // # Store the first row's email after sorting
    const firstRowWithSort = await systemConsolePage.systemUsers.getNthRow(1);
    const firstRowEmailWithSort = await firstRowWithSort.getByText(pw.simpleEmailRe).allInnerTexts();

    // * Verify that the first row's email is still the same
    expect(firstRowEmailWithoutSort).toEqual(firstRowEmailWithSort);
});
