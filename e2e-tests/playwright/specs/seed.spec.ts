// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

test('channels posting flow seed @seed', async ({pw}) => {
    // # Set up member user and login
    const {user} = await pw.initSetup();
    const {channelsPage, page} = await pw.testBrowser.login(user);

    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Post a message and assert render
    const message = `seed-message-${Date.now()}`;
    await channelsPage.postMessage(message);
    await expect(page.getByText(message)).toBeVisible();
});

test('system console navigation seed @seed', async ({pw}) => {
    // # Set up admin user and login
    const {adminUser, adminClient} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Touch adminClient to keep the setup shape explicit for generation scaffolding
    void (await adminClient.getConfig());

    // # Now login - this ensures the UI will have the attributes loaded
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // * Verify we can navigate to a system console route
    await systemConsolePage.page.goto('/admin_console/reporting/system_analytics');
    await expect(systemConsolePage.page).toHaveURL(/\/admin_console\/reporting\/system_analytics/);
});
