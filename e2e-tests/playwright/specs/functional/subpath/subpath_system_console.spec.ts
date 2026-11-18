// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {openSystemConsoleSection, expect, Msg, requireSubpathServer, test} from '@mattermost/playwright-lib';

test.describe('Subpath - System Console', {tag: '@subpath'}, () => {
    test.beforeAll(() => {
        requireSubpathServer();
    });

    /**
     * @objective Verify System Console loads and navigates correctly under the subpath.
     */
    test('loads System Console under the subpath and navigates a sidebar section', async ({pw}) => {
        const {adminUser} = await pw.initSetup();

        const {app} = await pw.testBrowser.login(adminUser);
        await openSystemConsoleSection(app);

        // * Verify the console's navbar and sidebar show
        await expect(app.backstage.navbar.backLink).toBeVisible();
        await expect(app.admin.sidebar.header.info).toContainMessage(Msg.admin.sidebarHeader.systemConsole);
        await expect(app.admin.sidebar.filter.container).toBeVisible();

        // # Navigate to a sidebar section
        await app.admin.sidebar.category('user_management').section('system_users').titleLink.click();

        // * Verify the section loads
        await expect(app.admin.header).toContainMessage(Msg.admin.system_users.title, {siteName: 'Mattermost'});
    });
});
