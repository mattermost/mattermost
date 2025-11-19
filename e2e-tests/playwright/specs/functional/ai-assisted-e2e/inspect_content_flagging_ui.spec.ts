// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

/**
 * Temporary test to inspect Content Flagging UI elements
 */
test('INSPECT - Content Flagging UI Elements', async ({pw}) => {
    const {adminUser} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Log in as admin
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Visit system console
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // # Go to Content Flagging settings
    await systemConsolePage.sidebar.goToItem('Content Flagging');

    // Wait for page to load
    await pw.wait(3000);

    // Keep browser open for manual inspection
    console.log('Browser opened. Inspect the Content Flagging UI manually.');
    console.log('Press Ctrl+C when done inspecting.');

    // Wait indefinitely to keep browser open
    await pw.wait(300000); // 5 minutes
});
