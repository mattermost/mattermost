// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@playwright/test';

import {test} from '@e2e-support/test_fixture';
import {createRandomUser} from '@e2e-support/server';
import {SystemConsolePage} from '@e2e-support/ui/pages/system_console';
import {UserProfile} from '@mattermost/types/users';

test('MM-X Search should search with first name', async ({pw, pages}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Log in as admin
    const {page} = await pw.testBrowser.login(adminUser);

    const users = [];

    // # Create 2 users for search filter
    for (let i = 0; i < 2; i++) {
        const user = await adminClient.createUser(createRandomUser(), '', '');
        users.push(user);
    }

    // # Visit system console
    const systemConsolePage = new pages.SystemConsolePage(page);
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // # Go to Users section
    await systemConsolePage.sidebar.goToItem('Users');
    await systemConsolePage.systemUsers.toBeVisible();

    // * Enter the firstname of the first user and verify that it appears in the list
    await systemConsolePage.systemUsers.enterSearchText(users[0].first_name);
    await verifyUserIsFoundInTheList(systemConsolePage, users[0]);

    // * Verify that the second user's details are not visible
    expect(systemConsolePage.systemUsers.container.getByText(users[1].email)).not.toBeVisible();
});

test('MM-X Search should search with last name', async ({pw, pages}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Log in as admin
    const {page} = await pw.testBrowser.login(adminUser);

    const users = [];
    // # Create 2 team to filter
    for (let i = 0; i < 2; i++) {
        // # Create a user corresponding to the team
        const user = await adminClient.createUser(createRandomUser(), '', '');
        users.push(user);
    }

    // # Visit system console
    const systemConsolePage = new pages.SystemConsolePage(page);
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // # Go to Users section
    await systemConsolePage.sidebar.goToItem('Users');
    await systemConsolePage.systemUsers.toBeVisible();

    // * Enter the last name of the user and verify that it searches correctly with the last name
    await systemConsolePage.systemUsers.enterSearchText(users[0].last_name);
    await verifyUserIsFoundInTheList(systemConsolePage, users[0]);

    //  * Verify that the another user is not visible
    expect(systemConsolePage.systemUsers.container.getByText(users[1].email)).not.toBeVisible();
});

test('MM-X Search should search with the email', async ({pw, pages}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Log in as admin
    const {page} = await pw.testBrowser.login(adminUser);

    const users = [];
    // # Create 2 team to filter
    for (let i = 0; i < 2; i++) {
        // # Create a user corresponding to the team
        const user = await adminClient.createUser(createRandomUser(), '', '');
        users.push(user);
    }

    // # Visit system console
    const systemConsolePage = new pages.SystemConsolePage(page);
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // # Go to Users section
    await systemConsolePage.sidebar.goToItem('Users');
    await systemConsolePage.systemUsers.toBeVisible();

    // * Enter the email of the a user and verify that it searches correctly with the email
    await systemConsolePage.systemUsers.enterSearchText(users[0].email);
    await verifyUserIsFoundInTheList(systemConsolePage, users[0]);

    //  * Verify that the another user is not visible
    expect(systemConsolePage.systemUsers.container.getByText(users[1].email)).not.toBeVisible();
});

test('MM-X Search should search with the username', async ({pw, pages}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Log in as admin
    const {page} = await pw.testBrowser.login(adminUser);

    const users = [];
    // # Create 2 team to filter
    for (let i = 0; i < 2; i++) {
        // # Create a user corresponding to the team
        const user = await adminClient.createUser(createRandomUser(), '', '');
        users.push(user);
    }

    // # Visit system console
    const systemConsolePage = new pages.SystemConsolePage(page);
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // # Go to Users section
    await systemConsolePage.sidebar.goToItem('Users');
    await systemConsolePage.systemUsers.toBeVisible();

    // * Enter the username of the user and verify that it searches correctly
    await systemConsolePage.systemUsers.enterSearchText(users[0].username);
    await verifyUserIsFoundInTheList(systemConsolePage, users[0]);

    //  * Verify that the another user is not visible
    expect(systemConsolePage.systemUsers.container.getByText(users[1].email)).not.toBeVisible();
});

test('MM-X Search should search with the nickname', async ({pw, pages}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Log in as admin
    const {page} = await pw.testBrowser.login(adminUser);

    const users = [];
    // # Create 2 team to filter
    for (let i = 0; i < 2; i++) {
        // # Create a user corresponding to the team
        const user = await adminClient.createUser(createRandomUser(), '', '');
        users.push(user);
    }

    // # Visit system console
    const systemConsolePage = new pages.SystemConsolePage(page);
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // # Go to Users section
    await systemConsolePage.sidebar.goToItem('Users');

    // * Enter the nickname of the a user and verify that it searches
    await systemConsolePage.systemUsers.enterSearchText(users[0].nickname);
    await verifyUserIsFoundInTheList(systemConsolePage, users[0]);

    //  * Verify that the another user is not visible
    expect(systemConsolePage.systemUsers.container.getByText(users[1].email)).not.toBeVisible();
});

async function verifyUserIsFoundInTheList(systemConsolePage: SystemConsolePage, user: UserProfile) {
    const foundUser = systemConsolePage.systemUsers.container.getByText(user.email);
    await foundUser.waitFor();
    expect(foundUser).toBeVisible();
}
