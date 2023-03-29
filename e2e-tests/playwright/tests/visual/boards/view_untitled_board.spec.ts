// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@e2e-support/test_fixture';
import {shouldSkipInSmallScreen} from '@e2e-support/flag';

shouldSkipInSmallScreen();

test('View untitled board', async ({pw, pages, browserName, viewport}, testInfo) => {
    await pw.shouldHaveBoardsEnabled();

    // Create and sign in a new user
    const {user} = await pw.initSetup();

    // Log in a user in new browser context
    const {page} = await pw.testBrowser.login(user);

    // Should have redirected to boards create page
    const boardsCreatePage = new pages.BoardsCreatePage(page);
    await boardsCreatePage.goto();
    await boardsCreatePage.toBeVisible();

    // Create empty board
    await boardsCreatePage.createEmptyBoard();

    // Should have redirected to boards view page
    const boardsViewPage = new pages.BoardsViewPage(page);
    await boardsViewPage.toBeVisible();
    await boardsViewPage.shouldHaveUntitledBoard();

    // Match snapshot of create board page
    const testArgs = {page, browserName, viewport};
    await pw.matchSnapshot(testInfo, testArgs);
});
