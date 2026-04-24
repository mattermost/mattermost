// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

test('MM-T5521-1 Should be able to search users with their first names', async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Log in as admin
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Create 2 users
    const user1 = await adminClient.createUser(await pw.random.user(), '', '');
    const user2 = await adminClient.createUser(await pw.random.user(), '', '');

    // # Visit system console
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // # Go to Users section
    await systemConsolePage.sidebar.users.click();
    await systemConsolePage.users.toBeVisible();

    // # Enter the 'First Name' of the first user in the search box
    await systemConsolePage.users.searchUsers(user1.first_name);

    // * Verify that the searched user i.e first user is found in the list
    await expect(systemConsolePage.users.container.getByText(user1.email)).toBeVisible();

    // * Verify that the second user doesnt appear in the list
    await expect(systemConsolePage.users.container.getByText(user2.email)).not.toBeVisible();
});

test('MM-T5521-2 Should be able to search users with their last names', async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Log in as admin
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Create 2 users
    const user1 = await adminClient.createUser(await pw.random.user(), '', '');
    const user2 = await adminClient.createUser(await pw.random.user(), '', '');

    // # Visit system console
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // # Go to Users section
    await systemConsolePage.sidebar.users.click();
    await systemConsolePage.users.toBeVisible();

    // # Enter the 'Last Name' of the user in the search box
    await systemConsolePage.users.searchUsers(user1.last_name);

    // * Verify that the searched user i.e first user is found in the list
    await expect(systemConsolePage.users.container.getByText(user1.email)).toBeVisible();

    //  * Verify that the second user doesnt appear in the list
    await expect(systemConsolePage.users.container.getByText(user2.email)).not.toBeVisible();
});
