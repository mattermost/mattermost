// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {components, expect, test} from '@mattermost/playwright-lib';

function popoutSearchResults(popoutPage: import('@playwright/test').Page) {
    return components.SearchResults.fromPage(popoutPage);
}

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

    const {searchResults} = channelsPage;
    const page = channelsPage.page;

    await channelsPage.globalHeader.openSearch();
    await channelsPage.searchBox.searchInput.fill(uniqueText);
    await channelsPage.searchBox.searchInput.press('Enter');

    await expect(searchResults.container).toBeVisible();
    await expect(searchResults.getText(uniqueText)).toBeVisible();

    const {popoutButton} = searchResults;
    await expect(popoutButton).toBeVisible();

    const [popoutPage] = await Promise.all([page.waitForEvent('popup'), popoutButton.click()]);

    await popoutPage.waitForLoadState('domcontentloaded');
    const popoutUrl = popoutPage.url();
    expect(popoutUrl).toContain('/_popout/rhs/');
    expect(popoutUrl).toContain('/search');
    expect(popoutUrl).toContain(`q=${encodeURIComponent(uniqueText)}`);
    expect(popoutUrl).toContain('mode=search');

    const popoutResults = popoutSearchResults(popoutPage);
    await expect(popoutResults.container).toBeVisible({timeout: 10000});
    await expect(popoutResults.getText(uniqueText)).toBeVisible({timeout: 10000});

    await popoutPage.close();
});

test('MM-65630-2 Recent mentions popout should open with the right results', async ({pw}) => {
    const {adminClient, user, team} = await pw.initSetup();

    const channel = await adminClient.createChannel(
        pw.random.channel({
            teamId: team.id,
            displayName: 'Mentions Popout Channel',
            name: 'mentions-popout-channel',
        }),
    );
    await adminClient.addToChannel(user.id, channel.id);

    const mentionText = `hey @${user.username} check this mention-${pw.random.id()}`;
    await adminClient.createPost({
        channel_id: channel.id,
        message: mentionText,
    });

    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    const {searchResults} = channelsPage;
    const page = channelsPage.page;

    await channelsPage.globalHeader.openRecentMentions();

    await expect(searchResults.container).toBeVisible();
    await expect(searchResults.getHeading('Recent Mentions')).toBeVisible();
    await expect(searchResults.getText(mentionText)).toBeVisible();

    const {popoutButton} = searchResults;
    await expect(popoutButton).toBeVisible();

    const [popoutPage] = await Promise.all([page.waitForEvent('popup'), popoutButton.click()]);

    await popoutPage.waitForLoadState('domcontentloaded');
    const popoutUrl = popoutPage.url();
    expect(popoutUrl).toContain('/_popout/rhs/');
    expect(popoutUrl).toContain('/search');
    expect(popoutUrl).toContain('mode=mention');

    const popoutResults = popoutSearchResults(popoutPage);
    await expect(popoutResults.container).toBeVisible({timeout: 10000});
    await expect(popoutResults.getText(mentionText)).toBeVisible({timeout: 10000});

    await popoutPage.close();
});

test('MM-65630-3 Saved messages popout should open with the right results', async ({pw}) => {
    const {adminClient, user, userClient, team} = await pw.initSetup();

    const channel = await adminClient.createChannel(
        pw.random.channel({
            teamId: team.id,
            displayName: 'Saved Popout Channel',
            name: 'saved-popout-channel',
        }),
    );
    await adminClient.addToChannel(user.id, channel.id);

    const savedText = `saved-message-test-${pw.random.id()}`;
    const post = await adminClient.createPost({
        channel_id: channel.id,
        message: savedText,
    });

    await userClient.savePreferences(user.id, [
        {
            user_id: user.id,
            category: 'flagged_post',
            name: post.id,
            value: 'true',
        },
    ]);

    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    const {searchResults} = channelsPage;
    const page = channelsPage.page;

    await channelsPage.globalHeader.savedMessagesButton.click();

    await expect(searchResults.container).toBeVisible();
    await expect(searchResults.getHeading('Saved messages')).toBeVisible();
    await expect(searchResults.getText(savedText)).toBeVisible();

    const {popoutButton} = searchResults;
    await expect(popoutButton).toBeVisible();

    const [popoutPage] = await Promise.all([page.waitForEvent('popup'), popoutButton.click()]);

    await popoutPage.waitForLoadState('domcontentloaded');
    const popoutUrl = popoutPage.url();
    expect(popoutUrl).toContain('/_popout/rhs/');
    expect(popoutUrl).toContain('/search');
    expect(popoutUrl).toContain('mode=flag');

    const popoutResults = popoutSearchResults(popoutPage);
    await expect(popoutResults.container).toBeVisible({timeout: 10000});
    await expect(popoutResults.getText(savedText)).toBeVisible({timeout: 10000});

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

    const {searchResults} = channelsPage;
    const page = channelsPage.page;

    await channelsPage.globalHeader.openSearch();
    await channelsPage.searchBox.searchInput.fill(uniqueText);
    await channelsPage.searchBox.searchInput.press('Enter');

    await expect(searchResults.container).toBeVisible();

    const [popoutPage] = await Promise.all([page.waitForEvent('popup'), searchResults.popoutButton.click()]);

    await popoutPage.waitForLoadState('domcontentloaded');
    const popoutResults = popoutSearchResults(popoutPage);
    await expect(popoutResults.container).toBeVisible({timeout: 10000});

    await expect(popoutResults.popoutButton).not.toBeVisible();

    await expect(popoutResults.closeButton).not.toBeVisible();

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

    const {searchResults} = channelsPage;
    const page = channelsPage.page;

    await channelsPage.globalHeader.openSearch();
    await channelsPage.searchBox.searchInput.fill('test');
    await channelsPage.searchBox.searchInput.press('Enter');

    await expect(searchResults.container).toBeVisible();

    await searchResults.getTab(/Files/).click();

    const {popoutButton} = searchResults;
    await expect(popoutButton).toBeVisible();

    const [popoutPage] = await Promise.all([page.waitForEvent('popup'), popoutButton.click()]);

    await popoutPage.waitForLoadState('domcontentloaded');
    const popoutUrl = popoutPage.url();
    expect(popoutUrl).toContain('type=files');

    await popoutPage.close();
});
