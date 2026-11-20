// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, openSystemUsers, searchSystemUsers, test, Msg} from '@mattermost/playwright-lib';

test('MM-T5521-1 Should be able to search users with their first names', async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    // # Create 2 users
    const user1 = await adminClient.createUser(await pw.random.user(), '', '');
    const user2 = await adminClient.createUser(await pw.random.user(), '', '');

    // # Log in as admin and open System Console > Users
    const app = await openSystemUsers(pw, adminUser);

    // # Search for the first user's first name
    await searchSystemUsers(app, user1.first_name, user1);

    // * Only the first user is listed
    const {table} = app.admin.users;
    await expect(table.row(user1.id).cell('emailColumn')).toHaveText(user1.email);
    await expect(table.row(user1.id).cell('emailColumn')).toBeVisible();
    await expect(table.rowList).toHaveKeyCount(1);
    await expect(table.row(user2.id)).toHaveCount(0);
});

test('MM-T5521-2 Should be able to search users with their last names', async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    // # Create 2 users
    const user1 = await adminClient.createUser(await pw.random.user(), '', '');
    const user2 = await adminClient.createUser(await pw.random.user(), '', '');

    // # Log in as admin and open System Console > Users
    const app = await openSystemUsers(pw, adminUser);

    // # Search for the first user's last name
    await searchSystemUsers(app, user1.last_name, user1);

    // * Only the first user is listed
    const {table} = app.admin.users;
    await expect(table.row(user1.id).cell('emailColumn')).toHaveText(user1.email);
    await expect(table.row(user1.id).cell('emailColumn')).toBeVisible();
    await expect(table.rowList).toHaveKeyCount(1);
    await expect(table.row(user2.id)).toHaveCount(0);
});

test('MM-T5521-3 Should be able to search users with their emails', async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    // # Create 2 users
    const user1 = await adminClient.createUser(await pw.random.user(), '', '');
    const user2 = await adminClient.createUser(await pw.random.user(), '', '');

    // # Log in as admin and open System Console > Users
    const app = await openSystemUsers(pw, adminUser);

    // # Search for the first user's email
    await searchSystemUsers(app, user1.email, user1);

    // * Only the first user is listed
    const {table} = app.admin.users;
    await expect(table.row(user1.id).cell('emailColumn')).toHaveText(user1.email);
    await expect(table.row(user1.id).cell('emailColumn')).toBeVisible();
    await expect(table.rowList).toHaveKeyCount(1);
    await expect(table.row(user2.id)).toHaveCount(0);
});

test('MM-T5521-4 Should be able to search users with their usernames', async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    // # Create 2 users
    const user1 = await adminClient.createUser(await pw.random.user(), '', '');
    const user2 = await adminClient.createUser(await pw.random.user(), '', '');

    // # Log in as admin and open System Console > Users
    const app = await openSystemUsers(pw, adminUser);

    // # Search for the first user's username
    await searchSystemUsers(app, user1.username, user1);

    // * Only the first user is listed
    const {table} = app.admin.users;
    await expect(table.row(user1.id).cell('emailColumn')).toHaveText(user1.email);
    await expect(table.row(user1.id).cell('emailColumn')).toBeVisible();
    await expect(table.rowList).toHaveKeyCount(1);
    await expect(table.row(user2.id)).toHaveCount(0);
});

test('MM-T5521-5 Should be able to search users with their nick names', async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    // # Create 2 users
    const user1 = await adminClient.createUser(await pw.random.user(), '', '');
    const user2 = await adminClient.createUser(await pw.random.user(), '', '');

    // # Log in as admin and open System Console > Users
    const app = await openSystemUsers(pw, adminUser);

    // # Search for the first user's nickname
    await searchSystemUsers(app, user1.nickname, user1);

    // * Only the first user is listed
    const {table} = app.admin.users;
    await expect(table.row(user1.id).cell('emailColumn')).toHaveText(user1.email);
    await expect(table.row(user1.id).cell('emailColumn')).toBeVisible();
    await expect(table.rowList).toHaveKeyCount(1);
    await expect(table.row(user2.id)).toHaveCount(0);
});

test('MM-T5521-6 Should show no user is found when user doesnt exists', async ({pw}) => {
    const {adminUser} = await pw.initSetup();

    // # Log in as admin and open System Console > Users
    const app = await openSystemUsers(pw, adminUser);

    // # Search for random text
    await app.admin.users.search.container.fill(`!${pw.random.id(15)}_^^^_${pw.random.id(15)}!`);

    // * The table says there is nothing to show
    const {table} = app.admin.users;
    await expect(table.noDataText).toHaveMessage(Msg.adminConsole.list.table.genericNoData);
    await expect(table.noDataText).toBeVisible();
    await expect(table.rowList).toHaveKeyCount(0);
});
