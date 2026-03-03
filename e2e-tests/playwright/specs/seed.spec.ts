// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

test.describe('AI seed patterns', () => {
    test('channels posting flow seed @seed', async ({pw}) => {
        const {user} = await pw.initSetup();

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto();

        const message = `seed-message-${Date.now()}`;
        await channelsPage.postMessage(message);

        await expect(channelsPage.page.getByText(message)).toBeVisible();
    });

    test('system console navigation seed @seed', async ({pw}) => {
        const {adminUser} = await pw.initSetup();

        if (!adminUser) {
            throw new Error('Failed to create admin user');
        }

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();

        await systemConsolePage.page.goto('/admin_console/reporting/system_analytics');
        await expect(systemConsolePage.page).toHaveURL(/\/admin_console\/reporting\/system_analytics/);
    });
});
