// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

test('MM-T5521-6 Should show no user is found when user doesnt exists', async ({pw}) => {
    const {adminUser} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Log in as admin
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Visit system console
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // # Go to Users section
    await systemConsolePage.sidebar.users.click();

    // # Enter random text in the search box
    await systemConsolePage.users.searchUsers(`!${pw.random.id(15)}_^^^_${pw.random.id(15)}!`);

    await expect(systemConsolePage.users.container.getByText('No data')).toBeVisible();
});
