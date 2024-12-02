// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@e2e-support/test_fixture';

test('Search box suggestion must be case insensitive', async ({pw, pages}) => {
    const {user} = await pw.initSetup();

    // # Log in a user in new browser context
    const {page} = await pw.testBrowser.login(user);

    // # Visit a default channel page
    const channelsPage = new pages.ChannelsPage(page);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Open the search UI
    await channelsPage.globalHeader.openSearch();

    const searchInput = await page.getByPlaceholder('Search messages');

    // * it's working when using lowercase
    await searchInput.fill('In:off');
    await searchInput.press('Enter');
    await expect(searchInput).toHaveValue('In:off-topic ');

    // * it's working when using uppercase
    await searchInput.clear();
    await searchInput.fill('In:Off');
    await searchInput.press('Enter');
    await expect(searchInput).toHaveValue('In:off-topic ');
});
