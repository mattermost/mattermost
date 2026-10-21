// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect, requireSubpathServer} from '@mattermost/playwright-lib';

test.describe('Subpath - search', {tag: '@subpath'}, () => {
    let subpathBaseURL: string;

    test.beforeAll(() => {
        subpathBaseURL = requireSubpathServer();
    });

    /**
     * @objective Verify a search result jump navigates to the target channel under the subpath.
     */
    test('jumps from a search result to the target channel under the subpath', async ({pw}) => {
        const {user, team, adminClient} = await pw.initSetup();
        const targetChannel = await adminClient.createPublicChannel(team.id, 'Subpath Search Target');
        await adminClient.addToChannel(user.id, targetChannel.id);

        const token = `subpathsearch${pw.random.id()}`;
        await adminClient.createPost({channel_id: targetChannel.id, message: token});

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Search for the message and jump to it
        await channelsPage.globalHeader.openSearch();
        await channelsPage.searchBox.searchInput.fill(token);
        await channelsPage.searchBox.searchInput.press('Enter');
        await expect(channelsPage.searchResultsContainer).toBeVisible();
        const result = channelsPage.getSearchResultItem(token);
        await expect(result).toBeVisible();
        await result.getByRole('link', {name: 'Jump'}).click();

        // * Verify navigation lands on the target channel under the subpath
        await expect
            .poll(() => page.url(), {timeout: pw.duration.ten_sec})
            .toContain(`${subpathBaseURL}/${team.name}/channels/${targetChannel.name}`);
    });
});
