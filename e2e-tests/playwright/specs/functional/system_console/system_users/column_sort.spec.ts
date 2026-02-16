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
        await adminClient.createUser(await pw.random.user(), '', '');
    }

    // # Visit system console
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // # Go to Users section
    await systemConsolePage.sidebar.users.click();
    await systemConsolePage.users.toBeVisible();

    // * Verify that 'Email' column has aria-sort attribute
    const emailColumnHeader = systemConsolePage.users.usersTable.getColumnHeader('Email');
    await expect(emailColumnHeader).toBeVisible();
    await expect(emailColumnHeader).toHaveAttribute('aria-sort');

    // # Store all emails before sorting to compare order
    const rowsBeforeSort = await systemConsolePage.users.usersTable.bodyRows.count();
    const emailsBeforeSort: string[] = [];
    for (let i = 0; i < rowsBeforeSort; i++) {
        const row = systemConsolePage.users.usersTable.getRowByIndex(i);
        const email = await row.getEmail();
        emailsBeforeSort.push(email);
    }

    // # Click on the 'Email' column header to sort and wait for sort to complete
    await systemConsolePage.users.usersTable.sortByColumn('Email');

    // # Store all emails after sorting
    const emailsAfterSort: string[] = [];
    for (let i = 0; i < rowsBeforeSort; i++) {
        const row = systemConsolePage.users.usersTable.getRowByIndex(i);
        const email = await row.getEmail();
        emailsAfterSort.push(email);
    }

    // * Verify that the order has changed (emails array is different)
    expect(emailsBeforeSort).not.toEqual(emailsAfterSort);
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
        await adminClient.createUser(await pw.random.user(), '', '');
    }

    // # Visit system console
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // # Go to Users section
    await systemConsolePage.sidebar.users.click();
    await systemConsolePage.users.toBeVisible();

    // * Verify that 'Last login' column does not have aria-sort attribute
    const lastLoginColumnHeader = systemConsolePage.users.usersTable.getColumnHeader('Last login');
    await expect(lastLoginColumnHeader).toBeVisible();
    await expect(lastLoginColumnHeader).not.toHaveAttribute('aria-sort');

    // # Store the first row's email without sorting
    const firstRowWithoutSort = systemConsolePage.users.usersTable.getRowByIndex(0);
    const firstRowEmailWithoutSort = await firstRowWithoutSort.container.getByText(pw.simpleEmailRe).allInnerTexts();

    // # Try to click on the 'Last login' column header to sort
    await systemConsolePage.users.usersTable.clickSortOnColumn('Last login');

    // # Store the first row's email after sorting
    const firstRowWithSort = systemConsolePage.users.usersTable.getRowByIndex(0);
    const firstRowEmailWithSort = await firstRowWithSort.container.getByText(pw.simpleEmailRe).allInnerTexts();

    // * Verify that the first row's email is still the same
    expect(firstRowEmailWithoutSort).toEqual(firstRowEmailWithSort);
});
