// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

const SORT_TEST_USER_COUNT = 10;

type UsersTableLike = {
    getVisibleEmails: () => Promise<string[]>;
};

function expectEmailsSortedInDirection(
    emails: string[],
    direction: 'ascending' | 'descending' | 'none',
) {
    const sorted = [...emails].sort((a, b) => a.localeCompare(b));
    if (direction === 'descending') {
        sorted.reverse();
    }
    expect(emails).toEqual(sorted);
}

async function expectSortedEmailsFromTable(
    usersTable: UsersTableLike,
    direction: 'ascending' | 'descending' | 'none',
    expectedCount: number,
) {
    await expect(async () => {
        const emails = await usersTable.getVisibleEmails();
        expect(emails.length).toBe(expectedCount);
        expectEmailsSortedInDirection(emails, direction);
    }).toPass({timeout: 30_000});
}

test.describe('System Console - Users table sorting', () => {
    test.describe.configure({mode: 'serial'});

    test('MM-T5523-1 Sortable columns should sort the list when clicked', async ({pw}) => {
        test.setTimeout(150_000);

        const {adminUser, adminClient} = await pw.initSetup();

        if (!adminUser) {
            throw new Error('Failed to create admin user');
        }

        // Unique prefix isolates this test from users created by parallel workers.
        const emailPrefix = `sort-t5523-${pw.random.id()}`;

        // # Log in as admin
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);

        // # Create users that share a searchable prefix
        for (let i = 0; i < SORT_TEST_USER_COUNT; i++) {
            await adminClient.createUser(await pw.random.user(emailPrefix), '', '');
        }

        // # Visit system console
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();

        // # Go to Users section
        await systemConsolePage.sidebar.users.click();
        await systemConsolePage.users.toBeVisible();

        // # Filter the table to only this test's users
        await systemConsolePage.users.searchUsers(emailPrefix);

        const {usersTable} = systemConsolePage.users;

        // * Verify that 'Email' column has aria-sort attribute
        const emailColumnHeader = usersTable.getColumnHeader('Email');
        await expect(emailColumnHeader).toBeVisible();
        await expect(emailColumnHeader).toHaveAttribute('aria-sort');

        // # Click on the 'Email' column header to sort and wait for sort to complete
        const sortDirection = await usersTable.sortByColumn('Email');

        // * Verify that emails are sorted in the expected direction
        await expectSortedEmailsFromTable(usersTable, sortDirection, SORT_TEST_USER_COUNT);

        // # Click on the 'Email' column header again to toggle sort direction
        const reversedDirection = await usersTable.sortByColumn('Email');

        // * Verify that the sort direction has toggled
        expect(reversedDirection).not.toEqual(sortDirection);

        // * Verify that emails are sorted in the toggled direction
        await expectSortedEmailsFromTable(usersTable, reversedDirection, SORT_TEST_USER_COUNT);
    });

    test('MM-T5523-2 Non sortable columns should not sort the list when clicked', async ({pw}) => {
        test.setTimeout(90_000);

        const {adminUser, adminClient} = await pw.initSetup();

        if (!adminUser) {
            throw new Error('Failed to create admin user');
        }

        const emailPrefix = `sort-t5523-ns-${pw.random.id()}`;

        // # Log in as admin
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);

        // # Create users that share a searchable prefix
        for (let i = 0; i < SORT_TEST_USER_COUNT; i++) {
            await adminClient.createUser(await pw.random.user(emailPrefix), '', '');
        }

        // # Visit system console
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();

        // # Go to Users section
        await systemConsolePage.sidebar.users.click();
        await systemConsolePage.users.toBeVisible();

        await systemConsolePage.users.searchUsers(emailPrefix);

        const {usersTable} = systemConsolePage.users;

        // * Verify that 'Last login' column does not have aria-sort attribute
        const lastLoginColumnHeader = usersTable.getColumnHeader('Last login');
        await expect(lastLoginColumnHeader).toBeVisible();
        await expect(lastLoginColumnHeader).not.toHaveAttribute('aria-sort');

        // # Store the first row's email without sorting
        const emailsBefore = await usersTable.getVisibleEmails();
        expect(emailsBefore.length).toBeGreaterThan(0);
        const firstEmailBefore = emailsBefore[0];

        // # Try to click on the 'Last login' column header to sort
        await usersTable.clickSortOnColumn('Last login');

        // # Store the first row's email after clicking non-sortable header
        const emailsAfter = await usersTable.getVisibleEmails();
        expect(emailsAfter.length).toBeGreaterThan(0);

        // * Verify that the first row's email is still the same
        expect(emailsAfter[0]).toEqual(firstEmailBefore);
    });
});
