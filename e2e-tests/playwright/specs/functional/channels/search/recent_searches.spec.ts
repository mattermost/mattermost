// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

test('recent searches list, rerun, clear, and persist after reload', async ({pw}) => {
    const {user} = await pw.initSetup();
    const {channelsPage} = await pw.testBrowser.login(user);

    await channelsPage.goto();
    await channelsPage.toBeVisible();

    await channelsPage.globalHeader.openSearch();
    await channelsPage.searchBox.search('hello e2e recent');
    await expect(channelsPage.searchBox.container).not.toBeVisible();

    await channelsPage.globalHeader.openSearch();
    await expect(channelsPage.searchBox.recentSearches).toBeVisible();
    await expect(channelsPage.searchBox.getRecentSearch('hello e2e recent')).toBeVisible();

    await channelsPage.searchBox.getRecentSearch('hello e2e recent').click();
    await expect(channelsPage.searchBox.container).not.toBeVisible();

    await channelsPage.globalHeader.openSearch();
    await channelsPage.searchBox.getRecentSearchClear('hello e2e recent').click();
    await expect(channelsPage.searchBox.getRecentSearch('hello e2e recent')).not.toBeVisible();

    await channelsPage.searchBox.search('persist after reload');
    await expect(channelsPage.searchBox.container).not.toBeVisible();
    await channelsPage.page.reload();
    await channelsPage.toBeVisible();
    await channelsPage.globalHeader.openSearch();
    await expect(channelsPage.searchBox.getRecentSearch('persist after reload')).toBeVisible();
});
