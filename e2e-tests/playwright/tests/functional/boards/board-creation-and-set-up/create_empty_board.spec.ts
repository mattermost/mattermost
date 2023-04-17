// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@e2e-support/test_fixture';
import {shouldSkipInSmallScreen} from '@e2e-support/flag';

shouldSkipInSmallScreen();

test('MM-T4274 Create an Empty Board', async ({pw, pages}) => {
    // Create and sign in a new user
    const {user} = await pw.initSetup();

    // Log in a user in new browser context
    const {page} = await pw.testBrowser.login(user);

    // Visit a default channel page
    const channelsPage = new pages.ChannelsPage(page);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // Switch to Boards page
    await channelsPage.globalHeader.switchProduct('Boards');

    // Should have redirected to boards create page
    const boardsCreatePage = new pages.BoardsCreatePage(page);
    await boardsCreatePage.toBeVisible();

    // Create empty board
    await boardsCreatePage.createEmptyBoard();

    // Should have redirected to boards view page
    const boardsViewPage = new pages.BoardsViewPage(page);
    await boardsViewPage.toBeVisible();
    await boardsViewPage.shouldHaveUntitledBoard();

    // Type new title and hit enter
    const title = 'Testing';
    await boardsViewPage.editableTitle.fill(title);
    await boardsViewPage.editableTitle.press('Enter');

    // Should update the title in heading and in sidebar
    expect(await boardsViewPage.editableTitle.getAttribute('value')).toBe(title);
    await boardsViewPage.sidebar.waitForTitle(title);
});
