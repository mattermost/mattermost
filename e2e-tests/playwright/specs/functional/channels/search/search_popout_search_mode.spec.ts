// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {
    expectPopoutUrlContainsSearchPath,
    openPopoutFromSearchContainer,
    popoutButtonSelector,
    searchContainerSelector,
} from './support';

test('MM-65630-1 Search results should show popout button that opens results in a new window', async ({pw}) => {
    const {adminClient, user, team} = await pw.initSetup();

    const channel = await adminClient.createChannel(
        pw.random.channel({
            teamId: team.id,
            displayName: 'Search Popout Channel',
            name: 'search-popout-channel',
        }),
    );
    await adminClient.addToChannel(user.id, channel.id);

    const uniqueText = `popout-search-test-${pw.random.id()}`;
    await adminClient.createPost({
        channel_id: channel.id,
        message: uniqueText,
    });

    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    const page = channelsPage.page;

    await channelsPage.globalHeader.openSearch();
    await channelsPage.searchBox.searchInput.fill(uniqueText);
    await channelsPage.searchBox.searchInput.press('Enter');

    await expect(page.locator(searchContainerSelector)).toBeVisible();
    await expect(page.locator(searchContainerSelector).getByText(uniqueText)).toBeVisible();

    const popoutPage = await openPopoutFromSearchContainer(page);
    const popoutUrl = popoutPage.url();
    expectPopoutUrlContainsSearchPath(popoutUrl);
    expect(popoutUrl).toContain(`q=${encodeURIComponent(uniqueText)}`);
    expect(popoutUrl).toContain('mode=search');

    await expect(popoutPage.locator(searchContainerSelector)).toBeVisible({timeout: 10000});
    await expect(popoutPage.locator(searchContainerSelector).getByText(uniqueText)).toBeVisible({timeout: 10000});

    await popoutPage.close();
});

test('MM-65630-4 Search popout should not show popout button in the popout window itself', async ({pw}) => {
    const {adminClient, user, team} = await pw.initSetup();

    const channel = await adminClient.createChannel(
        pw.random.channel({
            teamId: team.id,
            displayName: 'Popout No Button Channel',
            name: 'popout-no-button-channel',
        }),
    );
    await adminClient.addToChannel(user.id, channel.id);

    const uniqueText = `no-button-test-${pw.random.id()}`;
    await adminClient.createPost({
        channel_id: channel.id,
        message: uniqueText,
    });

    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    const page = channelsPage.page;

    await channelsPage.globalHeader.openSearch();
    await channelsPage.searchBox.searchInput.fill(uniqueText);
    await channelsPage.searchBox.searchInput.press('Enter');

    await expect(page.locator(searchContainerSelector)).toBeVisible();

    const [popoutPage] = await Promise.all([page.waitForEvent('popup'), page.locator(popoutButtonSelector).click()]);

    await popoutPage.waitForLoadState('domcontentloaded');
    await expect(popoutPage.locator(searchContainerSelector)).toBeVisible({timeout: 10000});

    await expect(popoutPage.locator('.PopoutButton')).not.toBeVisible();

    await expect(popoutPage.locator('#searchResultsCloseButton')).not.toBeVisible();

    await popoutPage.close();
});

test('MM-65630-5 Search popout should preserve search type (files) in the URL', async ({pw}) => {
    const {adminClient, user, team} = await pw.initSetup();

    const channel = await adminClient.createChannel(
        pw.random.channel({
            teamId: team.id,
            displayName: 'Files Search Channel',
            name: 'files-search-channel',
        }),
    );
    await adminClient.addToChannel(user.id, channel.id);

    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    const page = channelsPage.page;

    await channelsPage.globalHeader.openSearch();
    await channelsPage.searchBox.searchInput.fill('test');
    await channelsPage.searchBox.searchInput.press('Enter');

    await expect(page.locator(searchContainerSelector)).toBeVisible();

    const filesTab = page.locator(searchContainerSelector).getByRole('tab', {name: /Files/});
    await filesTab.click();

    const popoutPage = await openPopoutFromSearchContainer(page);
    const popoutUrl = popoutPage.url();
    expect(popoutUrl).toContain('type=files');

    await popoutPage.close();
});
