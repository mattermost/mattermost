// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, requireSubpathServer} from '@mattermost/playwright-lib';

test.describe('Subpath - System Console', {tag: '@subpath'}, () => {
    test.beforeAll(() => {
        requireSubpathServer();
    });

    /**
     * @objective Verify System Console loads and navigates correctly under the subpath.
     */
    test('loads System Console under the subpath and navigates a sidebar section', async ({pw}) => {
        const {adminUser} = await pw.initSetup();

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();

        // # Navigate to a sidebar section
        await systemConsolePage.sidebar.users.click();

        // * Verify the section loads
        await systemConsolePage.users.toBeVisible();
    });
});
