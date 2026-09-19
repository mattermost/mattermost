// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {duration, expect, type ChannelsPage} from '@mattermost/playwright-lib';

export async function submitSearch(channelsPage: ChannelsPage, query: string) {
    await channelsPage.globalHeader.openSearch();
    await channelsPage.searchBox.clearIfPossible();
    await channelsPage.searchBox.searchInput.fill(query);
    await channelsPage.searchBox.searchInput.press('Enter');
    await expect(channelsPage.searchResultsContainer).toBeVisible();
}

export async function expectSearchResult(
    channelsPage: ChannelsPage,
    text: string,
    query?: string,
    timeout = duration.half_min,
) {
    const result = channelsPage.getSearchResultItem(text);

    await expect(async () => {
        if (await result.isVisible({timeout: duration.one_sec}).catch(() => false)) {
            return;
        }

        if (query) {
            await submitSearch(channelsPage, query);
        } else {
            await channelsPage.searchBox.searchInput.press('Enter');
        }
        await expect(result).toBeVisible({timeout: duration.ten_sec});
    }).toPass({timeout});
}

export async function expectNoSearchResult(channelsPage: ChannelsPage, text: string) {
    await expect(channelsPage.getSearchResultItem(text)).toHaveCount(0);
}
