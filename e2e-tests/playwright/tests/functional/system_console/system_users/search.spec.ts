// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@e2e-support/test_fixture';
import {createRandomUser} from '@e2e-support/server';
import {getRandomId} from '@e2e-support/util';

test('MM-T5521-1 Should be able to search users with their first names', async ({pw, pages}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Log in as admin
    const {page} = await pw.testBrowser.login(adminUser);

    // # Create 2 users
    const user1 = await adminClient.createUser(createRandomUser(), '', '');
    const user2 = await adminClient.createUser(createRandomUser(), '', '');

    // # Visit system console
    const systemConsolePage = new pages.SystemConsolePage(page);
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // # Go to Users section
    await systemConsolePage.sidebar.goToItem('Users');
    await systemConsolePage.systemUsers.toBeVisible();

    // # Enter the 'First Name' of the first user in the search box
    await systemConsolePage.systemUsers.enterSearchText(user1.first_name);

    // * Verify that the searched user i.e first user is found in the list
    await systemConsolePage.systemUsers.verifyRowWithTextIsFound(user1.email);

    // * Verify that the second user doesnt appear in the list
    await systemConsolePage.systemUsers.verifyRowWithTextIsNotFound(user2.email);
});

test('MM-T5521-2 Should be able to search users with their last names', async ({pw, pages}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Log in as admin
    const {page} = await pw.testBrowser.login(adminUser);

    // # Create 2 users
    const user1 = await adminClient.createUser(createRandomUser(), '', '');
    const user2 = await adminClient.createUser(createRandomUser(), '', '');

    // # Visit system console
    const systemConsolePage = new pages.SystemConsolePage(page);
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // # Go to Users section
    await systemConsolePage.sidebar.goToItem('Users');
    await systemConsolePage.systemUsers.toBeVisible();

    // # Enter the 'Last Name' of the user in the search box
    await systemConsolePage.systemUsers.enterSearchText(user1.last_name);

    // * Verify that the searched user i.e first user is found in the list
    await systemConsolePage.systemUsers.verifyRowWithTextIsFound(user1.email);

    //  * Verify that the second user doesnt appear in the list
    await systemConsolePage.systemUsers.verifyRowWithTextIsNotFound(user2.email);
});

test('MM-T5521-3 Should be able to search users with their emails', async ({pw, pages}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Log in as admin
    const {page} = await pw.testBrowser.login(adminUser);

    // # Create 2 users
    const user1 = await adminClient.createUser(createRandomUser(), '', '');
    const user2 = await adminClient.createUser(createRandomUser(), '', '');

    // # Visit system console
    const systemConsolePage = new pages.SystemConsolePage(page);
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // # Go to Users section
    await systemConsolePage.sidebar.goToItem('Users');
    await systemConsolePage.systemUsers.toBeVisible();

    // * Enter the 'Email' of the first user in the search box
    await systemConsolePage.systemUsers.enterSearchText(user1.email);

    // * Verify that the searched user i.e first user is found in the list
    await systemConsolePage.systemUsers.verifyRowWithTextIsFound(user1.email);

    //  * Verify that the second user doesnt appear in the list
    await systemConsolePage.systemUsers.verifyRowWithTextIsNotFound(user2.email);
});

test('MM-T5521-4 Should be able to search users with their usernames', async ({pw, pages}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Log in as admin
    const {page} = await pw.testBrowser.login(adminUser);

    // # Create 2 users
    const user1 = await adminClient.createUser(createRandomUser(), '', '');
    const user2 = await adminClient.createUser(createRandomUser(), '', '');

    // # Visit system console
    const systemConsolePage = new pages.SystemConsolePage(page);
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // # Go to Users section
    await systemConsolePage.sidebar.goToItem('Users');
    await systemConsolePage.systemUsers.toBeVisible();

    // # Enter the 'Username' of the first user in the search box
    await systemConsolePage.systemUsers.enterSearchText(user1.username);

    // * Verify that the searched user i.e first user is found in the list
    await systemConsolePage.systemUsers.verifyRowWithTextIsFound(user1.email);

    //  * Verify that the another user is not visible
    await systemConsolePage.systemUsers.verifyRowWithTextIsNotFound(user2.email);
});

test('MM-T5521-5 Should be able to search users with their nick names', async ({pw, pages}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Log in as admin
    const {page} = await pw.testBrowser.login(adminUser);

    // # Create 2 users
    const user1 = await adminClient.createUser(createRandomUser(), '', '');
    const user2 = await adminClient.createUser(createRandomUser(), '', '');

    // # Visit system console
    const systemConsolePage = new pages.SystemConsolePage(page);
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // # Go to Users section
    await systemConsolePage.sidebar.goToItem('Users');

    // # Enter the 'Nickname' of the first user in the search box
    await systemConsolePage.systemUsers.enterSearchText(user1.nickname);

    // * Verify that the searched user i.e first user is found in the list
    await systemConsolePage.systemUsers.verifyRowWithTextIsFound(user1.email);

    //  * Verify that the second user doesnt appear in the list
    await systemConsolePage.systemUsers.verifyRowWithTextIsNotFound(user2.email);
});

test('MM-T5521-6 Should show no user is found when user doesnt exists', async ({pw, pages}) => {
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

    // # Enter random text in the search box
    await systemConsolePage.systemUsers.enterSearchText(`!${getRandomId(15)}_^^^_${getRandomId(15)}!`);

    await systemConsolePage.systemUsers.verifyRowWithTextIsFound('No data');
});
