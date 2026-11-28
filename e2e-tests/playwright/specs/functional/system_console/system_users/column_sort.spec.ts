// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Api, type App, expect, openSystemUsers, test, waitForApi} from '@mattermost/playwright-lib';

/** The emails the table shows, in row order (up to 40 rows). */
async function visibleEmails(app: App) {
    const {table} = app.admin.users;
    const keys = (await table.rowList.keys()).slice(0, 40);
    // Generic table cells are containers; their driver has no text-reading verb.
    const emails = await Promise.all(keys.map((key) => table.row(key).cell('emailColumn').locator.textContent()));
    return emails.map((email) => (email ?? '').trim()).filter(Boolean);
}

/** Clicks a sortable column's header and returns the direction it settles on, once the sorted list has loaded. */
async function sortBy(app: App, column: string): Promise<'ascending' | 'descending'> {
    // ListTable declares each header as a container, without a clickable driver or aria-sort reader.
    const header = app.admin.users.table.head.column(column).locator;
    await expect(header).toBeEnabled();
    const previous = await header.getAttribute('aria-sort');
    const expected = previous === 'ascending' ? 'descending' : 'ascending';

    // The header is a role-free container, so pair its native click with the catalogued response.
    await Promise.all([waitForApi(app.page, Api.GetUsersForReporting), header.click()]);

    // aria-sort updates with Redux; the header is disabled while the fetch runs
    await expect(header).toHaveAttribute('aria-sort', expected);
    await expect(header).toBeEnabled();
    return expected;
}

/** Checks the visible emails are sorted in the direction. */
async function expectSortedEmails(app: App, direction: 'ascending' | 'descending') {
    const isSorted = (emails: string[]) => {
        const sorted = [...emails].sort((a, b) => a.localeCompare(b, undefined, {ignorePunctuation: true}));
        if (direction === 'descending') {
            sorted.reverse();
        }
        return emails.length > 3 && emails.every((email, i) => email === sorted[i]);
    };
    await expect
        .poll(async () => isSorted(await visibleEmails(app)), {
            message: `the users table lists emails ${direction}`,
            timeout: 120_000,
        })
        .toBe(true);
}

test.describe('System Console - Users table sorting', () => {
    test.describe.configure({mode: 'serial'});

    test('MM-T5523-1 Sortable columns should sort the list when clicked', async ({pw}) => {
        const {adminUser, adminClient} = await pw.initSetup();

        // # Create 10 random users
        for (let i = 0; i < 10; i++) {
            await adminClient.createUser(await pw.random.user(), '', '');
        }

        // # Log in as admin and open System Console > Users
        const app = await openSystemUsers(pw, adminUser);

        // * Verify that 'Email' column is sortable
        const emailHeader = app.admin.users.table.head.column('emailColumn').locator;
        await expect(emailHeader).toBeVisible();
        await expect(emailHeader).toHaveAttribute('aria-sort');

        // # Sort by email
        const direction = await sortBy(app, 'emailColumn');

        // * Verify that emails are sorted in that direction
        await expectSortedEmails(app, direction);

        // # Sort by email again, toggling the direction
        const reversed = await sortBy(app, 'emailColumn');

        // * Verify that the sort direction has toggled and the emails follow it
        expect(reversed).not.toEqual(direction);
        await expectSortedEmails(app, reversed);
    });

    test('MM-T5523-2 Non sortable columns should not sort the list when clicked', async ({pw}) => {
        const {adminUser, adminClient} = await pw.initSetup();

        // # Create 10 random users
        for (let i = 0; i < 10; i++) {
            await adminClient.createUser(await pw.random.user(), '', '');
        }

        // # Log in as admin and open System Console > Users
        const app = await openSystemUsers(pw, adminUser);

        // * Verify that 'Last login' column is not sortable
        // The non-sortable header is a container; retain the attempted click through its locator.
        const lastLoginHeader = app.admin.users.table.head.column('lastLoginColumn').locator;
        await expect(lastLoginHeader).toBeVisible();
        await expect(lastLoginHeader).not.toHaveAttribute('aria-sort');

        // # Store the first row's email without sorting
        const before = (await visibleEmails(app))[0];

        // # Try to sort by clicking the 'Last login' column header
        await lastLoginHeader.click();
        await expect(lastLoginHeader).not.toHaveAttribute('aria-sort');

        // * Verify that the first row's email is still the same
        expect((await visibleEmails(app))[0]).toEqual(before);
    });
});
