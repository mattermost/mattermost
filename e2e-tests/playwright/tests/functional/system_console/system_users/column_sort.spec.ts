// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@playwright/test';

import {test} from '@e2e-support/test_fixture';
import {createRandomUser} from '@e2e-support/server';
import {simpleEmailRe} from '@e2e-support/util';

test('MM-T5523-1 Sortable columns should sort the list when clicked', async ({pw, pages}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Log in as admin
    const {page} = await pw.testBrowser.login(adminUser);

    // # Create 10 random users
    for (let i = 0; i < 10; i++) {
        await adminClient.createUser(createRandomUser(), '', '');
    }

    // # Visit system console
    const systemConsolePage = new pages.SystemConsolePage(page);
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
    const firstRowEmailWithoutSort = await firstRowWithoutSort.getByText(simpleEmailRe).allInnerTexts();

    // # Click on the 'Email' column header to sort
    await systemConsolePage.systemUsers.clickSortOnColumn('Email');
    await systemConsolePage.systemUsers.isLoadingComplete();

    // # Store the first row's email after sorting
    const firstRowWithSort = await systemConsolePage.systemUsers.getNthRow(1);
    const firstRowEmailWithSort = await firstRowWithSort.getByText(simpleEmailRe).allInnerTexts();

    // * Verify that the first row is now different
    expect(firstRowEmailWithoutSort).not.toBe(firstRowEmailWithSort);
});

test('MM-T5523-2 Non sortable columns should not sort the list when clicked', async ({pw, pages}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Log in as admin
    const {page} = await pw.testBrowser.login(adminUser);

    // # Create 10 random users
    for (let i = 0; i < 10; i++) {
        await adminClient.createUser(createRandomUser(), '', '');
    }

    // # Visit system console
    const systemConsolePage = new pages.SystemConsolePage(page);
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
    const firstRowEmailWithoutSort = await firstRowWithoutSort.getByText(simpleEmailRe).allInnerTexts();

    // # Try to click on the 'Last login' column header to sort
    await systemConsolePage.systemUsers.clickSortOnColumn('Last login');

    // # Store the first row's email after sorting
    const firstRowWithSort = await systemConsolePage.systemUsers.getNthRow(1);
    const firstRowEmailWithSort = await firstRowWithSort.getByText(simpleEmailRe).allInnerTexts();

    // * Verify that the first row's email is still the same
    expect(firstRowEmailWithoutSort).toEqual(firstRowEmailWithSort);
});
