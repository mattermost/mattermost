// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@e2e-support/test_fixture';
import {shouldSkipInSmallScreen} from '@e2e-support/flag';

shouldSkipInSmallScreen();

test('Board template', async ({pw, pages, browserName, viewport}, testInfo) => {
    // Create and sign in a new user
    const {user} = await pw.initSetup();

    // Log in a user in new browser context
    const {page} = await pw.testBrowser.login(user);

    // Should have redirected to boards create page
    const boardsCreatePage = new pages.BoardsCreatePage(page);
    await boardsCreatePage.goto();
    await boardsCreatePage.toBeVisible();

    // Match snapshot of create board page
    const testArgs = {page, browserName, viewport};
    await pw.matchSnapshot(testInfo, testArgs);
});
